// Shared by every page: loads the business details and fills in the page.
window.Della = (() => {
  const $ = (sel) => document.querySelector(sel);
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  async function api(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
    return data;
  }

  function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c != null));
    return node;
  }

  let info;
  const money = (n) => info.currencySymbol + (Number.isInteger(n) ? n : n.toFixed(2));

  function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ');
  }

  function parseDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function prettyDate(iso) {
    const d = parseDate(iso);
    return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  }

  function groupByCategory(services) {
    const groups = new Map();
    for (const s of services) {
      const key = s.category || 'Treatments';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    return groups;
  }

  function priceLabel(s) {
    const amount = el('span', { className: 'price-amount', textContent: money(s.price) });
    if (s.price_note) amount.append(' ', el('small', { textContent: s.price_note }));
    return amount;
  }

  // ---------- shared page parts ----------

  function fillCommon() {
    document.querySelectorAll('[data-info]').forEach((node) => {
      node.textContent = info[node.dataset.info] ?? '';
    });
    $('#footer-name').textContent = `${info.businessName} ${info.businessSubtitle}`;
    $('#year').textContent = new Date().getFullYear();

    if (info.announcement?.show) {
      $('#announcement-title').textContent = info.announcement.title;
      $('#announcement-text').textContent = info.announcement.text;
      $('#announcement').hidden = false;
    }

    // Working days, starting from Monday; closed days are left off like the flyer.
    const todayDow = parseDate(info.today).getUTCDay();
    const label = (hhmm) => hhmm.replace(':', '.');
    document.querySelectorAll('[data-hours]').forEach((list) => {
      list.replaceChildren(...[1, 2, 3, 4, 5, 6, 0]
        .filter((d) => info.hours[d])
        .map((d) =>
          el('li', { className: d === todayDow ? 'today' : '' },
            el('span', { className: 'day', textContent: DAY_NAMES[d] }),
            el('span', { textContent: `${label(info.hours[d].open)}–${label(info.hours[d].close)}` }))));
    });
  }

  function fillContact() {
    if (!$('#whatsapp-link')) return;
    $('#whatsapp-number').textContent = info.whatsapp;
    $('#whatsapp-link').href = `https://wa.me/${info.whatsappInternational}`;
    $('#facebook-name').textContent = info.facebookName;
    if (info.facebookUrl) $('#facebook-link').href = info.facebookUrl;
    else $('#facebook-link').removeAttribute('target');
    if (info.address) {
      $('#address').textContent = info.address;
      $('#address').hidden = false;
    }
    $('#policies').replaceChildren(...info.policies.map((p) => el('li', { textContent: p })));
  }

  async function fillPrices() {
    const list = $('#price-list');
    if (!list) return;
    try {
      const services = await api('/api/services');
      list.replaceChildren(...[...groupByCategory(services)].map(([category, items]) =>
        el('div', {},
          el('h2', { className: 'category-label', textContent: category }),
          ...items.map((s) =>
            el('div', { className: 'price-row' },
              el('span', { className: 'price-name', textContent: s.name }),
              priceLabel(s),
              s.description ? el('span', { className: 'price-desc', textContent: s.description }) : null,
              el('span', {
                className: 'price-meta',
                textContent: s.bookable ? formatDuration(s.duration) : 'Add-on',
              }),
              el('a', {
                className: 'price-book',
                href: `/book?add=${s.id}`,
                textContent: s.bookable ? 'Book' : 'Add',
              }))))));
    } catch {
      list.replaceChildren(el('p', { className: 'error', textContent: 'Sorry, the price list could not be loaded. Please refresh the page.' }));
    }
  }

  const ready = api('/api/info').then((i) => {
    info = i;
    fillCommon();
    fillContact();
    fillPrices();
    return info;
  });

  return { $, api, el, money, formatDuration, parseDate, prettyDate, groupByCategory, priceLabel, ready, MONTHS };
})();
