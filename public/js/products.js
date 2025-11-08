// Модуль для работы с товарами

// Загрузка товаров
async function loadProducts(forceReload = false) {
  try {
    if (!forceReload && window.products.length > 0) {
      console.log('📦 [PRODUCTS] Товары уже загружены, используем кеш');
      return window.products;
    }
    
    console.log('📦 [PRODUCTS] Загрузка товаров...');
    showLoading();
    
    const response = await fetch('/api/products');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    window.products = await response.json();
    console.log('✅ [PRODUCTS] Загружено товаров:', window.products.length);
    
    return window.products;
  } catch (error) {
    console.error('❌ [PRODUCTS] Ошибка загрузки товаров:', error);
    showError('Ошибка загрузки товаров: ' + error.message);
    return [];
  } finally {
    hideLoading();
  }
}

// Фильтрация товаров
function filterProducts() {
  const container = document.getElementById('productsContainer');
  if (!container) return;
  
  console.log('🔍 [FILTER] Применение фильтров:', window.currentFilters);
  
  let filteredProducts = [...window.products];
  
  // Фильтр по категории
  if (window.currentFilters.category) {
    filteredProducts = filteredProducts.filter(product => 
      product.category === window.currentFilters.category
    );
  }
  
  // Фильтр по наличию
  if (window.currentFilters.stock === 'in_stock') {
    filteredProducts = filteredProducts.filter(product => 
      product.stock_quantity > 0
    );
  } else if (window.currentFilters.stock === 'out_of_stock') {
    filteredProducts = filteredProducts.filter(product => 
      product.stock_quantity === 0
    );
  }
  
  // Сортировка
  switch (window.currentFilters.sort) {
    case 'price_low':
      filteredProducts.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price_high':
      filteredProducts.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'rating':
      filteredProducts.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
      break;
    case 'newest':
    default:
      filteredProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
  }
  
  renderProducts(filteredProducts);
}

// Отображение товаров
function renderProducts(productsToRender = window.products) {
  const container = document.getElementById('productsContainer');
  if (!container) return;
  
  console.log('🎨 [RENDER] Отображение товаров:', productsToRender.length);
  
  if (productsToRender.length === 0) {
    container.innerHTML = `
      <div class="no-products">
        <h3>${window.translations[window.currentLang].noProducts}</h3>
      </div>
    `;
    return;
  }
  
  container.innerHTML = productsToRender.map(product => `
    <div class="product-card" data-product-id="${product.id}">
      ${product.image_url ? `
        <div class="product-image">
          <img src="${product.image_url}" alt="${product.name}" loading="lazy">
        </div>
      ` : ''}
      
      <div class="product-info">
        <h3 class="product-name">${product.name}</h3>
        <p class="product-description">${product.description || ''}</p>
        
        <div class="product-rating">
          <span class="stars">${generateStars(product.average_rating || 0)}</span>
          <span class="rating-text">${(product.average_rating || 0).toFixed(1)} (${product.review_count || 0})</span>
        </div>
        
        <div class="product-price">
          ${formatPrice(product)}
        </div>
        
        <div class="product-category">
          ${getCategoryName(product.category)}
        </div>
        
        <div class="product-stock ${product.stock_quantity > 0 ? 'in-stock' : 'out-of-stock'}">
          ${product.stock_quantity > 0 ? 
            `${window.translations[window.currentLang].inStock}: ${product.stock_quantity}` : 
            window.translations[window.currentLang].outOfStock
          }
        </div>
      </div>
      
      <div class="product-actions">
        <button class="btn-primary" onclick="showProductModal(${product.id})">
          ${window.translations[window.currentLang].details}
        </button>
        
        <button class="btn-secondary" onclick="toggleFavorite(${product.id})">
          ${window.favorites.includes(product.id) ? '❤️' : '🤍'}
        </button>
      </div>
    </div>
  `).join('');
}

// Поиск товаров
function handleSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  console.log('🔍 [SEARCH] Поиск:', searchTerm);
  
  if (!searchTerm) {
    filterProducts();
    return;
  }
  
  const filteredProducts = window.products.filter(product => 
    product.name.toLowerCase().includes(searchTerm) ||
    (product.description && product.description.toLowerCase().includes(searchTerm)) ||
    (product.category && product.category.toLowerCase().includes(searchTerm))
  );
  
  renderProducts(filteredProducts);
}

// Показать модальное окно товара
function showProductModal(productId) {
  const product = window.products.find(p => p.id === productId);
  if (!product) {
    showError('Товар не найден');
    return;
  }
  
  console.log('📦 [MODAL] Открытие модального окна товара:', product.name);
  
  const modal = document.getElementById('productModal');
  const modalContent = document.getElementById('productModalContent');
  
  if (!modal || !modalContent) {
    showError('Модальное окно не найдено');
    return;
  }
  
  modalContent.innerHTML = `
    <span class="close" onclick="closeProductModal()">&times;</span>
    
    <div class="modal-product-info">
      ${product.image_url ? `
        <div class="modal-product-image">
          <img src="${product.image_url}" alt="${product.name}">
        </div>
      ` : ''}
      
      <div class="modal-product-details">
        <h2>${product.name}</h2>
        <p class="modal-product-description">${product.description || ''}</p>
        
        <div class="modal-product-rating">
          <span class="stars">${generateStars(product.average_rating || 0)}</span>
          <span class="rating-text">${(product.average_rating || 0).toFixed(1)} (${product.review_count || 0} отзывов)</span>
          <button class="btn-link" onclick="showReviews(${product.id})">Посмотреть отзывы</button>
        </div>
        
        <div class="modal-product-price">
          ${formatPrice(product)}
        </div>
        
        <div class="modal-product-category">
          Категория: ${getCategoryName(product.category)}
        </div>
        
        <div class="modal-product-stock">
          ${product.stock_quantity > 0 ? 
            `В наличии: ${product.stock_quantity} шт.` : 
            'Нет в наличии'
          }
        </div>
      </div>
    </div>
    
    ${product.stock_quantity > 0 ? `
      <div class="modal-payment-buttons">
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
    ` : `
      <div class="out-of-stock-message">
        <span>${window.translations[window.currentLang].outOfStock}</span>
      </div>
    `}
    
    <div class="modal-product-actions">
      <button class="btn-secondary" onclick="toggleFavorite(${product.id})">
        ${window.favorites.includes(product.id) ? '❤️ В избранном' : '🤍 В избранное'}
      </button>
      
      <button class="btn-secondary" onclick="shareProduct(${product.id})">
        📤 Поделиться
      </button>
    </div>
  `;
  
  modal.style.display = 'block';
}

// Закрыть модальное окно товара
function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Поделиться товаром
async function shareProduct(productId) {
  try {
    const product = window.products.find(p => p.id === productId);
    if (!product) {
      throw new Error('Товар не найден');
    }
    
    console.log('📤 [SHARE] Отправка товара:', product.name);
    
    const price = formatPrice(product);
    const message = `🛍️ ${product.name}\n\n📝 ${product.description || 'Описание отсутствует'}\n\n💰 Цена: ${price}\n\n👆 Нажмите, чтобы купить!`;
    
    if (window.Telegram?.WebApp) {
      const botUsername = 'your_bot_username'; // Замените на ваш username бота
      const shareUrl = `https://t.me/${botUsername}?startapp=product_${productId}`;
      
      Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(message)}`);
    } else {
      // Fallback для браузера
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: message,
          url: window.location.href
        });
      } else {
        // Копируем в буфер обмена
        await navigator.clipboard.writeText(message);
        showSuccess('Информация о товаре скопирована в буфер обмена');
      }
    }
  } catch (error) {
    console.error('❌ [SHARE] Ошибка при отправке товара:', error);
    showError('Ошибка при отправке товара');
  }
}

// Экспорт функций в глобальную область
window.loadProducts = loadProducts;
window.filterProducts = filterProducts;
window.renderProducts = renderProducts;
window.handleSearch = handleSearch;
window.showProductModal = showProductModal;
window.closeProductModal = closeProductModal;
window.shareProduct = shareProduct;
