// main.js - Главный файл приложения

import { initAuthInterceptor, autoAuth, getCurrentUser } from './auth.js';
import { showError, showSuccess } from './ui.js';
import { payWithTON, payWithUSDT, payWithStars } from './payments.js';

// Версия приложения
const APP_VERSION = '4.0.0';
console.log(`🚀 App version: ${APP_VERSION}`);

// Глобальный обработчик ошибок
window.addEventListener('error', function(e) {
    console.log('🛠️ Global error handler:', e.error);
    return true;
});

// Обработчик необработанных промисов
window.addEventListener('unhandledrejection', function(e) {
    console.log('🛠️ Unhandled promise rejection:', e.reason);
    e.preventDefault();
});

// Защита от undefined URL
document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link && link.href && link.href.includes('undefined')) {
        e.preventDefault();
        console.error('🚫 Blocked undefined link:', link.href);
        showError('Некорректная ссылка');
    }
});

// Загрузка товаров
async function loadProducts() {
    try {
        console.log('📦 Загрузка товаров...');
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Network error');
        
        const products = await response.json();
        console.log('✅ Товаров загружено:', products.length);
        renderProducts(products);
        return products;
    } catch (error) {
        console.error('❌ Ошибка загрузки товаров:', error);
        showError('Не удалось загрузить товары');
        return [];
    }
}

// Отрисовка товаров
function renderProducts(products) {
    const container = document.getElementById('productsGrid');
    if (!container) {
        console.log('📦 Контейнер товаров не найден');
        return;
    }
    
    if (products.length === 0) {
        container.innerHTML = '<p class="empty-message">Товары не найдены</p>';
        return;
    }
    
    container.innerHTML = products.map(product => `
        <div class="product-card" data-product-id="${product.id}">
            ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : ''}
            <h3>${product.name}</h3>
            <p class="product-description">${product.description || ''}</p>
            <div class="product-price">
                ${product.price_ton ? `💎 ${product.price_ton} TON` : ''}
                ${product.price_usdt ? `💵 ${product.price_usdt} USDT` : ''}
                ${product.price_stars ? `⭐ ${product.price_stars} Stars` : ''}
            </div>
            <button class="btn-primary buy-btn" data-product-id="${product.id}">
                Купить
            </button>
        </div>
    `).join('');
    
    // Показываем основной контент
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.style.display = 'block';
    
    const authSection = document.getElementById('authSection');
    if (authSection) authSection.style.display = 'none';
}

// Показать модальное окно оплаты TON
function showTONPaymentModal(order) {
    console.log('💎 Показ модалки оплаты для заказа:', order);
    
    const walletAddress = 'UQCm27jo_LGzzwx49_niSXqEz9ZRRTyxJxa-yD89Wnxb13fx';
    const amount = order.total_amount || order.amount || '0';
    const payload = order.invoice_payload || '';
    
    const modalHtml = `
        <div class="payment-modal-overlay" id="paymentModalOverlay">
            <div class="payment-modal">
                <h3>💎 Оплата TON</h3>
                
                <div class="payment-info">
                    <div class="payment-item">
                        <label>Адрес кошелька:</label>
                        <div class="copy-field">
                            <code class="wallet-address">${walletAddress}</code>
                            <button class="copy-btn" data-text="${walletAddress}">
                                📋
                            </button>
                        </div>
                    </div>
                    
                    <div class="payment-item">
                        <label>Сумма:</label>
                        <div class="copy-field">
                            <code class="payment-amount">${amount} TON</code>
                            <button class="copy-btn" data-text="${amount}">
                                📋
                            </button>
                        </div>
                    </div>
                    
                    <div class="payment-item highlight">
                        <label>Комментарий (ОБЯЗАТЕЛЬНО!):</label>
                        <div class="copy-field">
                            <code class="payment-payload">${payload}</code>
                            <button class="copy-btn" data-text="${payload}">
                                📋
                            </button>
                        </div>
                        <small class="warning-text">⚠️ Без этого комментария оплата не будет засчитана!</small>
                    </div>
                </div>

                <div class="payment-actions">
                    <button class="btn-primary" onclick="window.openTelegramWallet('${amount}', '${payload}')">
                        💳 Открыть в Telegram Wallet
                    </button>
                    <button class="btn-secondary" onclick="window.closePaymentModal()">
                        Закрыть
                    </button>
                </div>

                <div class="payment-instructions">
                    <h4>📋 Инструкция по оплате:</h4>
                    <ol>
                        <li>Скопируйте <strong>адрес кошелька</strong></li>
                        <li>Скопируйте <strong>точную сумму</strong> (${amount} TON)</li>
                        <li>Скопируйте <strong>комментарий</strong> и ОБЯЗАТЕЛЬНО вставьте его при отправке</li>
                        <li>Отправьте платеж или используйте кнопку выше</li>
                    </ol>
                    <p class="warning">⚠️ Без комментария платеж не будет засчитан автоматически!</p>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    initializeCopyButtons();
}

// Инициализация кнопок копирования
function initializeCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const text = this.getAttribute('data-text');
            navigator.clipboard.writeText(text).then(() => {
                const originalText = this.innerHTML;
                this.innerHTML = '✅';
                setTimeout(() => {
                    this.innerHTML = originalText;
                }, 2000);
                
                showSuccess('Скопировано в буфер обмена!');
            }).catch(err => {
                console.error('Ошибка копирования:', err);
                showError('Не удалось скопировать');
            });
        });
    });
}

// Обработка покупки
async function handlePurchase(productId) {
    try {
        console.log('🛒 Покупка товара:', productId);
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.error('❌ Токен не найден');
            showError('Ошибка авторизации. Перезагрузите приложение.');
            return;
        }
        
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                product_id: productId,
                payment_method: 'ton'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const order = await response.json();
        console.log('✅ Заказ создан:', order);
        
        // Показываем модальное окно оплаты
        showTONPaymentModal(order);
        
    } catch (error) {
        console.error('❌ Ошибка покупки:', error);
        showError('Ошибка при создании заказа: ' + error.message);
    }
}

// Инициализация обработчиков событий
function initializeEventHandlers() {
    console.log('🔧 Инициализация обработчиков...');
    
    // Обработчик для кнопок покупки (поддержка вложенных элементов)
    document.addEventListener('click', function(e) {
        const buyBtn = e.target.closest('.buy-btn');
        if (buyBtn) {
            const productId = buyBtn.dataset.productId;
            if (productId) {
                console.log('🛒 Нажата кнопка покупки для товара:', productId);
                handlePurchase(productId);
            } else {
                console.error('❌ Не найден productId у кнопки:', buyBtn);
            }
        }
    });
}

// Глобальные функции для модалки оплаты
window.openTelegramWallet = function(amount, payload) {
    const walletAddress = 'UQCm27jo_LGzzwx49_niSXqEz9ZRRTyxJxa-yD89Wnxb13fx';
    const amountNanoton = Math.floor(parseFloat(amount) * 1000000000).toString();
    
    console.log('💳 Открываем TON Wallet:', { amount, payload, amountNanoton });
    
    // Создаем ссылки для разных кошельков
    const tonDeepLink = `ton://transfer/${walletAddress}?amount=${amountNanoton}&text=${encodeURIComponent(payload)}`;
    const tonkeeperLink = `https://app.tonkeeper.com/transfer/${walletAddress}?amount=${amountNanoton}&text=${encodeURIComponent(payload)}`;
    
    if (window.Telegram?.WebApp) {
        // Пробуем через Telegram WebApp API
        if (window.Telegram.WebApp.openTelegramLink) {
            const telegramWalletLink = `https://t.me/wallet?startattach=transfer-${walletAddress}-${amountNanoton}-${encodeURIComponent(payload)}`;
            window.Telegram.WebApp.openTelegramLink(telegramWalletLink);
        } else if (window.Telegram.WebApp.openLink) {
            window.Telegram.WebApp.openLink(tonDeepLink);
        }
    } else {
        // Fallback на Tonkeeper
        window.open(tonkeeperLink, '_blank');
    }
};

window.closePaymentModal = function() {
    const modal = document.getElementById('paymentModalOverlay');
    if (modal) {
        modal.remove();
        console.log('✅ Модальное окно оплаты закрыто');
    }
};

// Инициализация приложения
async function initApp() {
    console.log('🚀 Инициализация приложения...');
    
    // Инициализируем перехватчик аутентификации
    initAuthInterceptor();
    
    // Проверяем Telegram WebApp
    if (window.Telegram?.WebApp) {
        console.log('📱 Telegram WebApp обнаружен');
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        
        // Автоматическая аутентификация
        const authenticated = await autoAuth();
        if (authenticated) {
            const user = getCurrentUser();
            console.log('👤 Пользователь:', user);
            
            // Загружаем товары после успешной аутентификации
            await loadProducts();
        }
    } else {
        console.log('⚠️ Telegram WebApp недоступен');
        // Загружаем товары даже без Telegram
        await loadProducts();
    }
    
    // Инициализируем обработчики
    initializeEventHandlers();
    
    console.log('✅ Приложение инициализировано');
}

// Запускаем приложение при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Экспортируем в глобальную область
window.APP_VERSION = APP_VERSION;
window.showError = showError;
window.showSuccess = showSuccess;
window.payWithTON = payWithTON;
window.payWithUSDT = payWithUSDT;
window.payWithStars = payWithStars;
window.loadProducts = loadProducts;
window.handlePurchase = handlePurchase;
window.getCurrentUser = getCurrentUser;

console.log('✅ Main module loaded');
