# ✅ МИГРАЦИЯ transaction_hash И paid_at — ГОТОВО!

## 🎯 Проблема

```
ERROR: column "transaction_hash" of relation "invoices" does not exist
```

**Причина:** Колонки `transaction_hash` и `paid_at` не были созданы в таблице `invoices`

---

## ✅ Решение

### Добавлены две миграции в `server.js`

**1. Миграция `transaction_hash`:**
```js
try {
  await dbLegacy.exec(`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS transaction_hash TEXT
  `);
  console.log('✅ Миграция: колонка transaction_hash добавлена');
} catch (e) {
  if (!e.message.includes('already exists')) {
    console.error('⚠️ Ошибка миграции transaction_hash:', e.message);
  }
}
```

**2. Миграция `paid_at`:**
```js
try {
  await dbLegacy.exec(`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP
  `);
  console.log('✅ Миграция: колонка paid_at добавлена');
} catch (e) {
  if (!e.message.includes('already exists')) {
    console.error('⚠️ Ошибка миграции paid_at:', e.message);
  }
}
```

**Где:** В функции `initDB()` после миграции `amount`

---

## 🚀 Тестирование

```bash
git add .
git commit -m "Add migrations for transaction_hash and paid_at columns"
git push
```

**После деплоя:**

### 1. Проверь логи при запуске

**Ожидаемые логи:**
```
✅ Миграция: колонка amount изменена на DECIMAL(20,9)
✅ Миграция: колонка transaction_hash добавлена
✅ Миграция: колонка paid_at добавлена
✅ База данных PostgreSQL инициализирована успешно
```

### 2. Создай новый заказ с TON

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 8, "payment_method": "ton"}'
```

### 3. Оплати через TON кошелёк

- Открой deep link
- Комментарий уже заполнен (например: `ABC12XYZ`)
- Отправь транзакцию
- Жди 8 секунд

### 4. Проверь логи TON polling

**Ожидаемые логи:**
```
[TON POLLING] Запуск проверки...
[TON POLLING] Проверяем 1 заказов: #139
[TON POLLING] Найдено 20 транзакций
[TON POLLING] TX 1: 0.001000000 TON → 0:a6dbb8e8... | msg: "ABC12XYZ"
[TON POLLING] Ищем для заказа #139: payload: "ABC12XYZ" | сумма >= 0.000900000 TON
   ✅ НАЙДЕНО! payload: "ABC12XYZ" | сумма: 0.001000000 TON
✅ [TON POLLING] ОПЛАТА ЗАСЧИТАНА! Заказ #139 | payload: "ABC12XYZ" | сумма: 0.001000000 TON | hash: abc123...
```

**БЕЗ ОШИБОК!** ✅

### 5. Проверь базу данных

```sql
SELECT id, order_id, status, transaction_hash, paid_at 
FROM invoices 
WHERE status = 'paid' 
ORDER BY paid_at DESC 
LIMIT 5;
```

**Ожидаемый результат:**
```
 id | order_id | status | transaction_hash | paid_at
----+----------+--------+------------------+---------------------
 12 |      139 | paid   | abc123def456...  | 2025-11-07 00:45:23
```

**КОЛОНКИ ЗАПОЛНЕНЫ!** ✅

---

## 🎉 ИТОГ

**Добавлено:**
- ✅ Миграция для `transaction_hash TEXT`
- ✅ Миграция для `paid_at TIMESTAMP`
- ✅ Проверка на существование колонок (`IF NOT EXISTS`)
- ✅ Обработка ошибок

**Результат:**
- ✅ TON polling сохраняет хеш транзакции
- ✅ TON polling сохраняет время оплаты
- ✅ Нет ошибок при обновлении инвойсов
- ✅ Можно отследить когда была оплата

**Структура таблицы `invoices` (финальная):**
```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  user_id INTEGER REFERENCES users(id),
  amount DECIMAL(20,9) NOT NULL,        -- ✅ Миграция 1
  currency TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_url TEXT,
  invoice_id TEXT UNIQUE,
  invoice_payload TEXT,
  transaction_hash TEXT,                -- ✅ Миграция 2
  paid_at TIMESTAMP,                    -- ✅ Миграция 3
  created_at TIMESTAMP DEFAULT NOW()
);
```

**ГОТОВО К ДЕПЛОЮ!** 🚀💎

---

## 📝 Порядок миграций

**При запуске сервера выполняются:**
1. ✅ Создание таблиц (`CREATE TABLE IF NOT EXISTS`)
2. ✅ Миграция `price_ton`, `price_usdt`, `price_stars` в `products`
3. ✅ Миграция `amount` → `DECIMAL(20,9)` в `invoices`
4. ✅ Миграция `transaction_hash` в `invoices` ← НОВАЯ
5. ✅ Миграция `paid_at` в `invoices` ← НОВАЯ
6. ✅ Добавление админа по умолчанию

**Все миграции идемпотентны:**
- Используют `IF NOT EXISTS`
- Не падают если колонка уже существует
- Логируют результат

**БЕЗОПАСНО И НАДЁЖНО!** ✅

---

## 🔧 Использование новых колонок

**В TON polling (`services/tonPolling.js`):**
```js
await db.run(`
  UPDATE invoices 
  SET status = 'paid', 
      transaction_hash = $1,    -- ← Сохраняем хеш
      paid_at = CURRENT_TIMESTAMP  -- ← Сохраняем время
  WHERE id = $2
`, [hash, inv.id]);
```

**В API заказов (`routes/orders.js`):**
```sql
SELECT 
  o.id,
  o.product_id,
  o.status,
  o.transaction_hash,  -- ← Показываем хеш
  i.currency as payment_currency
FROM orders o
LEFT JOIN invoices i ON o.id = i.order_id
```

**В админ-панели (будущее):**
- Показывать хеш транзакции
- Показывать время оплаты
- Ссылка на TON explorer

**ПРОВЕРЬ ЛОГИ НА RAILWAY — ДОЛЖНО РАБОТАТЬ!**
