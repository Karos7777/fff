const express = require('express');
const db = require('../../db');

const router = express.Router();

// Основной Telegram вебхук для обработки всех обновлений
router.post('/webhook', async (req, res) => {
    try {
        const update = req.body;
        console.log('📨 [TELEGRAM-WEBHOOK] Получен update:', JSON.stringify(update, null, 2));
        
        // Проверяем, что это pre_checkout_query или successful_payment
        if (update.pre_checkout_query) {
            console.log('💰 [TELEGRAM-WEBHOOK] Pre-checkout query получен');
            
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
                console.log('✅ [TELEGRAM-WEBHOOK] Pre-checkout одобрен');
            } else {
                console.error('❌ [TELEGRAM-WEBHOOK] Ошибка одобрения pre-checkout');
            }
            
        } else if (update.message?.successful_payment) {
            console.log('💳 [TELEGRAM-WEBHOOK] Successful payment получен');
            
            const payment = update.message.successful_payment;
            const payload = payment.invoice_payload;
            
            console.log('💰 [TELEGRAM-WEBHOOK] Payload:', payload);
            console.log('💰 [TELEGRAM-WEBHOOK] Amount:', payment.total_amount);
            
            // Находим инвойс по payload
            const invoiceResult = await db.query('SELECT * FROM invoices WHERE payload = $1', [payload]);
            const invoice = invoiceResult.rows[0];
            
            if (invoice) {
                // Обновляем статус инвойса
                await db.query('UPDATE invoices SET status = $1, paid_at = NOW() WHERE id = $2', ['paid', invoice.id]);
                
                // Обновляем статус заказа
                await db.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', invoice.order_id]);
                
                console.log('✅ [TELEGRAM-WEBHOOK] Платеж обработан успешно');
                
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
                console.error('❌ [TELEGRAM-WEBHOOK] Инвойс не найден для payload:', payload);
            }
        } else if (update.message?.text) {
            // Обработка текстовых сообщений
            console.log('💬 [TELEGRAM-WEBHOOK] Текстовое сообщение:', update.message.text);
            
            const chatId = update.message.chat.id;
            const messageText = update.message.text;
            
            // Простые команды
            if (messageText === '/start') {
                await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: '🛍️ Добро пожаловать в наш магазин!\n\nИспользуйте веб-приложение для просмотра товаров и совершения покупок.',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '🛒 Открыть магазин', web_app: { url: process.env.WEBAPP_URL || 'https://fff-production-41ca.up.railway.app' } }
                            ]]
                        }
                    })
                });
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ [TELEGRAM-WEBHOOK] Ошибка обработки webhook:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

module.exports = router;
