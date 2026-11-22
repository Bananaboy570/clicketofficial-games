import type http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

export type GameMode = 'vault_heist' | 'curse_roulette' | 'bounty_board';
export type CurseType = 'scrambled_keys' | 'tax_collector' | 'fog_screen';

export interface RoomQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  category: string;
}

export interface RoomPlayer {
  playerId: string;
  userId?: string;
  username: string;
  blookId: string | null;
  cash: number;
  correctAnswers: number;
  streak: number;
  // Vault Heist
  drillEnergy: number;
  heistPending: boolean;
  // Curse Roulette
  pendingCurse: CurseType | null;
  scrambledUntil: number;
  taxCollectorCharges: number;
  taxCollectorBeneficiaryId: string | null;
  taxCollectorBeneficiaryName: string | null;
  fogLevel: number;
  // Bounty Board
  pendingClaim: 'sniper' | 'capture' | null;
  connected: boolean;
}

export interface RoomEventLog {
  id: string;
  text: string;
  tone: 'info' | 'steal' | 'curse' | 'bounty' | 'alarm' | 'win';
  timestamp: number;
}

export interface GameRoom {
  code: string;
  hostClientId: string;
  hostName: string;
  setId: string;
  setTitle: string;
  mode: GameMode;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  questions: RoomQuestion[];
  durationSeconds: number;
  targetCashGoal: number;
  startedAt: number | null;
  endsAt: number | null;
  winnerId: string | null;
  players: Map<string, RoomPlayer>;
  sockets: Map<string, WebSocket>;
  events: RoomEventLog[];
  timerHandle?: ReturnType<typeof setInterval>;
}

interface ClientMeta {
  clientId: string;
  roomCode: string | null;
  role: 'host' | 'player' | null;
  userId?: string;
}

export interface OnlineClient {
  clientId: string;
  ws: WebSocket;
  userId: string;
  username: string;
  avatarBlookId: string;
  unlockedCount: number;
  inventory: Record<string, number>;
  activeTradeId: string | null;
}

export interface TradeSession {
  tradeId: string;
  initiatorClientId: string;
  targetClientId: string;
  status: 'PENDING' | 'NEGOTIATING' | 'COMPLETED' | 'CANCELLED';
  offerByClient: Record<string, string | null>;
  acceptedByClient: Record<string, boolean>;
}

export interface MultiplayerDeps {
  onRecordSetPlay: (setId: string, userId?: string) => Promise<void>;
  onAwardTokens: (userId: string, amount: number) => Promise<void>;
  onExecuteBlookTrade: (
    userIdA: string,
    blookIdA: string,
    userIdB: string,
    blookIdB: string
  ) => Promise<{
    ok: boolean;
    error?: string;
    inventoryA?: Record<string, number>;
    equippedA?: string;
    historyEntryA?: {
      id: string;
      timestamp: string;
      partnerUsername: string;
      gaveBlookId: string;
      receivedBlookId: string;
    };
    inventoryB?: Record<string, number>;
    equippedB?: string;
    historyEntryB?: {
      id: string;
      timestamp: string;
      partnerUsername: string;
      gaveBlookId: string;
      receivedBlookId: string;
    };
  }>;
}

function generateSevenDigitCode(existing: Map<string, GameRoom>): string {
  for (let i = 0; i < 40; i++) {
    const code = String(Math.floor(1000000 + Math.random() * 9000000));
    if (!existing.has(code)) return code;
  }
  return String(Date.now()).slice(-7);
}

function pushEvent(
  room: GameRoom,
  text: string,
  tone: RoomEventLog['tone'] = 'info'
) {
  room.events.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    tone,
    timestamp: Date.now(),
  });
  if (room.events.length > 25) {
    room.events.length = 25;
  }
}

function serializeRoom(room: GameRoom) {
  const playersArr = Array.from(room.players.values());
  const sorted = [...playersArr].sort((a, b) => b.cash - a.cash);
  const wantedTop3 = sorted
    .filter((p) => p.cash > 0)
    .slice(0, 3)
    .map((p, idx) => ({
      rank: idx + 1,
      playerId: p.playerId,
      username: p.username,
      blookId: p.blookId,
      cash: p.cash,
      bounty: Math.max(100, Math.round(p.cash * 0.4)),
    }));

  const claimedBlooks: Record<string, { playerId: string; username: string }> = {};
  for (const p of playersArr) {
    if (p.blookId) {
      claimedBlooks[p.blookId] = { playerId: p.playerId, username: p.username };
    }
  }

  return {
    code: room.code,
    hostClientId: room.hostClientId,
    hostName: room.hostName,
    setId: room.setId,
    setTitle: room.setTitle,
    mode: room.mode,
    status: room.status,
    questions: room.questions,
    durationSeconds: room.durationSeconds,
    targetCashGoal: room.targetCashGoal,
    startedAt: room.startedAt,
    endsAt: room.endsAt,
    winnerId: room.winnerId,
    players: sorted,
    claimedBlooks,
    wantedTop3,
    events: room.events.slice(0, 12),
    serverNow: Date.now(),
  };
}

function broadcastRoom(room: GameRoom) {
  const payload = JSON.stringify({
    type: 'room:state',
    room: serializeRoom(room),
  });
  for (const ws of room.sockets.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function sendError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'room:error', error: message }));
  }
}

export function attachMultiplayerServer(
  httpServer: http.Server,
  deps: MultiplayerDeps
) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const rooms = new Map<string, GameRoom>();
  const onlineClients = new Map<string, OnlineClient>();
  const trades = new Map<string, TradeSession>();
  const clientMeta = new WeakMap<WebSocket, ClientMeta>();

  const broadcastPresence = () => {
    const players = Array.from(onlineClients.values()).map((c) => ({
      clientId: c.clientId,
      userId: c.userId,
      username: c.username,
      avatarBlookId: c.avatarBlookId,
      unlockedCount: c.unlockedCount,
      inTrade: Boolean(c.activeTradeId),
    }));
    const payload = JSON.stringify({ type: 'presence:list', players });
    for (const c of onlineClients.values()) {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(payload);
      }
    }
  };

  const serializeTrade = (trade: TradeSession) => {
    const a = onlineClients.get(trade.initiatorClientId);
    const b = onlineClients.get(trade.targetClientId);
    return {
      tradeId: trade.tradeId,
      status: trade.status,
      initiator: a
        ? {
            clientId: a.clientId,
            userId: a.userId,
            username: a.username,
            avatarBlookId: a.avatarBlookId,
          }
        : null,
      target: b
        ? {
            clientId: b.clientId,
            userId: b.userId,
            username: b.username,
            avatarBlookId: b.avatarBlookId,
          }
        : null,
      offerByClient: trade.offerByClient,
      acceptedByClient: trade.acceptedByClient,
    };
  };

  const sendTradeState = (trade: TradeSession) => {
    const payload = JSON.stringify({
      type: 'trade:state',
      trade: serializeTrade(trade),
    });
    const a = onlineClients.get(trade.initiatorClientId);
    const b = onlineClients.get(trade.targetClientId);
    if (a && a.ws.readyState === WebSocket.OPEN) a.ws.send(payload);
    if (b && b.ws.readyState === WebSocket.OPEN) b.ws.send(payload);
  };

  const cancelTrade = (tradeId: string, reason: string) => {
    const trade = trades.get(tradeId);
    if (!trade) return;
    trade.status = 'CANCELLED';
    trades.delete(tradeId);

    const a = onlineClients.get(trade.initiatorClientId);
    const b = onlineClients.get(trade.targetClientId);
    if (a) a.activeTradeId = null;
    if (b) b.activeTradeId = null;

    const payload = JSON.stringify({ type: 'trade:cancelled', tradeId, reason });
    if (a && a.ws.readyState === WebSocket.OPEN) a.ws.send(payload);
    if (b && b.ws.readyState === WebSocket.OPEN) b.ws.send(payload);
    broadcastPresence();
  };

  const finishGame = async (room: GameRoom, forcedWinnerId?: string) => {
    if (room.status === 'FINISHED') return;
    room.status = 'FINISHED';
    if (room.timerHandle) {
      clearInterval(room.timerHandle);
      room.timerHandle = undefined;
    }

    const sorted = Array.from(room.players.values()).sort((a, b) => b.cash - a.cash);
    const winner = forcedWinnerId
      ? room.players.get(forcedWinnerId) || sorted[0]
      : sorted[0];

    room.winnerId = winner?.playerId ?? null;
    if (winner) {
      pushEvent(
        room,
        `${winner.username} won ${
          room.mode === 'vault_heist'
            ? 'Vault Heist'
            : room.mode === 'curse_roulette'
            ? 'Curse Roulette'
            : 'Bounty Board'
        } with $${winner.cash.toLocaleString()}!`,
        'win'
      );
    }

    // Award Clicket Tokens to authenticated players based on placement
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (p.userId) {
        const reward = i === 0 ? 100 : i === 1 ? 65 : 40;
        await deps.onAwardTokens(p.userId, reward).catch(() => {});
      }
    }

    broadcastRoom(room);
  };

  wss.on('connection', (ws) => {
    const clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    clientMeta.set(ws, { clientId, roomCode: null, role: null });
    ws.send(JSON.stringify({ type: 'ws:connected', clientId }));

    ws.on('message', async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const meta = clientMeta.get(ws);
      if (!meta) return;

      switch (msg.type) {
        case 'host:create': {
          const mode: GameMode =
            msg.mode === 'curse_roulette' || msg.mode === 'bounty_board'
              ? msg.mode
              : 'vault_heist';
          const questions: RoomQuestion[] = Array.isArray(msg.questions) && msg.questions.length > 0
            ? msg.questions
            : [];
          if (questions.length === 0) {
            sendError(ws, 'At least one question is required to host a game.');
            return;
          }

          const code = generateSevenDigitCode(rooms);
          const room: GameRoom = {
            code,
            hostClientId: meta.clientId,
            hostName: String(msg.hostName || 'Host').slice(0, 18),
            setId: String(msg.setId || 'circus-official'),
            setTitle: String(msg.setTitle || 'Circus Trivia'),
            mode,
            status: 'LOBBY',
            questions,
            durationSeconds: Math.max(45, Math.min(300, Number(msg.durationSeconds) || 120)),
            targetCashGoal: Math.max(500, Math.min(10000, Number(msg.targetCashGoal) || 2000)),
            startedAt: null,
            endsAt: null,
            winnerId: null,
            players: new Map(),
            sockets: new Map([[meta.clientId, ws]]),
            events: [],
          };

          meta.roomCode = code;
          meta.role = 'host';
          meta.userId = typeof msg.userId === 'string' ? msg.userId : undefined;
          rooms.set(code, room);

          pushEvent(room, `Room ${code} opened! Share the 7-digit code to join.`, 'info');
          broadcastRoom(room);
          break;
        }

        case 'player:join': {
          const code = String(msg.code || '').replace(/\D/g, '');
          if (code.length !== 7) {
            sendError(ws, 'Please enter a valid 7-digit game code.');
            return;
          }

          const room = rooms.get(code);
          if (!room) {
            sendError(ws, `No live game found with code ${code}. Ask the host for their 7-digit code.`);
            return;
          }

          if (room.status === 'FINISHED') {
            sendError(ws, 'This game has already finished.');
            return;
          }

          const playerName = String(msg.username || 'Player').trim().slice(0, 18) || 'Player';
          const userId = typeof msg.userId === 'string' ? msg.userId : undefined;

          // If this socket already has a player record, update it; otherwise create one
          let player = room.players.get(meta.clientId);
          if (!player) {
            player = {
              playerId: meta.clientId,
              userId,
              username: playerName,
              blookId: null,
              cash: room.mode === 'curse_roulette' ? 300 : 0,
              correctAnswers: 0,
              streak: 0,
              drillEnergy: 0,
              heistPending: false,
              pendingCurse: null,
              scrambledUntil: 0,
              taxCollectorCharges: 0,
              taxCollectorBeneficiaryId: null,
              taxCollectorBeneficiaryName: null,
              fogLevel: 0,
              pendingClaim: null,
              connected: true,
            };
            room.players.set(meta.clientId, player);
          } else {
            player.username = playerName;
            player.connected = true;
          }

          meta.roomCode = code;
          meta.role = meta.clientId === room.hostClientId ? 'host' : 'player';
          meta.userId = userId;
          room.sockets.set(meta.clientId, ws);

          pushEvent(room, `${playerName} joined the lobby!`, 'info');
          broadcastRoom(room);
          break;
        }

        case 'player:select_blook': {
          const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
          if (!room) return;
          const player = room.players.get(meta.clientId);
          if (!player) return;

          const blookId = String(msg.blookId || '').trim();
          if (!blookId) return;

          // Enforce uniqueness: cannot choose a Blook someone else already has!
          for (const other of room.players.values()) {
            if (other.playerId !== player.playerId && other.blookId === blookId) {
              sendError(
                ws,
                `That Blook is already taken by ${other.username}! Choose a different Blook.`
              );
              return;
            }
          }

          player.blookId = blookId;
          broadcastRoom(room);
          break;
        }

        case 'host:start': {
          const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
          if (!room || room.hostClientId !== meta.clientId) return;
          if (room.players.size === 0) {
            sendError(ws, 'Wait for at least 1 player to join with the 7-digit code before starting.');
            return;
          }

          const unpicked = Array.from(room.players.values()).find((p) => !p.blookId);
          if (unpicked) {
            sendError(ws, `${unpicked.username} still needs to pick a Blook first!`);
            return;
          }

          room.status = 'PLAYING';
          room.startedAt = Date.now();
          room.endsAt =
            room.mode === 'bounty_board'
              ? null
              : Date.now() + room.durationSeconds * 1000;

          // Record actual unique player plays for Discover stats
          for (const p of room.players.values()) {
            await deps.onRecordSetPlay(room.setId, p.userId).catch(() => {});
          }

          pushEvent(room, 'Game started! Answer fast!', 'info');
          broadcastRoom(room);

          if (room.endsAt) {
            room.timerHandle = setInterval(() => {
              if (room.status !== 'PLAYING') return;
              if (room.endsAt && Date.now() >= room.endsAt) {
                finishGame(room);
              }
            }, 500);
          }
          break;
        }

        case 'game:answer': {
          const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
          if (!room || room.status !== 'PLAYING') return;
          const player = room.players.get(meta.clientId);
          if (!player) return;

          const isCorrect = Boolean(msg.isCorrect);

          if (!isCorrect) {
            player.streak = 0;
            broadcastRoom(room);
            return;
          }

          player.correctAnswers += 1;
          player.streak += 1;

          if (room.mode === 'vault_heist') {
            player.drillEnergy = Math.min(100, player.drillEnergy + 35);
            if (player.drillEnergy >= 100) {
              player.heistPending = true;
            }
          } else if (room.mode === 'curse_roulette') {
            // Base question payout (subject to Tax Collector 20% siphon if cursed)
            const basePayout = 100;
            let netPayout = basePayout;
            if (player.taxCollectorCharges > 0 && player.taxCollectorBeneficiaryId) {
              const tax = Math.round(basePayout * 0.2);
              netPayout -= tax;
              player.taxCollectorCharges -= 1;
              const collector = room.players.get(player.taxCollectorBeneficiaryId);
              if (collector) {
                collector.cash += tax;
                pushEvent(
                  room,
                  `Tax Collector siphoned $${tax} from ${player.username} to ${collector.username}!`,
                  'curse'
                );
              }
              if (player.taxCollectorCharges <= 0) {
                player.taxCollectorBeneficiaryId = null;
                player.taxCollectorBeneficiaryName = null;
              }
            }
            player.cash += netPayout;

            // Award a Curse via Mini Slot Reel
            const cursePool: CurseType[] = ['scrambled_keys', 'tax_collector', 'fog_screen'];
            player.pendingCurse = cursePool[Math.floor(Math.random() * cursePool.length)];
          } else if (room.mode === 'bounty_board') {
            const gain = 150 + Math.min(150, (player.streak - 1) * 25);
            player.cash += gain;

            if (player.streak === 3) {
              player.pendingClaim = 'sniper';
            } else if (player.streak >= 6 && player.streak % 6 === 0) {
              player.pendingClaim = 'capture';
            }

            if (player.cash >= room.targetCashGoal) {
              await finishGame(room, player.playerId);
              return;
            }
          }

          broadcastRoom(room);
          break;
        }

        case 'vault:heist': {
          const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
          if (!room || room.status !== 'PLAYING' || room.mode !== 'vault_heist') return;
          const player = room.players.get(meta.clientId);
          if (!player || !player.heistPending) return;

          const action = String(msg.action || 'npc'); // 'npc' | 'quiet' | 'power'
          const targetId = typeof msg.targetPlayerId === 'string' ? msg.targetPlayerId : '';

          if (action === 'npc') {
            const npcCash = 200;
            player.cash += npcCash;
            pushEvent(room, `${player.username} cracked the NPC Vault for +$${npcCash}!`, 'steal');
          } else {
            const target = room.players.get(targetId);
            if (!target || target.playerId === player.playerId) {
              player.cash += 180;
              pushEvent(room, `${player.username} cracked a reserve vault for +$180!`, 'steal');
            } else if (action === 'quiet') {
              const stolen = Math.max(40, Math.round(target.cash * 0.15));
              const actualLoss = Math.min(target.cash, Math.round(target.cash * 0.15));
              target.cash -= actualLoss;
              player.cash += stolen;
              pushEvent(
                room,
                `${player.username} Quiet Picked ${target.username}'s vault for $${stolen}!`,
                'steal'
              );
            } else if (action === 'power') {
              const triggeredAlarm = Math.random() < 0.3;
              if (triggeredAlarm) {
                const wiped = Math.round(player.cash * 0.5);
                player.cash = Math.max(0, player.cash - wiped);
                pushEvent(
                  room,
                  `SILENT ALARM! ${player.username} tried to Power Drill ${target.username} and lost $${wiped}!`,
                  'alarm'
                );
              } else {
                const stolen = Math.max(80, Math.round(target.cash * 0.45));
                const actualLoss = Math.min(target.cash, Math.round(target.cash * 0.45));
                target.cash -= actualLoss;
                player.cash += stolen;
                pushEvent(
                  room,
                  `POWER DRILL! ${player.username} stole $${stolen} from ${target.username}!`,
                  'steal'
                );
              }
            }
          }

          player.drillEnergy = 0;
          player.heistPending = false;
          broadcastRoom(room);
          break;
        }

        case 'curse:fire': {
          const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
          if (!room || room.status !== 'PLAYING' || room.mode !== 'curse_roulette') return;
          const player = room.players.get(meta.clientId);
          if (!player || !player.pendingCurse) return;

          const target = room.players.get(String(msg.targetPlayerId || ''));
          const curse = player.pendingCurse;
          player.pendingCurse = null;

          if (!target || target.playerId === player.playerId) {
            broadcastRoom(room);
            return;
          }

          if (curse === 'scrambled_keys') {
            target.scrambledUntil = Date.now() + 15000;
            pushEvent(
              room,
              `${player.username} hit ${target.username} with Scrambled Keys (15s)!`,
              'curse'
            );
          } else if (curse === 'tax_collector') {
            target.taxCollectorCharges = 3;
            target.taxCollectorBeneficiaryId = player.playerId;
            target.taxCollectorBeneficiaryName = player.username;
            pushEvent(
              room,
              `${player.username} placed Tax Collector on ${target.username} (20% of next 3 payouts)!`,
              'curse'
            );
          } else if (curse === 'fog_screen') {
            target.fogLevel = 100;
            pushEvent(
              room,
              `${player.username} blasted ${target.username} with Fog Screen!`,
              'curse'
            );
          }

          broadcastRoom(room);
          break;
        }

        case 'curse:wipe_fog': {
          const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
          if (!room || room.status !== 'PLAYING') return;
          const player = room.players.get(meta.clientId);
          if (!player) return;

          player.fogLevel = Math.max(0, player.fogLevel - 25);
          broadcastRoom(room);
          break;
        }

        case 'bounty:claim': {
          const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
          if (!room || room.status !== 'PLAYING' || room.mode !== 'bounty_board') return;
          const player = room.players.get(meta.clientId);
          if (!player || !player.pendingClaim) return;

          const target = room.players.get(String(msg.targetPlayerId || ''));
          const claimType = player.pendingClaim;
          player.pendingClaim = null;

          if (!target || target.playerId === player.playerId) {
            broadcastRoom(room);
            return;
          }

          const targetBounty = Math.max(100, Math.round(target.cash * 0.4));
          if (claimType === 'sniper') {
            const reward = Math.max(50, Math.round(targetBounty * 0.25));
            const cashDrop = Math.min(target.cash, Math.round(target.cash * 0.15));
            target.cash -= cashDrop;
            player.cash += reward;
            pushEvent(
              room,
              `SNIPER SHOT! ${player.username} claimed $${reward} (25% bounty) off ${target.username}!`,
              'bounty'
            );
          } else {
            const reward = Math.max(120, Math.round(targetBounty * 0.6));
            const knockDown = Math.min(target.cash, Math.max(150, Math.round(target.cash * 0.35)));
            target.cash -= knockDown;
            player.cash += reward;
            pushEvent(
              room,
              `FULL CAPTURE! ${player.username} claimed $${reward} (60% bounty) and knocked ${target.username} down!`,
              'bounty'
            );
          }

          if (player.cash >= room.targetCashGoal) {
            await finishGame(room, player.playerId);
            return;
          }

          broadcastRoom(room);
          break;
        }

        case 'host:end': {
          const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
          if (!room || room.hostClientId !== meta.clientId) return;
          await finishGame(room);
          break;
        }

        case 'room:leave': {
          const room = meta.roomCode ? rooms.get(meta.roomCode) : undefined;
          if (room) {
            room.sockets.delete(meta.clientId);
            const p = room.players.get(meta.clientId);
            if (p) {
              room.players.delete(meta.clientId);
              pushEvent(room, `${p.username} left the room.`, 'info');
            }
            if (room.sockets.size === 0) {
              if (room.timerHandle) clearInterval(room.timerHandle);
              rooms.delete(room.code);
            } else {
              broadcastRoom(room);
            }
          }
          meta.roomCode = null;
          meta.role = null;
          break;
        }
        case 'presence:register':
        case 'presence:update': {
          const userId = String(msg.userId || '').trim();
          const username = String(msg.username || '').trim();
          if (!userId || !username) return;
          const inv =
            msg.inventory && typeof msg.inventory === 'object'
              ? (msg.inventory as Record<string, number>)
              : {};
          const unlockedCount = Object.values(inv).filter((c) => Number(c) > 0).length;
          const existing = onlineClients.get(meta.clientId);
          onlineClients.set(meta.clientId, {
            clientId: meta.clientId,
            ws,
            userId,
            username,
            avatarBlookId: String(msg.avatarBlookId || ''),
            unlockedCount,
            inventory: inv,
            activeTradeId: existing?.activeTradeId ?? null,
          });
          broadcastPresence();
          break;
        }

        case 'trade:initiate': {
          const initiator = onlineClients.get(meta.clientId);
          const target = onlineClients.get(String(msg.targetClientId || ''));
          if (!initiator || !target) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'trade:error',
                  error: 'That player is no longer online.',
                })
              );
            }
            return;
          }
          if (initiator.clientId === target.clientId || initiator.userId === target.userId) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'trade:error',
                  error: 'You cannot trade with your own account.',
                })
              );
            }
            return;
          }
          if (initiator.activeTradeId || target.activeTradeId) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'trade:error',
                  error: 'One of the players is already in another trade.',
                })
              );
            }
            return;
          }

          const tradeId = `tr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const trade: TradeSession = {
            tradeId,
            initiatorClientId: initiator.clientId,
            targetClientId: target.clientId,
            status: 'PENDING',
            offerByClient: {
              [initiator.clientId]: null,
              [target.clientId]: null,
            },
            acceptedByClient: {
              [initiator.clientId]: false,
              [target.clientId]: false,
            },
          };
          trades.set(tradeId, trade);
          initiator.activeTradeId = tradeId;
          target.activeTradeId = tradeId;

          if (target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(
              JSON.stringify({
                type: 'trade:incoming',
                trade: serializeTrade(trade),
              })
            );
          }
          sendTradeState(trade);
          broadcastPresence();
          break;
        }

        case 'trade:respond': {
          const trade = trades.get(String(msg.tradeId || ''));
          if (!trade || trade.targetClientId !== meta.clientId || trade.status !== 'PENDING') {
            return;
          }
          if (!msg.accept) {
            cancelTrade(trade.tradeId, 'Trade request was declined.');
            return;
          }
          trade.status = 'NEGOTIATING';
          sendTradeState(trade);
          broadcastPresence();
          break;
        }

        case 'trade:select_blook': {
          const trade = trades.get(String(msg.tradeId || ''));
          if (!trade || trade.status !== 'NEGOTIATING') return;
          if (
            meta.clientId !== trade.initiatorClientId &&
            meta.clientId !== trade.targetClientId
          ) {
            return;
          }
          const sender = onlineClients.get(meta.clientId);
          if (!sender) return;

          const blookId = msg.blookId ? String(msg.blookId) : null;
          if (blookId && (sender.inventory[blookId] || 0) < 1) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'trade:error',
                  error: 'You can only offer Blooks that you own.',
                })
              );
            }
            return;
          }

          trade.offerByClient[meta.clientId] = blookId;
          // Any offer change resets both acceptances to protect against bait-and-switch
          trade.acceptedByClient[trade.initiatorClientId] = false;
          trade.acceptedByClient[trade.targetClientId] = false;
          sendTradeState(trade);
          break;
        }

        case 'trade:confirm': {
          const trade = trades.get(String(msg.tradeId || ''));
          if (!trade || trade.status !== 'NEGOTIATING') return;
          if (
            meta.clientId !== trade.initiatorClientId &&
            meta.clientId !== trade.targetClientId
          ) {
            return;
          }

          const offerA = trade.offerByClient[trade.initiatorClientId];
          const offerB = trade.offerByClient[trade.targetClientId];
          if (msg.accepted && (!offerA || !offerB)) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'trade:error',
                  error: 'Both players must pick 1 Blook before confirming.',
                })
              );
            }
            return;
          }

          trade.acceptedByClient[meta.clientId] = Boolean(msg.accepted);
          if (
            trade.acceptedByClient[trade.initiatorClientId] &&
            trade.acceptedByClient[trade.targetClientId] &&
            offerA &&
            offerB
          ) {
            const clientA = onlineClients.get(trade.initiatorClientId);
            const clientB = onlineClients.get(trade.targetClientId);
            if (!clientA || !clientB) {
              cancelTrade(trade.tradeId, 'Partner disconnected during trade.');
              return;
            }

            const result = await deps.onExecuteBlookTrade(
              clientA.userId,
              offerA,
              clientB.userId,
              offerB
            );

            if (!result.ok) {
              trade.acceptedByClient[trade.initiatorClientId] = false;
              trade.acceptedByClient[trade.targetClientId] = false;
              sendTradeState(trade);
              const errPayload = JSON.stringify({
                type: 'trade:error',
                error: result.error || 'Trade could not be completed.',
              });
              if (clientA.ws.readyState === WebSocket.OPEN) clientA.ws.send(errPayload);
              if (clientB.ws.readyState === WebSocket.OPEN) clientB.ws.send(errPayload);
              return;
            }

            trade.status = 'COMPLETED';
            trades.delete(trade.tradeId);
            clientA.activeTradeId = null;
            clientB.activeTradeId = null;
            clientA.inventory = result.inventoryA || clientA.inventory;
            clientB.inventory = result.inventoryB || clientB.inventory;
            clientA.avatarBlookId = result.equippedA ?? clientA.avatarBlookId;
            clientB.avatarBlookId = result.equippedB ?? clientB.avatarBlookId;
            clientA.unlockedCount = Object.values(clientA.inventory).filter((c) => c > 0).length;
            clientB.unlockedCount = Object.values(clientB.inventory).filter((c) => c > 0).length;

            if (clientA.ws.readyState === WebSocket.OPEN) {
              clientA.ws.send(
                JSON.stringify({
                  type: 'trade:completed',
                  tradeId: trade.tradeId,
                  gaveBlookId: offerA,
                  receivedBlookId: offerB,
                  partnerUsername: clientB.username,
                  inventory: clientA.inventory,
                  equippedBlookId: clientA.avatarBlookId,
                  historyEntry: result.historyEntryA,
                })
              );
            }
            if (clientB.ws.readyState === WebSocket.OPEN) {
              clientB.ws.send(
                JSON.stringify({
                  type: 'trade:completed',
                  tradeId: trade.tradeId,
                  gaveBlookId: offerB,
                  receivedBlookId: offerA,
                  partnerUsername: clientA.username,
                  inventory: clientB.inventory,
                  equippedBlookId: clientB.avatarBlookId,
                  historyEntry: result.historyEntryB,
                })
              );
            }
            broadcastPresence();
            return;
          }

          sendTradeState(trade);
          break;
        }

        case 'trade:cancel': {
          const tradeId = String(msg.tradeId || '');
          if (tradeId) {
            cancelTrade(tradeId, 'Trade was cancelled.');
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      const meta = clientMeta.get(ws);
      if (!meta) return;

      const online = onlineClients.get(meta.clientId);
      if (online) {
        if (online.activeTradeId) {
          cancelTrade(online.activeTradeId, `${online.username} disconnected.`);
        }
        onlineClients.delete(meta.clientId);
        broadcastPresence();
      }

      if (!meta.roomCode) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;

      room.sockets.delete(meta.clientId);
      const p = room.players.get(meta.clientId);
      if (p) {
        if (room.status === 'LOBBY') {
          // Release claimed blook in lobby if they disconnect
          room.players.delete(meta.clientId);
          pushEvent(room, `${p.username} disconnected from lobby.`, 'info');
        } else {
          p.connected = false;
        }
      }

      if (room.sockets.size === 0) {
        if (room.timerHandle) clearInterval(room.timerHandle);
        rooms.delete(room.code);
      } else {
        broadcastRoom(room);
      }
    });
  });
}
