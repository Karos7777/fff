const express = require('express');
const router = express.Router();
const db = require('../db');

module.exports = (authMiddleware) => {
  // Создание заказа
  router.post('/', authMiddleware, async (req, res) => {
    try {
      console.log('📦 [ORDER CREATE] Данные заказа:', req.body);
      
      const { product_id, quantity = 1, payment_method } = req.body;
      const user_id = req.user.id;
      
      // ВАЛИДАЦИЯ ДАННЫХ
      if (!product_id) {
        return res.status(400).json({ error: 'Product ID is required' });
      }
      
      if (!user_id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      console.log('[ORDER] Создание заказа:', { user_id, product_id, quantity, payment_method });
      
      // Проверяем существование товара
      const productResult = await db.query(
        'SELECT * FROM products WHERE id = $1 AND is_active = true',
        [product_id]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found or inactive' });
      }
      
      const product = productResult.rows[0];
      
      // Определяем сумму заказа в зависимости от способа оплаты
      let amount = 0;
      if (payment_method === 'ton' || payment_method === 'TON') {
        amount = product.price_ton || product.price || 0;
      } else if (payment_method === 'usdt' || payment_method === 'USDT') {
        amount = product.price_usdt || product.price || 0;
      } else if (payment_method === 'stars') {
        amount = product.price_stars || 100;
      } else {
        amount = product.price || 0;
      }
      
      // ГЕНЕРИРУЕМ УНИКАЛЬНЫЙ PAYLOAD
      const invoicePayload = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Создаём заказ с полными данными включая payload
      const insertResult = await db.query(
        `INSERT INTO orders (user_id, product_id, quantity, total_amount, status, payment_method, invoice_payload, created_at) 
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW()) RETURNING *`,
        [user_id, product_id, quantity, amount, payment_method || 'ton', invoicePayload]
      );
      const order = insertResult.rows[0];
      
      console.log('✅ [ORDER CREATE] Заказ создан:', order.id, 'Payload:', invoicePayload);
      
      // Обрабатываем создание инвойса в зависимости от способа оплаты
      if (payment_method === 'ton' || payment_method === 'TON') {
        // Создаём TON инвойс
        const paymentService = req.app.get('paymentService');
        const invoice = await paymentService.createCryptoInvoice(
          order.id,
          user_id,
          product_id,
          product.price_ton || product.price,
          'TON'
        );
        
        console.log('[ORDER] TON инвойс создан:', invoice.id);
        
        return res.json({
          success: true,
          orderId: order.id,
          invoice: invoice,
          url: invoice.url,
          qr: invoice.qr,
          address: invoice.address,
          amount: invoice.amount
        });
      }
      
      // Для других способов оплаты просто возвращаем заказ
      res.json({ 
        success: true,
        order: order,
        id: order.id,
        invoice_payload: invoicePayload, // Отправляем payload на фронтенд
        message: 'Заказ создан успешно' 
      });
      
    } catch (error) {
      console.error('❌ [ORDER CREATE] Ошибка:', error);
      res.status(500).json({ 
        error: 'Ошибка создания заказа',
        details: error.message 
      });
    }
  });
  
  // Получение заказов пользователя
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Сначала удаляем истёкшие заказы (старше 1 часа)
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      await db.query(`
        DELETE FROM invoices WHERE order_id IN (
          SELECT id FROM orders 
          WHERE user_id = $1 
          AND status IN ('pending', 'pending_crypto') 
          AND created_at < $2
        )
      `, [userId, hourAgo.toISOString()]);
      
      await db.query(`
        DELETE FROM orders 
        WHERE user_id = $1 
        AND status IN ('pending', 'pending_crypto') 
        AND created_at < $2
      `, [userId, hourAgo.toISOString()]);
      
      // Получаем актуальные заказы
      const result = await db.query(`
        SELECT 
          o.id,
          o.product_id,
          o.status,
          o.created_at,
          o.payment_method,
          o.transaction_hash,
          p.name as product_name,
          p.price,
          p.price_ton,
          p.image_url,
          p.file_path,
          COALESCE(i.currency, 
            CASE 
              WHEN o.payment_method = 'ton' THEN 'TON'
              WHEN o.payment_method = 'usdt' THEN 'USDT'
              WHEN o.payment_method = 'stars' THEN 'Stars'
              WHEN i.currency = 'XTR' THEN 'Stars'
              WHEN i.currency = 'TON' THEN 'TON'
              WHEN i.currency = 'USDT' THEN 'USDT'
              ELSE 'USD'
            END
          ) as payment_currency,
          CASE WHEN r.id IS NOT NULL THEN true ELSE false END as has_review
        FROM orders o
        JOIN products p ON o.product_id = p.id
        LEFT JOIN invoices i ON o.id = i.order_id
        LEFT JOIN reviews r ON o.product_id = r.product_id AND o.user_id = r.user_id
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC
      `, [userId]);
      
      res.json(result.rows);
      
    } catch (error) {
      console.error('[ORDER] Ошибка получения заказов:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
  
  // Проверка статуса заказа (для автообновления на клиенте)
  router.get('/:id/status', authMiddleware, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const userId = req.user.id;

      const result = await db.query(`
        SELECT o.status, o.id, i.status as invoice_status
        FROM orders o
        LEFT JOIN invoices i ON o.id = i.order_id
        WHERE o.id = $1 AND o.user_id = $2
      `, [orderId, userId]);

      const order = result.rows[0];

      if (!order) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      const paid = order.status === 'paid' || order.invoice_status === 'paid';

      res.json({ 
        paid,
        status: order.status,
        invoice_status: order.invoice_status
      });

    } catch (error) {
      console.error('[ORDER STATUS] Ошибка:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  // Удаление заказа
  router.delete('/:id', authMiddleware, async (req, res) => {
    const orderId = parseInt(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`🗑️ [ORDER DELETE] Запрос на удаление заказа #${orderId} от пользователя ${userId}`);

    try {
      // Проверяем, что заказ принадлежит пользователю
      const orderResult = await db.query('SELECT id, status FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
      const order = orderResult.rows[0];
      
      if (!order) {
        console.log('❌ [ORDER DELETE] Заказ не найден или не принадлежит пользователю');
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      // Нельзя удалять оплаченные заказы
      if (order.status === 'paid') {
        console.log('❌ [ORDER DELETE] Попытка удалить оплаченный заказ');
        return res.status(403).json({ error: 'Нельзя удалить оплаченный заказ' });
      }

      console.log(`🗑️ [ORDER DELETE] Удаление заказа #${orderId} со статусом: ${order.status}`);

      // Удаляем связанные данные
      await db.query('DELETE FROM reviews WHERE order_id = $1', [orderId]);
      await db.query('DELETE FROM invoices WHERE order_id = $1', [orderId]);
      await db.query('DELETE FROM orders WHERE id = $1', [orderId]);

      console.log(`✅ [ORDER DELETE] Заказ #${orderId} успешно удалён`);
      res.json({ success: true });
      
    } catch (error) {
      console.error('❌ [ORDER DELETE] Ошибка:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
  
  // Скачивание файла товара
  router.get('/:orderId/download', async (req, res) => {
    try {
      const { orderId } = req.params;
      
      // Поддержка токена в query параметре
      let token = req.headers.authorization?.substring(7);
      if (!token && req.query.token) {
        token = req.query.token;
      }
      
      if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
      }
      
      // Проверяем токен
      const jwt = require('jsonwebtoken');
      let userId;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        return res.status(401).json({ error: 'Неверный токен' });
      }
      
      console.log('[DOWNLOAD] Запрос на скачивание:', { orderId, userId });
      
      // Проверяем заказ
      const orderResult = await db.query(`
        SELECT o.*, p.file_path, p.name as product_name
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.id = $1 AND o.user_id = $2 AND o.status = $3
      `, [orderId, userId, 'paid']);
      
      const order = orderResult.rows[0];
      
      if (!order) {
        return res.status(403).json({ error: 'Заказ не найден или не оплачен' });
      }
      
      if (!order.file_path) {
        return res.status(404).json({ error: 'Файл не найден для этого товара' });
      }
      
      const path = require('path');
      const fs = require('fs');
      const filePath = path.join(__dirname, '..', 'files', order.file_path);
      
      if (!fs.existsSync(filePath)) {
        console.error('[DOWNLOAD] Файл не существует:', filePath);
        return res.status(404).json({ error: 'Файл не найден на сервере' });
      }
      
      console.log('[DOWNLOAD] ✅ Отправка файла:', order.file_path);
      
      res.download(filePath, order.file_path, (err) => {
        if (err) {
          console.error('[DOWNLOAD] Ошибка отправки:', err);
        }
      });
      
    } catch (error) {
      console.error('[DOWNLOAD] ❌ Ошибка:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Статус заказа
  router.get('/:id/status', authMiddleware, async (req, res) => {
    try {
      const orderId = req.params.id;
      
      if (!orderId || orderId === 'undefined') {
        return res.status(400).json({ error: 'Invalid order ID' });
      }
      
      console.log('📊 [ORDER STATUS] Проверка статуса заказа:', orderId);
      
      const orderResult = await db.query(`
        SELECT id, status, paid_at, transaction_hash, created_at, total_amount, payment_method
        FROM orders 
        WHERE id = $1 AND user_id = $2
      `, [orderId, req.user.id]);
      
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const order = orderResult.rows[0];
      console.log('✅ [ORDER STATUS] Статус найден:', order.status);
      
      res.json({
        id: order.id,
        status: order.status,
        paid_at: order.paid_at,
        transaction_hash: order.transaction_hash,
        created_at: order.created_at,
        total_amount: order.total_amount,
        payment_method: order.payment_method
      });
      
    } catch (error) {
      console.error('❌ [ORDER STATUS] Ошибка:', error);
      res.status(500).json({ error: 'Ошибка получения статуса заказа' });
    }
  });
  
  return router;
};
