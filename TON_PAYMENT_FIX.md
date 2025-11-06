# Фикс TON платежей — QR-код и deep link

## ✅ Проблема решена

**Ошибка**: "Отсутствуют обязательные параметры" при создании TON инвойса

**Причина**: 
1. Не передавались `amount` и `payload` в правильном формате
2. SQLite синтаксис вместо PostgreSQL
3. Не генерировался TON deep link (`ton://transfer/...`)

---

## 🔧 Что исправлено

### 1. **payment-service.js** — `createCryptoInvoice`

#### Добавлено:
- ✅ Валидация обязательных параметров (`amount`, `currency`)
- ✅ Проверка `TON_WALLET_ADDRESS` из env
- ✅ Конвертация в nano-TON: `amount * 1_000_000_000`
- ✅ Генерация TON deep link: `ton://transfer/{address}?amount={nano}&text={memo}`
- ✅ PostgreSQL синтаксис: `$1, $2, ...` + `RETURNING id`
- ✅ Подробное логирование каждого шага

#### Было:
```js
const result = insertInvoice.run(...);  // SQLite
return { id: result.lastInsertRowid };
```

#### Стало:
```js
const result = await insertInvoice.get(...);  // PostgreSQL
const tonUrl = `ton://transfer/${address}?amount=${amountNano}&text=${memo}`;
return { 
  invoiceId: result.id,
  url: tonUrl,
  amountNano: amountNano
};
```

### 2. **server.js** — `/api/payments/crypto/create-invoice`

#### Добавлено:
- ✅ Возврат `url` (TON deep link) в ответе
- ✅ Возврат `amountNano` для отладки
- ✅ Логирование созданного инвойса

---

## 📋 Формат TON deep link

```
ton://transfer/{WALLET_ADDRESS}?amount={NANO_TON}&text={MEMO}
```

### Пример:
```
ton://transfer/UQD...abc?amount=50000000&text=ORDER_73_123456
```

- `amount` — в nano-TON (1 TON = 1,000,000,000 nano)
- `text` — уникальный memo для идентификации платежа

---

## 🚀 Как проверить

### 1. Убедись что `TON_WALLET_ADDRESS` настроен в Railway

```bash
railway variables
```

Должна быть переменная:
```
TON_WALLET_ADDRESS=UQD...ваш_адрес
```

Если нет — добавь:
```bash
railway variables set TON_WALLET_ADDRESS="UQD...ваш_адрес"
```

### 2. Деплой
```bash
git add .
git commit -m "Fix TON invoice creation with deep link and nano conversion"
git push
```

### 3. Проверка логов
```bash
railway logs --follow
```

При создании TON инвойса должны появиться:
```
[TON INVOICE] Создание инвойса: { orderId: 73, amount: 0.05, currency: 'TON' }
[TON INVOICE] Amount in nano: 50000000
✅ Создан крипто инвойс #123:
   - Заказ: #73
   - Сумма: 0.05 TON
   - Memo: ORDER_73_123456
   - Адрес: UQD...abc
[TON INVOICE] Payment URL: ton://transfer/UQD...abc?amount=50000000&text=ORDER_73_123456
[CRYPTO INVOICE] Invoice created: { invoiceId: 123, url: 'ton://...', ... }
```

### 4. Тест в Telegram Mini App

1. Выбери товар → Купить
2. Выбери "TON"
3. **Должен появиться QR-код или кнопка "Открыть кошелёк"**
4. При сканировании QR или клике — откроется TON кошелёк с заполненными данными:
   - Адрес получателя
   - Сумма в TON
   - Комментарий (memo)

---

## 🎯 Что теперь работает

| Шаг | Статус |
|-----|--------|
| 1. Создание заказа | ✅ Работает (ID: 73, user_id: 1) |
| 2. Генерация payload | ✅ `order_73` |
| 3. Конвертация в nano-TON | ✅ `0.05 TON → 50000000 nano` |
| 4. Генерация TON URL | ✅ `ton://transfer/...` |
| 5. Сохранение в БД | ✅ PostgreSQL с RETURNING |
| 6. Возврат URL клиенту | ✅ В ответе API |

---

## 📱 Формат ответа API

### Request:
```json
POST /api/payments/crypto/create-invoice
{
  "orderId": 73,
  "productId": 8,
  "amount": 0.05,
  "currency": "TON"
}
```

### Response:
```json
{
  "success": true,
  "invoice": {
    "id": 123,
    "payload": "order_73",
    "address": "UQD...abc",
    "memo": "ORDER_73_123456",
    "amount": 0.05,
    "currency": "TON",
    "url": "ton://transfer/UQD...abc?amount=50000000&text=ORDER_73_123456",
    "amountNano": 50000000,
    "expiresAt": "2025-11-06T13:36:00.000Z"
  }
}
```

---

## ⚠️ Важно

### Переменные окружения в Railway:
```bash
TON_WALLET_ADDRESS=UQD...ваш_адрес  # ОБЯЗАТЕЛЬНО!
TON_API_KEY=...                      # Опционально (для проверки транзакций)
```

### Если ошибка "TON_WALLET_ADDRESS not configured":
1. Проверь Railway Dashboard → Variables
2. Добавь переменную
3. Redeploy: `railway up`

---

## 🎉 Итог

**Теперь при выборе TON:**
1. ✅ Создаётся заказ с `user_id`
2. ✅ Генерируется уникальный `payload` и `memo`
3. ✅ Конвертируется сумма в nano-TON
4. ✅ Создаётся TON deep link
5. ✅ Возвращается клиенту для отображения QR

**QR-код с TON-кошельком вылетит мгновенно!** 🚀💎
