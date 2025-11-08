// payments.js - Модуль платежей

import { showError, showSuccess, showLoading, hideLoading, showTONPayment } from './ui.js';

// Создать заказ
export async function createOrder(productId, paymentMethod = 'ton') {
    try {
        console.log('📦 [ORDER] Создание заказа:', { productId, paymentMethod });
        
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: 1,
                payment_method: paymentMethod
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка создания заказа');
        }

        const order = await response.json();
        console.log('✅ [ORDER] Заказ создан:', order);
        return order;

    } catch (error) {
        console.error('❌ [ORDER] Ошибка создания заказа:', error);
        throw error;
    }
}

// Оплата через TON
export async function payWithTON(productId) {
    try {
        showLoading('Создание заказа...');
        
        // Создаем заказ
        const order = await createOrder(productId, 'ton');
        
        hideLoading();
        
        // Показываем модальное окно оплаты TON
        showTONPayment(order);
        
    } catch (error) {
        hideLoading();
        console.error('❌ Ошибка оплаты TON:', error);
        showError('Ошибка при создании заказа: ' + error.message);
    }
}

// Оплата через USDT
export async function payWithUSDT(productId) {
    try {
        showLoading('Создание заказа...');
        
        // Создаем заказ
        const order = await createOrder(productId, 'usdt');
        
        hideLoading();
        
        // Показываем модальное окно оплаты (аналогично TON)
        showTONPayment(order);
        
    } catch (error) {
        hideLoading();
        console.error('❌ Ошибка оплаты USDT:', error);
        showError('Ошибка при создании заказа: ' + error.message);
    }
}

// Оплата через Stars (временно отключено)
export async function payWithStars(productId) {
    showError('Stars оплата временно недоступна. Пожалуйста, используйте TON.');
    return;
}

// Проверка статуса заказа
export async function checkOrderStatus(orderId) {
    if (!orderId || orderId === 'undefined') {
        console.error('❌ [ORDER STATUS] Invalid order ID:', orderId);
        return null;
    }
    
    try {
        console.log('📊 [ORDER STATUS] Проверка статуса заказа:', orderId);
        
        const response = await fetch(`/api/orders/${orderId}/status`);
        
        if (!response.ok) {
            console.error('❌ [ORDER STATUS] HTTP error:', response.status);
            return null;
        }
        
        const orderStatus = await response.json();
        console.log('✅ [ORDER STATUS] Статус получен:', orderStatus);
        return orderStatus;
        
    } catch (error) {
        console.error('❌ [ORDER STATUS] Ошибка проверки статуса:', error);
        return null;
    }
}

// Функция для обработки платежей с валидацией
export async function processPayment(orderData, paymentMethod) {
    try {
        if (!orderData || !orderData.id) {
            throw new Error('Invalid order data for payment processing');
        }
        
        console.log('💰 [PAYMENT] Processing payment:', { 
            orderId: orderData.id, 
            paymentMethod, 
            payload: orderData.invoice_payload 
        });
        
        // ВРЕМЕННО ОТКЛЮЧАЕМ STARS
        if (paymentMethod === 'stars') {
            throw new Error('Stars payments are temporarily unavailable. Please use TON.');
        }
        
        switch (paymentMethod) {
            case 'ton':
                // Для TON возвращаем данные для оплаты с payload
                return {
                    type: 'ton',
                    orderId: orderData.id,
                    amount: orderData.total_amount || orderData.amount,
                    payload: orderData.invoice_payload,
                    walletAddress: 'UQCm27jo_LGzzwx49_niSXqEz9ZRRTyxJxa-yD89Wnxb13fx'
                };
                
            case 'usdt':
                // USDT payment logic  
                return {
                    type: 'usdt',
                    orderId: orderData.id,
                    amount: orderData.total_amount || orderData.amount,
                    payload: orderData.invoice_payload
                };
                
            default:
                throw new Error(`Unknown payment method: ${paymentMethod}`);
        }
    } catch (error) {
        console.error('❌ [PAYMENT] Processing error:', error);
        throw error;
    }
}

// Проверка доступности Stars оплаты
export function isStarsPaymentAvailable() {
    // Проверяем наличие Telegram WebApp API
    if (!window.Telegram?.WebApp) {
        console.log('⚠️ [STARS] Telegram WebApp недоступен');
        return false;
    }
    
    // Проверяем наличие методов для оплаты
    if (!window.Telegram.WebApp.openInvoice && !window.Telegram.WebApp.openTelegramLink) {
        console.log('⚠️ [STARS] Методы оплаты недоступны');
        return false;
    }
    
    // Временно отключаем Stars до настройки STARS_PROVIDER_TOKEN
    console.log('⚠️ [STARS] Stars оплата временно отключена');
    return false;
}

// Экспортируем функции в глобальную область для onclick
window.payWithTON = payWithTON;
window.payWithUSDT = payWithUSDT;
window.payWithStars = payWithStars;
