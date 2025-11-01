# 🔗 Примеры API запросов для системы платежей

## 🔑 Аутентификация

Все защищенные endpoints требуют JWT токен в заголовке:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📦 Создание заказа

```bash
curl -X POST http://localhost:10000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "product_id": 1
  }'
```

**Ответ:**
```json
{
  "id": 123,
  "message": "Заказ создан успешно"
}
```

## ⭐ Telegram Stars

### Создание Stars инвойса

```bash
curl -X POST http://localhost:10000/api/payments/stars/create-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "orderId": 123,
    "productId": 1,
    "amount": 100,
    "description": "Консультация по разработке"
  }'
```

**Ответ:**
```json
{
  "success": true,
  "invoice": {
    "id": 456,
    "payload": "abc123def456",
    "telegramInvoice": {
      "title": "Консультация по разработке",
      "description": "Оплата заказа #123",
      "payload": "abc123def456",
      "provider_token": "",
      "currency": "XTR",
      "prices": [
        {
          "label": "Консультация по разработке",
          "amount": 100
        }
      ]
    },
    "expiresAt": "2024-01-01T12:30:00.000Z"
  }
}
```

### Webhook для pre_checkout_query

```bash
curl -X POST http://localhost:10000/api/payments/stars/pre-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "pre_checkout_query": {
      "id": "query123",
      "from": {
        "id": 123456789,
        "first_name": "John"
      },
      "currency": "XTR",
      "total_amount": 100,
      "invoice_payload": "abc123def456"
    }
  }'
```

### Webhook для successful_payment

```bash
curl -X POST http://localhost:10000/api/payments/stars/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "successful_payment": {
        "currency": "XTR",
        "total_amount": 100,
        "invoice_payload": "abc123def456",
        "telegram_payment_charge_id": "tg_charge_123",
        "provider_payment_charge_id": "provider_charge_456"
      }
    }
  }'
```

## 💎 Криптовалюты

### Создание TON инвойса

```bash
curl -X POST http://localhost:10000/api/payments/crypto/create-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "orderId": 123,
    "productId": 1,
    "amount": 1.5,
    "currency": "TON"
  }'
```

**Ответ:**
```json
{
  "success": true,
  "invoice": {
    "id": 789,
    "payload": "crypto_abc123",
    "address": "EQC5s7ZKc8NvVPHjJQqGvdwdw8V8V8V8V8V8V8V8V8V8V8V8",
    "memo": "ORDER_123_crypto_ab",
    "amount": 1.5,
    "currency": "TON",
    "expiresAt": "2024-01-01T12:30:00.000Z"
  }
}
```

### Создание USDT инвойса

```bash
curl -X POST http://localhost:10000/api/payments/crypto/create-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "orderId": 123,
    "productId": 1,
    "amount": 50.0,
    "currency": "USDT"
  }'
```

### Ручная проверка криптоплатежей (только для админов)

```bash
curl -X POST http://localhost:10000/api/payments/crypto/check \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

**Ответ:**
```json
{
  "success": true,
  "message": "Проверка криптоплатежей выполнена"
}
```

## 📊 Проверка статуса

### Статус платежа по payload

```bash
curl -X GET http://localhost:10000/api/payments/status/abc123def456 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Ответы:**

**Ожидание оплаты:**
```json
{
  "success": true,
  "invoice": {
    "id": 456,
    "status": "pending",
    "amount": 100,
    "currency": "XTR",
    "paymentMethod": "stars",
    "createdAt": "2024-01-01T12:00:00.000Z",
    "expiresAt": "2024-01-01T12:30:00.000Z",
    "orderStatus": "pending"
  }
}
```

**Успешная оплата:**
```json
{
  "success": true,
  "invoice": {
    "id": 456,
    "status": "paid",
    "amount": 100,
    "currency": "XTR",
    "paymentMethod": "stars",
    "txHash": null,
    "confirmations": 0,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "paidAt": "2024-01-01T12:15:00.000Z",
    "expiresAt": "2024-01-01T12:30:00.000Z",
    "orderStatus": "paid"
  }
}
```

**Криптоплатеж:**
```json
{
  "success": true,
  "invoice": {
    "id": 789,
    "status": "paid",
    "amount": 1.5,
    "currency": "TON",
    "paymentMethod": "crypto",
    "txHash": "abc123def456ghi789",
    "confirmations": 3,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "paidAt": "2024-01-01T12:20:00.000Z",
    "orderStatus": "paid"
  }
}
```

## 📜 История платежей

```bash
curl -X GET http://localhost:10000/api/payments/history \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Ответ:**
```json
{
  "success": true,
  "payments": [
    {
      "id": 456,
      "orderId": 123,
      "productName": "Консультация по разработке",
      "amount": 100,
      "currency": "XTR",
      "status": "paid",
      "paymentMethod": "stars",
      "txHash": null,
      "createdAt": "2024-01-01T12:00:00.000Z",
      "paidAt": "2024-01-01T12:15:00.000Z"
    },
    {
      "id": 789,
      "orderId": 124,
      "productName": "Разработка сайта",
      "amount": 1.5,
      "currency": "TON",
      "status": "paid",
      "paymentMethod": "crypto",
      "txHash": "abc123def456ghi789",
      "createdAt": "2024-01-01T11:00:00.000Z",
      "paidAt": "2024-01-01T11:20:00.000Z"
    }
  ]
}
```

## ❌ Примеры ошибок

### Неверные параметры

```bash
curl -X POST http://localhost:10000/api/payments/stars/create-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "orderId": 123
  }'
```

**Ответ:**
```json
{
  "error": "Отсутствуют обязательные параметры"
}
```

### Заказ не найден

```bash
curl -X POST http://localhost:10000/api/payments/stars/create-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "orderId": 999,
    "productId": 1,
    "amount": 100,
    "description": "Test"
  }'
```

**Ответ:**
```json
{
  "error": "Заказ не найден"
}
```

### Неподдерживаемая валюта

```bash
curl -X POST http://localhost:10000/api/payments/crypto/create-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "orderId": 123,
    "productId": 1,
    "amount": 100,
    "currency": "BTC"
  }'
```

**Ответ:**
```json
{
  "error": "Неподдерживаемая валюта"
}
```

### Нет доступа

```bash
curl -X GET http://localhost:10000/api/payments/status/abc123def456 \
  -H "Authorization: Bearer WRONG_TOKEN"
```

**Ответ:**
```json
{
  "error": "Нет доступа к этому инвойсу"
}
```

## 🧪 Тестовые сценарии

### 1. Полный цикл Stars платежа

```bash
# 1. Создать заказ
ORDER_RESPONSE=$(curl -s -X POST http://localhost:10000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"product_id": 1}')

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.id')

# 2. Создать Stars инвойс
INVOICE_RESPONSE=$(curl -s -X POST http://localhost:10000/api/payments/stars/create-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"orderId\": $ORDER_ID,
    \"productId\": 1,
    \"amount\": 100,
    \"description\": \"Test payment\"
  }")

PAYLOAD=$(echo $INVOICE_RESPONSE | jq -r '.invoice.payload')

# 3. Проверить статус
curl -X GET http://localhost:10000/api/payments/status/$PAYLOAD \
  -H "Authorization: Bearer $JWT_TOKEN"

# 4. Симулировать успешный платеж
curl -X POST http://localhost:10000/api/payments/stars/webhook \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"successful_payment\": {
        \"currency\": \"XTR\",
        \"total_amount\": 100,
        \"invoice_payload\": \"$PAYLOAD\",
        \"telegram_payment_charge_id\": \"test_charge_123\",
        \"provider_payment_charge_id\": \"test_provider_456\"
      }
    }
  }"

# 5. Проверить обновленный статус
curl -X GET http://localhost:10000/api/payments/status/$PAYLOAD \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 2. Тестирование криптоплатежа

```bash
# 1. Создать заказ
ORDER_ID=123

# 2. Создать TON инвойс
CRYPTO_RESPONSE=$(curl -s -X POST http://localhost:10000/api/payments/crypto/create-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"orderId\": $ORDER_ID,
    \"productId\": 1,
    \"amount\": 1.5,
    \"currency\": \"TON\"
  }")

echo "Crypto invoice created:"
echo $CRYPTO_RESPONSE | jq '.'

# 3. Получить данные для оплаты
ADDRESS=$(echo $CRYPTO_RESPONSE | jq -r '.invoice.address')
MEMO=$(echo $CRYPTO_RESPONSE | jq -r '.invoice.memo')
AMOUNT=$(echo $CRYPTO_RESPONSE | jq -r '.invoice.amount')

echo "Payment details:"
echo "Address: $ADDRESS"
echo "Memo: $MEMO"
echo "Amount: $AMOUNT TON"

# 4. Ручная проверка (для админов)
curl -X POST http://localhost:10000/api/payments/crypto/check \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN"
```

## 🔧 Отладка

### Проверка health check

```bash
curl http://localhost:10000/healthz
```

### Проверка подключения к TON API

```bash
curl -H "Authorization: Bearer YOUR_TON_API_KEY" \
  "https://tonapi.io/v2/accounts/EQC5s7ZKc8NvVPHjJQqGvdwdw8V8V8V8V8V8V8V8V8V8V8V8"
```

### Логи сервера

```bash
# Запуск с детальными логами
DEBUG=payment* npm start
```

## 📱 Telegram Mini App

### Инициализация WebApp

```javascript
// В браузере
if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  
  // Получить данные пользователя
  const user = window.Telegram.WebApp.initDataUnsafe.user;
  console.log('User:', user);
}
```

### Отправка Stars инвойса

```javascript
// После создания инвойса через API
const invoice = {
  title: "Test Product",
  description: "Test Description", 
  payload: "test_payload_123",
  provider_token: "",
  currency: "XTR",
  prices: [{ label: "Test", amount: 100 }]
};

// Отправка через бота
fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: user.id,
    ...invoice
  })
});
```
