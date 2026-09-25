import { Area, Check, Line, Pick } from '../components/fields';
import { DayNav, PageHead, PrevNext } from '../components/PageHead';
import { DN, EVENT_TYPES, HABITS, MN, MOODS } from '../lib/constants';
import {
  addDays, daysInMonth, greeting, leadBlanks, longDate, monday, monthLabel, plannerMonths,
  promptFor, rangeLabel, shortDate, weekLabel, ym, ymd, clamp,
} from '../lib/dates';
import { useNav } from '../lib/nav';
import { dayInfo, nextTrip, pilatesCount, readingSummary } from '../lib/planner';
import { str, useStore } from '../lib/store';

export function Home() {
  const { data, toggle } = useStore();
  const { today, todayKey, now, setDay, setPage } = useNav();
  const tym = ym(today);
  const reading = readingSummary(data);
  const trip = nextTrip(data, today);
  const plGoal = str(data['pl:goal:' + tym]) || '–';

  return (
    <div className="page roomy">
      <div>
        <div className="eyebrow">{longDate(today)}</div>
        <h1 className="greet" style={{ marginBottom: 0 }}>{greeting(now)}, Aisha</h1>
        {str(data['gl:word']).trim() && (
          <div className="word-line">Your word for the year<em>{str(data['gl:word']).trim()}</em></div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
        <div className="card r16 stack" style={{ padding: 22, gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 className="ctitle lg" style={{ margin: 0 }}>Today’s top three</h2>
            <button className="link-btn" onClick={() => { setDay(today); setPage('day'); }}>Open today →</button>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="row" style={{ gap: 12 }}>
              <Check k={`d:${todayKey}:pc${i}`} size={20} />
              <Line k={`d:${todayKey}:p${i}`} className="in grow" placeholder="Priority" style={{ fontSize: 16, padding: '10px 2px' }} aria-label={`Priority ${i + 1}`} />
            </div>
          ))}
        </div>
        <div className="card r16 stack" style={{ padding: 22, gap: 12 }}>
          <h2 className="ctitle lg" style={{ margin: 0 }}>Habits today</h2>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {HABITS.map((def, i) => {
              const k = `hb:${tym}:${i}:${today.getDate()}`;
              const on = !!data[k];
              return (
                <button key={i} className={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={() => toggle(k)}>
                  {(data['hb:n' + i] as string | undefined) ?? def}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
        <div className="hero-pink stack" style={{ padding: 22, gap: 6 }}>
          <div className="label-caps" style={{ color: 'var(--ink)' }}>Currently reading</div>
          <div className="ctitle lg" style={{ lineHeight: 1.15 }}>{reading.current}</div>
          <div style={{ fontSize: 14, color: 'var(--ink)' }}>{reading.finished} of {reading.goal} books this year</div>
        </div>
        <div className="ticket">
          <div className="label-caps" style={{ color: 'var(--pink)' }}>Next departure</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, lineHeight: 1.15 }}>{trip.name}</div>
          <div style={{ fontSize: 14 }}>{trip.when}</div>
        </div>
        <div className="card r16 stack" style={{ padding: 22, gap: 6 }}>
          <div className="eyebrow">Reformer this month</div>
          <div className="big-num" style={{ fontSize: 44, color: 'var(--ink)' }}>{pilatesCount(data, today.getFullYear(), today.getMonth())}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>classes · goal {plGoal}</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 22 }}>
        <div className="eyebrow">Today’s journal prompt</div>
        <button
          onClick={() => { setDay(today); setPage('care'); }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', marginTop: 6 }}
        >
          <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 28, color: 'var(--ink)' }}>{promptFor(clamp(today))}</span>
          <span style={{ fontSize: 14, color: 'var(--olive)', whiteSpace: 'nowrap' }}>Write →</span>
        </button>
      </div>
    </div>
  );
}

export function Year() {
  const { data } = useStore();
  const { todayKey, openDay, setDay, setPage } = useNav();
  return (
    <div className="page roomy">
      <PageHead eyebrow="Year at a glance" title={rangeLabel()} />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 18 }}>
        {plannerMonths().map((f) => {
          const y = f.getFullYear();
          const m = f.getMonth();
          return (
            <div key={ym(f)} className="card" style={{ padding: 16 }}>
              <button
                onClick={() => { setDay(f); setPage('month'); }}
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 500, fontStyle: 'italic', color: 'var(--ink)' }}
              >
                {MN[m]} <span style={{ fontFamily: 'var(--sans)', fontStyle: 'normal', fontSize: 13, color: 'var(--muted-2)', fontWeight: 400 }}>{y}</span>
              </button>
              <div className="mini-cal">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
                {Array.from({ length: leadBlanks(y, m) }, (_, i) => <div key={'b' + i} />)}
                {Array.from({ length: daysInMonth(y, m) }, (_, i) => {
                  const k = ymd(new Date(y, m, i + 1));
                  const cls = k === todayKey ? 'mini-day today' : data['m:' + k] ? 'mini-day noted' : 'mini-day';
                  return <button key={k} className={cls} onClick={() => openDay(k)} aria-label={k}>{i + 1}</button>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Month() {
  const { data } = useStore();
  const { D, setDay, todayKey, openDay } = useNav();
  const y = D.getFullYear();
  const m = D.getMonth();
  const lead = leadBlanks(y, m);
  const start = monday(new Date(y, m, 1));
  const cells = Math.ceil((lead + daysInMonth(y, m)) / 7) * 7;

  return (
    <div className="page">
      <PageHead eyebrow="Monthly view" title={monthLabel(D)}>
        <PrevNext onPrev={() => setDay(new Date(y, m - 1, 1))} onNext={() => setDay(new Date(y, m + 1, 1))} />
      </PageHead>
      <div className="tick-scroll">
        <div className="month-grid" style={{ minWidth: 560 }}>
          {DN.map((d) => <div key={d} className="month-dow">{d.slice(0, 3)}</div>)}
          {Array.from({ length: cells }, (_, i) => {
            const c = addDays(start, i);
            const k = ymd(c);
            const inf = dayInfo(data, k);
            const cls = ['month-cell', k === todayKey && 'today', c.getMonth() !== m && 'other'].filter(Boolean).join(' ');
            return (
              <div key={k} className={cls}>
                <button className="day-num" onClick={() => openDay(k)} aria-label={`Open ${longDate(c)}`}>{c.getDate()}</button>
                {inf.ev.map((t, j) => <div key={'e' + j} className="tag-ev">{t}</div>)}
                {[...inf.pr, ...inf.sch].map((t, j) => <div key={'i' + j} className="tag-item">{t}</div>)}
                <Area fixed k={'m:' + k} className="cell-note" aria-label={`Note for ${longDate(c)}`} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <h2 className="ctitle" style={{ margin: 0 }}>This month I want to…</h2>
        <Area k={'mg:' + ym(D)} rows={3} className="ta" aria-label="This month I want to" />
      </div>
    </div>
  );
}

export function Week() {
  const { data } = useStore();
  const { D, setDay, todayKey, openDay } = useNav();
  const mon = monday(D);
  const wk = ymd(mon);
  return (
    <div className="page">
      <PageHead eyebrow="Weekly spread" title={weekLabel(D)}>
        <PrevNext onPrev={() => setDay(addDays(D, -7))} onNext={() => setDay(addDays(D, 7))} />
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
        <div className="flat-pink">
          <h2 className="ctitle" style={{ margin: 0 }}>Week focus</h2>
          {[0, 1, 2].map((i) => (
            <Line key={i} k={`wk:${wk}:p${i}`} className="in rose full" placeholder="Focus" style={{ padding: '9px 2px' }} aria-label={`Week focus ${i + 1}`} />
          ))}
        </div>
        {DN.map((name, i) => {
          const c = addDays(mon, i);
          const k = ymd(c);
          const inf = dayInfo(data, k);
          return (
            <div key={k} className="card" style={{ padding: '16px 18px', background: k === todayKey ? 'var(--pink-tint)' : undefined }}>
              <button onClick={() => openDay(k)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span className="ctitle">{name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>{shortDate(c)}</span>
              </button>
              <div className="stack" style={{ gap: 4, marginTop: 6 }}>
                {inf.ev.map((t, j) => <div key={'e' + j} style={{ fontSize: 13, background: 'var(--rose)', color: 'var(--ink)', borderRadius: 6, padding: '4px 8px' }}>{t}</div>)}
                {inf.pr.map((t, j) => <div key={'p' + j} style={{ fontSize: 13, color: 'var(--ink)', borderLeft: '2px solid var(--olive)', padding: '2px 0 2px 8px' }}>{t}</div>)}
                {inf.sch.map((t, j) => <div key={'s' + j} style={{ fontSize: 13, color: 'var(--muted)', padding: '2px 0 2px 10px' }}>{t}</div>)}
              </div>
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="check-row">
                  <Check k={`d:${k}:c${j}`} />
                  <Line k={`d:${k}:t${j}`} className="in grow" style={{ fontSize: 14 }} aria-label={`${name} to-do ${j + 1}`} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="card">
        <h2 className="ctitle" style={{ margin: 0 }}>Notes</h2>
        <Area k={`wk:${wk}:notes`} rows={3} className="ta" aria-label="Week notes" />
      </div>
    </div>
  );
}

export function Day() {
  const { data, set, toggle } = useStore();
  const { D, day, setDay, today } = useNav();
  const md = day.slice(5);
  const wk = ymd(monday(D));
  const di = (D.getDay() + 6) % 7;
  const mood = str(data[`d:${day}:mood`]);

  return (
    <div className="page">
      <PageHead eyebrow="Daily page" title={longDate(D)}>
        <DayNav onPrev={() => setDay(addDays(D, -1))} onToday={() => setDay(today)} onNext={() => setDay(addDays(D, 1))} />
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 20 }}>
          <div className="flat-olive">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--paper)' }}>Celebrations</h2>
              <div style={{ fontSize: 12, color: 'var(--pink)' }}>Repeats every year</div>
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="row" style={{ gap: 10, borderBottom: '1px solid var(--olive-line)' }}>
                <Pick k={`ev:${md}:${i}:type`} options={EVENT_TYPES} blank="Type" className="in bare chev-pink" style={{ width: 120, color: 'var(--pink)', fontSize: 14, padding: '9px 0' }} aria-label="Celebration type" />
                <Line k={`ev:${md}:${i}`} className="in bare grow" placeholder="Name or occasion" style={{ color: 'var(--paper)', padding: '9px 2px' }} aria-label="Name or occasion" />
              </div>
            ))}
          </div>
          <div className="flat-pink">
            <h2 className="ctitle" style={{ margin: 0 }}>Top three</h2>
            {[0, 1, 2].map((i) => (
              <div key={i} className="check-row">
                <Check k={`d:${day}:pc${i}`} size={20} />
                <Line k={`d:${day}:p${i}`} className="in rose grow" style={{ fontSize: 16, padding: '9px 2px' }} aria-label={`Priority ${i + 1}`} />
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="ctitle" style={{ margin: 0 }}>To do</h2>
            {[0, 1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="check-row">
                <Check k={`d:${day}:c${j}`} />
                <Line k={`d:${day}:t${j}`} className="in grow" aria-label={`To-do ${j + 1}`} />
              </div>
            ))}
          </div>
          <div className="card stack" style={{ gap: 14 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Water</div>
              <div className="row" style={{ gap: 6 }}>
                {Array.from({ length: 8 }, (_, i) => {
                  const k = `d:${day}:w${i}`;
                  return (
                    <button
                      key={i}
                      className={data[k] ? 'glass on' : 'glass'}
                      onClick={() => toggle(k)}
                      aria-pressed={!!data[k]}
                      aria-label={`Glass ${i + 1}`}
                    />
                  );
                })}
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Mood</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {MOODS.map((label) => (
                  <button
                    key={label}
                    className={mood === label ? 'chip rose-on' : 'chip'}
                    style={{ padding: '8px 14px' }}
                    aria-pressed={mood === label}
                    onClick={() => set(`d:${day}:mood`, mood === label ? '' : label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {(['Breakfast', 'Lunch', 'Dinner'] as const).map((label, j) => (
                <label key={label} style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--olive)' }}>
                  {label}
                  <Line k={`ml:${wk}:${di}:${j}`} className="in full" style={{ fontSize: 14, textTransform: 'none', letterSpacing: 0 }} />
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="stack" style={{ gap: 20 }}>
          <div className="card">
            <h2 className="ctitle" style={{ margin: 0 }}>Schedule</h2>
            {Array.from({ length: 15 }, (_, i) => i + 7).map((h) => (
              <div key={h} className="row" style={{ gap: 12, borderBottom: '1px solid var(--hairline)' }}>
                <div style={{ width: 44, fontSize: 13, color: 'var(--muted-2)', fontVariantNumeric: 'tabular-nums' }}>{h}:00</div>
                <Line k={`d:${day}:h${h}`} className="in bare grow" style={{ fontSize: 14 }} aria-label={`${h}:00`} />
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="ctitle" style={{ margin: 0 }}>Grateful for</h2>
            <Area k={`d:${day}:grat`} rows={3} className="ta" aria-label="Grateful for" />
          </div>
        </div>
      </div>
    </div>
  );
}
