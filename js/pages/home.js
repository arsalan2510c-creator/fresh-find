/* Home — sliders, featured markets quick-view, produce thumbnails */
(function () {
  'use strict';
  const { $, $$, data, openLayer, url, esc, marketStatus, money } = FF;

  /* Generic dot slider (auto-play, pauses on hover/focus, keyboard friendly) */
  $$('[data-slider]').forEach((root) => {
    const slides = $$('.slide', root);
    const dotWrap = root.querySelector('.dots') || root.parentElement.querySelector('.dots');
    let i = 0, timer;
    dotWrap.innerHTML = slides.map((_, k) => `<button role="tab" aria-selected="${k === 0}" aria-label="Show slide ${k + 1}"></button>`).join('');
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => { s.classList.toggle('active', k === i); s.setAttribute('aria-hidden', k !== i); });
      $$('button', dotWrap).forEach((d, k) => d.setAttribute('aria-selected', k === i));
      const img = root.dataset.imgTarget && $(root.dataset.imgTarget);
      if (img && slides[i].dataset.img) { img.style.opacity = 0; setTimeout(() => { img.src = slides[i].dataset.img; img.alt = slides[i].dataset.alt || ''; img.style.opacity = 1; }, 200); }
    };
    const play = () => { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => go(i + 1), 6000); };
    const stop = () => clearInterval(timer);
    dotWrap.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { stop(); go($$('button', dotWrap).indexOf(b)); play(); } });
    dotWrap.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { go(i + 1); $$('button', dotWrap)[i].focus(); } if (e.key === 'ArrowLeft') { go(i - 1); $$('button', dotWrap)[i].focus(); } });
    [root, dotWrap].forEach((el) => { el.addEventListener('mouseenter', stop); el.addEventListener('mouseleave', play); el.addEventListener('focusin', stop); });
    go(0); play();
  });
  $$('[data-img-swap]').forEach((img) => { img.style.transition = 'opacity .25s'; });

  /* Featured markets: the four brand tiles link to the top-rated markets from the JSON */
  data.markets().then((ms) => {
    const top = ms.slice().sort((a, b) => b.rating - a.rating || b.reviews - a.reviews).slice(0, 4);
    $$('.brand-card').forEach((card, k) => {
      const m = top[k]; if (!m) return;
      $$('a', card).forEach((a) => { a.href = url('markets/' + m.slug + '.html'); });
      $('.market-name', card).textContent = m.name;
      $('.eye', card).addEventListener('click', () => quickView(m));
    });
  });
  function quickView(m) {
    const s = marketStatus(m), md = $('#quickView');
    $('#qvBody').innerHTML = `
      <img src="${url(m.image)}" alt="${esc(m.name)}" style="border-radius:14px;aspect-ratio:16/9;object-fit:cover;width:100%;margin-bottom:18px">
      <span class="pill-lime ${s.open ? '' : 'closed'}">${esc(s.label)}</span>
      <h2 id="qvTitle" style="margin-top:10px">${esc(m.name)}</h2>
      <p class="muted" style="font-size:.88rem;margin-bottom:14px">${esc(m.tagline)}</p>
      <div class="vrow"><span class="icon-bubble"><i class="fa-solid fa-location-dot"></i></span><div><small>Address</small><span>${esc(m.address)}</span></div></div>
      <div class="vrow"><span class="icon-bubble"><i class="fa-regular fa-clock"></i></span><div><small>Hours</small><span>${esc(s.hours)}</span></div></div>
      <div class="btn-row"><a class="btn btn--lime" href="${url('markets/' + m.slug + '.html')}">View Market <i class="fa-solid fa-arrow-right"></i></a><button class="btn btn--outline" data-save="markets:${m.slug}" data-name="${esc(m.name)}" aria-pressed="false"><i class="fa-regular fa-bookmark"></i> <span class="lbl">Save</span></button></div>`;
    FF.syncSaveButtons(); openLayer(md);
  }

  /* Produce thumbnails → open the matching produce guide (with live price) */
  data.produce().then((ps) => {
    $$('[data-produce]').forEach((b) => {
      const g = ps.find((p) => p.slug === b.dataset.produce);
      if (g) { b.querySelector('span').textContent = `${g.name} · from ${money(g.minPrice)}`; b.setAttribute('aria-label', `${g.name}, from ${money(g.minPrice)} — open guide`); }
    });
  });
  $$('[data-produce]').forEach((b) => b.addEventListener('click', () => { location.href = url('product.html?item=' + b.dataset.produce); }));
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => { location.href = url(b.dataset.goto); }));
})();
