import { SB_URL, SB_KEY } from './config.js';
import { setSession } from './supabase.js';

var SESSION_KEY = 'gl_sb_session';

function saveSession(data) {
  var session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (parseInt(data.expires_in) || 3600),
    user: data.user || null
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  setSession(session);
  return session;
}

async function refreshSession(refreshToken) {
  var r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  var data = await r.json();
  if (!r.ok) throw new Error('Refresh failed');
  return saveSession(data);
}

export async function getSession() {
  // Check for OAuth redirect in URL hash
  var hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    var params = new URLSearchParams(hash.replace('#', ''));
    var tokenData = {
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
      expires_in: params.get('expires_in') || 3600
    };
    if (tokenData.access_token) {
      history.replaceState(null, null, window.location.pathname);
      return saveSession(tokenData);
    }
  }
  // Check stored session
  var stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    var session = JSON.parse(stored);
    if (!session.access_token) { localStorage.removeItem(SESSION_KEY); return null; }
    // Refresh if expired
    if (session.expires_at && Date.now() / 1000 > session.expires_at - 60) {
      if (session.refresh_token) {
        try { return await refreshSession(session.refresh_token); }
        catch(e) { localStorage.removeItem(SESSION_KEY); return null; }
      }
      localStorage.removeItem(SESSION_KEY); return null;
    }
    setSession(session);
    return session;
  } catch(e) { localStorage.removeItem(SESSION_KEY); return null; }
}

export async function signIn(email, password) {
  var r = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });
  var data = await r.json();
  if (!r.ok) throw new Error(data.error_description || data.msg || 'Невірний email або пароль');
  return saveSession(data);
}

export async function signUp(email, password) {
  var r = await fetch(SB_URL + '/auth/v1/signup', {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });
  var data = await r.json();
  if (!r.ok) throw new Error(data.error_description || data.msg || 'Помилка реєстрації');
  if (data.access_token) return saveSession(data);
  return data; // needs email confirmation
}

export async function signInWithGoogle() {
  var redirectTo = window.location.origin + window.location.pathname;
  window.location.href = SB_URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(redirectTo);
}

export async function signOut() {
  var stored = localStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      var s = JSON.parse(stored);
      if (s.access_token) {
        await fetch(SB_URL + '/auth/v1/logout', {
          method: 'POST',
          headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }
        });
      }
    } catch(e) {}
  }
  localStorage.removeItem(SESSION_KEY);
  setSession(null);
}

export function renderAuthScreen(isRegister) {
  document.getElementById('login-screen').style.display = 'flex';
  var title = document.getElementById('auth-title');
  var toggle = document.getElementById('auth-toggle-btn');
  var submit = document.getElementById('auth-submit-btn');
  var forgot = document.getElementById('auth-forgot-btn');
  if (title) title.textContent = isRegister ? 'Реєстрація' : 'Вхід';
  if (toggle) toggle.textContent = isRegister ? 'Вже є акаунт? Увійти' : 'Немає акаунту? Реєстрація';
  if (submit) submit.textContent = isRegister ? 'Зареєструватись' : 'Увійти';
  if (forgot) forgot.style.display = isRegister ? 'none' : 'block';
  window._authIsRegister = isRegister;
}

export async function handleAuthSubmit() {
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  var errEl = document.getElementById('auth-error');
  errEl.style.color = 'var(--red)';
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Введи email і пароль'; return; }
  var btn = document.getElementById('auth-submit-btn');
  btn.textContent = '...';
  try {
    if (window._authIsRegister) {
      var result = await signUp(email, password);
      if (!result.access_token) {
        errEl.style.color = 'var(--green)';
        errEl.textContent = 'Перевір пошту для підтвердження акаунту';
        btn.textContent = 'Зареєструватись';
        return;
      }
    } else {
      await signIn(email, password);
    }
    if (window.GrowLog && window.GrowLog._onSignIn) window.GrowLog._onSignIn();
  } catch(e) {
    errEl.textContent = e.message || 'Помилка входу';
    btn.textContent = window._authIsRegister ? 'Зареєструватись' : 'Увійти';
  }
}

export async function forgotPassword(email) {
  var { SB_URL, SB_KEY } = await import('./config.js');
  var r = await fetch(SB_URL + '/auth/v1/recover', {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email })
  });
  var d = await r.json();
  if (!r.ok) throw new Error(d.msg || d.error_description || 'Error');
}
