(() => {
  const $ = (sel) => document.querySelector(sel);
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let currency = '£';
  let bookings = [];

  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !url.endsWith('/login')) {
      showLogin();
      throw new Error('Please log in.');
    }
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body ?? {}) });

  function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c != null));
    return node;
  }

  function prettyDate(iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  }

  function showError(node, message) {
    node.textContent = message;
    node.hidden = !message;
  }

  // ---------- login ----------

  function showLogin() {
    document.querySelectorAll('[data-view]').forEach((v) => { v.hidden = true; });
    $('#tabs').hidden = true;
    $('#logout').hidden = true;
    $('#login').hidden = false;
    $('#login [name=password]').focus();
  }

  $('#login').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await post('/api/admin/login', { password: e.target.password.value });
      e.target.reset();
      start();
    } catch (err) {
      showError($('#login-error'), err.message);
    }
  };

  $('#logout').onclick = async () => {
    await post('/api/admin/logout');
    showLogin();
  };

  // ---------- tabs ----------

  function showTab(name) {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== name; });
    ({ bookings: loadBookings, services: loadServices, hours: loadHours, timeoff: loadBlocks })[name]();
  }
  document.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });

  // ---------- bookings ----------

  async function loadBookings() {
    bookings = await api('/api/admin/bookings');
    renderBookings();
  }

  function renderBookings() {
    const showCancelled = $('#show-cancelled').checked;
    const list = bookings.filter((b) => showCancelled || b.status === 'confirmed');
    if (!list.length) {
      $('#bookings').replaceChildren(el('p', { className: 'muted', textContent: 'No upcoming bookings yet.' }));
      return;
    }
    const byDate = new Map();
    for (const b of list) {
      if (!byDate.has(b.date)) byDate.set(b.date, []);
      byDate.get(b.date).push(b);
    }
    $('#bookings').replaceChildren(...[...byDate].map(([date, items]) =>
      el('div', { className: 'day-group' },
        el('h3', { textContent: prettyDate(date) }),
        ...items.map(renderBooking))));
  }

  function renderBooking(b) {
    const cancelled = b.status === 'cancelled';
    const phoneDigits = b.phone.replace(/[^\d+]/g, '');
    const action = el('button', {
      type: 'button',
      className: `small-btn${cancelled ? '' : ' danger'}`,
      textContent: cancelled ? 'Restore' : 'Cancel',
      onclick: async () => {
        if (!cancelled && !confirm(`Cancel ${b.name}'s ${b.service_name} on ${prettyDate(b.date)} at ${b.time}?`)) return;
        try {
          await post(`/api/admin/bookings/${b.id}/${cancelled ? 'restore' : 'cancel'}`);
          loadBookings();
        } catch (err) {
          alert(err.message);
        }
      },
    });
    return el('div', { className: `booking${cancelled ? ' cancelled' : ''}` },
      el('span', { className: 'when', textContent: b.time }),
      el('div', {},
        el('div', { className: 'who', textContent: `${b.name} · ${b.service_name}` }),
        el('div', { className: 'detail' },
          el('a', { href: `tel:${phoneDigits}`, textContent: b.phone }),
          ' · ',
          el('a', {
            href: `https://wa.me/${phoneDigits.replace(/^0/, '44').replace(/^\+/, '')}`,
            target: '_blank',
            rel: 'noopener',
            textContent: 'WhatsApp',
          }),
          b.email ? ` · ${b.email}` : '',
          ` · ${currency}${b.price} · ${b.duration} min · Ref ${b.ref}`),
        b.notes ? el('div', { className: 'notes', textContent: `“${b.notes}”` }) : null),
      action);
  }

  $('#show-cancelled').onchange = renderBookings;

  // ---------- services ----------

  async function loadServices() {
    const services = await api('/api/admin/services');
    $('#services').replaceChildren(...services.map(serviceRow));
  }

  function input(name, value, props = {}) {
    return el('input', { name, value: value ?? '', ...props });
  }

  function serviceRow(s = {}) {
    const isNew = !s.id;
    const msg = el('p', { className: 'msg' });
    const fields = {
      category: input('category', s.category, { placeholder: 'e.g. Toes' }),
      name: input('name', s.name, { required: true }),
      price: input('price', s.price, { type: 'number', min: 0, step: '0.5', required: true }),
      price_note: input('price_note', s.price_note, { placeholder: 'e.g. extra' }),
      duration: input('duration', s.duration ?? 60, { type: 'number', min: 5, max: 480, step: 5, required: true }),
      description: input('description', s.description, { placeholder: 'Optional small print' }),
      bookable: el('input', { type: 'checkbox', checked: s.bookable ?? 1 }),
      active: el('input', { type: 'checkbox', checked: s.active ?? 1 }),
    };
    const field = (label, node, cls = '') =>
      el('label', { className: `field ${cls}` }, el('span', { textContent: label }), node);

    const save = el('button', { type: 'button', className: 'small-btn', textContent: 'Save' });
    save.onclick = async () => {
      const body = {
        category: fields.category.value,
        name: fields.name.value,
        price: Number(fields.price.value),
        price_note: fields.price_note.value,
        duration: Number(fields.duration.value),
        description: fields.description.value,
        bookable: fields.bookable.checked,
        active: fields.active.checked,
      };
      try {
        if (isNew) await post('/api/admin/services', body);
        else await api(`/api/admin/services/${s.id}`, { method: 'PUT', body: JSON.stringify(body) });
        msg.className = 'msg ok';
        msg.textContent = 'Saved ✓';
        if (isNew) loadServices();
      } catch (err) {
        msg.className = 'msg error';
        msg.textContent = err.message;
      }
    };

    const remove = el('button', { type: 'button', className: 'small-btn danger', textContent: 'Delete' });
    remove.onclick = async () => {
      if (isNew) return row.remove();
      if (!confirm(`Delete "${s.name}" from the price list?`)) return;
      await api(`/api/admin/services/${s.id}`, { method: 'DELETE' });
      loadServices();
    };

    const row = el('div', { className: 'service-row' },
      field('Section', fields.category),
      field('Treatment', fields.name),
      field(`Price (${currency})`, fields.price),
      field('Minutes', fields.duration),
      field('Price note', fields.price_note),
      field('Small print', fields.description, 'desc'),
      el('div', { className: 'flags' },
        el('label', { className: 'check' }, fields.bookable, 'Online booking'),
        el('label', { className: 'check' }, fields.active, 'Show')),
      el('div', { className: 'actions' }, save, remove),
      msg);
    return row;
  }

  $('#add-service').onclick = () => {
    const row = serviceRow();
    $('#services').append(row);
    row.querySelector('[name=name]').focus();
  };

  // ---------- hours ----------

  async function loadHours() {
    const info = await api('/api/info');
    const rows = [1, 2, 3, 4, 5, 6, 0].map((d) => {
      const h = info.hours[d];
      const open = el('input', { type: 'time', name: `open-${d}`, value: h?.open ?? '09:00', disabled: !h });
      const close = el('input', { type: 'time', name: `close-${d}`, value: h?.close ?? '17:00', disabled: !h });
      const on = el('input', { type: 'checkbox', name: `on-${d}`, checked: !!h });
      on.onchange = () => { open.disabled = close.disabled = !on.checked; };
      return el('div', { className: 'hours-row' },
        el('span', { className: 'day', textContent: DAY_NAMES[d] }),
        el('label', { className: 'check' }, on, 'Open'),
        open, close);
    });
    $('#hours-rows').replaceChildren(...rows);
  }

  $('#hours-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const hours = {};
    for (let d = 0; d < 7; d++) {
      hours[d] = f[`on-${d}`].checked ? { open: f[`open-${d}`].value, close: f[`close-${d}`].value } : null;
    }
    showError($('#hours-error'), '');
    $('#hours-ok').hidden = true;
    try {
      await api('/api/admin/hours', { method: 'PUT', body: JSON.stringify(hours) });
      $('#hours-ok').hidden = false;
    } catch (err) {
      showError($('#hours-error'), err.message);
    }
  };

  // ---------- time off ----------

  async function loadBlocks() {
    const blocks = await api('/api/admin/blocks');
    $('#blocks').replaceChildren(...(blocks.length
      ? blocks.map((b) => el('li', {},
        el('span', {
          textContent: `${prettyDate(b.date)} · ${b.start ? `${b.start}–${b.end}` : 'All day'}${b.reason ? ` · ${b.reason}` : ''}`,
        }),
        el('button', {
          type: 'button',
          className: 'small-btn danger',
          textContent: 'Remove',
          onclick: async () => {
            await api(`/api/admin/blocks/${b.id}`, { method: 'DELETE' });
            loadBlocks();
          },
        })))
      : [el('li', { className: 'muted', textContent: 'No time off booked.' })]));
  }

  $('#block-form').onsubmit = async (e) => {
    e.preventDefault();
    showError($('#block-error'), '');
    try {
      await post('/api/admin/blocks', Object.fromEntries(new FormData(e.target)));
      e.target.reset();
      loadBlocks();
    } catch (err) {
      showError($('#block-error'), err.message);
    }
  };

  // ---------- start ----------

  async function start() {
    try {
      await api('/api/admin/me');
    } catch {
      return;
    }
    const info = await api('/api/info');
    currency = info.currencySymbol;
    $('#login').hidden = true;
    $('#tabs').hidden = false;
    $('#logout').hidden = false;
    showTab('bookings');
  }

  start();
})();
