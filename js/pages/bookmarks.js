/* Bookmarks — saved markets & produce stored in localStorage */
(function () {
  'use strict';
  const { $, data, bookmarks, marketCard, guideCard, reveal, syncSaveButtons, url, esc } = FF;
  const mGrid = $('#savedMarkets'), pGrid = $('#savedProduce');
  let markets = [], produce = [];

  Promise.all([data.markets(), data.produce()]).then(([ms, ps]) => { markets = ms; produce = ps; render(); });
  document.addEventListener('ff:bookmarks', () => markets.length && render());
  ['#sortMarkets', '#sortProduce'].forEach((s) => $(s).addEventListener('change', render));

  function sortList(list, how, lookup) {
    const by = { recent: (a, b) => b.savedAt - a.savedAt, oldest: (a, b) => a.savedAt - b.savedAt, az: (a, b) => lookup(a).name.localeCompare(lookup(b).name) };
    return list.slice().sort(by[how]);
  }
  function empty(kind) {
    return `<div class="empty"><i class="fa-regular fa-bookmark" aria-hidden="true"></i><h3>No saved ${kind} yet</h3><p>Tap the bookmark icon on any ${kind === 'markets' ? 'market' : 'produce guide'} to keep it here.</p><a class="btn btn--dark" href="${url(kind === 'markets' ? 'market.html' : 'produce.html')}">Browse ${kind} <i class="fa-solid fa-arrow-right"></i></a></div>`;
  }
  function render() {
    const b = bookmarks.all();
    const mFind = (x) => markets.find((m) => m.slug === x.slug) || { name: '' };
    const pFind = (x) => produce.find((p) => p.slug === x.slug) || { name: '' };
    const ms = sortList(b.markets.filter((x) => mFind(x).slug), $('#sortMarkets').value, mFind);
    const ps = sortList(b.produce.filter((x) => pFind(x).slug), $('#sortProduce').value, pFind);
    $('#mSavedCount').textContent = `${ms.length} saved`;
    $('#pSavedCount').textContent = `${ps.length} saved`;
    $('#totalSaved').textContent = ms.length + ps.length;
    mGrid.innerHTML = ms.length ? ms.map((x, i) => marketCard(mFind(x), i).replace('<span class="tag', '<span class="tag" data-x="saved"').replace(/Open now|Closed now/, 'Saved')).join('') : empty('markets');
    pGrid.innerHTML = ps.length ? ps.map((x, i) => guideCard(pFind(x), i)).join('') : empty('produce');
    mGrid.className = ms.length ? 'grid-3' : ''; pGrid.className = ps.length ? 'grid-4' : '';
    $('#clearAll').hidden = !(ms.length + ps.length);
    syncSaveButtons(); reveal();
  }
  $('#clearAll').addEventListener('click', () => {
    if (!confirm('Remove all bookmarks?')) return;
    FF.store.set('bookmarks', { markets: [], produce: [] }); syncSaveButtons(); render(); FF.toast('All bookmarks cleared', 'trash-can');
  });
})();
