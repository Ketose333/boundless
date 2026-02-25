const { loadKV, canUseKV, tryKV } = require('./kv-safe');

const kv = loadKV();
const mem = globalThis.__tcg_deck_hub_store || {
  list: [],
  byId: new Map()
};
globalThis.__tcg_deck_hub_store = mem;

const LIST_KEY = 'tcg:deckhub:list';
const ITEM_PREFIX = 'tcg:deckhub:item:';

function hasKV() {
  return canUseKV(kv);
}

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 8);
}

async function getHubList() {
  const raw = hasKV()
    ? await tryKV(() => kv.get(LIST_KEY), () => mem.list)
    : mem.list;
  return Array.isArray(raw) ? raw : [];
}

async function setHubList(list) {
  const safeList = Array.isArray(list) ? list : [];
  if (hasKV()) {
    await tryKV(() => kv.set(LIST_KEY, safeList), () => { mem.list = safeList; });
    return;
  }
  mem.list = safeList;
}

async function getDeckPost(id) {
  if (!id) return null;
  const key = ITEM_PREFIX + id;
  if (hasKV()) return tryKV(() => kv.get(key), () => mem.byId.get(id) || null);
  return mem.byId.get(id) || null;
}

async function setDeckPost(post) {
  const key = ITEM_PREFIX + post.id;
  if (hasKV()) {
    await tryKV(() => kv.set(key, post), () => mem.byId.set(post.id, post));
    return;
  }
  mem.byId.set(post.id, post);
}

async function createDeckPost({ title, description, author, code, cardsCount, tags = [] }) {
  const id = makeId();
  const now = nowIso();
  const post = {
    id,
    title: String(title || '').trim(),
    description: String(description || '').trim(),
    author: String(author || '').trim(),
    code: String(code || '').trim(),
    cardsCount: Number(cardsCount) || 0,
    tags: normalizeTags(tags),
    
    imports: 0,
    createdAt: now,
    updatedAt: now
  };

  await setDeckPost(post);
  const list = await getHubList();
  const nextList = Array.isArray(list) ? list.slice() : [];
  nextList.unshift({ id: post.id, createdAt: post.createdAt });
  await setHubList(nextList.slice(0, 500));
  return post;
}

async function listDeckPosts({ q = '', sort = 'latest', limit = 30, offset = 0 }) {
  const refs = await getHubList();
  const ids = (Array.isArray(refs) ? refs : [])
    .map((r) => (r && typeof r === 'object' ? r.id : null))
    .filter(Boolean);

  const rows = [];
  for (const id of ids) {
    const item = await getDeckPost(id);
    if (item && typeof item === 'object') rows.push(item);
  }

  const qq = String(q || '').trim().toLowerCase();
  let filtered = rows;
  if (qq) {
    filtered = rows.filter((r) =>
      String(r.title || '').toLowerCase().includes(qq) ||
      String(r.author || '').toLowerCase().includes(qq) ||
      String(r.description || '').toLowerCase().includes(qq) ||
      (Array.isArray(r.tags) ? r.tags : []).some((t) => String(t).toLowerCase().includes(qq))
    );
  }

  if (sort === 'imports') {
    filtered.sort((a, b) => (b.imports - a.imports) || b.createdAt.localeCompare(a.createdAt));
  } else {
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);
  return { total, items: page };
}

async function deleteDeckPost(id) {
  const post = await getDeckPost(id);
  if (!post) return false;

  const key = ITEM_PREFIX + id;
  if (hasKV()) {
    await tryKV(() => kv.del(key), () => mem.byId.delete(id));
  } else {
    mem.byId.delete(id);
  }

  const refs = await getHubList();
  const next = (Array.isArray(refs) ? refs : []).filter((r) => String((r && r.id) || '') !== String(id));
  await setHubList(next);
  return true;
}

async function bumpMetric(id, field) {
  const post = await getDeckPost(id);
  if (!post) return null;
  const next = { ...post, [field]: (Number(post[field]) || 0) + 1, updatedAt: nowIso() };
  await setDeckPost(next);
  return next;
}

module.exports = {
  createDeckPost,
  listDeckPosts,
  getDeckPost,
  deleteDeckPost,
  bumpMetric
};
