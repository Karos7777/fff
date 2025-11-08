// Утилиты для работы с интерфейсом

// Показать/скрыть загрузку
function showLoading() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = 'block';
  }
}

function hideLoading() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = 'none';
  }
}

// Уведомления
function showSuccess(message) {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.showPopup({
      title: 'Успешно',
      message: message,
      buttons: [{ type: 'ok' }]
    });
  } else {
    alert(message);
  }
}

function showError(message) {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.showPopup({
      title: 'Ошибка',
      message: message,
      buttons: [{ type: 'ok' }]
    });
  } else {
    alert(message);
  }
}

function showNotification(message, type = 'info') {
  console.log(`📢 [${type.toUpperCase()}] ${message}`);
  
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.showPopup({
      title: type === 'error' ? 'Ошибка' : type === 'success' ? 'Успешно' : 'Уведомление',
      message: message,
      buttons: [{ type: 'ok' }]
    });
  } else {
    // Создаем простое уведомление для браузера
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Форматирование цены
function formatPrice(product) {
  const prices = [];
  
  if (product.price_ton && product.price_ton > 0) {
    prices.push(`${product.price_ton.toFixed(2)} TON`);
  }
  
  if (product.price_usdt && product.price_usdt > 0) {
    prices.push(`${product.price_usdt.toFixed(2)} USDT`);
  }
  
  if (product.price_stars && product.price_stars > 0) {
    prices.push(`${product.price_stars} Stars`);
  }
  
  if (prices.length > 0) {
    return prices.join(' | ');
  }
  
  return `$${(product.price || 0).toFixed(2)}`;
}

// Форматирование даты
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Генерация звёзд для рейтинга
function generateStars(rating, maxStars = 5) {
  let stars = '';
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  for (let i = 0; i < fullStars; i++) {
    stars += '★';
  }
  
  if (hasHalfStar) {
    stars += '☆';
  }
  
  const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0);
  for (let i = 0; i < emptyStars; i++) {
    stars += '☆';
  }
  
  return stars;
}

// Получение названия категории
function getCategoryName(category) {
  const categoryNames = {
    'development': window.translations[window.currentLang].development,
    'design': window.translations[window.currentLang].design,
    'consulting': window.translations[window.currentLang].consulting,
    'other': window.translations[window.currentLang].other
  };
  
  return categoryNames[category] || category;
}

// Обновление текста по языку
function updateLanguage() {
  const elements = document.querySelectorAll('[data-lang]');
  elements.forEach(element => {
    const key = element.getAttribute('data-lang');
    if (window.translations[window.currentLang] && window.translations[window.currentLang][key]) {
      element.textContent = window.translations[window.currentLang][key];
    }
  });
}

// Переключение языка
function switchLanguage(lang) {
  window.currentLang = lang;
  localStorage.setItem('language', lang);
  updateLanguage();
  
  // Обновляем интерфейс
  if (typeof filterProducts === 'function') {
    filterProducts();
  }
}

// Работа с избранным
function toggleFavorite(productId) {
  const index = window.favorites.indexOf(productId);
  
  if (index === -1) {
    window.favorites.push(productId);
    showNotification('Товар добавлен в избранное', 'success');
  } else {
    window.favorites.splice(index, 1);
    showNotification('Товар удален из избранного', 'info');
  }
  
  localStorage.setItem('favorites', JSON.stringify(window.favorites));
  
  // Обновляем отображение
  if (typeof filterProducts === 'function') {
    filterProducts();
  }
}

// Проверка авторизации
function checkAuth() {
  const token = localStorage.getItem('authToken');
  return !!token;
}

// Получение токена
function getAuthToken() {
  return localStorage.getItem('authToken');
}

// Выход из системы
function logout() {
  localStorage.removeItem('authToken');
  window.currentUser = null;
  window.location.reload();
}

// Экспорт функций в глобальную область
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showSuccess = showSuccess;
window.showError = showError;
window.showNotification = showNotification;
window.formatPrice = formatPrice;
window.formatDate = formatDate;
window.generateStars = generateStars;
window.getCategoryName = getCategoryName;
window.updateLanguage = updateLanguage;
window.switchLanguage = switchLanguage;
window.toggleFavorite = toggleFavorite;
window.checkAuth = checkAuth;
window.getAuthToken = getAuthToken;
window.logout = logout;
