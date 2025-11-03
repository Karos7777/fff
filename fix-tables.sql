-- Скрипт для исправления структуры таблиц PostgreSQL
-- Выполните этот скрипт в Railway SQL Editor

-- 1. Удаляем старые таблицы платежей (если они были созданы с ошибками)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS payment_settings CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

-- 2. Создаем таблицу invoices заново с правильной структурой
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  
  invoice_payload TEXT UNIQUE NOT NULL,
  
  telegram_payment_charge_id TEXT,
  telegram_provider_payment_charge_id TEXT,
  
  crypto_address TEXT,
  crypto_memo TEXT,
  crypto_tx_hash TEXT,
  crypto_confirmations INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- 3. Создаем таблицу transactions
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL,
  
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  
  tx_hash TEXT,
  from_address TEXT,
  to_address TEXT,
  amount DECIMAL(10,2) NOT NULL,
  fee DECIMAL(10,2) DEFAULT 0,
  
  block_number INTEGER,
  confirmations INTEGER DEFAULT 0,
  
  telegram_payment_id TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  
  metadata TEXT,
  
  FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
);

-- 4. Создаем таблицу payment_settings
CREATE TABLE IF NOT EXISTS payment_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Создаем индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_invoices_payload ON invoices(invoice_payload);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON transactions(invoice_id);

-- 6. Проверяем, что колонки в orders существуют
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_hash TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT NULL;

-- 7. Проверяем результат
SELECT 'invoices' as table_name, COUNT(*) as columns FROM information_schema.columns WHERE table_name = 'invoices'
UNION ALL
SELECT 'transactions', COUNT(*) FROM information_schema.columns WHERE table_name = 'transactions'
UNION ALL
SELECT 'payment_settings', COUNT(*) FROM information_schema.columns WHERE table_name = 'payment_settings';

-- Готово! Теперь перезапустите сервер на Railway
