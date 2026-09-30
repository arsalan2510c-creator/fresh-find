/* Produce detail — built from produce-info.json + every market JSON that sells the item */
(function () {
  'use strict';
  const { $, data, guideCard, money, url, esc, reveal, syncSaveButtons, stars, curMonth, inSeason, toast, perKg } = FF;
  const params = new URLSearchParams(location.search);
  const slug = params.get('item') || 'fresh-tomato';
  const here = params.get('market');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DV = { carbs: 275, fiber: 28, vitaminC: 90, potassium: 4700 }; // daily values (FDA)
  const BICON = { iron: 'droplet', eyes: 'eye', heart: 'heart-pulse', fiber: 'wheat-awn', sugar: 'scale-balanced', immunity: 'shield-heart', hydrate: 'glass-water', digest: 'leaf', light: 'feather', antiox: 'atom', skin: 'spa', energy: 'bolt', bones: 'bone' };

  Promise.all([data.produce(), data.markets()]).then(([all, markets]) => {
    const g = all.find((x) => x.slug === slug);
    if (!g) { notFound(); return; }
    const inf = g.info;
    const monthRange = (arr) => arr.length >= 12 ? 'Year-round' : MONTHS[arr[0] - 1] + '–' + MONTHS[arr[arr.length - 1] - 1];

    /* SEO: title, description, structured data */
    document.title = `${g.name} — Price, Nutrition & Where to Buy in Karachi | FreshFind`;
    const desc = `${g.name}: compare prices across ${g.items.length} Karachi markets from ${money(g.minPrice)}, plus nutrition, season and storage tips.`;
    document.querySelector('meta[name=description]').setAttribute('content', desc);
    const ld = document.createElement('script'); ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: g.name, category: g.category, image: new URL(url(g.image), location.href).href, description: desc,
      aggregateRating: { '@type': 'AggregateRating', ratingValue: g.rating, reviewCount: g.reviews },
      offers: { '@type': 'AggregateOffer', priceCurrency: 'PKR', lowPrice: g.minPrice, highPrice: g.maxPrice, offerCount: g.items.length } });
    document.head.appendChild(ld);

    /* Hero */
    $('#pCrumbCat').textContent = g.category;
    $('#pCrumbCat').href = url('produce.html?cat=' + encodeURIComponent(g.category));
    $('#pCrumbName').textContent = g.name;
    $('#pImg').src = url(g.image); $('#pImg').alt = g.name;
    $('#pLatin').textContent = inf ? inf.latin : g.category;
    $('#pName').textContent = g.name;
    $('#pStars').textContent = stars(g.rating);
    $('#pRating').textContent = `${g.rating} · ${g.reviews.toLocaleString()} reviews${inSeason(g) ? ' · In season now' : ''}`;
    $('#pDesc').textContent = g.description + (inf ? ` Expect a ${inf.flavor.toLowerCase()} flavour, best enjoyed ${inf.peak.length >= 12 ? 'all year' : 'from ' + monthRange(inf.peak)}.` : '');
    $('#pFacts').innerHTML = [
      ['Flavor', inf ? inf.flavor : '—'], ['Peak season', inf ? monthRange(inf.peak) : '—'], ['Best price', money(g.minPrice)]
    ].map(([k, v]) => `<div class="fact"><small>${k}</small><span>${esc(v)}</span></div>`).join('');
    const saveBtn = $('#pSave'); saveBtn.dataset.save = 'produce:' + slug; saveBtn.dataset.name = g.name;
    const saveIcon = $('#pSaveIcon'); saveIcon.dataset.save = 'produce:' + slug; saveIcon.dataset.name = g.name;

    /* Nutrition */
    if (inf) {
      const n = inf.nutrition;
      $('#kcal').textContent = n.kcal + ' kcal';
      const rows = [['Carbohydrates', n.carbs, 'g', 'carbs'], ['Fiber', n.fiber, 'g', 'fiber'], ['Vitamin C', n.vitaminC, 'mg', 'vitaminC'], ['Potassium', n.potassium, 'mg', 'potassium']];
      $('#nutriRows').innerHTML = rows.map(([l, v, u, k]) => { const pct = Math.min(100, Math.round(v / DV[k] * 100)); return `<tr><td>${l}<div class="bar"><span data-w="${pct}"></span></div></td><td>${v} ${u}</td><td>${pct}%</td></tr>`; }).join('');
      requestAnimationFrame(() => setTimeout(() => document.querySelectorAll('.bar span').forEach((s) => { s.style.width = s.dataset.w + '%'; }), 300));
      $('#benefitIntro').textContent = `${g.name} offers an easy, delicious way to add protective nutrients to everyday meals.`;
      $('#benefitGrid').innerHTML = inf.benefits.map((b) => `<div class="benefit"><span class="icon-bubble"><i class="fa-solid fa-${BICON[b.key] || 'leaf'}" aria-hidden="true"></i></span><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></div>`).join('');

      /* Season calendar */
      const m = curMonth();
      $('#seasonTitle').textContent = inf.peak.length >= 12 ? 'Delicious all year round' : `Best from ${new Date(2000, inf.peak[0] - 1).toLocaleString('en', { month: 'long' })} through ${new Date(2000, inf.peak[inf.peak.length - 1] - 1).toLocaleString('en', { month: 'long' })}`;
      $('#months').innerHTML = MONTHS.map((mm, i) => { const k = i + 1; const cls = inf.peak.includes(k) ? 'peak' : inf.shoulder.includes(k) ? 'shoulder' : ''; return `<li class="month ${cls} ${k === m ? 'now' : ''}" ${k === m ? 'aria-current="date"' : ''} title="${cls ? (cls === 'peak' ? 'Peak season' : 'Shoulder season') : 'Limited'}">${mm}</li>`; }).join('');
      $('#storage').innerHTML = inf.storage.map((s, i) => `<li><span class="n">0${i + 1}</span><div><b>${esc(s[0])}</b><p>${esc(s[1])}</p></div></li>`).join('');
    }

    /* Price comparison across markets */
    // Compare fairly: weight units by Rs/kg, others (bunch, dozen) by price
    const key = (p) => perKg(p) ?? p.price;
    const rows = g.items.slice().sort((a, b) => (perKg(a) === null) - (perKg(b) === null) || key(a) - key(b));
    const weighed = rows.filter((p) => perKg(p) !== null);
    $('#compareCount').textContent = `${rows.length} markets`;
    $('#compareBody').innerHTML = rows.map((p, i) => {
      const mk = markets.find((x) => x.slug === p.market);
      const item = { key: p.market + ':' + p.id, name: p.name, market: p.market, marketName: p.marketName, price: p.price, unit: p.unit, image: url(g.image) };
      return `<tr class="${i === 0 ? 'best' : ''} ${p.market === here ? 'here' : ''}">
        <td><a href="${url('markets/' + p.market + '.html')}">${esc(p.marketName)}</a>${i === 0 ? '<span class="best-badge">Best price</span>' : ''}<br><small class="muted">${esc(mk ? mk.area : '')}</small></td>
        <td><b>${money(p.price)}</b>${perKg(p) !== null ? ` <small class="muted">(${money(perKg(p))}/kg)</small>` : ''}${p.oldPrice ? ` <s class="muted">${money(p.oldPrice)}</s>` : ''}${p.discount ? ` <span class="best-badge" style="background:var(--dark);color:#fff">-${esc(p.discount)}</span>` : ''}</td>
        <td>${esc(p.unit)}</td>
        <td><span class="stock ${p.stock !== 'In Stock' ? 'low' : ''}">${esc(p.stock)}</span></td>
        <td>★ ${p.rating} <small class="muted">(${p.reviews})</small></td>
        <td><button class="btn btn--dark btn--sm" data-add='${esc(JSON.stringify(item))}'>Add <i class="fa-solid fa-plus"></i></button></td>
      </tr>`;
    }).join('');
    const save = weighed.length > 1 ? perKg(weighed[weighed.length - 1]) - perKg(weighed[0]) : 0;
    $('#compareNote').textContent = save > 0 ? `${weighed[0].marketName} is the best value at ${money(perKg(weighed[0]))}/kg — ${money(save)} per kg cheaper than the most expensive market.` : 'Prices compared across every market that stocks this item.';

    /* Similar produce */
    const sim = all.filter((x) => x.slug !== slug && x.category === g.category).sort((a, b) => inSeason(b) - inSeason(a) || b.rating - a.rating).slice(0, 4);
    $('#similarGrid').innerHTML = sim.map((s, i) => guideCard(s, i)).join('');
    $('#findBtn').addEventListener('click', () => $('#compare').scrollIntoView({ behavior: 'smooth' }));
    $('#shareBtn').addEventListener('click', () => {
      const d = { title: document.title, url: location.href };
      if (navigator.share) navigator.share(d).catch(() => {});
      else navigator.clipboard?.writeText(location.href).then(() => toast('Link copied to clipboard', 'link'));
    });
    syncSaveButtons(); reveal();
  });

  function notFound() {
    document.querySelector('main').innerHTML = `<section class="section nf"><div class="container"><b>404</b><h1 class="h-section">We couldn't find that produce</h1><p class="lead" style="margin:10px auto 24px">It may have been renamed. Browse the full guide instead.</p><a class="btn btn--dark" href="${url('produce.html')}">Open Produce Guide <i class="fa-solid fa-arrow-right"></i></a></div></section>`;
  }
})();
