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

    // ВАЖНО: Используем FormData для поддержки загрузки файлов
    const formData = new FormData(form);

    const infiniteEl = document.getElementById('productInfinite');
    const activeEl = document.getElementById('productActive');

    const infinite = infiniteEl ? infiniteEl.checked : false;
    const active = activeEl ? activeEl.checked : true;

    console.log('📦 Чекбоксы:', { infinite, active });

    // Добавляем чекбоксы в FormData (они не добавляются автоматически если не checked)
    formData.set('infinite_stock', infinite ? 'on' : 'off');
    formData.set('is_active', active ? 'on' : 'off');

    console.log('📤 Отправка FormData с полями:');
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value);
    }

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          // НЕ устанавливаем Content-Type - браузер автоматически установит с boundary
        },
        body: formData // Отправляем FormData напрямую
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
