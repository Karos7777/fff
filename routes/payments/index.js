const express = require('express');
const db = require('../../db');

const router = express.Router();

// Ручная проверка криптоплатежей (для отладки)
router.post('/crypto/check', async (req, res) => {
    try {
        console.log('🔍 Запуск ручной проверки криптоплатежей...');
        const paymentService = req.app.get('paymentService');
        await paymentService.checkCryptoPayments();
        
        res.json({ success: true, message: 'Проверка криптоплатежей выполнена - смотрите логи сервера' });
    } catch (error) {
        console.error('Ошибка проверки криптоплатежей:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Эндпоинт для создания платежа (для Telegram Wallet интеграции)
router.post('/create', async (req, res) => {
    try {
        const { product_id, amount, currency = 'TON' } = req.body;
        const userId = req.user.id;
        
        console.log('💳 [CREATE-PAYMENT] Создание платежа:', { userId, product_id, amount, currency });
        
        if (!product_id || !amount) {
            return res.status(400).json({ error: 'Необходимы product_id и amount' });
        }
        
        // Проверяем, что товар существует
        const productResult = await db.query('SELECT * FROM products WHERE id = $1', [product_id]);
        const product = productResult.rows[0];
        
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        // Создаем запись о платеже в базе
        const result = await db.query(`
            INSERT INTO payments (user_id, product_id, amount, currency, status, created_at)
            VALUES ($1, $2, $3, $4, 'pending', NOW()) RETURNING *
        `, [userId, product_id, amount, currency]);
        
        const payment = result.rows[0];
        console.log('✅ [CREATE-PAYMENT] Платеж создан:', payment);
        
        // Генерируем данные для инвойса Telegram
        const invoiceData = {
            payment_id: payment.id,
            amount: amount,
            currency: currency,
            description: `Оплата товара "${product.name}"`,
            product_name: product.name
        };
        
        res.json({
            success: true,
            payment: payment,
            invoice_data: invoiceData,
            payment_id: payment.id
        });
    } catch (error) {
        console.error('❌ [CREATE-PAYMENT] Ошибка создания платежа:', error);
        res.status(500).json({ error: 'Ошибка создания платежа: ' + error.message });
    }
});

// Эндпоинт для проверки статуса Stars платежа
router.get('/status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        console.log('🔍 [PAYMENT STATUS] Проверка статуса платежа:', paymentId);
        
        // Ищем инвойс по ID
        const invoiceResult = await db.query('SELECT * FROM invoices WHERE id = $1', [paymentId]);
        const invoice = invoiceResult.rows[0];
        
        if (!invoice) {
            console.log('❌ [PAYMENT STATUS] Инвойс не найден:', paymentId);
            return res.status(404).json({ 
                success: false, 
                error: 'Платеж не найден',
                status: 'not_found'
            });
        }
        
        console.log('📋 [PAYMENT STATUS] Найден инвойс:', {
            id: invoice.id,
            status: invoice.status,
            amount: invoice.amount,
            currency: invoice.currency,
            created_at: invoice.created_at
        });
        
        // Возвращаем статус платежа
        res.json({
            success: true,
            payment: {
                id: invoice.id,
                status: invoice.status,
                amount: parseFloat(invoice.amount),
                currency: invoice.currency,
                created_at: invoice.created_at,
                paid_at: invoice.paid_at,
                transaction_hash: invoice.transaction_hash
            }
        });
        
    } catch (error) {
        console.error('❌ [PAYMENT STATUS] Ошибка проверки статуса:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Внутренняя ошибка сервера',
            status: 'error'
        });
    }
});

// Упрощенный эндпоинт для создания Stars инвойса
router.post('/stars/create-invoice', async (req, res) => {
    try {
        const { orderId, productId } = req.body;
        const userId = req.user.id;
        
        console.log('⭐ [STARS-INVOICE] Создание Stars инвойса:', { userId, orderId, productId });
        
        if (!orderId || !productId) {
            return res.status(400).json({ error: 'Необходимы orderId и productId' });
        }
        
        // Получаем информацию о заказе
        const orderResult = await db.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
        const order = orderResult.rows[0];
        
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден или не принадлежит пользователю' });
        }
        
        // Получаем информацию о товаре
        const productResult = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
        const product = productResult.rows[0];
        
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        // Проверяем, есть ли цена в Stars
        if (!product.price_stars || product.price_stars <= 0) {
            return res.status(400).json({ error: 'Для этого товара не установлена цена в Stars' });
        }
        
        const paymentService = req.app.get('paymentService');
        const invoice = await paymentService.createStarsInvoice(
            orderId, 
            userId, 
            productId, 
            product.price_stars, 
            `Оплата товара "${product.name}"`
        );
        
        console.log('✅ [STARS-INVOICE] Stars инвойс создан:', invoice.id);
        
        res.json({
            success: true,
            invoice: {
                id: invoice.id,
                payload: invoice.payload,
                telegramInvoice: invoice.telegramInvoice,
                expiresAt: invoice.expiresAt,
                amount: product.price_stars,
                description: `Оплата товара "${product.name}"`
            }
        });
        
    } catch (error) {
        console.error('❌ [STARS-INVOICE] Ошибка создания Stars инвойса:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
    }
});

// Эндпоинт для создания Telegram Stars инвойса (старый)
router.post('/stars/create-invoice-legacy', async (req, res) => {
    try {
        const { orderId, productId, amount, description } = req.body;
        const userId = req.user.id;
        
        console.log('⭐ [STARS-INVOICE-LEGACY] Создание Stars инвойса (legacy):', { userId, orderId, productId, amount, description });
        
        if (!orderId || !productId || !amount || !description) {
            return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
        }
        
        // Проверяем существование заказа
        const orderResult = await db.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
        const order = orderResult.rows[0];
        
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден или не принадлежит пользователю' });
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
        console.error('Ошибка создания Stars инвойса:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Webhook для обработки Telegram Stars платежей
router.post('/stars/webhook', async (req, res) => {
    try {
        const update = req.body;
        console.log('⭐ [STARS-WEBHOOK] Получен update:', JSON.stringify(update, null, 2));
        
        // Проверяем, что это pre_checkout_query или successful_payment
        if (update.pre_checkout_query) {
            console.log('💰 [STARS-WEBHOOK] Pre-checkout query получен');
            
            // Отвечаем OK на pre-checkout (разрешаем платеж)
            const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerPreCheckoutQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pre_checkout_query_id: update.pre_checkout_query.id,
                    ok: true
                })
            });
            
            if (response.ok) {
                console.log('✅ [STARS-WEBHOOK] Pre-checkout одобрен');
            } else {
                console.error('❌ [STARS-WEBHOOK] Ошибка одобрения pre-checkout');
            }
            
        } else if (update.message?.successful_payment) {
            console.log('💳 [STARS-WEBHOOK] Successful payment получен');
            
            const payment = update.message.successful_payment;
            const payload = payment.invoice_payload;
            
            console.log('💰 [STARS-WEBHOOK] Payload:', payload);
            console.log('💰 [STARS-WEBHOOK] Amount:', payment.total_amount);
            
            // Находим инвойс по payload
            const invoiceResult = await db.query('SELECT * FROM invoices WHERE payload = $1', [payload]);
            const invoice = invoiceResult.rows[0];
            
            if (invoice) {
                // Обновляем статус инвойса
                await db.query('UPDATE invoices SET status = $1, paid_at = NOW() WHERE id = $2', ['paid', invoice.id]);
                
                // Обновляем статус заказа
                await db.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', invoice.order_id]);
                
                console.log('✅ [STARS-WEBHOOK] Платеж обработан успешно');
                
                // Отправляем уведомление пользователю
                const userId = update.message.from.id;
                await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: userId,
                        text: `✅ Платеж успешно обработан!\n💰 Сумма: ${payment.total_amount} Stars\n📦 Заказ #${invoice.order_id} оплачен.`
                    })
                });
            } else {
                console.error('❌ [STARS-WEBHOOK] Инвойс не найден для payload:', payload);
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ [STARS-WEBHOOK] Ошибка обработки webhook:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

module.exports = router;
