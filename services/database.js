const db = require('../db');
const PostgresAdapter = require('../db-postgres');

class DatabaseService {
    constructor() {
        this.dbLegacy = new PostgresAdapter(process.env.DATABASE_URL);
    }

    async initDB() {
        try {
            console.log('🔄 Инициализация базы данных PostgreSQL...');
            
            // Таблица пользователей
            await this.dbLegacy.exec(`
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
            await this.dbLegacy.exec(`
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
                await this.dbLegacy.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS file_path TEXT`);
            } catch (e) {
                // Колонка уже существует
            }

            // Таблица отзывов
            await this.dbLegacy.exec(`
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
                await this.dbLegacy.exec(`
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
            await this.dbLegacy.exec(`
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
            await this.dbLegacy.exec(`
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
            
            // Миграция: изменяем тип amount для поддержки TON (до 9 знаков после запятой)
            try {
                await this.dbLegacy.exec(`ALTER TABLE invoices ALTER COLUMN amount TYPE DECIMAL(20,9)`);
                console.log('✅ Миграция: колонка amount изменена на DECIMAL(20,9)');
            } catch (e) {
                console.log('⚠️ Миграция amount: уже выполнена или ошибка:', e.message);
            }

            // Миграция: добавляем колонку transaction_hash
            try {
                await this.dbLegacy.exec(`
                    ALTER TABLE invoices 
                    ADD COLUMN IF NOT EXISTS transaction_hash TEXT
                `);
                console.log('✅ Миграция: колонка transaction_hash добавлена');
            } catch (e) {
                if (!e.message.includes('already exists')) {
                    console.error('⚠️ Ошибка миграции transaction_hash:', e.message);
                }
            }

            // Миграция: добавляем колонку paid_at
            try {
                await this.dbLegacy.exec(`
                    ALTER TABLE invoices 
                    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP
                `);
                console.log('✅ Миграция: колонка paid_at добавлена');
            } catch (e) {
                if (!e.message.includes('already exists')) {
                    console.error('⚠️ Ошибка миграции paid_at:', e.message);
                }
            }

            // Миграция: добавляем колонки для Telegram Stars
            try {
                await this.dbLegacy.exec(`
                    ALTER TABLE invoices 
                    ADD COLUMN IF NOT EXISTS telegram_invoice_data TEXT,
                    ADD COLUMN IF NOT EXISTS payload TEXT,
                    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
                    ADD COLUMN IF NOT EXISTS address TEXT,
                    ADD COLUMN IF NOT EXISTS memo TEXT,
                    ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id)
                `);
                console.log('✅ Миграция: колонки для Telegram Stars добавлены');
            } catch (e) {
                if (!e.message.includes('already exists')) {
                    console.error('⚠️ Ошибка миграции Telegram Stars:', e.message);
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

    getDbLegacy() {
        return this.dbLegacy;
    }
}

module.exports = DatabaseService;
