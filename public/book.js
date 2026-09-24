(() => {
  const { $, api, el, money, formatDuration, prettyDate, groupByCategory, priceLabel, MONTHS } = window.Della;

  let info;
  let services = [];
  const basket = new Map(); // serviceId -> qty
  const state = { date: null, time: null, month: null };

  const perNail = (s) => /\bper\b/i.test(s.price_note);

  function formatTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const suffix = h < 12 ? 'am' : 'pm';
    const hour = ((h + 11) % 12) + 1;
    return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
  }

  const isoDate = (date) => date.toISOString().slice(0, 10);

  // ---------- basket ----------

  function chosen() {
    return [...basket].map(([id, qty]) => ({ service: services.find((s) => s.id === id), qty }));
  }

  function totals() {
    const items = chosen();
    return {
      items,
      price: items.reduce((t, i) => t + i.service.price * i.qty, 0),
      duration: items.reduce((t, i) => t + i.service.duration * (perNail(i.service) ? i.qty : 1), 0),
      label: items.map((i) => (i.qty > 1 ? `${i.service.name} ×${i.qty}` : i.service.name)).join(' + '),
    };
  }

  const itemsQuery = () =>
    [...basket].map(([id, qty]) => (qty > 1 ? `${id}x${qty}` : String(id))).join(',');

  function basketSummary() {
    const t = totals();
    return `${t.label} · ${money(t.price)} · ${formatDuration(t.duration)}`;
  }

  function updateBasketBar() {
    const t = totals();
    $('#basket-summary').textContent = t.items.length
      ? `${t.items.length} chosen · ${money(t.price)} · about ${formatDuration(t.duration)}`
      : 'Nothing chosen yet';
    $('#picker-error').hidden = true;
  }

  function renderPicker() {
    const groups = [...groupByCategory(services)].map(([category, items]) =>
      el('fieldset', { className: 'pick-group' },
        el('legend', { className: 'category-label', textContent: category }),
        ...items.map(pickRow)));
    $('#picker').replaceChildren(...groups);
    updateBasketBar();
  }

  function pickRow(s) {
    const id = `pick-${s.id}`;
    const box = el('input', { type: 'checkbox', id, checked: basket.has(s.id) });
    const qty = perNail(s)
      ? el('select', { className: 'qty', 'aria-label': `How many for ${s.name}` },
        ...Array.from({ length: 10 }, (_, i) =>
          el('option', { value: i + 1, textContent: `${i + 1} nail${i ? 's' : ''}` })))
      : null;
    if (qty) {
      qty.value = basket.get(s.id) || 1;
      qty.hidden = !basket.has(s.id);
      qty.onchange = () => {
        basket.set(s.id, Number(qty.value));
        updateBasketBar();
      };
    }
    box.onchange = () => {
      if (box.checked) basket.set(s.id, qty ? Number(qty.value) : 1);
      else basket.delete(s.id);
      if (qty) qty.hidden = !box.checked;
      updateBasketBar();
    };
    return el('div', { className: 'pick-row' },
      box,
      el('label', { htmlFor: id },
        el('span', { className: 'price-name', textContent: s.name }),
        el('span', {
          className: 'price-meta',
          textContent: [s.bookable ? formatDuration(s.duration) : 'Add-on', s.description]
            .filter(Boolean).join(' · '),
        })),
      priceLabel(s),
      qty);
  }

  // ---------- steps ----------

  function showStep(step) {
    document.querySelectorAll('[data-panel]').forEach((p) => {
      p.hidden = p.dataset.panel !== String(step);
    });
    document.querySelectorAll('.steps li').forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle('active', n === step);
      li.classList.toggle('done', step === 'done' || n < step);
    });
    $('#book').scrollIntoView({ block: 'start' });
  }

  function goToDate() {
    const t = totals();
    const error = !t.items.length
      ? 'Please tick at least one treatment.'
      : !t.items.some((i) => i.service.bookable)
        ? 'Extras need to go with a main treatment. Please tick one as well.'
        : '';
    if (error) {
      $('#picker-error').textContent = error;
      $('#picker-error').hidden = false;
      return;
    }
    $('#summary-2').textContent = basketSummary();
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
    $('#cal-error').hidden = true;

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
    $('#cal-grid').replaceChildren(...cells);

    const from = isoDate(first) < info.today ? info.today : isoDate(first);
    const to = isoDate(last) > info.lastDate ? info.lastDate : isoDate(last);
    if (from > to) return;
    const requested = state.month;
    try {
      const days = await api(`/api/availability/days?items=${itemsQuery()}&from=${from}&to=${to}`);
      if (requested !== state.month) return;
      for (const [iso, available] of Object.entries(days)) {
        if (available && buttons[iso]) {
          buttons[iso].disabled = false;
          buttons[iso].classList.add('available');
        }
      }
    } catch (err) {
      $('#cal-error').textContent = err.message;
      $('#cal-error').hidden = false;
    }
  }

  function shiftMonth(delta) {
    const [y, m] = state.month.split('-').map(Number);
    state.month = isoDate(new Date(Date.UTC(y, m - 1 + delta, 1))).slice(0, 7);
    renderCalendar();
  }

  async function chooseDate(iso) {
    state.date = iso;
    $('#summary-3').textContent = `${prettyDate(iso)} · about ${formatDuration(totals().duration)}`;
    const slots = $('#slots');
    slots.replaceChildren(el('p', { className: 'muted', textContent: 'Finding free times…' }));
    showStep(3);
    try {
      const times = await api(`/api/availability?items=${itemsQuery()}&date=${iso}`);
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
    $('#summary-4').textContent = `${prettyDate(state.date)} at ${formatTime(time)} · ${basketSummary()}`;
    $('#form-error').hidden = true;
    showStep(4);
    $('#name').focus();
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
          items: [...basket].map(([serviceId, qty]) => ({ serviceId, qty })),
          date: state.date,
          time: state.time,
          ...Object.fromEntries(new FormData(form)),
        }),
      });
      $('#confirmation').replaceChildren(
        `${booking.service} on ${prettyDate(booking.date)} at ${formatTime(booking.time)} (${money(booking.price)}). `,
        'See you then! Your reference is ',
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

  $('#to-date').onclick = goToDate;
  $('#cal-prev').onclick = () => shiftMonth(-1);
  $('#cal-next').onclick = () => shiftMonth(1);
  $('#details-form').onsubmit = submitBooking;
  $('#book-another').onclick = () => {
    basket.clear();
    Object.assign(state, { date: null, time: null });
    renderPicker();
    showStep(1);
  };
  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.onclick = () => {
      const step = Number(btn.dataset.back);
      if (step === 2) goToDate();
      else showStep(step);
    };
  });

  Promise.all([window.Della.ready, api('/api/services')])
    .then(([i, s]) => {
      info = i;
      services = s;
      const preselect = Number(new URLSearchParams(location.search).get('add'));
      if (services.some((x) => x.id === preselect)) basket.set(preselect, 1);
      renderPicker();
    })
    .catch(() => {
      $('#picker').replaceChildren(
        el('p', { className: 'error', textContent: 'Sorry, treatments could not be loaded. Please refresh the page.' }),
      );
    });
})();
