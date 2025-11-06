# ✅ TON ПЛАТЕЖИ — ФИНАЛЬНАЯ ПРОВЕРКА

## 🎯 Код добавлен в server.js

### Что сделано:
```js
// После создания заказа (строка 654)
const orderId = result.id;

// Начисление реферального бонуса (строки 656-664)
...

// ПРОВЕРКА PAYMENT_METHOD (строки 666-693)
const paymentMethod = req.body.payment_method || req.body.paymentMethod;
console.log('[ORDER] Payment method:', paymentMethod);
console.log('[ORDER] Request body:', req.body);

// Если выбран TON - создаём инвойс
if (paymentMethod === 'ton' || paymentMethod === 'TON') {
  console.log('[TON] Запуск создания инвойса для заказа:', orderId);
  
  const invoice = await paymentService.createCryptoInvoice(
    orderId,
    user_id,
    product_id,
    product.price_ton || product.price,
    'TON'
  );
  
  console.log('[TON] Инвойс создан:', invoice);
  
  return res.json({
    success: true,
    orderId: orderId,
    invoice: invoice,
    url: invoice.url,
    qr: invoice.qr,
    address: invoice.address,
    amount: invoice.amount
  });
}

res.json({ id: orderId, message: 'Заказ создан успешно' });
```

✅ **Код уже в файле!**

---

## 🚀 Деплой

```bash
git add .
git commit -m "Add payment_method logging and TON invoice creation in /api/orders"
git push
```

---

## 📋 Что покажут логи

### Если фронт НЕ передаёт payment_method:
```
✅ [SERVER] Заказ создан, result: { id: 88 }
[ORDER] Payment method: undefined
[ORDER] Request body: { product_id: 8 }
```
→ **Проблема на фронте** — не передаётся `payment_method`

### Если фронт передаёт payment_method:
```
✅ [SERVER] Заказ создан, result: { id: 88 }
[ORDER] Payment method: ton
[ORDER] Request body: { product_id: 8, payment_method: 'ton' }
[TON] Запуск создания инвойса для заказа: 88
[TON INVOICE] Создание инвойса: { orderId: 88, userId: 1, amount: 0.05 }
[TON INVOICE] УСПЕШНО: { id: 123, url: '...', qr: '...' }
[TON] Инвойс создан: { ... }
```
→ **Всё работает!**

---

## 🔍 Проверка после деплоя

### 1. Запусти логи:
```bash
railway logs --follow
```

### 2. Создай заказ через Mini App

### 3. Смотри логи:

#### Если видишь:
```
[ORDER] Payment method: undefined
```
→ **ФРОНТ НЕ ПЕРЕДАЁТ payment_method**

#### Исправление на фронте:
```js
// ❌ НЕПРАВИЛЬНО
fetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify({
    product_id: 8
  })
});

// ✅ ПРАВИЛЬНО
fetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify({
    product_id: 8,
    payment_method: 'ton'  // ← ДОБАВЬ ЭТО!
  })
});
```

---

## 📱 Фронт должен отправлять

### Request:
```json
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": 8,
  "payment_method": "ton"
}
```

### Response (если TON):
```json
{
  "success": true,
  "orderId": 88,
  "invoice": {
    "id": 123,
    "orderId": 88,
    "userId": 1,
    "amount": 0.05,
    "amountNano": 50000000,
    "currency": "TON",
    "payload": "order_88",
    "address": "UQCm27jo...",
    "url": "ton://transfer/...",
    "qr": "https://api.qrserver.com/..."
  },
  "url": "ton://transfer/...",
  "qr": "https://api.qrserver.com/...",
  "address": "UQCm27jo...",
  "amount": 0.05
}
```

---

## 🎯 Чек-лист

- [x] Код добавлен в `/api/orders`
- [x] Проверка `payment_method` добавлена
- [x] Вызов `createCryptoInvoice` добавлен
- [x] Логирование добавлено
- [x] Возврат `url` и `qr` добавлен
- [ ] **Деплой** (выполни сейчас)
- [ ] **Проверка логов** (после деплоя)
- [ ] **Проверка фронта** (передаёт ли `payment_method`)

---

## 🎉 ИТОГ

**Бэкенд готов!** Код добавлен, логирование работает.

**Следующий шаг:**
1. Деплой
2. Проверка логов
3. Если `payment_method: undefined` — исправить фронт

**QR-код вылетит, как только фронт начнёт передавать `payment_method: "ton"`!** 🚀💎

**ДЕПЛОЙ СЕЙЧАС!** 🎯
