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
      statusPending: 'Ожидает',
      statusProcessing: 'В ОБРАБОТКЕ',
      statusCompleted: 'ЗАВЕРШЁН',
      statusCancelled: 'ОТМЕНЁН',
  
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
    try {
        showLoading();
        
        // Получаем данные пользователя из Telegram Web App
        const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        
        if (!telegramUser) {
            // Если нет данных Telegram, используем тестовые данные для разработки
            console.log('⚠️ Данные Telegram не найдены, используем тестовый режим');
            const testUser = {
                id: 853232715, // Админский ID для тестирования
                username: 'test_admin',
                first_name: 'Test',
                last_name: 'Admin'
            };
            await authenticateUser(testUser.id, testUser.username);
            return;
        }
        
        // Автоматически авторизуем пользователя
        await authenticateUser(telegramUser.id, telegramUser.username);
        
    } catch (error) {
        console.error('Ошибка автоматической авторизации:', error);
        // В случае ошибки показываем форму авторизации
        showAuthSection();
    } finally {
        hideLoading();
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
async function authenticateUser(telegramId, username) {
    try {
        console.log('Отправка на /api/auth:', {
            telegram_id: telegramId?.toString(),
            username: username || ('user_' + telegramId)
        });
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                telegram_id: telegramId.toString(),
                username: username || 'user_' + telegramId
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка авторизации');
        }

        const data = await response.json();
        
        // Сохраняем токен и данные пользователя
        localStorage.setItem('authToken', data.token);
        currentUser = data.user;
        
        // Показываем основной контент
        showMainContent();
        showUserInfo();
        
        // Загружаем данные
        await loadProducts();
        await loadOrders();
        
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        throw error;
    }
}

// Восстановление сессии
async function restoreSession(token) {
    try {
        showMainContent();
        await loadProducts();
        await loadOrders();
    } catch (error) {
        console.error('Ошибка восстановления сессии:', error);
        localStorage.removeItem('authToken');
        showAuthSection();
    }
}

// Обработка выхода
function handleLogout() {
    localStorage.removeItem('authToken');
    currentUser = null;
    showAuthSection();
}

// Показать секцию авторизации
function showAuthSection() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('userInfo').style.display = 'none';
}

// Показать основной контент
function showMainContent() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userName').textContent = currentUser.username || 'Пользователь';

    // Показываем админ-кнопку, если is_admin
    if (currentUser.is_admin) {
        document.getElementById('adminAddServiceContainer').style.display = 'block';
    } else {
        document.getElementById('adminAddServiceContainer').style.display = 'none';
    }
}

// Загрузка товаров
async function loadProducts() {
    try {
        showLoading();
        const response = await fetch('/api/products');
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки товаров');
        }
        
        products = await response.json();
        
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

function showAuthSection() {
  document.getElementById('authSection').style.display = 'block';
  document.getElementById('mainContent').style.display = 'none';
}

function showMainContent() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
}

function showUserInfo() {
  if (!currentUser) return;
  
  document.getElementById('userInfo').style.display = 'flex';
  document.getElementById('userName').textContent = currentUser.username || 'Пользователь';

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
    try {
        // Находим товар для подтверждения
        const product = products.find(p => p.id === productId);
        if (!product) {
            showError('Товар не найден');
            return;
        }

        // Подтверждение удаления
        const confirmText = prompt(`Для подтверждения удаления товара "${product.name}" введите слово "удалить":`);
        if (!confirmText || confirmText.toLowerCase().trim() !== 'удалить') {
            return; // Отмена
        }

        showLoading();

        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка удаления товара');
        }

        showSuccess('Товар успешно удален!');
        
        // Перезагружаем список товаров
        await loadProducts();

    } catch (error) {
        console.error('Ошибка удаления товара:', error);
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

    // Показываем опции оплаты
    if (window.paymentManager) {
      window.paymentManager.showPaymentOptions(
        data.id, 
        productId, 
        product.name, 
        product.price
      );
    } else {
      alert('Система платежей недоступна');
    }

  } catch (error) {
    console.error('Ошибка заказа:', error);
    alert('Ошибка при создании заказа: ' + error.message);
  }
}