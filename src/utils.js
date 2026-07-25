const XP_TABLE = (() => {
  const table = [0];
  let points = 0;
  for (let level = 1; level < 120; level += 1) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table.push(Math.floor(points / 4));
  }
  return table;
})();

export function xpForLevel(level) {
  const normalized = Math.max(1, Math.min(120, Math.floor(level)));
  return normalized <= 1 ? 0 : XP_TABLE[normalized - 1];
}

export function levelFromXp(xp, maxLevel = 99) {
  const amount = Math.max(0, Number(xp) || 0);
  let low = 0;
  let high = Math.min(maxLevel, XP_TABLE.length) - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (XP_TABLE[mid] <= amount) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(1, Math.min(maxLevel, high + 1));
}

export function levelProgress(xp, maxLevel = 99) {
  const level = levelFromXp(xp, maxLevel);
  if (level >= maxLevel) return { level, current: xp, floor: xpForLevel(level), next: null, percent: 100, remaining: 0 };
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const current = Math.max(0, xp - floor);
  return {
    level,
    current,
    floor,
    next,
    percent: clamp((current / Math.max(1, next - floor)) * 100, 0, 100),
    remaining: Math.max(0, next - xp),
  };
}

export function masteryLevelFromXp(xp) {
  return levelFromXp((Number(xp) || 0) * 1.35, 99);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function formatNumber(value, maximumFractionDigits = 0) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2).replace(/\.00$/, '')}b`;
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(2).replace(/\.00$/, '')}m`;
  if (Math.abs(amount) >= 100_000) return `${(amount / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return amount.toLocaleString(undefined, { maximumFractionDigits });
}

export function formatDuration(ms, compact = false) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (compact) {
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (!days && !hours && seconds) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return parts.slice(0, 2).join(', ') || '0 seconds';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function safeUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function hashString(input) {
  let hash = 2166136261;
  const value = String(input);
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(...parts) {
  return mulberry32(hashString(parts.join('|')));
}

export function randomInt(rng, min, max) {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function weightedChoice(rng, entries) {
  const valid = entries.filter((entry) => Number(entry.weight) > 0);
  const total = valid.reduce((sum, entry) => sum + Number(entry.weight), 0);
  if (!valid.length || total <= 0) return null;
  let roll = rng() * total;
  for (const entry of valid) {
    roll -= Number(entry.weight);
    if (roll <= 0) return entry.value;
  }
  return valid.at(-1).value;
}

export function rollBinomial(rng, trials, probability) {
  const n = Math.max(0, Math.floor(trials));
  const p = clamp(Number(probability) || 0, 0, 1);
  if (!n || !p) return 0;
  if (p >= 1) return n;
  if (n <= 2500) {
    let hits = 0;
    for (let i = 0; i < n; i += 1) if (rng() < p) hits += 1;
    return hits;
  }
  // Deterministic normal approximation for very large offline batches.
  const mean = n * p;
  const variance = n * p * (1 - p);
  const u1 = Math.max(Number.EPSILON, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return clamp(Math.round(mean + z * Math.sqrt(variance)), 0, n);
}

export function sumObject(object) {
  return Object.values(object || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function mergeQuantities(target, source, multiplier = 1) {
  for (const [id, amount] of Object.entries(source || {})) {
    target[id] = (target[id] || 0) + (Number(amount) || 0) * multiplier;
    if (target[id] === 0) delete target[id];
  }
  return target;
}

export function objectEntriesSorted(object, selector = ([key]) => key) {
  return Object.entries(object || {}).sort((a, b) => String(selector(a)).localeCompare(String(selector(b))));
}

export function shortestPath(regions, routes, from, to, edgeMultiplier = () => 1) {
  if (!regions[from] || !regions[to]) return null;
  if (from === to) return { path: [from], seconds: 0 };
  const graph = new Map(Object.keys(regions).map((id) => [id, []]));
  for (const [a, b, seconds] of routes) {
    graph.get(a)?.push({ id: b, seconds });
    graph.get(b)?.push({ id: a, seconds });
  }
  const distance = new Map(Object.keys(regions).map((id) => [id, Infinity]));
  const previous = new Map();
  const unvisited = new Set(Object.keys(regions));
  distance.set(from, 0);
  while (unvisited.size) {
    let current = null;
    let best = Infinity;
    for (const id of unvisited) {
      const candidate = distance.get(id);
      if (candidate < best) {
        current = id;
        best = candidate;
      }
    }
    if (current === null || best === Infinity) break;
    unvisited.delete(current);
    if (current === to) break;
    for (const edge of graph.get(current) || []) {
      if (!unvisited.has(edge.id)) continue;
      const adjusted = edge.seconds * Math.max(0.1, Number(edgeMultiplier(current, edge.id, edge.seconds)) || 1);
      const alt = best + adjusted;
      if (alt < distance.get(edge.id)) {
        distance.set(edge.id, alt);
        previous.set(edge.id, current);
      }
    }
  }
  if (!Number.isFinite(distance.get(to))) return null;
  const path = [to];
  while (path[0] !== from) {
    const prev = previous.get(path[0]);
    if (!prev) return null;
    path.unshift(prev);
  }
  return { path, seconds: Math.ceil(distance.get(to)) };
}

export function downloadText(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(file);
  });
}

export function nowIso(timestamp = Date.now()) {
  return new Date(timestamp).toISOString();
}

export function titleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
