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
        }
    } else {
        console.log('⚠️ Telegram WebApp недоступен');
    }
    
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

console.log('✅ Main module loaded');
