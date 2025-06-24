const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { adminMiddleware, generateToken } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || '8dabb91a02c70f2a9016b7cebc4f151b4cad0ae7085b11d80793c0707ebdbd4f4e55114c52ce428a6800f3698c54f9d63ae62dd71d5e21423ad37fdcb9aa6913';

// Список ID администраторов из Telegram
const ADMIN_TELEGRAM_IDS = [
    '853232715', // Замените на ваш реальный ID
    // Можете добавить еще админов
];

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

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
const db = new sqlite3.Database('shop.db');

// Создание таблиц
db.serialize(() => {
  // Таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE,
    username TEXT,
    is_admin BOOLEAN DEFAULT 0,
    referrer_id INTEGER,
    referral_earnings REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица товаров
  db.run(`CREATE TABLE IF NOT EXISTS products (
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
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    product_id INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (product_id) REFERENCES products (id) 
  )`);

  // Таблица отзывов
  db.run(`CREATE TABLE IF NOT EXISTS reviews (
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
  db.run(`INSERT OR IGNORE INTO users (telegram_id, username, is_admin) VALUES ('853232715', 'admin', 1)`);
});

// Роут для авторизации через Telegram
app.post('/api/auth/telegram', (req, res) => {
    const { id, first_name, last_name, username } = req.body;
    // Проверяем, является ли пользователь администратором
    const isAdmin = ADMIN_TELEGRAM_IDS.includes(id.toString());
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
  console.log('POST /api/auth', req.body);
  const { telegram_id, username, ref } = req.body;
  let referrer_id = null;
  if (ref) {
    referrer_id = parseInt(ref, 10);
  }
  db.get('SELECT * FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ error: 'Ошибка базы данных', details: err.message });
    }
    if (user) {
      // Пользователь существует
      const token = generateToken(user);
      res.json({ token, user: { id: user.id, telegram_id: user.telegram_id, username: user.username, is_admin: user.is_admin, referrer_id: user.referrer_id } });
    } else {
      // Создаем нового пользователя
      db.run('INSERT INTO users (telegram_id, username, referrer_id) VALUES (?, ?, ?)', [telegram_id, username, referrer_id], function(err) {
        if (err) {
          console.error('DB error (create user):', err);
          return res.status(500).json({ error: 'Ошибка создания пользователя', details: err.message });
        }
        const user = {
          id: this.lastID,
          telegram_id,
          username,
          is_admin: false
        };
        const token = generateToken(user);
        res.json({ 
          token, 
          user: { id: this.lastID, telegram_id, username, is_admin: false, referrer_id }
        });
      });
    }
  });
});

// Получение списка товаров
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC', (err, products) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка получения товаров' });
    }
    // Для каждого товара считаем рейтинг и количество отзывов
    const productIds = products.map(p => p.id);
    if (productIds.length === 0) return res.json(products);
    db.all(`SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as reviews_count FROM reviews WHERE product_id IN (${productIds.map(()=>'?').join(',')}) GROUP BY product_id`, productIds, (err, ratings) => {
      if (err) return res.json(products);
      const ratingMap = {};
      ratings.forEach(r => { ratingMap[r.product_id] = r; });
      const result = products.map(p => ({
        ...p,
        rating: ratingMap[p.id]?.avg_rating || 0,
        reviewsCount: ratingMap[p.id]?.reviews_count || 0
      }));
      res.json(result);
    });
  });
});

// Получение товара по ID
app.get('/api/products/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ? AND is_active = 1', [req.params.id], (err, product) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка получения товара' });
    }
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    db.get('SELECT AVG(rating) as avg_rating, COUNT(*) as reviews_count FROM reviews WHERE product_id = ?', [product.id], (err, rating) => {
      if (err) return res.json(product);
      res.json({
        ...product,
        rating: rating?.avg_rating || 0,
        reviewsCount: rating?.reviews_count || 0
      });
    });
  });
});

// Создание заказа
app.post('/api/orders', adminMiddleware, (req, res) => {
  const { product_id } = req.body;
  const user_id = req.user.id;

  db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err || !product) {
      return res.status(400).json({ error: 'Товар не найден' });
    }
    db.run('INSERT INTO orders (user_id, product_id) VALUES (?, ?)', [user_id, product_id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка создания заказа' });
      }
      // Начисляем 5% пригласившему
      db.get('SELECT referrer_id FROM users WHERE id = ?', [user_id], (err, user) => {
        if (!err && user && user.referrer_id) {
          const bonus = product.price * 0.05;
          db.run('UPDATE users SET referral_earnings = referral_earnings + ? WHERE id = ?', [bonus, user.referrer_id]);
        }
      });
      res.json({ id: this.lastID, message: 'Заказ создан успешно' });
    });
  });
});

// Получение заказов пользователя
app.get('/api/orders', adminMiddleware, (req, res) => {
  db.all(`
    SELECT o.*, p.name as product_name, p.price 
    FROM orders o 
    JOIN products p ON o.product_id = p.id 
    WHERE o.user_id = ? 
    ORDER BY o.created_at DESC
  `, [req.user.id], (err, orders) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка получения заказов' });
    }
    res.json(orders);
  });
});

// АДМИНСКИЕ МАРШРУТЫ

// Получение всех заказов
app.get('/api/admin/orders', adminMiddleware, async (req, res) => {
    try {
        console.log('Загружаем заказы для админа...');
        db.all(`SELECT o.*, p.name as product_name, p.price, u.username, u.telegram_id FROM orders o JOIN products p ON o.product_id = p.id JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC`, (err, orders) => {
            if (err) {
                console.error('Ошибка получения заказов:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            res.json({ success: true, orders });
        });
    } catch (error) {
        console.error('Ошибка получения заказов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение всех пользователей
app.get('/api/admin/users', adminMiddleware, async (req, res) => {
    try {
        console.log('Загружаем пользователей для админа...');
        db.all('SELECT * FROM users ORDER BY created_at DESC', (err, users) => {
            if (err) {
                console.error('Ошибка получения пользователей:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            res.json({ success: true, users });
        });
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание продукта
app.post('/api/admin/products', adminMiddleware, upload.single('image'), async (req, res) => {
    try {
        console.log('Создаем продукт:', req.body);
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
        db.run(
            `INSERT INTO products (name, description, price, category, stock, infinite_stock, image_url, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                req.body.name,
                req.body.description,
                price,
                req.body.category,
                stock,
                infiniteStock,
                imagePath
            ],
            function(err) {
                if (err) {
                    console.error('SQL Error (create product):', err);
                    return res.status(500).json({ error: 'Database error', details: err.message });
                }
                res.json({ success: true, message: 'Продукт создан успешно', id: this.lastID });
            }
        );
    } catch (error) {
        console.error('Ошибка создания продукта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление продукта
app.put('/api/admin/products/:id', adminMiddleware, upload.single('image'), async (req, res) => {
    try {
        const productId = req.params.id;
        console.log('Обновляем продукт:', productId, req.body);
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
        let query = 'UPDATE products SET name = ?, description = ?, price = ?, category = ?, is_active = ?, stock = ?, infinite_stock = ?';
        let params = [req.body.name, req.body.description, price, req.body.category, isActiveValue, stock, infiniteStock];
        if (imagePath) {
            query += ', image_url = ?';
            params.push(imagePath);
        }
        query += ' WHERE id = ?';
        params.push(productId);
        db.run(query, params, function(err) {
            if (err) {
                console.error('SQL Error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true, message: 'Продукт обновлен успешно' });
        });
    } catch (error) {
        console.error('Ошибка обновления продукта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление продукта
app.delete('/api/admin/products/:id', adminMiddleware, async (req, res) => {
    try {
        const productId = req.params.id;
        console.log('Удаляем продукт:', productId);
        db.run('DELETE FROM products WHERE id = ?', [productId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Ошибка удаления товара' });
            }
            res.json({ success: true, message: 'Продукт удален успешно' });
        });
    } catch (error) {
        console.error('Ошибка удаления продукта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление заказа
app.delete('/api/admin/orders/:id', adminMiddleware, async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log('Удаляем заказ:', orderId);
        db.run('DELETE FROM orders WHERE id = ?', [orderId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Ошибка удаления заказа' });
            }
            res.json({ success: true, message: 'Заказ удален успешно' });
        });
    } catch (error) {
        console.error('Ошибка удаления заказа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить отзывы по товару
app.get('/api/products/:id/reviews', (req, res) => {
  db.all(`SELECT r.*, u.username, u.telegram_id FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ? ORDER BY r.created_at DESC`, [req.params.id], (err, reviews) => {
    if (err) return res.status(500).json({ error: 'Ошибка получения отзывов' });
    res.json(reviews);
  });
});

// Добавить отзыв (только если есть заказ)
app.post('/api/reviews', adminMiddleware, (req, res) => {
  const { product_id, rating, text } = req.body;
  const user_id = req.user.id;
  db.get('SELECT * FROM orders WHERE user_id = ? AND product_id = ?', [user_id, product_id], (err, order) => {
    if (err) return res.status(500).json({ error: 'Ошибка проверки заказа' });
    if (!order) return res.status(403).json({ error: 'Можно оставить отзыв только после покупки' });
    db.run('INSERT INTO reviews (product_id, user_id, rating, text) VALUES (?, ?, ?, ?)', [product_id, user_id, rating, text], function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка добавления отзыва' });
      res.json({ id: this.lastID, message: 'Отзыв добавлен' });
    });
  });
});

// Скрыть профиль в отзыве (только владелец)
app.patch('/api/reviews/:id/hide', adminMiddleware, (req, res) => {
  const reviewId = req.params.id;
  const user_id = req.user.id;
  db.get('SELECT * FROM reviews WHERE id = ?', [reviewId], (err, review) => {
    if (err || !review) return res.status(404).json({ error: 'Отзыв не найден' });
    if (review.user_id !== user_id) return res.status(403).json({ error: 'Можно скрыть только свой отзыв' });
    db.run('UPDATE reviews SET is_hidden = 1 WHERE id = ?', [reviewId], function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка скрытия профиля' });
      res.json({ message: 'Профиль скрыт' });
    });
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Админ панель
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Публичный маршрут для добавления услуги из index.html (без проверки is_admin)
app.post('/api/admin/products', adminMiddleware, upload.single('image'), (req, res) => {
  const { name, description, price, category, stock, infinite_stock } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  // Обрабатываем поля остатка
  const stockValue = infinite_stock === 'on' ? 0 : (stock || 0);
  const infiniteStockValue = infinite_stock === 'on' ? 1 : 0;

  db.run(
    'INSERT INTO products (name, description, price, image_url, category, stock, infinite_stock, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
    [name, description, price, image_url, category, stockValue, infiniteStockValue],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка добавления товара' });
      }
      res.json({ id: this.lastID, message: 'Товар добавлен успешно' });
    }
  );
});

// Дублирующие админские роуты с новой защитой (пример)
app.get('/api/admin2/orders', adminMiddleware, (req, res) => {
    // Ваш код для получения заказов
    res.json({ orders: [] }); // Замените на реальные данные
});

app.get('/api/admin2/users', adminMiddleware, (req, res) => {
    // Ваш код для получения пользователей
    res.json({ users: [] }); // Замените на реальные данные
});

app.post('/api/admin2/products', adminMiddleware, (req, res) => {
    // Ваш код для создания продукта
    res.json({ success: true, message: 'Продукт создан' });
});

app.put('/api/admin2/products/:id', adminMiddleware, (req, res) => {
    // Ваш код для обновления продукта
    res.json({ success: true, message: 'Продукт обновлен' });
});

app.delete('/api/admin2/products/:id', adminMiddleware, (req, res) => {
    // Ваш код для удаления продукта
    res.json({ success: true, message: 'Продукт удален' });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Главная страница: http://localhost:${PORT}`);
  console.log(`Админ панель: http://localhost:${PORT}/admin`);
}); 