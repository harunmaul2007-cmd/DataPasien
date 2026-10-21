import { describe, expect, it } from 'vitest';
import { isUuidV4, newId } from './ids';

describe('ids', () => {
  it('newId menghasilkan UUID v4', () => {
    expect(isUuidV4(newId())).toBe(true);
  });

  it('newId menghasilkan identitas berbeda pada banyak pemanggilan', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });

  it('isUuidV4 menolak string bukan UUID v4', () => {
    expect(isUuidV4('')).toBe(false);
    expect(isUuidV4('bukan-uuid')).toBe(false);
    // versi 1, bukan 4
    expect(isUuidV4('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
  });
});
