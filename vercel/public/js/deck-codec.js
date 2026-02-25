(() => {
  const S = globalThis.BP_SHARED_CARDS || {};
  const defs = S.CARD_DEFS || {};
  const normalize = S.normalizeCardKey || ((k) => k);

  const CARD_KEYS = Object.keys(defs).sort((a, b) => a.localeCompare(b));
  const keyToIndex = new Map(CARD_KEYS.map((k, i) => [k, i]));

  function toBase64UrlBytes(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromBase64UrlBytes(input) {
    const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    const bin = atob(padded);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  function encodeV2FromCounts(counts) {
    const entries = Object.entries(counts || {})
      .filter(([, qty]) => Number.isInteger(qty) && qty > 0)
      .map(([cardId, qty]) => [normalize(cardId), qty])
      .filter(([cardId]) => keyToIndex.has(cardId))
      .sort((a, b) => a[0].localeCompare(b[0]));

    const n = entries.length;
    const bytes = new Uint8Array(3 + n * 3);
    bytes[0] = 2;
    bytes[1] = (n >> 8) & 0xff;
    bytes[2] = n & 0xff;

    let p = 3;
    for (const [cardId, qty] of entries) {
      const idx = keyToIndex.get(cardId);
      bytes[p++] = (idx >> 8) & 0xff;
      bytes[p++] = idx & 0xff;
      bytes[p++] = qty & 0xff;
    }

    return toBase64UrlBytes(bytes);
  }

  function decodeV2(code) {
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

    const deck = [];
    let p = 3;
    for (let i = 0; i < n; i += 1) {
      const idx = (bytes[p++] << 8) | bytes[p++];
      const qty = bytes[p++];
      const key = CARD_KEYS[idx];
      if (!key) return { ok: false, reason: 'UNKNOWN_CARD' };
      if (!Number.isInteger(qty) || qty < 1 || qty > 3) return { ok: false, reason: 'INVALID_COUNT' };
      for (let j = 0; j < qty; j += 1) deck.push(key);
    }
    return { ok: true, deck, version: 2 };
  }

  function decodeDeckCode(code) {
    const raw = String(code || '').trim();
    if (!raw) return { ok: false, reason: 'EMPTY' };
    return decodeV2(raw);
  }

  globalThis.BP_DECK_CODEC = {
    encodeV2FromCounts,
    decodeDeckCode
  };
})();
