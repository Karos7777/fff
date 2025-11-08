const express = require('express');
const db = require('../../db');
const PostgresAdapter = require('../../db-postgres');

const router = express.Router();
const dbLegacy = new PostgresAdapter(process.env.DATABASE_URL);

// Простой тест для создания заказа без JWT (только для отладки)
router.post('/order', async (req, res) => {
    try {
        const { product_id, user_id = 1 } = req.body;

        const productResult = await db.query('SELECT * FROM products WHERE id = $1', [product_id]);
        const product = productResult.rows[0];
        
        if (!product) {
            return res.status(400).json({ error: 'Товар не найден' });
        }
        
        const orderResult = await db.run('INSERT INTO orders (user_id, product_id) VALUES ($1, $2) RETURNING id', [user_id, product_id]);
        
        res.json({ 
            id: orderResult.id, 
            message: 'Тестовый заказ создан успешно',
            product: product.name
        });
    } catch (error) {
        console.error('Error creating test order:', error);
        res.status(500).json({ error: 'Ошибка создания заказа' });
    }
});

// Тестовый endpoint для Stars инвойсов без JWT
router.post('/stars-invoice', async (req, res) => {
    try {
        const { orderId, productId, amount, description } = req.body;
        const userId = 1; // Тестовый пользователь

        if (!orderId || !productId || !amount || !description) {
            return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
        }

        // Проверяем существование заказа
        const getOrder = dbLegacy.prepare('SELECT * FROM orders WHERE id = ?');
        const order = getOrder.get(orderId);
        
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        const paymentService = req.app.get('paymentService');
        const invoice = await paymentService.createStarsInvoice(orderId, userId, productId, amount, description);
        
        res.json({
            success: true,
            invoice: {
                id: invoice.id,
                payload: invoice.payload,
                telegramInvoice: invoice.telegramInvoice,
                expiresAt: invoice.expiresAt
            }
        });
    } catch (error) {
        console.error('Ошибка создания тестового Stars инвойса:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Тестовый endpoint для крипто инвойсов без JWT
router.post('/crypto-invoice', async (req, res) => {
    try {
        const { orderId, productId, amount, currency } = req.body;
        const userId = 1; // Тестовый пользователь

        if (!orderId || !productId || !amount || !currency) {
            return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
        }

        if (!['TON', 'USDT'].includes(currency)) {
            return res.status(400).json({ error: 'Неподдерживаемая валюта' });
        }

        // Проверяем существование заказа
        const getOrder = dbLegacy.prepare('SELECT * FROM orders WHERE id = ?');
        const order = getOrder.get(orderId);
        
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        const paymentService = req.app.get('paymentService');
        const invoice = await paymentService.createCryptoInvoice(orderId, userId, productId, amount, currency);
        
        res.json({
            success: true,
            invoice: {
                id: invoice.id,
                payload: invoice.payload,
                address: invoice.address,
                memo: invoice.memo,
                amount: invoice.amount,
                currency: invoice.currency,
                expiresAt: invoice.expiresAt
            }
        });
    } catch (error) {
        console.error('Ошибка создания тестового крипто инвойса:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

module.exports = router;
