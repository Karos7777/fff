require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db'); // ← Новый универсальный адаптер
const PostgresAdapter = require('./db-postgres'); // ← Оставляем для совместимости со старым кодом
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { adminMiddleware, authMiddleware, generateToken } = require('./middleware');
const PaymentService = require('./payment-service');
const cron = require('node-cron');
const ordersRoutes = require('./routes/orders');
const tonRoutes = require('./routes/ton');
const tonPolling = require('./services/tonPolling');

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

    const getProduct = dbLegacy.prepare('SELECT * FROM products WHERE id = ?');
    const product = getProduct.get(product_id);
    
    if (!product) {
      return res.status(400).json({ error: 'Товар не найден' });
    }
    
    const insertOrder = dbLegacy.prepare('INSERT INTO orders (user_id, product_id) VALUES (?, ?)');
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
    const getOrder = dbLegacy.prepare('SELECT * FROM orders WHERE id = ?');
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
    const getOrder = dbLegacy.prepare('SELECT * FROM orders WHERE id = ?');
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
// db уже импортирован из ./db/index.js выше
const dbLegacy = new PostgresAdapter(process.env.DATABASE_URL); // ← Старый адаптер для совместимости

// Создаём экземпляр authMiddleware с доступом к db
const authMiddlewareWithDB = authMiddleware(dbLegacy); // ← Используем старый для middleware

// Функция для создания таблиц PostgreSQL
async function initDB() {
  try {
    console.log('🔄 Инициализация базы данных PostgreSQL...');
    
    // Таблица пользователей
    await dbLegacy.exec(`
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
    await dbLegacy.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        price_ton DECIMAL(10,4),
        price_usdt DECIMAL(10,4),
        price_stars INTEGER,
        image_url TEXT,
        category TEXT,
        stock INTEGER DEFAULT 0,
        infinite_stock BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        file_path TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Добавляем колонку file_path если её нет
    try {
      await dbLegacy.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS file_path TEXT`);
    } catch (e) {
      // Колонка уже существует
    }

    // Таблица отзывов
    await dbLegacy.exec(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Миграция: добавляем новые колонки цен если их нет
    try {
      await dbLegacy.exec(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS price_ton DECIMAL(10,4),
        ADD COLUMN IF NOT EXISTS price_usdt DECIMAL(10,4),
        ADD COLUMN IF NOT EXISTS price_stars INTEGER
      `);
      console.log('✅ Миграция: колонки price_ton, price_usdt, price_stars проверены/добавлены');
    } catch (e) {
      console.log('⚠️ Миграция цен: колонки уже существуют или ошибка:', e.message);
    }
    
    // Таблица заказов
    await dbLegacy.exec(`
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

    // Таблица инвойсов (для платежей)
    await dbLegacy.exec(`
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
    await db.run(`
      INSERT INTO users (telegram_id, username, is_admin) 
      VALUES ($1, $2, $3)
      ON CONFLICT (telegram_id) DO NOTHING
    `, ['853232715', 'admin', true]);
    
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
      
      // === ПОДКЛЮЧЕНИЕ МОДУЛЬНЫХ РОУТОВ ===
      // Сохраняем paymentService для доступа из роутов
      app.set('paymentService', paymentService);
      
      // Подключаем модульные роуты (db импортируется внутри модулей)
      app.use('/api/orders', ordersRoutes(authMiddlewareWithDB));
      app.use('/api/ton', tonRoutes(authMiddlewareWithDB));
      console.log('✅ Модульные роуты подключены');
      
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
        let getUser = dbLegacy.prepare('SELECT * FROM users WHERE telegram_id = $1');
        let user = await getUser.get(id.toString());
        
        // Если пользователя нет, создаем его
        if (!user) {
            const insertUser = dbLegacy.prepare(`
                INSERT INTO users (telegram_id, username, is_admin, first_name, last_name) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id
            `);
            const result = await insertUser.get(
                id.toString(), 
                username || '', 
                isAdmin,
                first_name || '',
                last_name || ''
            );
            
            user = {
                id: result.id,  // ← PostgreSQL возвращает id через RETURNING
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
                const updateUser = dbLegacy.prepare('UPDATE users SET is_admin = $1 WHERE id = $2');
                await updateUser.run(isAdmin, user.id);
                user.is_admin = isAdmin;
                console.log('✅ [AUTH] Обновлены права админа:', isAdmin);
            }
        }
        
        // КРИТИЧНО: Проверяем user перед генерацией токена
        console.log('🔑 [AUTH] User object before generateToken:', user);
        if (!user.id) {
            console.error('❌ [AUTH] CRITICAL: user.id is undefined!');
            return res.status(500).json({ error: 'Failed to create user in database' });
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
app.post('/api/auth', async (req, res) => {
  try {
    const { telegram_id, username, first_name, last_name, ref } = req.body;
    let referrer_id = null;
    if (ref) {
      referrer_id = parseInt(ref, 10);
    }
    
    // Проверяем, является ли пользователь админом
    const adminIds = process.env.ADMIN_TELEGRAM_IDS ? 
        process.env.ADMIN_TELEGRAM_IDS.split(',').map(id => id.trim()) : 
        ADMIN_TELEGRAM_IDS;
    const isAdmin = adminIds.includes(telegram_id.toString());
    
    console.log('🔐 [AUTH] Проверка админ прав:', { 
        userId: telegram_id.toString(), 
        adminIds, 
        isAdmin 
    });
    
    // Ищем существующего пользователя
    const getUser = dbLegacy.prepare('SELECT * FROM users WHERE telegram_id = $1');
    const user = await getUser.get(telegram_id);
    
    if (user) {
      // Пользователь существует - обновляем данные если нужно
      if (first_name || last_name) {
        const updateUser = dbLegacy.prepare('UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3');
        await updateUser.run(first_name || user.first_name, last_name || user.last_name, user.id);
        user.first_name = first_name || user.first_name;
        user.last_name = last_name || user.last_name;
      }
      
      // Обновляем is_admin если изменился
      if (user.is_admin !== isAdmin) {
        const updateAdminStatus = dbLegacy.prepare('UPDATE users SET is_admin = $1 WHERE id = $2');
        await updateAdminStatus.run(isAdmin, user.id);
        user.is_admin = isAdmin;
        console.log('✅ [AUTH] Обновлены права админа:', isAdmin);
      }
      
      console.log('🔑 [AUTH /api/auth] User object before generateToken:', user);
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
          role: user.is_admin ? 'admin' : 'user',
          referrer_id: user.referrer_id 
        } 
      });
    } else {
      // Создаем нового пользователя
      const insertUser = dbLegacy.prepare('INSERT INTO users (telegram_id, username, first_name, last_name, referrer_id, is_admin) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id');
      const result = await insertUser.get(telegram_id, username, first_name, last_name, referrer_id, isAdmin);
      
      const newUser = {
        id: result.id,  // PostgreSQL возвращает id через RETURNING
        telegram_id,
        username,
        first_name,
        last_name,
        is_admin: isAdmin
      };
      
      console.log('✅ [AUTH] Создан новый пользователь с is_admin:', isAdmin);
      console.log('🔑 [AUTH /api/auth] New user object before generateToken:', newUser);
      
      const token = generateToken(newUser);
      res.json({ 
        token, 
        user: { 
          id: result.id, 
          telegram_id, 
          username,
          first_name,
          last_name,
          is_admin: isAdmin,
          isAdmin: isAdmin,  // Добавляем camelCase для совместимости
          role: isAdmin ? 'admin' : 'user',
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
    const getProducts = dbLegacy.prepare('SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC');
    const products = await getProducts.all();
    console.log('📦 [SERVER LOAD] Найдено товаров:', products.length);
    
    if (products.length === 0) {
      return res.json(products);
    }
    
    // Для каждого товара считаем рейтинг и количество отзывов
    const productIds = products.map(p => p.id);
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    const getRatings = dbLegacy.prepare(`SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as reviews_count FROM reviews WHERE product_id IN (${placeholders}) GROUP BY product_id`);
    const ratings = await getRatings.all(...productIds);
    
    // Создаем карту рейтингов
    const ratingMap = {};
    ratings.forEach(r => { 
      ratingMap[r.product_id] = r; 
    });
    
    // Добавляем рейтинги к товарам и конвертируем типы для клиента
    const result = products.map(p => ({
      ...p,
      price: parseFloat(p.price), // Конвертируем DECIMAL в number
      price_ton: p.price_ton ? parseFloat(p.price_ton) : null,
      price_usdt: p.price_usdt ? parseFloat(p.price_usdt) : null,
      price_stars: p.price_stars ? parseInt(p.price_stars) : null,
      rating: parseFloat(ratingMap[p.id]?.avg_rating) || 0,
      reviewsCount: parseInt(ratingMap[p.id]?.reviews_count) || 0
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
app.get('/api/products/:id', async (req, res) => {
  try {
    const getProduct = dbLegacy.prepare('SELECT * FROM products WHERE id = ? AND is_active = true');
    const product = await getProduct.get(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    
    const getRating = dbLegacy.prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as reviews_count FROM reviews WHERE product_id = ?');
    const rating = await getRating.get(product.id);
    
    res.json({
      ...product,
      price: parseFloat(product.price),
      price_ton: product.price_ton ? parseFloat(product.price_ton) : null,
      price_usdt: product.price_usdt ? parseFloat(product.price_usdt) : null,
      price_stars: product.price_stars ? parseInt(product.price_stars) : null,
      rating: parseFloat(rating?.avg_rating) || 0,
      reviewsCount: parseInt(rating?.reviews_count) || 0
    });
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ error: 'Ошибка получения товара' });
  }
});

// Ручная проверка криптоплатежей (для отладки)
app.post('/api/payments/crypto/check', authMiddlewareWithDB, async (req, res) => {
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
app.get('/api/payments/crypto/pending', authMiddlewareWithDB, (req, res) => {
  try {
    const getPendingInvoices = dbLegacy.prepare(`
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
app.get('/api/user/role', authMiddlewareWithDB, (req, res) => {
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
// Примечание: Эндпоинт POST /api/admin/products уже определён выше (строка 959) с поддержкой загрузки изображений

// Удаление товара (только для админов)
app.delete('/api/admin/products/:id', adminMiddleware, (req, res) => {
  console.log('\n🗑️ [SERVER DELETE] ========== НАЧАЛО УДАЛЕНИЯ ТОВАРА ==========');
  try {
    const productId = parseInt(req.params.id);
    console.log('🗑️ [SERVER DELETE] Product ID:', productId);
    console.log('🗑️ [SERVER DELETE] User:', req.user);
    
    // Проверяем, существует ли товар
    const getProduct = dbLegacy.prepare('SELECT * FROM products WHERE id = ?');
    const product = getProduct.get(productId);
    console.log('🗑️ [SERVER DELETE] Найден товар:', product);
    
    if (!product) {
      console.error('❌ [SERVER DELETE] Товар не найден в БД');
      return res.status(404).json({ error: 'Товар не найден' });
    }
    
    // Проверяем, есть ли активные заказы у товара
    const getActiveOrders = dbLegacy.prepare(`
      SELECT COUNT(*) as count FROM orders 
      WHERE product_id = ? AND status IN ('pending', 'pending_crypto', 'paid')
    `);
    const activeOrders = getActiveOrders.get(productId);
    console.log('🗑️ [SERVER DELETE] Активных заказов:', activeOrders.count);
    
    // Удаляем связанные данные в правильном порядке (включая активные заказы)
    const deleteOrders = dbLegacy.prepare('DELETE FROM orders WHERE product_id = ?');
    const deleteProduct = dbLegacy.prepare('DELETE FROM products WHERE id = ?');
    
    console.log('🗑️ [SERVER DELETE] Начало транзакции удаления...');
    
    // Выполняем удаление в транзакции
    const deleteTransaction = dbLegacy.transaction(() => {
      // Удаляем отзывы если таблица существует
      try {
        const deleteReviews = dbLegacy.prepare('DELETE FROM reviews WHERE product_id = ?');
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
    const verifyDelete = dbLegacy.prepare('SELECT * FROM products WHERE id = ?');
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
    const getProducts = dbLegacy.prepare(`
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
app.get('/api/payments/history', authMiddlewareWithDB, (req, res) => {
  try {
    const userId = req.user.id;
    
    const getPayments = dbLegacy.prepare(`
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
      
      // === ЗАПУСК TON POLLING ===
      tonPolling(); // db импортируется внутри модуля
      
      // Запускаем cron задачу для автоматической отмены истёкших заказов
      console.log('⏰ Запуск cron задачи для автоотмены заказов (каждые 5 минут)');
      cron.schedule('*/5 * * * *', () => {
        try {
          console.log('\n⏰ [CRON] Проверка истёкших заказов...');
          
          const now = new Date();
          const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          
          // Находим все заказы старше 1 часа со статусом pending
          const getExpiredOrders = dbLegacy.prepare(`
            SELECT * FROM orders 
            WHERE status IN ('pending', 'pending_crypto') 
            AND created_at < ?
          `);
          
          const expiredOrders = getExpiredOrders.all(hourAgo.toISOString());
          
          if (expiredOrders.length > 0) {
            console.log(`⏰ [CRON] Найдено истёкших заказов: ${expiredOrders.length}`);
            
            const updateOrder = dbLegacy.prepare('UPDATE orders SET status = ? WHERE id = ?');
            
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
