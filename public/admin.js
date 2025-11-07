// === ADMIN.JS — ФИНАЛЬНАЯ ВЕРСИЯ 2.5.6 ===
console.log('🚀 ADMIN.JS ЗАГРУЖЕН! Версия 2.5.6');

document.addEventListener('DOMContentLoaded', () => {
  console.log('📋 Админка: DOM загружен');

  const form = document.getElementById('productForm');
  if (!form) {
    console.error('❌ ОШИБКА: Форма #productForm не найдена!');
    return;
  }

  console.log('✅ Форма #productForm найдена');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📝 Форма отправлена!');

    const formData = new FormData(form);

    // ЧИТАЕМ ЧЕКБОКСЫ ПО ID ИЗ HTML
    const infiniteEl = document.getElementById('productInfinite');
    const activeEl = document.getElementById('productActive');

    const infinite = infiniteEl ? infiniteEl.checked : false;
    const active = activeEl ? activeEl.checked : true;

    console.log('📦 Чекбоксы:', { infinite, active });

    // ЯВНО ДОБАВЛЯЕМ В FormData
    formData.set('infinite_stock', infinite ? 'on' : 'off');
    formData.set('is_active', active ? 'on' : 'off');

    console.log('📤 Отправка:', {
      'infinite_stock': formData.get('infinite_stock'),
      'is_active': formData.get('is_active')
    });

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });

      const data = await res.json();
      console.log('📥 Ответ сервера:', data);

      if (data.success) {
        alert('✅ Товар успешно добавлен!');
        location.reload();
      } else {
        alert('❌ Ошибка: ' + (data.error || 'Неизвестно'));
        console.error('Сервер вернул ошибку:', data);
      }
    } catch (err) {
      console.error('❌ Ошибка сети:', err);
      alert('⚠️ Нет связи с сервером');
    }
  });
});
