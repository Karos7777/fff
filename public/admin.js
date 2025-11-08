// === ADMIN.JS — ФИНАЛЬНАЯ ВЕРСИЯ 2.5.7 ===
console.log('🚀 ADMIN.JS ЗАГРУЖЕН! Версия 2.5.7');

document.addEventListener('DOMContentLoaded', () => {
  console.log('📋 Админка: DOM загружен');

  const form = document.getElementById('productForm');
  if (!form) {
    console.error('❌ ФОРМА #productForm НЕ НАЙДЕНА!');
    return;
  }

  console.log('✅ Форма #productForm найдена');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📝 Форма отправлена');

    const formData = new FormData(form);

    const infiniteEl = document.getElementById('productInfinite');
    const activeEl = document.getElementById('productActive');

    const infinite = infiniteEl ? infiniteEl.checked : false;
    const active = activeEl ? activeEl.checked : true;

    console.log('📦 Чекбоксы:', { infinite, active });

    // Преобразуем FormData в JSON объект
    const productData = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price')) || 0,
      price_ton: parseFloat(formData.get('price_ton')) || null,
      price_usdt: parseFloat(formData.get('price_usdt')) || null,
      price_stars: parseInt(formData.get('price_stars')) || null,
      category: formData.get('category') || 'other',
      image_url: formData.get('image_url') || null,
      file_path: formData.get('file_path') || null,
      stock: infinite ? 999999 : (parseInt(formData.get('stock')) || 0),
      infinite_stock: infinite,
      is_active: active
    };

    console.log('📤 Отправка:', productData);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      });

      const data = await res.json();
      console.log('📥 Ответ сервера:', data);

      if (data.success) {
        alert('✅ Товар добавлен!');
        location.reload();
      } else {
        alert('❌ Ошибка: ' + (data.error || 'Неизвестно'));
      }
    } catch (err) {
      console.error('❌ Ошибка сети:', err);
      alert('⚠️ Нет связи с сервером');
    }
  });
});
