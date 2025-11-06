// TON Polling Service
// Автоматическая проверка оплаты TON транзакций каждые 10 секунд

const db = require('../db');

module.exports = () => {
  const address = process.env.TON_WALLET_ADDRESS?.trim();
  
  if (!address) {
    console.warn('⚠️  TON_WALLET_ADDRESS не задан - TON polling отключён');
    return;
  }
  
  console.log('💎 Запуск TON polling для проверки оплаты (каждые 10 секунд)');
  console.log('💎 Адрес кошелька:', address);
  
  setInterval(async () => {
    console.log('[TON POLLING] Запуск проверки...');
    
    try {
      // Получаем pending инвойсы (PostgreSQL)
      const pendingResult = await db.query(`
        SELECT i.id, i.order_id, i.amount, i.invoice_payload, o.id as orderId
        FROM invoices i
        JOIN orders o ON i.order_id = o.id
        WHERE i.status = $1 AND i.currency = $2
      `, ['pending', 'TON']);
      
      const pending = pendingResult.rows;

      if (!pending || pending.length === 0) {
        console.log('[TON POLLING] Нет ожидающих TON-заказов');
        return;
      }

      const orderIds = pending.map(p => `#${p.order_id}`).join(', ');
      console.log(`[TON POLLING] Проверяем ${pending.length} заказов: ${orderIds}`);

      // Динамический импорт fetch
      const fetch = (await import('node-fetch')).default;
      
      const url = `https://toncenter.com/api/v2/getTransactions?address=${address}&limit=10`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.ok || !data.result) {
        console.log('[TON POLLING] TON Center не вернул транзакции');
        return;
      }

      console.log(`[TON POLLING] Найдено ${data.result.length} транзакций`);

      // Логируем все входящие транзакции для отладки
      data.result.forEach((t, idx) => {
        if (t.in_msg && t.in_msg.value && parseInt(t.in_msg.value) > 0) {
          const amount = parseInt(t.in_msg.value) / 1e9;
          const dest = t.in_msg.destination || 'unknown';
          const msg = t.in_msg.message || '';
          console.log(`[TON POLLING] TX ${idx + 1}: ${amount.toFixed(9)} TON → ${dest.slice(0, 20)}... | msg: "${msg}"`);
        }
      });

      // Проверяем каждый pending инвойс
      for (const inv of pending) {
        const expected = parseFloat(inv.amount);
        const min = expected * 0.9;
        const payload = inv.invoice_payload || `order_${inv.order_id}`;

        console.log(`[TON POLLING] Ищем для заказа #${inv.order_id}: ожидается ${expected} TON (мин: ${min.toFixed(6)} TON) | payload: "${payload}"`);

        // Ищем входящую транзакцию с суммой >= min И правильным payload
        const tx = data.result.find(t => {
          if (!t.in_msg || !t.in_msg.value) return false;
          
          const txAmount = parseInt(t.in_msg.value) / 1e9;
          const txMessage = t.in_msg.message || '';
          const txDest = t.in_msg.destination || '';
          
          // Проверяем: сумма >= min И (адрес совпадает ИЛИ payload совпадает)
          const amountMatch = txAmount >= min;
          const addressMatch = txDest.includes(address.slice(0, 20)) || address.includes(txDest.slice(0, 20));
          const payloadMatch = txMessage === payload;
          
          return amountMatch && (addressMatch || payloadMatch);
        });

        if (tx) {
          const received = parseInt(tx.in_msg.value) / 1e9;
          const hash = tx.transaction_id?.hash || 'unknown';
          
          // PostgreSQL: используем query
          await db.query(`UPDATE invoices SET status = $1, transaction_hash = $2, paid_at = CURRENT_TIMESTAMP WHERE id = $3`, ['paid', hash, inv.id]);
          await db.query(`UPDATE orders SET status = $1 WHERE id = $2`, ['paid', inv.order_id]);

          console.log(`✅ [TON POLLING] ОПЛАТА ЗАСЧИТАНА! Заказ #${inv.order_id} | ${received.toFixed(6)} TON | hash: ${hash.slice(0, 16)}...`);
        } else {
          console.log(`   ❌ Транзакция не найдена (проверьте адрес и payload)`);
        }
      }
    } catch (err) {
      console.error('[TON POLLING] ❌ Ошибка:', err.message);
    }
  }, 10000); // каждые 10 секунд
  
  console.log('✅ TON Polling сервис запущен');
};
