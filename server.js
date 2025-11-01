const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { adminMiddleware, generateToken } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const BOT_TOKEN = process.env.BOT_TOKEN;

// Защита от ошибок: если токен не задан — предупреждение (но сервер запустится для разработки)
if (!BOT_TOKEN) {
  console.warn('⚠️  ПРЕДУПРЕЖДЕНИЕ: Переменная BOT_TOKEN не задана!');
  console.warn('Для продакшена убедитесь, что вы добавили её в Environment Variables.');
}

// Список ID администраторов из Telegram
const ADMIN_TELEGRAM_IDS = [
    '853232715', // Замените на ваш реальный ID
    // Можете добавить еще админов
];

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Health check endpoint для предотвращения засыпания на бесплатном тарифе
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Настройка multer для загрузки изображений
const uploadsDir = 'public/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Инициализация базы данных
const db = new Database('shop.db');

// Создание таблиц (better-sqlite3 синхронный, не нужен serialize)
try {
  // Таблица пользователей
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE,
    username TEXT,
    is_admin BOOLEAN DEFAULT 0,
    referrer_id INTEGER,
    referral_earnings REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица товаров
  db.exec(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image_url TEXT,
    category TEXT,
    stock INTEGER DEFAULT 0,
    infinite_stock BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица заказов
  db.exec(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    product_id INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (product_id) REFERENCES products (id) 
  )`);

  // Таблица отзывов
  db.exec(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    user_id INTEGER,
    rating INTEGER NOT NULL,
    text TEXT,
    is_hidden BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Добавляем админа по умолчанию (замените на свой Telegram ID)
  const insertAdmin = db.prepare(`INSERT OR IGNORE INTO users (telegram_id, username, is_admin) VALUES (?, ?, ?)`);
  insertAdmin.run('853232715', 'admin', 1);
  
  console.log('✅ База данных инициализирована успешно');
} catch (error) {
  console.error('❌ Ошибка инициализации базы данных:', error);
  process.exit(1);
}

// Роут для авторизации через Telegram
app.post('/api/auth/telegram', (req, res) => {
    const { id, first_name, last_name, username } = req.body;
    // Временно разрешаем всем быть админами для теста
    const isAdmin = true; // !!! ОПАСНО: только для теста, убрать в продакшене
    // Создаем JWT токен
    const user = {
        id: id,
        telegram_id: id,
        username: username,
        is_admin: isAdmin
    };
    const token = generateToken(user);
    res.json({
        success: true,
        token: token,
        user: {
            telegramId: id,
            firstName: first_name,
            lastName: last_name,
            username: username,
            role: isAdmin ? 'admin' : 'user'
        }
    });
});

// API маршруты

// Регистрация/авторизация пользователя
app.post('/api/auth', (req, res) => {
  try {
    const { telegram_id, username, ref } = req.body;
    let referrer_id = null;
    if (ref) {
      referrer_id = parseInt(ref, 10);
    }
    
    // Ищем существующего пользователя
    const getUser = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    const user = getUser.get(telegram_id);
    
    if (user) {
      // Пользователь существует
      const token = generateToken(user);
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          telegram_id: user.telegram_id, 
          username: user.username, 
          is_admin: user.is_admin, 
          referrer_id: user.referrer_id 
        } 
      });
    } else {
      // Создаем нового пользователя
      const insertUser = db.prepare('INSERT INTO users (telegram_id, username, referrer_id) VALUES (?, ?, ?)');
      const result = insertUser.run(telegram_id, username, referrer_id);
      
      const newUser = {
        id: result.lastInsertRowid,
        telegram_id,
        username,
        is_admin: false
      };
      
      const token = generateToken(newUser);
      res.json({ 
        token, 
        user: { 
          id: result.lastInsertRowid, 
          telegram_id, 
          username, 
          is_admin: false, 
          referrer_id 
        }
      });
    }
  } catch (error) {
    console.error('DB error:', error);
    res.status(500).json({ error: 'Ошибка базы данных', details: error.message });
  }
});

// Получение списка товаров
app.get('/api/products', (req, res) => {
  try {
    // Получаем все активные товары
    const getProducts = db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC');
    const products = getProducts.all();
    
    if (products.length === 0) {
      return res.json(products);
    }
    
    // Для каждого товара считаем рейтинг и количество отзывов
    const productIds = products.map(p => p.id);
    const placeholders = productIds.map(() => '?').join(',');
    const getRatings = db.prepare(`SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as reviews_count FROM reviews WHERE product_id IN (${placeholders}) GROUP BY product_id`);
    const ratings = getRatings.all(...productIds);
    
    // Создаем карту рейтингов
    const ratingMap = {};
    ratings.forEach(r => { 
      ratingMap[r.product_id] = r; 
    });
    
    // Добавляем рейтинги к товарам
    const result = products.map(p => ({
      ...p,
      rating: ratingMap[p.id]?.avg_rating || 0,
      reviewsCount: ratingMap[p.id]?.reviews_count || 0
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
});

// Получение товара по ID
app.get('/api/products/:id', (req, res) => {
  try {
    const getProduct = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1');
    const product = getProduct.get(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    
    const getRating = db.prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as reviews_count FROM reviews WHERE product_id = ?');
    const rating = getRating.get(product.id);
    
    res.json({
      ...product,
      rating: rating?.avg_rating || 0,
      reviewsCount: rating?.reviews_count || 0
    });
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ error: 'Ошибка получения товара' });
  }
});

// Создание заказа
app.post('/api/orders', adminMiddleware, (req, res) => {
  try {
    const { product_id } = req.body;
    const user_id = req.user.id;

    const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
    const product = getProduct.get(product_id);
    
    if (!product) {
      return res.status(400).json({ error: 'Товар не найден' });
    }
    
    const insertOrder = db.prepare('INSERT INTO orders (user_id, product_id) VALUES (?, ?)');
    const result = insertOrder.run(user_id, product_id);
    
    // Начисляем 5% пригласившему
    const getUser = db.prepare('SELECT referrer_id FROM users WHERE id = ?');
    const user = getUser.get(user_id);
    
    if (user && user.referrer_id) {
      const bonus = product.price * 0.05;
      const updateReferrer = db.prepare('UPDATE users SET referral_earnings = referral_earnings + ? WHERE id = ?');
      updateReferrer.run(bonus, user.referrer_id);
    }
    
    res.json({ id: result.lastInsertRowid, message: 'Заказ создан успешно' });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Ошибка создания заказа' });
  }
});

// Получение заказов пользователя
app.get('/api/orders', adminMiddleware, (req, res) => {
  try {
    const getOrders = db.prepare(`
      SELECT o.*, p.name as product_name, p.price 
      FROM orders o 
      JOIN products p ON o.product_id = p.id 
      WHERE o.user_id = ? 
      ORDER BY o.created_at DESC
    `);
    const orders = getOrders.all(req.user.id);
    res.json(orders);
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ error: 'Ошибка получения заказов' });
  }
});

// АДМИНСКИЕ МАРШРУТЫ

// Получение статистики для дашборда
app.get('/api/admin/stats', adminMiddleware, (req, res) => {
  try {
    const getProductsCount = db.prepare('SELECT COUNT(*) as total_products FROM products WHERE is_active = 1');
    const getOrdersCount = db.prepare('SELECT COUNT(*) as total_orders FROM orders');
    const getUsersCount = db.prepare('SELECT COUNT(*) as total_users FROM users');
    
    const productsCount = getProductsCount.get();
    const ordersCount = getOrdersCount.get();
    const usersCount = getUsersCount.get();
    
    res.json({
      success: true,
      total_products: productsCount.total_products,
      total_orders: ordersCount.total_orders,
      total_users: usersCount.total_users
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение всех заказов
app.get('/api/admin/orders', adminMiddleware, (req, res) => {
  try {
    const getOrders = db.prepare(`
      SELECT o.*, p.name as product_name, p.price, u.username, u.telegram_id 
      FROM orders o 
      JOIN products p ON o.product_id = p.id 
      JOIN users u ON o.user_id = u.id 
      ORDER BY o.created_at DESC
    `);
    const orders = getOrders.all();
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error getting admin orders:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение всех пользователей
app.get('/api/admin/users', adminMiddleware, (req, res) => {
  try {
    const getUsers = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    const users = getUsers.all();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание продукта
app.post('/api/admin/products', adminMiddleware, upload.single('image'), (req, res) => {
  try {
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    if (!req.body.name || !req.body.price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    
    let price = parseFloat(req.body.price);
    if (isNaN(price)) {
      return res.status(400).json({ error: 'Invalid price format' });
    }
    
    let stock = parseInt(req.body.stock);
    if (isNaN(stock)) stock = 0;
    
    const infiniteStock = req.body.infinite_stock === 'on' || req.body.infinite_stock === 'true' ? 1 : 0;
    
    const insertProduct = db.prepare(`
      INSERT INTO products (name, description, price, category, stock, infinite_stock, image_url, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    
    const result = insertProduct.run(
      req.body.name,
      req.body.description,
      price,
      req.body.category,
      stock,
      infiniteStock,
      imagePath
    );
    
    res.json({ success: true, message: 'Продукт создан успешно', id: result.lastInsertRowid });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновление продукта
app.put('/api/admin/products/:id', adminMiddleware, upload.single('image'), (req, res) => {
  try {
    const productId = req.params.id;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!req.body.name || !req.body.price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    
    let price = parseFloat(req.body.price);
    if (isNaN(price)) {
      return res.status(400).json({ error: 'Invalid price format' });
    }
    
    let stock = parseInt(req.body.stock);
    if (isNaN(stock)) stock = 0;
    
    const infiniteStock = req.body.infinite_stock === 'on' || req.body.infinite_stock === 'true' ? 1 : 0;
    const isActiveValue = req.body.is_active === 'on' || req.body.is_active === 'true' ? 1 : 0;
    
    let updateProduct;
    let params = [req.body.name, req.body.description, price, req.body.category, isActiveValue, stock, infiniteStock];
    
    if (imagePath) {
      updateProduct = db.prepare(`
        UPDATE products 
        SET name = ?, description = ?, price = ?, category = ?, is_active = ?, stock = ?, infinite_stock = ?, image_url = ?
        WHERE id = ?
      `);
      params.push(imagePath);
    } else {
      updateProduct = db.prepare(`
        UPDATE products 
        SET name = ?, description = ?, price = ?, category = ?, is_active = ?, stock = ?, infinite_stock = ?
        WHERE id = ?
      `);
    }
    
    params.push(productId);
    updateProduct.run(...params);
    
    res.json({ success: true, message: 'Продукт обновлен успешно' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление продукта
app.delete('/api/admin/products/:id', adminMiddleware, (req, res) => {
  try {
    const productId = req.params.id;
    const deleteProduct = db.prepare('DELETE FROM products WHERE id = ?');
    deleteProduct.run(productId);
    res.json({ success: true, message: 'Продукт удален успешно' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление заказа
app.delete('/api/admin/orders/:id', adminMiddleware, (req, res) => {
  try {
    const orderId = req.params.id;
    const deleteOrder = db.prepare('DELETE FROM orders WHERE id = ?');
    deleteOrder.run(orderId);
    res.json({ success: true, message: 'Заказ удален успешно' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить отзывы по товару
app.get('/api/products/:id/reviews', (req, res) => {
  try {
    const getReviews = db.prepare(`
      SELECT r.*, u.username, u.telegram_id 
      FROM reviews r 
      JOIN users u ON r.user_id = u.id 
      WHERE r.product_id = ? 
      ORDER BY r.created_at DESC
    `);
    const reviews = getReviews.all(req.params.id);
    res.json(reviews);
  } catch (error) {
    console.error('Error getting reviews:', error);
    res.status(500).json({ error: 'Ошибка получения отзывов' });
  }
});

// Добавить отзыв (только если есть заказ)
app.post('/api/reviews', adminMiddleware, (req, res) => {
  try {
    const { product_id, rating, text } = req.body;
    const user_id = req.user.id;
    
    const getOrder = db.prepare('SELECT * FROM orders WHERE user_id = ? AND product_id = ?');
    const order = getOrder.get(user_id, product_id);
    
    if (!order) {
      return res.status(403).json({ error: 'Можно оставить отзыв только после покупки' });
    }
    
    const insertReview = db.prepare('INSERT INTO reviews (product_id, user_id, rating, text) VALUES (?, ?, ?, ?)');
    const result = insertReview.run(product_id, user_id, rating, text);
    
    res.json({ id: result.lastInsertRowid, message: 'Отзыв добавлен' });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ error: 'Ошибка добавления отзыва' });
  }
});

// Скрыть профиль в отзыве (только владелец)
app.patch('/api/reviews/:id/hide', adminMiddleware, (req, res) => {
  try {
    const reviewId = req.params.id;
    const user_id = req.user.id;
    
    const getReview = db.prepare('SELECT * FROM reviews WHERE id = ?');
    const review = getReview.get(reviewId);
    
    if (!review) {
      return res.status(404).json({ error: 'Отзыв не найден' });
    }
    
    if (review.user_id !== user_id) {
      return res.status(403).json({ error: 'Можно скрыть только свой отзыв' });
    }
    
    const hideReview = db.prepare('UPDATE reviews SET is_hidden = 1 WHERE id = ?');
    hideReview.run(reviewId);
    
    res.json({ message: 'Профиль скрыт' });
  } catch (error) {
    console.error('Error hiding review:', error);
    res.status(500).json({ error: 'Ошибка скрытия профиля' });
  }
});

// Отправка уведомлений в Telegram (пример использования BOT_TOKEN)
app.post('/api/notify-order', adminMiddleware, async (req, res) => {
  const { chatId, order } = req.body;

  if (!BOT_TOKEN) {
    return res.status(500).json({ error: 'BOT_TOKEN не настроен' });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🛍️ Новый заказ!\n\n📦 Товар: ${order.productName}\n💰 Сумма: ${order.price}₽\n👤 Пользователь: ${order.username}`,
        parse_mode: 'HTML'
      })
    });

    if (response.ok) {
      res.json({ success: true, message: 'Уведомление отправлено' });
    } else {
      const error = await response.text();
      console.error('Telegram API error:', error);
      res.status(500).json({ error: 'Не удалось отправить уведомление' });
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    res.status(500).json({ error: 'Ошибка отправки уведомления' });
  }
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Админ панель
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Функция для поиска свободного порта
const findFreePort = (startPort) => {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(startPort, (err) => {
      if (err) {
        server.close();
        resolve(findFreePort(startPort + 1));
      } else {
        const port = server.address().port;
        server.close();
        resolve(port);
      }
    });
  });
};

// Запуск сервера
const startServer = async () => {
  try {
    // Если PORT задан в переменных окружения (продакшен), используем его напрямую
    // Иначе ищем свободный порт для локальной разработки
    const targetPort = process.env.PORT ? PORT : await findFreePort(PORT);
    
    app.listen(targetPort, () => {
      console.log(`🚀 Сервер запущен на порту ${targetPort}`);
      console.log(`🏠 Главная страница: http://localhost:${targetPort}`);
      console.log(`⚙️  Админ панель: http://localhost:${targetPort}/admin`);
      console.log(`❤️  Health check: http://localhost:${targetPort}/healthz`);
      
      if (!process.env.PORT && targetPort !== PORT) {
        console.log(`⚠️  Порт ${PORT} был занят, используется порт ${targetPort}`);
      }
      
      if (BOT_TOKEN) {
        console.log('✅ BOT_TOKEN настроен');
      } else {
        console.log('⚠️  BOT_TOKEN не настроен - уведомления Telegram недоступны');
      }
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
};

startServer();
