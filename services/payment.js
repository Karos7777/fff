const db = require('../db');

class PaymentService {
    constructor(database, botToken) {
        this.db = database;
        this.botToken = botToken;
    }

    async initPaymentTables() {
        // Инициализация таблиц платежей если нужно
        console.log('✅ Таблицы платежей уже инициализированы в DatabaseService');
    }

    async createStarsInvoice(orderId, userId, productId, amount, description) {
        try {
            // Получаем информацию о товаре
            const productResult = await this.db.query(
                'SELECT name, price_stars, description FROM products WHERE id = $1',
                [productId]
            );
            
            if (productResult.rows.length === 0) {
                throw new Error('Товар не найден');
            }
            
            const product = productResult.rows[0];
            const starsAmount = product.price_stars || Math.ceil(parseFloat(amount) * 100);
            
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
            const invoiceResult = await this.db.query(`
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
            
            return {
                id: invoice.id,
                payload: payload,
                amount: starsAmount,
                currency: 'XTR',
                expiresAt: invoice.expires_at,
                telegramInvoice: telegramInvoice
            };
            
        } catch (error) {
            console.error('❌ Ошибка создания Stars инвойса:', error);
            throw error;
        }
    }

    async createCryptoInvoice(orderId, userId, productId, amount, currency) {
        try {
            if (!['TON', 'USDT'].includes(currency)) {
                throw new Error('Неподдерживаемая валюта');
            }

            // Генерируем адрес и memo для платежа
            const address = process.env.TON_WALLET_ADDRESS || 'UQBvW8Z5huBkMJYdnfAEM5XONfNEX5iVhQDMhFWlOHVEz8_a';
            const memo = `order_${orderId}_${Date.now()}`;
            const payload = `crypto_${orderId}_${Date.now()}`;
            
            // Сохраняем инвойс в базу данных
            const invoiceResult = await this.db.query(`
                INSERT INTO invoices (
                    order_id, user_id, product_id, amount, currency, 
                    address, memo, status, expires_at, payload, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) 
                RETURNING *
            `, [
                orderId, userId, productId, amount, currency,
                address, memo, 'pending', 
                new Date(Date.now() + 60 * 60 * 1000), // 1 час
                payload
            ]);
            
            const invoice = invoiceResult.rows[0];
            
            return {
                id: invoice.id,
                payload: payload,
                address: address,
                memo: memo,
                amount: amount,
                currency: currency,
                expiresAt: invoice.expires_at
            };
            
        } catch (error) {
            console.error('❌ Ошибка создания крипто инвойса:', error);
            throw error;
        }
    }

    async checkCryptoPayments() {
        console.log('🔍 Проверка криптоплатежей...');
        // Здесь будет логика проверки платежей через TON API
        // Пока заглушка
    }

    async cancelExpiredInvoices() {
        try {
            const result = await this.db.query(`
                UPDATE invoices 
                SET status = 'expired' 
                WHERE status = 'pending' 
                AND expires_at < NOW()
            `);
            
            if (result.rowCount > 0) {
                console.log(`✅ Отменено просроченных инвойсов: ${result.rowCount}`);
            }
        } catch (error) {
            console.error('❌ Ошибка отмены просроченных инвойсов:', error);
        }
    }
}

module.exports = PaymentService;
