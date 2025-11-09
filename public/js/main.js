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

// Обработка покупки
async function handlePurchase(productId) {
    try {
        console.log('🛒 Покупка товара:', productId);
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            showError('Необходима авторизация');
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
            const error = await response.json();
            throw new Error(error.error || 'Order creation failed');
        }
        
        const order = await response.json();
        console.log('✅ Заказ создан:', order);
        
        // Используем функцию из ui.js для показа модального окна оплаты
        const { showTONPayment } = await import('./ui.js');
        showTONPayment(order);
        
    } catch (error) {
        console.error('❌ Ошибка покупки:', error);
        showError('Ошибка при создании заказа: ' + error.message);
    }
}

// Инициализация обработчиков событий
function initializeEventHandlers() {
    console.log('🔧 Инициализация обработчиков...');
    
    // Обработчик для кнопок покупки
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('buy-btn')) {
            const productId = e.target.dataset.productId;
            handlePurchase(productId);
        }
    });
}

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
