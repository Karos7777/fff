-- Очистка старых TON заказов с amount = 0
-- Эти заказы были созданы до исправления PostgreSQL синтаксиса

-- 1. Удаляем старые инвойсы с нулевой суммой
DELETE FROM invoices 
WHERE (amount = 0 OR amount IS NULL) 
  AND currency = 'TON' 
  AND status = 'pending';

-- 2. Удаляем соответствующие заказы (опционально)
-- DELETE FROM orders 
-- WHERE id IN (94, 98, 100, 105, 107, 109, 111, 113)
--   AND status = 'pending';

-- 3. Проверяем результат
SELECT COUNT(*) as pending_ton_invoices 
FROM invoices 
WHERE status = 'pending' AND currency = 'TON';

-- 4. Показываем последние инвойсы
SELECT id, order_id, amount, currency, status, created_at 
FROM invoices 
ORDER BY id DESC 
LIMIT 10;
