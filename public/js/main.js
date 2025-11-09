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

// Функция генерации звезд рейтинга
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return '★'.repeat(fullStars) + 
           (hasHalfStar ? '½' : '') + 
           '☆'.repeat(emptyStars);
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
    
    container.innerHTML = products.map(product => {
        const rating = product.average_rating || 0;
        const reviewCount = product.review_count || 0;
        
        return `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.name}" loading="lazy">` : 
                    `<div class="product-image-placeholder">
                        <span class="placeholder-icon">📦</span>
                    </div>`
                }
            </div>
            
            <div class="product-content">
                <h3 class="product-title">${product.name}</h3>
                
                ${product.description ? 
                    `<p class="product-description">${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}</p>` 
                    : ''
                }
                
                <div class="product-rating">
                    <div class="stars ${rating > 0 ? 'has-rating' : ''}">
                        ${generateStars(rating)}
                    </div>
                    <span class="rating-text">
                        ${rating > 0 ? rating.toFixed(1) : 'Нет отзывов'}
                        ${reviewCount > 0 ? `(${reviewCount})` : ''}
                    </span>
                </div>
                
                <div class="product-footer">
                    <div class="product-price">
                        ${product.price_ton ? `<span class="price-ton">💎 ${product.price_ton} TON</span>` : ''}
                        ${product.price_usdt ? `<span class="price-usdt">💵 ${product.price_usdt} USDT</span>` : ''}
                        ${product.price_stars ? `<span class="price-stars">⭐ ${product.price_stars} Stars</span>` : ''}
                    </div>
                    
                    <div class="product-actions">
                        <button class="btn-details" onclick="showProductDetails(${product.id})" title="Подробнее">
                            ℹ️ Подробнее
                        </button>
                        <button class="btn-buy buy-btn" data-product-id="${product.id}" title="Купить">
                            🛒 Купить
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');
    
    // Показываем основной контент
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.style.display = 'block';
    
    const authSection = document.getElementById('authSection');
    if (authSection) authSection.style.display = 'none';
}

// Показать детали товара с отзывами
async function showProductDetails(productId) {
    try {
        console.log('📋 Загрузка деталей товара:', productId);
        
        const response = await fetch(`/api/products/${productId}`);
        if (!response.ok) throw new Error('Ошибка загрузки товара');
        
        const product = await response.json();
        
        // Загружаем отзывы
        const reviewsResponse = await fetch(`/api/reviews/product/${productId}`);
        const reviews = reviewsResponse.ok ? await reviewsResponse.json() : [];
        
        showProductModal(product, reviews);
    } catch (error) {
        console.error('❌ Ошибка загрузки деталей:', error);
        showError('Не удалось загрузить детали товара');
    }
}

// Модальное окно с деталями товара
function showProductModal(product, reviews) {
    const rating = product.average_rating || 0;
    const reviewCount = reviews.length;
    
    const modalHtml = `
        <div class="product-modal-overlay" id="productModalOverlay" onclick="if(event.target === this) closeProductModal()">
            <div class="product-modal">
                <button class="modal-close-btn" onclick="closeProductModal()">✕</button>
                
                <div class="product-modal-header">
                    ${product.image_url ? 
                        `<img src="${product.image_url}" alt="${product.name}" class="product-modal-image">` :
                        '<div class="product-modal-placeholder">📦</div>'
                    }
                    <h2>${product.name}</h2>
                </div>
                
                <div class="product-modal-body">
                    <div class="product-modal-rating">
                        <div class="stars large">${generateStars(rating)}</div>
                        <span class="rating-value">${rating > 0 ? rating.toFixed(1) : 'Нет оценок'}</span>
                        <span class="review-count">(${reviewCount} отзывов)</span>
                    </div>
                    
                    ${product.description ? 
                        `<div class="product-modal-description">
                            <h3>Описание</h3>
                            <p>${product.description}</p>
                        </div>` : ''
                    }
                    
                    <div class="product-modal-price">
                        <h3>Цена</h3>
                        <div class="price-list">
                            ${product.price_ton ? `<div class="price-item">💎 ${product.price_ton} TON</div>` : ''}
                            ${product.price_usdt ? `<div class="price-item">💵 ${product.price_usdt} USDT</div>` : ''}
                            ${product.price_stars ? `<div class="price-item">⭐ ${product.price_stars} Stars</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="product-modal-reviews">
                        <h3>Отзывы ${reviewCount > 0 ? `(${reviewCount})` : ''}</h3>
                        <div class="reviews-list">
                            ${reviews.length > 0 ? 
                                reviews.map(review => `
                                    <div class="review-item">
                                        <div class="review-header">
                                            <span class="review-author">
                                                ${review.username ? `@${review.username}` : review.first_name || 'Пользователь'}
                                            </span>
                                            <div class="review-rating">
                                                <span class="stars small">${generateStars(review.rating)}</span>
                                            </div>
                                        </div>
                                        <p class="review-text">${review.comment || review.text || 'Без комментария'}</p>
                                        <span class="review-date">${new Date(review.created_at).toLocaleDateString('ru-RU', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}</span>
                                    </div>
                                `).join('') :
                                '<p class="no-reviews">Пока нет отзывов. Станьте первым!</p>'
                            }
                        </div>
                    </div>
                </div>
                
                <div class="product-modal-footer">
                    <button class="btn-primary btn-large buy-btn" data-product-id="${product.id}">
                        🛒 Купить сейчас
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Закрыть модальное окно товара
function closeProductModal() {
    const modal = document.getElementById('productModalOverlay');
    if (modal) modal.remove();
}

// Экспортируем функции в глобальную область
window.generateStars = generateStars;
window.showProductDetails = showProductDetails;
window.closeProductModal = closeProductModal;

// Показать модальное окно оплаты TON с QR кодом
function showTONPaymentModal(order) {
    console.log('💎 Показ модалки оплаты для заказа:', order);
    
    const walletAddress = 'UQCm27jo_LGzzwx49_niSXqEz9ZRRTyxJxa-yD89Wnxb13fx';
    const amount = order.total_amount || order.amount || '0';
    
    // КРИТИЧНО: Используем invoice_payload из заказа
    // Если его нет, генерируем такой же как на сервере
    const payload = order.invoice_payload || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('💎 [TON PAYMENT] Используем payload:', payload);
    console.log('💎 [TON PAYMENT] Сумма:', amount);
    
    // Создаем ton:// ссылку для QR кода
    const amountNanoton = Math.floor(parseFloat(amount) * 1000000000);
    const tonLink = `ton://transfer/${walletAddress}?amount=${amountNanoton}&text=${encodeURIComponent(payload)}`;
    
    // Генерируем QR код используя внешний API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(tonLink)}`;
    
    const modalHtml = `
        <div class="payment-modal-overlay" id="paymentModalOverlay">
            <div class="payment-modal">
                <button class="modal-close-btn" onclick="window.closePaymentModal()">✕</button>
                
                <h3>💎 Оплата TON</h3>
                
                <div class="qr-code-section">
                    <p class="qr-instruction">📱 Отсканируйте QR код для автоматической оплаты</p>
                    <div class="qr-code-container">
                        <img src="${qrCodeUrl}" alt="QR Code" class="qr-code-image" />
                        <p class="qr-note">QR код содержит адрес, сумму и комментарий</p>
                    </div>
                </div>
                
                <div class="payment-divider">
                    <span>или скопируйте данные вручную</span>
                </div>
                
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
                        💳 Открыть в кошельке
                    </button>
                    <button class="btn-secondary" onclick="window.closePaymentModal()">
                        Закрыть
                    </button>
                </div>

                <div class="payment-instructions">
                    <h4>📋 Инструкция:</h4>
                    <ol>
                        <li><strong>Вариант 1:</strong> Отсканируйте QR код камерой телефона</li>
                        <li><strong>Вариант 2:</strong> Нажмите "Открыть в кошельке"</li>
                        <li><strong>Вариант 3:</strong> Скопируйте данные вручную</li>
                    </ol>
                    <p class="warning">⚠️ Комментарий обязателен для автоматического подтверждения!</p>
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
