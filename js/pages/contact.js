/* Contact — validated form + FAQ accordion */
(function () {
  'use strict';
  const { $, $$, toast, store } = FF;
  const form = $('#contactForm'), msg = form.message, counter = $('#msgCount');
  const rules = {
    first: (v) => v.trim().length >= 2 || 'Please enter your first name.',
    last: (v) => v.trim().length >= 2 || 'Please enter your last name.',
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Please enter a valid email address.',
    topic: (v) => !!v || 'Please choose a topic.',
    message: (v) => v.trim().length >= 20 || 'Please write at least 20 characters.'
  };
  const check = (el) => {
    const r = rules[el.name]; if (!r) return true;
    const res = r(el.value), f = el.closest('.field');
    f.classList.toggle('invalid', res !== true);
    el.setAttribute('aria-invalid', res !== true);
    $('.err', f).textContent = res === true ? '' : res;
    return res === true;
  };
  Object.keys(rules).forEach((n) => { const el = form[n]; el.addEventListener('blur', () => check(el)); el.addEventListener('input', () => el.closest('.field').classList.contains('invalid') && check(el)); });
  msg.addEventListener('input', () => { counter.textContent = `${msg.value.length}/600`; });
  const u = store.get('user', null); if (u) { form.first.value = u.first; form.last.value = u.last || ''; form.email.value = u.email; }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = Object.keys(rules).map((n) => form[n]).filter((el) => !check(el));
    if (bad.length) { bad[0].focus(); toast('Please fix the highlighted fields', 'circle-exclamation'); return; }
    const btn = $('button[type=submit]', form); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
    setTimeout(() => {
      const list = store.get('messages', []); list.push({ first: form.first.value, email: form.email.value, topic: form.topic.value, message: msg.value, at: Date.now() }); store.set('messages', list);
      form.innerHTML = `<div class="welcome" style="padding:30px 0"><span class="icon-bubble"><i class="fa-solid fa-paper-plane"></i></span><h2>Message sent!</h2><p class="muted" style="margin:8px auto 20px;max-width:320px">Thanks for reaching out. A real person from our team will reply within two business days.</p><a class="btn btn--dark" href="market.html">Explore Markets <i class="fa-solid fa-arrow-right"></i></a></div>`;
      toast('Message sent — we\'ll be in touch soon');
    }, 900);
  });
  /* FAQ accordion */
  $$('.faq-q').forEach((q) => q.addEventListener('click', () => {
    const item = q.closest('.faq-item'), open = !item.classList.contains('open');
    $$('.faq-item').forEach((i) => { i.classList.remove('open'); $('.faq-q', i).setAttribute('aria-expanded', 'false'); });
    if (open) { item.classList.add('open'); q.setAttribute('aria-expanded', 'true'); }
  }));
  $('#moreFaq').addEventListener('click', (e) => { $$('.faq-item[hidden]').forEach((i) => { i.hidden = false; }); e.currentTarget.remove(); });
})();
