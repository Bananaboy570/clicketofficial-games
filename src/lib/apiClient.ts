// Unified API client that uses the live Express backend (/api/*) when available,
// and seamlessly falls back to browser-local persistence when hosted as a static website (e.g. GitHub Pages).

const STATIC_DB_KEY = 'clicket_static_db_v1';
const ONE_HOUR_MS = 60 * 60 * 1000;
const OWNER_IDENTIFIERS = new Set(['clicketownerofficial']);

interface StaticTradeHistoryEntry {
  id: string;
  timestamp: string;
  partnerUsername: string;
  gaveBlookId: string;
  receivedBlookId: string;
}

interface StaticStoredUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  verified: boolean;
  tokens: number;
  inventory: Record<string, number>;
  clickUpgradeLevel: number;
  bestDailyClicks: number;
  equippedBlookId: string;
  lastDailyPlayAt: number | null;
  lastWheelSpinAt: number | null;
  lastHourlyClaimAt: number | null;
  tradeHistory: StaticTradeHistoryEntry[];
  clanId: string | null;
  achievements: string[];
  createdAt: string;
}

interface StaticClanMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

interface StaticClanRecord {
  id: string;
  name: string;
  tag: string;
  description: string;
  bannerColor: string;
  emblemBlookId: string;
  leaderId: string;
  memberIds: string[];
  officerIds: string[];
  messages: StaticClanMessage[];
  createdAt: string;
}

interface StaticSetStats {
  totalPlays: number;
  uniquePlayerIds: string[];
}

interface StaticDatabase {
  users: Record<string, StaticStoredUser>;
  sessions: Record<string, string>;
  setStats: Record<string, StaticSetStats>;
  clans: Record<string, StaticClanRecord>;
}

let staticModeDetected = false;
const staticListeners = new Set<() => void>();

export function isStaticMode(): boolean {
  return staticModeDetected;
}

export function markStaticMode(): void {
  if (!staticModeDetected) {
    staticModeDetected = true;
    staticListeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // Ignore listener errors
      }
    });
  }
}

export function onStaticModeChange(listener: () => void): () => void {
  staticListeners.add(listener);
  return () => {
    staticListeners.delete(listener);
  };
}

function loadStaticDb(): StaticDatabase {
  try {
    const raw = localStorage.getItem(STATIC_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StaticDatabase>;
      return {
        users: parsed.users || {},
        sessions: parsed.sessions || {},
        setStats: parsed.setStats || {},
        clans: parsed.clans || {},
      };
    }
  } catch {
    // Ignore storage read error
  }
  const initial: StaticDatabase = { users: {}, sessions: {}, setStats: {}, clans: {} };
  saveStaticDb(initial);
  return initial;
}

function saveStaticDb(db: StaticDatabase): void {
  try {
    localStorage.setItem(STATIC_DB_KEY, JSON.stringify(db));
  } catch {
    // Ignore storage quota error
  }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function hashPasswordClient(password: string, salt?: string): Promise<string> {
  const s = salt || Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(`${s}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${s}:${hex}`;
  }
  // Simple fallback hash if crypto.subtle is unavailable
  let h = 2166136261;
  const input = `${s}:${password}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${s}:${(h >>> 0).toString(16)}`;
}

async function verifyPasswordClient(password: string, stored: string): Promise<boolean> {
  const idx = stored.indexOf(':');
  if (idx === -1) return false;
  const salt = stored.slice(0, idx);
  const candidate = await hashPasswordClient(password, salt);
  return candidate === stored;
}

function resolveAchievements(u: StaticStoredUser): string[] {
  const set = new Set<string>(Array.isArray(u.achievements) ? u.achievements : []);
  const cleanEmail = (u.email || '').trim().toLowerCase();
  const cleanUser = (u.username || '').trim().toLowerCase();
  if (OWNER_IDENTIFIERS.has(cleanEmail) || OWNER_IDENTIFIERS.has(cleanUser)) {
    set.add('owner');
    set.add('developer');
  }
  return Array.from(set).filter((a) => a === 'owner' || a === 'developer');
}

function sanitizeStaticUser(u: StaticStoredUser) {
  const safeEquipped =
    u.equippedBlookId && (u.inventory?.[u.equippedBlookId] || 0) > 0
      ? u.equippedBlookId
      : '';
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    verified: u.verified,
    tokens: u.tokens,
    inventory: u.inventory,
    clickUpgradeLevel: u.clickUpgradeLevel,
    bestDailyClicks: u.bestDailyClicks,
    equippedBlookId: safeEquipped,
    lastDailyPlayAt: u.lastDailyPlayAt ?? null,
    lastWheelSpinAt: u.lastWheelSpinAt ?? null,
    lastHourlyClaimAt: u.lastHourlyClaimAt ?? null,
    tradeHistory: (u.tradeHistory || []).slice(0, 50),
    clanId: u.clanId ?? null,
    achievements: resolveAchievements(u),
  };
}

function findUserByUsername(db: StaticDatabase, username: string): StaticStoredUser | undefined {
  const target = username.trim().toLowerCase();
  if (!target) return undefined;
  return Object.values(db.users).find((u) => u.username.trim().toLowerCase() === target);
}

function getUserByBearer(db: StaticDatabase, headers: Headers): { key: string; user: StaticStoredUser } | null {
  const authHeader = headers.get('authorization') || headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  const key = db.sessions[token];
  if (!key || !db.users[key]) return null;
  return { key, user: db.users[key] };
}

function buildStaticClanSummary(clan: StaticClanRecord, db: StaticDatabase) {
  const members = clan.memberIds
    .map((uid) => Object.values(db.users).find((u) => u.id === uid))
    .filter((u): u is StaticStoredUser => Boolean(u))
    .map((u) => {
      const uniqueBlooksCount = Object.values(u.inventory || {}).filter((c) => c > 0).length;
      const role: 'Leader' | 'Officer' | 'Member' =
        clan.leaderId === u.id
          ? 'Leader'
          : clan.officerIds.includes(u.id)
          ? 'Officer'
          : 'Member';
      return {
        id: u.id,
        username: u.username,
        equippedBlookId:
          u.equippedBlookId && (u.inventory?.[u.equippedBlookId] || 0) > 0
            ? u.equippedBlookId
            : '',
        tokens: u.tokens || 0,
        uniqueBlooksCount,
        achievements: resolveAchievements(u),
        role,
      };
    });

  members.sort((a, b) => {
    const rank = { Leader: 0, Officer: 1, Member: 2 };
    if (rank[a.role] !== rank[b.role]) return rank[a.role] - rank[b.role];
    return b.tokens - a.tokens;
  });

  const totalTokens = members.reduce((sum, m) => sum + m.tokens, 0);
  const totalUniqueBlooks = members.reduce((sum, m) => sum + m.uniqueBlooksCount, 0);
  const leader = members.find((m) => m.id === clan.leaderId);

  return {
    id: clan.id,
    name: clan.name,
    tag: clan.tag,
    description: clan.description,
    bannerColor: clan.bannerColor,
    emblemBlookId: clan.emblemBlookId,
    leaderId: clan.leaderId,
    leaderUsername: leader?.username || 'Leader',
    memberCount: members.length,
    totalTokens,
    totalUniqueBlooks,
    powerScore: totalTokens + totalUniqueBlooks * 250,
    members,
    messages: clan.messages.slice(-40),
    createdAt: clan.createdAt,
  };
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleStaticApi(input: string, init?: RequestInit): Promise<Response> {
  const url = input.split('?')[0];
  const method = (init?.method || 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  let body: Record<string, unknown> = {};
  if (typeof init?.body === 'string' && init.body.trim()) {
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  const db = loadStaticDb();

  // AUTH: SIGNUP
  if (url === '/api/auth/signup' && method === 'POST') {
    const cleanUsername = String(body.username || '').trim();
    const rawPassword = String(body.password || '');
    if (cleanUsername.length < 2 || cleanUsername.length > 30) {
      return jsonRes({ error: 'Username must be between 2 and 30 characters.' }, 400);
    }
    if (rawPassword.length < 6) {
      return jsonRes({ error: 'Password must be at least 6 characters.' }, 400);
    }
    if (findUserByUsername(db, cleanUsername)) {
      return jsonRes({ error: 'That username is already taken! Please choose another one.' }, 409);
    }
    const lowerUser = cleanUsername.toLowerCase();
    const userKey = `user:${lowerUser}`;
    const user: StaticStoredUser = {
      id: randomId(),
      username: cleanUsername,
      email: '',
      passwordHash: await hashPasswordClient(rawPassword),
      verified: true,
      tokens: 20,
      inventory: {},
      clickUpgradeLevel: 0,
      bestDailyClicks: 0,
      equippedBlookId: '',
      lastDailyPlayAt: null,
      lastWheelSpinAt: null,
      lastHourlyClaimAt: null,
      tradeHistory: [],
      clanId: null,
      achievements: [],
      createdAt: new Date().toISOString(),
    };
    user.achievements = resolveAchievements(user);
    db.users[userKey] = user;
    const sessionToken = randomId() + randomId();
    db.sessions[sessionToken] = userKey;
    saveStaticDb(db);
    return jsonRes({ ok: true, sessionToken, user: sanitizeStaticUser(user) });
  }

  // AUTH: LOGIN
  if (url === '/api/auth/login' && method === 'POST') {
    const identifier = String(body.username || body.email || '').trim().toLowerCase();
    const rawPassword = String(body.password || '');
    if (!identifier || !rawPassword) {
      return jsonRes({ error: 'Please enter both username and password.' }, 400);
    }
    const entry = Object.entries(db.users).find(
      ([, u]) =>
        u.username.trim().toLowerCase() === identifier ||
        (u.email && u.email.trim().toLowerCase() === identifier)
    );
    if (!entry || !(await verifyPasswordClient(rawPassword, entry[1].passwordHash))) {
      return jsonRes({ error: 'Invalid username or password.' }, 401);
    }
    entry[1].achievements = resolveAchievements(entry[1]);
    const sessionToken = randomId() + randomId();
    db.sessions[sessionToken] = entry[0];
    saveStaticDb(db);
    return jsonRes({ ok: true, sessionToken, user: sanitizeStaticUser(entry[1]) });
  }

  // AUTH: ME
  if (url === '/api/auth/me' && method === 'GET') {
    const auth = getUserByBearer(db, headers);
    if (!auth) return jsonRes({ error: 'Session expired' }, 401);
    return jsonRes({ user: sanitizeStaticUser(auth.user) });
  }

  // AUTH: LOGOUT
  if (url === '/api/auth/logout' && method === 'POST') {
    const authHeader = headers.get('authorization') || headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token && db.sessions[token]) {
      delete db.sessions[token];
      saveStaticDb(db);
    }
    return jsonRes({ ok: true });
  }

  // USER: RENAME
  if (url === '/api/user/rename' && method === 'POST') {
    const auth = getUserByBearer(db, headers);
    if (!auth) return jsonRes({ error: 'Not authenticated' }, 401);
    const cleanUsername = String(body.username || '').trim();
    if (cleanUsername.length < 2 || cleanUsername.length > 30) {
      return jsonRes({ error: 'Username must be between 2 and 30 characters.' }, 400);
    }
    const existing = findUserByUsername(db, cleanUsername);
    if (existing && existing.id !== auth.user.id) {
      return jsonRes({ error: 'That username is already taken! Please choose another one.' }, 409);
    }
    auth.user.username = cleanUsername;
    saveStaticDb(db);
    return jsonRes({ ok: true, user: sanitizeStaticUser(auth.user) });
  }

  // USER: SYNC
  if (url === '/api/user/sync' && method === 'POST') {
    const auth = getUserByBearer(db, headers);
    if (!auth) return jsonRes({ error: 'Not authenticated' }, 401);
    const { user } = auth;
    if (typeof body.tokens === 'number' && Number.isFinite(body.tokens) && body.tokens >= 0) {
      user.tokens = Math.floor(body.tokens);
    }
    if (body.inventory && typeof body.inventory === 'object') {
      user.inventory = body.inventory as Record<string, number>;
    }
    if (
      typeof body.clickUpgradeLevel === 'number' &&
      Number.isFinite(body.clickUpgradeLevel) &&
      body.clickUpgradeLevel >= 0
    ) {
      user.clickUpgradeLevel = Math.floor(body.clickUpgradeLevel);
    }
    if (
      typeof body.bestDailyClicks === 'number' &&
      Number.isFinite(body.bestDailyClicks) &&
      body.bestDailyClicks >= 0
    ) {
      user.bestDailyClicks = Math.max(user.bestDailyClicks, Math.floor(body.bestDailyClicks));
    }
    if (typeof body.equippedBlookId === 'string') {
      user.equippedBlookId = body.equippedBlookId;
    }
    if (typeof body.lastDailyPlayAt === 'number' || body.lastDailyPlayAt === null) {
      user.lastDailyPlayAt = body.lastDailyPlayAt as number | null;
    }
    if (typeof body.lastWheelSpinAt === 'number' || body.lastWheelSpinAt === null) {
      user.lastWheelSpinAt = body.lastWheelSpinAt as number | null;
    }
    saveStaticDb(db);
    return jsonRes({ ok: true, user: sanitizeStaticUser(user) });
  }

  // REWARDS: HOURLY
  if (url === '/api/rewards/hourly' && method === 'POST') {
    const auth = getUserByBearer(db, headers);
    if (!auth) return jsonRes({ error: 'Not authenticated' }, 401);
    const now = Date.now();
    const lastClaim = auth.user.lastHourlyClaimAt ?? 0;
    const elapsed = now - lastClaim;
    if (lastClaim > 0 && elapsed < ONE_HOUR_MS) {
      return jsonRes(
        {
          error: 'Hourly Reward is still on cooldown.',
          remainingMs: ONE_HOUR_MS - elapsed,
          lastHourlyClaimAt: lastClaim,
        },
        429
      );
    }
    const reward = 300 + Math.floor(Math.random() * 121) * 5;
    auth.user.tokens = (auth.user.tokens || 0) + reward;
    auth.user.lastHourlyClaimAt = now;
    saveStaticDb(db);
    return jsonRes({
      ok: true,
      reward,
      tokens: auth.user.tokens,
      lastHourlyClaimAt: now,
    });
  }

  // SETS: STATS
  if (url === '/api/sets/stats' && method === 'GET') {
    const summary: Record<string, { uniquePlayers: number; totalPlays: number }> = {};
    for (const [setId, stat] of Object.entries(db.setStats || {})) {
      summary[setId] = {
        uniquePlayers: stat.uniquePlayerIds.length,
        totalPlays: stat.totalPlays,
      };
    }
    return jsonRes({ stats: summary });
  }

  // SETS: PLAY
  const setPlayMatch = url.match(/^\/api\/sets\/([^/]+)\/play$/);
  if (setPlayMatch && method === 'POST') {
    const setId = decodeURIComponent(setPlayMatch[1]);
    const auth = getUserByBearer(db, headers);
    const playerId = auth?.user.id || 'guest';
    if (!db.setStats[setId]) {
      db.setStats[setId] = { totalPlays: 0, uniquePlayerIds: [] };
    }
    db.setStats[setId].totalPlays += 1;
    if (!db.setStats[setId].uniquePlayerIds.includes(playerId)) {
      db.setStats[setId].uniquePlayerIds.push(playerId);
    }
    saveStaticDb(db);
    return jsonRes({
      ok: true,
      setId,
      uniquePlayers: db.setStats[setId].uniquePlayerIds.length,
      totalPlays: db.setStats[setId].totalPlays,
    });
  }

  // CLANS: LIST
  if (url === '/api/clans' && method === 'GET') {
    const list = Object.values(db.clans || {})
      .map((c) => buildStaticClanSummary(c, db))
      .filter((c) => c.memberCount > 0)
      .sort((a, b) => b.powerScore - a.powerScore);
    return jsonRes({ clans: list });
  }

  // CLANS: CREATE
  if (url === '/api/clans/create' && method === 'POST') {
    const auth = getUserByBearer(db, headers);
    if (!auth) return jsonRes({ error: 'Not authenticated' }, 401);
    const { user } = auth;
    if (user.clanId && db.clans[user.clanId]) {
      return jsonRes({ error: 'Leave your current clan before creating a new one.' }, 400);
    }
    const name = String(body.name || '').trim();
    const tag = String(body.tag || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const description = String(body.description || '').trim().slice(0, 140);
    const bannerColor = /^#[0-9a-fA-F]{6}$/.test(String(body.bannerColor || ''))
      ? String(body.bannerColor)
      : '#dc2626';
    const emblemBlookId = String(body.emblemBlookId || 'jester').trim() || 'jester';
    if (name.length < 2 || name.length > 24) {
      return jsonRes({ error: 'Clan name must be between 2 and 24 characters.' }, 400);
    }
    if (tag.length < 2 || tag.length > 5) {
      return jsonRes({ error: 'Clan tag must be 2 to 5 letters/numbers.' }, 400);
    }
    const duplicate = Object.values(db.clans).find(
      (c) => c.name.toLowerCase() === name.toLowerCase() || c.tag.toLowerCase() === tag.toLowerCase()
    );
    if (duplicate) {
      return jsonRes({ error: 'A clan with that name or tag already exists!' }, 409);
    }
    const clanId = randomId();
    const clan: StaticClanRecord = {
      id: clanId,
      name,
      tag,
      description: description || 'Welcome to our CLICKET clan!',
      bannerColor,
      emblemBlookId,
      leaderId: user.id,
      memberIds: [user.id],
      officerIds: [],
      messages: [
        {
          id: randomId(),
          userId: user.id,
          username: user.username,
          text: `Founded [${tag}] ${name}!`,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };
    db.clans[clanId] = clan;
    user.clanId = clanId;
    saveStaticDb(db);
    return jsonRes({ ok: true, clan: buildStaticClanSummary(clan, db) });
  }

  // CLANS: LEAVE
  if (url === '/api/clans/leave' && method === 'POST') {
    const auth = getUserByBearer(db, headers);
    if (!auth) return jsonRes({ error: 'Not authenticated' }, 401);
    const { user } = auth;
    const clanId = user.clanId;
    if (!clanId || !db.clans[clanId]) {
      user.clanId = null;
      saveStaticDb(db);
      return jsonRes({ ok: true });
    }
    const clan = db.clans[clanId];
    clan.memberIds = clan.memberIds.filter((id) => id !== user.id);
    clan.officerIds = clan.officerIds.filter((id) => id !== user.id);
    user.clanId = null;
    if (clan.memberIds.length === 0) {
      delete db.clans[clanId];
    } else if (clan.leaderId === user.id) {
      clan.leaderId = clan.officerIds[0] || clan.memberIds[0];
      clan.officerIds = clan.officerIds.filter((id) => id !== clan.leaderId);
    }
    saveStaticDb(db);
    return jsonRes({ ok: true });
  }

  // CLANS: JOIN / MESSAGE / KICK / ROLE / UPDATE
  const clanActionMatch = url.match(/^\/api\/clans\/([^/]+)\/(join|message|kick|role|update)$/);
  if (clanActionMatch && method === 'POST') {
    const auth = getUserByBearer(db, headers);
    if (!auth) return jsonRes({ error: 'Not authenticated' }, 401);
    const { user } = auth;
    const clanId = decodeURIComponent(clanActionMatch[1]);
    const action = clanActionMatch[2];
    const clan = db.clans[clanId];
    if (!clan) return jsonRes({ error: 'Clan not found.' }, 404);

    if (action === 'join') {
      if (user.clanId && db.clans[user.clanId] && user.clanId !== clanId) {
        return jsonRes({ error: 'Leave your current clan first.' }, 400);
      }
      if (!clan.memberIds.includes(user.id)) {
        if (clan.memberIds.length >= 30) {
          return jsonRes({ error: 'This clan is full (30/30 members).' }, 400);
        }
        clan.memberIds.push(user.id);
        clan.messages.push({
          id: randomId(),
          userId: user.id,
          username: user.username,
          text: `${user.username} joined the clan!`,
          createdAt: new Date().toISOString(),
        });
      }
      user.clanId = clanId;
      saveStaticDb(db);
      return jsonRes({ ok: true, clan: buildStaticClanSummary(clan, db) });
    }

    if (action === 'message') {
      if (!clan.memberIds.includes(user.id)) {
        return jsonRes({ error: 'Join this clan to chat.' }, 403);
      }
      const text = String(body.text || '').trim().slice(0, 220);
      if (!text) return jsonRes({ error: 'Message cannot be empty.' }, 400);
      clan.messages.push({
        id: randomId(),
        userId: user.id,
        username: user.username,
        text,
        createdAt: new Date().toISOString(),
      });
      if (clan.messages.length > 60) clan.messages = clan.messages.slice(-60);
      saveStaticDb(db);
      return jsonRes({ ok: true, messages: clan.messages.slice(-40) });
    }

    if (action === 'kick') {
      const targetUserId = String(body.targetUserId || '').trim();
      const isLeader = clan.leaderId === user.id;
      const isOfficer = clan.officerIds.includes(user.id);
      if (!isLeader && !isOfficer) {
        return jsonRes({ error: 'Only Leaders or Officers can remove members.' }, 403);
      }
      if (targetUserId === clan.leaderId) {
        return jsonRes({ error: 'Cannot kick the Clan Leader.' }, 400);
      }
      clan.memberIds = clan.memberIds.filter((id) => id !== targetUserId);
      clan.officerIds = clan.officerIds.filter((id) => id !== targetUserId);
      const target = Object.values(db.users).find((u) => u.id === targetUserId);
      if (target) target.clanId = null;
      saveStaticDb(db);
      return jsonRes({ ok: true, clan: buildStaticClanSummary(clan, db) });
    }

    if (action === 'role') {
      if (clan.leaderId !== user.id) {
        return jsonRes({ error: 'Only the Clan Leader can change member roles.' }, 403);
      }
      const targetUserId = String(body.targetUserId || '').trim();
      const role = String(body.role || '');
      if (!clan.memberIds.includes(targetUserId) || targetUserId === clan.leaderId) {
        return jsonRes({ error: 'Invalid member.' }, 400);
      }
      if (role === 'Officer') {
        if (!clan.officerIds.includes(targetUserId)) clan.officerIds.push(targetUserId);
      } else {
        clan.officerIds = clan.officerIds.filter((id) => id !== targetUserId);
      }
      saveStaticDb(db);
      return jsonRes({ ok: true, clan: buildStaticClanSummary(clan, db) });
    }

    if (action === 'update') {
      if (clan.leaderId !== user.id) {
        return jsonRes({ error: 'Only the clan leader can edit clan settings.' }, 403);
      }
      if (typeof body.description === 'string') {
        clan.description = body.description.trim().slice(0, 140);
      }
      if (typeof body.bannerColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.bannerColor)) {
        clan.bannerColor = body.bannerColor;
      }
      if (typeof body.emblemBlookId === 'string' && body.emblemBlookId.trim()) {
        clan.emblemBlookId = body.emblemBlookId.trim();
      }
      saveStaticDb(db);
      return jsonRes({ ok: true, clan: buildStaticClanSummary(clan, db) });
    }
  }

  // ACHIEVEMENTS: GRANT
  if (url === '/api/achievements/grant' && method === 'POST') {
    const auth = getUserByBearer(db, headers);
    if (!auth) return jsonRes({ error: 'Not authenticated' }, 401);
    const callerAchievements = resolveAchievements(auth.user);
    if (!callerAchievements.includes('owner')) {
      return jsonRes({ error: 'Only an Owner can grant Owner or Developer achievements.' }, 403);
    }
    const targetUsername = String(body.username || '').trim();
    const achievementId = String(body.achievementId || '').trim();
    const grant = body.grant !== false;
    if (achievementId !== 'owner' && achievementId !== 'developer') {
      return jsonRes({ error: 'Invalid achievement ID.' }, 400);
    }
    const targetUser = findUserByUsername(db, targetUsername);
    if (!targetUser) {
      return jsonRes({ error: `No player found with username "${targetUsername}".` }, 404);
    }
    const current = new Set(resolveAchievements(targetUser));
    if (grant) current.add(achievementId);
    else current.delete(achievementId);
    targetUser.achievements = Array.from(current);
    saveStaticDb(db);
    return jsonRes({
      ok: true,
      targetUsername: targetUser.username,
      targetAchievements: resolveAchievements(targetUser),
      selfUser: targetUser.id === auth.user.id ? sanitizeStaticUser(targetUser) : undefined,
    });
  }

  return jsonRes({ error: 'Endpoint unavailable in static mode.' }, 404);
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  if (staticModeDetected) {
    return handleStaticApi(input, init);
  }

  try {
    const res = await window.fetch(input, init);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const isJsonResponse = contentType.includes('application/json');

    // On GitHub Pages or any static file server, /api/* returns HTML or non-JSON 404/405
    if (!isJsonResponse && (contentType.includes('text/html') || res.status === 404 || res.status === 405)) {
      markStaticMode();
      return handleStaticApi(input, init);
    }

    return res;
  } catch {
    // Network error reaching /api/* -> switch cleanly to static browser-local mode
    markStaticMode();
    return handleStaticApi(input, init);
  }
}
