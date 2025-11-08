// Модуль для работы с товарами

const Products = {
    // Глобальные переменные
    products: [],
    currentFilters: { ...CONFIG.DEFAULT_FILTERS },

    // Загрузка товаров
    async loadProducts(forceReload = false) {
        console.log('📦 [LOAD] Начало загрузки товаров, forceReload:', forceReload);
        try {
            Utils.showLoading();
            
            // Добавляем timestamp для предотвращения кеширования
            const timestamp = forceReload ? `?t=${Date.now()}` : '';
            const url = `${CONFIG.API.PRODUCTS}${timestamp}`;
            
            console.log('📦 [LOAD] Запрос к:', url);
            
            const data = await Utils.apiRequest(url);
            
            console.log('📦 [LOAD] Получено товаров:', data.length);
            
            this.products = data;
            window.products = data; // Для обратной совместимости
            
            // Отображаем товары
            this.displayProducts(data);
            
            console.log('✅ [LOAD] Товары загружены и отображены');
            
        } catch (error) {
            console.error('❌ [LOAD] Ошибка загрузки товаров:', error);
            
            // Показываем сообщение об ошибке
            const productsGrid = document.getElementById('productsGrid');
            if (productsGrid) {
                productsGrid.innerHTML = `
                    <div class="error-message">
                        <p>❌ Ошибка загрузки товаров</p>
                        <p>${error.message}</p>
                        <button onclick="Products.loadProducts(true)" class="retry-btn">Повторить</button>
                    </div>
                `;
            }
        } finally {
            Utils.hideLoading();
        }
    },

    // Отображение товаров
    displayProducts(products) {
        console.log('🎨 [DISPLAY] Отображение товаров:', products.length);
        
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) {
            console.error('❌ [DISPLAY] Элемент productsGrid не найден');
            return;
        }

        if (!products || products.length === 0) {
            productsGrid.innerHTML = `
                <div class="no-products">
                    <p>📦 Товары не найдены</p>
                    <p>Попробуйте изменить фильтры или обновить страницу</p>
                </div>
            `;
            return;
        }

        productsGrid.innerHTML = products.map(product => this.createProductCard(product)).join('');
        
        // Добавляем админ-контролы если пользователь админ
        if (window.currentUser && window.currentUser.is_admin && typeof Utils !== 'undefined') {
            Utils.addAdminProductControls();
        }
        
        console.log('✅ [DISPLAY] Товары отображены успешно');
    },

    // Создание карточки товара
    createProductCard(product) {
        const price = Utils.formatPrice(product);
        const rating = Utils.generateStars(product.rating || 0);
        const reviewsText = product.reviewsCount ? `(${product.reviewsCount})` : '';
        
        return `
            <div class="product-card" data-product-id="${product.id}">
                ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}" class="product-image">` : ''}
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${product.description || ''}</p>
                    <div class="product-rating">
                        <span class="stars">${rating}</span>
                        <span class="reviews-count">${reviewsText}</span>
                    </div>
                    <div class="product-price">${price}</div>
                    <div class="product-actions">
                        ${this.createPaymentButtons(product)}
                        <button class="btn-secondary share-btn" onclick="Products.shareProduct(${product.id})">
                            📤 Поделиться
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // Создание кнопок оплаты
    createPaymentButtons(product) {
        const buttons = [];
        
        // Кнопка TON если есть цена
        if (product.price_ton && product.price_ton > 0) {
            buttons.push(`
                <button class="btn-primary payment-btn ton-btn" onclick="Products.payWithTON(${product.id})">
                    💎 ${parseFloat(product.price_ton).toFixed(2)} TON
                </button>
            `);
        }
        
        // Кнопка USDT если есть цена
        if (product.price_usdt && product.price_usdt > 0) {
            buttons.push(`
                <button class="btn-primary payment-btn usdt-btn" onclick="Products.payWithUSDT(${product.id})">
                    💵 ${parseFloat(product.price_usdt).toFixed(2)} USDT
                </button>
            `);
        }
        
        // Кнопка Stars если есть цена
        if (product.price_stars && product.price_stars > 0) {
            buttons.push(`
                <button class="btn-primary payment-btn stars-btn" onclick="Products.payWithStars(${product.id})">
                    ⭐ ${product.price_stars} Stars
                </button>
            `);
        }
        
        // Если нет криптоцен, показываем обычную кнопку заказа
        if (buttons.length === 0) {
            buttons.push(`
                <button class="btn-primary" onclick="Products.orderProduct(${product.id})">
                    🛒 Заказать ${parseFloat(product.price || 0).toFixed(2)} $
                </button>
            `);
        }
        
        return buttons.join('');
    },

    // Оплата через TON
    async payWithTON(productId) {
        try {
            const product = this.products.find(p => p.id === productId);
            if (!product) {
                alert('Товар не найден');
                return;
            }
            
            console.log('💎 [PAY TON] Оплата TON для товара:', product.name);
            
            // Создаем заказ
            const order = await this.createOrder(productId, 'TON');
            
            // Открываем страницу оплаты TON
            const paymentUrl = `/payment.html?orderId=${order.id}&currency=TON&amount=${product.price_ton}`;
            window.location.href = paymentUrl;
            
        } catch (error) {
            console.error('❌ [PAY TON] Ошибка оплаты TON:', error);
            alert('Ошибка при создании заказа: ' + error.message);
        }
    },

    // Оплата через USDT
    async payWithUSDT(productId) {
        try {
            const product = this.products.find(p => p.id === productId);
            if (!product) {
                alert('Товар не найден');
                return;
            }
            
            console.log('💵 [PAY USDT] Оплата USDT для товара:', product.name);
            
            // Создаем заказ
            const order = await this.createOrder(productId, 'USDT');
            
            // Открываем страницу оплаты USDT
            const paymentUrl = `/payment.html?orderId=${order.id}&currency=USDT&amount=${product.price_usdt}`;
            window.location.href = paymentUrl;
            
        } catch (error) {
            console.error('❌ [PAY USDT] Ошибка оплаты USDT:', error);
            alert('Ошибка при создании заказа: ' + error.message);
        }
    },

    // Оплата через Stars
    async payWithStars(productId) {
        try {
            const product = this.products.find(p => p.id === productId);
            if (!product) {
                alert('Товар не найден');
                return;
            }
            
            console.log('⭐ [PAY STARS] Оплата Stars для товара:', product.name);
            
            // Создаем заказ
            const order = await this.createOrder(productId, 'XTR');
            
            // Создаем Stars инвойс
            const invoiceResponse = await Utils.apiRequest(`${CONFIG.API.PAYMENTS}/stars/create-invoice`, {
                method: 'POST',
                body: JSON.stringify({
                    orderId: order.id,
                    productId: productId
                })
            });
            
            if (invoiceResponse.success && invoiceResponse.invoice) {
                console.log('✅ [PAY STARS] Инвойс создан:', invoiceResponse.invoice);
                
                // Открываем Telegram Stars оплату
                if (window.Telegram?.WebApp?.openInvoice) {
                    window.Telegram.WebApp.openInvoice(invoiceResponse.invoice.telegramInvoice, (status) => {
                        console.log('💳 [PAY STARS] Статус оплаты:', status);
                        if (status === 'paid') {
                            alert('✅ Оплата прошла успешно!');
                            this.loadProducts(true); // Обновляем товары
                        } else if (status === 'cancelled') {
                            console.log('❌ [PAY STARS] Оплата отменена');
                        } else if (status === 'failed') {
                            alert('❌ Ошибка оплаты. Попробуйте еще раз.');
                        }
                    });
                } else {
                    alert('Telegram Stars недоступен в этом окружении');
                }
            } else {
                throw new Error(invoiceResponse.error || 'Ошибка создания инвойса');
            }
            
        } catch (error) {
            console.error('❌ [PAY STARS] Ошибка оплаты Stars:', error);
            alert('Ошибка при создании Stars инвойса: ' + error.message);
        }
    },

    // Обычный заказ товара
    async orderProduct(productId) {
        try {
            const product = this.products.find(p => p.id === productId);
            if (!product) {
                alert('Товар не найден');
                return;
            }
            
            console.log('🛒 [ORDER] Заказ товара:', product.name);
            
            // Создаем заказ
            const order = await this.createOrder(productId, 'USD');
            
            alert(`✅ Заказ #${order.id} создан успешно!\nТовар: ${product.name}\nСумма: ${product.price} $`);
            
        } catch (error) {
            console.error('❌ [ORDER] Ошибка создания заказа:', error);
            alert('Ошибка при создании заказа: ' + error.message);
        }
    },

    // Создание заказа
    async createOrder(productId, paymentMethod = 'USD') {
        const response = await Utils.apiRequest(CONFIG.API.ORDERS, {
            method: 'POST',
            body: JSON.stringify({
                product_id: productId,
                payment_method: paymentMethod
            })
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Ошибка создания заказа');
        }
        
        return response.order;
    },

    // Поделиться товаром
    async shareProduct(productId) {
        try {
            const product = this.products.find(p => p.id === productId);
            if (!product) {
                alert('Товар не найден');
                return;
            }
            
            const shareText = `🛍️ ${product.name}\n📝 ${product.description || 'Отличный товар!'}\n💰 Цена: ${Utils.formatPrice(product)}\n👆 Нажмите, чтобы купить!`;
            const shareUrl = `${window.location.origin}?product=${productId}`;
            
            if (window.Telegram?.WebApp?.openTelegramLink) {
                const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
                window.Telegram.WebApp.openTelegramLink(telegramUrl);
            } else if (navigator.share) {
                await navigator.share({
                    title: product.name,
                    text: shareText,
                    url: shareUrl
                });
            } else {
                // Fallback - копируем в буфер обмена
                await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                alert('📋 Ссылка скопирована в буфер обмена!');
            }
            
        } catch (error) {
            console.error('❌ [SHARE] Ошибка при попытке поделиться:', error);
            alert('Ошибка при попытке поделиться товаром');
        }
    },

    // Фильтрация товаров
    filterProducts() {
        console.log('🔍 [FILTER] Применение фильтров:', this.currentFilters);
        
        let filteredProducts = [...this.products];
        
        // Фильтр по наличию
        if (this.currentFilters.stock === 'available') {
            filteredProducts = filteredProducts.filter(product => 
                product.infinite_stock || (product.stock && product.stock > 0)
            );
        }
        
        // Фильтр по диапазону цен
        if (this.currentFilters.priceFrom || this.currentFilters.priceTo) {
            filteredProducts = filteredProducts.filter(product => {
                const price = parseFloat(product.price || 0);
                const priceFrom = parseFloat(this.currentFilters.priceFrom || 0);
                const priceTo = parseFloat(this.currentFilters.priceTo || Infinity);
                
                return price >= priceFrom && price <= priceTo;
            });
        }
        
        // Сортировка
        switch (this.currentFilters.sort) {
            case 'price_asc':
                filteredProducts.sort((a, b) => (a.price || 0) - (b.price || 0));
                break;
            case 'price_desc':
                filteredProducts.sort((a, b) => (b.price || 0) - (a.price || 0));
                break;
            case 'newest':
            default:
                filteredProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
        }
        
        console.log('🔍 [FILTER] Отфильтровано товаров:', filteredProducts.length);
        this.displayProducts(filteredProducts);
    },

    // Обновление фильтров
    updateFilters(newFilters) {
        this.currentFilters = { ...this.currentFilters, ...newFilters };
        this.filterProducts();
    },

    // Поиск товаров
    searchProducts: Utils.debounce(function(query) {
        console.log('🔍 [SEARCH] Поиск по запросу:', query);
        
        if (!query.trim()) {
            this.filterProducts();
            return;
        }
        
        const searchQuery = query.toLowerCase();
        const filteredProducts = this.products.filter(product => 
            product.name.toLowerCase().includes(searchQuery) ||
            (product.description && product.description.toLowerCase().includes(searchQuery))
        );
        
        console.log('🔍 [SEARCH] Найдено товаров:', filteredProducts.length);
        this.displayProducts(filteredProducts);
    }, 300)
};

// Экспорт для использования в других модулях
window.Products = Products;
console.log('✅ Products модуль загружен');
