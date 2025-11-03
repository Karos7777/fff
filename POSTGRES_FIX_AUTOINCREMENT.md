# 🔧 Исправление ошибки AUTOINCREMENT в PostgreSQL

## ❌ Ошибка

```
syntax error at or near "AUTOINCREMENT"
```

## 🎯 Причина

В файле `payment-service.js` использовался **SQLite синтаксис** (`AUTOINCREMENT`), который не поддерживается в **PostgreSQL**.

## ✅ Что было исправлено

### 1. **payment-service.js** - Замена SQLite на PostgreSQL

#### Было (SQLite):
```sql
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,  -- ❌ SQLite
  amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Стало (PostgreSQL):
```sql
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,  -- ✅ PostgreSQL
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. **Изменения в синтаксисе:**

| SQLite | PostgreSQL |
|--------|------------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `REAL` | `DECIMAL(10,2)` |
| `DATETIME` | `TIMESTAMP` |
| `CURRENT_TIMESTAMP` | `NOW()` |
| `ALTER TABLE ADD COLUMN` | `ALTER TABLE ADD COLUMN IF NOT EXISTS` |

### 3. **Обновлена инициализация**

**server.js:**
```javascript
// Теперь инициализация асинхронная
initDB()
  .then(async () => {
    paymentService = new PaymentService(db, BOT_TOKEN);
    await paymentService.initPaymentTables();  // ✅ Async
    console.log('✅ Сервис платежей инициализирован');
  })
  .catch(err => {
    console.error('❌ Критическая ошибка:', err);
    process.exit(1);
  });
```

## 📊 Исправленные таблицы

### 1. **invoices** (Счета на оплату)
```sql
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
```

### 2. **transactions** (Транзакции)
```sql
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
```

### 3. **payment_settings** (Настройки платежей)
```sql
CREATE TABLE IF NOT EXISTS payment_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Как проверить

### 1. Запустите сервер локально

```bash
npm start
```

Вы должны увидеть:
```
🔌 Подключение к PostgreSQL...
🔄 Инициализация базы данных PostgreSQL...
✅ База данных PostgreSQL инициализирована успешно
✅ Таблицы платежей инициализированы
✅ Сервис платежей инициализирован
🚀 Сервер запущен на порту 10000
```

### 2. Проверьте таблицы в PostgreSQL

```bash
psql $DATABASE_URL
```

```sql
\dt  -- Список всех таблиц

-- Должны быть:
-- users
-- products
-- orders
-- reviews
-- invoices
-- transactions
-- payment_settings

-- Проверьте структуру
\d invoices
\d transactions
\d payment_settings
```

### 3. Проверьте индексы

```sql
\di  -- Список индексов

-- Должны быть:
-- idx_invoices_payload
-- idx_invoices_status
-- idx_transactions_hash
```

## 📝 Изменённые файлы

1. **payment-service.js** - Замена SQLite на PostgreSQL синтаксис
2. **server.js** - Асинхронная инициализация платежей

## ✅ Итог

После этих изменений:

- ✅ Все таблицы используют PostgreSQL синтаксис
- ✅ Нет ошибок `AUTOINCREMENT`
- ✅ Асинхронная инициализация работает корректно
- ✅ Все foreign keys с CASCADE
- ✅ Индексы для оптимизации запросов

## 🎯 Следующие шаги

1. Закоммитьте изменения:
```bash
git add .
git commit -m "Fix AUTOINCREMENT error - migrate payment tables to PostgreSQL"
git push
```

2. Railway автоматически задеплоит изменения

3. Проверьте логи на Railway - должно быть:
```
✅ База данных PostgreSQL инициализирована успешно
✅ Таблицы платежей инициализированы
✅ Сервис платежей инициализирован
```

---

**Версия:** 2.2.0  
**Дата:** 03.11.2025  
**Статус:** ✅ Исправлено
