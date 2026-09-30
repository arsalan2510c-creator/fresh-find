/*!
 * FreshFind core — shared utilities, data layer, cart, bookmarks, search.
 * Vanilla JS, no dependencies.
 */
(function () {
  'use strict';

  const BASE = document.body.dataset.base || '';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const money = (n) => 'Rs ' + Number(n).toLocaleString('en-PK');
  const url = (p) => (/^(https?:)?\/\//.test(p) ? p : BASE + p);

  /* ------------------------------------------------------------------
   * Storage (safe wrapper — private mode / disabled storage never breaks UI)
   * ------------------------------------------------------------------ */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ff:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ff:' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  /* ------------------------------------------------------------------
   * Data layer — loads the JSON files in /data.
   * When the site is opened straight from disk (file://) browsers block
   * fetch(), so we fall back to js/data-bundle.js which contains the same
   * JSON, generated from the /data folder.
   * ------------------------------------------------------------------ */
  const cache = {};
  let bundlePromise = null;
  function loadBundle() {
    if (window.FF_BUNDLE) return Promise.resolve(window.FF_BUNDLE);
    if (!bundlePromise) {
      bundlePromise = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = url('js/data-bundle.js');
        s.onload = () => res(window.FF_BUNDLE);
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    return bundlePromise;
  }
  function getJSON(path) {
    if (cache[path]) return cache[path];
    const viaBundle = () => loadBundle().then((b) => {
      if (!b || !b[path]) throw new Error('Missing data: ' + path);
      return b[path];
    });
    cache[path] = (location.protocol === 'file:')
      ? viaBundle()
      : fetch(url(path), { cache: 'no-cache' })
          .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
          .catch(viaBundle);
    return cache[path];
  }

  const data = {
    markets: () => getJSON('data/markets.json'),
    info: () => getJSON('data/produce-info.json'),
    market: (slug) => data.markets().then((ms) => ms.find((m) => m.slug === slug)),
    products: (slug) => data.market(slug).then((m) => (m ? getJSON(m.dataFile) : [])),
    /** Every product from every market, each tagged with its market slug. */
    all() {
      return data.markets().then((ms) => Promise.all(ms.map((m) =>
        getJSON(m.dataFile).then((list) => list.map((p) => Object.assign({}, p, { market: m.slug, marketName: m.name, area: m.area })))
      ))).then((lists) => lists.flat());
    },
    /** Products grouped by name → one "produce guide" entry per item. */
    produce() {
      return Promise.all([data.all(), data.info()]).then(([all, info]) => {
        const map = new Map();
        all.forEach((p) => {
          const slug = slugify(p.name);
          if (!map.has(slug)) map.set(slug, { slug, name: p.name, category: p.category, items: [], info: info[slug] || null });
          map.get(slug).items.push(p);
        });
        return Array.from(map.values()).map((g) => {
          const prices = g.items.map((i) => i.price);
          const rated = g.items.reduce((a, i) => a + i.rating * i.reviews, 0);
          const reviews = g.items.reduce((a, i) => a + i.reviews, 0);
          const badges = g.items.map((i) => i.badge).filter(Boolean);
          return Object.assign(g, {
            minPrice: Math.min(...prices), maxPrice: Math.max(...prices),
            rating: reviews ? +(rated / reviews).toFixed(1) : 0, reviews,
            organic: g.items.some((i) => i.organic),
            featured: g.items.filter((i) => i.featured).length,
            badge: badges.sort((a, b) => badges.filter((x) => x === b).length - badges.filter((x) => x === a).length)[0] || null,
            description: g.items[0].description,
            image: (g.info && g.info.image) || g.items[0].image,
            inStock: g.items.filter((i) => i.stock !== 'Out of Stock').length
          });
        });
      });
    }
  };

  /** Best image for a product: curated photo when we have one, else the JSON image. */
  function imgFor(p, info) {
    const i = info && info[slugify(p.name)];
    return url((i && i.image) || p.image);
  }
  /** Offline / broken image fallback: an on-brand SVG tile with the item's name. */
  function imgFallback(e) {
    const img = e.target;
    if (img.dataset.fallback) return;
    img.dataset.fallback = '1';
    const label = (img.alt || 'FreshFind').slice(0, 28);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 312"><rect width="400" height="312" fill="#0e2216"/><circle cx="200" cy="120" r="46" fill="#c6f135" opacity=".14"/><path d="M200 92c-20 12-28 32-22 52 18-2 32-14 36-34 2-8-4-16-14-18z" fill="#c6f135"/><text x="200" y="222" fill="#f8f6f2" font-family="Georgia,serif" font-size="26" text-anchor="middle">${esc(label)}</text></svg>`;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') imgFallback(e); }, true);

  /* ------------------------------------------------------------------
   * Market helpers — open status (Karachi time) and distance
   * ------------------------------------------------------------------ */
  function karachiNow() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: 'numeric', weekday: 'short', hour12: false }).formatToParts(new Date());
      const h = +parts.find((p) => p.type === 'hour').value % 24;
      const wd = parts.find((p) => p.type === 'weekday').value;
      return { h, sunday: wd === 'Sun' };
    } catch (e) { const d = new Date(); return { h: d.getHours(), sunday: d.getDay() === 0 }; }
  }
  const fmtH = (h) => { const s = h >= 12 ? 'PM' : 'AM'; const x = h % 12 || 12; return x + ':00 ' + s; };
  const shortH = (h) => (h % 12 || 12) + (h >= 12 ? 'pm' : 'am');
  function marketStatus(m) {
    const { h, sunday } = karachiNow();
    const closedDay = m.hours.days === 'Mon–Sat' && sunday;
    const open = !closedDay && h >= m.hours.open && h < m.hours.close;
    return {
      open,
      label: open ? 'Open now · till ' + shortH(m.hours.close) : (closedDay ? 'Closed today' : 'Closed · opens ' + shortH(m.hours.open)),
      hours: m.hours.days + ', ' + fmtH(m.hours.open) + ' – ' + fmtH(m.hours.close)
    };
  }
  const SADDAR = { lat: 24.8607, lng: 67.0104 };
  function userLoc() { return store.get('loc', null); }
  function distanceKm(m, from) {
    const o = from || userLoc() || SADDAR;
    const R = 6371, rad = (d) => d * Math.PI / 180;
    const dLat = rad(m.lat - o.lat), dLng = rad(m.lng - o.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(o.lat)) * Math.cos(rad(m.lat)) * Math.sin(dLng / 2) ** 2;
    return +(2 * R * Math.asin(Math.sqrt(a))).toFixed(1);
  }
  function locate() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('unsupported'));
      navigator.geolocation.getCurrentPosition(
        (p) => { const l = { lat: p.coords.latitude, lng: p.coords.longitude }; store.set('loc', l); res(l); },
        rej, { timeout: 8000, maximumAge: 600000 });
    });
  }
  /** Price normalised to Rs/kg for weight units (Bunch / Dozen can't be compared by weight). */
  function perKg(p) {
    const m = /^([\d.]+)\s*(kg|g)\b/i.exec(p.unit || '');
    if (!m) return null;
    const kg = m[2].toLowerCase() === 'kg' ? +m[1] : +m[1] / 1000;
    return Math.round(p.price / kg);
  }
  const stars = (r) => { const f = Math.round(r); return '★★★★★'.slice(0, f) + '☆☆☆☆☆'.slice(0, 5 - f); };

  /* ------------------------------------------------------------------
   * Toasts
   * ------------------------------------------------------------------ */
  function toast(msg, icon = 'circle-check') {
    let wrap = $('.toasts');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toasts'; wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<i class="fa-solid fa-${icon}" aria-hidden="true"></i><span>${esc(msg)}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  /* ------------------------------------------------------------------
   * Overlay / modal helper with focus trap + ESC
   * ------------------------------------------------------------------ */
  let lastFocus = null;
  function openLayer(el) {
    lastFocus = document.activeElement;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const f = el.querySelector('[autofocus], input, button, a[href], select, textarea');
    setTimeout(() => f && f.focus(), 60);
  }
  function closeLayer(el) {
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    if (!$('.overlay.open, .drawer.open')) document.body.style.overflow = '';
    const bd = $('.backdrop'); if (bd && !$('.drawer.open')) bd.classList.remove('open');
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener('keydown', (e) => {
    const top = $$('.overlay.open, .drawer.open').pop();
    if (!top) return;
    if (e.key === 'Escape') { closeLayer(top); if (top.classList.contains('drawer')) $('.backdrop')?.classList.remove('open'); }
    if (e.key === 'Tab') {
      const f = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', top).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('overlay')) closeLayer(e.target);
    const c = e.target.closest('[data-close]');
    if (c) closeLayer(c.closest('.overlay, .drawer'));
  });

  /* ------------------------------------------------------------------
   * Bookmarks
   * ------------------------------------------------------------------ */
  const bookmarks = {
    all() { return store.get('bookmarks', { markets: [], produce: [] }); },
    has(type, slug) { return bookmarks.all()[type].some((b) => b.slug === slug); },
    toggle(type, slug, name) {
      const b = bookmarks.all();
      const i = b[type].findIndex((x) => x.slug === slug);
      if (i > -1) b[type].splice(i, 1); else b[type].unshift({ slug, savedAt: Date.now() });
      store.set('bookmarks', b);
      const saved = i === -1;
      toast(saved ? `${name || 'Item'} saved to bookmarks` : `${name || 'Item'} removed from bookmarks`, saved ? 'bookmark' : 'trash-can');
      syncSaveButtons();
      document.dispatchEvent(new CustomEvent('ff:bookmarks'));
      return saved;
    },
    count() { const b = bookmarks.all(); return b.markets.length + b.produce.length; }
  };
  function syncSaveButtons() {
    $$('[data-save]').forEach((btn) => {
      const [type, slug] = btn.dataset.save.split(':');
      const on = bookmarks.has(type, slug);
      btn.setAttribute('aria-pressed', on);
      const i = btn.querySelector('i');
      if (i) { i.classList.toggle('fa-solid', on); i.classList.toggle('fa-regular', !on); }
      const lbl = btn.querySelector('.lbl');
      if (lbl) lbl.textContent = on ? (btn.dataset.onLabel || 'Saved') : (btn.dataset.offLabel || 'Save');
    });
    const n = bookmarks.count();
    $$('.bm-count').forEach((el) => { el.textContent = n; el.classList.toggle('show', n > 0); });
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save]');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const [type, slug] = btn.dataset.save.split(':');
    bookmarks.toggle(type, slug, btn.dataset.name);
  });

  /* ------------------------------------------------------------------
   * Cart (localStorage) + drawer
   * ------------------------------------------------------------------ */
  const cart = {
    items() { return store.get('cart', []); },
    save(items) { store.set('cart', items); renderCart(); },
    add(item) {
      const items = cart.items();
      const ex = items.find((i) => i.key === item.key);
      if (ex) ex.qty += 1; else items.push(Object.assign({ qty: 1 }, item));
      cart.save(items);
      toast(`${item.name} added to your basket`, 'basket-shopping');
      const b = $('.cart-count'); if (b) { b.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 350 }); }
    },
    setQty(key, q) { let items = cart.items(); const it = items.find((i) => i.key === key); if (!it) return; it.qty = q; items = items.filter((i) => i.qty > 0); cart.save(items); },
    total() { return cart.items().reduce((a, i) => a + i.price * i.qty, 0); },
    count() { return cart.items().reduce((a, i) => a + i.qty, 0); }
  };
  function buildDrawer() {
    const d = document.createElement('div');
    d.innerHTML = `
      <div class="backdrop" data-drawer-close></div>
      <aside class="drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-labelledby="cartTitle" aria-hidden="true">
        <div class="drawer__head"><h2 id="cartTitle">Your basket</h2><button class="x-btn" data-drawer-close aria-label="Close basket"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="drawer__body" id="cartBody"></div>
        <div class="drawer__foot" id="cartFoot"></div>
      </aside>`;
    document.body.append(...d.children);
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-drawer-close]')) closeCart();
      const q = e.target.closest('[data-qty]');
      if (q) { const [key, delta] = q.dataset.qty.split('|'); const it = cart.items().find((i) => i.key === key); if (it) cart.setQty(key, it.qty + +delta); }
      const r = e.target.closest('[data-rm]'); if (r) cart.setQty(r.dataset.rm, 0);
      if (e.target.closest('#checkoutBtn')) checkout();
    });
  }
  function openCart() { renderCart(); const d = $('#cartDrawer'); $('.backdrop').classList.add('open'); openLayer(d); }
  function closeCart() { $('.backdrop')?.classList.remove('open'); closeLayer($('#cartDrawer')); }
  function renderCart() {
    const body = $('#cartBody'), foot = $('#cartFoot'), items = cart.items();
    const n = cart.count();
    $$('.cart-count').forEach((el) => { el.textContent = n; el.classList.toggle('show', n > 0); });
    if (!body) return;
    if (!items.length) {
      body.innerHTML = `<div class="empty" style="border:0"><i class="fa-solid fa-basket-shopping" aria-hidden="true"></i><h3>Your basket is empty</h3><p>Browse a market and add fresh picks.</p><a class="btn btn--dark" href="${url('market.html')}">Explore Markets <i class="fa-solid fa-arrow-right"></i></a></div>`;
      foot.innerHTML = ''; return;
    }
    body.innerHTML = items.map((i) => `
      <div class="cart-item">
        <img src="${esc(i.image)}" alt="" loading="lazy">
        <div><b>${esc(i.name)}</b><small>${esc(i.marketName)} · ${esc(i.unit)}</small>
          <div class="qty" role="group" aria-label="Quantity for ${esc(i.name)}">
            <button data-qty="${esc(i.key)}|-1" aria-label="Decrease">−</button><span>${i.qty}</span><button data-qty="${esc(i.key)}|1" aria-label="Increase">+</button>
          </div></div>
        <div style="text-align:right"><b>${money(i.price * i.qty)}</b><button class="rm" data-rm="${esc(i.key)}" aria-label="Remove ${esc(i.name)}"><i class="fa-regular fa-trash-can"></i></button></div>
      </div>`).join('');
    const sub = cart.total(), fee = sub >= 2000 ? 0 : 150;
    foot.innerHTML = `
      <div class="cart-row"><span>Subtotal</span><span>${money(sub)}</span></div>
      <div class="cart-row"><span>Delivery</span><span>${fee ? money(fee) : 'Free'}</span></div>
      ${fee ? `<small class="muted" style="font-size:.72rem">Add ${money(2000 - sub)} more for free delivery</small>` : ''}
      <div class="cart-row total"><span>Total</span><span>${money(sub + fee)}</span></div>
      <button class="btn btn--dark btn--block" id="checkoutBtn">Place Order <i class="fa-solid fa-arrow-right"></i></button>`;
  }
  function checkout() {
    const user = store.get('user', null);
    if (!user) { toast('Please sign in to place your order', 'user'); setTimeout(() => { location.href = url('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'index.html')); }, 900); return; }
    const orders = store.get('orders', []);
    orders.unshift({ id: 'FF' + Date.now().toString().slice(-6), total: cart.total(), items: cart.items(), at: Date.now() });
    store.set('orders', orders);
    cart.save([]);
    $('#cartBody').innerHTML = `<div class="empty welcome" style="border:0"><span class="icon-bubble"><i class="fa-solid fa-check"></i></span><h3>Order placed!</h3><p>Thank you, ${esc(user.first)}. Order <b>#${orders[0].id}</b> will be packed fresh from the market.</p></div>`;
    $('#cartFoot').innerHTML = '';
  }

  /* ------------------------------------------------------------------
   * Global search overlay (markets + produce)
   * ------------------------------------------------------------------ */
  function buildSearch() {
    const d = document.createElement('div');
    d.innerHTML = `
      <div class="overlay" id="searchLayer" role="dialog" aria-modal="true" aria-label="Search FreshFind" aria-hidden="true">
        <div class="search-box">
          <div class="search-box__bar">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <label for="gSearch" class="sr-only">Search markets and produce</label>
            <input id="gSearch" type="search" placeholder="Search markets, areas or produce…" autocomplete="off" autofocus>
            <button class="x-btn" data-close aria-label="Close search"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="search-res" id="gResults" aria-live="polite"></div>
        </div>
      </div>`;
    document.body.appendChild(d.firstElementChild);
    const input = $('#gSearch'), out = $('#gResults');
    const hint = () => {
      out.innerHTML = `<div class="search-hint">Try a market, an area or something fresh.<div class="pills">${['Mango', 'Tomato', 'Saddar', 'Gulshan', 'Spinach', 'Dates'].map((t) => `<button class="pill" data-q="${t}">${t}</button>`).join('')}</div></div>`;
    };
    hint();
    out.addEventListener('click', (e) => { const p = e.target.closest('[data-q]'); if (p) { input.value = p.dataset.q; input.dispatchEvent(new Event('input')); input.focus(); } });
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) return hint();
        Promise.all([data.markets(), data.produce()]).then(([ms, ps]) => {
          const mark = (s) => esc(s).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
          const mm = ms.filter((m) => (m.name + ' ' + m.area + ' ' + m.address).toLowerCase().includes(q)).slice(0, 5);
          const pp = ps.filter((p) => (p.name + ' ' + p.category).toLowerCase().includes(q)).slice(0, 6);
          if (!mm.length && !pp.length) { out.innerHTML = `<div class="search-hint">No results for “${esc(q)}”. Try another word.</div>`; return; }
          out.innerHTML =
            (mm.length ? `<h4>Markets</h4>` + mm.map((m) => `<a class="sres" href="${url('markets/' + m.slug + '.html')}"><img src="${url(m.image)}" alt=""><div><b>${mark(m.name)}</b><small>${mark(m.area)} · ★ ${m.rating}</small></div></a>`).join('') : '') +
            (pp.length ? `<h4>Produce</h4>` + pp.map((p) => `<a class="sres" href="${url('product.html?item=' + p.slug)}"><img src="${url(p.image)}" alt=""><div><b>${mark(p.name)}</b><small>${esc(p.category)} · from ${money(p.minPrice)} · ${p.items.length} markets</small></div></a>`).join('') : '');
        });
      }, 150);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const first = $('.sres', out); if (first) location.href = first.href; else location.href = url('produce.html?q=' + encodeURIComponent(input.value)); }
      if (e.key === 'ArrowDown') { e.preventDefault(); $('.sres', out)?.focus(); }
    });
    out.addEventListener('keydown', (e) => {
      const items = $$('.sres', out), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : input).focus(); }
    });
  }

  /* ------------------------------------------------------------------
   * Header, nav, scroll UI, reveal, newsletter, account label
   * ------------------------------------------------------------------ */
  function initChrome() {
    const hdr = $('.hdr'), prog = $('.progress'), top = $('.to-top');
    const onScroll = () => {
      const y = window.scrollY;
      hdr && hdr.classList.toggle('is-scrolled', y > 10);
      top && top.classList.toggle('show', y > 600);
      if (prog) { const h = document.documentElement.scrollHeight - innerHeight; prog.style.width = (h > 0 ? y / h * 100 : 0) + '%'; }
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    top && top.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

    const nav = $('#mainNav'), tog = $('.nav-toggle');
    const setNav = (open) => { nav.classList.toggle('open', open); tog.setAttribute('aria-expanded', open); $('.backdrop')?.classList.toggle('open', open); document.body.style.overflow = open ? 'hidden' : ''; if (open) $('a', nav)?.focus(); };
    tog && tog.addEventListener('click', () => setNav(!nav.classList.contains('open')));
    $('.nav__close')?.addEventListener('click', () => { setNav(false); tog.focus(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav?.classList.contains('open')) { setNav(false); tog.focus(); } });
    document.addEventListener('click', (e) => { if (nav?.classList.contains('open') && e.target.classList.contains('backdrop')) setNav(false); });

    $$('[data-open-search]').forEach((b) => b.addEventListener('click', () => { if (nav?.classList.contains('open')) setNav(false); openLayer($('#searchLayer')); }));
    $$('[data-open-cart]').forEach((b) => b.addEventListener('click', () => { if (nav?.classList.contains('open')) setNav(false); openCart(); }));
    document.addEventListener('keydown', (e) => { if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openLayer($('#searchLayer')); } });

    const user = store.get('user', null);
    if (user) $$('.acct .lbl').forEach((l) => { l.textContent = user.first; });

    // Newsletter forms
    $$('form[data-newsletter]').forEach((f) => f.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('input[type=email]', f);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inp.value.trim())) { toast('Please enter a valid email address', 'circle-exclamation'); inp.focus(); return; }
      const subs = store.get('newsletter', []); if (!subs.includes(inp.value)) subs.push(inp.value); store.set('newsletter', subs);
      toast("You're subscribed — fresh notes are on the way!"); f.reset();
    }));
    const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();
  }

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }) : null;
  function reveal(root = document) { $$('[data-reveal]:not(.in)', root).forEach((el) => (io ? io.observe(el) : el.classList.add('in'))); }

  /* ------------------------------------------------------------------
   * Shared card templates
   * ------------------------------------------------------------------ */
  function marketCard(m, i = 0) {
    const s = marketStatus(m), km = distanceKm(m);
    return `<article class="mcard" data-reveal style="transition-delay:${(i % 3) * 70}ms">
      <div class="mcard__media">
        <span class="tag ${s.open ? '' : 'tag--closed'}">${s.open ? 'Open now' : 'Closed now'}</span>
        <button class="save-btn" data-save="markets:${m.slug}" data-name="${esc(m.name)}" aria-label="Save ${esc(m.name)} to bookmarks" aria-pressed="false"><i class="fa-regular fa-bookmark"></i></button>
        <img src="${url(m.image)}" alt="${esc(m.name)} produce stalls" loading="lazy" width="600" height="375">
      </div>
      <div class="mcard__body">
        <div class="mcard__title"><h3>${esc(m.name)}</h3><span class="rating" aria-label="Rated ${m.rating} out of 5"><i class="fa-solid fa-star" aria-hidden="true"></i>${m.rating}</span></div>
        <div class="mcard__loc"><i class="fa-solid fa-location-dot" aria-hidden="true"></i>${esc(m.area)} · ${km} km</div>
        <p class="mcard__desc">${esc(m.tagline)}</p>
        <div class="mcard__meta"><span><i class="fa-regular fa-clock"></i> ${shortH(m.hours.open)}–${shortH(m.hours.close)}</span><span><i class="fa-solid fa-store"></i> ${esc(m.vendors)} vendors</span></div>
        <a href="${url('markets/' + m.slug + '.html')}" class="btn btn--outline btn--block">View Market <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </article>`;
  }
  /** Card for an individual product sold at a market (with price + add to basket). */
  function productCard(p, info, i = 0) {
    const slug = slugify(p.name), low = p.stock !== 'In Stock';
    return `<article class="pcard" data-reveal style="transition-delay:${(i % 4) * 60}ms">
      <div class="pcard__media">
        ${p.badge ? `<span class="tag">${esc(p.badge)}</span>` : ''}
        <button class="save-btn" data-save="produce:${slug}" data-name="${esc(p.name)}" aria-label="Save ${esc(p.name)} to bookmarks" aria-pressed="false"><i class="fa-regular fa-bookmark"></i></button>
        <img src="${imgFor(p, info)}" alt="${esc(p.name)}" loading="lazy" width="400" height="312">
        ${p.discount ? `<span class="pcard__disc">-${esc(p.discount)}</span>` : ''}
      </div>
      <div class="pcard__body">
        <span class="cat">${esc(p.category)}</span>
        <h3><a href="${url('product.html?item=' + slug + (p.market ? '&market=' + p.market : ''))}">${esc(p.name)}</a></h3>
        <p>${esc(p.description)}</p>
        <div class="pcard__rate"><i class="fa-solid fa-star" aria-hidden="true"></i> ${p.rating} <span>(${p.reviews})</span> · <span class="stock ${low ? 'low' : ''}">${esc(p.stock)}</span></div>
        <div class="pcard__foot">
          <span class="price">${money(p.price)}${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ''}<br><small>${esc(p.unit)}</small></span>
          <button class="add-btn" data-add='${esc(JSON.stringify({ key: p.market + ':' + p.id, name: p.name, market: p.market, marketName: p.marketName, price: p.price, unit: p.unit, image: imgFor(p, info) }))}' aria-label="Add ${esc(p.name)} to basket"><i class="fa-solid fa-plus"></i></button>
        </div>
      </div>
    </article>`;
  }
  /** Card for an aggregated produce guide entry. */
  function guideCard(g, i = 0, blurb) {
    return `<article class="pcard" data-reveal style="transition-delay:${(i % 4) * 60}ms">
      <div class="pcard__media">
        <span class="tag">${inSeason(g) ? 'Peak now' : (g.badge || 'All season')}</span>
        <button class="save-btn" data-save="produce:${g.slug}" data-name="${esc(g.name)}" aria-label="Save ${esc(g.name)} to bookmarks" aria-pressed="false"><i class="fa-regular fa-bookmark"></i></button>
        <img src="${url(g.image)}" alt="${esc(g.name)}" loading="lazy" width="400" height="312">
      </div>
      <div class="pcard__body">
        <span class="cat">${esc(g.category)}</span>
        <h3><a href="${url('product.html?item=' + g.slug)}">${esc(g.name)}</a></h3>
        <p>${esc(blurb || (g.info ? g.info.flavor + '. ' : '') + 'Sold at ' + g.items.length + ' markets.')}</p>
        <div class="pcard__foot"><span class="price"><small>from</small> ${money(g.minPrice)}</span><span class="rating"><i class="fa-solid fa-star" style="color:var(--star)"></i>${g.rating}</span></div>
      </div>
    </article>`;
  }
  const curMonth = () => new Date().getMonth() + 1;
  const inSeason = (g) => !!(g.info && g.info.peak.includes(curMonth()));

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-add]');
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    cart.add(JSON.parse(a.dataset.add));
  });

  /** Simple pager: returns HTML; wire with onPage(n). */
  function pager(el, page, pages, onPage) {
    if (pages <= 1) { el.innerHTML = ''; return; }
    let h = `<button data-p="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous page"><i class="fa-solid fa-chevron-left"></i></button>`;
    for (let i = 1; i <= pages; i++) h += `<button data-p="${i}" ${i === page ? 'aria-current="page"' : ''} aria-label="Page ${i}">${i}</button>`;
    h += `<button data-p="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Next page"><i class="fa-solid fa-chevron-right"></i></button>`;
    el.innerHTML = h;
    el.onclick = (e) => { const b = e.target.closest('[data-p]'); if (b && !b.disabled) onPage(+b.dataset.p); };
  }

  /** Lightbox for galleries */
  function lightbox(images) {
    let lb = $('#lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'overlay lightbox'; lb.id = 'lightbox';
      lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Image viewer');
      lb.innerHTML = `<button class="x-btn" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        <button class="lb-nav lb-prev" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button>
        <figure><img alt=""><figcaption></figcaption></figure>
        <button class="lb-nav lb-next" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>`;
      document.body.appendChild(lb);
    }
    let idx = 0;
    const show = (i) => { idx = (i + images.length) % images.length; $('img', lb).src = images[idx].src; $('img', lb).alt = images[idx].alt; $('figcaption', lb).textContent = `${images[idx].alt} — ${idx + 1} / ${images.length}`; };
    $('.lb-prev', lb).onclick = () => show(idx - 1);
    $('.lb-next', lb).onclick = () => show(idx + 1);
    lb.onkeydown = (e) => { if (e.key === 'ArrowLeft') show(idx - 1); if (e.key === 'ArrowRight') show(idx + 1); };
    return (i) => { show(i); openLayer(lb); };
  }

  /* ------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------ */
  document.documentElement.classList.remove('no-js');
  buildSearch();
  buildDrawer();
  initChrome();
  renderCart();
  syncSaveButtons();
  reveal();

  window.FF = { $, $$, esc, slugify, money, url, store, data, imgFor, marketStatus, distanceKm, locate, stars, fmtH, shortH,
    toast, perKg, openLayer, closeLayer, bookmarks, syncSaveButtons, cart, reveal, marketCard, productCard, guideCard, inSeason, curMonth, pager, lightbox };
})();
