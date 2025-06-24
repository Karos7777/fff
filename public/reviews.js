// reviews.js — модуль для работы с отзывами

// Показать отзывы
async function showReviews(productId) {
  const modal = document.getElementById('reviewsModal');
  const container = document.getElementById('reviewsContainer');
  const reviewForm = document.getElementById('reviewForm');

  // Загружаем настоящие отзывы из базы
  try {
    const response = await fetch(`/api/products/${productId}/reviews`);
    if (!response.ok) throw new Error('Ошибка загрузки отзывов');
    const reviews = await response.json();
    renderReviews(reviews, container);
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><h3>Ошибка загрузки отзывов</h3></div>';
  }

  // Показываем форму отзыва только если пользователь авторизован и покупал этот товар
  if (window.currentUser) {
    // Проверяем, покупал ли пользователь этот товар
    const hasPurchased = window.orders && window.orders.some(order => order.product_id === productId && order.status === 'completed');
    reviewForm.style.display = hasPurchased ? 'block' : 'none';
  } else {
    reviewForm.style.display = 'none';
  }

  modal.style.display = 'block';
}

// Отрисовка отзывов
function renderReviews(reviews, container) {
  if (!reviews || reviews.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>Нет отзывов</h3></div>';
    return;
  }
  container.innerHTML = reviews.map(review => `
    <div class="review-item">
      <div class="review-header">
        <span class="review-user">
          ${review.is_hidden ? 'Пользователь' : `<a href='https://t.me/${review.username}' target='_blank'>${review.username || 'Пользователь'}</a>`}
        </span>
        <div class="stars">
          ${window.generateStars ? window.generateStars(review.rating) : ''}
        </div>
        <span class="review-date">${new Date(review.created_at).toLocaleDateString()}</span>
      </div>
      <div class="review-text">${review.text}</div>
    </div>
  `).join('');
}

// Добавить отзыв (пример, если есть форма)
async function addReview(productId, reviewData) {
  try {
    const response = await fetch(`/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData)
    });
    if (!response.ok) throw new Error('Ошибка отправки отзыва');
    return await response.json();
  } catch (err) {
    throw err;
  }
}

// Экспортируем showReviews глобально
window.showReviews = showReviews; 