const db = require('../db-postgres');

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
        `SELECT i.id, i.order_id, i.amount, o.invoice_payload, o.id AS orderId
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
        let payload = inv.invoice_payload;
        const minAmount = expected * 0.9;

        // Если payload null, генерируем его на основе ID заказа (fallback для старых заказов)
        if (!payload || payload === 'null' || payload === null) {
          payload = `order_${inv.order_id}`;
          console.log(`🔄 [TON POLLING] Используем fallback payload для заказа #${inv.order_id}: "${payload}"`);
        }

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
          
          // Обновляем статус инвойса
          await db.query(`UPDATE invoices SET status = 'paid', transaction_hash = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2`, [hash, inv.id]);
          
          // Обновляем статус заказа на 'completed' (не 'paid')
          await db.query(`UPDATE orders SET status = 'completed', paid_at = CURRENT_TIMESTAMP WHERE id = $1`, [inv.order_id]);

          console.log(`✅ [TON POLLING] ОПЛАТА ЗАСЧИТАНА! Заказ #${inv.order_id} | payload: "${payload}" | сумма: ${receivedAmount.toFixed(9)} TON | hash: ${hash.slice(0, 16)}...`);
          
          // 🎁 АВТОМАТИЧЕСКАЯ ВЫДАЧА ТОВАРА
          try {
            // Получаем информацию о заказе и товаре
            const orderInfo = await db.query(`
              SELECT o.*, p.name as product_name, p.file_url, p.description, u.telegram_id, u.username
              FROM orders o
              JOIN products p ON o.product_id = p.id
              JOIN users u ON o.user_id = u.id
              WHERE o.id = $1
            `, [inv.order_id]);
            
            if (orderInfo.rows.length > 0) {
              const order = orderInfo.rows[0];
              console.log(`🎁 [TON POLLING] Автоматическая выдача товара для заказа #${inv.order_id}`);
              console.log(`   📦 Товар: ${order.product_name}`);
              console.log(`   👤 Пользователь: ${order.username} (ID: ${order.telegram_id})`);
              
              if (order.file_url) {
                console.log(`   📁 Файл доступен: ${order.file_url}`);
                // Здесь можно отправить уведомление пользователю через Telegram Bot API
                // если у вас настроен BOT_TOKEN
              } else {
                console.log(`   ℹ️  Товар без файла (услуга)`);
              }
            }
          } catch (deliveryError) {
            console.error(`❌ [TON POLLING] Ошибка при выдаче товара:`, deliveryError.message);
          }
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
