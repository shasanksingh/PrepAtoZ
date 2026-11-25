'use strict';
(() => {
  const DAY = 86400000, GUEST = 'prepatoz-guest-v3', LEGACY = 'genai-interview-studio-v2';
  const empty = () => ({ version: 2, questions: {}, last: null, quizzes: {}, activity: { days: [], daily: [] } });
  const publicIds = new Set(window.PREP_DATA.topics.flatMap(t => t.questions.map(q => q.id)));
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const remove = key => { try { localStorage.removeItem(key); } catch {} };
  const sanitizeGuest = value => ({ ...empty(), questions: Object.fromEntries(Object.entries(value?.questions || {}).filter(([id]) => publicIds.has(id))), last: publicIds.has(value?.last) ? value.last : null, quizzes: value?.quizzes || {}, activity: {days:window.PrepStudy.cleanDays(value?.activity?.days),daily:window.PrepStudy.cleanDays(value?.activity?.daily)} });
  let user = null, available = false, current = empty(), revision = 0, pending, syncing = false, conflict = false;
  let guest = read(GUEST);
  if (!guest || !Number.isFinite(guest.expiresAt) || guest.expiresAt <= Date.now()) {
    if (guest) remove(LEGACY);
    guest = { expiresAt: Date.now() + DAY, accepted: false, progress: sanitizeGuest(read(LEGACY)) }; write(GUEST, guest);
  }
  async function api(path, options = {}) {
    if (location.protocol === 'file:') throw Error('Run npm start to use accounts. You can browse as a guest here.');
    const response = await fetch('/api/' + path, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12000), ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    let body; try { body = await response.json(); } catch { throw Error('Accounts are not available on this deployment yet. You can continue as a guest.'); }
    if (!response.ok) { const error = Error(body.error || 'Please try again.'); error.status = response.status; throw error; }
    return body;
  }
  function status(text) { const node = document.getElementById('save-status'); if (node) node.textContent = text; }
  async function sync() {
    if (!user || syncing || conflict) return;
    syncing = true; const snapshot = JSON.stringify(current); status('Saving…');
    try {
      const result = await api('progress', { method: 'PUT', body: JSON.stringify({ progress: JSON.parse(snapshot), revision }) });
      revision = result.revision;
      write('prepatoz-user-' + user.id, { progress: current, revision, pending: JSON.stringify(current) !== snapshot });
      status('Saved to account');
      if (JSON.stringify(current) !== snapshot) pending = setTimeout(sync, 500);
    } catch (error) {
      if (error.status === 409) { conflict = true; status('Another tab changed progress. Export your draft, then reload.'); }
      else status('Saved on this device · sync pending');
    } finally { syncing = false; }
  }
  function expireGuest() {
    if (!user && Date.now() >= guest.expiresAt) {
      remove(GUEST); remove(LEGACY); location.reload();
    }
  }
  function paintIdentity() {
    const host = document.getElementById('account-control'); if (!host) return;
    host.replaceChildren();
    const button = document.createElement('button'); button.className = 'btn account-button'; button.dataset.action = 'account';
    button.textContent = user ? user.name + (user.role === 'admin' ? ' · Admin' : '') : 'Sign in';
    host.append(button);
    const side = document.querySelector('.side-bottom strong'); if (side) side.textContent = user ? user.name + "'s workspace" : 'Your study workspace';
    const hint = document.querySelector('.side-bottom small'); if (hint) hint.textContent = user ? 'Progress saved to your account' : 'Guest progress lasts 24 hours';
    document.querySelectorAll('[data-admin-link]').forEach(e => e.hidden = user?.role !== 'admin');
  }
  async function boot() {
    try {
      const result = await api('session'); user = result.user; available = result.accountsAvailable;
      if (user) {
        const stored = read('prepatoz-user-' + user.id), remote = await api('progress'); revision = remote.revision;
        current = stored?.pending && stored.revision === revision ? stored.progress : remote.progress || sanitizeGuest(guest.progress);
        if (user.role === 'admin' && !remote.progress && read(LEGACY)) current = read(LEGACY);
        if (!remote.progress || stored?.pending && stored.revision === revision) pending = setTimeout(sync, 800);
      }
    } catch { user = null; available = false; }
    if (!user) current = sanitizeGuest(guest.progress);
    paintIdentity();
    if (!user && !guest.accepted) setTimeout(() => openAccount('login', true), 150);
    return user;
  }
  const QUESTIONS = [['memory', 'What is a private memory phrase only you know?'], ['place', 'What place-and-word combination will you remember?'], ['phrase', 'What is your personal recovery sentence?']];
  function field(label, name, type = 'text', extra = '') { return `<label>${label}<input name="${name}" type="${type}" required ${extra}></label>`; }
  function questionField() { return `<label>Recovery question<select name="question" required>${QUESTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>`; }
  let mode = 'login', restoreFocus;
  function openAccount(next = 'login', first = false) {
    mode = next; const dialog = document.getElementById('account-dialog'); restoreFocus = document.activeElement;
    if (user) {
      dialog.innerHTML = `<div class="account-modal"><button class="modal-close" data-action="account-close" aria-label="Close account">×</button><p class="eyebrow">YOUR STUDY ACCOUNT</p><h2 id="account-title">You’re signed in.</h2><p id="account-name"></p><p>Your notes and progress sync to your account. Sessions last up to seven days.</p><div class="account-message" role="status" hidden></div><button class="btn primary" data-action="logout">Sign out</button></div>`;
      dialog.querySelector('#account-name').textContent = user.email + (user.role === 'admin' ? ' · Administrator' : '');
    } else {
      const title = next === 'register' ? 'Make room for your next idea.' : next === 'reset' ? 'Find your way back.' : 'Your next good answer starts here.';
      dialog.innerHTML = `<div class="account-modal"><button class="modal-close" data-action="account-close" aria-label="Continue as guest">×</button><img src="logo.svg" alt="AI" width="44" height="44"><p class="eyebrow">WELCOME TO PREPATOZ</p><h2 id="account-title">${title}</h2><p>${next === 'reset' ? 'Choose your recovery question and answer to set a new password.' : 'Save your learning across devices, or jump straight in as a guest.'}</p>${next !== 'reset' ? `<div class="account-tabs"><button data-action="account-tab" data-mode="login" class="${next === 'login' ? 'active' : ''}">Sign in</button><button data-action="account-tab" data-mode="register" class="${next === 'register' ? 'active' : ''}">Create account</button></div>` : ''}<form id="account-form">${next === 'register' ? field('Your name', 'name', 'text', 'autocomplete="name" minlength="2" maxlength="60"') : ''}${field('Email address', 'email', 'email', 'autocomplete="username" maxlength="254"')}${next !== 'login' ? questionField() + field('Your secret answer', 'answer', 'password', 'minlength="8" maxlength="200" autocomplete="off"') : ''}${field(next === 'reset' ? 'New password' : 'Password', 'password', 'password', `minlength="12" maxlength="256" autocomplete="${next === 'login' ? 'current-password' : 'new-password'}"`)}${next !== 'login' ? field('Confirm password', 'confirm', 'password', 'minlength="12" maxlength="256" autocomplete="new-password"') : ''}<div class="account-message" role="alert" hidden></div><button class="btn primary account-submit" type="submit">${next === 'register' ? 'Create my account' : next === 'reset' ? 'Reset password' : 'Sign in'}</button></form>${next === 'login' ? '<button class="textlink" data-action="account-tab" data-mode="reset">Forgot password?</button>' : '<button class="textlink" data-action="account-tab" data-mode="login">Back to sign in</button>'}${!available ? '<p class="account-setup-note">Sign-in is being set up on this deployment. You can keep studying as a guest.</p>' : ''}<div class="guest-divider"><span>OR KEEP IT SIMPLE</span></div><button class="btn guest-button" data-action="account-close">Skip · continue as guest</button><small>Guest notes and progress expire 24 hours after your visit starts. New accounts use a password of at least 12 characters.</small></div>`;
    }
    if (!dialog.open) dialog.showModal();
  }
  function closeAccount() {
    guest.accepted = true; write(GUEST, guest);
    const dialog = document.getElementById('account-dialog'); dialog.close(); dialog.innerHTML = ''; restoreFocus?.focus?.();
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    if (button.dataset.action === 'account') openAccount();
    if (button.dataset.action === 'account-close') closeAccount();
    if (button.dataset.action === 'account-tab') openAccount(button.dataset.mode);
    if (button.dataset.action === 'logout') {
      button.disabled = true;
      try { clearTimeout(pending); await sync(); await api('auth/logout', { method: 'POST', body: '{}' }); remove('prepatoz-user-' + user.id); location.reload(); }
      catch (error) { button.disabled = false; const message = document.querySelector('.account-message'); message.hidden = false; message.textContent = error.message; }
    }
  });
  document.addEventListener('submit', async event => {
    if (event.target.id !== 'account-form') return; event.preventDefault();
    const form = event.target, data = Object.fromEntries(new FormData(form)), submit = form.querySelector('[type="submit"]'), message = form.querySelector('.account-message');
    message.hidden = true;
    if (mode !== 'login' && data.password !== data.confirm) { message.hidden = false; message.textContent = 'The passwords do not match.'; return; }
    submit.disabled = true; submit.textContent = 'One moment…';
    try {
      const result = await api('auth/' + mode, { method: 'POST', body: JSON.stringify(data) });
      form.reset();
      if (mode === 'reset') { openAccount('login'); const node = document.querySelector('.account-message'); node.hidden = false; node.textContent = result.message; }
      else location.reload();
    } catch (error) { message.hidden = false; message.textContent = error.message; submit.disabled = false; submit.textContent = mode === 'register' ? 'Create my account' : mode === 'reset' ? 'Reset password' : 'Sign in'; }
  });
  document.getElementById('account-dialog').addEventListener('cancel', event => { event.preventDefault(); closeAccount(); });
  setInterval(expireGuest, 30000);
  window.addEventListener('focus', expireGuest);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') expireGuest(); else if (user) { clearTimeout(pending); sync(); } });
  window.PrepSession = {
    api, get user() { return user; }, get guestExpiresAt() { return guest.expiresAt; },
    load() { return current; },
    save(value) {
      current = value;
      if (user) { write('prepatoz-user-' + user.id, { progress: current, revision, pending: true }); clearTimeout(pending); pending = setTimeout(sync, 900); return true; }
      if (Date.now() >= guest.expiresAt) { expireGuest(); return false; }
      guest.progress = sanitizeGuest(value); return write(GUEST, guest);
    },
    open: openAccount,
    ready: boot()
  };
})();
