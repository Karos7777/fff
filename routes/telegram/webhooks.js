const express = require('express');
const db = require('../../db-postgres');

const router = express.Router();

// Основной Telegram вебхук для обработки всех обновлений
router.post('/webhook', async (req, res) => {
    try {
        const update = req.body;
        const BOT_TOKEN = process.env.BOT_TOKEN;
        
        console.log('📨 [TELEGRAM-WEBHOOK] Получен update:', JSON.stringify(update, null, 2));
        
        // Обработка pre_checkout_query (обязательно для Stars)
        if (update.pre_checkout_query) {
            const preCheckout = update.pre_checkout_query;
            console.log('🔍 [PRE-CHECKOUT] Проверка платежа:', preCheckout.invoice_payload);
            
            // Проверяем, что заказ существует и валиден
            let isOrderValid = true;
            
            if (preCheckout.invoice_payload.startsWith('stars_order_')) {
                const orderId = preCheckout.invoice_payload.replace('stars_order_', '');
                
                const orderResult = await db.query(
                    'SELECT status FROM orders WHERE id = $1',
                    [orderId]
                );
                
                if (orderResult.rows.length === 0 || orderResult.rows[0].status !== 'pending') {
                    isOrderValid = false;
                }
            }
            
            // Отвечаем на pre_checkout_query
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pre_checkout_query_id: preCheckout.id,
                    ok: isOrderValid,
                    error_message: isOrderValid ? undefined : 'Заказ недоступен для оплаты'
                })
            });
            
            console.log('✅ [PRE-CHECKOUT] Ответ отправлен:', isOrderValid ? 'OK' : 'ERROR');
        }
        
        // Обработка успешного платежа Stars
        if (update.message && update.message.successful_payment) {
            const payment = update.message.successful_payment;
            const payload = payment.invoice_payload;
            const userId = update.message.from.id;
            
            console.log('🎉 [SUCCESSFUL-PAYMENT] Успешный платеж:', { 
                payload, 
                amount: payment.total_amount,
                userId 
            });
            
            // Если это Stars платеж
            if (payload.startsWith('stars_order_')) {
                const orderId = payload.replace('stars_order_', '');
                
                // Обновляем статус заказа в базе данных
                const updateResult = await db.query(
                    'UPDATE orders SET status = $1, paid_at = NOW(), transaction_hash = $2 WHERE id = $3 AND status = $4',
                    ['paid', payment.telegram_payment_charge_id, orderId, 'pending']
                );
                
                if (updateResult.rowCount > 0) {
                    console.log(`✅ [SUCCESSFUL-PAYMENT] Stars платеж подтвержден для заказа ${orderId}`);
                    
                    // Отправляем уведомление пользователю
                    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: userId,
                            text: `🎉 Оплата прошла успешно!\n\nВаш заказ #${orderId} оплачен и будет обработан в ближайшее время.`
                        })
                    });
                } else {
                    console.log(`⚠️ [SUCCESSFUL-PAYMENT] Заказ ${orderId} не найден или уже оплачен`);
                }
            }
        }
        
        res.json({ ok: true });
        
    } catch (error) {
        console.error('❌ [TELEGRAM-WEBHOOK] Ошибка обработки вебхука:', error);
        res.status(500).json({ error: 'Ошибка обработки вебхука' });
    }
});

// Webhook для обработки Telegram Stars платежей (старый)
router.post('/stars/webhook', async (req, res) => {
    try {
        const update = req.body;
        const BOT_TOKEN = process.env.BOT_TOKEN;
        
        console.log('⭐ [STARS-WEBHOOK] Получен update:', JSON.stringify(update, null, 2));
        
        // Обрабатываем successful_payment
        if (update.message && update.message.successful_payment) {
            const payment = update.message.successful_payment;
            const payload = payment.invoice_payload;
            
            console.log('💰 [STARS-WEBHOOK] Успешный платеж:', { payload, amount: payment.total_amount });
            
            // Находим инвойс по payload
            const invoiceResult = await db.query(
                'SELECT * FROM invoices WHERE payload = $1 AND status = $2',
                [payload, 'pending']
            );
            
            const invoice = invoiceResult.rows[0];
            if (!invoice) {
                console.log('⚠️ [STARS-WEBHOOK] Инвойс не найден:', payload);
                return res.json({ ok: true });
            }
            
            // Обновляем статус инвойса и заказа
            await db.query('UPDATE invoices SET status = $1, paid_at = NOW() WHERE id = $2', ['paid', invoice.id]);
            await db.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', invoice.order_id]);
            
            console.log('✅ [STARS-WEBHOOK] Платеж обработан:', { 
                invoiceId: invoice.id, 
                orderId: invoice.order_id 
            });
            
            // Уведомляем пользователя (если настроен BOT_TOKEN)
            if (BOT_TOKEN) {
                try {
                    const productResult = await db.query('SELECT name FROM products WHERE id = $1', [invoice.product_id]);
                    const product = productResult.rows[0];
                    
                    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: update.message.from.id,
                            text: `🎉 Платеж успешно обработан!\n\n📦 Товар: ${product?.name}\n💰 Сумма: ${payment.total_amount} Stars\n\nСпасибо за покупку!`,
                            parse_mode: 'HTML'
                        })
                    });
                } catch (notifyError) {
                    console.error('❌ [STARS-WEBHOOK] Ошибка уведомления:', notifyError);
                }
            }
        }
        
        res.json({ ok: true });
        
    } catch (error) {
        console.error('❌ [STARS-WEBHOOK] Ошибка обработки webhook:', error);
        res.status(500).json({ error: 'Ошибка обработки платежа' });
    }
});

module.exports = router;
