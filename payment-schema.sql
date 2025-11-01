-- Расширенная схема базы данных для системы платежей

-- Таблица инвойсов (счетов на оплату)
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  
  -- Общие поля
  amount REAL NOT NULL,
  currency TEXT NOT NULL, -- 'XTR' для Stars, 'TON', 'USDT'
  status TEXT DEFAULT 'pending', -- pending, paid, expired, cancelled
  
  -- Уникальные идентификаторы
  invoice_payload TEXT UNIQUE NOT NULL, -- Уникальный payload для идентификации
  
  -- Для Telegram Stars
  telegram_payment_charge_id TEXT, -- ID платежа от Telegram
  telegram_provider_payment_charge_id TEXT, -- ID от провайдера платежей
  
  -- Для криптовалют
  crypto_address TEXT, -- Адрес для получения платежа
  crypto_memo TEXT, -- Memo/comment для идентификации
  crypto_tx_hash TEXT, -- Хэш транзакции после оплаты
  crypto_confirmations INTEGER DEFAULT 0, -- Количество подтверждений
  
  -- Временные метки
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  expires_at DATETIME, -- Время истечения инвойса
  
  FOREIGN KEY (order_id) REFERENCES orders (id),
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (product_id) REFERENCES products (id)
);

-- Таблица транзакций (для детального логирования)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  
  -- Тип и статус транзакции
  type TEXT NOT NULL, -- 'stars', 'ton', 'usdt'
  status TEXT NOT NULL, -- 'pending', 'confirmed', 'failed'
  
  -- Данные транзакции
  tx_hash TEXT, -- Хэш транзакции в блокчейне
  from_address TEXT, -- Адрес отправителя
  to_address TEXT, -- Адрес получателя
  amount REAL NOT NULL,
  fee REAL DEFAULT 0,
  
  -- Блокчейн данные
  block_number INTEGER,
  confirmations INTEGER DEFAULT 0,
  
  -- Telegram данные (для Stars)
  telegram_payment_id TEXT,
  
  -- Временные метки
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME,
  
  -- Дополнительные данные в JSON
  metadata TEXT, -- JSON с дополнительной информацией
  
  FOREIGN KEY (invoice_id) REFERENCES invoices (id)
);

-- Таблица настроек платежей
CREATE TABLE IF NOT EXISTS payment_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Вставляем базовые настройки
INSERT OR IGNORE INTO payment_settings (key, value, description) VALUES
('ton_wallet_address', '', 'TON кошелек для получения платежей'),
('usdt_contract_address', 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', 'Адрес USDT контракта на TON'),
('stars_provider_token', '', 'Токен провайдера для Telegram Stars'),
('min_confirmations_ton', '1', 'Минимальное количество подтверждений для TON'),
('min_confirmations_usdt', '2', 'Минимальное количество подтверждений для USDT'),
('invoice_expiry_minutes', '30', 'Время жизни инвойса в минутах'),
('ton_api_key', '', 'API ключ для TonAPI'),
('auto_complete_orders', 'true', 'Автоматически завершать заказы после оплаты');

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_invoices_payload ON invoices(invoice_payload);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Обновляем таблицу заказов для поддержки платежей
ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL; -- 'stars', 'ton', 'usdt', NULL для старых заказов
ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid'; -- 'unpaid', 'pending', 'paid', 'failed'
ALTER TABLE orders ADD COLUMN total_amount REAL DEFAULT 0; -- Общая сумма заказа
ALTER TABLE orders ADD COLUMN currency TEXT DEFAULT 'RUB'; -- Валюта заказа
