import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { deleteImage, getAllImages, getImage, putImage, replaceAllImages } from './images';

describe('image store', () => {
  it('stores, lists, replaces and deletes photos', async () => {
    await putImage('vision-0', new Blob(['a'], { type: 'image/jpeg' }));
    await putImage('crochet-1', new Blob(['b'], { type: 'image/jpeg' }));
    expect(Object.keys(await getAllImages()).sort()).toEqual(['crochet-1', 'vision-0']);
    await deleteImage('vision-0');
    expect(await getImage('vision-0')).toBeUndefined();
    await replaceAllImages({ 'vision-5': new Blob(['c'], { type: 'image/png' }) });
    expect(Object.keys(await getAllImages())).toEqual(['vision-5']);
  });
});
