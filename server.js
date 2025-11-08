require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

// Импорт модулей
const db = require('./db');
const PostgresAdapter = require('./db-postgres');
const { authMiddleware } = require('./middleware');
const PaymentService = require('./payment-service');
const tonPolling = require('./services/tonPolling');

// Импорт роутов
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const paymentsRoutes = require('./routes/payments');
const reviewsRoutes = require('./routes/reviews');
const staticRoutes = require('./routes/static');
const testRoutes = require('./routes/test');
const telegramRoutes = require('./routes/telegram');
const ordersRoutes = require('./routes/orders');
const tonRoutes = require('./routes/ton');

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
const dbLegacy = new PostgresAdapter(process.env.DATABASE_URL);

// Создаём экземпляр authMiddleware с доступом к db
const authMiddlewareWithDB = authMiddleware(dbLegacy);

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
                amount DECIMAL(20,9) NOT NULL,
                currency TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                payment_url TEXT,
                invoice_id TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Миграции для дополнительных колонок
        const migrations = [
            { 
                name: 'amount type', 
                sql: `ALTER TABLE invoices ALTER COLUMN amount TYPE DECIMAL(20,9)` 
            },
            { 
                name: 'transaction_hash', 
                sql: `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transaction_hash TEXT` 
            },
            { 
                name: 'paid_at', 
                sql: `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP` 
            },
            { 
                name: 'telegram_stars_columns', 
                sql: `ALTER TABLE invoices 
                      ADD COLUMN IF NOT EXISTS telegram_invoice_data TEXT,
                      ADD COLUMN IF NOT EXISTS payload TEXT,
                      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
                      ADD COLUMN IF NOT EXISTS address TEXT,
                      ADD COLUMN IF NOT EXISTS memo TEXT,
                      ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id)` 
            }
        ];

        for (const migration of migrations) {
            try {
                await dbLegacy.exec(migration.sql);
                console.log(`✅ Миграция: ${migration.name} выполнена`);
            } catch (e) {
                if (!e.message.includes('already exists')) {
                    console.error(`⚠️ Ошибка миграции ${migration.name}:`, e.message);
                }
            }
        }

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
            
            // Сохраняем paymentService для доступа из роутов
            app.set('paymentService', paymentService);
            
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

// === ПОДКЛЮЧЕНИЕ МОДУЛЬНЫХ РОУТОВ ===

// Статические файлы и страницы
app.use('/', staticRoutes);

// API роуты
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/payments', authMiddlewareWithDB, paymentsRoutes);
app.use('/api/reviews', authMiddlewareWithDB, reviewsRoutes);
app.use('/api/orders', ordersRoutes(authMiddlewareWithDB));
app.use('/api/ton', tonRoutes(authMiddlewareWithDB));
app.use('/api/telegram', telegramRoutes);

// Добавляем middleware к защищенным роутам auth
app.use('/api/user', authMiddlewareWithDB, authRoutes);

// Тестовые эндпоинты (только для разработки)
if (process.env.NODE_ENV !== 'production') {
    app.use('/api/test', testRoutes);
}

// Дополнительные эндпоинты, которые остались в основном файле

// Эндпоинт для отмены/истечения заказа
app.post('/api/orders/:id/expire', authMiddlewareWithDB, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.user.id;
        
        console.log('⏰ [EXPIRE] Попытка отмены заказа:', { orderId, userId });
        
        if (!orderId || isNaN(orderId)) {
            return res.status(400).json({ error: 'Неверный ID заказа' });
        }
        
        // Проверяем существование заказа и принадлежность пользователю
        const orderResult = await db.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
        const order = orderResult.rows[0];
        
        if (!order) {
            console.log('❌ [EXPIRE] Заказ не найден или не принадлежит пользователю');
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        
        // Проверяем статус заказа
        if (order.status === 'paid') {
            console.log('❌ [EXPIRE] Нельзя отменить оплаченный заказ');
            return res.status(400).json({ error: 'Нельзя отменить оплаченный заказ' });
        }
        
        // Обновляем статус заказа на expired
        await db.query('UPDATE orders SET status = $1 WHERE id = $2', ['expired', orderId]);
        
        console.log('✅ [EXPIRE] Заказ успешно отменен:', orderId);
        
        res.json({
            success: true,
            message: 'Заказ успешно отменен',
            orderId: orderId
        });
        
    } catch (error) {
        console.error('❌ [EXPIRE] Ошибка отмены заказа:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Cron задача для автоматического удаления старых заказов
cron.schedule('*/10 * * * *', async () => {
    try {
        console.log('🧹 [CRON] Запуск задачи удаления старых заказов...');
        
        // Удаляем заказы старше 1 часа со статусом pending или expired
        const result = await db.query(`
            DELETE FROM orders 
            WHERE status IN ('pending', 'expired') 
            AND created_at < NOW() - INTERVAL '1 hour'
        `);
        
        if (result.rowCount > 0) {
            console.log(`🗑️ [CRON] Удалено ${result.rowCount} старых заказов`);
        }
    } catch (error) {
        console.error('❌ [CRON] Ошибка удаления старых заказов:', error);
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 WebApp URL: ${process.env.WEBAPP_URL || `http://localhost:${PORT}`}`);
    
    // Запуск TON polling если включен
    if (process.env.ENABLE_TON_POLLING === 'true') {
        console.log('🔄 Запуск TON polling...');
        tonPolling.start();
    }
});

module.exports = app;
