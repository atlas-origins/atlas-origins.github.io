/* Muse Hub specialist discovery and setup. */
(() => {
  'use strict';
  const search = document.getElementById('role-search');
  const category = document.getElementById('role-category');
  const count = document.getElementById('role-count');
  const reset = document.getElementById('role-reset');
  const empty = document.getElementById('role-empty');
  const emptyClear = document.getElementById('role-empty-clear');
  const cards = [...document.querySelectorAll('.role-card[data-role]')];
  if (!search || !category || !count || !reset || !empty || !emptyClear || cards.length !== 15) return;

  function update() {
    const needle = search.value.trim().toLocaleLowerCase();
    const group = category.value;
    let visible = 0;
    for (const card of cards) {
      const hasTerm = !needle || card.dataset.search.toLocaleLowerCase().includes(needle);
      const hasGroup = group === 'all' || card.dataset.category === group;
      const show = hasTerm && hasGroup;
      card.hidden = !show;
      if (show) visible += 1;
    }
    count.textContent = `Showing ${visible} of ${cards.length} specialists`;
    empty.hidden = visible !== 0;
  }
  function clear() {
    search.value = '';
    category.value = 'all';
    update();
    search.focus();
  }
  search.addEventListener('input', update);
  category.addEventListener('change', update);
  reset.addEventListener('click', clear);
  emptyClear.addEventListener('click', clear);
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const active = document.activeElement;
      const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
      if (!typing) { event.preventDefault(); search.focus(); }
    }
    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = '';
      update();
    }
  });
  // Use only the role and asset identifiers present in the reviewed cards.
  const setupSelect = document.getElementById('setup-role-select');
  const setupResult = document.getElementById('setup-role-result');
  const setupEmpty = document.getElementById('setup-role-empty');
  const setupTitle = document.getElementById('setup-role-title');
  const setupDescription = document.getElementById('setup-role-description');
  const setupInstall = document.getElementById('setup-role-install');
  const setupProfile = document.getElementById('setup-role-profile');
  const setupDownload = document.getElementById('setup-role-download');
  const roleAssets = new Map(cards.map(card => [card.dataset.role, card.dataset.asset]));
  const knownRoles = new Set(cards.map(card => card.dataset.role));
  const sourceBase = 'https://github.com/atlas-origins/muse-ai-agent-presets/blob/main/presets/';
  const setupReady = setupSelect && setupResult && setupEmpty && setupTitle &&
    setupDescription && setupInstall && setupProfile && setupDownload && knownRoles.size === 15;

  function selectSetupRole() {
    if (!setupReady) return;
    const slug = setupSelect.value;
    if (!knownRoles.has(slug) || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)) {
      setupResult.hidden = true;
      setupEmpty.hidden = false;
      return;
    }
    const asset = roleAssets.get(slug);
    if (!asset || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(asset)) return;
    const option = setupSelect.selectedOptions[0];
    setupTitle.textContent = option.textContent;
    setupDescription.textContent = option.dataset.description || '';
    setupInstall.href = `${sourceBase}${slug}/INSTALL.md`;
    setupProfile.href = `${sourceBase}${slug}/README.md`;
    setupDownload.href = `https://github.com/atlas-origins/muse-ai-agent-presets/releases/download/v1.5.0/muse-${asset}-v1.5.0.zip`;
    setupEmpty.hidden = true;
    setupResult.hidden = false;
  }
  if (setupReady) {
    // Only reviewed role identifiers may affect onboarding state.
    const incomingRole = new URL(window.location.href).searchParams.get('role');
    if (incomingRole && knownRoles.has(incomingRole)) {
      setupSelect.value = incomingRole;
    }
    function syncRoleURL(slug) {
      const url = new URL(window.location.href);
      if (slug && knownRoles.has(slug)) {
        url.searchParams.set('role', slug);
        url.hash = '#setup';
      } else {
        url.searchParams.delete('role');
      }
      try {
        // file:// previews can disallow history updates.
        history.replaceState(null, '', url);
      } catch (_) {
        // Local selection still works when history is unavailable.
      }
    }
    setupSelect.addEventListener('change', () => {
      selectSetupRole();
      syncRoleURL(setupSelect.value);
    });
    for (const link of document.querySelectorAll('[data-select-role]')) {
      link.addEventListener('click', event => {
        const slug = link.dataset.selectRole;
        if (!knownRoles.has(slug)) return;
        event.preventDefault();
        setupSelect.value = slug;
        selectSetupRole();
        syncRoleURL(slug);
        const reduceMotion = window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // Keyboard and reduced-motion navigation should not animate across
        // the long specialist catalog. The document's CSS otherwise uses
        // smooth scrolling for ordinary anchor navigation.
        const immediate = reduceMotion || event.detail === 0;
        const rootStyle = document.documentElement.style;
        const originalBehavior = rootStyle.scrollBehavior;
        if (immediate) rootStyle.scrollBehavior = 'auto';
        try {
          setupTitle.scrollIntoView({behavior: immediate ? 'auto' : 'smooth', block: 'center'});
        } finally {
          if (immediate) rootStyle.scrollBehavior = originalBehavior;
        }
        setupTitle.focus({ preventScroll: true });
      });
    }
    selectSetupRole();
  }
  update();
})();
