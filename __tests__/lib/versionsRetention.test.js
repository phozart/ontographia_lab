const { planRetention } = require('../../lib/versions/retention');
const { VERSION_AUTO_INTERVAL_MS, AUTO_KEEP_ALL_MS, AUTO_DAILY_WINDOW_MS, AUTO_CAP } = require('../../lib/versions/policy');

const NOW = new Date('2026-06-15T12:00:00Z');
const H = 3600 * 1000;
const D = 24 * H;
const v = (id, ageMs) => ({ id, createdAt: new Date(NOW.getTime() - ageMs) });

describe('policy constants (Q-V1)', () => {
  test('values', () => {
    expect(VERSION_AUTO_INTERVAL_MS).toBe(10 * 60 * 1000);
    expect(AUTO_KEEP_ALL_MS).toBe(24 * H);
    expect(AUTO_DAILY_WINDOW_MS).toBe(30 * D);
    expect(AUTO_CAP).toBe(100);
  });
});

describe('planRetention', () => {
  test('nothing to delete for an empty or small list', () => {
    expect(planRetention([], NOW)).toEqual([]);
    expect(planRetention([v('a', 0), v('b', 11 * 60 * 1000)], NOW)).toEqual([]);
  });

  test('keeps everything up to and including 24h old', () => {
    const list = [v('a', 1 * H), v('b', 2 * H), v('c', 23 * H), v('d', 24 * H)];
    expect(planRetention(list, NOW)).toEqual([]);
  });

  test('keeps the newest per UTC day between 24h and 30d', () => {
    const list = [
      { id: 'd13-13', createdAt: new Date('2026-06-13T13:00:00Z') },
      { id: 'd13-09', createdAt: new Date('2026-06-13T09:00:00Z') },
      { id: 'd13-01', createdAt: new Date('2026-06-13T01:00:00Z') },
      { id: 'd12-20', createdAt: new Date('2026-06-12T20:00:00Z') },
    ];
    expect(planRetention(list, NOW).sort()).toEqual(['d13-01', 'd13-09']);
  });

  test('30-day boundary: inside is daily, outside is weekly (newest per UTC week, Monday start)', () => {
    // NOW - 30d = 2026-05-16T12:00Z. Mon 2026-05-11 .. Sun 2026-05-17 is one week.
    const list = [
      { id: 'in-new', createdAt: new Date('2026-05-16T18:00:00Z') },
      { id: 'in-old', createdAt: new Date('2026-05-16T13:00:00Z') },
      { id: 'w-newest', createdAt: new Date('2026-05-16T11:00:00Z') },
      { id: 'w-mid', createdAt: new Date('2026-05-13T10:00:00Z') },
      { id: 'w-old', createdAt: new Date('2026-05-11T00:00:00Z') },
      { id: 'w2', createdAt: new Date('2026-05-08T10:00:00Z') },
      { id: 'w2b', createdAt: new Date('2026-05-04T10:00:00Z') },
    ];
    expect(planRetention(list, NOW).sort()).toEqual(['in-old', 'w-mid', 'w-old', 'w2b']);
  });

  test('hard cap of 100 drops the oldest, never the newest', () => {
    const list = [];
    for (let i = 0; i < 130; i += 1) list.push(v(`n${i}`, i * 11 * 60 * 1000)); // 23.8h span: age rules keep all
    const del = planRetention(list, NOW);
    expect(del).toHaveLength(30);
    expect(new Set(del)).toEqual(new Set(Array.from({ length: 30 }, (_, i) => `n${100 + i}`)));
  });

  test('input order does not matter and the latest is always kept', () => {
    const list = [v('old', 40 * D), v('new', 35 * D), v('newest', 34 * D + 1)];
    const del = planRetention([...list].reverse(), NOW);
    expect(del).not.toContain('newest');
  });
});
