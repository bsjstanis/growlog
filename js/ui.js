export function toast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); }, 2500);
}

export function openModal(id) { document.getElementById(id).classList.add('open'); }
export function closeModal(id) { document.getElementById(id).classList.remove('open'); }
export function openPopup(id) { document.getElementById(id).classList.add('open'); }
export function closePopup(id) { document.getElementById(id).classList.remove('open'); }

export function initModalClosers() {
  document.querySelectorAll('.modal-overlay').forEach(function(el) {
    el.addEventListener('click', function(e) { if (e.target === el) closeModal(el.id); });
  });
}

export function updateRating(val) {
  var v = parseFloat(val) || 0;
  document.getElementById('rating-val').textContent = (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1));
  var fill = document.getElementById('rating-stars-fill');
  if (fill) fill.style.width = (v / 10 * 100) + '%';
}

export function previewHarvPhoto(input) {
  var file = input.files[0]; if (!file) return;
  var p = document.getElementById('harv-photo-preview');
  p.src = URL.createObjectURL(file); p.style.display = 'block';
  document.getElementById('harv-photo-delete-btn').style.display = 'inline-flex';
}

export function clearHarvPhoto() {
  document.getElementById('harv-photo-input').value = '';
  document.getElementById('harv-photo-preview').style.display = 'none';
  document.getElementById('harv-photo-delete-btn').style.display = 'none';
  document.getElementById('harv-photo-existing').value = 'DELETE';
}
