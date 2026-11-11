// Tiny progressive enhancement. The site works without it.
(() => {
  const header = document.querySelector('[data-header]');
  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.hidden = open;
      document.documentElement.style.overflow = open ? '' : 'hidden';
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !menu.hidden) { toggle.click(); toggle.focus(); }
    });
  }

  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Quote forms: validate, then either post to the business's form endpoint
  // (business.form_action) or, in a prototype, go to the thank-you page.
  document.querySelectorAll('[data-quote-form]').forEach((form) => {
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', (ev) => {
      let firstBad = null;
      form.querySelectorAll('[required]').forEach((el) => {
        const bad = !el.value.trim() || (el.type === 'tel' && el.value.replace(/\D/g, '').length < 7);
        el.setAttribute('aria-invalid', String(bad));
        if (bad && !firstBad) firstBad = el;
      });
      if (firstBad) { ev.preventDefault(); firstBad.focus(); return; }
      const name = form.querySelector('[name="name"]');
      try { if (name && name.value) sessionStorage.setItem('quoteName', name.value.trim().split(/\s+/)[0]); } catch (_) {}
      if (form.method.toLowerCase() === 'get') {
        ev.preventDefault();
        window.location.href = form.dataset.thanks;
      }
    });
  });

  const thanks = document.querySelector('[data-thanks-title]');
  if (thanks) {
    try {
      const n = sessionStorage.getItem('quoteName');
      if (n) thanks.textContent = `Thanks, ${n}. We have your request.`;
    } catch (_) {}
  }
})();
