// === ADMIN.JS — ПОЛНАЯ ВЕРСИЯ С УДАЛЕНИЕМ И ЗАГРУЗКОЙ ===
console.log('🚀 ADMIN.JS ЗАГРУЖЕН! Версия 3.0.0');

// Глобальные переменные
let currentEditingProductId = null;
let allProducts = [];

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📋 Админка: DOM загружен');

  // Инициализируем все компоненты
  initTabs();
  initModals();
  initProductForm();
  
  // Загружаем данные
  await loadProducts();
  await loadDashboardStats();
  
  console.log('✅ Админ-панель инициализирована');
});

// === ТАБЫ ===
function initTabs() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Убираем активный класс со всех
      navBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));
      
      // Добавляем активный класс
      btn.classList.add('active');
      document.getElementById(tabName).classList.add('active');
      
      // Загружаем данные для таба
      if (tabName === 'products') {
        loadProducts();
      } else if (tabName === 'orders') {
        loadOrders();
      } else if (tabName === 'users') {
        loadUsers();
      }
    });
  });
}

// === МОДАЛЬНЫЕ ОКНА ===
function initModals() {
  const productModal = document.getElementById('productModal');
  const addProductBtn = document.getElementById('addProductBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const closeBtn = productModal.querySelector('.close');

  // Открытие модалки для добавления
  addProductBtn.addEventListener('click', () => {
    currentEditingProductId = null;
    document.getElementById('modalTitle').textContent = 'Добавить товар';
    document.getElementById('productForm').reset();
    productModal.style.display = 'block';
  });

  // Закрытие модалки
  cancelBtn.addEventListener('click', () => {
    productModal.style.display = 'none';
  });

  closeBtn.addEventListener('click', () => {
    productModal.style.display = 'none';
  });

  // Закрытие по клику вне модалки
  window.addEventListener('click', (e) => {
    if (e.target === productModal) {
      productModal.style.display = 'none';
    }
  });
}

// === ФОРМА ДОБАВЛЕНИЯ/РЕДАКТИРОВАНИЯ ТОВАРА ===
function initProductForm() {
  const form = document.getElementById('productForm');
  if (!form) {
    console.error('❌ ФОРМА #productForm НЕ НАЙДЕНА!');
    return;
  }

  console.log('✅ Форма #productForm найдена');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📝 Форма отправлена');

    // ВАЖНО: Используем FormData для поддержки загрузки файлов
    const formData = new FormData(form);

    const infiniteEl = document.getElementById('productInfinite');
    const activeEl = document.getElementById('productActive');

    const infinite = infiniteEl ? infiniteEl.checked : false;
    const active = activeEl ? activeEl.checked : true;

    console.log('📦 Чекбоксы:', { infinite, active });

    // Добавляем чекбоксы в FormData
    formData.set('infinite_stock', infinite ? 'on' : 'off');
    formData.set('is_active', active ? 'on' : 'off');

    console.log('📤 Отправка FormData с полями:');
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value);
    }

    try {
      const url = currentEditingProductId 
        ? `/api/admin/products/${currentEditingProductId}`
        : '/api/admin/products';
      
      const method = currentEditingProductId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });

      const data = await res.json();
      console.log('📥 Ответ сервера:', data);

      if (data.success) {
        alert(currentEditingProductId ? '✅ Товар обновлен!' : '✅ Товар добавлен!');
        document.getElementById('productModal').style.display = 'none';
        await loadProducts(); // Перезагружаем список
      } else {
        alert('❌ Ошибка: ' + (data.error || 'Неизвестно'));
      }
    } catch (err) {
      console.error('❌ Ошибка сети:', err);
      alert('⚠️ Нет связи с сервером');
    }
  });
}

// === ЗАГРУЗКА ТОВАРОВ ===
async function loadProducts() {
  console.log('📦 Загрузка товаров...');
  
  try {
    const res = await fetch('/api/admin/products', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    allProducts = data.products || [];
    
    console.log('✅ Товары загружены:', allProducts.length);
    renderProducts(allProducts);
  } catch (err) {
    console.error('❌ Ошибка загрузки товаров:', err);
    alert('⚠️ Не удалось загрузить товары');
  }
}

// === ОТОБРАЖЕНИЕ ТОВАРОВ ===
function renderProducts(products) {
  const tbody = document.getElementById('productsTableBody');
  
  if (!tbody) {
    console.error('❌ Таблица товаров не найдена');
    return;
  }

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Нет товаров</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(product => `
    <tr>
      <td>${product.id}</td>
      <td>
        ${product.image_url 
          ? `<img src="${product.image_url}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` 
          : '📦'
        }
      </td>
      <td>${product.name}</td>
      <td>${product.category || 'Без категории'}</td>
      <td>${product.price} ₽</td>
      <td>${product.infinite_stock ? '∞' : product.stock || 0}</td>
      <td>
        <span class="status-badge ${product.is_active ? 'status-active' : 'status-inactive'}">
          ${product.is_active ? 'Активен' : 'Неактивен'}
        </span>
      </td>
      <td>
        <button class="btn-icon" onclick="editProduct(${product.id})" title="Редактировать">
          ✏️
        </button>
        <button class="btn-icon btn-danger" onclick="deleteProduct(${product.id})" title="Удалить">
          🗑️
        </button>
      </td>
    </tr>
  `).join('');
}

// === РЕДАКТИРОВАНИЕ ТОВАРА ===
window.editProduct = async function(productId) {
  console.log('✏️ Редактирование товара:', productId);
  
  const product = allProducts.find(p => p.id === productId);
  if (!product) {
    alert('❌ Товар не найден');
    return;
  }

  currentEditingProductId = productId;
  
  // Заполняем форму
  document.getElementById('modalTitle').textContent = 'Редактировать товар';
  document.getElementById('productName').value = product.name || '';
  document.getElementById('productDescription').value = product.description || '';
  document.getElementById('productPrice').value = product.price || '';
  document.getElementById('productCategory').value = product.category || 'other';
  document.getElementById('productStock').value = product.stock || 0;
  document.getElementById('productInfinite').checked = product.infinite_stock || false;
  document.getElementById('productActive').checked = product.is_active || false;

  // Открываем модалку
  document.getElementById('productModal').style.display = 'block';
};

// === УДАЛЕНИЕ ТОВАРА ===
window.deleteProduct = async function(productId) {
  console.log('🗑️ Удаление товара:', productId);
  
  if (!confirm('Вы уверены, что хотите удалить этот товар?')) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/products/${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });

    const data = await res.json();

    if (data.success) {
      alert('✅ Товар удален!');
      await loadProducts(); // Перезагружаем список
    } else {
      alert('❌ Ошибка: ' + (data.error || 'Не удалось удалить товар'));
    }
  } catch (err) {
    console.error('❌ Ошибка удаления:', err);
    alert('⚠️ Ошибка при удалении товара');
  }
};

// === ЗАГРУЗКА СТАТИСТИКИ ===
async function loadDashboardStats() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });

    if (res.ok) {
      const stats = await res.json();
      document.getElementById('totalProducts').textContent = stats.totalProducts || 0;
      document.getElementById('totalOrders').textContent = stats.totalOrders || 0;
      document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
      document.getElementById('totalRevenue').textContent = `${stats.totalRevenue || 0} ₽`;
    }
  } catch (err) {
    console.error('❌ Ошибка загрузки статистики:', err);
  }
}

// === ЗАГРУЗКА ЗАКАЗОВ ===
async function loadOrders() {
  console.log('📋 Загрузка заказов...');
  // TODO: Реализовать загрузку заказов
}

// === ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ ===
async function loadUsers() {
  console.log('👥 Загрузка пользователей...');
  // TODO: Реализовать загрузку пользователей
}

console.log('✅ Admin.js loaded successfully');
