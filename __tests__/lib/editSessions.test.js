/**
 * @jest-environment node
 */
// LA-3: edit-session bucketing (ADR-0006 5.3, 7): a save extends the person's open session when its last_at is less
// than 10 minutes old, else opens a new one. Pure decision; the repository applies it inside the save transaction.
import { planSession, SESSION_GAP_MS, RETENTION_DAYS, retentionCutoff } from '../../lib/activity/sessions';

const T0 = Date.parse('2026-10-21T10:00:00Z');
const min = (n) => n * 60_000;

describe('planSession', () => {
  it('opens a session when the person has none', () => {
    expect(planSession(null, new Date(T0), 5)).toEqual({ action: 'open', revisionFrom: 5, revisionTo: 5 });
  });

  it('extends a session whose last save was less than 10 minutes ago', () => {
    const open = { id: 7, last_at: new Date(T0), revision_to: 5 };
    expect(planSession(open, new Date(T0 + min(9) + 59_000), 6)).toEqual({ action: 'extend', id: 7, revisionTo: 6 });
  });

  it('opens a new one at exactly the gap and beyond', () => {
    const open = { id: 7, last_at: new Date(T0), revision_to: 5 };
    expect(planSession(open, new Date(T0 + SESSION_GAP_MS), 6).action).toBe('open');
    expect(planSession(open, new Date(T0 + min(12)), 6).action).toBe('open');
  });

  it('accepts ISO strings for last_at (as pg may return them)', () => {
    const open = { id: 1, last_at: new Date(T0).toISOString(), revision_to: 1 };
    expect(planSession(open, new Date(T0 + min(1)), 2).action).toBe('extend');
  });

  it('37 saves spread over 18 minutes (a save every 30 s) stay one session; a 12 minute pause splits it', () => {
    let open = null; const sessions = [];
    let rev = 0;
    const save = (at) => {
      rev += 1;
      const plan = planSession(open, new Date(at), rev);
      if (plan.action === 'open') { open = { id: sessions.length + 1, last_at: new Date(at), revision_to: rev }; sessions.push({ saves: 1, from: rev, to: rev }); }
      else { open = { ...open, last_at: new Date(at), revision_to: rev }; const s = sessions[open.id - 1]; s.saves += 1; s.to = rev; }
    };
    for (let i = 0; i < 37; i += 1) save(T0 + i * 30_000); // 0 .. 18 min
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual({ saves: 37, from: 1, to: 37 });
    save(T0 + min(18) + min(12));
    expect(sessions).toHaveLength(2);
    expect(sessions[1]).toEqual({ saves: 1, from: 38, to: 38 });
  });
});

describe('retention', () => {
  it('keeps edit sessions for 365 days', () => {
    expect(RETENTION_DAYS).toBe(365);
    const now = new Date('2026-10-21T00:00:00Z');
    expect(retentionCutoff(now).toISOString()).toBe('2025-10-21T00:00:00.000Z');
  });
});
