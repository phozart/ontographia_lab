import { isValidThumbnail, MAX_THUMBNAIL_BYTES, shouldCaptureThumbnail, THUMBNAIL_INTERVAL_MS } from '../../lib/thumbnail';

const png = (n) => 'data:image/png;base64,' + 'A'.repeat(n);

describe('isValidThumbnail', () => {
  test('accepts a small png data URL', () => {
    expect(isValidThumbnail(png(100))).toBe(true);
  });
  test('rejects non-png / non-data / non-string', () => {
    expect(isValidThumbnail('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(isValidThumbnail('data:image/jpeg;base64,AAAA')).toBe(false);
    expect(isValidThumbnail('https://evil.example/x.png')).toBe(false);
    expect(isValidThumbnail('data:image/png;base64,<script>')).toBe(false);
    expect(isValidThumbnail(42)).toBe(false);
    expect(isValidThumbnail(null)).toBe(false);
  });
  test('enforces the size cap', () => {
    expect(isValidThumbnail(png(MAX_THUMBNAIL_BYTES))).toBe(false);
  });
});

describe('shouldCaptureThumbnail', () => {
  test('captures when never captured, then only after the interval', () => {
    expect(shouldCaptureThumbnail(0, 1000)).toBe(true);
    expect(shouldCaptureThumbnail(1000, 1000 + THUMBNAIL_INTERVAL_MS - 1)).toBe(false);
    expect(shouldCaptureThumbnail(1000, 1000 + THUMBNAIL_INTERVAL_MS)).toBe(true);
  });
});
