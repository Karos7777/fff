const express = require('express');
const db = require('../../db');
const { authMiddlewareWithDB } = require('../../middleware/auth');

const router = express.Router();

// Эндпоинт для проверки статуса Stars платежа
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

// Упрощенный эндпоинт для создания Stars инвойса
router.post('/create-invoice', authMiddlewareWithDB, async (req, res) => {
    try {
        const { orderId, productId } = req.body;
        const userId = req.user.id;
        const BOT_TOKEN = process.env.BOT_TOKEN;
        
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

// Эндпоинт для создания Telegram Stars инвойса (полный)
router.post('/create-invoice-full', authMiddlewareWithDB, async (req, res) => {
    try {
        const { orderId, productId, amount, description } = req.body;
        const userId = req.user.id;
        
        console.log('⭐ [STARS] Создание Stars инвойса:', { userId, orderId, productId, amount });
        
        if (!orderId || !productId || !amount) {
            return res.status(400).json({ error: 'Необходимы orderId, productId и amount' });
        }
        
        // Проверяем заказ
        const orderResult = await db.query(
            'SELECT * FROM orders WHERE id = $1 AND user_id = $2', 
            [orderId, userId]
        );
        
        const order = orderResult.rows[0];
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        
        // Проверяем товар
        const productResult = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
        const product = productResult.rows[0];
        
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        // Вычисляем цену в Stars (примерно 1$ = 100 Stars)
        const starsAmount = Math.ceil(parseFloat(amount) * 100);
        
        // Создаем уникальный payload для отслеживания платежа
        const payload = `stars_${orderId}_${Date.now()}`;
        
        // Создаем инвойс для Telegram Stars
        const telegramInvoice = {
            title: product.name,
            description: description || product.description || 'Покупка в магазине',
            payload: payload,
            provider_token: '', // Для Stars не нужен
            currency: 'XTR', // Telegram Stars
            prices: [{ label: product.name, amount: starsAmount }],
            max_tip_amount: 0,
            suggested_tip_amounts: [],
            start_parameter: `stars_${orderId}`,
            provider_data: JSON.stringify({
                receipt: {
                    items: [{
                        description: product.name,
                        quantity: '1',
                        amount: { value: starsAmount, currency: 'XTR' }
                    }]
                }
            }),
            photo_url: product.image_url || null,
            photo_size: product.image_url ? 512 : null,
            photo_width: product.image_url ? 512 : null,
            photo_height: product.image_url ? 512 : null,
            need_name: false,
            need_phone_number: false,
            need_email: false,
            need_shipping_address: false,
            send_phone_number_to_provider: false,
            send_email_to_provider: false,
            is_flexible: false
        };
        
        // Сохраняем инвойс в базу данных
        const invoiceResult = await db.query(`
            INSERT INTO invoices (
                order_id, user_id, product_id, amount, currency, 
                address, memo, status, expires_at, payload, 
                telegram_invoice_data, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) 
            RETURNING *
        `, [
            orderId, userId, productId, starsAmount, 'XTR',
            null, payload, 'pending', 
            new Date(Date.now() + 60 * 60 * 1000), // 1 час
            payload, JSON.stringify(telegramInvoice)
        ]);
        
        const invoice = invoiceResult.rows[0];
        
        console.log('✅ [STARS] Stars инвойс создан:', { invoiceId: invoice.id, payload, starsAmount });
        
        res.json({
            success: true,
            invoice: {
                id: invoice.id,
                payload: payload,
                amount: starsAmount,
                currency: 'XTR',
                expiresAt: invoice.expires_at,
                telegramInvoice: telegramInvoice
            }
        });
        
    } catch (error) {
        console.error('❌ [STARS] Ошибка создания Stars инвойса:', error);
        res.status(500).json({ error: 'Ошибка создания инвойса: ' + error.message });
    }
});

// Получение истории платежей пользователя
router.get('/history', authMiddlewareWithDB, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const paymentsResult = await db.query(`
            SELECT 
                i.*,
                o.status as order_status,
                p.name as product_name,
                p.price as product_price
            FROM invoices i
            JOIN orders o ON i.order_id = o.id
            JOIN products p ON i.product_id = p.id
            WHERE i.user_id = $1
            ORDER BY i.created_at DESC
            LIMIT 50
        `, [userId]);
        
        const payments = paymentsResult.rows;
        
        res.json({
            success: true,
            payments: payments.map(payment => ({
                id: payment.id,
                orderId: payment.order_id,
                productName: payment.product_name,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                paymentMethod: payment.currency === 'XTR' ? 'stars' : 'crypto',
                txHash: payment.crypto_tx_hash,
                createdAt: payment.created_at,
                paidAt: payment.paid_at
            }))
        });
    } catch (error) {
        console.error('Ошибка получения истории платежей:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

module.exports = router;
