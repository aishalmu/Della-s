import { useEffect, useRef, useState } from 'react';
import { deleteImage, downscale, getImage, onImagesChange, putImage } from '../lib/images';

const ICON = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
);

/** Tap-to-add photo, stored downscaled in IndexedDB under `id`. */
export function PhotoSlot({ id, radius, placeholder }: { id: string; radius: number; placeholder: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    let current: string | null = null;
    const load = () =>
      getImage(id)
        .then((blob) => {
          if (!alive) return;
          if (current) URL.revokeObjectURL(current);
          current = blob ? URL.createObjectURL(blob) : null;
          setUrl(current);
        })
        .catch(() => alive && setUrl(null));
    load();
    const off = onImagesChange(load);
    return () => {
      alive = false;
      off();
      if (current) URL.revokeObjectURL(current);
    };
  }, [id]);

  useEffect(() => {
    if (!confirmRemove) return;
    const t = window.setTimeout(() => setConfirmRemove(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmRemove]);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(''), 4000);
    return () => window.clearTimeout(t);
  }, [error]);

  const choose = () => input.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Choose a photo (JPEG, PNG or HEIC).');
      return;
    }
    setBusy(true);
    try {
      await putImage(id, await downscale(file));
    } catch {
      setError('Couldn’t read that photo. Try another one.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setConfirmRemove(false);
    deleteImage(id).catch(() => setError('Couldn’t remove the photo. Try again.'));
  };

  return (
    <div className="slot" style={{ borderRadius: radius }}>
      {url ? (
        <>
          <img src={url} alt={placeholder} />
          <div className="slot-ctl">
            <button onClick={choose}>Replace</button>
            <button onClick={remove}>{confirmRemove ? 'Tap again to remove' : 'Remove'}</button>
          </div>
        </>
      ) : (
        <button className="slot-empty" onClick={choose}>
          {ICON}
          <span>{placeholder}</span>
          <span className="sub">Tap to add a photo</span>
        </button>
      )}
      {busy && <div className="slot-busy">Adding photo…</div>}
      {error && <div className="slot-err" role="alert">{error}</div>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
