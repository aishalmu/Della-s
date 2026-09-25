import { describe, expect, it } from 'vitest';
import { backupFileName, buildBackup, dataUrlToBlob, parseBackup, BackupError } from './backup';

describe('backup', () => {
  it('round-trips data and photos', async () => {
    const photo = new Blob([new Uint8Array([255, 216, 255, 0, 1, 2])], { type: 'image/jpeg' });
    const b = await buildBackup({ 'gl:word': 'Bloom', 'bg:ids': [0, 2] }, { 'vision-0': photo }, new Date('2026-10-05T10:00:00Z'));
    const back = parseBackup(JSON.stringify(b));
    expect(back.data).toEqual({ 'gl:word': 'Bloom', 'bg:ids': [0, 2] });
    expect(back.exportedAt).toBe('2026-10-05T10:00:00.000Z');
    const restored = dataUrlToBlob(back.images['vision-0']);
    expect(restored.type).toBe('image/jpeg');
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(new Uint8Array([255, 216, 255, 0, 1, 2]));
  });

  it('rejects files that are not our backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"hello":1}')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"aishas-bible","version":1,"data":[]}')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"aishas-bible","version":99,"data":{}}')).toThrow(/newer version/);
  });

  it('drops anything in images that is not an image', () => {
    const b = parseBackup(JSON.stringify({ app: 'aishas-bible', version: 1, data: {}, images: { a: 'data:image/png;base64,AA==', b: 'javascript:alert(1)', c: 5 } }));
    expect(Object.keys(b.images)).toEqual(['a']);
  });

  it('names the file by date', () => {
    expect(backupFileName(new Date(2026, 9, 5))).toBe('aishas-bible-backup-2026-10-05.json');
  });
});
