const db = require('../db-postgres');

class DatabaseService {
    constructor() {
        this.db = db;
    }

    async initDB() {
        try {
            console.log('🔄 Инициализация базы данных PostgreSQL...');
            
            await this.db.exec(`
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
            
            await this.db.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS file_path TEXT`);
            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS reviews (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                    comment TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            await this.db.exec(`
                ALTER TABLE products 
                ADD COLUMN IF NOT EXISTS price_ton DECIMAL(10,4),
                ADD COLUMN IF NOT EXISTS price_usdt DECIMAL(10,4),
                ADD COLUMN IF NOT EXISTS price_stars INTEGER
            `);
            
            await this.db.exec(`
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


            await this.db.exec(`
                ALTER TABLE orders 
                ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
                ADD COLUMN IF NOT EXISTS total_amount DECIMAL(20,9),
                ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS invoice_payload VARCHAR(255)
            `);
            
            await this.db.exec(`
                UPDATE orders 
                SET invoice_payload = 'order_' || id 
                WHERE invoice_payload IS NULL OR invoice_payload = 'null'
            `);

            await this.db.exec(`
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

            
            await this.db.exec(`ALTER TABLE invoices ALTER COLUMN amount TYPE DECIMAL(20,9)`);
            await this.db.exec(`
                ALTER TABLE invoices 
                ADD COLUMN IF NOT EXISTS transaction_hash TEXT,
                ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS telegram_invoice_data TEXT,
                ADD COLUMN IF NOT EXISTS payload TEXT,
                ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS address TEXT,
                ADD COLUMN IF NOT EXISTS memo TEXT,
                ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id)
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

    getDb() {
        return this.db;
    }
}

module.exports = DatabaseService;
