// Глобальные переменные
let currentAdmin = null;
let products = [];
let orders = [];
let users = [];
let editingProductId = null;

// Инициализация админ панели
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminPanel();
});

// Инициализация админ панели
function initializeAdminPanel() {
    // Проверяем, есть ли сохраненный токен
    const token = localStorage.getItem('authToken');
    if (token) {
        // Пытаемся восстановить сессию админа
        restoreAdminSession(token);
    } else {
        // Если нет токена, перенаправляем на авторизацию
        window.location.href = '/';
    }

    // Обработчики событий
    setupAdminEventListeners();
}

// Настройка обработчиков событий для админки
function setupAdminEventListeners() {
    // Навигация по вкладкам
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Кнопка выхода
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleAdminLogout);
    }

    // Кнопка добавления товара
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', showAddProductModal);
    }

    // Форма товара
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', handleProductSubmit);
    }

    // Кнопки отмены
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeProductModal);
    }

    const cancelStatusBtn = document.getElementById('cancelStatusBtn');
    if (cancelStatusBtn) {
        cancelStatusBtn.addEventListener('click', closeOrderStatusModal);
    }

    // Форма статуса заказа
    const orderStatusForm = document.getElementById('orderStatusForm');
    if (orderStatusForm) {
        orderStatusForm.addEventListener('submit', handleOrderStatusSubmit);
    }

    // Фильтр статуса заказов
    const orderStatusFilter = document.getElementById('orderStatusFilter');
    if (orderStatusFilter) {
        orderStatusFilter.addEventListener('change', filterOrders);
    }

    // Обработчик чекбокса "Бесконечность"
    const infiniteCheckbox = document.getElementById('productInfinite');
    if (infiniteCheckbox) {
        infiniteCheckbox.addEventListener('change', function() {
            const stockInput = document.getElementById('productStock');
            if (this.checked) {
                stockInput.disabled = true;
                stockInput.value = 0;
            } else {
                stockInput.disabled = false;
            }
        });
    }

    // Модальные окна
    setupModalListeners();
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

// Восстановление сессии админа
async function restoreAdminSession(token) {
    try {
        // Проверяем токен на сервере (можно добавить отдельный endpoint)
        // Пока просто загружаем данные
        await loadDashboardData();
        await loadProducts();
        await loadOrders();
        await loadUsers();
    } catch (error) {
        console.error('Ошибка восстановления сессии админа:', error);
        localStorage.removeItem('authToken');
        window.location.href = '/';
    }
}

// Обработка выхода админа
function handleAdminLogout() {
    localStorage.removeItem('authToken');
    currentAdmin = null;
    window.location.href = '/';
}

// Переключение вкладок
function switchTab(tabName) {
    // Убираем активный класс у всех кнопок и контента
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Добавляем активный класс к выбранной кнопке и контенту
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// Загрузка данных для дашборда
async function loadDashboardData() {
    try {
        const data = await makeAuthRequest('/api/admin/stats');
        if (!data || !data.success) throw new Error('Ошибка загрузки статистики');
        document.getElementById('totalProducts').textContent = data.total_products;
        document.getElementById('totalOrders').textContent = data.total_orders;
        document.getElementById('totalUsers').textContent = data.total_users;
        const totalRevenue = orders.reduce((sum, order) => sum + order.price, 0);
        document.getElementById('totalRevenue').textContent = totalRevenue.toFixed(2) + ' $';
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка товаров
async function loadProducts(forceReload = false) {
    try {
        const timestamp = new Date().getTime();
        const url = `/api/products?_t=${timestamp}`;
        const options = forceReload ? {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            cache: 'no-store'
        } : {};
        
        const data = await makeAuthRequest(url, options);
        if (!data || !Array.isArray(data)) {
            console.error('Unexpected response format:', data);
            throw new Error('Неверный формат данных');
        }
        products = data;
        renderProductsTable(products);
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        showError('Ошибка загрузки товаров: ' + (error.message || 'Неизвестная ошибка'));
    }
}

// Отображение таблицы товаров
function renderProductsTable(productsToRender) {
    const tbody = document.getElementById('productsTableBody');
    
    if (productsToRender.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <h3>Товары не найдены</h3>
                    <p>Добавьте первый товар!</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = productsToRender.map(product => {
        // Форматируем остаток
        let stockDisplay = '';
        if (product.infinite_stock) {
            stockDisplay = '<span class="stock-infinite">∞</span>';
        } else {
            const stock = product.stock || 0;
            stockDisplay = `<span class="stock-${stock > 0 ? 'available' : 'out'}">${stock}</span>`;
        }

        return `
            <tr>
                <td>${product.id}</td>
                <td>
                    ${product.image_url ? 
                        `<img src="${product.image_url}" alt="${product.name}" class="product-img">` :
                        `<div class="product-img">🛍️</div>`
                    }
                </td>
                <td>${product.name}</td>
                <td>${getCategoryName(product.category)}</td>
                <td>${product.price.toFixed(2)} $</td>
                <td>${stockDisplay}</td>
                <td>
                    <span class="status-badge ${product.is_active ? 'active' : 'inactive'}">
                        ${product.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="editProduct(${product.id})" title="Редактировать">
                            ✏️
                        </button>
                        <button class="btn-delete" onclick="deleteProduct(${product.id})" title="Удалить">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Загрузка заказов
async function loadOrders() {
    try {
        const data = await makeAuthRequest('/api/admin/orders');
        // Обработка данных
        orders = data;
        renderOrdersTable(orders);
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        showError('Ошибка загрузки заказов');
    }
}

// Отображение таблицы заказов
function renderOrdersTable(ordersToRender) {
    const tbody = document.getElementById('ordersTableBody');
    
    if (ordersToRender.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <h3>Заказы не найдены</h3>
                    <p>Пока нет заказов</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = ordersToRender.map(order => `
        <tr>
            <td>${order.id}</td>
            <td>${order.username || 'Неизвестно'}</td>
            <td>${order.product_name}</td>
            <td>${order.price} $</td>
            <td>
                <span class="status-badge ${order.status}">
                    ${getStatusName(order.status)}
                </span>
            </td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-status" onclick="changeOrderStatus(${order.id}, '${order.status}')">
                        Изменить статус
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Загрузка пользователей
async function loadUsers() {
    try {
        const data = await makeAuthRequest('/api/admin/users');
        users = data.users || data;
        renderUsersTable(users);
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        showError('Ошибка загрузки пользователей');
    }
}

// Отображение таблицы пользователей
function renderUsersTable(usersToRender) {
    const tbody = document.getElementById('usersTableBody');
    
    if (usersToRender.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <h3>Пользователи не найдены</h3>
                    <p>Пока нет пользователей</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = usersToRender.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.telegram_id}</td>
            <td>${user.username || 'Неизвестно'}</td>
            <td>${user.is_admin ? 'Администратор' : 'Пользователь'}</td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

// Показать модальное окно добавления товара
function showAddProductModal() {
    editingProductId = null;
    document.getElementById('modalTitle').textContent = 'Добавить товар';
    document.getElementById('productForm').reset();
    
    // Сбрасываем поля остатка
    const stockInput = document.getElementById('productStock');
    const infiniteCheckbox = document.getElementById('productInfinite');
    if (stockInput) stockInput.disabled = false;
    if (infiniteCheckbox) infiniteCheckbox.checked = false;
    
    document.getElementById('productModal').style.display = 'block';
}

// Редактирование товара
function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    editingProductId = productId;
    document.getElementById('modalTitle').textContent = 'Редактировать товар';
    
    // Заполняем форму данными товара
    document.getElementById('productName').value = product.name;
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productCategory').value = product.category || 'other';
    document.getElementById('productActive').checked = product.is_active;
    
    // Заполняем поля остатка
    const stockInput = document.getElementById('productStock');
    const infiniteCheckbox = document.getElementById('productInfinite');
    
    if (product.infinite_stock) {
        infiniteCheckbox.checked = true;
        stockInput.value = 0;
        stockInput.disabled = true;
    } else {
        infiniteCheckbox.checked = false;
        stockInput.value = product.stock || 0;
        stockInput.disabled = false;
    }
    
    document.getElementById('productModal').style.display = 'block';
}

// Обработка отправки формы товара
async function handleProductSubmit(e) {
    e.preventDefault();
    try {
        const formData = new FormData(e.target);
        
        // === КРИТИЧНО: ЯВНО ЧИТАЕМ ЧЕКБОКСЫ ИЗ DOM ===
        // FormData.get() возвращает null для unchecked!
        // Нужно читать напрямую из DOM через .checked
        const infiniteStockCheckbox = document.getElementById('productInfinite');
        const isActiveCheckbox = document.getElementById('productActive');
        
        const infiniteStockChecked = infiniteStockCheckbox ? infiniteStockCheckbox.checked : false;
        const isActiveChecked = isActiveCheckbox ? isActiveCheckbox.checked : false;
        
        console.log('📦 [ADMIN FORM] Чекбоксы из DOM:', { 
            infiniteStockChecked,
            isActiveChecked
        });
        
        // Удаляем старые значения (если были)
        formData.delete('infinite_stock');
        formData.delete('is_active');
        
        // ЯВНО добавляем правильные значения
        formData.append('infinite_stock', infiniteStockChecked ? 'on' : 'off');
        formData.append('is_active', isActiveChecked ? 'on' : 'off');
        
        console.log('📤 [ADMIN FORM] Отправка:', { 
            infinite_stock: formData.get('infinite_stock'),
            is_active: formData.get('is_active')
        });
        
        const url = editingProductId ? 
            `/api/admin/products/${editingProductId}` : 
            '/api/admin/products';
        const method = editingProductId ? 'PUT' : 'POST';
        
        // Use makeAuthRequest with FormData
        const result = await makeAuthRequest(url, {
            method: method,
            body: formData
        });
        closeProductModal();
        showSuccess(result.message || 'Операция выполнена успешно');
        // Update data with force reload
        await loadProducts(true);
        await loadDashboardData();
    } catch (error) {
        console.error('Ошибка сохранения товара:', error);
        showError('Ошибка сохранения товара: ' + (error.message || 'Неизвестная ошибка'));
    }
}

// Удаление товара
async function deleteProduct(productId) {
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) {
        return;
    }
    try {
        const result = await makeAuthRequest(`/api/admin/products/${productId}`, {
            method: 'DELETE'
        });
        showSuccess(result.message || 'Товар успешно удален');
        
        // Удаляем товар из локального массива немедленно
        const index = products.findIndex(p => p.id === productId);
        if (index > -1) {
            products.splice(index, 1);
        }
        
        // Перерисовываем таблицу с текущими данными
        renderProductsTable(products);
        
        // Update data with force reload
        await loadProducts(true);
        await loadDashboardData();
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        showError('Ошибка удаления товара: ' + (error.message || 'Неизвестная ошибка'));
    }
}

// Изменение статуса заказа
function changeOrderStatus(orderId, currentStatus) {
    document.getElementById('orderStatus').value = currentStatus;
    document.getElementById('orderStatusForm').setAttribute('data-order-id', orderId);
    document.getElementById('orderStatusModal').style.display = 'block';
}

// Обработка изменения статуса заказа
async function handleOrderStatusSubmit(e) {
    e.preventDefault();
    
    try {
        const orderId = e.target.getAttribute('data-order-id');
        const status = document.getElementById('orderStatus').value;
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            throw new Error('Ошибка обновления статуса заказа');
        }

        const result = await response.json();
        
        closeOrderStatusModal();
        showSuccess(result.message);
        
        // Обновляем данные
        await loadOrders();
        await loadDashboardData();

    } catch (error) {
        console.error('Ошибка обновления статуса заказа:', error);
        showError('Ошибка обновления статуса заказа');
    }
}

// Фильтрация заказов
function filterOrders() {
    const statusFilter = document.getElementById('orderStatusFilter').value;
    
    let filteredOrders = orders;
    
    if (statusFilter) {
        filteredOrders = orders.filter(order => order.status === statusFilter);
    }
    
    renderOrdersTable(filteredOrders);
}

// Закрытие модального окна товара
function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    editingProductId = null;
    
    // Сбрасываем поля остатка
    const stockInput = document.getElementById('productStock');
    const infiniteCheckbox = document.getElementById('productInfinite');
    if (stockInput) {
        stockInput.disabled = false;
        stockInput.value = 0;
    }
    if (infiniteCheckbox) infiniteCheckbox.checked = false;
}

// Закрытие модального окна статуса заказа
function closeOrderStatusModal() {
    document.getElementById('orderStatusModal').style.display = 'none';
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

// Получение названия статуса
function getStatusName(status) {
    const statuses = {
        'pending': 'Ожидает',
        'processing': 'В обработке',
        'completed': 'Завершен',
        'cancelled': 'Отменен'
    };
    return statuses[status] || status;
}

// Показать ошибку
function showError(message) {
    console.error(message);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translateX(-50%)';
    errorDiv.style.backgroundColor = '#f8d7da';
    errorDiv.style.color = '#721c24';
    errorDiv.style.padding = '15px 25px';
    errorDiv.style.borderRadius = '8px';
    errorDiv.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    errorDiv.style.zIndex = '9999';
    document.body.appendChild(errorDiv);
    setTimeout(() => {
        errorDiv.style.opacity = '0';
        errorDiv.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            document.body.removeChild(errorDiv);
        }, 500);
    }, 3000);
}

// Показать успех
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.position = 'fixed';
    successDiv.style.top = '20px';
    successDiv.style.left = '50%';
    successDiv.style.transform = 'translateX(-50%)';
    successDiv.style.backgroundColor = '#d4edda';
    successDiv.style.color = '#155724';
    successDiv.style.padding = '15px 25px';
    successDiv.style.borderRadius = '8px';
    successDiv.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    successDiv.style.zIndex = '9999';
    document.body.appendChild(successDiv);
    setTimeout(() => {
        successDiv.style.opacity = '0';
        successDiv.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            document.body.removeChild(successDiv);
        }, 500);
    }, 3000);
}

// Функция авторизации через Telegram
function onTelegramAuth(user) {
    fetch('/api/auth/telegram', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(user)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Сохраняем токен и роль
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userRole', data.user.role);
            // Перенаправляем в зависимости от роли
            if (data.user.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/user.html';
            }
        }
    })
    .catch(error => {
        console.error('Ошибка авторизации:', error);
    });
}

// Функция для выполнения авторизованных запросов
async function makeAuthRequest(url, options = {}) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/'; // Redirect to main page
        return;
    }
    // Don't set Content-Type for FormData
    const headers = {
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    // Only add Content-Type if we're not sending FormData
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, {
        ...options,
        headers
    });
    if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        window.location.href = '/'; // Redirect to auth
        return;
    }
    return response.json();
}

// Пример обновления функции создания товара
async function createProduct(productData) {
    try {
        const data = await makeAuthRequest('/api/admin/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
        alert('Продукт создан!');
    } catch (error) {
        console.error('Ошибка создания продукта:', error);
    }
} 