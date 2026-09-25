import type { Data } from './store';

export const BACKUP_APP = 'aishas-bible';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Data;
  /** Photo slot id → image as a data: URL. */
  images: Record<string, string>;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(url: string): Blob {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
  if (!m) throw new Error('Not a data URL');
  const type = m[1] || 'application/octet-stream';
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type });
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function buildBackup(data: Data, images: Record<string, Blob>, now = new Date()): Promise<BackupFile> {
  const encoded: Record<string, string> = {};
  for (const [id, blob] of Object.entries(images)) encoded[id] = await blobToDataUrl(blob);
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data, images: encoded };
}

export class BackupError extends Error {}

/** Check a chosen file really is one of our backups before anything is overwritten. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('That file isn’t a backup from Aisha’s Bible. Choose the .json file you saved with “Export backup”.');
  }
  const b = raw as Partial<BackupFile> | null;
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP || !b.data || typeof b.data !== 'object' || Array.isArray(b.data)) {
    throw new BackupError('That file isn’t a backup from Aisha’s Bible. Choose the .json file you saved with “Export backup”.');
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of the planner. Reload the app to update it, then try again.');
  }
  const images: Record<string, string> = {};
  if (b.images && typeof b.images === 'object') {
    for (const [id, url] of Object.entries(b.images)) {
      if (typeof url === 'string' && url.startsWith('data:image/')) images[id] = url;
    }
  }
  return {
    app: BACKUP_APP,
    version: b.version,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    data: b.data as Data,
    images,
  };
}

export const backupFileName = (now = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `aishas-bible-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
};
