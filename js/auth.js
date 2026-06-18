import { supabase } from './supabase.js';
import { t } from './i18n.js';

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange(function(event, session) {
    callback(event, session);
  });
}

export function renderAuthScreen(isRegister) {
  isRegister = isRegister || false;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('auth-title').textContent = isRegister ? 'Реєстрація' : 'Вхід';
  document.getElementById('auth-toggle-btn').textContent = isRegister ? 'Вже є акаунт? Увійти' : 'Немає акаунту? Реєстрація';
  document.getElementById('auth-submit-btn').textContent = isRegister ? 'Зареєструватись' : 'Увійти';
  window._authIsRegister = isRegister;
}

export async function handleAuthSubmit() {
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  var errEl = document.getElementById('auth-error');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Введи email і пароль'; return; }
  try {
    document.getElementById('auth-submit-btn').textContent = '...';
    if (window._authIsRegister) {
      await signUp(email, password);
      errEl.style.color = 'var(--green)';
      errEl.textContent = 'Перевір пошту для підтвердження акаунту';
    } else {
      await signIn(email, password);
      // onAuthStateChange fires and calls initApp
    }
  } catch(e) {
    errEl.style.color = 'var(--red)';
    errEl.textContent = e.message || 'Помилка входу';
    document.getElementById('auth-submit-btn').textContent = window._authIsRegister ? 'Зареєструватись' : 'Увійти';
  }
}
