type BucketState = {
  hits: number[];
  lockUntilMs: number;
  backoffUntilMs: number;
};

const buckets = new Map<string, BucketState>();

function getState(key: string): BucketState {
  const state = buckets.get(key);
  if (state) return state;
  const next: BucketState = { hits: [], lockUntilMs: 0, backoffUntilMs: 0 };
  buckets.set(key, next);
  return next;
}

export function checkLoginLimits(key: string, nowMs = Date.now()) {
  const state = getState(key);

  if (state.lockUntilMs > nowMs) {
    return { ok: false, reason: "locked" as const, retryAfterMs: state.lockUntilMs - nowMs };
  }

  if (state.backoffUntilMs > nowMs) {
    return { ok: false, reason: "backoff" as const, retryAfterMs: state.backoffUntilMs - nowMs };
  }

  return { ok: true, reason: "ok" as const, retryAfterMs: 0 };
}

function getBackoffMs(fails: number) {
  if (fails < 3) return 0;
  if (fails === 3) return 2000;
  if (fails === 4) return 5000;
  if (fails === 5) return 10000;
  return 20000;
}

function getLockMs(fails: number) {
  if (fails >= 8) return 30 * 60 * 1000;
  if (fails >= 5) return 15 * 60 * 1000;
  return 0;
}

export function registerLoginFailure(key: string, windowMs = 15 * 60 * 1000, nowMs = Date.now()) {
  const state = getState(key);
  state.hits = state.hits.filter((t) => nowMs - t <= windowMs);
  state.hits.push(nowMs);

  const fails = state.hits.length;
  const lockMs = getLockMs(fails);
  if (lockMs > 0) {
    state.lockUntilMs = nowMs + lockMs;
    state.backoffUntilMs = state.lockUntilMs;
    return { retryAfterMs: lockMs, locked: true };
  }

  const backoffMs = getBackoffMs(fails);
  if (backoffMs > 0) {
    state.backoffUntilMs = nowMs + backoffMs;
  }

  return { retryAfterMs: backoffMs, locked: false };
}

export function clearLoginFailures(key: string) {
  buckets.delete(key);
}
