/**
 * Photos (vision board and crochet slots) live in IndexedDB, not
 * localStorage, because localStorage is only ~5 MB.
 */
const DB_NAME = 'aisha-bible-images';
const STORE = 'images';
const MAX_DIM = 1200;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

const listeners = new Set<() => void>();
export function onImagesChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const notify = () => listeners.forEach((fn) => fn());

export const getImage = (id: string) => run<Blob>('readonly', (s) => s.get(id));

export async function putImage(id: string, blob: Blob) {
  await run('readwrite', (s) => s.put(blob, id));
  notify();
}

export async function deleteImage(id: string) {
  await run('readwrite', (s) => s.delete(id));
  notify();
}

export async function getAllImages(): Promise<Record<string, Blob>> {
  const out: Record<string, Blob> = {};
  await run('readonly', (s) => {
    const req = s.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) {
        out[String(c.key)] = c.value as Blob;
        c.continue();
      }
    };
  });
  return out;
}

export async function replaceAllImages(images: Record<string, Blob>) {
  await run('readwrite', (s) => {
    s.clear();
    for (const [id, blob] of Object.entries(images)) s.put(blob, id);
  });
  notify();
}

/** Shrink a photo so the longest side is at most 1200px, re-encoded as JPEG. */
export async function downscale(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return out ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
