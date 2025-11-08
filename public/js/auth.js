// auth.js - Модуль аутентификации

// Инициализация перехватчика для автоматического добавления токенов
export function initAuthInterceptor() {
  console.log('🔧 [AUTH] Инициализация перехватчика аутентификации');
  
  const originalFetch = window.fetch;
  
  window.fetch = async function(...args) {
    const [resource, config = {}] = args;
    
    // Блокируем запросы к undefined
    if (typeof resource === 'string' && resource.includes('undefined')) {
      console.error('🚫 [FETCH] Blocked undefined URL:', resource);
      return Promise.reject(new Error('Invalid URL: contains undefined'));
    }
    
    // Добавляем токен в заголовки, если он есть
    const token = localStorage.getItem('authToken');
    if (token && !config.headers?.Authorization) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      };
    }

    const response = await originalFetch(resource, config);

    // Если токен недействителен, очищаем его
    if (response.status === 401) {
      console.log('🔄 [AUTH] Токен недействителен, требуется переаутентификация');
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      
      // В Telegram WebApp пытаемся переаутентифицироваться
      if (window.Telegram?.WebApp) {
        console.log('📱 [AUTH] Попытка автоматической переаутентификации в Telegram');
        setTimeout(() => {
          if (typeof autoAuth === 'function') {
            autoAuth();
          }
        }, 1000);
      }
    }

    return response;
  };
  
  console.log('✅ [AUTH] Перехватчик настроен');
}

// Автоматическая аутентификация через Telegram WebApp
export async function autoAuth() {
  try {
    if (!window.Telegram?.WebApp?.initDataUnsafe?.user) {
      console.log('⚠️ [AUTH] Telegram WebApp данные недоступны');
      return false;
    }

    const user = window.Telegram.WebApp.initDataUnsafe.user;
    const initData = window.Telegram.WebApp.initData;

    console.log('🔐 [AUTH] Попытка автоматической аутентификации');

    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const data = await response.json();
    
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    
    console.log('✅ [AUTH] Аутентификация успешна:', data.user.first_name);
    return true;

  } catch (error) {
    console.error('❌ [AUTH] Ошибка аутентификации:', error);
    return false;
  }
}

// Получить текущего пользователя
export function getCurrentUser() {
  try {
    const userJson = localStorage.getItem('currentUser');
    return userJson ? JSON.parse(userJson) : null;
  } catch (error) {
    console.error('❌ [AUTH] Ошибка получения пользователя:', error);
    return null;
  }
}

// Проверка аутентификации
export function isAuthenticated() {
  return !!localStorage.getItem('authToken');
}

// Выход
export function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  console.log('👋 [AUTH] Выход выполнен');
}
