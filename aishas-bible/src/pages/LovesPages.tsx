import { Area, Check, Line, Pick, Range } from '../components/fields';
import { PageHead, PrevNext } from '../components/PageHead';
import { PhotoSlot } from '../components/PhotoSlot';
import { FORMATS, GENRES, MN, PACK, RATINGS, STATUSES } from '../lib/constants';
import { daysInMonth, leadBlanks, monthLabel, plannerMonths, ym, ymd } from '../lib/dates';
import { useNav } from '../lib/nav';
import { BOOK_ROWS, bookKeys, pilatesCount, readingSummary, tripCountdown } from '../lib/planner';
import { num, str, useStore } from '../lib/store';

export function Reading() {
  const { data } = useStore();
  const r = readingSummary(data);
  const cols = 'minmax(160px,2fr) minmax(120px,1.4fr) 120px 100px 110px 110px';
  return (
    <div className="page">
      <PageHead eyebrow="Reading log & TBR" title="Books" />
      <div className="hero-pink row" style={{ padding: 22, gap: 28, flexWrap: 'wrap' }}>
        <div>
          <div className="label-caps" style={{ color: 'var(--ink)' }}>Finished</div>
          <div className="big-num" style={{ fontSize: 48, color: 'var(--ink)' }}>{r.finished}</div>
        </div>
        <div className="stack" style={{ flex: 1, minWidth: 220, gap: 8 }}>
          <div
            role="progressbar"
            aria-valuenow={r.finished}
            aria-valuemax={r.goal}
            aria-label="Books finished towards yearly goal"
            style={{ height: 10, borderRadius: 999, background: 'var(--paper)', overflow: 'hidden' }}
          >
            <div style={{ height: '100%', background: 'var(--olive)', width: r.pct + '%' }} />
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink)' }}>Currently reading: {r.list}</div>
        </div>
        <label className="label-caps stack" style={{ color: 'var(--ink)', gap: 4 }}>
          Yearly goal
          <Line k="rd:goal" type="number" placeholder="24" className="in rose" style={{ width: 90, fontSize: 22, padding: '4px 2px' }} />
        </label>
      </div>
      <div className="card tick-scroll" style={{ padding: '12px 18px' }}>
        <div className="grid thead" style={{ gridTemplateColumns: cols, gap: 10, minWidth: 820 }}>
          <div>Title</div><div>Author</div><div>Genre</div><div>Format</div><div>Status</div><div>Rating</div>
        </div>
        {Array.from({ length: BOOK_ROWS }, (_, i) => {
          const b = bookKeys(i);
          return (
            <div key={i} className="grid trow" style={{ gridTemplateColumns: cols, gap: 10, minWidth: 820 }}>
              <Line k={b.t} className="in bare" style={{ padding: '10px 2px' }} aria-label={`Book ${i + 1} title`} />
              <Line k={b.a} className="in bare" style={{ fontSize: 14, padding: '10px 2px' }} aria-label={`Book ${i + 1} author`} />
              <Pick k={b.g} options={GENRES} className="in bare" style={{ fontSize: 14 }} aria-label="Genre" />
              <Pick k={b.f} options={FORMATS} className="in bare" style={{ fontSize: 14 }} aria-label="Format" />
              <Pick k={b.s} options={STATUSES} className="in bare" style={{ fontSize: 14 }} aria-label="Status" />
              <Pick k={b.r} options={RATINGS} className="in bare" style={{ fontSize: 14, color: 'var(--rose)' }} aria-label="Rating" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Crochet() {
  const { data } = useStore();
  return (
    <div className="page">
      <PageHead eyebrow="Crochet projects" title="On the hook" />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
        {Array.from({ length: 6 }, (_, i) => {
          const p = 'cr' + i + ':';
          return (
            <div key={i} className="card r16 stack" style={{ padding: 14, gap: 8 }}>
              <PhotoSlot id={'crochet-' + i} radius={10} placeholder="Project photo" />
              <Line k={p + 'n'} placeholder="Project name" className="in serif" style={{ fontSize: 22, padding: '6px 2px' }} aria-label="Project name" />
              <Line k={p + 'p'} placeholder="Pattern link" className="in hair" style={{ fontSize: 14, padding: '7px 2px' }} aria-label="Pattern link" />
              <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <Line k={p + 'y'} placeholder="Yarn" className="in hair" style={{ fontSize: 14, padding: '7px 2px' }} aria-label="Yarn" />
                <Line k={p + 'h'} placeholder="Hook (mm)" className="in hair" style={{ fontSize: 14, padding: '7px 2px' }} aria-label="Hook size in mm" />
              </div>
              <div className="row" style={{ gap: 10, paddingTop: 4 }}>
                <Range k={p + 'pr'} style={{ flex: 1, accentColor: 'var(--olive)' }} aria-label="Progress" />
                <div style={{ width: 44, textAlign: 'right', fontSize: 14, color: 'var(--olive)', fontVariantNumeric: 'tabular-nums' }}>{num(data[p + 'pr'])}%</div>
              </div>
              <Area
                k={p + 'no'}
                rows={2}
                placeholder="Notes, row count…"
                style={{ border: 'none', background: '#F7F4EC', borderRadius: 8, resize: 'vertical', fontSize: 13, padding: 8, outline: 'none' }}
                aria-label="Notes"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Create() {
  return (
    <div className="page">
      <PageHead eyebrow="Creative ideas" title="Things I want to make" />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flat-tint stack" style={{ padding: 16, gap: 6, minHeight: 180 }}>
            <Line k={`id${i}:t`} placeholder="Idea" className="in roseline serif" style={{ fontSize: 22, padding: '4px 2px' }} aria-label={`Idea ${i + 1}`} />
            <Area
              k={`id${i}:b`}
              placeholder="Materials, inspiration, steps…"
              style={{ flex: 1, border: 'none', background: 'transparent', resize: 'none', fontSize: 14, lineHeight: 1.5, outline: 'none' }}
              aria-label={`Idea ${i + 1} notes`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Pilates() {
  const { data, toggle } = useStore();
  const { D, setDay } = useNav();
  const y = D.getFullYear();
  const m = D.getMonth();
  const bars = plannerMonths().map((f) => ({ f, count: pilatesCount(data, f.getFullYear(), f.getMonth()) }));
  const total = bars.reduce((a, b) => a + b.count, 0);

  return (
    <div className="page">
      <PageHead eyebrow="Reformer Pilates" title={monthLabel(D)}>
        <PrevNext onPrev={() => setDay(new Date(y, m - 1, 1))} onNext={() => setDay(new Date(y, m + 1, 1))} />
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20, alignItems: 'start' }}>
        <div className="card r16" style={{ padding: 20 }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(7,1fr)', gap: 6, textAlign: 'center' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} style={{ fontSize: 12, color: 'var(--muted-2)' }}>{d}</div>)}
            {Array.from({ length: leadBlanks(y, m) }, (_, i) => <div key={'b' + i} />)}
            {Array.from({ length: daysInMonth(y, m) }, (_, i) => {
              const k = 'pl:' + ymd(new Date(y, m, i + 1));
              const on = !!data[k];
              return (
                <button
                  key={k}
                  onClick={() => toggle(k)}
                  aria-pressed={on}
                  aria-label={`${i + 1} ${MN[m]}`}
                  style={{
                    aspectRatio: '1', borderRadius: '50%', cursor: 'pointer', font: 'inherit', fontSize: 14, padding: 0,
                    border: `1px solid ${on ? 'var(--olive)' : 'var(--card-border)'}`,
                    background: on ? 'var(--olive)' : 'var(--paper)', color: on ? 'var(--paper)' : 'var(--text)',
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 12 }}>Tap each day you went to class.</div>
        </div>
        <div className="stack" style={{ gap: 20 }}>
          <div className="row" style={{ background: 'var(--olive)', color: 'var(--paper)', borderRadius: 16, padding: 22, gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div className="label-caps" style={{ color: 'var(--pink)' }}>Classes this month</div>
              <div className="big-num" style={{ fontSize: 64 }}>{pilatesCount(data, y, m)}</div>
            </div>
            <label className="label-caps stack" style={{ color: 'var(--pink)', gap: 4 }}>
              Monthly goal
              <Line k={'pl:goal:' + ym(D)} type="number" placeholder="12" className="in sage" style={{ width: 90, color: 'var(--paper)', fontSize: 24, padding: '4px 2px' }} />
            </label>
          </div>
          <div className="card r16" style={{ padding: 20 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 className="ctitle" style={{ margin: 0 }}>Classes per month</h2>
              <div style={{ fontSize: 14, color: 'var(--olive)' }}>{total} total</div>
            </div>
            <div className="row" style={{ gap: 4, alignItems: 'flex-end', height: 120, marginTop: 14 }}>
              {bars.map(({ f, count }) => {
                const current = f.getMonth() === m && f.getFullYear() === y;
                return (
                  <div key={ym(f)} className="stack" style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink)' }}>{count}</div>
                    <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: current ? 'var(--rose)' : 'var(--sage)', height: Math.max(4, Math.min(100, (count / 20) * 100)) + '%' }} />
                    <div style={{ fontSize: 10, color: 'var(--muted-2)' }}>{MN[f.getMonth()].slice(0, 3)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Travel() {
  const { data } = useStore();
  const { trip, setTrip, today } = useNav();
  const tp = 'tr' + trip + ':';
  const field = (label: string, k: string, placeholder?: string, type: 'text' | 'date' = 'text') => (
    <label style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted-2)' }}>
      {label}
      <Line k={tp + k} type={type} placeholder={placeholder} className="in full" style={{ textTransform: 'none', letterSpacing: 0, padding: '6px 2px' }} />
    </label>
  );
  const place = (label: string, k: string, placeholder: string) => (
    <label style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted-2)', minWidth: 0 }}>
      {label}
      <Line k={tp + k} placeholder={placeholder} className="in serif full" style={{ fontSize: 34, padding: 2, textTransform: 'none', letterSpacing: 0 }} />
    </label>
  );
  const visited = Array.from({ length: 30 }, (_, i) => str(data['cv' + i]).trim()).filter(Boolean).length;

  return (
    <div className="page" style={{ gap: 22 }}>
      <PageHead eyebrow="Travel" title="Cleared for take-off" />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }} role="tablist" aria-label="Trips">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            role="tab"
            aria-selected={trip === i}
            onClick={() => setTrip(i)}
            style={{
              padding: '9px 18px', borderRadius: 999, border: '1px solid var(--olive)', cursor: 'pointer', font: 'inherit', fontSize: 15,
              background: trip === i ? 'var(--olive)' : 'var(--paper)', color: trip === i ? 'var(--paper)' : 'var(--ink)',
            }}
          >
            {str(data['tr' + i + ':to']) || 'Trip ' + (i + 1)}
          </button>
        ))}
      </div>

      <div className="boarding">
        <div className="stack" style={{ padding: '22px 26px', gap: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--olive)' }}>Boarding pass</div>
            <div style={{ fontSize: 14, color: 'var(--rose)', fontWeight: 500 }}>{tripCountdown(str(data[tp + 'dep']), today)}</div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'end' }}>
            {place('From', 'from', 'London')}
            <div style={{ fontSize: 24, color: 'var(--olive)', paddingBottom: 10 }}>→</div>
            {place('To', 'to', 'Lisbon')}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14 }}>
            {field('Depart', 'dep', undefined, 'date')}
            {field('Return', 'ret', undefined, 'date')}
            {field('Flight', 'fl', 'XX 123')}
            {field('Stay', 'stay', 'Hotel / Airbnb')}
          </div>
        </div>
        <div className="boarding-stub">
          <label htmlFor={tp + 'notes'} style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink)' }}>Notes</label>
          <Area k={tp + 'notes'} placeholder="Confirmation codes, transfers…" style={{ flex: 1, minHeight: 90, border: 'none', background: 'transparent', resize: 'none', fontSize: 14, lineHeight: 1.5, outline: 'none' }} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <h2 className="ctitle" style={{ margin: 0 }}>Itinerary</h2>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="row" style={{ gap: 12, borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ width: 50, fontSize: 13, color: 'var(--olive)' }}>Day {i + 1}</div>
              <Line k={tp + 'it' + i} className="in bare grow" style={{ fontSize: 14, padding: '9px 2px' }} aria-label={`Day ${i + 1}`} />
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="ctitle" style={{ margin: 0 }}>Packing list</h2>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', columnGap: 14 }}>
            {PACK.map((def, j) => (
              <div key={j} className="row" style={{ gap: 8 }}>
                <Check k={tp + 'pk' + j} size={17} />
                <Line k={tp + 'pl' + j} def={def} className="in hair grow" style={{ fontSize: 13, padding: '7px 2px' }} aria-label="Packing item" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <h2 className="ctitle" style={{ margin: 0 }}>Bucket list</h2>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="check-row">
              <Check k={`bl${i}:c`} size={17} rose />
              <Line k={`bl${i}:t`} className="in hair grow" style={{ fontSize: 14 }} aria-label={`Bucket list ${i + 1}`} />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 className="ctitle" style={{ margin: 0 }}>Countries I’ve been to</h2>
            <div className="big-num" style={{ fontSize: 34, color: 'var(--olive)' }}>{visited}</div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', columnGap: 12 }}>
            {Array.from({ length: 30 }, (_, i) => (
              <Line key={i} k={'cv' + i} className="in hair" style={{ fontSize: 13, padding: '7px 2px' }} aria-label={`Country ${i + 1}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
