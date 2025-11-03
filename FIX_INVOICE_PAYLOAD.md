# 🔧 Исправление ошибки "column invoice_payload does not exist"

## ❌ Ошибка

```
column "invoice_payload" does not exist
```

## 🎯 Причина

Таблица `invoices` была создана **не полностью** из-за предыдущей ошибки с `AUTOINCREMENT`. Когда вы исправили синтаксис, PostgreSQL не пересоздал таблицу (она уже существовала), но в ней отсутствовала колонка `invoice_payload`.

## ✅ Решение

### Вариант 1: Пересоздать таблицы через SQL (Рекомендуется)

#### Шаг 1: Откройте Railway SQL Editor

1. Откройте ваш проект на Railway
2. Перейдите в PostgreSQL сервис
3. Нажмите **"Connect"** → **"SQL Editor"**

#### Шаг 2: Выполните SQL скрипт

Скопируйте и выполните содержимое файла `fix-tables.sql`:

```sql
-- 1. Удаляем старые таблицы платежей
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS payment_settings CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

-- 2. Создаем таблицу invoices заново
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

-- 5. Создаем индексы
CREATE INDEX IF NOT EXISTS idx_invoices_payload ON invoices(invoice_payload);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);

-- 6. Добавляем колонки в orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_hash TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);
```

#### Шаг 3: Перезапустите сервер

1. Вернитесь в сервис `fff`
2. Нажмите **"Restart"**

---

### Вариант 2: Добавить колонку вручную (Быстрый способ)

Если не хотите удалять таблицы, просто добавьте недостающую колонку:

```sql
-- Добавляем колонку invoice_payload
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_payload TEXT UNIQUE NOT NULL DEFAULT '';

-- Создаем индекс
CREATE INDEX IF NOT EXISTS idx_invoices_payload ON invoices(invoice_payload);
```

⚠️ **Внимание**: Этот способ может не сработать, если структура таблицы сильно отличается от ожидаемой.

---

## 🧪 Проверка

После выполнения SQL и перезапуска сервера:

### 1. Проверьте логи Railway

Должно быть:
```
✅ База данных PostgreSQL инициализирована успешно
✅ Таблицы платежей инициализированы
✅ Сервис платежей инициализирован
🚀 Сервер запущен на порту 8080
```

### 2. Проверьте структуру таблицы

В SQL Editor:
```sql
\d invoices

-- Должны быть все колонки:
-- id, order_id, user_id, product_id, amount, currency, status,
-- invoice_payload, telegram_payment_charge_id, telegram_provider_payment_charge_id,
-- crypto_address, crypto_memo, crypto_tx_hash, crypto_confirmations,
-- created_at, paid_at, expires_at
```

### 3. Проверьте индексы

```sql
\di

-- Должны быть:
-- idx_invoices_payload
-- idx_invoices_status
-- idx_transactions_hash
```

### 4. Проверьте API

```bash
curl https://ваш-проект.up.railway.app/api/products
```

Должен вернуть `[]` (пустой массив) без ошибок.

---

## 📊 Структура таблицы invoices

После исправления таблица должна иметь следующую структуру:

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | SERIAL | Уникальный ID |
| order_id | INTEGER | ID заказа |
| user_id | INTEGER | ID пользователя |
| product_id | INTEGER | ID товара |
| amount | DECIMAL(10,2) | Сумма |
| currency | TEXT | Валюта (XTR, TON, USDT) |
| status | TEXT | Статус (pending, paid, expired) |
| **invoice_payload** | TEXT | **Уникальный идентификатор инвойса** |
| telegram_payment_charge_id | TEXT | ID платежа Telegram |
| telegram_provider_payment_charge_id | TEXT | ID провайдера |
| crypto_address | TEXT | Адрес кошелька |
| crypto_memo | TEXT | Memo для платежа |
| crypto_tx_hash | TEXT | Hash транзакции |
| crypto_confirmations | INTEGER | Количество подтверждений |
| created_at | TIMESTAMP | Дата создания |
| paid_at | TIMESTAMP | Дата оплаты |
| expires_at | TIMESTAMP | Дата истечения |

---

## 🎯 Что дальше?

После исправления:

1. ✅ Сервер запустится без ошибок
2. ✅ Вы сможете создавать товары
3. ✅ Вы сможете удалять товары
4. ✅ Вы сможете создавать заказы
5. ✅ Платежная система будет работать

---

## 💬 Если ошибка осталась

Если после выполнения SQL скрипта ошибка всё ещё появляется:

1. Проверьте логи Railway - какая именно ошибка?
2. Выполните в SQL Editor:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices';
```
3. Убедитесь, что `invoice_payload` есть в списке

---

**Версия:** 2.2.0  
**Дата:** 03.11.2025  
**Статус:** ✅ Готово к исправлению
