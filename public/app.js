(() => {
  const $ = (sel) => document.querySelector(sel);
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  let info;
  let services = [];
  const state = { service: null, date: null, time: null, month: null };

  // ---------- helpers ----------

  async function api(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
    return data;
  }

  const money = (n) => info.currencySymbol + (Number.isInteger(n) ? n : n.toFixed(2));

  function formatTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const suffix = h < 12 ? 'am' : 'pm';
    const hour = ((h + 11) % 12) + 1;
    return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
  }

  function hoursLabel(hhmm) {
    return hhmm.replace(':', '.');
  }

  function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ');
  }

  function parseDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function prettyDate(iso) {
    const d = parseDate(iso);
    return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  }

  function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c != null));
    return node;
  }

  // ---------- page content ----------

  function renderInfo() {
    document.title = `${info.businessName} ${info.businessSubtitle} · Prices & Online Booking`;
    $('#brand-name').textContent = info.businessName;
    $('#brand-sub').textContent = info.businessSubtitle;
    $('#tagline').textContent = info.tagline;
    $('#about').textContent = info.about;
    $('#footer-name').textContent = `${info.businessName} ${info.businessSubtitle}`;
    $('#year').textContent = new Date().getFullYear();

    if (info.announcement?.show) {
      $('#announcement-title').textContent = info.announcement.title;
      $('#announcement-text').textContent = info.announcement.text;
      $('#announcement').hidden = false;
    }

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

    // Working days, starting from Monday; closed days are left off like the flyer.
    const todayDow = parseDate(info.today).getUTCDay();
    const rows = [1, 2, 3, 4, 5, 6, 0]
      .filter((d) => info.hours[d])
      .map((d) =>
        el('li', { className: d === todayDow ? 'today' : '' },
          el('span', { className: 'day', textContent: DAY_NAMES[d] }),
          el('span', {
            textContent: `${hoursLabel(info.hours[d].open)}–${hoursLabel(info.hours[d].close)}`,
          })),
      );
    $('#hours-list').replaceChildren(...rows);
  }

  function renderPrices() {
    const groups = new Map();
    for (const s of services) {
      if (!groups.has(s.category)) groups.set(s.category, []);
      groups.get(s.category).push(s);
    }
    const blocks = [...groups].map(([category, items]) =>
      el('div', {},
        el('h3', { className: 'category-label', textContent: category || 'Treatments' }),
        ...items.map((s) => {
          const amount = el('span', { className: 'price-amount', textContent: money(s.price) });
          if (s.price_note) amount.append(' ', el('small', { textContent: s.price_note }));
          return el('div', { className: 'price-row' },
            el('span', { className: 'price-name', textContent: s.name }),
            amount,
            s.description ? el('span', { className: 'price-desc', textContent: s.description }) : null,
            s.bookable ? el('span', { className: 'price-meta', textContent: formatDuration(s.duration) }) : null,
            s.bookable
              ? el('button', {
                className: 'price-book',
                type: 'button',
                textContent: 'Book',
                onclick: () => {
                  selectService(s.id);
                  $('#book').scrollIntoView();
                },
              })
              : null);
        })),
    );
    $('#price-list').replaceChildren(...blocks);

    const select = $('#service-select');
    select.replaceChildren(el('option', { value: '', textContent: 'Choose a treatment…' }));
    for (const [category, items] of groups) {
      const bookable = items.filter((s) => s.bookable);
      if (!bookable.length) continue;
      select.append(el('optgroup', { label: category },
        ...bookable.map((s) => el('option', {
          value: s.id,
          textContent: `${s.name} · ${money(s.price)}`,
        }))));
    }
  }

  // ---------- booking flow ----------

  function showStep(step) {
    document.querySelectorAll('[data-panel]').forEach((p) => {
      p.hidden = p.dataset.panel !== String(step);
    });
    document.querySelectorAll('.steps li').forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle('active', n === step);
      li.classList.toggle('done', step === 'done' || n < step);
    });
  }

  function serviceSummary() {
    return `${state.service.name} · ${money(state.service.price)} · ${formatDuration(state.service.duration)}`;
  }

  function selectService(id) {
    $('#service-select').value = id;
    state.service = services.find((s) => s.id === Number(id)) || null;
    goToDate();
  }

  function goToDate() {
    if (!state.service) {
      $('#service-select').focus();
      return;
    }
    $('#summary-2').textContent = serviceSummary();
    if (!state.month) state.month = info.today.slice(0, 7);
    showStep(2);
    renderCalendar();
  }

  async function renderCalendar() {
    const [y, m] = state.month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last = new Date(Date.UTC(y, m, 0));
    $('#cal-title').textContent = `${MONTHS[m - 1]} ${y}`;
    $('#cal-prev').disabled = state.month <= info.today.slice(0, 7);
    $('#cal-next').disabled = state.month >= info.lastDate.slice(0, 7);

    const grid = $('#cal-grid');
    const leading = (first.getUTCDay() + 6) % 7; // Monday first
    const cells = [];
    for (let i = 0; i < leading; i++) cells.push(el('span', { className: 'empty' }));
    const buttons = {};
    for (let d = 1; d <= last.getUTCDate(); d++) {
      const iso = isoDate(new Date(Date.UTC(y, m - 1, d)));
      const btn = el('button', { type: 'button', textContent: d, disabled: true });
      btn.setAttribute('aria-label', prettyDate(iso));
      btn.onclick = () => chooseDate(iso);
      buttons[iso] = btn;
      cells.push(btn);
    }
    grid.replaceChildren(...cells);

    const from = isoDate(first) < info.today ? info.today : isoDate(first);
    const to = isoDate(last) > info.lastDate ? info.lastDate : isoDate(last);
    if (from > to) return;
    const requested = state.month;
    try {
      const days = await api(
        `/api/availability/days?serviceId=${state.service.id}&from=${from}&to=${to}`,
      );
      if (requested !== state.month) return;
      for (const [iso, available] of Object.entries(days)) {
        if (available && buttons[iso]) {
          buttons[iso].disabled = false;
          buttons[iso].classList.add('available');
        }
      }
    } catch (err) {
      grid.after(el('p', { className: 'error', textContent: err.message }));
    }
  }

  function shiftMonth(delta) {
    const [y, m] = state.month.split('-').map(Number);
    state.month = isoDate(new Date(Date.UTC(y, m - 1 + delta, 1))).slice(0, 7);
    renderCalendar();
  }

  async function chooseDate(iso) {
    state.date = iso;
    $('#summary-3').textContent = `${state.service.name} · ${prettyDate(iso)}`;
    const slots = $('#slots');
    slots.replaceChildren(el('p', { className: 'muted', textContent: 'Finding free times…' }));
    showStep(3);
    try {
      const times = await api(`/api/availability?serviceId=${state.service.id}&date=${iso}`);
      slots.replaceChildren(
        ...(times.length
          ? times.map((t) =>
            el('button', { type: 'button', textContent: formatTime(t), onclick: () => chooseTime(t) }))
          : [el('p', { className: 'muted', textContent: 'No times left on this day. Please pick another date.' })]),
      );
    } catch (err) {
      slots.replaceChildren(el('p', { className: 'error', textContent: err.message }));
    }
  }

  function chooseTime(time) {
    state.time = time;
    $('#summary-4').textContent =
      `${state.service.name} · ${prettyDate(state.date)} at ${formatTime(time)}`;
    $('#form-error').hidden = true;
    showStep(4);
    $('#details-form [name=name]').focus();
  }

  async function submitBooking(event) {
    event.preventDefault();
    const form = event.target;
    const btn = $('#confirm-btn');
    btn.disabled = true;
    $('#form-error').hidden = true;
    try {
      const booking = await api('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: state.service.id,
          date: state.date,
          time: state.time,
          ...Object.fromEntries(new FormData(form)),
        }),
      });
      $('#confirmation').replaceChildren(
        `${booking.service} on ${prettyDate(booking.date)} at ${formatTime(booking.time)}. `,
        `See you then! Your reference is `,
        el('span', { className: 'ref', textContent: booking.ref }),
      );
      form.reset();
      showStep('done');
    } catch (err) {
      $('#form-error').textContent = err.message;
      $('#form-error').hidden = false;
      if (err.status === 409) setTimeout(() => chooseDate(state.date), 1800);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- wire up ----------

  $('#to-date').onclick = () => selectService($('#service-select').value);
  $('#service-select').onchange = (e) => {
    state.service = services.find((s) => s.id === Number(e.target.value)) || null;
  };
  $('#cal-prev').onclick = () => shiftMonth(-1);
  $('#cal-next').onclick = () => shiftMonth(1);
  $('#details-form').onsubmit = submitBooking;
  $('#book-another').onclick = () => {
    Object.assign(state, { service: null, date: null, time: null });
    $('#service-select').value = '';
    showStep(1);
  };
  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.onclick = () => {
      const step = Number(btn.dataset.back);
      if (step === 2) goToDate();
      else showStep(step);
    };
  });

  Promise.all([api('/api/info'), api('/api/services')])
    .then(([i, s]) => {
      info = i;
      services = s;
      renderInfo();
      renderPrices();
    })
    .catch(() => {
      $('#price-list').replaceChildren(
        el('p', { className: 'error', textContent: 'Sorry, the price list could not be loaded. Please refresh the page.' }),
      );
    });
})();
