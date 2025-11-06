// TON Polling Service
// Автоматическая проверка оплаты TON транзакций каждые 8 секунд
// ФИНАЛЬНАЯ ВЕРСИЯ: проверка по СУММЕ + PAYLOAD

const db = require('../db');

module.exports = () => {
  const address = process.env.TON_WALLET_ADDRESS?.trim();
  
  if (!address) {
    console.warn('⚠️  TON_WALLET_ADDRESS не задан - TON polling отключён');
    return;
  }
  
  console.log('💎 Запуск TON polling для проверки оплаты (каждые 8 секунд)');
  console.log('💎 Адрес кошелька:', address);
  
  // === АВТОПОДТВЕРЖДЕНИЕ ПО SUM + PAYLOAD ===
  setInterval(async () => {
    console.log('[TON POLLING] Запуск проверки...');

    try {
      const pendingResult = await db.query(
        `SELECT i.id, i.order_id, i.amount, i.invoice_payload, o.id AS orderId
         FROM invoices i
         JOIN orders o ON i.order_id = o.id
         WHERE i.status = 'pending' AND i.currency = 'TON'`
      );

      const pending = pendingResult.rows;

      if (!pending || pending.length === 0) {
        console.log('[TON POLLING] Нет ожидающих заказов');
        return;
      }

      const orderIds = pending.map(p => `#${p.order_id}`).join(', ');
      console.log(`[TON POLLING] Проверяем ${pending.length} заказов: ${orderIds}`);

      // Используем TON API v2 для более надёжного получения транзакций
      const url = `https://tonapi.io/v2/blockchain/accounts/${address}/transactions?limit=20`;
      const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      const res = await fetch(url);
      const data = await res.json();

      if (!data.transactions || data.transactions.length === 0) {
        console.log('[TON POLLING] Нет транзакций');
        return;
      }

      console.log(`[TON POLLING] Найдено ${data.transactions.length} транзакций`);

      // Логируем все входящие транзакции для отладки
      data.transactions.forEach((t, idx) => {
        if (t.in_msg && t.in_msg.value && parseInt(t.in_msg.value) > 0) {
          const amount = parseInt(t.in_msg.value) / 1e9;
          const dest = t.in_msg.destination?.address || 'unknown';
          const msg = t.in_msg.msg || t.in_msg.decoded_body?.text || '';
          console.log(`[TON POLLING] TX ${idx + 1}: ${amount.toFixed(9)} TON → ${dest.slice(0, 20)}... | msg: "${msg}"`);
        }
      });

      for (const inv of pending) {
        const expected = parseFloat(inv.amount);
        const payload = inv.invoice_payload; // "ABC123"
        const minAmount = expected * 0.9;

        console.log(`[TON POLLING] Ищем для заказа #${inv.order_id}: payload: "${payload}" | сумма >= ${minAmount.toFixed(9)} TON`);

        const tx = data.transactions.find(t => {
          if (!t.in_msg || !t.in_msg.value) return false;
          
          const txAmount = parseInt(t.in_msg.value) / 1e9;
          const txDest = t.in_msg.destination?.address || '';
          const txMessage = t.in_msg.msg || t.in_msg.decoded_body?.text || '';
          
          // Проверяем payload и сумму (адрес не проверяем, т.к. форматы разные)
          const payloadMatch = txMessage === payload;
          const amountMatch = txAmount >= minAmount;
          
          // Детальное логирование для отладки
          if (payloadMatch && amountMatch) {
            console.log(`   ✅ НАЙДЕНО! payload: "${txMessage}" | сумма: ${txAmount.toFixed(9)} TON | адрес: ${txDest.slice(0, 30)}...`);
          }
          
          return payloadMatch && amountMatch;
        });

        if (tx) {
          const receivedAmount = parseInt(tx.in_msg.value) / 1e9;
          const hash = tx.hash || 'unknown';
          
          await db.run(`UPDATE invoices SET status = 'paid', transaction_hash = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2`, [hash, inv.id]);
          await db.run(`UPDATE orders SET status = 'paid' WHERE id = $1`, [inv.order_id]);

          console.log(`✅ [TON POLLING] ОПЛАТА ЗАСЧИТАНА! Заказ #${inv.order_id} | payload: "${payload}" | сумма: ${receivedAmount.toFixed(9)} TON | hash: ${hash.slice(0, 16)}...`);
        } else {
          console.log(`   ❌ Транзакция не найдена (проверьте payload: "${payload}")`);
        }
      }
    } catch (err) {
      console.error('[TON POLLING] ❌ Ошибка:', err.message);
      console.error('[TON POLLING] Stack:', err.stack);
    }
  }, 8000); // каждые 8 секунд
  
  console.log('✅ TON Polling сервис запущен');
};
