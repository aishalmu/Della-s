import { Area, Check, Line } from '../components/fields';
import { DayNav, PageHead, PrevNext } from '../components/PageHead';
import { PhotoSlot } from '../components/PhotoSlot';
import { AREAS, CARE, CATS, CLEAN_DAILY, CLEAN_MONTHLY, CLEAN_WEEKLY, DN, HABITS, REFLECT } from '../lib/constants';
import { addDays, daysInMonth, longDate, monday, monthLabel, promptFor, weekLabel, ym, ymd } from '../lib/dates';
import { useNav } from '../lib/nav';
import { budgetSummary, categoryIds, money, nextCategoryId } from '../lib/planner';
import { num, useStore } from '../lib/store';

export function Goals() {
  return (
    <div className="page roomy">
      <PageHead eyebrow="Goals & vision" title="The life I’m designing" />
      <div className="hero-olive row" style={{ padding: '22px 26px', gap: 20, flexWrap: 'wrap' }}>
        <label htmlFor="gl:word" className="label-caps" style={{ color: 'var(--pink)' }}>Word for the year</label>
        <Line
          k="gl:word"
          className="in sage"
          placeholder="e.g. Bloom"
          style={{ flex: 1, minWidth: 200, fontFamily: 'var(--serif)', fontSize: 36, fontStyle: 'italic', color: 'var(--paper)', padding: '4px 2px' }}
        />
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <PhotoSlot key={i} id={'vision-' + i} radius={14} placeholder="Vision board image" />
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
        {AREAS.map((name, i) => (
          <div key={name} className="card">
            <label htmlFor={`gl:${i}:g`} className="eyebrow">{name}</label>
            <Line k={`gl:${i}:g`} className="in serif full" placeholder="My goal" style={{ fontSize: 22 }} />
            {[0, 1, 2].map((j) => (
              <div key={j} className="check-row">
                <Check k={`gl:${i}:c${j}`} />
                <Line k={`gl:${i}:t${j}`} className="in hair grow" placeholder="Next step" style={{ fontSize: 14 }} aria-label={`${name} step ${j + 1}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Name column + one square per day + count. Used by Habits and Cleaning. */
function TickTable({ rows, cols, colLabels, minWidth, compact }: {
  rows: { nameKey: string; def: string; cellKey: (c: number) => string }[];
  cols: number;
  colLabels: string[];
  minWidth: number;
  /** Fixed-size squares, for short rows like a 7-day week. */
  compact?: boolean;
}) {
  const { data, toggle } = useStore();
  return (
    <div className={compact ? 'card tick-scroll compact' : 'card tick-scroll'}>
      <div className="tick-row" style={{ minWidth, paddingBottom: 6 }}>
        <div style={{ width: 170, flex: 'none' }} />
        <div className="tick-cells">
          {colLabels.map((d, i) => <div key={i} className="tick-label">{d}</div>)}
        </div>
        <div className="tick-count" />
      </div>
      {rows.map((r) => {
        let count = 0;
        const cells = Array.from({ length: cols }, (_, c) => {
          const k = r.cellKey(c);
          const on = !!data[k];
          if (on) count++;
          return <button key={c} className={on ? 'tick on' : 'tick'} onClick={() => toggle(k)} aria-pressed={on} aria-label={`${colLabels[c]}`} />;
        });
        return (
          <div key={r.nameKey} className="tick-row" style={{ minWidth }}>
            <Line k={r.nameKey} def={r.def} className="in hair" style={{ width: 170, flex: 'none', fontSize: 14, padding: '6px 2px' }} aria-label="Name" />
            <div className="tick-cells">{cells}</div>
            <div className="tick-count">{count}/{cols}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Habits() {
  const { D, setDay } = useNav();
  const y = D.getFullYear();
  const m = D.getMonth();
  const dim = daysInMonth(y, m);
  const ymKey = ym(D);
  return (
    <div className="page">
      <PageHead eyebrow="Habit tracker" title={monthLabel(D)}>
        <PrevNext onPrev={() => setDay(new Date(y, m - 1, 1))} onNext={() => setDay(new Date(y, m + 1, 1))} />
      </PageHead>
      <TickTable
        minWidth={900}
        cols={dim}
        colLabels={Array.from({ length: dim }, (_, i) => String(i + 1))}
        rows={HABITS.map((def, i) => ({ nameKey: 'hb:n' + i, def, cellKey: (c) => `hb:${ymKey}:${i}:${c + 1}` }))}
      />
      <div className="hint">Tap a square to tick off a day. Tap a habit name to rename it.</div>
    </div>
  );
}

export function Budget() {
  const { data, set } = useStore();
  const { D, setDay } = useNav();
  const y = D.getFullYear();
  const m = D.getMonth();
  const ymKey = ym(D);
  const ids = categoryIds(data);
  const sum = budgetSummary(data, ymKey);
  const cols = 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 32px';

  return (
    <div className="page">
      <PageHead eyebrow="Budget" title={monthLabel(D)}>
        <PrevNext onPrev={() => setDay(new Date(y, m - 1, 1))} onNext={() => setDay(new Date(y, m + 1, 1))} />
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <label className="label-caps stack" style={{ background: 'var(--olive)', borderRadius: 14, padding: '16px 18px', color: 'var(--pink)', gap: 4 }}>
          Income £
          <Line k={`bg:${ymKey}:inc`} type="number" placeholder="0" className="in sage big-num" style={{ color: 'var(--paper)', fontSize: 32, padding: 2 }} />
        </label>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div className="eyebrow">Planned</div>
          <div className="big-num" style={{ fontSize: 32, color: 'var(--ink)', lineHeight: 1.3 }}>{money(sum.planned)}</div>
        </div>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div className="eyebrow">Spent</div>
          <div className="big-num" style={{ fontSize: 32, color: 'var(--ink)', lineHeight: 1.3 }}>{money(sum.actual)}</div>
        </div>
        <div style={{ background: 'var(--pink)', borderRadius: 14, padding: '16px 18px' }}>
          <div className="label-caps" style={{ color: 'var(--ink)' }}>Left</div>
          <div className="big-num" style={{ fontSize: 32, color: sum.left < 0 ? 'var(--rose-text)' : 'var(--ink)', lineHeight: 1.3 }}>{money(sum.left)}</div>
        </div>
      </div>
      <div className="card" style={{ padding: '12px 18px' }}>
        <div className="grid thead" style={{ gridTemplateColumns: cols, gap: 12 }}>
          <div>Category</div><div>Planned £</div><div>Actual £</div><div />
        </div>
        {ids.map((i) => (
          <div key={i} className="grid trow" style={{ gridTemplateColumns: cols, gap: 12 }}>
            <Line k={'bg:cat' + i} def={CATS[i] ?? ''} placeholder="Category name" className="in bare" style={{ padding: '10px 2px' }} aria-label="Category name" />
            <Line k={`bg:${ymKey}:p${i}`} type="number" className="in bare" style={{ padding: '10px 2px' }} aria-label="Planned £" />
            <Line k={`bg:${ymKey}:a${i}`} type="number" className="in bare" style={{ padding: '10px 2px' }} aria-label="Actual £" />
            <button
              title="Remove category"
              aria-label="Remove category"
              onClick={() => set('bg:ids', ids.filter((x) => x !== i))}
              style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--rose-text-2)', fontSize: 18, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        ))}
        <button className="btn-dashed" onClick={() => set('bg:ids', [...ids, nextCategoryId(data)])}>+ Add category</button>
      </div>
    </div>
  );
}

export function Meals() {
  const { data } = useStore();
  const { D, setDay } = useNav();
  const wk = ymd(monday(D));
  const spent = Array.from({ length: 14 }, (_, i) => num(data[`sh:${wk}:p${i}`])).reduce((a, b) => a + b, 0);
  const cols = '44px repeat(3,minmax(0,1fr))';
  return (
    <div className="page">
      <PageHead eyebrow="Meal planner" title={weekLabel(D)}>
        <PrevNext onPrev={() => setDay(addDays(D, -7))} onNext={() => setDay(addDays(D, 7))} prev="← Week" next="Week →" />
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ padding: '12px 18px' }}>
          <div className="grid thead" style={{ gridTemplateColumns: cols, gap: 8 }}>
            <div /><div>Breakfast</div><div>Lunch</div><div>Dinner</div>
          </div>
          {DN.map((name, d) => (
            <div key={name} className="grid trow" style={{ gridTemplateColumns: cols, gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--olive)' }}>{name.slice(0, 3)}</div>
              {['Breakfast', 'Lunch', 'Dinner'].map((meal, j) => (
                <Line key={j} k={`ml:${wk}:${d}:${j}`} className="in bare" style={{ fontSize: 13, padding: '9px 2px' }} aria-label={`${name} ${meal}`} />
              ))}
            </div>
          ))}
        </div>
        <div className="flat-tint">
          <h2 className="ctitle" style={{ margin: 0 }}>Shopping list</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, margin: '10px 0 8px' }}>
            <label className="stack" style={{ background: 'var(--paper)', borderRadius: 10, padding: '10px 12px', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--olive)', gap: 2 }}>
              Budget £
              <Line k={`sh:${wk}:budget`} type="number" placeholder="0" className="in bare big-num" style={{ fontSize: 24, color: 'var(--ink)', padding: 0 }} />
            </label>
            <div style={{ background: 'var(--paper)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--olive)' }}>Spent</div>
              <div className="big-num" style={{ fontSize: 24, color: 'var(--ink)', lineHeight: 1.2 }}>{money(spent)}</div>
            </div>
            <div style={{ background: 'var(--olive)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--pink)' }}>Left</div>
              <div className="big-num" style={{ fontSize: 24, color: 'var(--paper)', lineHeight: 1.2 }}>{money(num(data[`sh:${wk}:budget`]) - spent)}</div>
            </div>
          </div>
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="row" style={{ gap: 8, borderBottom: '1px solid var(--rose-line)' }}>
              <Check k={`sh:${wk}:c${i}`} size={17} />
              <Line k={`sh:${wk}:t${i}`} placeholder="Item" className="in bare grow" style={{ fontSize: 14 }} aria-label={`Item ${i + 1}`} />
              <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>£</span>
              <Line k={`sh:${wk}:p${i}`} type="number" step="0.01" className="in bare" style={{ width: 64, fontSize: 14, textAlign: 'right' }} aria-label={`Price of item ${i + 1}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Cleaning: not in the original design. Built from the same parts as
 * Habits (tick grid) and Travel (checklists). Keys:
 * cl:dn{i} daily task names · cl:WK:d{i}:{0-6} daily ticks
 * cl:wn{i} weekly job names · cl:WK:w{i} weekly done
 * cl:mn{i} monthly job names · cl:YYYY-MM:m{i} monthly done
 * cl:s{i}:t|c supplies to buy · cl:WK:notes
 */
export function Cleaning() {
  const { data } = useStore();
  const { D, setDay } = useNav();
  const wk = ymd(monday(D));
  const ymKey = ym(D);
  const weeklyDone = CLEAN_WEEKLY.filter((_, i) => data[`cl:${wk}:w${i}`]).length;
  const monthlyDone = CLEAN_MONTHLY.filter((_, i) => data[`cl:${ymKey}:m${i}`]).length;

  return (
    <div className="page">
      <PageHead eyebrow="Cleaning" title={weekLabel(D)}>
        <PrevNext onPrev={() => setDay(addDays(D, -7))} onNext={() => setDay(addDays(D, 7))} prev="← Week" next="Week →" />
      </PageHead>

      <div>
        <h2 className="ctitle" style={{ margin: '0 0 10px' }}>Daily routine</h2>
        <TickTable
          compact
          minWidth={520}
          cols={7}
          colLabels={DN.map((d) => d.slice(0, 3))}
          rows={CLEAN_DAILY.map((def, i) => ({ nameKey: 'cl:dn' + i, def, cellKey: (c) => `cl:${wk}:d${i}:${c}` }))}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 className="ctitle" style={{ margin: 0 }}>This week’s jobs</h2>
            <div style={{ fontSize: 13, color: 'var(--olive)', fontVariantNumeric: 'tabular-nums' }}>{weeklyDone}/{CLEAN_WEEKLY.length}</div>
          </div>
          {CLEAN_WEEKLY.map((def, i) => (
            <div key={i} className="check-row">
              <Check k={`cl:${wk}:w${i}`} />
              <Line k={'cl:wn' + i} def={def} className="in hair grow" style={{ fontSize: 14 }} aria-label="Weekly job" />
            </div>
          ))}
        </div>
        <div className="hero-pink" style={{ padding: 22 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 className="ctitle" style={{ margin: 0 }}>{monthLabel(D).split(' ')[0]} deep clean</h2>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{monthlyDone}/{CLEAN_MONTHLY.length}</div>
          </div>
          {CLEAN_MONTHLY.map((def, i) => (
            <div key={i} className="check-row">
              <Check k={`cl:${ymKey}:m${i}`} />
              <Line k={'cl:mn' + i} def={def} className="in rose grow" style={{ fontSize: 14 }} aria-label="Monthly job" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20, alignItems: 'start' }}>
        <div className="flat-tint">
          <h2 className="ctitle" style={{ margin: 0 }}>Supplies to buy</h2>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="check-row">
              <Check k={`cl:s${i}:c`} size={17} />
              <Line k={`cl:s${i}:t`} placeholder="Item" className="in roseline grow" style={{ fontSize: 14 }} aria-label={`Supply ${i + 1}`} />
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="ctitle" style={{ margin: 0 }}>Notes</h2>
          <Area k={`cl:${wk}:notes`} rows={6} className="ta" placeholder="Rooms to focus on, things to fix…" aria-label="Cleaning notes" />
        </div>
      </div>
      <div className="hint">Tap a job name to rename it. Weekly jobs reset each week and the deep clean each month.</div>
    </div>
  );
}

export function Care() {
  const { data, toggle } = useStore();
  const { D, day, setDay, today } = useNav();
  const ymKey = ym(D);
  return (
    <div className="page">
      <PageHead eyebrow="Self-care & journal" title={longDate(D)}>
        <DayNav onPrev={() => setDay(addDays(D, -1))} onToday={() => setDay(today)} onNext={() => setDay(addDays(D, 1))} />
      </PageHead>
      <div className="card r16" style={{ padding: 24 }}>
        <label htmlFor={`jr:${day}`} style={{ display: 'block', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 30, color: 'var(--ink)', lineHeight: 1.25 }}>
          {promptFor(D)}
        </label>
        <Area
          k={`jr:${day}`}
          rows={8}
          placeholder="Write freely…"
          className="ta"
          style={{ background: 'repeating-linear-gradient(transparent 0 31px,#ECE4D2 31px 32px)', fontSize: 16, lineHeight: '32px', marginTop: 12 }}
        />
      </div>
      <div>
        <h2 className="ctitle lg" style={{ margin: '0 0 10px' }}>Self-care menu</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
          {CARE.map((label, i) => {
            const k = `sc:${day}:${i}`;
            const on = !!data[k];
            return (
              <button
                key={i}
                onClick={() => toggle(k)}
                aria-pressed={on}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', padding: '14px 16px',
                  borderRadius: 12, cursor: 'pointer', font: 'inherit', fontSize: 15, color: 'var(--ink)',
                  border: `1px solid ${on ? 'var(--rose)' : 'var(--card-border)'}`, background: on ? 'var(--pink)' : 'var(--paper)',
                }}
              >
                <span>{label}</span>
                <span style={{ color: 'var(--olive)' }}>{on ? '✓' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="hero-pink stack" style={{ padding: 22, gap: 12 }}>
        <h2 className="ctitle lg" style={{ margin: 0 }}>{monthLabel(D)} reflection</h2>
        {REFLECT.map((q, i) => (
          <label key={i} className="stack" style={{ fontSize: 14, color: 'var(--ink)', gap: 4 }}>
            {q}
            <Area k={`rf:${ymKey}:${i}`} rows={2} className="ta" style={{ borderBottom: '1px solid var(--rose)', lineHeight: 1.5, marginTop: 0 }} />
          </label>
        ))}
      </div>
    </div>
  );
}
