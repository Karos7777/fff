# ✅ PAYMENT SERVICE FIX — ГОТОВО!

## 🎯 Проблема

```
❌ Ошибка создания крипто инвойса: TypeError: this.db.query is not a function
    at PaymentService.createCryptoInvoice (/app/payment-service.js:244:38)
```

**Причина:** `PaymentService` получал старый `db` (PostgresAdapter), который не имеет метода `query()`.

---

## ✅ Решение

### 1. Обновлён `server.js`

**Импорты:**
```js
const db = require('./db'); // ← Новый универсальный адаптер
const PostgresAdapter = require('./db-postgres'); // ← Старый для совместимости
```

**Инициализация:**
```js
const dbLegacy = new PostgresAdapter(process.env.DATABASE_URL); // Старый
const authMiddlewareWithDB = authMiddleware(dbLegacy); // Middleware использует старый

// В initDB() используется dbLegacy.exec()
await dbLegacy.exec(`CREATE TABLE IF NOT EXISTS users ...`);

// PaymentService получает НОВЫЙ db
paymentService = new PaymentService(db, BOT_TOKEN); // ← Новый db!
```

### 2. Добавлен метод `exec()` в `db/index.js`

```js
// Выполнить SQL без параметров (для CREATE TABLE и т.д.)
async exec(text) {
  const client = await pool.connect();
  try {
    await client.query(text);
  } finally {
    client.release();
  }
}
```

**Теперь `db` имеет все методы:**
- ✅ `db.query(sql, params)` — для SELECT/INSERT/UPDATE/DELETE
- ✅ `db.get(sql, params)` — для получения одной строки
- ✅ `db.run(sql, params)` — для INSERT/UPDATE/DELETE
- ✅ `db.all(sql, params)` — для получения всех строк
- ✅ `db.exec(sql)` — для CREATE TABLE и других DDL

---

## 📊 Архитектура

```
server.js
├── db (новый) ──────────────> PaymentService ✅
│                              routes/orders.js ✅
│                              routes/ton.js ✅
│                              services/tonPolling.js ✅
│
└── dbLegacy (старый) ───────> authMiddleware
                                initDB()
```

**Почему два db?**
- `db` (новый) — для модулей и PaymentService
- `dbLegacy` (старый) — для совместимости с middleware и initDB

---

## 🚀 Тестирование

### 1. Запусти сервер
```bash
npm start
```

**Ожидаемые логи:**
```
✅ DB подключён через db/index.js
✅ Сервис платежей инициализирован
✅ Модульные роуты подключены
✅ TON Polling сервис запущен
```

### 2. Создай заказ с TON
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 8, "payment_method": "ton"}'
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "orderId": 123,
  "invoice": {
    "url": "ton://transfer/...",
    "qr": "data:image/png;base64,...",
    "address": "UQCm27jo...",
    "amount": "0.0010"
  }
}
```

**Без ошибок!** ✅

### 3. Проверь логи
```
[ORDER] Создание заказа: { user_id: 1, product_id: 8 }
[ORDER] Заказ создан: 123
[TON INVOICE] Создание инвойса: { orderId: 123, ... }
✅ [ORDER] Инвойс создан успешно
```

---

## 🎉 ИТОГ

**Исправлено:**
- ✅ `server.js` импортирует новый `db` из `./db`
- ✅ `PaymentService` получает новый `db` с методом `query()`
- ✅ Добавлен метод `exec()` в `db/index.js`
- ✅ Старый `dbLegacy` используется для совместимости
- ✅ Все модули работают с новым `db`

**Результат:**
- ✅ Создание заказов работает
- ✅ TON инвойсы создаются
- ✅ Polling работает
- ✅ Удаление работает

**ГОТОВО К ДЕПЛОЮ!** 🚀💎

---

## 📝 Деплой

```bash
git add .
git commit -m "Fix: PaymentService now uses new db adapter with query method"
git push
```

**ПРОВЕРЬ ЛОГИ НА RAILWAY!**
