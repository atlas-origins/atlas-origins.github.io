/* Search and explore the Muse Hub resource directory. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const raw = byId('catalog-data');
  const status = byId('count');
  if (!raw || !status) return;
  // Static project links remain useful when JavaScript is unavailable. Once
  // this renderer starts, catalog validation owns every displayed result.
  const staticResults = byId('results');
  if (staticResults) staticResults.replaceChildren();
  const fallbackNote = byId('directory-fallback-note');
  if (fallbackNote) fallbackNote.hidden = true;
  let data;
  try { data = JSON.parse(raw.textContent); }
  catch { status.textContent = 'This directory could not load. Try opening a fresh copy.'; return; }
  const expectedRoutes = new Set(['cli', 'desktop', 'watch', 'family', 'doors', 'companion']);
  const textField = value => typeof value === 'string' &&
    value.length > 0 && value.length <= 4096;
  const safeUrl = value => {
    if (typeof value !== 'string' || !value.startsWith('https://')) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname) &&
        !url.username && !url.password && !url.port;
    } catch { return false; }
  };
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  // Validate every nested member before reading its fields in the renderer.
  // This is a locally embedded source catalogue, not a provider response.
  const validateCatalog = catalog => {
    if (!isRecord(catalog) || catalog.schema !== 'muse-resource-directory/v2' ||
        catalog.count !== 63 ||
        !Array.isArray(catalog.items) || catalog.items.length !== 63 ||
        !Array.isArray(catalog.routes) || catalog.routes.length !== expectedRoutes.size) return false;

    const seenItems = new Set();
    for (const item of catalog.items) {
      if (!isRecord(item) || !textField(item.id) || !/^MH-\d{3}$/.test(item.id) ||
          seenItems.has(item.id) || !safeUrl(item.url) ||
          !['name', 'summary', 'category', 'platform', 'install_method',
            'license_class'].every(key => textField(item[key])) ||
          !Array.isArray(item.route_tags) ||
          item.route_tags.some(tag => typeof tag !== 'string' || !expectedRoutes.has(tag)) ||
          new Set(item.route_tags).size !== item.route_tags.length) return false;
      seenItems.add(item.id);
    }

    const seenRoutes = new Set();
    for (const route of catalog.routes) {
      if (!isRecord(route) || !textField(route.id) || !expectedRoutes.has(route.id) ||
          seenRoutes.has(route.id) ||
          !['title', 'description', 'notice'].every(key => textField(route[key])) ||
          !Array.isArray(route.source_ids) || !route.source_ids.length ||
          new Set(route.source_ids).size !== route.source_ids.length ||
          route.source_ids.some(id => typeof id !== 'string' || !seenItems.has(id)))
        return false;
      seenRoutes.add(route.id);
    }
    return seenRoutes.size === expectedRoutes.size;
  };
  if (!validateCatalog(data)) {
    status.textContent = 'Catalog verification failed. No sources are shown.';
    return;
  }

  const input = byId('search'), select = byId('category'), form = byId('filters');
  const results = byId('results'), empty = byId('empty'), chip = byId('active-chip');
  const notice = byId('route-notice'), buttons = Array.from(document.querySelectorAll('[data-route]'));
  const detail = byId('detail-panel'), detailBody = byId('detail-content');
  const detailClose = byId('detail-close'), backdrop = byId('detail-backdrop');
  const routes = new Map(data.routes.map(route => [route.id, route]));
  // A shared URL selects one reviewed route. Search and category remain local.
  // Reject ambiguous or oversized input before it can affect the directory.
  const routeFromLocation = () => {
    if (window.location.search.length > 2048) return null;
    const incoming = new URLSearchParams(window.location.search).getAll('route');
    return incoming.length === 1 && routes.has(incoming[0]) ? incoming[0] : null;
  };
  const queryState = { search: '', category: '', route: routeFromLocation() };
  const updateRouteUrl = () => {
    const url = new URL(window.location.href);
    // A new selection must produce a usable link even after oversized input.
    if (url.search.length > 2048) url.search = '';
    url.searchParams.delete('route');
    if (queryState.route) url.searchParams.set('route', queryState.route);
    const next = url.pathname + url.search + url.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.pushState(null, '', next);
    }
  };
  let selectedId = data.items[0].id;
  let returnFocus = null;
  let lastDetailFocus = null;
  let mobileLayout = window.matchMedia('(max-width: 960px)').matches;
  const inertBackground = new Map();

  const categories = [...new Set(data.items.map(x => x.category))].sort((a,b) => a.localeCompare(b));
  categories.forEach(name => {
    const option = document.createElement('option'); option.value = name; option.textContent = name;
    select.append(option);
  });
  const elt = (tag, klass, value) => {
    const node = document.createElement(tag);
    if (klass) node.className = klass;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const sourceLink = (item, classname, label) => {
    if (!safeUrl(item.url)) return null;
    const link = elt('a', classname);
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(elt('span', '', label), elt('span', '', '↗'));
    return link;
  };
  const makeMeta = (key, value, container) => {
    const row = elt('div');
    row.append(elt('dt', '', key), elt('dd', '', value));
    container.append(row);
  };
  const isMobileSheet = () => window.matchMedia('(max-width: 960px)').matches;
  const isolateDetail = () => {
    // Isolate siblings at each level, without making the dialog's ancestors
    // inert. Restore each element's previous state when the sheet closes.
    let branch = detail;
    while (branch && branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || sibling === backdrop ||
            ['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) continue;
        if (!inertBackground.has(sibling)) {
          inertBackground.set(sibling, sibling.inert);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
  };
  const restoreBackground = () => {
    for (const [element, previous] of inertBackground) element.inert = previous;
    inertBackground.clear();
  };
  const closeDetail = (restoreFocus = true) => {
    detail.classList.remove('is-open');
    detail.removeAttribute('role');
    detail.removeAttribute('aria-modal');
    backdrop.hidden = true;
    document.body.classList.remove('detail-visible');
    restoreBackground();
    if (restoreFocus && returnFocus && returnFocus.isConnected) returnFocus.focus();
    returnFocus = null;
  };
  const markSelection = () => {
    results.querySelectorAll('.resource-card').forEach(card => {
      const active = card.dataset.id === selectedId;
      card.classList.toggle('is-selected', active);
      const trigger = card.querySelector('[data-details]');
      if (trigger) trigger.setAttribute('aria-pressed', String(active));
    });
  };
  const showDetails = (item, trigger = null) => {
    selectedId = item.id;
    detailBody.replaceChildren();
    const category = elt('div', 'detail-category', item.category);
    const heading = elt('h3', '', item.name);
    heading.id = 'detail-heading';
    const summary = elt('p', 'detail-summary', item.summary);
    const metadata = elt('dl', 'detail-metadata');
    makeMeta('Platform', item.platform, metadata);
    makeMeta('Getting started', item.install_method, metadata);
    makeMeta('Rights', item.license_class.replaceAll('_', ' ').toLowerCase() + ' — see project license', metadata);
    detailBody.append(category, heading, summary, metadata);
    const link = sourceLink(item, 'detail-source', 'Open project');
    if (link) detailBody.append(link);
    markSelection();
    if (trigger && isMobileSheet()) {
      returnFocus = trigger;
      detail.classList.add('is-open');
      detail.setAttribute('role', 'dialog');
      detail.setAttribute('aria-modal', 'true');
      backdrop.hidden = false;
      document.body.classList.add('detail-visible');
      isolateDetail();
      // Chromium can ignore focus while the sheet is becoming visible.
      // Try after paint, with a short fallback for throttled animation frames.
      // Both paths refuse to steal focus after a close or another selection.
      const focusOpenDetail = () => {
        if (returnFocus !== trigger || !detail.classList.contains('is-open') ||
            !isMobileSheet()) return;
        if (document.activeElement !== detail && !detail.contains(document.activeElement)) {
          detail.focus({ preventScroll: true });
        }
      };
      requestAnimationFrame(() => { focusOpenDetail(); });
      window.setTimeout(focusOpenDetail, 120);
    }
  };
  const card = item => {
    const article = elt('article', 'resource-card');
    article.dataset.id = item.id;
    const top = elt('div', 'resource-card-top');
    top.append(elt('span', 'category-badge', item.category));
    article.append(top, elt('h3', '', item.name), elt('p', 'resource-summary', item.summary));
    const actions = elt('div', 'card-actions');
    const detailsButton = elt('button', 'details-button', 'Details');
    detailsButton.type = 'button'; detailsButton.dataset.details = item.id;
    detailsButton.setAttribute('aria-label', 'Show details for ' + item.name);
    detailsButton.setAttribute('aria-pressed', String(item.id === selectedId));
    detailsButton.addEventListener('click', () => showDetails(item, detailsButton));
    actions.append(detailsButton);
    const link = sourceLink(item, 'record-link', 'Open project');
    if (link) actions.append(link);
    article.append(actions);
    return article;
  };
  const matches = item => {
    const q = queryState.search.toLocaleLowerCase().trim();
    const haystack = [item.name, item.summary, item.category, item.platform, item.install_method,
      item.id].join(' ').toLocaleLowerCase();
    const route = queryState.route ? routes.get(queryState.route) : null;
    return (!q || haystack.includes(q)) && (!queryState.category || queryState.category === item.category) &&
      (!route || route.source_ids.includes(item.id));
  };
  const render = () => {
    closeDetail(false);
    const items = data.items.filter(matches);
    if (items.length && !items.some(item => item.id === selectedId)) selectedId = items[0].id;
    results.replaceChildren(...items.map(card));
    status.textContent = `Showing ${items.length} of ${data.count} sources`;
    empty.hidden = items.length !== 0;
    const route = queryState.route ? routes.get(queryState.route) : null;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.route === queryState.route)));
    chip.hidden = !route;
    chip.textContent = route ? route.title : '';
    notice.hidden = !route;
    if (route) notice.replaceChildren(elt('strong', '', 'About this route'), elt('span', '', route.notice));
    else notice.replaceChildren();
    if (items.length) showDetails(items.find(item => item.id === selectedId) || items[0]);
    else {
      const heading = elt('h3', '', 'No resource selected');
      heading.id = 'detail-heading';
      detailBody.replaceChildren(heading, elt('p', '', 'Try another search to see tools and guides.'));
    }
  };
  const clear = () => {
    queryState.search = ''; queryState.category = ''; queryState.route = null;
    input.value = ''; select.value = '';
    selectedId = data.items[0].id;
    updateRouteUrl();
    render();
  };
  buttons.forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.route;
    if (!routes.has(id)) return;
    queryState.route = queryState.route === id ? null : id;
    updateRouteUrl();
    render();
    byId('browse-results').scrollIntoView({block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }));
  input.addEventListener('input', () => { queryState.search = input.value; render(); });
  select.addEventListener('change', () => { queryState.category = select.value; render(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    queryState.search = input.value;
    queryState.category = select.value;
    render();
  });
  form.addEventListener('reset', event => { event.preventDefault(); clear(); });
  byId('clear-empty').addEventListener('click', () => { clear(); input.focus(); });
  window.addEventListener('popstate', () => {
    queryState.route = routeFromLocation();
    render();
  });
  detailClose.addEventListener('click', () => closeDetail());
  backdrop.addEventListener('click', () => closeDetail());
  document.addEventListener('focusin', event => {
    lastDetailFocus = detail.contains(event.target) ? event.target : null;
  });
  document.addEventListener('keydown', event => {
    const modalOpen = detail.classList.contains('is-open') && isMobileSheet();
    if (modalOpen && event.key === 'Escape') {
      event.preventDefault(); closeDetail(); return;
    }
    if (event.key === 'Tab' && modalOpen) {
      const focusable = Array.from(detail.querySelectorAll('button:not([disabled]), a[href]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (first && last) {
        if (!detail.contains(document.activeElement)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === detail)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        } else if (!event.shiftKey && document.activeElement === detail) {
          event.preventDefault(); first.focus();
        }
      }
      return;
    }
    // Directory shortcuts must never move focus behind an open modal sheet.
    if (modalOpen) {
      if (event.key === '/') event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && detail.classList.contains('is-open')) {
      event.preventDefault(); closeDetail(); return;
    }
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey &&
        !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
      event.preventDefault(); input.focus();
    }
  });
  window.addEventListener('resize', () => {
    const nextMobileLayout = isMobileSheet();
    if (nextMobileLayout === mobileLayout) return;
    const focusWasInside = detail.contains(document.activeElement) ||
      (document.activeElement === document.body && lastDetailFocus &&
       detail.contains(lastDetailFocus));
    closeDetail(false);
    if (focusWasInside) {
      if (nextMobileLayout) {
        const trigger = Array.from(results.querySelectorAll('[data-details]'))
          .find(button => button.dataset.details === selectedId);
        if (trigger) trigger.focus();
      } else if (document.activeElement === document.body ||
                 document.activeElement === detailClose) {
        detail.focus({ preventScroll: true });
      }
    }
    mobileLayout = nextMobileLayout;
  });
  render();
  document.body.classList.add('directory-ready');
  const exploreLink = document.querySelector('[data-enhanced-explore]');
  if (exploreLink) exploreLink.setAttribute('href', '#paths');
})();
