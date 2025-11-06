const express = require('express');
const router = express.Router();
const db = require('../db');

module.exports = (authMiddleware) => {
  // Создание заказа
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const { product_id } = req.body;
      const user_id = req.user.id;
      
      console.log('[ORDER] Создание заказа:', { user_id, product_id });
      
      // Получаем информацию о товаре
      const productResult = await db.query('SELECT * FROM products WHERE id = $1', [product_id]);
      const product = productResult.rows[0];
      
      if (!product) {
        return res.status(404).json({ error: 'Товар не найден' });
      }
      
      // Создаём заказ
      const insertResult = await db.query(
        'INSERT INTO orders (user_id, product_id, status) VALUES ($1, $2, $3) RETURNING id',
        [user_id, product_id, 'pending']
      );
      const orderId = insertResult.rows[0].id;
      
      console.log('[ORDER] Заказ создан:', orderId);
      
      // Проверяем payment_method
      const paymentMethod = req.body.payment_method || req.body.paymentMethod;
      console.log('[ORDER] Payment method:', paymentMethod);
      
      if (paymentMethod === 'ton' || paymentMethod === 'TON') {
        // Создаём TON инвойс
        const paymentService = req.app.get('paymentService');
        const invoice = await paymentService.createCryptoInvoice(
          orderId,
          user_id,
          product_id,
          product.price_ton || product.price,
          'TON'
        );
        
        console.log('[ORDER] TON инвойс создан:', invoice.id);
        
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
      
    } catch (error) {
      console.error('[ORDER] Ошибка создания:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
  
  // Получение заказов пользователя
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      
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
          i.currency as payment_currency
        FROM orders o
        JOIN products p ON o.product_id = p.id
        LEFT JOIN invoices i ON o.id = i.order_id
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC
      `, [userId]);
      
      res.json(result.rows);
      
    } catch (error) {
      console.error('[ORDER] Ошибка получения заказов:', error);
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
  
  return router;
};
