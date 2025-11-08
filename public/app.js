// Версия приложения (обновляйте при каждом изменении)
const APP_VERSION = '3.5.3';

// Глобальный обработчик ошибок
window.addEventListener('error', function(e) {
    console.log('🛠️ Global error handler:', e.error);
    return true; // Предотвращает падение приложения
});

// Обработчик необработанных промисов
window.addEventListener('unhandledrejection', function(e) {
    console.log('🛠️ Unhandled promise rejection:', e.reason);
    e.preventDefault();
});

// Инициализация перехватчика для автоматического добавления токенов
(function initAuthInterceptor() {
  console.log('🔧 [AUTH] Инициализация перехватчика аутентификации');
  
  const originalFetch = window.fetch;
  
  window.fetch = async function(...args) {
    const [resource, config = {}] = args;
    
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
})();

// Проверка версии и очистка кеша при обновлении
(function checkVersion() {
  const storedVersion = localStorage.getItem('appVersion');
  console.log('🔄 [VERSION] Текущая версия:', APP_VERSION);
  console.log('🔄 [VERSION] Сохраненная версия:', storedVersion);
  
  if (storedVersion !== APP_VERSION) {
    console.log('⚠️ [VERSION] Обнаружено обновление! Очистка кеша...');
    
    // Сохраняем важные данные перед очисткой
    const authToken = localStorage.getItem('authToken');
    const currentUserData = localStorage.getItem('currentUser');
    
    // Очищаем localStorage
    localStorage.clear();
    
    // Восстанавливаем важные данные
    if (authToken) localStorage.setItem('authToken', authToken);
    if (currentUserData) localStorage.setItem('currentUser', currentUserData);
    
    // Сохраняем новую версию
    localStorage.setItem('appVersion', APP_VERSION);
    
    // Очищаем кеш браузера
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
        console.log('✅ [VERSION] Кеш браузера очищен');
      });
    }
    
    console.log('✅ [VERSION] Обновление завершено. Версия:', APP_VERSION);
    
    // Перезагружаем страницу для применения изменений
    if (storedVersion) { // Перезагружаем только если была старая версия
      console.log('🔄 [VERSION] Перезагрузка страницы...');
      setTimeout(() => location.reload(true), 500);
      return;
    }
  } else {
    console.log('✅ [VERSION] Версия актуальна');
  }
  
  // Проверка токена на валидность (проверяем наличие id или telegram_id)
  const token = localStorage.getItem('authToken');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('🔍 [TOKEN] Проверка токена:', payload);
      
      if (!payload.id && !payload.telegram_id) {
        console.warn('⚠️ [TOKEN] Токен устаревший (нет id и telegram_id). Очистка...');
        
        // Проверяем, не показывали ли мы уже это сообщение
        const tokenCleanupShown = sessionStorage.getItem('tokenCleanupShown');
        
        if (!tokenCleanupShown) {
          // Удаляем токен
          localStorage.removeItem('authToken');
          console.log('✅ [TOKEN] Старый токен удалён.');
          
          // Отмечаем, что показали сообщение
          sessionStorage.setItem('tokenCleanupShown', 'true');
          
          // Показываем уведомление БЕЗ автоматической перезагрузки
          alert('Требуется повторная авторизация. Пожалуйста, перезагрузите страницу.');
        } else {
          // Если уже показывали - просто удаляем токен без alert
          localStorage.removeItem('authToken');
          console.log('✅ [TOKEN] Старый токен удалён (повторная проверка).');
        }
      } else {
        console.log('✅ [TOKEN] Токен валидный');
      }
    } catch (e) {
      console.error('❌ [TOKEN] Ошибка проверки токена:', e);
      localStorage.removeItem('authToken');
    }
  }
})();

// Глобальные переменные
let currentUser = null;
let products = [];
let orders = [];
let favorites = [];
let searchSuggestions = [];
let currentFilters = {
  category: '',
  price: '',
  sort: 'newest',
  stock: ''
};

// Экспортируем переменные в window для совместимости
window.currentUser = currentUser;
window.orders = orders;

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
      
      // Авторизация
      authTitle: 'Загрузка...',
      authDescription: 'Подключение к системе...',
      authButton: 'Повторить попытку',
      logout: 'Выйти',
  
      // Каталог и фильтры
      home: 'Главная',
      catalog: 'Каталог',
      searchPlaceholder: 'Поиск услуг...',
      filterCategory: 'Категория',
      filterPrice: 'Цена',
      filterSort: 'Сортировка',
      filterStock: 'Наличие',
      allCategories: 'Все категории',
      anyPrice: 'Любая цена',
      sortNewest: 'Сначала новые',
      sortPopular: 'По популярности',
      sortPriceLow: 'По возрастанию цены',
      sortPriceHigh: 'По убыванию цены',
      sortRating: 'По рейтингу',
      stockAll: 'Все',
      stockIn: 'В наличии',
      stockLow: 'Ограниченное количество',
      noProducts: 'Товары не найдены',
      tryChangeFilters: 'Попробуйте изменить фильтры поиска',
      priceTo1000: 'До 1000 ₽',
      price1000_5000: '1000-5000 ₽',
      price5000_10000: '5000-10000 ₽',
      priceMore10000: 'Более 10000 ₽',
  
      // Категории
      popularCategories: 'Популярные категории',
      categoryDevelopment: 'Разработка',
      categoryConsultation: 'Консультации',
      categoryDesign: 'Дизайн',
      categoryOther: 'Другое',
  
      // Карточка товара
      inStock: 'В наличии',
      outOfStock: 'Нет в наличии',
      order: 'Заказать',
      addToFavorites: 'В избранное',
      inFavorites: 'В избранном',
      share: 'Поделиться',
      badgeHit: 'ХИТ',
      badgeNew: 'НОВИНКА',
      badgeSale: 'СКИДКА',
      badgeLimited: 'ОГРАНИЧЕННО',
      reviewsCount: (n) => `${n} ${n === 1 ? 'отзыв' : (n > 1 && n < 5) ? 'отзыва' : 'отзывов'}`,
      
      // Детали товара
      productReviews: 'Отзывы о товаре',
      noDescription: 'Описание отсутствует',
  
      // Заказы
      myOrders: 'Мои заказы',
      orderNumber: 'Заказ №',
      orderDate: 'Дата заказа',
      orderStatus: 'Статус',
      orderPrice: 'Сумма',
      orderProduct: 'Товар',
      statusPending: 'Ожидает оплаты',
      statusPaid: 'Оплачен',
      statusProcessing: 'В обработке',
      statusCompleted: 'Завершён',
      statusCancelled: 'Отменён',
      statusExpired: 'Истёк',
      cancelOrder: 'Отменить заказ',
      cancelOrderConfirm: 'Вы уверены, что хотите отменить этот заказ?',
      orderCancelled: 'Заказ отменён',
      payAgain: 'Оплатить снова',
      timeLeft: 'Осталось времени',
      expiresIn: 'Истекает через',
      noOrders: 'У вас пока нет заказов',
      startShopping: 'Начните делать покупки!',
      
      // Отзывы
      leaveReview: 'Оставить отзыв',
      rating: 'Оценка',
      reviewText: 'Ваш отзыв',
      submit: 'Отправить',
      reviewSubmitted: 'Спасибо за отзыв!',
      selectRating: 'Пожалуйста, выберите оценку',
      reviews: 'Отзывы',
      noReviews: 'Отзывов пока нет',
  
      // Поддержка
      support: 'Поддержка',
      supportTitle: 'Поддержка',
      faq: 'Часто задаваемые вопросы',
      faq1_q: 'Как оплатить заказ?',
      faq1_a: 'Оплата производится в USDT через блокчейны Arbitrum или Optimism.',
      faq2_q: 'Сколько времени занимает выполнение?',
      faq2_a: 'Время выполнения зависит от сложности услуги, обычно 1-7 дней.',
      contactUs: 'Связаться с нами',
      contactTelegram: 'Написать в Telegram',
  
      // Админ-панель и модальные окна
      addService: 'Добавить услугу',
      submit: 'Отправить',
      addServiceTitle: 'Добавить услугу',
      formName: 'Название *',
      formDescription: 'Описание',
      formPrice: 'Цена *',
      formCategory: 'Категория',
      formStock: 'Остаток',
      formInfiniteStock: 'Бесконечный остаток',
      formImage: 'Изображение',
      save: 'Сохранить',
      confirmDelete: 'Вы уверены, что хотите удалить этот товар?',
      
      // Модальное окно заказа
      orderModalTitle: 'Оформление заказа',
      orderSummaryTitle: 'Сводка заказа',
      paymentMethodTitle: 'Способ оплаты',
      confirmPayment: 'Оплатить',
  
      // Модальное окно отзывов
      reviewsModalTitle: 'Отзывы о товаре',
      leaveReviewTitle: 'Оставить отзыв',
      yourRating: 'Оценка:',
      yourReviewPlaceholder: 'Ваш отзыв...',
      sendReview: 'Отправить отзыв',
  
      // Сообщения
      successAdd: 'Услуга добавлена!',
      successEdit: 'Услуга обновлена!',
      successDelete: 'Услуга удалена!',
    },
    en: {
      // General
      shopTitle: 'Service Shop',
      shopSubtitle: 'Professional development and consulting services',
      loading: 'Loading...',
      price: 'Price',
      date: 'Date',
      cancel: 'Cancel',
      send: 'Send',
      error: 'Error',
      details: 'Details',
      langRu: 'Русский',
      langEn: 'English',
  
      // Auth
      authTitle: 'Login to the Shop',
      authDescription: 'To access the services, you need to log in via Telegram',
      authButton: 'Login with Telegram',
      logout: 'Logout',
  
      // Catalog & Filters
      home: 'Home',
      catalog: 'Catalog',
      searchPlaceholder: 'Search services...',
      filterCategory: 'Category',
      filterPrice: 'Price',
      filterSort: 'Sort by',
      filterStock: 'Availability',
      allCategories: 'All categories',
      anyPrice: 'Any price',
      sortNewest: 'Newest first',
      sortPopular: 'Popularity',
      sortPriceLow: 'Price: Low to High',
      sortPriceHigh: 'Price: High to Low',
      sortRating: 'Rating',
      stockAll: 'All',
      stockIn: 'In stock',
      stockLow: 'Limited stock',
      noProducts: 'No products found',
      tryChangeFilters: 'Try changing the search filters',
      priceTo1000: 'Up to $10',
      price1000_5000: '$10-$50',
      price5000_10000: '$50-$100',
      priceMore10000: 'More than $100',
  
      // Categories
      popularCategories: 'Popular Categories',
      categoryDevelopment: 'Development',
      categoryConsultation: 'Consulting',
      categoryDesign: 'Design',
      categoryOther: 'Other',
  
      // Product Card
      inStock: 'In stock',
      outOfStock: 'Out of stock',
      order: 'Order',
      addToFavorites: 'Add to favorites',
      inFavorites: 'In favorites',
      share: 'Share',
      badgeHit: 'HIT',
      badgeNew: 'NEW',
      badgeSale: 'SALE',
      badgeLimited: 'LIMITED',
      reviewsCount: (n) => `${n} ${n === 1 ? 'review' : 'reviews'}`,
  
      // Product Details
      productReviews: 'Product reviews',
      noDescription: 'No description provided',
  
      // Orders
      myOrders: 'My Orders',
      statusPending: 'Pending',
      statusProcessing: 'Processing',
      statusCompleted: 'Completed',
      statusCancelled: 'Cancelled',
  
      // Support
      support: 'Support',
      supportTitle: 'Support',
      faq: 'Frequently Asked Questions',
      faq1_q: 'How to pay for the order?',
      faq1_a: 'Payment is made in USDT through Arbitrum or Optimism blockchains.',
      faq2_q: 'How long does it take to complete?',
      faq2_a: 'Completion time depends on the complexity of the service, usually 1-7 days.',
      contactUs: 'Contact Us',
      contactTelegram: 'Write to Telegram',
  
      // Admin panel and modals
      addService: 'Add Service',
      addServiceTitle: 'Add Service',
      formName: 'Name *',
      formDescription: 'Description',
      formPrice: 'Price *',
      formCategory: 'Category',
      formStock: 'Stock',
      formInfiniteStock: 'Infinite stock',
      formImage: 'Image',
      save: 'Save',
      confirmDelete: 'Are you sure you want to delete this product?',
      
      // Order modal
      orderModalTitle: 'Order Processing',
      orderSummaryTitle: 'Order Summary',
      paymentMethodTitle: 'Payment Method',
      confirmPayment: 'Pay',
  
      // Reviews modal
      reviewsModalTitle: 'Product Reviews',
      leaveReviewTitle: 'Leave a Review',
      yourRating: 'Rating:',
      yourReviewPlaceholder: 'Your review...',
      sendReview: 'Send Review',
  
      // Messages
      successAdd: 'Service added!',
      successEdit: 'Service updated!',
      successDelete: 'Service deleted!',
    }
};

let currentLang = localStorage.getItem('lang') || 'ru';

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  applyTranslations();
}

function applyTranslations() {
    const t = translations[currentLang];
  
    // Проставляем язык для всего документа
    document.documentElement.lang = currentLang;
  
    // Обновляем все элементы с атрибутом data-lang
    document.querySelectorAll('[data-lang]').forEach(el => {
      const key = el.dataset.lang;
      if (t[key]) {
        // Для инпутов используем placeholder, для остальных - textContent
        if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
          el.placeholder = t[key];
        } else {
          el.textContent = t[key];
        }
      }
    });
  
    // Обновляем опции в select-ах
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter && categoryFilter.options[0]) {
        categoryFilter.options[0].textContent = t.allCategories;
    }
    
    const priceFilter = document.getElementById('priceFilter');
    if (priceFilter && priceFilter.options[0]) {
        priceFilter.options[0].textContent = t.anyPrice;
    }
    
    // Обновляем динамические тексты (которые зависят от данных, а не статичны)
    // Это важно вызывать при каждой смене языка
    filterProducts(); 
    // Если у вас есть функция для отображения заказов, ее тоже нужно вызвать
    // loadOrders(); 
  }

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем Telegram Web App сразу если доступен
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }
    
    // Запускаем инициализацию приложения без задержки
    initializeApp();
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener('change', e => setLang(e.target.value));
    }
    applyTranslations();
});

// Инициализация приложения
function initializeApp() {
    // Проверяем, есть ли сохраненный токен
    const token = localStorage.getItem('authToken');
    if (token) {
        // Пытаемся восстановить сессию
        restoreSession(token);
    } else {
        // Автоматически пытаемся авторизоваться
        autoAuth();
    }

    // Загружаем данные из localStorage
    loadLocalData();

    // Обработчики событий
    setupEventListeners();
}

// Загрузка данных из localStorage
function loadLocalData() {
    favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
}

// Сохранение данных в localStorage
function saveLocalData() {
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопка авторизации
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
        authBtn.addEventListener('click', handleAuth);
    }

    // Кнопка выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Кнопка "Мои заказы"
    const myOrdersBtn = document.getElementById('myOrdersBtn');
    if (myOrdersBtn) {
        myOrdersBtn.addEventListener('click', showOrdersModal);
    }

    // Модальное окно заказов
    const closeOrdersModal = document.getElementById('closeOrdersModal');
    if (closeOrdersModal) {
        closeOrdersModal.addEventListener('click', () => {
            document.getElementById('ordersModal').style.display = 'none';
        });
    }

    // Модальное окно отзывов
    const closeReviewModal = document.getElementById('closeReviewModal');
    const cancelReviewBtn = document.getElementById('cancelReviewBtn');
    const reviewForm = document.getElementById('reviewForm');
    
    if (closeReviewModal) {
        closeReviewModal.addEventListener('click', () => {
            document.getElementById('reviewModal').style.display = 'none';
        });
    }
    
    if (cancelReviewBtn) {
        cancelReviewBtn.addEventListener('click', () => {
            document.getElementById('reviewModal').style.display = 'none';
        });
    }
    
    if (reviewForm) {
        reviewForm.addEventListener('submit', window.handleReviewSubmit || handleReviewSubmit);
    }
    
    // Локальная функция отправки отзыва (если не определена в orders-manager.js)
    async function handleReviewSubmit(e) {
        e.preventDefault();
        console.log('⭐ [REVIEW] Отправка отзыва');
        
        const productId = document.getElementById('reviewProductId').value;
        const orderId = document.getElementById('reviewOrderId').value;
        const rating = document.getElementById('ratingValue').value;
        const text = document.getElementById('reviewText').value;
        
        if (!rating) {
            showError('Пожалуйста, выберите оценку');
            return;
        }
        
        try {
            showLoading();
            
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    product_id: productId,
                    order_id: orderId,
                    rating: parseInt(rating),
                    comment: text
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка отправки отзыва');
            }
            
            console.log('✅ [REVIEW] Отзыв отправлен');
            showSuccess('Спасибо за отзыв!');
            
            // Закрываем модальное окно
            document.getElementById('reviewModal').style.display = 'none';
            
            // Перезагружаем товары для обновления рейтинга
            if (typeof loadProducts === 'function') {
                await loadProducts(true);
                filterProducts();
            }
            
        } catch (error) {
            console.error('❌ [REVIEW] Ошибка:', error);
            showError(error.message);
        } finally {
            hideLoading();
        }
    }

    // Система рейтинга
    const ratingStars = document.querySelectorAll('#ratingInput .star');
    ratingStars.forEach(star => {
        star.addEventListener('click', function() {
            const rating = this.getAttribute('data-rating');
            document.getElementById('ratingValue').value = rating;
            
            // Обновляем визуальное отображение
            ratingStars.forEach((s, index) => {
                if (index < rating) {
                    s.textContent = '★'; // Заполненная звезда
                    s.classList.add('active');
                } else {
                    s.textContent = '☆'; // Пустая звезда
                    s.classList.remove('active');
                }
            });
        });
    });

    // Поиск с автодополнением
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('focus', showSearchSuggestions);
        searchInput.addEventListener('blur', hideSearchSuggestions);
    }

    // Фильтры
    const priceFrom = document.getElementById('priceFrom');
    if (priceFrom) {
        priceFrom.addEventListener('input', handleFilterChange);
    }

    const priceTo = document.getElementById('priceTo');
    if (priceTo) {
        priceTo.addEventListener('input', handleFilterChange);
    }

    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
        sortFilter.addEventListener('change', handleFilterChange);
    }

    const stockFilter = document.getElementById('stockFilter');
    if (stockFilter) {
        stockFilter.addEventListener('change', handleFilterChange);
    }

    // Модальные окна
    setupModalListeners();
    
    // Модальное окно отзывов
    const reviewsModal = document.getElementById('reviewsModal');
    if (reviewsModal) {
        const closeBtn = reviewsModal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                reviewsModal.style.display = 'none';
            });
        }
        
        // Закрытие по клику вне модального окна
        reviewsModal.addEventListener('click', (e) => {
            if (e.target === reviewsModal) {
                reviewsModal.style.display = 'none';
            }
        });
    }

    // Админ: обработчики для добавления услуги
    const adminAddServiceBtn = document.getElementById('adminAddServiceBtn');
    const addServiceModal = document.getElementById('addServiceModal');
    const closeAddServiceModal = document.getElementById('closeAddServiceModal');
    const cancelAddServiceBtn = document.getElementById('cancelAddServiceBtn');
    const addServiceForm = document.getElementById('addServiceForm');

    if (adminAddServiceBtn) {
        adminAddServiceBtn.addEventListener('click', function() {
            addServiceModal.style.display = 'block';
        });
    }
    if (closeAddServiceModal) {
        closeAddServiceModal.addEventListener('click', function() {
            addServiceModal.style.display = 'none';
        });
    }
    if (cancelAddServiceBtn) {
        cancelAddServiceBtn.addEventListener('click', function() {
            addServiceModal.style.display = 'none';
        });
    }
    if (addServiceForm) {
        addServiceForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            try {
                const formData = new FormData(addServiceForm);
                
                // Валидация: хотя бы одна цена должна быть заполнена
                const priceTon = parseFloat(formData.get('price_ton')) || 0;
                const priceUsdt = parseFloat(formData.get('price_usdt')) || 0;
                const priceStars = parseInt(formData.get('price_stars')) || 0;
                
                if (priceTon === 0 && priceUsdt === 0 && priceStars === 0) {
                    showError('Заполните хотя бы одну цену (TON, USDT или Stars)');
                    return;
                }
                
                // Автоматически заполняем поле price для совместимости
                // Берем первую ненулевую цену
                const compatPrice = priceTon || priceUsdt || (priceStars / 100) || 1;
                formData.set('price', compatPrice);
                
                showLoading();
                const token = localStorage.getItem('authToken');
                
                // Преобразуем FormData в JSON
                const productData = {
                    name: formData.get('name'),
                    description: formData.get('description'),
                    price: compatPrice,
                    price_ton: priceTon || null,
                    price_usdt: priceUsdt || null,
                    price_stars: priceStars || null,
                    category: formData.get('category') || 'other',
                    image_url: formData.get('image_url') || null,
                    file_path: formData.get('file_path') || null,
                    stock: parseInt(formData.get('stock')) || 999
                };
                
                console.log('📦 [CREATE] Отправка данных товара:', productData);
                
                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(productData)
                });
                if (!response.ok) throw new Error('Ошибка добавления услуги');
                showSuccess('Услуга добавлена!');
                addServiceModal.style.display = 'none';
                addServiceForm.reset();
                await loadProducts();
            } catch (err) {
                showError('Ошибка добавления услуги');
                console.error('Ошибка добавления услуги:', err);
            } finally {
                hideLoading();
            }
        });
    }

    // Обработчик чекбокса "Бесконечность" в форме добавления услуги
    const infiniteStockCheckbox = document.querySelector('#addServiceForm input[name="infinite_stock"]');
    if (infiniteStockCheckbox) {
        infiniteStockCheckbox.addEventListener('change', function() {
            const stockInput = document.querySelector('#addServiceForm input[name="stock"]');
            if (this.checked) {
                stockInput.disabled = true;
                stockInput.value = 0;
            } else {
                stockInput.disabled = false;
            }
        });
    }
}

// Настройка обработчиков модальных окон
function setupModalListeners() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                modal.style.display = 'none';
            });
        }

        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Автоматическая авторизация при загрузке
async function autoAuth() {
    console.log('🔐 [AUTH] ========== НАЧАЛО АВТОМАТИЧЕСКОЙ АВТОРИЗАЦИИ ==========');
    try {
        showLoading();
        
        // Добавляем отладочную информацию
        console.log('🔍 [AUTH] Отладка Telegram Web App:');
        console.log('🔍 [AUTH] - window.Telegram:', window.Telegram);
        console.log('🔍 [AUTH] - WebApp:', window.Telegram?.WebApp);
        console.log('🔍 [AUTH] - initData:', window.Telegram?.WebApp?.initData);
        console.log('🔍 [AUTH] - initDataUnsafe:', window.Telegram?.WebApp?.initDataUnsafe);
        
        // Инициализируем Telegram Web App если доступен
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            console.log('📱 Telegram WebApp инициализирован');
        }
        
        // Проверяем различные способы получения данных пользователя
        let telegramUser = null;
        
        // Способ 1: через initDataUnsafe
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
            console.log('✅ Пользователь найден через initDataUnsafe:', telegramUser);
        }
        
        // Способ 2: парсинг initData
        if (!telegramUser && window.Telegram?.WebApp?.initData) {
            try {
                const initData = window.Telegram.WebApp.initData;
                const urlParams = new URLSearchParams(initData);
                const userParam = urlParams.get('user');
                if (userParam) {
                    telegramUser = JSON.parse(decodeURIComponent(userParam));
                    console.log('✅ Пользователь найден через парсинг initData:', telegramUser);
                }
            } catch (e) {
                console.log('⚠️ Ошибка парсинга initData:', e);
            }
        }
        
        // Способ 3: проверяем URL параметры
        if (!telegramUser) {
            const urlParams = new URLSearchParams(window.location.search);
            const tgWebAppData = urlParams.get('tgWebAppData');
            if (tgWebAppData) {
                try {
                    const decodedData = decodeURIComponent(tgWebAppData);
                    const dataParams = new URLSearchParams(decodedData);
                    const userParam = dataParams.get('user');
                    if (userParam) {
                        telegramUser = JSON.parse(userParam);
                        console.log('✅ Пользователь найден через URL параметры:', telegramUser);
                    }
                } catch (e) {
                    console.log('⚠️ Ошибка парсинга URL параметров:', e);
                }
            }
        }
        
        // Способ 4: проверяем глобальные переменные Telegram
        if (!telegramUser && window.TelegramWebviewProxy) {
            console.log('📱 Найден TelegramWebviewProxy, пытаемся получить данные...');
        }
        
        // Способ 5: проверяем hash в URL
        if (!telegramUser && window.location.hash) {
            try {
                const hash = window.location.hash.substring(1);
                const hashParams = new URLSearchParams(hash);
                const userParam = hashParams.get('user');
                if (userParam) {
                    telegramUser = JSON.parse(decodeURIComponent(userParam));
                    console.log('✅ Пользователь найден через hash:', telegramUser);
                }
            } catch (e) {
                console.log('⚠️ Ошибка парсинга hash:', e);
            }
        }
        
        if (telegramUser && telegramUser.id) {
            console.log('✅ [AUTH] Авторизуем пользователя Telegram:', telegramUser);
            await authenticateUser(telegramUser.id, telegramUser.username, telegramUser.first_name, telegramUser.last_name);
            console.log('✅ [AUTH] Авторизация через Telegram завершена успешно');
            return;
        } else {
            console.log('⚠️ [AUTH] Данные пользователя Telegram не найдены, используем тестовый режим');
        }
        
        // Если нет данных Telegram или не в Telegram, используем тестовые данные
        const testUser = {
            id: 853232715, // Админский ID для тестирования
            username: 'admin',
            first_name: 'Admin',
            last_name: 'User'
        };
        console.log('🔐 [AUTH] Используем тестового пользователя:', testUser);
        await authenticateUser(testUser.id, testUser.username, testUser.first_name, testUser.last_name);
        console.log('✅ [AUTH] Авторизация тестового пользователя завершена');
        
    } catch (error) {
        console.error('❌ [AUTH] КРИТИЧЕСКАЯ ОШИБКА автоматической авторизации:', error);
        console.error('❌ [AUTH] Stack trace:', error.stack);
        // В случае ошибки показываем форму авторизации
        showAuthSection();
    } finally {
        hideLoading();
        console.log('🔐 [AUTH] ========== КОНЕЦ АВТОМАТИЧЕСКОЙ АВТОРИЗАЦИИ ==========');
    }
}

// Обработка авторизации
async function handleAuth() {
    try {
        showLoading();
        
        // Получаем данные пользователя из Telegram Web App
        const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        
        if (!telegramUser) {
            // Если нет данных Telegram, используем тестовые данные
            const testUser = {
                id: Math.floor(Math.random() * 1000000),
                username: 'test_user_' + Math.floor(Math.random() * 1000)
            };
            await authenticateUser(testUser.id, testUser.username);
        } else {
            await authenticateUser(telegramUser.id, telegramUser.username);
        }
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        showError('Ошибка авторизации. Попробуйте еще раз.');
    } finally {
        hideLoading();
    }
}

// Авторизация пользователя
async function authenticateUser(telegramId, username, firstName, lastName) {
    console.log('👤 [AUTH] Начало аутентификации пользователя');
    console.log('👤 [AUTH] Параметры:', { telegramId, username, firstName, lastName });
    try {
        const authData = {
            telegram_id: telegramId.toString(),
            username: username || 'user_' + telegramId,
            first_name: firstName || '',
            last_name: lastName || ''
        };
        
        console.log('👤 [AUTH] Отправка на /api/auth:', authData);
        
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(authData)
        });

        console.log('👤 [AUTH] Ответ сервера - Статус:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [AUTH] Ошибка авторизации:', errorText);
            throw new Error('Ошибка авторизации');
        }

        const data = await response.json();
        console.log('👤 [AUTH] Данные от сервера:', data);
        
        // Сохраняем токен и данные пользователя
        console.log('👤 [AUTH] Сохранение токена и данных пользователя...');
        localStorage.setItem('authToken', data.token);
        currentUser = data.user;
        window.currentUser = data.user; // Обновляем глобальную переменную
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        console.log('✅ [AUTH] Данные сохранены. Текущий пользователь:', currentUser);
        console.log('✅ [AUTH] is_admin:', currentUser.is_admin, 'isAdmin:', currentUser.isAdmin);
        
        // Показываем основной контент
        console.log('👤 [AUTH] Отображение основного контента...');
        showMainContent();
        showUserInfo();
        
        // Загружаем данные
        console.log('👤 [AUTH] Загрузка товаров и заказов...');
        await loadProducts();
        await loadOrders();
        console.log('✅ [AUTH] Аутентификация завершена успешно!');
        
    } catch (error) {
        console.error('❌ [AUTH] Ошибка аутентификации:', error);
        console.error('❌ [AUTH] Stack trace:', error.stack);
        throw error;
    }
}

// Восстановление сессии
async function restoreSession(token) {
    try {
        // Пытаемся получить данные пользователя из токена или localStorage
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                window.currentUser = currentUser; // Обновляем глобальную переменную
                console.log('✅ [RESTORE] Восстановлен пользователь:', currentUser);
                console.log('✅ [RESTORE] is_admin:', currentUser.is_admin, 'isAdmin:', currentUser.isAdmin);
            } catch (e) {
                console.error('Ошибка парсинга сохраненного пользователя:', e);
            }
        }
        
        showMainContent();
        showUserInfo(); // Показываем информацию о пользователе сразу
        await loadProducts();
        await loadOrders();
    } catch (error) {
        console.error('Ошибка восстановления сессии:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        showAuthSection();
    }
}

// Обработка выхода
function handleLogout() {
    console.log('🚪 [LOGOUT] Выход из системы');
    
    // Очищаем данные
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    currentUser = null;
    window.currentUser = null;
    products = [];
    orders = [];
    
    // Показываем секцию авторизации
    showAuthSection();
    
    // Запускаем повторную авторизацию через Telegram
    console.log('🔄 [LOGOUT] Запуск повторной авторизации...');
    setTimeout(() => {
        autoAuth();
    }, 500);
}

// Показать секцию авторизации
function showAuthSection() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('userInfo').style.display = 'none';
}

function showMainContent() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('userInfo').style.display = 'flex';
    
    // Применяем переводы после показа контента
    setTimeout(() => {
        applyTranslations();
    }, 100);
    
    // Используем showUserInfo() для отображения имени и админ кнопок
    showUserInfo();
}

// Загрузка товаров
async function loadProducts(forceReload = false) {
    console.log('📦 [LOAD] Начало загрузки товаров, forceReload:', forceReload);
    try {
        showLoading();
        // Добавляем timestamp для предотвращения кеширования
        const timestamp = new Date().getTime();
        const headers = {};
        
        // При принудительной перезагрузке отключаем кеш полностью
        if (forceReload) {
            headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            headers['Pragma'] = 'no-cache';
            headers['Expires'] = '0';
            console.log('📦 [LOAD] Принудительная перезагрузка - кеш отключен');
        }
        
        const url = `/api/products?_t=${timestamp}`;
        console.log('📦 [LOAD] URL запроса:', url);
        console.log('📦 [LOAD] Заголовки запроса:', headers);
        
        const response = await fetch(url, {
            headers: headers,
            cache: forceReload ? 'no-store' : 'default'
        });
        
        console.log('📦 [LOAD] Ответ сервера - Статус:', response.status, response.statusText);
        console.log('📦 [LOAD] Заголовки ответа:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [LOAD] Ошибка загрузки:', errorText);
            throw new Error('Ошибка загрузки товаров');
        }
        
        const rawProducts = await response.json();
        console.log('✅ [LOAD] Загружено товаров:', rawProducts.length);
        console.log('📦 [LOAD] Первые 3 товара:', rawProducts.slice(0, 3));
        
        // Валидируем и нормализуем данные товаров
        products = rawProducts.map(product => {
            // Безопасно преобразуем цены в числа
            const validatedProduct = {
                ...product,
                price: product.price ? (typeof product.price === 'string' ? parseFloat(product.price) : product.price) : 0,
                price_ton: product.price_ton ? (typeof product.price_ton === 'string' ? parseFloat(product.price_ton) : product.price_ton) : null,
                price_usdt: product.price_usdt ? (typeof product.price_usdt === 'string' ? parseFloat(product.price_usdt) : product.price_usdt) : null,
                price_stars: product.price_stars ? (typeof product.price_stars === 'string' ? parseInt(product.price_stars) : product.price_stars) : null,
                rating: product.rating || 0,
                reviewsCount: product.reviewsCount || 0,
                stock: product.stock || 0,
                infinite_stock: product.infinite_stock || false,
                isHit: product.isHit || false,
                isNew: product.isNew || false,
                isSale: product.isSale || false
            };
            
            // Добавляем дополнительные поля для демонстрации
            validatedProduct.oldPrice = validatedProduct.isSale ? validatedProduct.price * 1.3 : null;
            validatedProduct.saleEnds = validatedProduct.isSale ? new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000) : null;
            
            return validatedProduct;
        });
        
        console.log('✅ [LOAD] Товары после валидации:', products.slice(0, 2));
        
        // Обновляем поисковые подсказки
        updateSearchSuggestions();
        
        // Применяем фильтры
        filterProducts();
        
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        showError('Ошибка загрузки товаров');
    } finally {
        hideLoading();
    }
}

// Форматирование цены товара (в криптовалютах)
function formatPrice(product) {
    const prices = [];
    
    // Добавляем цену в TON если указана
    if (product.price_ton && product.price_ton > 0) {
        const priceTon = typeof product.price_ton === 'string' ? parseFloat(product.price_ton) : product.price_ton;
        if (!isNaN(priceTon)) {
            prices.push(`${priceTon.toFixed(2)} TON`);
        }
    }
    
    // Добавляем цену в USDT если указана
    if (product.price_usdt && product.price_usdt > 0) {
        const priceUsdt = typeof product.price_usdt === 'string' ? parseFloat(product.price_usdt) : product.price_usdt;
        if (!isNaN(priceUsdt)) {
            prices.push(`${priceUsdt.toFixed(2)} USDT`);
        }
    }
    
    // Добавляем цену в Stars если указана
    if (product.price_stars && product.price_stars > 0) {
        const priceStars = typeof product.price_stars === 'string' ? parseInt(product.price_stars) : product.price_stars;
        if (!isNaN(priceStars)) {
            prices.push(`${priceStars} Stars`);
        }
    }
    
    // Если есть криптоцены, показываем их
    if (prices.length > 0) {
        return prices.join(' | ');
    }
    
    // Fallback - показываем обычную цену в долларах
    const fallbackPrice = typeof product.price === 'string' ? parseFloat(product.price) : (product.price || 0);
    return `$${(isNaN(fallbackPrice) ? 0 : fallbackPrice).toFixed(2)}`;
}

// Обновление поисковых подсказок
function updateSearchSuggestions() {
    searchSuggestions = products.map(product => product.name);
}

// Обработка поиска
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const suggestions = searchSuggestions.filter(suggestion => 
        suggestion.toLowerCase().includes(searchTerm)
    );
    
    showSearchSuggestions(suggestions);
    filterProducts();
}

// Показать поисковые подсказки
function showSearchSuggestions(suggestions = []) {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    const searchTerm = document.getElementById('searchInput').value;
    
    if (searchTerm && suggestions.length > 0) {
        suggestionsContainer.innerHTML = suggestions.slice(0, 5).map(suggestion => 
            `<div class="search-suggestion" onclick="selectSuggestion('${suggestion}')">${suggestion}</div>`
        ).join('');
        suggestionsContainer.style.display = 'block';
    } else {
        suggestionsContainer.style.display = 'none';
    }
}

// Скрыть поисковые подсказки
function hideSearchSuggestions() {
    setTimeout(() => {
        document.getElementById('searchSuggestions').style.display = 'none';
    }, 200);
}

// Выбор подсказки
function selectSuggestion(suggestion) {
    document.getElementById('searchInput').value = suggestion;
    hideSearchSuggestions();
    filterProducts();
}

// Обработка изменения фильтров
function handleFilterChange() {
    // Получаем значения диапазона цен
    const priceFrom = document.getElementById('priceFrom').value;
    const priceTo = document.getElementById('priceTo').value;
    
    // Формируем фильтр цены
    if (priceFrom || priceTo) {
        const min = priceFrom ? parseFloat(priceFrom) : 0;
        const max = priceTo ? parseFloat(priceTo) : Infinity;
        currentFilters.priceRange = { min, max };
    } else {
        currentFilters.priceRange = null;
    }
    
    currentFilters.sort = document.getElementById('sortFilter').value;
    currentFilters.stock = document.getElementById('stockFilter').value;
    
    filterProducts();
}

// Фильтрация товаров
function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    let filteredProducts = products;
    
    // Фильтр по поиску
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
    }
    
    // Фильтр по диапазону цен
    if (currentFilters.priceRange) {
        const { min, max } = currentFilters.priceRange;
        filteredProducts = filteredProducts.filter(product => {
            return product.price >= min && product.price <= max;
        });
    }
    
    // Фильтр по наличию
    if (currentFilters.stock) {
        if (currentFilters.stock === 'in-stock') {
            filteredProducts = filteredProducts.filter(product => 
                product.infinite_stock || (product.stock && product.stock > 0)
            );
        }
    }
    
    // Сортировка
    switch (currentFilters.sort) {
        case 'price-low':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        default: // newest
            filteredProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    renderProducts(filteredProducts);
}

// Отображение товаров
function renderProducts(productsToRender) {
    try {
        // Проверяем валидность данных
        if (!productsToRender || !Array.isArray(productsToRender)) {
            console.error('❌ Invalid products data:', productsToRender);
            return;
        }
        
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) {
            console.error('❌ Products grid element not found');
            return;
        }
        
        if (productsToRender.length === 0) {
        productsGrid.innerHTML = `
            <div class="empty-state">
                <h3>${translations[currentLang].noProducts}</h3>
                <p>${translations[currentLang].tryChangeFilters}</p>
            </div>
        `;
        return;
    }
    
    productsGrid.innerHTML = productsToRender.map(product => {
        // Определяем отображение остатка
        let stockDisplay = '';
        let stockClass = '';
        let isAvailable = true;
        
        if (product.infinite_stock) {
            stockDisplay = translations[currentLang].inStock;
            stockClass = 'stock-in';
        } else {
            const stock = product.stock || 0;
            if (stock > 5) {
                stockDisplay = translations[currentLang].inStock;
                stockClass = 'stock-in';
            } else if (stock > 0) {
                stockDisplay = `${translations[currentLang].price} ${stock}`;
                stockClass = 'stock-low';
            } else {
                stockDisplay = translations[currentLang].outOfStock;
                stockClass = 'stock-out';
                isAvailable = false;
            }
        }

        return `
            <div class="product-card slide-up">
                <!-- Бейджи -->
                <div class="product-badges">
                    ${product.isHit ? '<span class="badge badge-hit">Хит</span>' : ''}
                    ${product.isNew ? '<span class="badge badge-new">Новинка</span>' : ''}
                    ${product.isSale ? '<span class="badge badge-sale">Скидка</span>' : ''}
                    ${!product.infinite_stock && product.stock <= 3 ? '<span class="badge badge-limited">Ограниченно</span>' : ''}
                </div>
                
                <!-- Таймер акции -->
                ${product.saleEnds ? `
                    <div class="timer">
                        ⏰ До ${product.saleEnds.toLocaleDateString()}
                    </div>
                ` : ''}
                
                <!-- Действия -->
                <div class="product-actions-overlay">
                    <button class="action-btn" onclick="toggleFavorite(${product.id})" title="${translations[currentLang].details}">
                        ${favorites.includes(product.id) ? '❤️' : '🤍'}
                    </button>
                    <button class="action-btn" onclick="shareProduct(${product.id})" title="Поделиться">
                        📤
                    </button>
                </div>
                
                <!-- Изображение -->
                <div class="product-image">
                    ${product.image_url ? 
                        `<img src="${product.image_url}" alt="${product.name}">` :
                        `<span>🛍️</span>`
                    }
                </div>
                
                <!-- Информация -->
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-description">${product.description || 'Описание отсутствует'}</div>
                    
                    <!-- Рейтинг -->
                    <div class="product-rating">
                        <div class="stars">
                            ${generateStars(product.rating || 0)}
                        </div>
                        <span class="rating-text">${(product.rating || 0).toFixed(1)} (${product.reviewsCount || 0})</span>
                    </div>
                    
                    <!-- Наличие -->
                    <div class="product-stock">
                        <div class="stock-indicator ${stockClass}"></div>
                        <span>${stockDisplay}</span>
                    </div>
                    
                    <!-- Мета информация -->
                    <div class="product-meta">
                        <div class="product-price">
                            ${product.isSale && product.oldPrice ? 
                                `<span class="product-old-price">${formatPrice({...product, price_ton: product.oldPrice})}</span>` : ''
                            }
                            ${formatPrice(product)}
                        </div>
                        <div class="product-category">${getCategoryName(product.category)}</div>
                    </div>
                    
                    <!-- Действия -->
                    <div class="product-actions">
                        <button class="btn-primary" onclick="viewProduct(${product.id})">${translations[currentLang].details}</button>
                        <button class="btn-success" onclick="orderProduct(${product.id})" ${!isAvailable ? 'disabled' : ''}>
                            ${!isAvailable ? translations[currentLang].outOfStock : translations[currentLang].order}
                        </button>
                        ${currentUser && currentUser.is_admin ? `
                            <button class="btn-danger" onclick="deleteProduct(${product.id})" title="Удалить товар">
                                🗑️ Удалить
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    } catch (error) {
        console.error('❌ Error rendering products:', error);
        const productsGrid = document.getElementById('productsGrid');
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="error-state">Ошибка отображения товаров</div>';
        }
    }
}

// Генерация звездочек рейтинга
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return '★'.repeat(fullStars) + 
           (hasHalfStar ? '☆' : '') + 
           '☆'.repeat(emptyStars);
}

// Экспортируем функцию в window для совместимости
window.generateStars = generateStars;

// Переключение избранного
function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(productId);
    }
    saveLocalData();
    filterProducts(); // Перерисовываем для обновления иконок
}

const TELEGRAM_BOT_USERNAME = 'Cryptonajatie_bot';

function shareProduct(productId) {
    try {
        if (!productId) {
            const tgLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?startapp=shop`;
            window.open(tgLink, '_blank');
            return;
        }
        
        // Находим товар в массиве products
        const product = window.products?.find(p => p.id === productId);
        if (!product) {
            console.error('Товар не найден для share:', productId);
            return;
        }
        
        // Создаем текст для отправки
        const productName = product.name || 'Товар';
        const productDescription = product.description || 'Описание отсутствует';
        const productPrice = formatPrice(product);
        
        const shareText = `🛍️ ${productName}\n\n📝 ${productDescription}\n\n💰 Цена: ${productPrice}\n\n👆 Нажмите, чтобы купить!`;
        const tgLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?startapp=shop_${productId}`;
        
        // Используем Telegram WebApp API для отправки
        if (window.Telegram && window.Telegram.WebApp) {
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(tgLink)}&text=${encodeURIComponent(shareText)}`;
            window.Telegram.WebApp.openTelegramLink(shareUrl);
        } else {
            // Fallback - открываем обычную ссылку
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(tgLink)}&text=${encodeURIComponent(shareText)}`;
            window.open(shareUrl, '_blank');
        }
        
    } catch (error) {
        console.error('Ошибка при отправке товара:', error);
        showError('Ошибка при отправке товара');
    }
}

// Функции оплаты разными способами
async function payWithStars(productId) {
    try {
        showLoading();
        
        const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (!user) {
            throw new Error('Данные пользователя недоступны');
        }
        
        // Получаем информацию о товаре
        const product = window.products?.find(p => p.id === productId);
        if (!product || !product.price_stars) {
            throw new Error('Товар не найден или цена в Stars не указана');
        }
        
        // Сначала создаем заказ
        const orderResponse = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: 1,
                payment_method: 'stars'
            })
        });
        
        if (!orderResponse.ok) {
            const error = await orderResponse.json();
            throw new Error(error.error || 'Ошибка создания заказа');
        }
        
        const orderData = await orderResponse.json();
        
        // Теперь создаем инвойс для Stars
        const invoiceResponse = await fetch('/api/create-stars-invoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                orderId: orderData.order?.id || orderData.orderId,
                productId: productId
            })
        });
        
        if (!invoiceResponse.ok) {
            const error = await invoiceResponse.json();
            throw new Error(error.error || 'Ошибка создания инвойса');
        }
        
        const invoiceData = await invoiceResponse.json();
        
        if (!invoiceData.success) {
            throw new Error(invoiceData.error || 'Ошибка создания инвойса');
        }
        
        console.log('✅ [STARS] Инвойс создан:', invoiceData);
        console.log('🔍 [STARS] Проверка Telegram WebApp API:', {
            hasTelegram: !!window.Telegram,
            hasWebApp: !!window.Telegram?.WebApp,
            hasOpenInvoice: !!window.Telegram?.WebApp?.openInvoice,
            invoiceLink: invoiceData.invoice_link
        });
        
        // Проверяем доступность Telegram WebApp API
        if (!window.Telegram?.WebApp?.openInvoice) {
            console.log('⚠️ [STARS] openInvoice недоступен, пробуем альтернативный способ...');
            
            // Альтернативный способ - открываем через openTelegramLink
            if (window.Telegram?.WebApp?.openTelegramLink) {
                window.Telegram.WebApp.openTelegramLink(invoiceData.invoice_link);
                return;
            }
            
            throw new Error('Telegram WebApp API недоступен');
        }
        
        console.log('🎯 [STARS] Открываем платежную форму через openInvoice...');
        
        // Открываем инвойс через Telegram WebApp API
        window.Telegram.WebApp.openInvoice(invoiceData.invoice_link, (status) => {
            console.log('⭐ [STARS] Статус оплаты:', status);
            
            if (status === 'paid') {
                showSuccess('Оплата успешно завершена!');
                // Закрываем модальное окно товара
                document.getElementById('productModal').style.display = 'none';
            } else if (status === 'cancelled') {
                showError('Оплата отменена');
            } else if (status === 'failed') {
                showError('Ошибка оплаты');
            }
        });
        
    } catch (error) {
        console.error('Ошибка оплаты Stars:', error);
        showError('Ошибка оплаты: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function payWithTON(productId) {
    try {
        // Закрываем модальное окно товара
        document.getElementById('productModal').style.display = 'none';
        
        // Открываем модальное окно оплаты с выбором TON
        orderProduct(productId, 'ton');
        
    } catch (error) {
        console.error('Ошибка оплаты TON:', error);
        showError('Ошибка оплаты TON');
    }
}

async function payWithUSDT(productId) {
    try {
        // Закрываем модальное окно товара
        document.getElementById('productModal').style.display = 'none';
        
        // Открываем модальное окно оплаты с выбором USDT
        orderProduct(productId, 'usdt');
        
    } catch (error) {
        console.error('Ошибка оплаты USDT:', error);
        showError('Ошибка оплаты USDT');
    }
}

// Получение названия категории
function getCategoryName(category) {
    const categories = {
        'development': 'Разработка',
        'consultation': 'Консультации',
        'design': 'Дизайн',
        'other': 'Другое'
    };
    return categories[category] || category;
}

// Просмотр товара
async function viewProduct(productId) {
    try {
        const response = await fetch(`/api/products/${productId}`);
        
        if (!response.ok) {
            throw new Error('Товар не найден');
        }
        
        const product = await response.json();
        
        // Определяем отображение остатка
        let stockDisplay = '';
        let stockClass = '';
        let isAvailable = true;
        
        if (product.infinite_stock) {
            stockDisplay = translations[currentLang].inStock;
            stockClass = 'stock-in';
        } else {
            const stock = product.stock || 0;
            if (stock > 5) {
                stockDisplay = translations[currentLang].inStock;
                stockClass = 'stock-in';
            } else if (stock > 0) {
                stockDisplay = `${translations[currentLang].price} ${stock}`;
                stockClass = 'stock-low';
            } else {
                stockDisplay = translations[currentLang].outOfStock;
                stockClass = 'stock-out';
                isAvailable = false;
            }
        }
        
        // Отображаем модальное окно с деталями товара
        const modal = document.getElementById('productModal');
        const details = document.getElementById('productDetails');
        
        details.innerHTML = `
            <div class="product-details">
                <h3>${product.name}</h3>
                <p>${product.description || 'Описание отсутствует'}</p>
                <div class="price">${formatPrice(product)}</div>
                
                <!-- Рейтинг и отзывы -->
                <div class="product-rating">
                    <div class="stars">
                        ${generateStars(product.rating || 0)}
                    </div>
                    <span class="rating-text">${(product.rating || 0).toFixed(1)} (${product.reviewsCount || 0} отзывов)</span>
                    <button class="btn-secondary" onclick="showReviews(${product.id})">${translations[currentLang].reviews}</button>
                </div>
                
                <!-- Наличие -->
                <div class="product-stock">
                    <div class="stock-indicator ${stockClass}"></div>
                    <span>${stockDisplay}</span>
                </div>
                
                <!-- Кнопки оплаты -->
                ${isAvailable ? `
                <div class="payment-options">
                    <h4>Способы оплаты:</h4>
                    <div class="payment-buttons">
                        ${product.price_ton && product.price_ton > 0 ? `
                            <button class="btn-payment btn-ton" onclick="payWithTON(${product.id})">
                                💎 ${product.price_ton.toFixed(2)} TON
                            </button>
                        ` : ''}
                        ${product.price_usdt && product.price_usdt > 0 ? `
                            <button class="btn-payment btn-usdt" onclick="payWithUSDT(${product.id})">
                                💵 ${product.price_usdt.toFixed(2)} USDT
                            </button>
                        ` : ''}
                        ${product.price_stars && product.price_stars > 0 ? `
                            <button class="btn-payment btn-stars" onclick="payWithStars(${product.id})">
                                ⭐ ${product.price_stars} Stars
                            </button>
                        ` : ''}
                    </div>
                </div>
                ` : `
                <div class="out-of-stock-message">
                    <span>${translations[currentLang].outOfStock}</span>
                </div>
                `}
                
                <!-- Дополнительные действия -->
                <div class="product-actions">
                    <button class="btn-secondary" onclick="toggleFavorite(${product.id})">
                        ${favorites.includes(product.id) ? '❤️ В избранном' : '🤍 В избранное'}
                    </button>
                    <button class="btn-secondary" onclick="shareProduct(${product.id})">📤 Поделиться</button>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Ошибка загрузки товара:', error);
        showError('Ошибка загрузки товара');
    }
}

// Инициализация Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

function showLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'flex';
}

function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

function showError(message) {
  alert('Ошибка: ' + message);
}

function showSuccess(message) {
  alert('✅ ' + message);
}

// Показать отзывы товара
async function showReviews(productId) {
  try {
    showLoading();
    
    const response = await fetch(`/api/products/${productId}/reviews`);
    if (!response.ok) {
      throw new Error('Ошибка загрузки отзывов');
    }
    
    const reviews = await response.json();
    
    const reviewsModal = document.getElementById('reviewsModal');
    const reviewsContainer = document.getElementById('reviewsContainer');
    
    if (reviews.length === 0) {
      reviewsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⭐</div>
          <div class="empty-state-title">Пока нет отзывов</div>
          <div class="empty-state-text">Станьте первым, кто оставит отзыв!</div>
        </div>
      `;
    } else {
      reviewsContainer.innerHTML = reviews.map(review => {
        const authorLink = review.telegram_id ? 
          `<a href="https://t.me/${review.telegram_id}" target="_blank" class="review-author-link">${review.author_name}</a>` :
          `<span class="review-author">${review.author_name}</span>`;
          
        return `
          <div class="review-item">
            <div class="review-header">
              <div class="review-author-container">${authorLink}</div>
              <div class="review-rating">
                ${generateStars(review.rating)}
              </div>
              <div class="review-date">${formatDate(review.created_at)}</div>
            </div>
            ${review.comment ? `
              <div class="review-comment">${review.comment}</div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
    
    reviewsModal.style.display = 'block';
    
  } catch (error) {
    console.error('Ошибка загрузки отзывов:', error);
    showError('Ошибка загрузки отзывов');
  } finally {
    hideLoading();
  }
}

// Генерация звёзд для рейтинга
function generateStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return '★'.repeat(fullStars) + 
         (hasHalfStar ? '☆' : '') + 
         '☆'.repeat(emptyStars);
}

// Форматирование даты
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  // Если меньше минуты
  if (diff < 60000) {
    return 'Только что';
  }
  
  // Если меньше часа
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} ${minutes === 1 ? 'минуту' : minutes < 5 ? 'минуты' : 'минут'} назад`;
  }
  
  // Если сегодня
  if (date.toDateString() === now.toDateString()) {
    return `Сегодня в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Если вчера
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Вчера в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Иначе полная дата
  return date.toLocaleDateString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// Дублирующиеся функции удалены - используются версии выше

function showUserInfo() {
  if (!currentUser) {
    console.warn('⚠️ [USER INFO] currentUser не определён');
    return;
  }
  
  console.log('👤 [USER INFO] Отображение информации о пользователе:', currentUser);
  console.log('👤 [USER INFO] is_admin:', currentUser.is_admin, 'isAdmin:', currentUser.isAdmin);
  
  document.getElementById('userInfo').style.display = 'flex';
  
  // Формируем отображаемое имя пользователя
  let displayName = '';
  if (currentUser.firstName || currentUser.first_name || currentUser.lastName || currentUser.last_name) {
    const firstName = currentUser.firstName || currentUser.first_name || '';
    const lastName = currentUser.lastName || currentUser.last_name || '';
    displayName = `${firstName} ${lastName}`.trim();
  } else if (currentUser.username) {
    displayName = currentUser.username;
  } else {
    displayName = 'Пользователь';
  }
  
  console.log('👤 [USER INFO] Отображаемое имя:', displayName);
  document.getElementById('userName').textContent = displayName;

  // Показываем кнопку "Мои заказы"
  const myOrdersBtn = document.getElementById('myOrdersBtn');
  if (myOrdersBtn) {
    myOrdersBtn.style.display = 'block';
    console.log('✅ [USER INFO] Кнопка "Мои заказы" показана');
  }

  // Показываем админ-кнопку, если is_admin или isAdmin
  const isAdmin = currentUser.is_admin || currentUser.isAdmin;
  const adminContainer = document.getElementById('adminAddServiceContainer');
  
  if (adminContainer) {
    if (isAdmin) {
      adminContainer.style.display = 'block';
      console.log('✅ [USER INFO] Админ кнопка показана (is_admin:', currentUser.is_admin, ')');
    } else {
      adminContainer.style.display = 'none';
      console.log('ℹ️ [USER INFO] Админ кнопка скрыта (is_admin:', currentUser.is_admin, ')');
    }
  } else {
    console.warn('⚠️ [USER INFO] Элемент adminAddServiceContainer не найден');
  }
}

async function loadOrders() {
    // Заглушка, чтобы не было ошибки
    return [];
  }

// Функция удаления товара (только для админов)
async function deleteProduct(productId) {
    console.log('🗑️ [DELETE] Начало удаления товара, ID:', productId);
    console.log('🗑️ [DELETE] Текущий список товаров:', products.length, 'шт.');
    
    try {
        // Находим товар для подтверждения
        const product = products.find(p => p.id === productId);
        console.log('🗑️ [DELETE] Найден товар:', product);
        
        if (!product) {
            console.error('❌ [DELETE] Товар не найден в локальном массиве');
            showError('Товар не найден');
            return;
        }

        // Подтверждение удаления
        const confirmText = prompt(`Для подтверждения удаления товара "${product.name}" введите слово "удалить":`);
        if (!confirmText || confirmText.toLowerCase().trim() !== 'удалить') {
            console.log('🗑️ [DELETE] Удаление отменено пользователем');
            return; // Отмена
        }

        showLoading();

        const token = localStorage.getItem('authToken');
        console.log('🗑️ [DELETE] Токен авторизации:', token ? 'Есть' : 'Отсутствует');
        console.log('🗑️ [DELETE] Отправка DELETE запроса на:', `/api/products/${productId}`);
        
        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('🗑️ [DELETE] Ответ сервера - Статус:', response.status, response.statusText);
        console.log('🗑️ [DELETE] Заголовки ответа:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            let errorText = '';
            try {
                const error = await response.json();
                errorText = error.error || 'Ошибка удаления товара';
                console.error('❌ [DELETE] Ошибка от сервера:', error);
            } catch (e) {
                errorText = await response.text();
                console.error('❌ [DELETE] Текст ошибки:', errorText);
            }
            throw new Error(errorText);
        }

        const result = await response.json();
        console.log('✅ [DELETE] Успешный ответ от сервера:', result);
        
        showSuccess('Товар успешно удален!');
        
        // Принудительно очищаем кеш
        console.log('🗑️ [DELETE] Очистка кеша браузера...');
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            console.log('🗑️ [DELETE] Найдено кешей:', cacheNames.length);
            for (const name of cacheNames) {
                await caches.delete(name);
                console.log('🗑️ [DELETE] Удален кеш:', name);
            }
        }
        
        // Удаляем товар из локального массива немедленно
        const index = products.findIndex(p => p.id === productId);
        console.log('🗑️ [DELETE] Индекс товара в массиве:', index);
        if (index > -1) {
            products.splice(index, 1);
            console.log('✅ [DELETE] Товар удален из локального массива. Осталось:', products.length, 'шт.');
        }
        
        // Перерисовываем список товаров с текущими данными
        console.log('🗑️ [DELETE] Перерисовка UI...');
        filterProducts();
        
        // Перезагружаем список товаров с сервера с принудительным обновлением
        console.log('🗑️ [DELETE] Перезагрузка списка товаров с сервера...');
        await loadProducts(true);
        console.log('✅ [DELETE] Удаление завершено успешно!');

    } catch (error) {
        console.error('❌ [DELETE] КРИТИЧЕСКАЯ ОШИБКА:', error);
        console.error('❌ [DELETE] Stack trace:', error.stack);
        showError(error.message || 'Ошибка удаления товара');
    } finally {
        hideLoading();
    }
}

// Функция заказа товара с интеграцией платежей
async function orderProduct(productId) {
  try {
    // Находим товар
    const product = products.find(p => p.id === productId);
    if (!product) {
      showError('Товар не найден');
      return;
    }

    // Получаем токен авторизации
    const token = localStorage.getItem('authToken');
    if (!token) {
      showError('Необходима авторизация. Пожалуйста, авторизуйтесь заново');
      showAuthSection();
      return;
    }

    // Создаем заказ через реальный API
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        product_id: productId
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка создания заказа');
    }

    console.log('✅ [ORDER] Заказ создан:', data);
    console.log('📎 [ORDER] Параметры для оплаты:');
    console.log('  - data.id (orderId):', data.id, typeof data.id);
    console.log('  - productId:', productId, typeof productId);
    console.log('  - product.name:', product.name);
    console.log('  - product.price:', product.price);
    
    // Показываем уведомление
    showSuccess('Заказ создан! Перейдите в "Мои заказы" для оплаты');
    
    // Обновляем список заказов если окно открыто
    if (document.getElementById('ordersModal').style.display === 'block') {
      if (typeof loadOrders === 'function') {
        await loadOrders();
        if (typeof renderOrders === 'function') {
          renderOrders();
        }
      }
    }

    // Показываем опции оплаты
    if (window.paymentManager) {
      console.log('👉 [ORDER] Вызов paymentManager.showPaymentOptions...');
      window.paymentManager.showPaymentOptions(
        data.id, 
        productId, 
        product.name, 
        product.price
      );
    } else {
      // Если нет менеджера платежей, открываем "Мои заказы"
      if (typeof showOrdersModal === 'function') {
        setTimeout(() => showOrdersModal(), 500);
      }
    }

  } catch (error) {
    console.error('❌ [ORDER] Ошибка заказа:', error);
    showError('Ошибка при создании заказа: ' + error.message);
  }
}

// Экспортируем функции оплаты в глобальную область
window.payWithStars = payWithStars;
window.payWithTON = payWithTON;
window.payWithUSDT = payWithUSDT;

// Отладочная информация
console.log('🔧 [EXPORT] Функции оплаты экспортированы:', {
    payWithStars: typeof window.payWithStars,
    payWithTON: typeof window.payWithTON,
    payWithUSDT: typeof window.payWithUSDT
});

// Глобальная функция для тестирования кнопки Stars
window.testStarsButton = function() {
    console.log('🧪 [TEST] Тестирование кнопки Stars...');
    console.log('🔍 [TEST] Доступные функции:', {
        payWithStars: typeof window.payWithStars,
        Telegram: !!window.Telegram,
        WebApp: !!window.Telegram?.WebApp,
        openInvoice: !!window.Telegram?.WebApp?.openInvoice
    });
    
    // Попробуем вызвать функцию с тестовым ID
    if (typeof window.payWithStars === 'function') {
        console.log('✅ [TEST] Функция payWithStars доступна');
        // Не вызываем реальную функцию, только проверяем доступность
    } else {
        console.error('❌ [TEST] Функция payWithStars недоступна');
    }
};