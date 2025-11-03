require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const PostgresAdapter = require('./db-postgres');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { adminMiddleware, authMiddleware, generateToken } = require('./middleware');
const PaymentService = require('./payment-service');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const BOT_TOKEN = process.env.BOT_TOKEN;

console.log('🔍 JWT_SECRET загружен:', JWT_SECRET ? 'да' : 'нет');
console.log('🔑 JWT_SECRET:', JWT_SECRET.substring(0, 20) + '...');

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

// Middleware для CORS
app.use(cors({
  origin: '*',
  credentials: true
}));

// Middleware для отключения кеширования API запросов
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

app.use(bodyParser.json());
app.use(express.static('public'));

// Тестовый файл для отладки платежей
app.get('/test-payment.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-payment.html'));
});

// Страница реального тестирования платежей
app.get('/real-test.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'real-test.html'));
});

// Отладочная страница для диагностики проблем
app.get('/debug-test.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'debug-test.html'));
});

// Страница заказов
app.get('/orders.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'orders.html'));
});

// Страница диагностики платежей
app.get('/debug-payments.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'debug-payments.html'));
});

// Админ-панель
app.get('/admin-panel.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel.html'));
});

// Простой тест для создания заказа без JWT (только для отладки)
app.post('/api/test-order', (req, res) => {
  try {
    const { product_id, user_id = 1 } = req.body;

    const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
    const product = getProduct.get(product_id);
    
    if (!product) {
      return res.status(400).json({ error: 'Товар не найден' });
    }
    
    const insertOrder = db.prepare('INSERT INTO orders (user_id, product_id) VALUES (?, ?)');
    const result = insertOrder.run(user_id, product_id);
    
    res.json({ 
      id: result.lastInsertRowid, 
      message: 'Тестовый заказ создан успешно',
      product: product.name
    });
  } catch (error) {
    console.error('Error creating test order:', error);
    res.status(500).json({ error: 'Ошибка создания заказа' });
  }
});

// Тестовый endpoint для Stars инвойсов без JWT
app.post('/api/test-stars-invoice', async (req, res) => {
  try {
    const { orderId, productId, amount, description } = req.body;
    const userId = 1; // Тестовый пользователь

    if (!orderId || !productId || !amount || !description) {
      return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
    }

    // Проверяем существование заказа
    const getOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
    const order = getOrder.get(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    const invoice = await paymentService.createStarsInvoice(orderId, userId, productId, amount, description);
    
    res.json({
      success: true,
      invoice: {
        id: invoice.id,
        payload: invoice.payload,
        telegramInvoice: invoice.telegramInvoice,
        expiresAt: invoice.expiresAt
      }
    });
  } catch (error) {
    console.error('Ошибка создания тестового Stars инвойса:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Тестовый endpoint для крипто инвойсов без JWT
app.post('/api/test-crypto-invoice', async (req, res) => {
  try {
    const { orderId, productId, amount, currency } = req.body;
    const userId = 1; // Тестовый пользователь

    if (!orderId || !productId || !amount || !currency) {
      return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
    }

    if (!['TON', 'USDT'].includes(currency)) {
      return res.status(400).json({ error: 'Неподдерживаемая валюта' });
    }

    // Проверяем существование заказа
    const getOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
    const order = getOrder.get(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    const invoice = await paymentService.createCryptoInvoice(orderId, userId, productId, amount, currency);
    
    res.json({
      success: true,
      invoice: {
        id: invoice.id,
        payload: invoice.payload,
        address: invoice.address,
        memo: invoice.memo,
        amount: invoice.amount,
        currency: invoice.currency,
        expiresAt: invoice.expiresAt
      }
    });
  } catch (error) {
    console.error('Ошибка создания тестового крипто инвойса:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

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

// Инициализация базы данных PostgreSQL
const db = new PostgresAdapter(process.env.DATABASE_URL);

// Функция для создания таблиц PostgreSQL
async function initDB() {
  try {
    console.log('🔄 Инициализация базы данных PostgreSQL...');
    
    // Таблица пользователей
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        is_admin BOOLEAN DEFAULT false,
        referrer_id INTEGER,
        referral_earnings DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Таблица товаров
    await db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image_url TEXT,
        category TEXT,
        stock INTEGER DEFAULT 0,
        infinite_stock BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Таблица заказов
    await db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending',
        price DECIMAL(10,2),
        payment_method TEXT,
        transaction_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Таблица отзывов
    await db.exec(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        text TEXT,
        is_hidden BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Таблица инвойсов (для платежей)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_url TEXT,
        invoice_id TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Добавляем админа по умолчанию
    const insertAdmin = db.prepare(`
      INSERT INTO users (telegram_id, username, is_admin) 
      VALUES ($1, $2, $3)
      ON CONFLICT (telegram_id) DO NOTHING
    `);
    await insertAdmin.run('853232715', 'admin', true);
    
    console.log('✅ База данных PostgreSQL инициализирована успешно');
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
    throw error;
  }
}

// Инициализация сервиса платежей
let paymentService;

// Запускаем инициализацию (будет выполнено при старте сервера)
initDB()
  .then(async () => {
    // После инициализации основных таблиц, инициализируем платежи
    try {
      paymentService = new PaymentService(db, BOT_TOKEN);
      await paymentService.initPaymentTables();
      console.log('✅ Сервис платежей инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации сервиса платежей:', error);
      throw error;
    }
  })
  .catch(err => {
    console.error('❌ Критическая ошибка при инициализации:', err);
    process.exit(1);
  });

// Роут для авторизации через Telegram
app.post('/api/auth/telegram', async (req, res) => {
    console.log('\n👤 [SERVER AUTH] Запрос авторизации через Telegram');
    try {
        const { id, first_name, last_name, username } = req.body;
        console.log('👤 [SERVER AUTH] Данные пользователя:', { id, first_name, last_name, username });
        
        if (!id) {
            console.error('❌ [SERVER AUTH] ID пользователя не предоставлен');
            return res.status(400).json({ error: 'ID пользователя не предоставлен' });
        }
        
        // Проверяем, является ли пользователь админом
        const adminIds = process.env.ADMIN_TELEGRAM_IDS ? 
            process.env.ADMIN_TELEGRAM_IDS.split(',').map(id => id.trim()) : 
            ADMIN_TELEGRAM_IDS;
        const isAdmin = adminIds.includes(id.toString());
        
        console.log('🔐 [AUTH] Проверка админ прав:', { 
            userId: id.toString(), 
            adminIds, 
            isAdmin 
        });
        
        // Проверяем, есть ли пользователь в базе (async)
        let getUser = db.prepare('SELECT * FROM users WHERE telegram_id = $1');
        let user = await getUser.get(id.toString());
        
        // Если пользователя нет, создаем его
        if (!user) {
            const insertUser = db.prepare(`
                INSERT INTO users (telegram_id, username, is_admin, first_name, last_name) 
                VALUES ($1, $2, $3, $4, $5)
            `);
            const result = await insertUser.run(
                id.toString(), 
                username || '', 
                isAdmin,
                first_name || '',
                last_name || ''
            );
            
            user = {
                id: result.lastInsertRowid,
                telegram_id: id.toString(),
                username: username || '',
                first_name: first_name || '',
                last_name: last_name || '',
                is_admin: isAdmin
            };
            
            console.log('✅ [AUTH] Создан новый пользователь:', user);
        } else {
            // Обновляем is_admin если изменился
            if (user.is_admin !== isAdmin) {
                const updateUser = db.prepare('UPDATE users SET is_admin = $1 WHERE id = $2');
                await updateUser.run(isAdmin, user.id);
                user.is_admin = isAdmin;
                console.log('✅ [AUTH] Обновлены права админа:', isAdmin);
            }
        }
        
        // Создаем JWT токен
        const token = generateToken(user);
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                telegramId: user.telegram_id,
                telegram_id: user.telegram_id,
                firstName: first_name,
                lastName: last_name,
                username: user.username,
                role: user.is_admin ? 'admin' : 'user',
                isAdmin: user.is_admin,
                is_admin: user.is_admin  // Добавляем snake_case для совместимости
            }
        });
    } catch (error) {
        console.error('Error in Telegram auth:', error);
        res.status(500).json({ error: 'Ошибка авторизации' });
    }
});

// API маршруты

// Регистрация/авторизация пользователя
app.post('/api/auth', (req, res) => {
  try {
    const { telegram_id, username, first_name, last_name, ref } = req.body;
    let referrer_id = null;
    if (ref) {
      referrer_id = parseInt(ref, 10);
    }
    
    // Ищем существующего пользователя
    const getUser = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    const user = getUser.get(telegram_id);
    
    if (user) {
      // Пользователь существует - обновляем данные если нужно
      if (first_name || last_name) {
        const updateUser = db.prepare('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?');
        updateUser.run(first_name || user.first_name, last_name || user.last_name, user.id);
        user.first_name = first_name || user.first_name;
        user.last_name = last_name || user.last_name;
      }
      
      const token = generateToken(user);
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          telegram_id: user.telegram_id, 
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          is_admin: user.is_admin,
          isAdmin: user.is_admin,  // Добавляем camelCase для совместимости
          referrer_id: user.referrer_id 
        } 
      });
    } else {
      // Создаем нового пользователя
      const insertUser = db.prepare('INSERT INTO users (telegram_id, username, first_name, last_name, referrer_id) VALUES (?, ?, ?, ?, ?)');
      const result = insertUser.run(telegram_id, username, first_name, last_name, referrer_id);
      
      const newUser = {
        id: result.lastInsertRowid,
        telegram_id,
        username,
        first_name,
        last_name,
        is_admin: false
      };
      
      const token = generateToken(newUser);
      res.json({ 
        token, 
        user: { 
          id: result.lastInsertRowid, 
          telegram_id, 
          username,
          first_name,
          last_name,
          is_admin: false,
          isAdmin: false,  // Добавляем camelCase для совместимости
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
app.get('/api/products', async (req, res) => {
  console.log('\n📦 [SERVER LOAD] Запрос на получение списка товаров');
  console.log('📦 [SERVER LOAD] Query params:', req.query);
  
  // Отключаем кеширование для актуальных данных
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  try {
    // Получаем все активные товары (PostgreSQL async)
    const getProducts = db.prepare('SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC');
    const products = await getProducts.all();
    console.log('📦 [SERVER LOAD] Найдено товаров:', products.length);
    
    if (products.length === 0) {
      return res.json(products);
    }
    
    // Для каждого товара считаем рейтинг и количество отзывов
    const productIds = products.map(p => p.id);
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    const getRatings = db.prepare(`SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as reviews_count FROM reviews WHERE product_id IN (${placeholders}) GROUP BY product_id`);
    const ratings = await getRatings.all(...productIds);
    
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
    
    console.log('✅ [SERVER LOAD] Отправка списка товаров:', result.length, 'шт.');
    console.log('📦 [SERVER LOAD] Первые 3 ID:', result.slice(0, 3).map(p => p.id));
    res.json(result);
  } catch (error) {
    console.error('❌ [SERVER LOAD] Ошибка получения товаров:', error);
    res.status(500).json({ error: 'Ошибка получения товаров', details: error.message });
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
app.post('/api/orders', authMiddleware, (req, res) => {
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
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const getOrders = db.prepare(`
      SELECT 
        o.*,
        p.name as product_name, 
        p.price as product_price,
        i.status as payment_status,
        i.currency as payment_currency,
        i.amount as payment_amount
      FROM orders o 
      LEFT JOIN products p ON o.product_id = p.id 
      LEFT JOIN invoices i ON o.id = i.order_id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
    `);
    const orders = await getOrders.all(userId);
    
    res.json(orders);
  } catch (error) {
    console.error('Ошибка получения заказов:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Отмена заказа
app.post('/api/orders/:id/cancel', authMiddleware, (req, res) => {
  console.log('\n❌ [ORDER CANCEL] Запрос на отмену заказа');
  try {
    const orderId = parseInt(req.params.id);
    const userId = req.user.id;
    
    console.log('❌ [ORDER CANCEL] Order ID:', orderId, 'User ID:', userId);
    
    // Проверяем, что заказ принадлежит пользователю
    const getOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
    const order = getOrder.get(orderId, userId);
    
    if (!order) {
      console.error('❌ [ORDER CANCEL] Заказ не найден');
      return res.status(404).json({ error: 'Заказ не найден' });
    }
    
    // Проверяем, можно ли отменить
    if (!['pending', 'pending_crypto'].includes(order.status)) {
      console.error('❌ [ORDER CANCEL] Нельзя отменить заказ со статусом:', order.status);
      return res.status(400).json({ error: 'Невозможно отменить этот заказ' });
    }
    
    // Отменяем заказ
    const updateOrder = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
    updateOrder.run('cancelled', orderId);
    
    console.log('✅ [ORDER CANCEL] Заказ отменён');
    
    res.json({ 
      success: true, 
      message: 'Заказ успешно отменён' 
    });
  } catch (error) {
    console.error('❌ [ORDER CANCEL] Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Автоматическое истечение заказа
app.post('/api/orders/:id/expire', authMiddleware, (req, res) => {
  console.log('\n⏰ [ORDER EXPIRE] Запрос на истечение заказа');
  try {
    const orderId = parseInt(req.params.id);
    const userId = req.user.id;
    
    // Проверяем, что заказ принадлежит пользователю
    const getOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
    const order = getOrder.get(orderId, userId);
    
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }
    
    // Проверяем, что прошёл 1 час
    const createdAt = new Date(order.created_at);
    const now = new Date();
    const hourInMs = 60 * 60 * 1000;
    
    if (now - createdAt >= hourInMs && ['pending', 'pending_crypto'].includes(order.status)) {
      const updateOrder = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
      updateOrder.run('expired', orderId);
      
      console.log('✅ [ORDER EXPIRE] Заказ истёк');
      
      res.json({ 
        success: true, 
        message: 'Заказ истёк' 
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Заказ ещё активен' 
      });
    }
  } catch (error) {
    console.error('❌ [ORDER EXPIRE] Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание отзыва
app.post('/api/reviews', authMiddleware, (req, res) => {
  console.log('\n⭐ [REVIEW] Создание отзыва');
  try {
    const { product_id, order_id, rating, text } = req.body;
    const userId = req.user.id;
    
    console.log('⭐ [REVIEW] Product ID:', product_id, 'Order ID:', order_id, 'Rating:', rating);
    
    // Проверяем, что заказ принадлежит пользователю и завершён
    const getOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ? AND product_id = ?');
    const order = getOrder.get(order_id, userId, product_id);
    
    if (!order) {
      console.error('❌ [REVIEW] Заказ не найден');
      return res.status(404).json({ error: 'Заказ не найден' });
    }
    
    if (order.status !== 'completed') {
      console.error('❌ [REVIEW] Заказ не завершён');
      return res.status(400).json({ error: 'Можно оставить отзыв только на завершённый заказ' });
    }
    
    // Проверяем, нет ли уже отзыва
    const checkReview = db.prepare('SELECT * FROM reviews WHERE order_id = ? AND user_id = ?');
    const existingReview = checkReview.get(order_id, userId);
    
    if (existingReview) {
      console.error('❌ [REVIEW] Отзыв уже существует');
      return res.status(400).json({ error: 'Вы уже оставили отзыв на этот заказ' });
    }
    
    // Создаём отзыв
    const insertReview = db.prepare(`
      INSERT INTO reviews (product_id, order_id, user_id, rating, text)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = insertReview.run(product_id, order_id, userId, rating, text || '');
    
    console.log('✅ [REVIEW] Отзыв создан, ID:', result.lastInsertRowid);
    
    res.json({ 
      success: true, 
      message: 'Спасибо за отзыв!',
      review_id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('❌ [REVIEW] Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление заказа из истории
app.delete('/api/orders/:id', authMiddleware, (req, res) => {
  console.log('\n🗑️ [ORDER DELETE] Запрос на удаление заказа');
  try {
    const orderId = parseInt(req.params.id);
    const userId = req.user.id;
    
    console.log('🗑️ [ORDER DELETE] Order ID:', orderId, 'User ID:', userId);
    
    // Проверяем, что заказ принадлежит пользователю
    const getOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
    const order = getOrder.get(orderId, userId);
    
    if (!order) {
      console.error('❌ [ORDER DELETE] Заказ не найден');
      return res.status(404).json({ error: 'Заказ не найден' });
    }
    
    console.log('🗑️ [ORDER DELETE] Найден заказ:', order);
    
    // Удаляем заказ и связанные данные в транзакции
    const deleteTransaction = db.transaction(() => {
      // Удаляем отзывы
      const deleteReviews = db.prepare('DELETE FROM reviews WHERE order_id = ?');
      const reviewsResult = deleteReviews.run(orderId);
      console.log('🗑️ [ORDER DELETE] Удалено отзывов:', reviewsResult.changes);
      
      // Удаляем инвойсы
      const deleteInvoices = db.prepare('DELETE FROM invoices WHERE order_id = ?');
      const invoicesResult = deleteInvoices.run(orderId);
      console.log('🗑️ [ORDER DELETE] Удалено инвойсов:', invoicesResult.changes);
      
      // Удаляем сам заказ
      const deleteOrder = db.prepare('DELETE FROM orders WHERE id = ?');
      const orderResult = deleteOrder.run(orderId);
      console.log('🗑️ [ORDER DELETE] Удалено заказов:', orderResult.changes);
      
      return orderResult.changes > 0;
    });
    
    const success = deleteTransaction();
    
    if (success) {
      console.log('✅ [ORDER DELETE] Заказ успешно удалён');
      res.json({ 
        success: true, 
        message: 'Заказ успешно удалён' 
      });
    } else {
      console.error('❌ [ORDER DELETE] Не удалось удалить заказ');
      res.status(500).json({ error: 'Не удалось удалить заказ' });
    }
  } catch (error) {
    console.error('❌ [ORDER DELETE] Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
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
    const getUsers = db.prepare(`
      SELECT 
        u.*,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END) as paid_orders,
        SUM(CASE WHEN o.status = 'paid' THEN o.total_amount ELSE 0 END) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    const users = getUsers.all();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление пользователя (только для админов)
app.delete('/api/admin/users/:id', adminMiddleware, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Проверяем, существует ли пользователь
    const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = getUser.get(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Проверяем, не удаляет ли админ сам себя
    if (user.telegram_id === req.user.telegram_id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }
    
    // Проверяем, есть ли активные заказы у пользователя
    const getActiveOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders 
      WHERE user_id = ? AND status IN ('pending', 'pending_crypto', 'paid')
    `);
    const activeOrders = getActiveOrders.get(userId);
    
    if (activeOrders.count > 0) {
      return res.status(400).json({ 
        error: 'Нельзя удалить пользователя с активными заказами',
        active_orders: activeOrders.count
      });
    }
    
    // Удаляем связанные данные в правильном порядке
    const deleteReviews = db.prepare('DELETE FROM reviews WHERE user_id = ?');
    const deleteOrders = db.prepare('DELETE FROM orders WHERE user_id = ?');
    const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
    
    // Выполняем удаление в транзакции
    const deleteTransaction = db.transaction(() => {
      deleteReviews.run(userId);
      deleteOrders.run(userId);
      deleteUser.run(userId);
    });
    
    deleteTransaction();
    
    res.json({ 
      success: true, 
      message: 'Пользователь успешно удален',
      deleted_user: user
    });
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
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

// Удаление продукта - перенесено в более полную версию ниже

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
app.post('/api/reviews', authMiddleware, (req, res) => {
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

// Скачивание товара после оплаты
app.get('/api/orders/:id/download', authMiddleware, (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    
    // Проверяем, что заказ принадлежит пользователю и оплачен
    const getOrder = db.prepare(`
      SELECT o.*, p.name as product_name, p.description
      FROM orders o 
      LEFT JOIN products p ON o.product_id = p.id 
      WHERE o.id = ? AND o.user_id = ? AND o.status = 'paid'
    `);
    const order = getOrder.get(orderId, userId);
    
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден или не оплачен' });
    }
    
    // Создаем контент товара
    const productContent = generateProductContent(order);
    
    // Отправляем файл
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="order-${orderId}-${order.product_name}.txt"`);
    res.send(productContent);
    
  } catch (error) {
    console.error('Ошибка скачивания товара:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

function generateProductContent(order) {
  const content = `
🎉 ТОВАР ДОСТАВЛЕН УСПЕШНО!
═══════════════════════════════════════

📦 Заказ #${order.id}
📅 Дата: ${new Date(order.created_at).toLocaleString('ru-RU')}
🛍️ Товар: ${order.product_name}
📝 Описание: ${order.description || 'Консультация по разработке'}

═══════════════════════════════════════

${order.product_name === 'Тест TON - Консультация 15 мин' ? `
🚀 КОНСУЛЬТАЦИЯ ПО РАЗРАБОТКЕ (15 минут)

Поздравляем! Вы успешно приобрели консультацию по разработке.

📋 ЧТО ВХОДИТ В КОНСУЛЬТАЦИЮ:
• Анализ вашего проекта или идеи
• Рекомендации по технологическому стеку
• Советы по архитектуре приложения
• Помощь с выбором инструментов разработки
• Ответы на технические вопросы

📞 КАК ПОЛУЧИТЬ КОНСУЛЬТАЦИЮ:
1. Напишите в Telegram: @your_username
2. Укажите номер заказа: #${order.id}
3. Опишите ваш проект или вопросы
4. Мы свяжемся с вами в течение 24 часов

⏰ ВРЕМЯ КОНСУЛЬТАЦИИ: 15 минут
📱 ФОРМАТ: Telegram звонок или переписка (на ваш выбор)

` : `
⭐ МИНИ-КОНСУЛЬТАЦИЯ ЧЕРЕЗ TELEGRAM

Поздравляем! Вы успешно приобрели мини-консультацию.

📋 ЧТО ВХОДИТ:
• Быстрый анализ вашего вопроса
• Конкретные рекомендации
• Полезные ссылки и ресурсы

📞 КАК ПОЛУЧИТЬ:
1. Напишите в Telegram: @your_username  
2. Укажите номер заказа: #${order.id}
3. Задайте ваш вопрос

⏰ ВРЕМЯ ОТВЕТА: В течение 12 часов

`}

💡 ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ:
• Этот файл является подтверждением покупки
• Сохраните его для своих записей
• При возникновении вопросов обращайтесь в поддержку

🔐 БЕЗОПАСНОСТЬ:
• Платеж подтвержден в блокчейне TON
• Транзакция записана в нашей системе
• Ваши данные защищены

═══════════════════════════════════════
🎯 Спасибо за использование нашего сервиса!
🚀 Система автоматических платежей работает!

Дата генерации файла: ${new Date().toLocaleString('ru-RU')}
`;
  
  return content;
}

// Отправка уведомления о заказе
app.post('/api/notify-order', authMiddleware, async (req, res) => {
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

// ===== PAYMENT API ENDPOINTS =====

// Создание инвойса для Stars
app.post('/api/payments/stars/create-invoice', authMiddleware, async (req, res) => {
  try {
    const { orderId, productId, amount, description } = req.body;
    const userId = req.user.id;

    if (!orderId || !productId || !amount || !description) {
      return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
    }

    // Проверяем существование заказа
    const getOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
    const order = getOrder.get(orderId, userId);
    
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    const invoice = await paymentService.createStarsInvoice(orderId, userId, productId, amount, description);
    
    res.json({
      success: true,
      invoice: {
        id: invoice.invoiceId,
        payload: invoice.payload,
        telegramInvoice: invoice.telegramInvoice,
        expiresAt: invoice.expiresAt
      }
    });
  } catch (error) {
    console.error('Ошибка создания Stars инвойса:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание инвойса для криптовалют
app.post('/api/payments/crypto/create-invoice', authMiddleware, async (req, res) => {
  try {
    const { orderId, productId, amount, currency } = req.body;
    const userId = req.user.id;

    if (!orderId || !productId || !amount || !currency) {
      return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
    }

    if (!['TON', 'USDT'].includes(currency)) {
      return res.status(400).json({ error: 'Неподдерживаемая валюта' });
    }

    // Проверяем существование заказа
    const getOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
    const order = getOrder.get(orderId, userId);
    
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    const invoice = await paymentService.createCryptoInvoice(orderId, userId, productId, amount, currency);
    
    res.json({
      success: true,
      invoice: {
        id: invoice.invoiceId,
        payload: invoice.payload,
        address: invoice.address,
        memo: invoice.memo,
        amount: invoice.amount,
        currency: invoice.currency,
        expiresAt: invoice.expiresAt
      }
    });
  } catch (error) {
    console.error('Ошибка создания крипто инвойса:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение статуса платежа
app.get('/api/payments/status/:payload', authMiddleware, (req, res) => {
  try {
    const { payload } = req.params;
    const userId = req.user.id;

    const invoice = paymentService.getInvoiceStatus(payload);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Инвойс не найден' });
    }

    // Проверяем права доступа
    if (invoice.user_id !== userId && !req.user.is_admin) {
      return res.status(403).json({ error: 'Нет доступа к этому инвойсу' });
    }

    res.json({
      success: true,
      invoice: {
        id: invoice.id,
        status: invoice.status,
        amount: invoice.amount,
        currency: invoice.currency,
        paymentMethod: invoice.currency === 'XTR' ? 'stars' : 'crypto',
        txHash: invoice.crypto_tx_hash,
        confirmations: invoice.crypto_confirmations,
        createdAt: invoice.created_at,
        paidAt: invoice.paid_at,
        expiresAt: invoice.expires_at,
        orderStatus: invoice.order_status
      }
    });
  } catch (error) {
    console.error('Ошибка получения статуса платежа:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Webhook для Telegram Stars (pre_checkout_query)
app.post('/api/payments/stars/pre-checkout', async (req, res) => {
  try {
    const { pre_checkout_query } = req.body;
    
    if (!pre_checkout_query) {
      return res.status(400).json({ error: 'Отсутствует pre_checkout_query' });
    }

    const validation = await paymentService.validatePreCheckout(pre_checkout_query);
    
    // Отвечаем Telegram
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pre_checkout_query_id: pre_checkout_query.id,
        ok: validation.ok,
        error_message: validation.error_message
      })
    });

    if (!response.ok) {
      console.error('Ошибка ответа на pre_checkout_query:', await response.text());
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка обработки pre_checkout_query:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Webhook для Telegram Stars (successful_payment)
app.post('/api/payments/stars/webhook', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.successful_payment) {
      return res.status(400).json({ error: 'Отсутствует successful_payment' });
    }

    await paymentService.processStarsPayment(message.successful_payment);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка обработки Stars webhook:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Ручная проверка криптоплатежей (для отладки)
app.post('/api/payments/crypto/check', authMiddleware, async (req, res) => {
  try {
    console.log('🔍 Запуск ручной проверки криптоплатежей...');
    await paymentService.checkCryptoPayments();
    
    res.json({ success: true, message: 'Проверка криптоплатежей выполнена - смотрите логи сервера' });
  } catch (error) {
    console.error('Ошибка проверки криптоплатежей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение ожидающих инвойсов (для отладки)
app.get('/api/payments/crypto/pending', authMiddleware, (req, res) => {
  try {
    const getPendingInvoices = db.prepare(`
      SELECT * FROM invoices 
      WHERE status = 'pending' 
      AND currency IN ('TON', 'USDT')
      AND expires_at > datetime('now')
      ORDER BY created_at DESC
    `);
    const pendingInvoices = getPendingInvoices.all();
    
    res.json({ 
      success: true, 
      count: pendingInvoices.length,
      invoices: pendingInvoices 
    });
  } catch (error) {
    console.error('Ошибка получения ожидающих инвойсов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Проверка роли пользователя
app.get('/api/user/role', authMiddleware, (req, res) => {
  try {
    // Проверяем админские права по Telegram ID
    const adminIds = process.env.ADMIN_TELEGRAM_IDS ? process.env.ADMIN_TELEGRAM_IDS.split(',') : [];
    const userTelegramId = req.user.telegram_id?.toString();
    
    let isAdmin = false;
    
    // Проверка по Telegram ID (приоритет)
    if (adminIds.length > 0 && userTelegramId && adminIds.includes(userTelegramId)) {
      isAdmin = true;
    }
    // Fallback: проверка по старому формату
    else if (req.user.is_admin !== undefined) {
      isAdmin = req.user.is_admin === 1 || req.user.is_admin === true;
    } else if (req.user.role) {
      isAdmin = req.user.role === 'admin';
    }
    
    res.json({ 
      role: isAdmin ? 'admin' : 'user',
      telegram_id: userTelegramId,
      is_admin: isAdmin
    });
  } catch (error) {
    console.error('Ошибка проверки роли:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ===== ADMIN API ENDPOINTS =====

// Создание товара (только для админов)
app.post('/api/admin/products', adminMiddleware, (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Название и цена обязательны' });
    }
    
    const insertProduct = db.prepare(`
      INSERT INTO products (name, description, price, category, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    const result = insertProduct.run(name, description || '', parseFloat(price), category || 'general');
    
    res.json({ 
      success: true, 
      product: {
        id: result.lastInsertRowid,
        name,
        description,
        price: parseFloat(price),
        category
      }
    });
  } catch (error) {
    console.error('Ошибка создания товара:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление товара (только для админов)
app.delete('/api/admin/products/:id', adminMiddleware, (req, res) => {
  console.log('\n🗑️ [SERVER DELETE] ========== НАЧАЛО УДАЛЕНИЯ ТОВАРА ==========');
  try {
    const productId = parseInt(req.params.id);
    console.log('🗑️ [SERVER DELETE] Product ID:', productId);
    console.log('🗑️ [SERVER DELETE] User:', req.user);
    
    // Проверяем, существует ли товар
    const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
    const product = getProduct.get(productId);
    console.log('🗑️ [SERVER DELETE] Найден товар:', product);
    
    if (!product) {
      console.error('❌ [SERVER DELETE] Товар не найден в БД');
      return res.status(404).json({ error: 'Товар не найден' });
    }
    
    // Проверяем, есть ли активные заказы у товара
    const getActiveOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders 
      WHERE product_id = ? AND status IN ('pending', 'pending_crypto', 'paid')
    `);
    const activeOrders = getActiveOrders.get(productId);
    console.log('🗑️ [SERVER DELETE] Активных заказов:', activeOrders.count);
    
    // Удаляем связанные данные в правильном порядке (включая активные заказы)
    const deleteOrders = db.prepare('DELETE FROM orders WHERE product_id = ?');
    const deleteProduct = db.prepare('DELETE FROM products WHERE id = ?');
    
    console.log('🗑️ [SERVER DELETE] Начало транзакции удаления...');
    
    // Выполняем удаление в транзакции
    const deleteTransaction = db.transaction(() => {
      // Удаляем отзывы если таблица существует
      try {
        const deleteReviews = db.prepare('DELETE FROM reviews WHERE product_id = ?');
        const reviewsResult = deleteReviews.run(productId);
        console.log('🗑️ [SERVER DELETE] Удалено отзывов:', reviewsResult.changes);
      } catch (e) {
        console.log('⚠️ [SERVER DELETE] Таблица reviews не существует, пропускаем');
      }
      
      const ordersResult = deleteOrders.run(productId);
      console.log('🗑️ [SERVER DELETE] Удалено заказов:', ordersResult.changes);
      
      const productResult = deleteProduct.run(productId);
      console.log('🗑️ [SERVER DELETE] Удалено товаров:', productResult.changes);
    });
    
    deleteTransaction();
    console.log('✅ [SERVER DELETE] Транзакция успешно завершена');
    
    // Проверяем, что товар действительно удален
    const verifyDelete = db.prepare('SELECT * FROM products WHERE id = ?');
    const stillExists = verifyDelete.get(productId);
    
    if (stillExists) {
      console.error('❌ [SERVER DELETE] ОШИБКА: Товар все еще существует в БД!');
      return res.status(500).json({ error: 'Ошибка удаления товара' });
    }
    
    console.log('✅ [SERVER DELETE] Товар успешно удален из БД');
    console.log('🗑️ [SERVER DELETE] ========== КОНЕЦ УДАЛЕНИЯ ТОВАРА ==========\n');
    
    res.json({ 
      success: true, 
      message: 'Товар успешно удален',
      deleted_product: product
    });
  } catch (error) {
    console.error('❌ [SERVER DELETE] КРИТИЧЕСКАЯ ОШИБКА:', error);
    console.error('❌ [SERVER DELETE] Stack trace:', error.stack);
    console.log('🗑️ [SERVER DELETE] ========== КОНЕЦ УДАЛЕНИЯ ТОВАРА (ОШИБКА) ==========\n');
    res.status(500).json({ error: 'Внутренняя ошибка сервера', details: error.message });
  }
});

// Получение всех товаров для админа
app.get('/api/admin/products', adminMiddleware, (req, res) => {
  try {
    const getProducts = db.prepare(`
      SELECT 
        p.*,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END) as paid_orders,
        SUM(CASE WHEN o.status = 'paid' THEN o.total_amount ELSE 0 END) as total_revenue
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    
    const products = getProducts.all();
    
    res.json({ success: true, products });
  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение истории платежей пользователя
app.get('/api/payments/history', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    
    const getPayments = db.prepare(`
      SELECT 
        i.*,
        o.status as order_status,
        p.name as product_name,
        p.price as product_price
      FROM invoices i
      JOIN orders o ON i.order_id = o.id
      JOIN products p ON i.product_id = p.id
      WHERE i.user_id = ?
      ORDER BY i.created_at DESC
      LIMIT 50
    `);
    
    const payments = getPayments.all(userId);
    
    res.json({
      success: true,
      payments: payments.map(payment => ({
        id: payment.id,
        orderId: payment.order_id,
        productName: payment.product_name,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.currency === 'XTR' ? 'stars' : 'crypto',
        txHash: payment.crypto_tx_hash,
        createdAt: payment.created_at,
        paidAt: payment.paid_at
      }))
    });
  } catch (error) {
    console.error('Ошибка получения истории платежей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ===== END PAYMENT API ENDPOINTS =====

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

// Настройка автоматических задач для платежей
if (paymentService) {
  // Проверка криптоплатежей каждые 30 секунд
  cron.schedule('*/30 * * * * *', () => {
    console.log('🔄 Запуск автоматической проверки платежей...');
    paymentService.checkCryptoPayments();
  });

  // Очистка просроченных инвойсов каждые 10 минут
  cron.schedule('*/10 * * * *', () => {
    try {
      paymentService.cancelExpiredInvoices();
    } catch (error) {
      console.error('Ошибка очистки просроченных инвойсов:', error);
    }
  });

  console.log('✅ Автоматические задачи платежей настроены');
}

// Запуск сервера
const startServer = async () => {
  try {
    // Если PORT задан в переменных окружения (продакшен), используем его напрямую
    // Иначе ищем свободный порт для локальной разработки
    const targetPort = process.env.PORT ? PORT : await findFreePort(PORT);
    
    app.listen(targetPort, '0.0.0.0', () => {
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
      
      // Запускаем cron задачу для автоматической отмены истёкших заказов
      console.log('⏰ Запуск cron задачи для автоотмены заказов (каждые 5 минут)');
      cron.schedule('*/5 * * * *', () => {
        try {
          console.log('\n⏰ [CRON] Проверка истёкших заказов...');
          
          const now = new Date();
          const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          
          // Находим все заказы старше 1 часа со статусом pending
          const getExpiredOrders = db.prepare(`
            SELECT * FROM orders 
            WHERE status IN ('pending', 'pending_crypto') 
            AND created_at < ?
          `);
          
          const expiredOrders = getExpiredOrders.all(hourAgo.toISOString());
          
          if (expiredOrders.length > 0) {
            console.log(`⏰ [CRON] Найдено истёкших заказов: ${expiredOrders.length}`);
            
            const updateOrder = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
            
            expiredOrders.forEach(order => {
              updateOrder.run('expired', order.id);
              console.log(`⏰ [CRON] Заказ #${order.id} отменён (истёк)`);
            });
            
            console.log(`✅ [CRON] Обработано заказов: ${expiredOrders.length}`);
          } else {
            console.log('⏰ [CRON] Истёкших заказов не найдено');
          }
        } catch (error) {
          console.error('❌ [CRON] Ошибка при проверке заказов:', error);
        }
      });
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
};

startServer();
