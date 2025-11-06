const express = require('express');
const router = express.Router();
const db = require('../db');

module.exports = (authMiddleware) => {
  // Быстрая проверка статуса заказа (GET для фронта)
  router.get('/check/:orderId', authMiddleware, async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;
      
      console.log('[TON CHECK GET] Проверка статуса заказа:', { orderId, userId });
      
      // Проверяем статус заказа и инвойса
      const result = await db.query(`
        SELECT i.status as invoice_status, o.status as order_status 
        FROM invoices i 
        JOIN orders o ON i.order_id = o.id 
        WHERE o.id = $1 AND o.user_id = $2
      `, [orderId, userId]);
      
      const status = result.rows[0];
      
      if (!status) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }
      
      const isPaid = status.invoice_status === 'paid' || status.order_status === 'paid';
      
      console.log('[TON CHECK GET] Статус:', { orderId, isPaid, ...status });
      
      res.json({ 
        paid: isPaid,
        invoice_status: status.invoice_status,
        order_status: status.order_status
      });
      
    } catch (error) {
      console.error('[TON CHECK GET] ❌ Ошибка:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // Проверка TON платежей через API (POST)
  router.post('/check-payment', authMiddleware, async (req, res) => {
    try {
      const { orderId } = req.body;
      const userId = req.user.id;
      
      console.log('[TON CHECK] Проверка оплаты заказа:', orderId);
      
      // Найти инвойс
      const invoiceResult = await db.query(`
        SELECT i.*, o.user_id 
        FROM invoices i 
        JOIN orders o ON i.order_id = o.id 
        WHERE i.order_id = $1 AND o.user_id = $2 AND i.status = $3
      `, [orderId, userId, 'pending']);
      
      const invoice = invoiceResult.rows[0];
      
      if (!invoice) {
        return res.json({ paid: false, message: 'Инвойс не найден или уже оплачен' });
      }
      
      // Проверяем транзакции через TON API
      const axios = require('axios');
      const walletAddress = process.env.TON_WALLET_ADDRESS.trim();
      const payload = invoice.invoice_payload;
      
      console.log('[TON CHECK] Проверка транзакций для:', { walletAddress, payload });
      
      try {
        const response = await axios.get(`https://toncenter.com/api/v2/getTransactions`, {
          params: {
            address: walletAddress,
            limit: 20
          }
        });
        
        const transactions = response.data.result || [];
        console.log('[TON CHECK] Найдено транзакций:', transactions.length);
        
        // Ищем транзакцию с нашим payload
        for (const tx of transactions) {
          const inMsg = tx.in_msg;
          if (!inMsg || !inMsg.message) continue;
          
          const comment = inMsg.message;
          const value = parseInt(inMsg.value) || 0;
          
          console.log('[TON CHECK] Транзакция:', { comment, value });
          
          if (comment === payload) {
            const expectedNano = Math.round(invoice.amount * 1_000_000_000);
            
            if (value >= expectedNano * 0.99) {
              // Оплата найдена!
              await db.query('UPDATE invoices SET status = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2', ['paid', invoice.id]);
              await db.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', invoice.order_id]);
              
              console.log('[TON CHECK] ✅ ОПЛАТА ПОДТВЕРЖДЕНА:', { orderId, invoiceId: invoice.id });
              
              return res.json({ 
                paid: true, 
                message: 'Оплата подтверждена!',
                orderId: invoice.order_id 
              });
            }
          }
        }
        
        return res.json({ paid: false, message: 'Оплата пока не найдена' });
        
      } catch (apiError) {
        console.error('[TON CHECK] Ошибка TON API:', apiError.message);
        return res.json({ paid: false, message: 'Ошибка проверки, попробуйте позже' });
      }
      
    } catch (error) {
      console.error('[TON CHECK] ❌ Ошибка:', error);
      res.status(500).json({ error: 'Server error', details: error.message });
    }
  });
  
  return router;
};
