function loadKV() {
  try {
    const mod = require('@vercel/kv');
    return mod && mod.kv ? mod.kv : null;
  } catch {
    return null;
  }
}

function canUseKV(kv) {
  if (!kv) return false;
  try {
    const hasFns = typeof kv.get === 'function' && typeof kv.set === 'function';
    const hasEnv = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
    return !!(hasFns && hasEnv);
  } catch {
    return false;
  }
}

async function tryKV(fn, fallback) {
  try {
    return await fn();
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

module.exports = { loadKV, canUseKV, tryKV };
