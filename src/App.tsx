import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Briefcase,
  Store,
  Compass,
  PenSquare,
  List,
  Star,
  History,
  FileText,
  Settings,
  Newspaper,
  ChevronDown,
  Lock,
  Sparkles,
  Check,
  Plus,
  Trash2,
  MousePointerClick,
  LogOut,
  ArrowLeftRight,
  User,
  Handshake,
  X,
  Shield,
  Trophy,
} from 'lucide-react';
import {
  CIRCUS_PACK,
  ATHLETES_PACK,
  CIRCUS_BLOOKS,
  ATHLETES_BLOOKS,
  ALL_BLOOKS,
  BAZAAR_RECIPES,
  RARITY_COLORS,
  BlookItem,
  BazaarRecipe,
  PackInfo,
  Rarity,
  rollBlookFromPack,
} from './data/blooks';
import { BlookArt, BlooketTokenIcon } from './components/BlookArt';
import {
  PackCoverArt,
  MarketShopkeeperBooth,
  CircusClownFaceIcon,
  AthletesSoccerBallIcon,
} from './components/PackCoverArt';
import { PackRevealModal, PackPullResult } from './components/PackRevealModal';
import {
  DEFAULT_TRIVIA_QUESTIONS,
  TriviaQuestion,
} from './components/PlayTriviaView';
import { PlayLobbyAndGame } from './components/PlayLobbyAndGame';
import { AuthScreen, AuthenticatedUser, TradeHistoryItem } from './components/AuthScreen';
import { DailyClickerView } from './components/DailyClickerView';
import {
  HourlyTokenDropOverlay,
  HourlyTokenBurst,
} from './components/HourlyTokenDropOverlay';
import {
  TradingView,
  OnlinePlayerSummary,
  LiveTradeSession,
  TradeCompletedNotice,
} from './components/TradingView';
import { ClansView } from './components/ClansView';
import {
  AchievementsView,
  OwnerAchievementIcon,
  DeveloperAchievementIcon,
} from './components/AchievementsView';
import { apiFetch, isStaticMode, onStaticModeChange } from './lib/apiClient';

const OWNER_USERNAME = 'clicketownerofficial';

type ActiveTab =
  | 'Play'
  | 'Daily'
  | 'Blooks'
  | 'Market'
  | 'Bazaar'
  | 'Trading'
  | 'Clans'
  | 'Achievements'
  | 'Discover'
  | 'Set Creator'
  | 'My Sets'
  | 'Favorites';

interface PullHistoryEntry {
  id: string;
  blook: BlookItem;
  isNew: boolean;
  timestamp: string;
}

export default function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    localStorage.getItem('clicket_session_token')
  );
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('Market');

  const [tokens, setTokens] = useState<number>(20);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [clickUpgradeLevel, setClickUpgradeLevel] = useState<number>(0);
  const [bestDailyClicks, setBestDailyClicks] = useState<number>(0);
  const [lastDailyPlayAt, setLastDailyPlayAt] = useState<number | null>(null);
  const [lastWheelSpinAt, setLastWheelSpinAt] = useState<number | null>(null);
  const [lastHourlyClaimAt, setLastHourlyClaimAt] = useState<number | null>(null);
  const tokenCounterRef = useRef<HTMLDivElement | null>(null);
  const [hourlyTokenBurst, setHourlyTokenBurst] = useState<HourlyTokenBurst | null>(null);
  const [tokenDisplayOverride, setTokenDisplayOverride] = useState<number | null>(null);
  const [tokenPillPulse, setTokenPillPulse] = useState<boolean>(false);
  const tokenPillPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [username, setUsername] = useState<string>('Player');
  const [equippedBlookId, setEquippedBlookId] = useState<string>('');
  const [activeSetId, setActiveSetId] = useState<string>('circus-official');
  const [activeSetTitle, setActiveSetTitle] = useState<string>('Official Circus Pack Trivia');
  const [setStats, setSetStats] = useState<
    Record<string, { uniquePlayers: number; totalPlays: number }>
  >({});

  // Pop-up pack purchase state (only shown when clicking a pack)
  const [purchaseModalPack, setPurchaseModalPack] = useState<PackInfo | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState<number>(1);
  const [marketNotice, setMarketNotice] = useState<string | null>(null);

  // Bazaar state
  const [bazaarFilter, setBazaarFilter] = useState<'All' | Rarity>('All');
  const [bazaarNotice, setBazaarNotice] = useState<{
    text: string;
    targetBlook: BlookItem;
  } | null>(null);

  // Real-time online presence & 1-to-1 Trading state
  const presenceWsRef = useRef<WebSocket | null>(null);
  const [presenceClientId, setPresenceClientId] = useState<string | null>(null);
  const [presenceConnected, setPresenceConnected] = useState<boolean>(false);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayerSummary[]>([]);
  const [activeTrade, setActiveTrade] = useState<LiveTradeSession | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeNotice, setTradeNotice] = useState<TradeCompletedNotice | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);

  const [revealState, setRevealState] = useState<{
    pack: PackInfo;
    pulls: PackPullResult[];
  } | null>(null);

  const [selectedBlook, setSelectedBlook] = useState<BlookItem>(CIRCUS_BLOOKS[0]);
  const [showCircusSheetModal, setShowCircusSheetModal] = useState(false);
  const [showcasePackTab, setShowcasePackTab] = useState<'circus' | 'athletes'>('circus');
  const [pullHistory, setPullHistory] = useState<PullHistoryEntry[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [luckMultiplier, setLuckMultiplier] = useState<number>(1);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameLoading, setRenameLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [questions, setQuestions] = useState<TriviaQuestion[]>(DEFAULT_TRIVIA_QUESTIONS);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptions, setNewOptions] = useState<[string, string, string, string]>([
    '',
    '',
    '',
    '',
  ]);
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);
  const [favoriteSetIds, setFavoriteSetIds] = useState<string[]>(['circus-official']);

  const hydrateFromUser = useCallback((user: AuthenticatedUser) => {
    const inv = user.inventory || {};
    const validEquipped =
      user.equippedBlookId && (inv[user.equippedBlookId] || 0) > 0
        ? user.equippedBlookId
        : '';
    setCurrentUser(user);
    setUsername(user.username);
    setTokens(user.tokens);
    setInventory(inv);
    setClickUpgradeLevel(user.clickUpgradeLevel || 0);
    setBestDailyClicks(user.bestDailyClicks || 0);
    setEquippedBlookId(validEquipped);
    setLastDailyPlayAt(user.lastDailyPlayAt ?? null);
    setLastWheelSpinAt(user.lastWheelSpinAt ?? null);
    setLastHourlyClaimAt(user.lastHourlyClaimAt ?? null);
    setTradeHistory(Array.isArray(user.tradeHistory) ? user.tradeHistory : []);
  }, []);

  const refreshSetStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/sets/stats');
      if (res.ok) {
        const data = await res.json();
        setSetStats(data.stats || {});
      }
    } catch {
      // Ignore transient stats refresh failure
    }
  }, []);

  const refreshUserFromServer = useCallback(async () => {
    const savedToken = localStorage.getItem('clicket_session_token');
    if (!savedToken) return;
    try {
      const res = await apiFetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) hydrateFromUser(data.user);
      }
    } catch {
      // Ignore
    }
    refreshSetStats();
  }, [hydrateFromUser, refreshSetStats]);

  const recordSetPlay = useCallback(
    async (setId: string) => {
      try {
        const res = await apiFetch(`/api/sets/${encodeURIComponent(setId)}/play`, {
          method: 'POST',
          headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setSetStats((prev) => ({
            ...prev,
            [setId]: {
              uniquePlayers: data.uniquePlayers ?? prev[setId]?.uniquePlayers ?? 0,
              totalPlays: data.totalPlays ?? prev[setId]?.totalPlays ?? 0,
            },
          }));
        }
      } catch {
        // Ignore
      }
    },
    [sessionToken]
  );

  // Verify stored session on mount & fetch real Discover set stats
  useEffect(() => {
    refreshSetStats();
    let active = true;
    const verifySession = async () => {
      const savedToken = localStorage.getItem('clicket_session_token');
      if (!savedToken) {
        if (active) setCheckingAuth(false);
        return;
      }

      try {
        const res = await apiFetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (!res.ok) {
          localStorage.removeItem('clicket_session_token');
          if (active) {
            setSessionToken(null);
            setCurrentUser(null);
          }
        } else {
          const data = await res.json();
          if (active && data.user) {
            hydrateFromUser(data.user);
          }
        }
      } catch {
        // Keep session offline if transient
      } finally {
        if (active) setCheckingAuth(false);
      }
    };

    verifySession();
    return () => {
      active = false;
    };
  }, [hydrateFromUser, refreshSetStats]);

  // Debounced sync to backend whenever player state changes
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!currentUser || !sessionToken) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      apiFetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          username,
          tokens,
          inventory,
          clickUpgradeLevel,
          bestDailyClicks,
          equippedBlookId,
          lastDailyPlayAt,
          lastWheelSpinAt,
        }),
      }).catch(() => {
        // Ignore silent sync retry
      });
    }, 250);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [
    currentUser,
    sessionToken,
    username,
    tokens,
    inventory,
    clickUpgradeLevel,
    bestDailyClicks,
    equippedBlookId,
    lastDailyPlayAt,
    lastWheelSpinAt,
  ]);

  // Persistent live WebSocket connection for online players & 1-to-1 Blook trading
  const presencePayloadRef = useRef({
    userId: '',
    username: '',
    avatarBlookId: '',
    inventory: {} as Record<string, number>,
  });
  presencePayloadRef.current = {
    userId: currentUser?.id || '',
    username,
    avatarBlookId: equippedBlookId && (inventory[equippedBlookId] || 0) > 0 ? equippedBlookId : '',
    inventory,
  };

  useEffect(() => {
    if (!currentUser || isStaticMode()) {
      if (presenceWsRef.current) {
        presenceWsRef.current.close();
        presenceWsRef.current = null;
      }
      setPresenceConnected(false);
      setPresenceClientId(null);
      setOnlinePlayers([]);
      setActiveTrade(null);
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribeStatic = onStaticModeChange(() => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (presenceWsRef.current) {
        presenceWsRef.current.close();
        presenceWsRef.current = null;
      }
      setPresenceConnected(false);
    });

    const connectPresence = () => {
      if (cancelled || isStaticMode()) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      presenceWsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        setPresenceConnected(true);
        ws.send(
          JSON.stringify({
            type: 'presence:register',
            ...presencePayloadRef.current,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ws:connected') {
            setPresenceClientId(msg.clientId || null);
          } else if (msg.type === 'presence:list') {
            setOnlinePlayers(Array.isArray(msg.players) ? msg.players : []);
          } else if (msg.type === 'trade:incoming' || msg.type === 'trade:state') {
            setActiveTrade(msg.trade || null);
            setTradeError(null);
          } else if (msg.type === 'trade:error') {
            setTradeError(msg.error || 'Trade error.');
          } else if (msg.type === 'trade:cancelled') {
            setActiveTrade(null);
            setTradeError(msg.reason || 'Trade was cancelled.');
            setTimeout(() => setTradeError(null), 4000);
          } else if (msg.type === 'trade:completed') {
            setActiveTrade(null);
            setTradeError(null);
            if (msg.inventory && typeof msg.inventory === 'object') {
              setInventory(msg.inventory);
            }
            if (typeof msg.equippedBlookId === 'string') {
              setEquippedBlookId(msg.equippedBlookId);
            }
            setTradeNotice({
              gaveBlookId: msg.gaveBlookId,
              receivedBlookId: msg.receivedBlookId,
              partnerUsername: msg.partnerUsername,
            });
            if (msg.historyEntry && typeof msg.historyEntry === 'object') {
              setTradeHistory((prev) =>
                [msg.historyEntry, ...prev.filter((t) => t.id !== msg.historyEntry.id)].slice(0, 50)
              );
            }
          }
        } catch {
          // Ignore malformed WS messages
        }
      };

      ws.onclose = () => {
        setPresenceConnected(false);
        if (!cancelled && !isStaticMode()) {
          reconnectTimer = setTimeout(connectPresence, 3000);
        }
      };
    };

    connectPresence();

    return () => {
      cancelled = true;
      unsubscribeStatic();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (presenceWsRef.current) {
        presenceWsRef.current.close();
        presenceWsRef.current = null;
      }
    };
  }, [currentUser?.id]);

  // Keep live presence inventory & avatar updated whenever player's profile changes
  useEffect(() => {
    const ws = presenceWsRef.current;
    if (!currentUser || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: 'presence:update',
        ...presencePayloadRef.current,
      })
    );
  }, [currentUser, username, inventory, equippedBlookId]);

  const sendPresenceWs = (payload: Record<string, unknown>) => {
    const ws = presenceWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
      setTradeError('Connecting to live server — please try again in a moment.');
    }
  };

  const handleAuthenticated = (user: AuthenticatedUser, token: string) => {
    localStorage.setItem('clicket_session_token', token);
    setSessionToken(token);
    hydrateFromUser(user);
    setActiveTab('Market');
  };

  const handleLogout = async () => {
    if (sessionToken) {
      apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem('clicket_session_token');
    setSessionToken(null);
    setCurrentUser(null);
    setShowProfileMenu(false);
    setPullHistory([]);
    setTradeHistory([]);
    setHourlyTokenBurst(null);
    setTokenDisplayOverride(null);
    setTokenPillPulse(false);
  };

  // Only the specific account ClicketOwnerOfficial gets owner privileges and token buttons
  const isOwnerAccount =
    currentUser?.username?.trim().toLowerCase() === OWNER_USERNAME ||
    currentUser?.email?.trim().toLowerCase() === OWNER_USERNAME;

  const userAchievements = Array.from(
    new Set([
      ...(Array.isArray(currentUser?.achievements) ? currentUser.achievements : []),
      ...(isOwnerAccount ? ['owner', 'developer'] : []),
    ])
  );
  const hasOwnerBadge = userAchievements.includes('owner');
  const hasDeveloperBadge = userAchievements.includes('developer');
  const isPrivilegedTokenUser = isOwnerAccount || hasOwnerBadge;

  const openPackPurchaseModal = (pack: PackInfo) => {
    setMarketNotice(null);
    setPurchaseQuantity(1);
    setPurchaseModalPack(pack);
  };

  // Buy 1 or multiple packs in one go
  const handleBuyPacks = (pack: PackInfo, qty: number) => {
    const safeQty = Math.max(1, Math.min(100, Math.floor(qty)));
    const totalCost = pack.price * safeQty;

    if (tokens < totalCost) {
      setMarketNotice(
        `You need ${(totalCost - tokens).toLocaleString()} more tokens to open ${safeQty} ${
          safeQty === 1 ? 'pack' : 'packs'
        }! Visit Daily or Play to earn tokens.`
      );
      setTimeout(() => setMarketNotice(null), 4000);
      return;
    }

    setMarketNotice(null);
    setTokens((prev) => prev - totalCost);

    const workingInventory = { ...inventory };
    const batchPulls: PackPullResult[] = [];
    const newHistoryEntries: PullHistoryEntry[] = [];
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    for (let i = 0; i < safeQty; i++) {
      const rolled = rollBlookFromPack(pack, luckMultiplier);
      const previousCount = workingInventory[rolled.id] || 0;
      const isFirstTime = previousCount === 0;
      workingInventory[rolled.id] = previousCount + 1;

      batchPulls.push({ blook: rolled, isNew: isFirstTime });
      newHistoryEntries.unshift({
        id: `${Date.now()}-${i}-${Math.random()}`,
        blook: rolled,
        isNew: isFirstTime,
        timestamp,
      });
    }

    setInventory(workingInventory);
    setPullHistory((prev) => [...newHistoryEntries, ...prev].slice(0, 50));
    setRevealState({
      pack,
      pulls: batchPulls,
    });
  };

  const handleSellBlook = (blook: BlookItem, quantity: number = 1) => {
    const owned = inventory[blook.id] || 0;
    if (owned < quantity) return;

    const updated = { ...inventory };
    updated[blook.id] = owned - quantity;
    if (updated[blook.id] <= 0) {
      delete updated[blook.id];
    }

    setInventory(updated);
    setTokens((prev) => prev + blook.sellPrice * quantity);

    if (equippedBlookId === blook.id && (updated[blook.id] || 0) <= 0) {
      setEquippedBlookId('');
    }
  };

  const handleBazaarTrade = (recipe: BazaarRecipe) => {
    const targetBlook = ALL_BLOOKS.find((b) => b.id === recipe.targetBlookId);
    if (!targetBlook) return;

    for (const ing of recipe.ingredients) {
      if ((inventory[ing.blookId] || 0) < ing.count) {
        return;
      }
    }

    const updated = { ...inventory };
    for (const ing of recipe.ingredients) {
      const remaining = (updated[ing.blookId] || 0) - ing.count;
      if (remaining <= 0) {
        delete updated[ing.blookId];
      } else {
        updated[ing.blookId] = remaining;
      }
    }
    updated[targetBlook.id] = (updated[targetBlook.id] || 0) + 1;

    setInventory(updated);
    if (equippedBlookId && (updated[equippedBlookId] || 0) <= 0) {
      setEquippedBlookId('');
    }

    setBazaarNotice({
      text: `Bazaar Trade Complete! You received 1x ${targetBlook.name}!`,
      targetBlook,
    });
    setTimeout(() => setBazaarNotice(null), 4000);
  };

  const handleBuyClickUpgrade = (cost: number) => {
    if (tokens < cost) return;
    setTokens((prev) => prev - cost);
    setClickUpgradeLevel((lvl) => lvl + 1);
  };

  // Loading gate
  if (checkingAuth) {
    return (
      <div className="h-screen w-screen bg-[#f87171] flex flex-col items-center justify-center text-white select-none">
        <span
          className="tracking-wide mb-3 drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]"
          style={{
            fontFamily: "'Lexend Deca', sans-serif",
            fontWeight: 'bold',
            fontSize: '36px',
            lineHeight: '55px',
          }}
        >
          CLICKET
        </span>
        <span className="font-nunito font-extrabold text-sm opacity-90">
          Loading your account...
        </span>
      </div>
    );
  }

  // Require sign up / login before entering CLICKET
  if (!currentUser) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const activeAvatarBlookId =
    equippedBlookId && (inventory[equippedBlookId] || 0) > 0 ? equippedBlookId : '';

  const navItems: { label: ActiveTab; icon: React.ReactNode }[] = [
    { label: 'Daily', icon: <MousePointerClick className="w-5 h-5" /> },
    { label: 'Blooks', icon: <Briefcase className="w-5 h-5" /> },
    { label: 'Market', icon: <Store className="w-5 h-5" /> },
    { label: 'Bazaar', icon: <ArrowLeftRight className="w-5 h-5" /> },
    { label: 'Trading', icon: <Handshake className="w-5 h-5" /> },
    { label: 'Clans', icon: <Shield className="w-5 h-5" /> },
    { label: 'Achievements', icon: <Trophy className="w-5 h-5" /> },
    { label: 'Discover', icon: <Compass className="w-5 h-5" /> },
    { label: 'Set Creator', icon: <PenSquare className="w-5 h-5" /> },
    { label: 'My Sets', icon: <List className="w-5 h-5" /> },
    { label: 'Favorites', icon: <Star className="w-5 h-5" /> },
  ];

  const unlockedCircusCount = CIRCUS_BLOOKS.filter((b) => (inventory[b.id] || 0) > 0).length;
  const unlockedAthletesCount = ATHLETES_BLOOKS.filter((b) => (inventory[b.id] || 0) > 0).length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden select-none bg-[#f87171]">
      {/* TOP GUI BAR */}
      <header className="w-full shrink-0 bg-[#dc2626] px-4 md:px-6 py-2 flex flex-wrap items-center justify-between gap-3 z-30 shadow-[0_4px_15px_rgba(0,0,0,0.18)] overflow-visible">
        {/* CLICKET All-Caps Logo */}
        <div className="flex items-baseline gap-2 shrink-0">
          <span
            onClick={() => setActiveTab('Market')}
            className="text-white tracking-wide cursor-pointer block drop-shadow-[0_2px_0_rgba(0,0,0,0.2)]"
            style={{
              fontFamily: "'Lexend Deca', sans-serif",
              fontWeight: 'bold',
              fontSize: '36px',
              lineHeight: '55px',
            }}
          >
            CLICKET
          </span>
          <span
            className="text-white/80 tracking-normal select-none"
            style={{
              fontFamily: "'Lexend Deca', sans-serif",
              fontWeight: 300,
              fontSize: '12px',
              lineHeight: '1',
            }}
          >
            v1.0.0
          </span>
        </div>

        {/* Center Icon Navigation with Bold Non-Titan-One Hover Name Popups */}
        <nav className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
          {/* Play Icon Button */}
          <div className="relative group mr-1">
            <button
              type="button"
              aria-label="Play"
              onClick={() => setActiveTab('Play')}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer border-2 ${
                activeTab === 'Play'
                  ? 'bg-white text-[#dc2626] border-white shadow-sm'
                  : 'bg-[#f87171] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_4px_0_#991b1b] border-white/25 text-white'
              }`}
            >
              <Play
                className={`w-5 h-5 ${
                  activeTab === 'Play' ? 'fill-[#dc2626] text-[#dc2626]' : 'fill-white text-white'
                }`}
              />
            </button>
            <span
              style={{ fontFamily: "'Lexend Deca', sans-serif" }}
              className="pointer-events-none opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 absolute left-1/2 -translate-x-1/2 top-full mt-2.5 px-3 py-1 rounded-xl bg-slate-900 text-white font-bold text-xs tracking-wide whitespace-nowrap shadow-xl z-50 border border-white/20"
            >
              Play
            </span>
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.label;
            return (
              <div key={item.label} className="relative group">
                <button
                  type="button"
                  aria-label={item.label}
                  onClick={() => setActiveTab(item.label)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#dc2626] shadow-sm scale-105'
                      : 'text-white/95 hover:bg-white/15'
                  }`}
                >
                  {item.icon}
                </button>
                <span
                  style={{ fontFamily: "'Lexend Deca', sans-serif" }}
                  className="pointer-events-none opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 absolute left-1/2 -translate-x-1/2 top-full mt-2.5 px-3 py-1 rounded-xl bg-slate-900 text-white font-bold text-xs tracking-wide whitespace-nowrap shadow-xl z-50 border border-white/20"
                >
                  {item.label}
                </span>
              </div>
            );
          })}

          {/* Divider */}
          <div className="hidden sm:block w-px h-7 bg-white/20 mx-1" />

          {/* Utility Icon Buttons */}
          <div className="relative group">
            <button
              type="button"
              aria-label="Recent Pack Pulls"
              onClick={() => setShowHistoryModal(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/90 hover:bg-white/15 transition-colors cursor-pointer"
            >
              <History className="w-5 h-5" />
            </button>
            <span
              style={{ fontFamily: "'Lexend Deca', sans-serif" }}
              className="pointer-events-none opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 absolute left-1/2 -translate-x-1/2 top-full mt-2.5 px-3 py-1 rounded-xl bg-slate-900 text-white font-bold text-xs tracking-wide whitespace-nowrap shadow-xl z-50 border border-white/20"
            >
              Recent Pulls
            </span>
          </div>

          <div className="relative group">
            <button
              type="button"
              aria-label="Circus Pack Rates"
              onClick={() => setShowCircusSheetModal(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/90 hover:bg-white/15 transition-colors cursor-pointer"
            >
              <FileText className="w-5 h-5" />
            </button>
            <span
              style={{ fontFamily: "'Lexend Deca', sans-serif" }}
              className="pointer-events-none opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 absolute left-1/2 -translate-x-1/2 top-full mt-2.5 px-3 py-1 rounded-xl bg-slate-900 text-white font-bold text-xs tracking-wide whitespace-nowrap shadow-xl z-50 border border-white/20"
            >
              Drop Rates
            </span>
          </div>

          <div className="relative group">
            <button
              type="button"
              aria-label="Settings"
              onClick={() => setShowSettingsModal(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/90 hover:bg-white/15 transition-colors cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
            <span
              style={{ fontFamily: "'Lexend Deca', sans-serif" }}
              className="pointer-events-none opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 absolute left-1/2 -translate-x-1/2 top-full mt-2.5 px-3 py-1 rounded-xl bg-slate-900 text-white font-bold text-xs tracking-wide whitespace-nowrap shadow-xl z-50 border border-white/20"
            >
              Settings
            </span>
          </div>

          <div className="relative group hidden md:block">
            <button
              type="button"
              aria-label="Circus Notes"
              onClick={() => setShowCircusSheetModal(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/90 hover:bg-white/15 transition-colors cursor-pointer"
            >
              <Newspaper className="w-5 h-5" />
            </button>
            <span
              style={{ fontFamily: "'Lexend Deca', sans-serif" }}
              className="pointer-events-none opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 absolute left-1/2 -translate-x-1/2 top-full mt-2.5 px-3 py-1 rounded-xl bg-slate-900 text-white font-bold text-xs tracking-wide whitespace-nowrap shadow-xl z-50 border border-white/20"
            >
              Circus News
            </span>
          </div>
        </nav>

        {/* Right: Token Balance + User Profile Menu */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Token Counter Pill */}
          <div
            ref={tokenCounterRef}
            className={`bg-[#991b1b] text-white px-3.5 py-1.5 rounded-xl border border-white/15 flex items-center gap-2 shadow-inner transition-transform duration-100 ${
              tokenPillPulse ? 'scale-110 brightness-110' : 'scale-100'
            }`}
          >
            <BlooketTokenIcon className="w-5 h-5" />
            <span className="font-nunito font-extrabold text-[17px] tabular-nums">
              {(tokenDisplayOverride !== null ? tokenDisplayOverride : tokens).toLocaleString()}
            </span>
          </div>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu((v) => !v)}
              className="bg-[#b91c1c] hover:bg-[#991b1b] text-white px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <div className="w-7 h-7 rounded-md bg-red-200/30 overflow-hidden flex items-center justify-center p-0.5">
                {activeAvatarBlookId ? (
                  <BlookArt id={activeAvatarBlookId} className="w-full h-full" />
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>
              <span className="font-nunito font-bold text-[15px] tracking-tight max-w-[120px] truncate">
                {username}
              </span>
              {hasOwnerBadge && (
                <span title="Owner Badge" className="shrink-0 flex items-center">
                  <OwnerAchievementIcon className="w-5 h-5 drop-shadow-sm" />
                </span>
              )}
              {hasDeveloperBadge && !hasOwnerBadge && (
                <span title="Developer Badge" className="shrink-0 flex items-center">
                  <DeveloperAchievementIcon className="w-5 h-5 drop-shadow-sm" />
                </span>
              )}
              <ChevronDown className="w-4 h-4 opacity-90" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border-2 border-[#dc2626] p-3 text-slate-800 z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-red-100 p-0.5 shrink-0 flex items-center justify-center">
                      {activeAvatarBlookId ? (
                        <BlookArt id={activeAvatarBlookId} className="w-full h-full" />
                      ) : (
                        <User className="w-5 h-5 text-[#dc2626]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="block font-nunito font-black text-sm truncate text-slate-800">
                          {username}
                        </span>
                        {hasOwnerBadge && (
                          <span title="Owner Badge" className="shrink-0">
                            <OwnerAchievementIcon className="w-4 h-4" />
                          </span>
                        )}
                        {hasDeveloperBadge && (
                          <span title="Developer Badge" className="shrink-0">
                            <DeveloperAchievementIcon className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <span className="block font-nunito font-bold text-[11px] text-slate-400">
                        {hasOwnerBadge
                          ? 'CLICKET Owner'
                          : hasDeveloperBadge
                          ? 'CLICKET Developer'
                          : 'CLICKET Player'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setTempUsername(username);
                      setRenameError(null);
                      setShowRenameModal(true);
                      setShowProfileMenu(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-[#dc2626] font-nunito font-extrabold text-xs cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <PenSquare className="w-3.5 h-3.5" />
                    <span>Rename</span>
                  </button>
                </div>

                {(hasOwnerBadge || hasDeveloperBadge) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('Achievements');
                      setShowProfileMenu(false);
                    }}
                    className="w-full mb-2 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    {hasOwnerBadge && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-500 text-white font-nunito font-black text-[11px]">
                        <OwnerAchievementIcon className="w-3.5 h-3.5" />
                        <span>Owner</span>
                      </span>
                    )}
                    {hasDeveloperBadge && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-nunito font-black text-[11px]">
                        <DeveloperAchievementIcon className="w-3.5 h-3.5" />
                        <span>Dev</span>
                      </span>
                    )}
                    <span className="ml-auto font-nunito font-bold text-[11px] text-amber-800">
                      Badges →
                    </span>
                  </button>
                )}

                <p className="font-nunito font-black text-[11px] text-slate-400 mb-1.5 uppercase tracking-wide">
                  Account Controls
                </p>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => {
                      setTempUsername(username);
                      setRenameError(null);
                      setShowRenameModal(true);
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-[#dc2626] font-nunito font-extrabold text-sm flex items-center justify-between cursor-pointer"
                  >
                    <span>Change Username</span>
                    <PenSquare className="w-4 h-4" />
                  </button>

                  {/* Token buttons strictly restricted to ClicketOwnerOfficial */}
                  {isPrivilegedTokenUser && (
                    <>
                      <button
                        onClick={() => {
                          setTokens((t) => t + 100);
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-nunito font-extrabold text-sm flex items-center justify-between cursor-pointer"
                      >
                        <span>+100 Tokens</span>
                        <BlooketTokenIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setTokens((t) => t + 1000);
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-nunito font-extrabold text-sm flex items-center justify-between cursor-pointer"
                      >
                        <span>+1,000 Tokens</span>
                        <BlooketTokenIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setTokens((t) => t + 10000);
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-nunito font-extrabold text-sm flex items-center justify-between cursor-pointer"
                      >
                        <span>+10,000 Tokens</span>
                        <BlooketTokenIcon className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setShowCircusSheetModal(true);
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-nunito font-extrabold text-xs cursor-pointer"
                  >
                    View Circus Pack Showcase
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-nunito font-extrabold text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span>Log Out</span>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CANVAS */}
      <main className="relative flex-1 w-full overflow-y-auto overflow-x-hidden bg-[#f87171]">
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.09]"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.6) 2px, transparent 2px), linear-gradient(15deg, rgba(255,255,255,0.22) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.22) 75%, transparent 75%, transparent)`,
            backgroundSize: '110px 110px',
          }}
        />

        {/* TAB 1: MARKET VIEW (CIRCUS PACK + MULTI-PACK PURCHASE IN ONE GO) */}
        {activeTab === 'Market' && (
          <div className="relative z-10 px-9 pt-6 pb-16 min-h-full flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <h1 className="font-titan text-white text-[48px] leading-none tracking-wide drop-shadow-[0_3px_0_rgba(0,0,0,0.18)]">
                Market
              </h1>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Only 354245082@educ.dpcdsb.org sees +100, +1000, +10000 buttons */}
                {isPrivilegedTokenUser && (
                  <>
                    <button
                      onClick={() => setTokens((t) => t + 100)}
                      className="px-3.5 py-2 rounded-xl bg-[#fbbf24] hover:brightness-105 text-amber-950 font-nunito font-black text-sm shadow-[0_4px_0_#b45309] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <BlooketTokenIcon className="w-5 h-5" />
                      <span>+100</span>
                    </button>
                    <button
                      onClick={() => setTokens((t) => t + 1000)}
                      className="px-3.5 py-2 rounded-xl bg-[#fbbf24] hover:brightness-105 text-amber-950 font-nunito font-black text-sm shadow-[0_4px_0_#b45309] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <BlooketTokenIcon className="w-5 h-5" />
                      <span>+1,000</span>
                    </button>
                    <button
                      onClick={() => setTokens((t) => t + 10000)}
                      className="px-3.5 py-2 rounded-xl bg-[#fbbf24] hover:brightness-105 text-amber-950 font-nunito font-black text-sm shadow-[0_4px_0_#b45309] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <BlooketTokenIcon className="w-5 h-5" />
                      <span>+10,000</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setShowcasePackTab('circus');
                    setShowCircusSheetModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#ff3e3e] hover:brightness-110 text-white font-nunito font-extrabold text-sm flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Circus Rates ({unlockedCircusCount}/15)</span>
                </button>
                <button
                  onClick={() => {
                    setShowcasePackTab('athletes');
                    setShowCircusSheetModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#5cb61f] hover:brightness-110 text-white font-nunito font-extrabold text-sm flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Athletes Rates ({unlockedAthletesCount}/11)</span>
                </button>
              </div>
            </div>

            {marketNotice && (
              <div className="mb-5 max-w-xl bg-rose-500 text-white font-nunito font-extrabold text-sm px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between gap-3">
                <span>{marketNotice}</span>
                <button
                  onClick={() => setActiveTab('Daily')}
                  className="px-3 py-1 rounded-xl bg-white text-rose-600 font-black text-xs shrink-0 cursor-pointer"
                >
                  Go to Daily
                </button>
              </div>
            )}

            {/* Circus Pack, Athletes Pack & Shopkeeper Booth */}
            <div className="flex flex-col lg:flex-row items-start gap-8 flex-1 flex-wrap">
              <div className="w-full max-w-[310px]">
                {/* Circus Pack Card */}
                <div
                  onClick={() => openPackPurchaseModal(CIRCUS_PACK)}
                  className="group rounded-2xl overflow-hidden shadow-[0_7px_0_rgba(0,0,0,0.22)] hover:-translate-y-1 transition-all duration-150 cursor-pointer flex flex-col border-[5px]"
                  style={{
                    backgroundColor: '#ff4242',
                    borderColor: CIRCUS_PACK.borderColor,
                  }}
                >
                  <div
                    className="relative h-[220px] w-full flex items-center justify-center overflow-hidden p-3"
                    style={{ backgroundColor: '#ff4242' }}
                  >
                    <div
                      className="absolute inset-0 opacity-25 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(circle at center, rgba(255,255,255,0.6) 0%, transparent 70%)',
                      }}
                    />

                    <div className="relative z-10 w-[160px] h-[184px] transition-transform duration-200 group-hover:scale-105 -rotate-3">
                      <PackCoverArt packId="circus" className="w-full h-full" />
                    </div>

                    <div className="absolute -bottom-1.5 -right-1.5 w-16 h-16 opacity-45 rotate-12 pointer-events-none">
                      <CircusClownFaceIcon className="w-full h-full" />
                    </div>
                  </div>

                  {/* Price Bar */}
                  <div className="bg-[#3898eb] border-t-4 border-white/80 py-2.5 px-4 flex items-center justify-center gap-2 shadow-inner">
                    <BlooketTokenIcon className="w-7 h-7" />
                    <span className="font-titan text-white text-[24px] tracking-wide drop-shadow-[0_2px_0_rgba(0,0,0,0.2)]">
                      {CIRCUS_PACK.price}
                    </span>
                  </div>
                </div>
              </div>

              {/* Athletes Pack Column */}
              <div className="w-full max-w-[310px]">
                <div
                  onClick={() => openPackPurchaseModal(ATHLETES_PACK)}
                  className="group rounded-2xl overflow-hidden shadow-[0_7px_0_rgba(0,0,0,0.22)] hover:-translate-y-1 transition-all duration-150 cursor-pointer flex flex-col border-[5px]"
                  style={{
                    backgroundColor: ATHLETES_PACK.bgColor,
                    borderColor: ATHLETES_PACK.borderColor,
                  }}
                >
                  <div className="relative h-[220px] w-full flex items-center justify-center overflow-hidden p-3">
                    <div
                      className="absolute inset-0 opacity-25 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(circle at center, rgba(255,255,255,0.65) 0%, transparent 70%)',
                      }}
                    />

                    <div className="relative z-10 w-[235px] h-[192px] transition-transform duration-200 group-hover:scale-105 -rotate-2">
                      <PackCoverArt packId="athletes" className="w-full h-full" />
                    </div>

                    <div className="absolute -bottom-1.5 -right-1.5 w-16 h-16 opacity-45 -rotate-12 pointer-events-none">
                      <AthletesSoccerBallIcon className="w-full h-full" />
                    </div>
                  </div>

                  {/* Price Bar */}
                  <div className="bg-[#3898eb] border-t-4 border-white/80 py-2.5 px-4 flex items-center justify-center gap-2 shadow-inner">
                    <BlooketTokenIcon className="w-7 h-7" />
                    <span className="font-titan text-white text-[24px] tracking-wide drop-shadow-[0_2px_0_rgba(0,0,0,0.2)]">
                      {ATHLETES_PACK.price}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side Shopkeeper Market Stall */}
              <div className="hidden xl:flex flex-1 items-center justify-center pt-6 pr-6 self-center">
                <div className="flex flex-col items-center">
                  <MarketShopkeeperBooth />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DAILY 30-SECOND CLICKER (24H LOCK), UPGRADES, DAILY WHEEL & HOURLY REWARD */}
        {activeTab === 'Daily' && (
          <DailyClickerView
            tokens={tokens}
            clickUpgradeLevel={clickUpgradeLevel}
            bestDailyClicks={bestDailyClicks}
            equippedBlookId={activeAvatarBlookId}
            lastDailyPlayAt={lastDailyPlayAt}
            lastWheelSpinAt={lastWheelSpinAt}
            lastHourlyClaimAt={lastHourlyClaimAt}
            sessionToken={sessionToken}
            onEarnTokens={(amt) => setTokens((prev) => prev + amt)}
            onBuyClickUpgrade={handleBuyClickUpgrade}
            onUpdateBestClicks={(clicks) =>
              setBestDailyClicks((prev) => Math.max(prev, clicks))
            }
            onLockDaily={(ts) => setLastDailyPlayAt(ts)}
            onRecordWheelSpin={(ts) => setLastWheelSpinAt(ts)}
            onClaimHourlyReward={(reward, newTokens, claimedAt) => {
              const fromTokens = Math.max(0, newTokens - reward);
              setTokenDisplayOverride(fromTokens);
              setHourlyTokenBurst({
                id: Date.now(),
                reward,
                fromTokens,
                toTokens: newTokens,
              });
              setTokens(newTokens);
              setLastHourlyClaimAt(claimedAt);
            }}
          />
        )}

        {/* TAB 3: BLOOKS LOCKER */}
        {activeTab === 'Blooks' && (
          <div className="relative z-10 px-9 pt-6 pb-16 min-h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h1 className="font-titan text-white text-[44px] leading-none tracking-wide drop-shadow-[0_3px_0_rgba(0,0,0,0.18)]">
                Blooks
              </h1>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCircusSheetModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#dc2626] text-white font-nunito font-extrabold text-sm shadow-[0_4px_0_#991b1b] cursor-pointer whitespace-nowrap shrink-0"
                >
                  View Reference Sheet
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="flex-1 flex flex-col gap-6 w-full">
                {/* CIRCUS PACK BLOOKS */}
                <div className="bg-[#b91c1c]/35 border-2 border-white/15 rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)] w-full">
                  <div className="flex items-center justify-between border-b-2 border-white/20 pb-3 mb-6">
                    <div className="flex items-center gap-3">
                      <h2 className="font-titan text-2xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.18)]">
                        Circus Pack
                      </h2>
                      <span className="text-sm font-nunito font-extrabold text-white/85">
                        {unlockedCircusCount} / {CIRCUS_BLOOKS.length} Unlocked
                      </span>
                    </div>
                    <span className="text-xs font-nunito font-extrabold text-white/90">
                      20 Tokens per Pack
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 gap-x-5 gap-y-6 justify-items-center">
                    {CIRCUS_BLOOKS.map((blook) => {
                      const count = inventory[blook.id] || 0;
                      const isUnlocked = count > 0;
                      const isSelected = selectedBlook.id === blook.id;
                      const rarityColor = RARITY_COLORS[blook.rarity];

                      return (
                        <button
                          key={blook.id}
                          type="button"
                          title={`${blook.name} (${blook.rarity} ${blook.chanceLabel})`}
                          onClick={() => setSelectedBlook(blook)}
                          className={`relative aspect-square w-full max-w-[76px] rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'ring-4 ring-white scale-105 shadow-lg bg-white/15'
                              : 'hover:scale-105'
                          }`}
                        >
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={!isUnlocked ? { filter: 'brightness(0) invert(72%)' } : undefined}
                          >
                            <BlookArt
                              id={blook.id}
                              animated={isUnlocked}
                              className="w-full h-full drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]"
                            />
                          </div>

                          {!isUnlocked && (
                            <div className="absolute -bottom-1 -left-1 bg-slate-700/90 text-white w-6 h-6 rounded-full flex items-center justify-center border-2 border-white/80 shadow-sm">
                              <Lock className="w-3 h-3" />
                            </div>
                          )}

                          {isUnlocked && (
                            <span
                              className="absolute -bottom-1 -left-1 min-w-[24px] h-6 px-1.5 rounded-full font-nunito font-black text-xs text-white flex items-center justify-center border-2 border-white/90 shadow-md"
                              style={{ backgroundColor: rarityColor }}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ATHLETES PACK BLOOKS */}
                <div className="bg-emerald-900/35 border-2 border-white/15 rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)] w-full">
                  <div className="flex items-center justify-between border-b-2 border-white/20 pb-3 mb-6">
                    <div className="flex items-center gap-3">
                      <h2 className="font-titan text-2xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.18)]">
                        Athletes Pack
                      </h2>
                      <span className="text-sm font-nunito font-extrabold text-white/85">
                        {unlockedAthletesCount} / {ATHLETES_BLOOKS.length} Unlocked
                      </span>
                    </div>
                    <span className="text-xs font-nunito font-extrabold text-white/90">
                      20 Tokens per Pack
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 gap-x-5 gap-y-6 justify-items-center">
                    {ATHLETES_BLOOKS.map((blook) => {
                      const count = inventory[blook.id] || 0;
                      const isUnlocked = count > 0;
                      const isSelected = selectedBlook.id === blook.id;
                      const rarityColor = RARITY_COLORS[blook.rarity];

                      return (
                        <button
                          key={blook.id}
                          type="button"
                          title={`${blook.name} (${blook.rarity} ${blook.chanceLabel})`}
                          onClick={() => setSelectedBlook(blook)}
                          className={`relative aspect-square w-full max-w-[76px] rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'ring-4 ring-white scale-105 shadow-lg bg-white/15'
                              : 'hover:scale-105'
                          }`}
                        >
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={!isUnlocked ? { filter: 'brightness(0) invert(72%)' } : undefined}
                          >
                            <BlookArt
                              id={blook.id}
                              animated={isUnlocked}
                              className="w-full h-full drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]"
                            />
                          </div>

                          {!isUnlocked && (
                            <div className="absolute -bottom-1 -left-1 bg-slate-700/90 text-white w-6 h-6 rounded-full flex items-center justify-center border-2 border-white/80 shadow-sm">
                              <Lock className="w-3 h-3" />
                            </div>
                          )}

                          {isUnlocked && (
                            <span
                              className="absolute -bottom-1 -left-1 min-w-[24px] h-6 px-1.5 rounded-full font-nunito font-black text-xs text-white flex items-center justify-center border-2 border-white/90 shadow-md"
                              style={{ backgroundColor: rarityColor }}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-[340px] shrink-0 flex flex-col items-center bg-white/95 rounded-3xl p-5 shadow-[0_8px_0_rgba(0,0,0,0.18)]">
                <div className="relative w-full h-[270px] bg-black rounded-[28px] p-3 flex flex-col items-center justify-between overflow-hidden shadow-lg">
                  <div className="z-10 text-center pt-1">
                    <h3
                      className="font-titan text-white text-2xl tracking-wide"
                      style={{ WebkitTextStroke: '1.5px #3b1908', paintOrder: 'stroke fill' }}
                    >
                      {selectedBlook.name}
                    </h3>
                    <span
                      className="font-nunito font-black text-sm"
                      style={{ color: RARITY_COLORS[selectedBlook.rarity] }}
                    >
                      {selectedBlook.rarity} {selectedBlook.chanceLabel}
                    </span>
                  </div>

                  <div
                    className="z-10 w-28 h-28 flex items-center justify-center my-auto"
                    style={
                      (inventory[selectedBlook.id] || 0) <= 0
                        ? { filter: 'brightness(0) invert(65%)' }
                        : undefined
                    }
                  >
                    <BlookArt
                      id={selectedBlook.id}
                      animated={(inventory[selectedBlook.id] || 0) > 0}
                      className="w-full h-full"
                    />
                  </div>

                  <div className="z-10 pb-1">
                    <span className="font-titan text-white text-lg">
                      Owned: {inventory[selectedBlook.id] || 0}
                    </span>
                  </div>
                </div>

                <div className="w-full mt-4 flex flex-col gap-2.5">
                  {(inventory[selectedBlook.id] || 0) > 0 ? (
                    <button
                      onClick={() => setEquippedBlookId(selectedBlook.id)}
                      className="w-full py-2.5 rounded-xl bg-[#f87171] text-white font-titan text-lg shadow-[0_5px_0_#dc2626] active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      {activeAvatarBlookId === selectedBlook.id ? (
                        <>
                          <Check className="w-5 h-5" />
                          <span>Equipped as Avatar</span>
                        </>
                      ) : (
                        <span>Use as Profile Blook</span>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 font-titan text-base cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Obtain Blook to Use as Avatar</span>
                    </button>
                  )}

                  {(inventory[selectedBlook.id] || 0) > 0 ? (
                    <>
                      <button
                        onClick={() => handleSellBlook(selectedBlook, 1)}
                        className="w-full py-2.5 rounded-xl bg-[#ef4444] text-white font-titan text-lg shadow-[0_5px_0_#b91c1c] active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <BlooketTokenIcon className="w-5 h-5" />
                        <span>Sell 1 for {selectedBlook.sellPrice} Tokens</span>
                      </button>

                      {(inventory[selectedBlook.id] || 0) > 1 && (
                        <button
                          onClick={() =>
                            handleSellBlook(
                              selectedBlook,
                              (inventory[selectedBlook.id] || 0) - 1
                            )
                          }
                          className="w-full py-2.5 rounded-xl bg-[#f59e0b] text-amber-950 font-titan text-base shadow-[0_5px_0_#b45309] active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                        >
                          <BlooketTokenIcon className="w-5 h-5" />
                          <span>
                            Sell Until ONE Left (+
                            {(
                              ((inventory[selectedBlook.id] || 0) - 1) *
                              selectedBlook.sellPrice
                            ).toLocaleString()}
                            )
                          </span>
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => setActiveTab('Market')}
                      className="w-full py-2.5 rounded-xl bg-[#dc2626] text-white font-titan text-lg shadow-[0_5px_0_#991b1b] cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Unlock in Market (20 Tokens)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3B: CIRCUS BAZAAR (TRADE BLOOKS UP IN RARITY) */}
        {activeTab === 'Bazaar' && (
          <div className="relative z-10 px-9 pt-6 pb-16 min-h-full flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h1 className="font-titan text-white text-[44px] leading-none tracking-wide drop-shadow-[0_3px_0_rgba(0,0,0,0.18)]">
                  Circus Bazaar
                </h1>
                <p className="font-nunito font-extrabold text-white/90 text-sm mt-1">
                  Trade duplicate lower-rarity Blooks to craft rarer Circus Blooks!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('Market')}
                className="px-5 py-2.5 rounded-xl bg-[#dc2626] text-white font-titan text-base shadow-[0_4px_0_#991b1b] cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>Get More Blooks in Market</span>
              </button>
            </div>

            {bazaarNotice && (
              <div className="mb-5 bg-white border-4 border-emerald-400 rounded-2xl px-5 py-3.5 shadow-lg flex items-center gap-4 max-w-2xl animate-pop-reveal">
                <div className="w-12 h-12 shrink-0">
                  <BlookArt id={bazaarNotice.targetBlook.id} className="w-full h-full" />
                </div>
                <div className="flex-1">
                  <p className="font-titan text-xl text-emerald-700 leading-tight">
                    {bazaarNotice.text}
                  </p>
                  <p className="font-nunito font-extrabold text-xs text-slate-500">
                    Rarity: {bazaarNotice.targetBlook.rarity} ({bazaarNotice.targetBlook.chanceLabel})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBazaarNotice(null)}
                  className="text-slate-400 hover:text-slate-700 font-black text-sm cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Rarity Filter Bar */}
            <div className="inline-flex flex-wrap self-start items-center gap-1.5 p-1.5 rounded-2xl bg-white/20 mb-6">
              {(['All', 'Rare', 'Epic', 'Legendary', 'Chroma', 'Mystic'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setBazaarFilter(tier)}
                  className={`px-4 py-1.5 rounded-xl font-titan text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    bazaarFilter === tier
                      ? 'bg-white text-[#dc2626] shadow-sm'
                      : 'text-white hover:bg-white/15'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            {/* Bazaar Recipes Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-6xl">
              {BAZAAR_RECIPES.filter((recipe) => {
                if (bazaarFilter === 'All') return true;
                const target = CIRCUS_BLOOKS.find((b) => b.id === recipe.targetBlookId);
                return target?.rarity === bazaarFilter;
              }).map((recipe) => {
                const target = CIRCUS_BLOOKS.find((b) => b.id === recipe.targetBlookId);
                if (!target) return null;

                const targetOwned = inventory[target.id] || 0;
                const targetColor = RARITY_COLORS[target.rarity];
                const canTrade = recipe.ingredients.every(
                  (ing) => (inventory[ing.blookId] || 0) >= ing.count
                );
                const totalMissing = recipe.ingredients.reduce(
                  (acc, ing) => acc + Math.max(0, ing.count - (inventory[ing.blookId] || 0)),
                  0
                );

                return (
                  <div
                    key={recipe.id}
                    className="bg-white rounded-3xl p-5 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-col justify-between gap-4 border-2 border-white"
                  >
                    {/* Recipe Header */}
                    <div className="flex items-center justify-between gap-3 border-b-2 border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="px-2.5 py-0.5 rounded-lg font-nunito font-black text-xs text-white"
                          style={{ backgroundColor: targetColor }}
                        >
                          {target.rarity}
                        </span>
                        <h2 className="font-titan text-2xl text-slate-800">{target.name}</h2>
                      </div>
                      <span className="font-nunito font-black text-xs text-slate-500">
                        You own: {targetOwned}
                      </span>
                    </div>

                    {/* Visual Equation: Ingredients -> = Target */}
                    <div className="flex flex-wrap items-center gap-2.5 py-1">
                      {recipe.ingredients.map((ing, idx) => {
                        const ingBlook = CIRCUS_BLOOKS.find((b) => b.id === ing.blookId);
                        if (!ingBlook) return null;
                        const have = inventory[ing.blookId] || 0;
                        const met = have >= ing.count;

                        return (
                          <React.Fragment key={ing.blookId}>
                            {idx > 0 && (
                              <span className="font-titan text-xl text-slate-400 px-0.5">+</span>
                            )}
                            <div
                              className={`rounded-2xl p-2.5 border-2 flex flex-col items-center min-w-[84px] text-center ${
                                met
                                  ? 'bg-emerald-50 border-emerald-300'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div
                                className="w-12 h-12 flex items-center justify-center mb-1"
                                style={have <= 0 ? { filter: 'brightness(0) invert(72%)' } : undefined}
                              >
                                <BlookArt
                                  id={ingBlook.id}
                                  animated={have > 0}
                                  className="w-full h-full"
                                />
                              </div>
                              <span className="font-nunito font-extrabold text-[11px] text-slate-700 leading-tight max-w-[86px] truncate">
                                {ingBlook.name}
                              </span>
                              <span
                                className={`mt-1 px-2 py-0.5 rounded-md font-nunito font-black text-xs tabular-nums ${
                                  met
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {have}/{ing.count}
                              </span>
                            </div>
                          </React.Fragment>
                        );
                      })}

                      <span className="font-titan text-2xl text-[#dc2626] px-1">=</span>

                      {/* Reward Blook Tile */}
                      <div
                        className="rounded-2xl p-2.5 border-2 flex flex-col items-center min-w-[96px] text-center ml-auto bg-amber-50/70"
                        style={{ borderColor: targetColor }}
                      >
                        <div className="w-14 h-14 flex items-center justify-center mb-1">
                          <BlookArt id={target.id} className="w-full h-full" />
                        </div>
                        <span className="font-nunito font-black text-xs text-slate-800 leading-tight">
                          {target.name}
                        </span>
                        <span
                          className="mt-0.5 font-nunito font-black text-[10px]"
                          style={{ color: targetColor }}
                        >
                          {target.chanceLabel}
                        </span>
                      </div>
                    </div>

                    {/* Trade CTA */}
                    <button
                      type="button"
                      disabled={!canTrade}
                      onClick={() => handleBazaarTrade(recipe)}
                      className={`w-full py-2.5 px-4 rounded-xl font-titan text-lg flex items-center justify-center gap-2 transition-all ${
                        canTrade
                          ? 'bg-[#fbbf24] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_5px_0_#b45309] text-amber-950 cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <ArrowLeftRight className="w-5 h-5" />
                      <span>
                        {canTrade
                          ? `Trade for ${target.name}`
                          : `Need ${totalMissing} More ${totalMissing === 1 ? 'Blook' : 'Blooks'}`}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3C: LIVE PLAYER-TO-PLAYER TRADING */}
        {activeTab === 'Trading' && (
          <TradingView
            myClientId={presenceClientId}
            myUserId={currentUser.id}
            wsConnected={presenceConnected}
            inventory={inventory}
            onlinePlayers={onlinePlayers}
            activeTrade={activeTrade}
            tradeError={tradeError}
            tradeNotice={tradeNotice}
            tradeHistory={tradeHistory}
            onDismissNotice={() => setTradeNotice(null)}
            onInitiateTrade={(targetClientId) => {
              setTradeError(null);
              sendPresenceWs({ type: 'trade:initiate', targetClientId });
            }}
            onRespondTrade={(tradeId, accept) => {
              sendPresenceWs({ type: 'trade:respond', tradeId, accept });
            }}
            onSelectBlook={(tradeId, blookId) => {
              sendPresenceWs({ type: 'trade:select_blook', tradeId, blookId });
            }}
            onConfirmTrade={(tradeId, accepted) => {
              sendPresenceWs({ type: 'trade:confirm', tradeId, accepted });
            }}
            onCancelTrade={(tradeId) => {
              sendPresenceWs({ type: 'trade:cancel', tradeId });
            }}
          />
        )}

        {/* TAB 3D: CLANS AREA */}
        {activeTab === 'Clans' && (
          <ClansView
            myUserId={currentUser.id}
            myClanId={currentUser.clanId ?? null}
            sessionToken={sessionToken}
            onRefreshUser={refreshUserFromServer}
          />
        )}

        {/* TAB 3E: ACHIEVEMENTS AREA (OWNER & DEVELOPER) */}
        {activeTab === 'Achievements' && (
          <AchievementsView
            unlockedIds={userAchievements}
            sessionToken={sessionToken}
            onRefreshUser={refreshUserFromServer}
          />
        )}

        {/* TAB 4: PLAY ONLINE (7-DIGIT CODE, UNIQUE BLOOK PICKER, 3 MODES) & SOLO */}
        {activeTab === 'Play' && (
          <div className="relative z-10 h-full">
            <PlayLobbyAndGame
              userId={currentUser.id}
              username={username}
              questions={questions}
              activeSetId={activeSetId}
              activeSetTitle={activeSetTitle}
              onRefreshUserFromServer={refreshUserFromServer}
              onEarnSoloTokens={(amt) => setTokens((t) => t + amt)}
              onRecordSoloPlay={recordSetPlay}
              onExit={() => setActiveTab('Market')}
            />
          </div>
        )}

        {/* TAB 6, 7, 8: DISCOVER / MY SETS / FAVORITES (ACTUAL UNIQUE PLAYER COUNTS) */}
        {(activeTab === 'Discover' || activeTab === 'My Sets' || activeTab === 'Favorites') && (
          <div className="relative z-10 px-9 pt-6 pb-16">
            <h1 className="font-titan text-white text-[44px] mb-6 drop-shadow-[0_3px_0_rgba(0,0,0,0.18)]">
              {activeTab}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
              {[
                {
                  id: 'circus-official',
                  title: 'Official Circus Pack Trivia',
                  blook: 'jester',
                  qCount: questions.length,
                },
                {
                  id: 'clicket-rarities',
                  title: 'Clicket Drop Rates & Chroma Master',
                  blook: 'ring-lion',
                  qCount: questions.length,
                },
              ]
                .filter((s) => activeTab !== 'Favorites' || favoriteSetIds.includes(s.id))
                .map((setCard) => {
                  const isFav = favoriteSetIds.includes(setCard.id);
                  const realStats = setStats[setCard.id] || { uniquePlayers: 0, totalPlays: 0 };
                  return (
                    <div
                      key={setCard.id}
                      className="bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex items-center gap-5"
                    >
                      <div className="w-20 h-20 shrink-0">
                        <BlookArt id={setCard.blook} className="w-full h-full" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-titan text-xl text-slate-800 mb-1">
                          {setCard.title}
                        </h3>
                        <p className="font-nunito font-bold text-xs text-slate-500 mb-4 tabular-nums">
                          {setCard.qCount} Questions · {realStats.uniquePlayers.toLocaleString()}{' '}
                          {realStats.uniquePlayers === 1 ? 'Person Played' : 'People Played'} (
                          {realStats.totalPlays.toLocaleString()} Total Plays)
                        </p>
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => {
                              setActiveSetId(setCard.id);
                              setActiveSetTitle(setCard.title);
                              setActiveTab('Play');
                            }}
                            className="px-5 py-2 rounded-xl bg-[#f87171] text-white font-titan text-sm shadow-[0_4px_0_#dc2626] cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Play Set
                          </button>
                          <button
                            onClick={() =>
                              setFavoriteSetIds((prev) =>
                                prev.includes(setCard.id)
                                  ? prev.filter((id) => id !== setCard.id)
                                  : [...prev, setCard.id]
                              )
                            }
                            className={`px-3 py-2 rounded-xl font-nunito font-extrabold text-xs border-2 cursor-pointer whitespace-nowrap shrink-0 ${
                              isFav
                                ? 'bg-amber-50 border-amber-400 text-amber-700'
                                : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            {isFav ? '★ Favorited' : '☆ Favorite'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 9: SET CREATOR */}
        {activeTab === 'Set Creator' && (
          <div className="relative z-10 px-9 pt-6 pb-16 max-w-4xl">
            <h1 className="font-titan text-white text-[44px] mb-6 drop-shadow-[0_3px_0_rgba(0,0,0,0.18)]">
              Set Creator
            </h1>

            <div className="bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)] mb-6">
              <h2 className="font-titan text-2xl text-[#dc2626] mb-4">
                Add Question to Circus Trivia Set
              </h2>
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Enter your trivia question..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 font-nunito font-bold text-slate-800 focus:outline-none focus:border-[#dc2626]"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {newOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctOpt"
                        checked={newCorrectIndex === idx}
                        onChange={() => setNewCorrectIndex(idx)}
                        className="w-5 h-5 accent-[#dc2626] cursor-pointer"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const copy = [...newOptions] as [string, string, string, string];
                          copy[idx] = e.target.value;
                          setNewOptions(copy);
                        }}
                        placeholder={`Answer Option ${idx + 1}`}
                        className="flex-1 px-3.5 py-2.5 rounded-xl border-2 border-slate-200 font-nunito font-bold text-sm text-slate-800"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (!newQuestionText.trim() || newOptions.some((o) => !o.trim())) return;
                    setQuestions((prev) => [
                      ...prev,
                      {
                        id: `custom-${Date.now()}`,
                        question: newQuestionText.trim(),
                        options: newOptions,
                        correctIndex: newCorrectIndex,
                        category: 'Custom Circus Set',
                      },
                    ]);
                    setNewQuestionText('');
                    setNewOptions(['', '', '', '']);
                  }}
                  className="self-start px-6 py-2.5 rounded-xl bg-[#f87171] text-white font-titan text-base shadow-[0_5px_0_#dc2626] cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Question</span>
                </button>
              </div>
            </div>

            <div className="bg-white/95 rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)]">
              <h3 className="font-titan text-xl text-slate-800 mb-4">
                Active Questions ({questions.length})
              </h3>
              <div className="flex flex-col gap-2.5">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div>
                      <p className="font-nunito font-extrabold text-sm text-slate-800">
                        {idx + 1}. {q.question}
                      </p>
                      <p className="font-nunito font-bold text-xs text-emerald-600">
                        Answer: {q.options[q.correctIndex]}
                      </p>
                    </div>
                    {questions.length > 1 && (
                      <button
                        onClick={() =>
                          setQuestions((prev) => prev.filter((item) => item.id !== q.id))
                        }
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* PACK OPENING & STAGE REVEAL MODAL */}
      {revealState && (
        <PackRevealModal
          pack={revealState.pack}
          pulls={revealState.pulls}
          onClose={() => setRevealState(null)}
          canAffordAnother={tokens >= revealState.pack.price * revealState.pulls.length}
          onOpenAnother={() =>
            handleBuyPacks(revealState.pack, revealState.pulls.length)
          }
        />
      )}

      {/* PACK RATES & SHOWCASE MODAL (CIRCUS & ATHLETES) */}
      {showCircusSheetModal && (
        <div
          onClick={() => setShowCircusSheetModal(false)}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border-4 border-white/30 text-white p-6 md:p-8 max-h-[92vh] overflow-y-auto ${
              showcasePackTab === 'athletes'
                ? 'bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-900'
                : 'bg-gradient-to-br from-[#2d46b9] via-[#4361ee] to-[#1e3a8a]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="font-titan text-3xl md:text-4xl text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.4)]">
                  {showcasePackTab === 'athletes'
                    ? 'Athletes Pack — All 11 Blooks & Exact Drop Rates'
                    : 'Circus Pack — All 15 Blooks & Exact Drop Rates'}
                </h2>
                <p className="font-nunito font-bold text-white/85 text-sm">
                  Click any Blook below to preview its Reveal Card, or buy the pack in the Market for 20 Tokens!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowcasePackTab('circus')}
                  className={`px-4 py-2 rounded-xl font-titan text-sm cursor-pointer transition-all ${
                    showcasePackTab === 'circus'
                      ? 'bg-[#ff4242] text-white shadow-md'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Circus Pack
                </button>
                <button
                  type="button"
                  onClick={() => setShowcasePackTab('athletes')}
                  className={`px-4 py-2 rounded-xl font-titan text-sm cursor-pointer transition-all ${
                    showcasePackTab === 'athletes'
                      ? 'bg-emerald-400 text-emerald-950 shadow-md'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Athletes Pack
                </button>
                <button
                  onClick={() => setShowCircusSheetModal(false)}
                  className="px-5 py-2 rounded-xl bg-white text-slate-900 font-titan text-base shadow-[0_4px_0_#cbd5e1] cursor-pointer whitespace-nowrap shrink-0"
                >
                  Close
                </button>
              </div>
            </div>

            {showcasePackTab === 'athletes' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 items-center">
                {ATHLETES_BLOOKS.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      setShowCircusSheetModal(false);
                      setRevealState({
                        pack: ATHLETES_PACK,
                        pulls: [{ blook: b, isNew: (inventory[b.id] || 0) === 0 }],
                      });
                    }}
                    className="bg-white/15 hover:bg-white/25 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-transform hover:scale-105"
                  >
                    <div className="w-24 h-24 mb-2 flex items-center justify-center">
                      <BlookArt id={b.id} className="w-full h-full" />
                    </div>
                    <span
                      className="font-nunito font-black text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                      style={{ color: RARITY_COLORS[b.rarity] }}
                    >
                      {b.rarity} {b.chanceLabel}
                    </span>
                    <span className="font-nunito font-black text-lg text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]">
                      {b.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5 items-center mb-8">
                  {CIRCUS_BLOOKS.slice(0, 10).map((b) => (
                    <div
                      key={b.id}
                      onClick={() => {
                        setShowCircusSheetModal(false);
                        setRevealState({
                          pack: CIRCUS_PACK,
                          pulls: [{ blook: b, isNew: (inventory[b.id] || 0) === 0 }],
                        });
                      }}
                      className="bg-white/10 hover:bg-white/20 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-transform hover:scale-105"
                    >
                      <div className="w-24 h-24 mb-2 flex items-center justify-center">
                        <BlookArt id={b.id} className="w-full h-full" />
                      </div>
                      <span
                        className="font-nunito font-black text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                        style={{ color: RARITY_COLORS[b.rarity] }}
                      >
                        {b.rarity} {b.chanceLabel}
                      </span>
                      <span className="font-nunito font-black text-lg text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]">
                        {b.name}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl bg-[#6ec3df] p-6 text-slate-900">
                  <h3 className="font-titan text-2xl text-slate-900 mb-4">
                    Legendary, Chroma & Mystic Circus Blooks
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5 items-center">
                    {CIRCUS_BLOOKS.slice(10).map((b) => (
                      <div
                        key={b.id}
                        onClick={() => {
                          setShowCircusSheetModal(false);
                          setRevealState({
                            pack: CIRCUS_PACK,
                            pulls: [{ blook: b, isNew: (inventory[b.id] || 0) === 0 }],
                          });
                        }}
                        className="bg-white/35 hover:bg-white/55 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-transform hover:scale-105"
                      >
                        <div className="w-24 h-24 mb-2 flex items-center justify-center">
                          <BlookArt id={b.id} className="w-full h-full" />
                        </div>
                        <span
                          className="font-nunito font-black text-base"
                          style={{ color: RARITY_COLORS[b.rarity] }}
                        >
                          {b.rarity} {b.chanceLabel}
                        </span>
                        <span className="font-nunito font-black text-lg text-black">
                          {b.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PULL HISTORY MODAL */}
      {showHistoryModal && (
        <div
          onClick={() => setShowHistoryModal(false)}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-titan text-2xl text-[#dc2626]">Recent Pack Pulls</h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 font-nunito font-extrabold text-sm text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
            {pullHistory.length === 0 ? (
              <p className="font-nunito font-bold text-slate-500 py-8 text-center">
                No packs opened yet! Click the Circus Pack (20 Tokens) in the Market to open your first pack.
              </p>
            ) : (
              <div className="overflow-y-auto flex flex-col gap-2 pr-1">
                {pullHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11">
                        <BlookArt id={item.blook.id} className="w-full h-full" />
                      </div>
                      <div>
                        <p className="font-nunito font-black text-slate-800 text-sm">
                          {item.blook.name}{' '}
                          {item.isNew && (
                            <span className="text-xs text-emerald-600 font-black">
                              (NEW!)
                            </span>
                          )}
                        </p>
                        <p
                          className="font-nunito font-black text-xs"
                          style={{ color: RARITY_COLORS[item.blook.rarity] }}
                        >
                          {item.blook.rarity} · {item.blook.chanceLabel}
                        </p>
                      </div>
                    </div>
                    <span className="font-nunito font-bold text-xs text-slate-400">
                      {item.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENAME USERNAME MODAL */}
      {showRenameModal && (
        <div
          onClick={() => setShowRenameModal(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-slate-800 animate-pop-reveal"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center p-1.5 shrink-0">
                {activeAvatarBlookId ? (
                  <BlookArt id={activeAvatarBlookId} className="w-full h-full" />
                ) : (
                  <User className="w-6 h-6 text-[#dc2626]" />
                )}
              </div>
              <div>
                <h2 className="font-titan text-2xl text-[#dc2626] leading-tight">
                  Change Username
                </h2>
                <p className="font-nunito font-bold text-xs text-slate-400">
                  Visible in top profile bar and Clicket games
                </p>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmed = tempUsername.trim();
                if (trimmed.length < 2) {
                  setRenameError('Username must be at least 2 characters.');
                  return;
                }
                if (trimmed === username) {
                  setShowRenameModal(false);
                  return;
                }
                setRenameError(null);
                setRenameLoading(true);
                try {
                  const res = await apiFetch('/api/user/rename', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${sessionToken}`,
                    },
                    body: JSON.stringify({ username: trimmed }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    setRenameError(data.error || 'Could not update username.');
                    return;
                  }
                  setUsername(data.user.username);
                  setCurrentUser(data.user);
                  setShowRenameModal(false);
                } catch {
                  setRenameError('Network error while checking username.');
                } finally {
                  setRenameLoading(false);
                }
              }}
            >
              {renameError && (
                <div className="mb-3 px-3.5 py-2 rounded-xl bg-rose-50 border-2 border-rose-200 text-rose-700 font-nunito font-extrabold text-xs">
                  {renameError}
                </div>
              )}

              <div className="mb-5">
                <label className="block font-nunito font-black text-xs text-slate-500 mb-1.5">
                  NEW USERNAME
                </label>
                <input
                  type="text"
                  maxLength={30}
                  autoFocus
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  placeholder="Enter unique username..."
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 font-nunito font-extrabold text-slate-800 text-lg focus:outline-none focus:border-[#dc2626] focus:ring-2 focus:ring-red-200"
                />
                <span className="block mt-1 text-right text-[11px] font-nunito font-bold text-slate-400">
                  {tempUsername.length}/30 characters
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-nunito font-black text-sm cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameLoading || tempUsername.trim().length < 2}
                  className="flex-1 py-2.5 rounded-xl bg-[#f87171] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_4px_0_#dc2626] text-white font-titan text-base cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {renameLoading ? 'Checking...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div
          onClick={() => setShowSettingsModal(false)}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl text-slate-800"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-titan text-2xl text-[#dc2626]">Game Settings</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 font-nunito font-extrabold text-sm text-slate-700 cursor-pointer"
              >
                Done
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block font-nunito font-black text-xs text-slate-500 mb-1">
                  PLAYER USERNAME
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2 rounded-xl border-2 border-slate-200 bg-slate-50 font-nunito font-bold text-slate-800">
                    {username}
                  </div>
                  <button
                    onClick={() => {
                      setTempUsername(username);
                      setRenameError(null);
                      setShowRenameModal(true);
                      setShowSettingsModal(false);
                    }}
                    className="px-3 py-2 rounded-xl bg-red-50 text-[#dc2626] font-nunito font-extrabold text-xs cursor-pointer hover:bg-red-100"
                  >
                    Rename
                  </button>
                </div>
              </div>

              {/* Token buttons ONLY for 354245082@educ.dpcdsb.org */}
              {isPrivilegedTokenUser && (
                <div>
                  <label className="block font-nunito font-black text-xs text-slate-500 mb-1">
                    TOKEN BALANCE CONTROLS
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setTokens((t) => t + 100)}
                      className="py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-nunito font-black text-sm cursor-pointer"
                    >
                      +100 Tokens
                    </button>
                    <button
                      onClick={() => setTokens((t) => t + 1000)}
                      className="py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-nunito font-black text-sm cursor-pointer"
                    >
                      +1,000 Tokens
                    </button>
                    <button
                      onClick={() => setTokens((t) => t + 10000)}
                      className="py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-nunito font-black text-sm cursor-pointer"
                    >
                      +10,000 Tokens
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-nunito font-black text-xs text-slate-500 mb-1">
                  RARE / CHROMA / MYSTIC LUCK MODE
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '1x (Exact PNG)', val: 1 },
                    { label: '25x Boost', val: 25 },
                    { label: '500x Hyper', val: 500 },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setLuckMultiplier(opt.val)}
                      className={`py-2 rounded-xl font-nunito font-extrabold text-xs border-2 cursor-pointer ${
                        luckMultiplier === opt.val
                          ? 'bg-red-100 border-[#dc2626] text-[#dc2626]'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setInventory({});
                    setEquippedBlookId('');
                    setPullHistory([]);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-nunito font-extrabold text-xs cursor-pointer"
                >
                  Reset Unlocked Blooks
                </button>
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    handleLogout();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-nunito font-extrabold text-xs cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* INCOMING 1-TO-1 TRADE INVITE POPUP WHEN BROWSING OTHER TABS */}
      {activeTrade &&
        activeTrade.status === 'PENDING' &&
        activeTab !== 'Trading' &&
        activeTrade.target?.clientId === presenceClientId && (
          <div className="fixed bottom-5 right-5 z-50 bg-white rounded-3xl p-4 shadow-2xl border-4 border-[#dc2626] max-w-sm w-full animate-pop-reveal">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center shrink-0">
                <Handshake className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-titan text-lg text-[#dc2626] leading-tight">
                  Incoming Blook Trade!
                </h3>
                <p className="font-nunito font-bold text-xs text-slate-600 mt-0.5">
                  <strong>{activeTrade.initiator?.username}</strong> wants to do a 1-to-1 trade.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      sendPresenceWs({
                        type: 'trade:respond',
                        tradeId: activeTrade.tradeId,
                        accept: true,
                      });
                      setActiveTab('Trading');
                    }}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-titan text-sm cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      sendPresenceWs({
                        type: 'trade:respond',
                        tradeId: activeTrade.tradeId,
                        accept: false,
                      })
                    }
                    className="flex-1 py-1.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-titan text-sm cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      {/* PACK PURCHASE / BUY MULTIPLE POP-UP MODAL (SHOWN ONLY WHEN CLICKING A PACK) */}
      {purchaseModalPack && (() => {
        const isAthletesModal = purchaseModalPack.id === 'athletes';
        const maxAffordableForModal = Math.max(
          1,
          Math.min(100, Math.floor(tokens / purchaseModalPack.price))
        );
        const totalModalCost = purchaseModalPack.price * purchaseQuantity;
        const unlockedInPack = purchaseModalPack.blooks.filter(
          (b) => (inventory[b.id] || 0) > 0
        ).length;
        const canAffordModal = tokens >= totalModalCost;

        return (
          <div
            onClick={() => setPurchaseModalPack(null)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl text-slate-800 animate-pop-reveal border-4"
              style={{ borderColor: purchaseModalPack.borderColor }}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center p-1.5 shrink-0 border-2"
                    style={{
                      backgroundColor: purchaseModalPack.bgColor,
                      borderColor: purchaseModalPack.borderColor,
                    }}
                  >
                    <PackCoverArt
                      packId={purchaseModalPack.id}
                      className={isAthletesModal ? 'w-20 h-16' : 'w-14 h-16'}
                    />
                  </div>
                  <div>
                    <h2
                      className={`font-titan text-2xl leading-tight ${
                        isAthletesModal ? 'text-emerald-700' : 'text-[#dc2626]'
                      }`}
                    >
                      {purchaseModalPack.name}
                    </h2>
                    <p className="font-nunito font-black text-xs text-slate-400 mt-0.5">
                      {unlockedInPack}/{purchaseModalPack.blooks.length} Unlocked ·{' '}
                      {purchaseModalPack.price} Tokens each
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close pack purchase popup"
                  onClick={() => setPurchaseModalPack(null)}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Buy Multiple Quantity Selector */}
              <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 mb-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-titan text-base text-slate-800">
                    Choose How Many to Open
                  </span>
                  <span className="font-nunito font-extrabold text-xs text-slate-500 flex items-center gap-1">
                    <BlooketTokenIcon className="w-4 h-4" />
                    <span>{tokens.toLocaleString()} available</span>
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  {[1, 5, 10, 25].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPurchaseQuantity(preset)}
                      className={`py-2 rounded-xl font-nunito font-black text-xs cursor-pointer transition-colors ${
                        purchaseQuantity === preset
                          ? isAthletesModal
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#dc2626] text-white'
                          : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {preset}x
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPurchaseQuantity(maxAffordableForModal)}
                    className="py-2 rounded-xl font-nunito font-black text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 cursor-pointer"
                  >
                    Max
                  </button>
                </div>

                {/* Custom Numeric Amount Input + Live Cost */}
                <div className="flex items-center gap-2">
                  <label className="font-nunito font-black text-xs text-slate-500 shrink-0">
                    Amount:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={purchaseQuantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (Number.isNaN(val)) {
                        setPurchaseQuantity(1);
                      } else {
                        setPurchaseQuantity(Math.max(1, Math.min(100, val)));
                      }
                    }}
                    className={`w-24 px-3 py-1.5 rounded-xl border-2 border-slate-200 bg-white font-nunito font-black text-sm text-center text-slate-800 focus:outline-none ${
                      isAthletesModal ? 'focus:border-emerald-600' : 'focus:border-[#dc2626]'
                    }`}
                  />
                  <span className="font-nunito font-black text-sm text-slate-700 ml-auto flex items-center gap-1.5">
                    <span>Total:</span>
                    <BlooketTokenIcon className="w-5 h-5" />
                    <span>{totalModalCost.toLocaleString()}</span>
                  </span>
                </div>
              </div>

              {!canAffordModal && (
                <div className="mb-3 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-nunito font-extrabold text-xs text-center">
                  You need {(totalModalCost - tokens).toLocaleString()} more tokens for{' '}
                  {purchaseQuantity} {purchaseQuantity === 1 ? 'pack' : 'packs'}.
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  const chosenPack = purchaseModalPack;
                  const chosenQty = purchaseQuantity;
                  setPurchaseModalPack(null);
                  handleBuyPacks(chosenPack, chosenQty);
                }}
                className={`w-full py-3 rounded-2xl font-titan text-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  canAffordModal
                    ? isAthletesModal
                      ? 'bg-emerald-500 hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_5px_0_#15803d] text-white'
                      : 'bg-[#f87171] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_5px_0_#dc2626] text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <BlooketTokenIcon className="w-6 h-6" />
                <span>
                  Open {purchaseQuantity} {purchaseModalPack.name}
                  {purchaseQuantity === 1 ? '' : 's'} ({totalModalCost.toLocaleString()})
                </span>
              </button>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowcasePackTab(isAthletesModal ? 'athletes' : 'circus');
                    setPurchaseModalPack(null);
                    setShowCircusSheetModal(true);
                  }}
                  className={`py-2 rounded-xl font-nunito font-extrabold text-xs transition-colors cursor-pointer ${
                    isAthletesModal
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                      : 'bg-red-50 hover:bg-red-100 text-[#dc2626]'
                  }`}
                >
                  View Drop Chances
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseModalPack(null)}
                  className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-nunito font-extrabold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <HourlyTokenDropOverlay
        burst={hourlyTokenBurst}
        targetRef={tokenCounterRef}
        onProgressTokens={(displayed, pulse) => {
          setTokenDisplayOverride(displayed);
          if (pulse) {
            setTokenPillPulse(true);
            if (tokenPillPulseTimeoutRef.current) {
              clearTimeout(tokenPillPulseTimeoutRef.current);
            }
            tokenPillPulseTimeoutRef.current = setTimeout(() => {
              setTokenPillPulse(false);
            }, 90);
          }
        }}
        onComplete={() => {
          setHourlyTokenBurst(null);
          setTokenDisplayOverride(null);
          setTokenPillPulse(false);
        }}
      />
    </div>
  );
}
