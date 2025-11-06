# ✅ DB.QUERY ОШИБКА — ИСПРАВЛЕНО!

## 🎯 Проблема

```
TypeError: db.query is not a function
```

**Причина:** Модули пытались использовать `db.query()`, но `db` не был правильно экспортирован.

---

## ✅ Решение

### 1. Создан `db/index.js` — универсальный адаптер PostgreSQL

```js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const db = {
  async query(text, params) {
    const client = await pool.connect();
    try {
      const res = await client.query(text, params);
      return { rows: res.rows, rowCount: res.rowCount };
    } finally {
      client.release();
    }
  },

  async get(text, params) { ... },
  async run(text, params) { ... },
  async all(text, params) { ... },
  
  pool // прямой доступ к pool
};

module.exports = db;
```

### 2. Обновлены модули

**routes/orders.js:**
```js
const db = require('../db'); // ← импорт db

module.exports = (authMiddleware) => { // ← убрали db из параметров
  // ...
};
```

**routes/ton.js:**
```js
const db = require('../db'); // ← импорт db

module.exports = (authMiddleware) => { // ← убрали db из параметров
  // ...
};
```

**services/tonPolling.js:**
```js
const db = require('../db'); // ← импорт db

module.exports = () => { // ← убрали db из параметров
  // ...
};
```

### 3. Обновлён `server.js`

**Было:**
```js
app.use('/api/orders', ordersRoutes(db, authMiddlewareWithDB));
app.use('/api/ton', tonRoutes(db, authMiddlewareWithDB));
tonPolling(db);
```

**Стало:**
```js
app.use('/api/orders', ordersRoutes(authMiddlewareWithDB));
app.use('/api/ton', tonRoutes(authMiddlewareWithDB));
tonPolling();
```

---

## 📊 Структура проекта

```
tg_magazin_bot/
├── db/
│   └── index.js           ✅ Универсальный адаптер PostgreSQL
├── routes/
│   ├── orders.js          ✅ Импортирует db из ../db
│   └── ton.js             ✅ Импортирует db из ../db
├── services/
│   └── tonPolling.js      ✅ Импортирует db из ../db
└── server.js              ✅ Использует db из ./db
```

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
💎 Запуск TON polling для проверки оплаты (каждые 10 секунд)
```

### 2. Проверь endpoints

**Создание заказа:**
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 8, "payment_method": "ton"}'
```

**Должно работать без ошибок!**

### 3. Проверь polling
```bash
# Создай заказ, оплати, жди 10 сек
# Логи:
[TON POLLING] Запуск проверки...
[TON POLLING] Проверяем 1 заказов: #114
✅ [TON POLLING] ОПЛАТА ЗАСЧИТАНА! Заказ #114
```

---

## 🎉 ИТОГ

**Исправлено:**
- ✅ Создан универсальный `db/index.js`
- ✅ Все модули импортируют `db` сами
- ✅ Убрана передача `db` в параметрах
- ✅ `db.query()` теперь работает везде

**Методы db:**
- ✅ `db.query(sql, params)` — возвращает `{ rows, rowCount }`
- ✅ `db.get(sql, params)` — возвращает первую строку
- ✅ `db.run(sql, params)` — для INSERT/UPDATE/DELETE
- ✅ `db.all(sql, params)` — возвращает все строки
- ✅ `db.pool` — прямой доступ к pool

**ГОТОВО К ДЕПЛОЮ!** 🚀💎

---

## 📝 Деплой

```bash
git add .
git commit -m "Fix: create db/index.js adapter, fix db.query errors"
git push
```

**ПРОВЕРЬ ЛОГИ НА RAILWAY!**
