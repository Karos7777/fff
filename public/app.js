// Версия приложения (обновляйте при каждом изменении)
const APP_VERSION = '2.1.2';

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
})();

// Глобальные переменные
let currentUser = null;
let products = [];
let orders = [];
let recentlyViewed = [];
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
      shopTitle: 'Магазин Услуг',
      shopSubtitle: 'Профессиональные услуги разработки и консультации',
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
  
      // Недавно просмотренные
      recentlyViewed: 'Недавно просмотренные',
  
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
  
      // Recently Viewed
      recentlyViewed: 'Recently Viewed',
  
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
    document.getElementById('categoryFilter').options[0].textContent = t.allCategories;
    document.getElementById('priceFilter').options[0].textContent = t.anyPrice;
    
    // Обновляем динамические тексты (которые зависят от данных, а не статичны)
    // Это важно вызывать при каждой смене языка
    filterProducts(); 
    updateRecentlyViewed();
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
    recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
}

// Сохранение данных в localStorage
function saveLocalData() {
    localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
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
        reviewForm.addEventListener('submit', handleReviewSubmit);
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
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', handleFilterChange);
    }

    const priceFilter = document.getElementById('priceFilter');
    if (priceFilter) {
        priceFilter.addEventListener('change', handleFilterChange);
    }

    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
        sortFilter.addEventListener('change', handleFilterChange);
    }

    const stockFilter = document.getElementById('stockFilter');
    if (stockFilter) {
        stockFilter.addEventListener('change', handleFilterChange);
    }

    // Популярные категории
    const categoryCards = document.querySelectorAll('.category-card');
    categoryCards.forEach(card => {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            const category = this.getAttribute('data-category');
            document.getElementById('categoryFilter').value = category;
            handleFilterChange();
        });
    });

    // Модальные окна
    setupModalListeners();

    // Чат поддержки
    const supportToggle = document.getElementById('supportToggle');
    const supportClose = document.getElementById('supportClose');
    const supportPanel = document.getElementById('supportPanel');

    if (supportToggle) {
        supportToggle.addEventListener('click', function() {
            supportPanel.style.display = supportPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (supportClose) {
        supportClose.addEventListener('click', function() {
            supportPanel.style.display = 'none';
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
                showLoading();
                const formData = new FormData(addServiceForm);
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/admin/products', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                if (!response.ok) throw new Error('Ошибка добавления услуги');
                showSuccess('Услуга добавлена!');
                addServiceModal.style.display = 'none';
                addServiceForm.reset();
                await loadProducts();
            } catch (err) {
                showError('Ошибка добавления услуги');
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
    
    document.getElementById('userName').textContent = currentUser.username || 'Пользователь';

    // Показываем админ-кнопку, если is_admin
    if (currentUser.is_admin) {
        document.getElementById('adminAddServiceContainer').style.display = 'block';
    } else {
        document.getElementById('adminAddServiceContainer').style.display = 'none';
    }
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
        
        products = await response.json();
        console.log('✅ [LOAD] Загружено товаров:', products.length);
        console.log('📦 [LOAD] Первые 3 товара:', products.slice(0, 3));
        
        // Добавляем дополнительные поля для демонстрации (если их нет в БД)
        products = products.map(product => ({
            ...product,
            rating: product.rating || 0,
            reviewsCount: product.reviewsCount || 0,
            stock: product.stock || 0,
            infinite_stock: product.infinite_stock || false,
            isHit: product.isHit || false,
            isNew: product.isNew || false,
            isSale: product.isSale || false,
            oldPrice: product.isSale ? product.price * 1.3 : null,
            saleEnds: product.isSale ? new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000) : null
        }));
        
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
    currentFilters.category = document.getElementById('categoryFilter').value;
    currentFilters.price = document.getElementById('priceFilter').value;
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
    
    // Фильтр по категории
    if (currentFilters.category) {
        filteredProducts = filteredProducts.filter(product => product.category === currentFilters.category);
    }
    
    // Фильтр по цене
    if (currentFilters.price) {
        const [min, max] = currentFilters.price.split('-').map(Number);
        filteredProducts = filteredProducts.filter(product => {
            if (max) {
                return product.price >= min && product.price <= max;
            } else {
                return product.price >= min;
            }
        });
    }
    
    // Фильтр по наличию
    if (currentFilters.stock) {
        if (currentFilters.stock === 'in-stock') {
            filteredProducts = filteredProducts.filter(product => 
                product.infinite_stock || (product.stock && product.stock > 5)
            );
        } else if (currentFilters.stock === 'low-stock') {
            filteredProducts = filteredProducts.filter(product => 
                !product.infinite_stock && product.stock && product.stock <= 5 && product.stock > 0
            );
        }
    }
    
    // Сортировка
    switch (currentFilters.sort) {
        case 'popular':
            filteredProducts.sort((a, b) => b.reviewsCount - a.reviewsCount);
            break;
        case 'price-low':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'rating':
            filteredProducts.sort((a, b) => b.rating - a.rating);
            break;
        default: // newest
            filteredProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    renderProducts(filteredProducts);
}

// Отображение товаров
function renderProducts(productsToRender) {
    const productsGrid = document.getElementById('productsGrid');
    
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
                                `<span class="product-old-price">${product.oldPrice.toFixed(2)} $</span>` : ''
                            }
                            ${product.price.toFixed(2)} $
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
    let tgLink = '';
    if (productId) {
        tgLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?startapp=shop_${productId}`;
    } else {
        tgLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?startapp=shop`;
    }
    window.open(tgLink, '_blank');
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
        
        // Добавляем в недавно просмотренные
        addToRecentlyViewed(productId);
        
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
                <div class="price">${product.price.toFixed(2)} $</div>
                
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
                
                <!-- Кнопки действий -->
                <div class="product-actions">
                    <button class="btn-secondary" onclick="toggleFavorite(${product.id})">
                        ${favorites.includes(product.id) ? '❤️ В избранном' : '🤍 В избранное'}
                    </button>
                    <button class="btn-secondary" onclick="shareProduct(${product.id})">📤 Поделиться</button>
                    <button class="btn-success" onclick="orderProduct(${product.id})" ${!isAvailable ? 'disabled' : ''}>
                        ${!isAvailable ? translations[currentLang].outOfStock : translations[currentLang].order}
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Ошибка загрузки товара:', error);
        showError('Ошибка загрузки товара');
    }
}

// Добавление в недавно просмотренные
function addToRecentlyViewed(productId) {
    const index = recentlyViewed.indexOf(productId);
    if (index > -1) {
        recentlyViewed.splice(index, 1);
    }
    recentlyViewed.unshift(productId);
    recentlyViewed = recentlyViewed.slice(0, 10); // Максимум 10 товаров
    saveLocalData();
    updateRecentlyViewed();
}

// Обновление недавно просмотренных
function updateRecentlyViewed() {
    if (recentlyViewed.length === 0) return;
    
    const recentlyViewedProducts = products.filter(p => recentlyViewed.includes(p.id));
    if (recentlyViewedProducts.length === 0) return;
    
    const container = document.getElementById('recentlyViewedGrid');
    container.innerHTML = recentlyViewedProducts.map(product => `
        <div class="product-card slide-up">
            <div class="product-image">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.name}">` :
                    `<span>🛍️</span>`
                }
            </div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-price">${product.price} $</div>
                <div class="product-actions">
                    <button class="btn-primary" onclick="viewProduct(${product.id})">${translations[currentLang].details}</button>
                </div>
            </div>
        </div>
    `).join('');
    
    document.getElementById('recentlyViewed').style.display = 'block';
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

function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// Дублирующиеся функции удалены - используются версии выше

function showUserInfo() {
  if (!currentUser) return;
  
  document.getElementById('userInfo').style.display = 'flex';
  
  // Формируем отображаемое имя пользователя
  let displayName = '';
  if (currentUser.first_name || currentUser.last_name) {
    displayName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim();
  } else if (currentUser.username) {
    displayName = currentUser.username;
  } else {
    displayName = 'Пользователь';
  }
  
  document.getElementById('userName').textContent = displayName;

  // Показываем кнопку "Мои заказы"
  if (typeof showMyOrdersButton === 'function') {
      showMyOrdersButton();
  }

  // Показываем админ-кнопку, если is_admin
  if (currentUser.is_admin) {
      document.getElementById('adminAddServiceContainer').style.display = 'block';
  } else {
      document.getElementById('adminAddServiceContainer').style.display = 'none';
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
        console.log('🗑️ [DELETE] Отправка DELETE запроса на:', `/api/admin/products/${productId}`);
        
        const response = await fetch(`/api/admin/products/${productId}`, {
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
      alert('Товар не найден');
      return;
    }

    // Получаем токен (для тестирования используем сохраненный)
    let token = localStorage.getItem('token');
    if (!token) {
      // Новый валидный токен для отладки
      token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidGVsZWdyYW1faWQiOiIxMjM0NTY3ODkiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6InVzZXIiLCJpc19hZG1pbiI6MCwiaWF0IjoxNzYyMDU0MjI2LCJleHAiOjE3NjIxNDA2MjZ9.GWlW1f-SfKDQVRj6rct4FtfnCUVNMHj2k-yAoE9OUds';
      localStorage.setItem('token', token);
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