/* Login & sign-up — client-side demo auth stored in localStorage */
(function () {
  'use strict';
  const { $, $$, toast, store, url } = FF;
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  const next = new URLSearchParams(location.search).get('next');
  const go = () => setTimeout(() => { location.href = url(next && /^[\w\-./]+\.html$/.test(next) ? next : 'bookmarks.html'); }, 900);
  const field = (el, msg) => { const f = el.closest('.field'); f.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', !!msg); $('.err', f).textContent = msg || ''; return !msg; };

  $$('.pw-toggle').forEach((b) => b.addEventListener('click', () => {
    const i = b.previousElementSibling, show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    b.innerHTML = `<i class="fa-regular fa-eye${show ? '' : '-slash'}"></i>`;
  }));
  $$('[data-social]').forEach((b) => b.addEventListener('click', () => toast(`${b.dataset.social} sign-in is coming soon — please use email for now`, 'circle-info')));

  const signed = store.get('user', null);
  const card = $('.auth__card');
  if (signed && document.body.dataset.page === 'login') {
    card.innerHTML = `<div class="welcome"><span class="icon-bubble"><i class="fa-regular fa-circle-user"></i></span><h2>Hi, ${FF.esc(signed.first)}!</h2><p class="muted" style="margin:6px 0 22px">You're signed in as ${FF.esc(signed.email)}.</p>
      <div class="btn-row" style="justify-content:center"><a class="btn btn--dark" href="bookmarks.html">My bookmarks <i class="fa-solid fa-arrow-right"></i></a><button class="btn btn--outline" id="signOut">Sign out</button></div></div>`;
    $('#signOut').addEventListener('click', () => { store.set('user', null); toast('You have been signed out', 'right-from-bracket'); setTimeout(() => location.reload(), 700); });
    return;
  }

  const login = $('#loginForm');
  if (login) {
    const remembered = store.get('remember', ''); if (remembered) { login.email.value = remembered; login.remember.checked = true; }
    login.addEventListener('submit', (e) => {
      e.preventDefault();
      const ok = [field(login.email, emailOk(login.email.value) ? '' : 'Enter a valid email address.'), field(login.password, login.password.value.length >= 6 ? '' : 'Password must be at least 6 characters.')].every(Boolean);
      if (!ok) return;
      const users = store.get('users', []);
      const u = users.find((x) => x.email === login.email.value.trim().toLowerCase());
      if (u && u.pw !== btoa(login.password.value)) { field(login.password, 'Incorrect password. Please try again.'); return; }
      const user = u || { first: login.email.value.split('@')[0].replace(/[^a-z]/gi, ' ').trim().split(' ')[0] || 'Friend', last: '', email: login.email.value.trim().toLowerCase() };
      user.first = user.first.charAt(0).toUpperCase() + user.first.slice(1);
      store.set('user', { first: user.first, last: user.last, email: user.email });
      store.set('remember', login.remember.checked ? user.email : '');
      toast(`Welcome back, ${user.first}!`); go();
    });
    $('#forgotLink').addEventListener('click', (e) => { e.preventDefault(); FF.openLayer($('#forgotModal')); });
    $('#forgotForm').addEventListener('submit', (e) => {
      e.preventDefault(); const em = e.target.femail;
      if (!field(em, emailOk(em.value) ? '' : 'Enter a valid email address.')) return;
      FF.closeLayer($('#forgotModal')); toast(`Reset link sent to ${em.value}`, 'envelope'); e.target.reset();
    });
  }

  const signup = $('#signupForm');
  if (signup) {
    const pw = signup.password, bar = $('#pwStrength span'), lbl = $('#pwLabel');
    pw.addEventListener('input', () => {
      const v = pw.value; let s = 0;
      if (v.length >= 8) s++; if (/[A-Z]/.test(v)) s++; if (/[0-9]/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
      bar.style.width = (s / 4 * 100) + '%';
      bar.style.background = ['#c2410c', '#c2410c', '#e0a100', '#8fbf1f', '#3f8f2a'][s];
      lbl.textContent = v ? ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][s] : '';
    });
    signup.addEventListener('submit', (e) => {
      e.preventDefault();
      const users = store.get('users', []), email = signup.email.value.trim().toLowerCase();
      const ok = [
        field(signup.first, signup.first.value.trim().length >= 2 ? '' : 'Enter your first name.'),
        field(signup.last, signup.last.value.trim().length >= 2 ? '' : 'Enter your last name.'),
        field(signup.email, !emailOk(email) ? 'Enter a valid email address.' : users.some((u) => u.email === email) ? 'An account with this email already exists.' : ''),
        field(pw, pw.value.length >= 8 ? '' : 'Use at least 8 characters.'),
        field(signup.terms, signup.terms.checked ? '' : 'Please accept the terms to continue.')
      ].every(Boolean);
      if (!ok) { $('.field.invalid input', signup)?.focus(); return; }
      const user = { first: signup.first.value.trim(), last: signup.last.value.trim(), email, pw: btoa(pw.value) };
      users.push(user); store.set('users', users);
      store.set('user', { first: user.first, last: user.last, email });
      toast(`Welcome to FreshFind, ${user.first}!`); go();
    });
  }
})();
