import type { ReactNode } from 'react';

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className={children ? 'page-head ruled' : 'page-head'}>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="ptitle" style={{ margin: 0 }}>{title}</h1>
      </div>
      {children && <div className="btn-row">{children}</div>}
    </div>
  );
}

export function PrevNext({ onPrev, onNext, prev = '← Prev', next = 'Next →' }: { onPrev: () => void; onNext: () => void; prev?: string; next?: string }) {
  return (
    <>
      <button className="btn-secondary" onClick={onPrev}>{prev}</button>
      <button className="btn-secondary" onClick={onNext}>{next}</button>
    </>
  );
}

export function DayNav({ onPrev, onToday, onNext }: { onPrev: () => void; onToday: () => void; onNext: () => void }) {
  return (
    <>
      <button className="btn-secondary" onClick={onPrev} aria-label="Previous day">←</button>
      <button className="btn-secondary" onClick={onToday}>Today</button>
      <button className="btn-secondary" onClick={onNext} aria-label="Next day">→</button>
    </>
  );
}
