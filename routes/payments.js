const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddlewareWithDB } = require('../middleware/auth');

const BOT_TOKEN = process.env.BOT_TOKEN;

// Проверка статуса платежа
router.get('/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    console.log('🔍 [PAYMENT STATUS] Проверка статуса платежа:', paymentId);
    
    // Если это Stars платеж (начинается с stars_)
    if (paymentId.startsWith('stars_')) {
      // Извлекаем orderId из paymentId (формат: stars_orderId_timestamp)
      const parts = paymentId.split('_');
      const orderId = parts[1];
      
      if (!orderId) {
        return res.status(400).json({ error: 'Неверный формат payment ID' });
      }
      
      // Проверяем статус заказа в базе данных
      const orderResult = await db.query(
        'SELECT status, payment_method FROM orders WHERE id = $1',
        [orderId]
      );
      
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }
      
      const order = orderResult.rows[0];
      console.log('📊 [PAYMENT STATUS] Статус заказа:', order.status);
      
      res.json({ 
        status: order.status,
        payment_id: paymentId,
        order_id: orderId,
        payment_method: order.payment_method
      });
    } else {
      // Для других типов платежей (TON/USDT)
      res.status(404).json({ error: 'Тип платежа не поддерживается для проверки статуса' });
    }
  } catch (error) {
    console.error('❌ [PAYMENT STATUS] Ошибка проверки статуса платежа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание Stars инвойса
router.post('/create-stars-invoice', authMiddlewareWithDB, async (req, res) => {
  try {
    const { orderId, productId } = req.body;
    const userId = req.user.id;
    
    console.log('⭐ [CREATE-STARS] Создание Stars инвойса:', { userId, orderId, productId });
    
    if (!orderId || !productId) {
      return res.status(400).json({ 
        success: false,
        error: 'Необходимы orderId и productId' 
      });
    }
    
    // Получаем информацию о товаре
    const productResult = await db.query(
      'SELECT name, price_stars, description FROM products WHERE id = $1',
      [productId]
    );
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Товар не найден' 
      });
    }
    
    const product = productResult.rows[0];
    const starsAmount = product.price_stars || 100; // По умолчанию 100 Stars
    
    console.log('💰 [CREATE-STARS] Цена товара:', starsAmount, 'Stars');
    
    // Создаем payload для отслеживания
    const payload = `stars_order_${orderId}`;
    
    // Создаем инвойс через Telegram Bot API
    const invoiceResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: product.name,
        description: product.description || `Оплата товара: ${product.name}`,
        payload: payload,
        provider_token: '', // Пусто для Stars!
        currency: 'XTR', // Telegram Stars
        prices: [{ 
          label: 'Stars', 
          amount: starsAmount // Для Stars amount = количество звезд
        }]
      })
    });
    
    const invoiceData = await invoiceResponse.json();
    console.log('📄 [CREATE-STARS] Ответ Telegram API:', invoiceData);
    
    if (invoiceData.ok) {
      // Сохраняем информацию об инвойсе в базу данных
      await db.query(
        'UPDATE orders SET telegram_invoice_data = $1, payload = $2 WHERE id = $3',
        [JSON.stringify(invoiceData.result), payload, orderId]
      );
      
      res.json({
        success: true,
        invoice_link: invoiceData.result,
        order_id: orderId,
        payload: payload
      });
    } else {
      throw new Error(invoiceData.description || 'Ошибка создания инвойса');
    }
    
  } catch (error) {
    console.error('❌ [CREATE-STARS] Ошибка создания Stars инвойса:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка создания платежа: ' + error.message
    });
  }
});

module.exports = router;
