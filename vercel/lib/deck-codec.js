function fromBase64UrlBytes(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

function decodeV2Summary(code) {
  const raw = String(code || '').trim();
  let bytes;
  try {
    bytes = fromBase64UrlBytes(raw);
  } catch {
    return { ok: false, reason: 'INVALID_FORMAT' };
  }

  if (!bytes || bytes.length < 3 || bytes[0] !== 2) return { ok: false, reason: 'INVALID_FORMAT' };
  const n = (bytes[1] << 8) | bytes[2];
  if (bytes.length !== 3 + n * 3) return { ok: false, reason: 'INVALID_CARDS' };

  let total = 0;
  let p = 3;
  for (let i = 0; i < n; i += 1) {
    const idx = (bytes[p++] << 8) | bytes[p++];
    const qty = bytes[p++];
    if (!Number.isInteger(idx) || idx < 0) return { ok: false, reason: 'INVALID_CARDS' };
    if (!Number.isInteger(qty) || qty < 1 || qty > 3) return { ok: false, reason: 'INVALID_CARDS' };
    total += qty;
  }

  if (total < 30) return { ok: false, reason: 'DECK_MIN' };
  return { ok: true, total, version: 2 };
}

function decodeDeckCodeSummary(code) {
  const raw = String(code || '').trim();
  if (!raw) return { ok: false, reason: 'EMPTY' };
  return decodeV2Summary(raw);
}

module.exports = { decodeDeckCodeSummary };
