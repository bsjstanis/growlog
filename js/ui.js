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

// Create a popup on the fly if the (possibly cached, older) index.html doesn't have it yet.
// Keeps new features working right after a deploy, before the browser refreshes index.html.
export function ensurePopup(id, contentId, titleHtml, titleId, closeJs, closeOnBackdrop) {
  if (document.getElementById(id)) return;
  var el = document.createElement('div');
  el.className = 'popup-overlay'; el.id = id;
  if (closeOnBackdrop !== false) el.setAttribute('onclick', "if(event.target===this)GrowLog.closePopup('" + id + "')");
  el.innerHTML = '<div class="popup"><div class="popup-title"><span' + (titleId ? ' id="' + titleId + '"' : '') + '>' + titleHtml + '</span>' +
    '<button class="popup-close" onclick="' + (closeJs || "GrowLog.closePopup('" + id + "')") + '">&#10005;</button></div>' +
    '<div id="' + contentId + '"></div></div>';
  document.body.appendChild(el);
}

export function ensureLightbox() {
  if (document.getElementById('lightbox')) return;
  if (!document.getElementById('lightbox-style')) {
    var st = document.createElement('style'); st.id = 'lightbox-style';
    st.textContent = '.lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:700;align-items:center;justify-content:center;cursor:zoom-out}.lightbox.open{display:flex}.lightbox img{max-width:100vw;max-height:100vh;object-fit:contain}.lightbox-close{position:absolute;top:14px;right:18px;color:#fff;font-size:26px}';
    document.head.appendChild(st);
  }
  var el = document.createElement('div');
  el.className = 'lightbox'; el.id = 'lightbox';
  el.setAttribute('onclick', 'GrowLog.closeLightbox()');
  el.innerHTML = '<img id="lightbox-img" alt="photo"><span class="lightbox-close">&#10005;</span>';
  document.body.appendChild(el);
}
