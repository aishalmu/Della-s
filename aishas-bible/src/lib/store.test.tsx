import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, StoreProvider, useStore } from './store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ onReady }: { onReady: (s: ReturnType<typeof useStore>) => void }) {
  const s = useStore();
  useEffect(() => {
    onReady(s);
  });
  return null;
}

describe('store', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('does not overwrite saved data just by opening', () => {
    vi.useFakeTimers();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ a: 1 }));
    const root = createRoot(document.createElement('div'));
    act(() => root.render(<StoreProvider><Probe onReady={() => {}} /></StoreProvider>));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ a: 1, fromOtherTab: true }));
    act(() => vi.advanceTimersByTime(1000));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ a: 1, fromOtherTab: true });
    act(() => root.unmount());
  });

  it('saves changes after a short pause', () => {
    vi.useFakeTimers();
    let store!: ReturnType<typeof useStore>;
    const root = createRoot(document.createElement('div'));
    act(() => root.render(<StoreProvider><Probe onReady={(s) => (store = s)} /></StoreProvider>));
    act(() => store.set('gl:word', 'Bloom'));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => vi.advanceTimersByTime(400));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ 'gl:word': 'Bloom' });
    act(() => root.unmount());
  });
});
