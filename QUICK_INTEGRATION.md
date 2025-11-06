# ⚡ БЫСТРАЯ ИНТЕГРАЦИЯ МОДУЛЕЙ — 5 МИНУТ

## 🎯 Что добавить в server.js

### 1. В начало файла (после require)

```js
// === МОДУЛЬНЫЕ РОУТЫ ===
const ordersRoutes = require('./routes/orders');
const tonRoutes = require('./routes/ton');
const tonPolling = require('./services/tonPolling');
```

### 2. После инициализации paymentService

```js
// Сохраняем paymentService для доступа из роутов
app.set('paymentService', paymentService);

// Подключаем модульные роуты
app.use('/api/orders', ordersRoutes(db, authMiddlewareWithDB));
app.use('/api/ton', tonRoutes(db, authMiddlewareWithDB));
```

### 3. В app.listen (после console.log)

```js
app.listen(targetPort, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${targetPort}`);
  
  // Запускаем TON polling
  tonPolling(db);
  
  // ... остальной код
});
```

---

## 🗑️ Что закомментировать в server.js

Найди и закомментируй (добавь `/*` в начало и `*/` в конец):

### 1. Старые роуты заказов
```js
/*
app.post('/api/orders', authMiddlewareWithDB, async (req, res) => {
  // ... весь код
});

app.get('/api/orders', authMiddlewareWithDB, async (req, res) => {
  // ... весь код
});

app.delete('/api/orders/:id', authMiddlewareWithDB, async (req, res) => {
  // ... весь код
});

app.get('/api/orders/:orderId/download', async (req, res) => {
  // ... весь код
});
*/
```

### 2. Старые роуты TON
```js
/*
app.get('/api/ton/check/:orderId', authMiddlewareWithDB, async (req, res) => {
  // ... весь код
});

app.post('/api/ton/check-payment', authMiddlewareWithDB, async (req, res) => {
  // ... весь код
});
*/
```

### 3. Старый TON polling
```js
/*
// === НАДЁЖНЫЙ TON POLLING (каждые 10 секунд) ===
if (!process.env.TON_WALLET_ADDRESS) {
  // ... весь блок setInterval
}
*/
```

---

## ✅ Проверка

### 1. Запусти сервер
```bash
npm start
```

### 2. Проверь логи
Должно быть:
```
✅ TON Polling сервис запущен
💎 Запуск TON polling для проверки оплаты (каждые 10 секунд)
[TON POLLING] Запуск проверки...
```

### 3. Протестируй endpoints
```bash
# Создание заказа
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer <token>" \
  -d '{"product_id": 8, "payment_method": "ton"}'

# Проверка TON
curl http://localhost:8080/api/ton/check/114 \
  -H "Authorization: Bearer <token>"
```

---

## 🚀 Деплой

```bash
git add routes/ services/
git commit -m "Refactor: split server.js into modules"
git push
```

---

## 🐛 Если что-то не работает

### Ошибка: Cannot find module './routes/orders'
**Решение:** Проверь, что папки `routes/` и `services/` созданы

### Ошибка: paymentService is not defined
**Решение:** Добавь `app.set('paymentService', paymentService)` перед роутами

### Ошибка: db.query is not a function
**Решение:** Убедись, что передаёшь правильный `db` объект в модули

---

## 🎉 ГОТОВО!

**Структура проекта:**
```
✅ routes/orders.js    — заказы
✅ routes/ton.js       — TON проверка
✅ services/tonPolling.js — автоматическая проверка
✅ server.js           — главный файл (короче на 500+ строк!)
```

**ИНТЕГРИРУЙ И ДЕПЛОЙ!** 🚀📦
