require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');

// Импорт сервисов
const DatabaseService = require('./services/database');
const PaymentService = require('./services/payment');
const tonPolling = require('./services/tonPolling');

// Импорт middleware
const { authMiddlewareWithDB } = require('./middleware/auth');

// Импорт роутов
const authRoutes = require('./routes/auth/auth');
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const reviewsRoutes = require('./routes/reviews');
const telegramWebhooks = require('./routes/telegram/webhooks');
const starsPayments = require('./routes/payments/stars');

const app = express();
const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN;

console.log('🔍 JWT_SECRET загружен:', !!process.env.JWT_SECRET);
console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 20) + '...' : 'НЕ УСТАНОВЛЕН');

// Проверка JWT_SECRET
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET слишком короткий или не установлен');
    console.error('💡 Рекомендуется использовать JWT_SECRET длиной не менее 32 символов');
    if (!process.env.JWT_SECRET) {
        console.error('🔧 Установите JWT_SECRET в переменных окружения');
    }
}

// Защита от ошибок: если токен не задан — предупреждение
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

// Инициализация сервисов
const databaseService = new DatabaseService();
let paymentService;

// Сохраняем dbLegacy для доступа из роутов
app.set('dbLegacy', databaseService.getDbLegacy());

// Явные маршруты для важных файлов TON Connect
app.get('/tonconnect-manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.join(__dirname, 'public', 'tonconnect-manifest.json'));
});

app.get('/icon.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(path.join(__dirname, 'public', 'icon.svg'));
});

app.get('/terms.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/privacy.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// Favicon
app.get('/favicon.ico', (req, res) => {
    res.setHeader('Content-Type', 'image/x-icon');
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// Health check endpoint
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

// Подключение роутов
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', usersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes(authMiddlewareWithDB));
app.use('/api/reviews', reviewsRoutes);
app.use('/api/telegram', telegramWebhooks);
app.use('/api/payments/stars', starsPayments);

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Админ панель
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Инициализация и запуск сервера
const startServer = async () => {
    try {
        // Инициализация базы данных
        await databaseService.initDB();
        
        // Инициализация сервиса платежей
        paymentService = new PaymentService(require('./db'), BOT_TOKEN);
        await paymentService.initPaymentTables();
        console.log('✅ Сервис платежей инициализирован');
        
        // Сохраняем paymentService для доступа из роутов
        app.set('paymentService', paymentService);
        
        // Запуск сервера
        const targetPort = process.env.PORT || PORT;
        
        app.listen(targetPort, '0.0.0.0', () => {
            console.log(`🚀 Сервер запущен на порту ${targetPort}`);
            console.log(`🏠 Главная страница: http://localhost:${targetPort}`);
            console.log(`⚙️  Админ панель: http://localhost:${targetPort}/admin`);
            console.log(`❤️  Health check: http://localhost:${targetPort}/healthz`);
            
            if (BOT_TOKEN) {
                console.log('✅ BOT_TOKEN настроен');
            } else {
                console.log('⚠️  BOT_TOKEN не настроен - уведомления Telegram недоступны');
            }
            
            // Запуск TON polling
            tonPolling();
            
            // Настройка cron задач
            setupCronJobs();
        });
        
    } catch (error) {
        console.error('❌ Ошибка запуска сервера:', error);
        process.exit(1);
    }
};

// Настройка автоматических задач
function setupCronJobs() {
    // Проверка криптоплатежей каждые 30 секунд
    if (paymentService) {
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
    
    // Запускаем cron задачу для автоматической отмены истёкших заказов
    console.log('⏰ Запуск cron задачи для автоудаления заказов (каждые 5 минут)');
    cron.schedule('*/5 * * * *', async () => {
        try {
            console.log('\n⏰ [CRON] Проверка истёкших заказов...');
            
            const db = require('./db');
            const now = new Date();
            const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            
            // Находим все заказы старше 1 часа со статусом pending
            const expiredOrdersResult = await db.query(`
                SELECT * FROM orders 
                WHERE status IN ('pending', 'pending_crypto') 
                AND created_at < $1
            `, [hourAgo.toISOString()]);
            
            const expiredOrders = expiredOrdersResult.rows;
            
            if (expiredOrders.length > 0) {
                console.log(`⏰ [CRON] Найдено истёкших заказов: ${expiredOrders.length}`);
                
                // Удаляем истёкшие заказы полностью
                for (const order of expiredOrders) {
                    // Сначала удаляем связанные инвойсы
                    await db.query('DELETE FROM invoices WHERE order_id = $1', [order.id]);
                    
                    // Затем удаляем сам заказ
                    await db.query('DELETE FROM orders WHERE id = $1', [order.id]);
                    
                    console.log(`🗑️ [CRON] Заказ #${order.id} удалён (истёк)`);
                }
                
                console.log(`✅ [CRON] Удалено заказов: ${expiredOrders.length}`);
            } else {
                console.log('⏰ [CRON] Истёкших заказов не найдено');
            }
        } catch (error) {
            console.error('❌ [CRON] Ошибка при проверке заказов:', error);
        }
    });
}

startServer();
