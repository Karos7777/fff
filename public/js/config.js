// Версия приложения (обновляйте при каждом изменении)
const APP_VERSION = '3.3.0';

// Проверка версии и очистка кеша при обновлении
(function checkVersion() {
  const storedVersion = localStorage.getItem('appVersion');
  console.log('🔄 [VERSION] Текущая версия:', APP_VERSION);
  console.log('🔄 [VERSION] Сохраненная версия:', storedVersion);
  
  if (storedVersion !== APP_VERSION) {
    console.log('⚠️ [VERSION] Обнаружено обновление! Очистка кеша...');
    
    // Очищаем кеш
    localStorage.clear();
    sessionStorage.clear();
    
    // Сохраняем новую версию
    localStorage.setItem('appVersion', APP_VERSION);
    
    console.log('✅ [VERSION] Кеш очищен, версия обновлена');
  }
})();

// Глобальные переменные
let currentUser = null;
let products = [];
let orders = [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentLang = localStorage.getItem('language') || 'ru';

// Фильтры
let currentFilters = {
  category: '',
  price: '',
  sort: 'newest',
  stock: ''
};

// Локализация
const translations = {
    ru: {
      // Общее
      shopTitle: 'Магазин',
      shopSubtitle: '',
      loading: 'Загрузка...',
      price: 'Цена',
      date: 'Дата',
      cancel: 'Отмена',
      send: 'Отправить',
      error: 'Ошибка',
      details: 'Подробнее',
      langRu: 'Русский',
      langEn: 'English',
      
      // Товары
      products: 'Товары',
      noProducts: 'Товары не найдены',
      outOfStock: 'Нет в наличии',
      inStock: 'В наличии',
      addToCart: 'В корзину',
      buyNow: 'Купить сейчас',
      
      // Категории
      allCategories: 'Все категории',
      development: 'Разработка',
      design: 'Дизайн',
      consulting: 'Консультации',
      other: 'Другое',
      
      // Заказы
      myOrders: 'Мои заказы',
      orderStatus: 'Статус заказа',
      pending: 'Ожидает оплаты',
      paid: 'Оплачен',
      expired: 'Истёк',
      cancelled: 'Отменён',
      
      // Отзывы
      reviews: 'Отзывы',
      leaveReview: 'Оставить отзыв',
      rating: 'Оценка',
      reviewText: 'Ваш отзыв',
      noReviews: 'Отзывов пока нет',
      
      // Кнопки
      close: 'Закрыть',
      save: 'Сохранить',
      delete: 'Удалить',
      edit: 'Редактировать',
      submit: 'Отправить',
      back: 'Назад'
    },
    en: {
      // Общее
      shopTitle: 'Shop',
      shopSubtitle: '',
      loading: 'Loading...',
      price: 'Price',
      date: 'Date',
      cancel: 'Cancel',
      send: 'Send',
      error: 'Error',
      details: 'Details',
      langRu: 'Русский',
      langEn: 'English',
      
      // Товары
      products: 'Products',
      noProducts: 'No products found',
      outOfStock: 'Out of stock',
      inStock: 'In stock',
      addToCart: 'Add to cart',
      buyNow: 'Buy now',
      
      // Категории
      allCategories: 'All categories',
      development: 'Development',
      design: 'Design',
      consulting: 'Consulting',
      other: 'Other',
      
      // Заказы
      myOrders: 'My orders',
      orderStatus: 'Order status',
      pending: 'Pending payment',
      paid: 'Paid',
      expired: 'Expired',
      cancelled: 'Cancelled',
      
      // Отзывы
      reviews: 'Reviews',
      leaveReview: 'Leave review',
      rating: 'Rating',
      reviewText: 'Your review',
      noReviews: 'No reviews yet',
      
      // Кнопки
      close: 'Close',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      submit: 'Submit',
      back: 'Back'
    }
};

// Экспорт в глобальную область
window.APP_VERSION = APP_VERSION;
window.currentUser = currentUser;
window.products = products;
window.orders = orders;
window.favorites = favorites;
window.currentLang = currentLang;
window.currentFilters = currentFilters;
window.translations = translations;
