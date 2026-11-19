/* Progressive enhancement: every download remains an ordinary link. */
(() => {
  'use strict';
  const search = document.getElementById('download-search');
  const kind = document.getElementById('download-kind');
  const role = document.getElementById('download-role');
  const category = document.getElementById('download-category');
  const count = document.getElementById('download-count');
  const empty = document.getElementById('download-empty');
  const reset = document.getElementById('download-reset');
  const clearEmpty = document.getElementById('download-clear-empty');
  const cards = [...document.querySelectorAll('.download-card')];
  const sections = [...document.querySelectorAll('.download-section')];
  if (!search || !kind || !role || !category || !count || !empty || !reset || !clearEmpty || !cards.length) return;
  const filters = { type: kind, role, subject: category };
  const allowed = Object.fromEntries(Object.entries(filters).map(([name, control]) =>
    [name, new Set([...control.options].map(option => option.value))]));
  function readUrl() {
    const params = new URLSearchParams(location.search.length <= 2048 ? location.search : '');
    for (const [name, control] of Object.entries(filters)) {
      const values = params.getAll(name);
      control.value = values.length === 1 && allowed[name].has(values[0]) ? values[0] : 'all';
    }
    const terms = params.getAll('q');
    search.value = terms.length === 1 && terms[0].length <= 200 ? terms[0] : '';
  }
  function update(writeUrl = false) {
    const term = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of cards) {
      const match = (kind.value === 'all' || kind.value === card.dataset.kind) &&
        (role.value === 'all' || card.dataset.roles.split(' ').includes(role.value)) &&
        (category.value === 'all' || category.value === card.dataset.category) &&
        (!term || card.dataset.search.toLocaleLowerCase().includes(term));
      card.hidden = !match;
      if (match) visible += 1;
    }
    for (const section of sections) {
      section.hidden = ![...section.querySelectorAll('.download-card')].some(card => !card.hidden);
    }
    count.textContent = `Showing ${visible} of ${cards.length} downloads`;
    empty.hidden = visible !== 0;
    if (writeUrl) {
      const url = new URL(location.href);
      if (url.search.length > 2048) url.search = '';
      for (const [name, control] of Object.entries(filters)) {
        url.searchParams.delete(name);
        if (control.value !== 'all') url.searchParams.set(name, control.value);
      }
      url.searchParams.delete('q');
      if (search.value.trim()) url.searchParams.set('q', search.value.trim().slice(0, 200));
      if (url.href !== location.href) history.replaceState(null, '', url.href);
    }
  }
  function clear() {
    search.value = '';
    kind.value = 'all';
    role.value = 'all';
    category.value = 'all';
    update(true);
    search.focus();
  }
  search.maxLength = 200;
  search.addEventListener('input', () => update(true));
  for (const control of Object.values(filters)) control.addEventListener('change', () => update(true));
  window.addEventListener('popstate', () => { readUrl(); update(); });
  reset.addEventListener('click', clear);
  clearEmpty.addEventListener('click', clear);
  for (const link of document.querySelectorAll('.download-jumps a')) {
    link.addEventListener('click', () => {
      search.value = '';
      kind.value = 'all';
      role.value = 'all';
      category.value = 'all';
      update(true);
    });
  }
  readUrl();
  update();
})();
