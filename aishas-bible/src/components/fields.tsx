import type { CSSProperties } from 'react';
import { str, useStore } from '../lib/store';

interface Base {
  k: string;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  'aria-label'?: string;
}

/** Text input bound to one key. `def` shows until the key has been edited. */
export function Line({ k, def, type = 'text', step, ...rest }: Base & { def?: string; type?: 'text' | 'number' | 'date'; step?: string }) {
  const { data, set } = useStore();
  const v = data[k] === undefined ? def ?? '' : str(data[k]);
  return (
    <input
      id={k}
      type={type}
      step={step}
      inputMode={type === 'number' ? 'decimal' : undefined}
      value={v}
      onChange={(e) => set(k, e.target.value)}
      autoComplete="off"
      {...rest}
    />
  );
}

export function Area({ k, rows, ...rest }: Base & { rows?: number }) {
  const { data, set } = useStore();
  return <textarea id={k} rows={rows} value={str(data[k])} onChange={(e) => set(k, e.target.value)} {...rest} />;
}

export function Check({ k, size = 18, rose, label }: { k: string; size?: number; rose?: boolean; label?: string }) {
  const { data, set } = useStore();
  return (
    <input
      id={k}
      type="checkbox"
      className={rose ? 'check rose' : 'check'}
      style={{ width: size, height: size }}
      checked={!!data[k]}
      onChange={(e) => set(k, e.target.checked)}
      aria-label={label ?? 'Done'}
    />
  );
}

export function Pick({ k, options, blank = '', ...rest }: Base & { options: string[]; blank?: string }) {
  const { data, set } = useStore();
  return (
    <select id={k} value={str(data[k])} onChange={(e) => set(k, e.target.value)} {...rest}>
      <option value="">{blank}</option>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

export function Range({ k, ...rest }: Base) {
  const { data, set } = useStore();
  return (
    <input id={k} type="range" min={0} max={100} step={5} value={str(data[k] ?? '0') || '0'} onChange={(e) => set(k, e.target.value)} {...rest} />
  );
}
