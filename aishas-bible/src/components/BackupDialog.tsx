import { useEffect, useRef, useState } from 'react';
import { backupFileName, buildBackup, dataUrlToBlob, parseBackup, BackupError, type BackupFile } from '../lib/backup';
import { getAllImages, replaceAllImages } from '../lib/images';
import { useStore } from '../lib/store';
import { MN } from '../lib/constants';

const LAST_BACKUP_KEY = 'aisha-bible-last-backup';

export function readLastBackup(): Date | null {
  try {
    const v = localStorage.getItem(LAST_BACKUP_KEY);
    return v ? new Date(v) : null;
  } catch {
    return null;
  }
}

function writeLastBackup(d: Date) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, d.toISOString());
  } catch {
    /* not critical */
  }
}

export function formatDate(d: Date) {
  return d.getDate() + ' ' + MN[d.getMonth()] + ' ' + d.getFullYear();
}

type Status = { kind: 'ok' | 'err'; text: string } | null;

export function BackupDialog({ onClose, onBackedUp }: { onClose: () => void; onBackedUp: () => void }) {
  const { data, replaceAll } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [working, setWorking] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const last = readLastBackup();

  // Build the file ahead of the tap: iPad Safari only allows the share
  // sheet to open straight from a tap, with no slow work in between.
  useEffect(() => {
    let alive = true;
    setFile(null);
    getAllImages()
      .catch(() => ({}))
      .then((images) => buildBackup(data, images))
      .then((b) => {
        if (alive) setFile(new File([JSON.stringify(b)], backupFileName(), { type: 'application/json' }));
      });
    return () => {
      alive = false;
    };
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const markDone = (text: string) => {
    writeLastBackup(new Date());
    onBackedUp();
    setStatus({ kind: 'ok', text });
  };

  const exportBackup = async () => {
    if (!file) return;
    setStatus(null);
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Aisha’s Bible backup' });
        markDone('Backup saved. Keep it somewhere safe, like iCloud Drive.');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setStatus({ kind: 'err', text: 'The backup couldn’t be shared. Try again.' });
      }
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    markDone(`Downloaded ${file.name}. Keep it somewhere safe, like iCloud Drive.`);
  };

  const onPick = async (f: File | undefined) => {
    if (!f) return;
    setStatus(null);
    try {
      setPending(parseBackup(await f.text()));
    } catch (e) {
      setStatus({ kind: 'err', text: e instanceof BackupError ? e.message : 'That file couldn’t be read. Try choosing it again.' });
    }
  };

  const restore = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      const images: Record<string, Blob> = {};
      for (const [id, url] of Object.entries(pending.images)) images[id] = dataUrlToBlob(url);
      await replaceAllImages(images);
      replaceAll(pending.data);
      setPending(null);
      setStatus({ kind: 'ok', text: 'Backup restored. Your planner now matches the backup.' });
    } catch {
      setStatus({ kind: 'err', text: 'The backup couldn’t be restored. Nothing was changed in your notes; try again.' });
    } finally {
      setWorking(false);
    }
  };

  const pendingDate = pending?.exportedAt ? new Date(pending.exportedAt) : null;
  const pendingPhotos = pending ? Object.keys(pending.images).length : 0;

  return (
    <div className="dialog-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="backup-title">
        <div>
          <div className="eyebrow">Keep it safe</div>
          <h2 id="backup-title" className="ctitle lg" style={{ margin: '4px 0 0' }}>Backup &amp; restore</h2>
        </div>

        {pending ? (
          <>
            <p>
              Replace everything in your planner with the backup
              {pendingDate && !isNaN(pendingDate.getTime()) ? ` from ${formatDate(pendingDate)}` : ''}
              {pendingPhotos ? ` (including ${pendingPhotos} photo${pendingPhotos === 1 ? '' : 's'})` : ''}?
            </p>
            <p>What’s in the planner now will be overwritten. Export a backup first if you want to keep it.</p>
            <div className="actions">
              <button className="btn-danger" onClick={restore} disabled={working}>
                {working ? 'Restoring…' : 'Replace my planner'}
              </button>
              <button className="btn-secondary" onClick={() => setPending(null)} disabled={working}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p>
              Your planner is saved on this device only. If the browser’s data is cleared, it’s gone, so export a backup
              every week or two and keep the file in iCloud Drive or Files.
            </p>
            <p style={{ fontSize: 14 }}>Last backup: {last ? formatDate(last) : 'never'}</p>
            <div className="actions">
              <button className="btn-primary" onClick={exportBackup} disabled={!file}>
                {file ? 'Export backup' : 'Preparing…'}
              </button>
              <button className="btn-secondary" onClick={() => picker.current?.click()}>Import a backup</button>
            </div>
          </>
        )}

        {status && <div className={`notice ${status.kind}`} role="status">{status.text}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="link-btn" onClick={onClose}>Close</button>
        </div>

        <input
          ref={picker}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
