require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

// Импорт middleware и routes
const { authMiddleware, authMiddlewareWithDB, JWT_SECRET } = require('./middleware/auth');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const paymentsRoutes = require('./routes/payments');
const reviewsRoutes = require('./routes/reviews');
const telegramRoutes = require('./routes/telegram');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Основные маршруты
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/telegram', telegramRoutes);

// Аутентификация через Telegram
app.post('/api/auth/telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    console.log('🔐 [AUTH] Telegram аутентификация...');
    
    if (!initData || !initData.user) {
      return res.status(400).json({ error: 'Данные пользователя не предоставлены' });
    }
    
    const user = initData.user;
    console.log('👤 [AUTH] Пользователь:', user.first_name, user.id);
    
    // Проверяем существование пользователя
    let userResult = await db.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [user.id]
    );
    
    let userData;
    if (userResult.rows.length === 0) {
      // Создаем нового пользователя
      console.log('➕ [AUTH] Создание нового пользователя...');
      const insertResult = await db.query(`
        INSERT INTO users (telegram_id, first_name, last_name, username, is_admin, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `, [user.id, user.first_name, user.last_name, user.username, false]);
      
      userData = insertResult.rows[0];
    } else {
      // Обновляем существующего пользователя
      console.log('🔄 [AUTH] Обновление пользователя...');
      const updateResult = await db.query(`
        UPDATE users 
        SET first_name = $2, last_name = $3, username = $4, last_login = NOW()
        WHERE telegram_id = $1
        RETURNING *
      `, [user.id, user.first_name, user.last_name, user.username]);
      
      userData = updateResult.rows[0];
    }
    
    // Генерируем JWT токен
    const token = jwt.sign(
      { 
        id: userData.id, 
        telegram_id: userData.telegram_id,
        is_admin: userData.is_admin 
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    console.log('✅ [AUTH] Токен создан для пользователя:', userData.telegram_id);
    
    res.json({
      success: true,
      token: token,
      user: {
        id: userData.id,
        telegram_id: userData.telegram_id,
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username,
        is_admin: userData.is_admin
      }
    });
  } catch (error) {
    console.error('❌ [AUTH] Ошибка аутентификации:', error);
    res.status(500).json({ error: 'Ошибка аутентификации' });
  }
});

// Получение профиля пользователя
app.get('/api/user/profile', authMiddlewareWithDB, async (req, res) => {
  try {
    console.log('👤 [PROFILE] Получение профиля пользователя:', req.user.telegram_id);
    
    res.json({
      success: true,
      user: {
        id: req.user.id,
        telegram_id: req.user.telegram_id,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        username: req.user.username,
        is_admin: req.user.is_admin,
        created_at: req.user.created_at
      }
    });
  } catch (error) {
    console.error('❌ [PROFILE] Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

// Админ панель
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Инициализация базы данных
async function initDatabase() {
  try {
    console.log('🔄 [DB] Инициализация базы данных...');
    
    // Создание таблиц
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        username VARCHAR(255),
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP
      )
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2),
        price_ton DECIMAL(10,4),
        price_usdt DECIMAL(10,2),
        price_stars INTEGER,
        category VARCHAR(100),
        image_url TEXT,
        file_path TEXT,
        stock_quantity INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(50),
        transaction_hash VARCHAR(255),
        telegram_invoice_data TEXT,
        payload VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 hour')
      )
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        product_id INTEGER REFERENCES products(id),
        order_id INTEGER REFERENCES orders(id),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      )
    `);
    
    console.log('✅ [DB] База данных инициализирована');
  } catch (error) {
    console.error('❌ [DB] Ошибка инициализации базы данных:', error);
    process.exit(1);
  }
}

// Запуск сервера
async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 [SERVER] Сервер запущен на порту ${PORT}`);
      console.log(`📱 [SERVER] Админ панель: http://localhost:${PORT}/admin`);
      console.log(`🛍️ [SERVER] Магазин: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ [SERVER] Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer();
