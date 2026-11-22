import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users,
  Radio,
  ShieldCheck,
  Zap,
  Crosshair,
  Skull,
  Copy,
  Check,
  Lock,
  ArrowLeft,
  Trophy,
  CloudFog,
  Shuffle,
  Coins,
  Play,
} from 'lucide-react';
import { ALL_BLOOKS, RARITY_COLORS } from '../data/blooks';
import { BlookArt, BlooketTokenIcon } from './BlookArt';
import { GameModeLogo, MultiplayerGameMode } from './GameModeLogo';
import { PlayTriviaView, TriviaQuestion } from './PlayTriviaView';
import { isStaticMode } from '../lib/apiClient';

type CurseType = 'scrambled_keys' | 'tax_collector' | 'fog_screen';

interface RoomPlayer {
  playerId: string;
  userId?: string;
  username: string;
  blookId: string | null;
  cash: number;
  correctAnswers: number;
  streak: number;
  drillEnergy: number;
  heistPending: boolean;
  pendingCurse: CurseType | null;
  scrambledUntil: number;
  taxCollectorCharges: number;
  taxCollectorBeneficiaryId: string | null;
  taxCollectorBeneficiaryName: string | null;
  fogLevel: number;
  pendingClaim: 'sniper' | 'capture' | null;
  connected: boolean;
}

interface WantedPoster {
  rank: number;
  playerId: string;
  username: string;
  blookId: string | null;
  cash: number;
  bounty: number;
}

interface RoomEventLog {
  id: string;
  text: string;
  tone: 'info' | 'steal' | 'curse' | 'bounty' | 'alarm' | 'win';
  timestamp: number;
}

interface RoomState {
  code: string;
  hostClientId: string;
  hostName: string;
  setId: string;
  setTitle: string;
  mode: MultiplayerGameMode;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  questions: TriviaQuestion[];
  durationSeconds: number;
  targetCashGoal: number;
  startedAt: number | null;
  endsAt: number | null;
  winnerId: string | null;
  players: RoomPlayer[];
  claimedBlooks: Record<string, { playerId: string; username: string }>;
  wantedTop3: WantedPoster[];
  events: RoomEventLog[];
  serverNow: number;
}

interface PlayLobbyAndGameProps {
  userId: string;
  username: string;
  questions: TriviaQuestion[];
  activeSetId: string;
  activeSetTitle: string;
  onRefreshUserFromServer: () => void;
  onEarnSoloTokens: (amount: number) => void;
  onRecordSoloPlay: (setId: string) => void;
  onExit: () => void;
}

const MODE_DETAILS: Record<
  MultiplayerGameMode,
  {
    name: string;
    tagline: string;
    rules: string;
    winCondition: string;
    accent: string;
  }
> = {
  vault_heist: {
    name: 'Vault Heist',
    tagline: 'Charge your Drill Energy & crack rival vaults!',
    rules:
      'Every correct answer charges Drill Energy. At 100%, pick from 3 vaults: a Safe NPC Vault for guaranteed cash, or a Rival Vault using Quiet Pick (15% safe) or Power Drill (45% steal, 30% Silent Alarm risk).',
    winCondition: 'Most cash in the bank when the timer hits zero.',
    accent: '#2563eb',
  },
  curse_roulette: {
    name: 'Curse Roulette',
    tagline: 'Spin the slot reel on correct answers & curse rivals!',
    rules:
      'Correct answers spin a mini Curse Slot Reel awarding Scrambled Keys (shuffles buttons 15s), Tax Collector (siphons 20% of their next 3 payouts), or Fog Screen (smoke they must wipe away).',
    winCondition: 'Highest score when the timer ends.',
    accent: '#dc2626',
  },
  bounty_board: {
    name: 'Bounty Board',
    tagline: 'Hunt the Top 3 Wanted Posters for massive payouts!',
    rules:
      'Top 3 leaders get live Wanted Posters. Build a 3-question streak for Sniper Shot (25% bounty) or 6-question streak for Full Capture (60% bounty + knock them down!).',
    winCondition: 'First player to reach the target cash goal wins.',
    accent: '#dc2626',
  },
};

export const PlayLobbyAndGame: React.FC<PlayLobbyAndGameProps> = ({
  userId,
  username,
  questions,
  activeSetId,
  activeSetTitle,
  onRefreshUserFromServer,
  onEarnSoloTokens,
  onRecordSoloPlay,
  onExit,
}) => {
  const [view, setView] = useState<'MENU' | 'HOST_MODE' | 'JOIN_CODE' | 'ROOM' | 'SOLO'>('MENU');

  // Join & Host state
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [selectedHostMode, setSelectedHostMode] = useState<MultiplayerGameMode>('vault_heist');
  const [hostDuration, setHostDuration] = useState<number>(120);
  const [hostTargetCash, setHostTargetCash] = useState<number>(2000);
  const [copiedCode, setCopiedCode] = useState(false);

  // WebSocket & Room state
  const wsRef = useRef<WebSocket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [wsReady, setWsReady] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  // Gameplay local question index & feedback
  const [qIdx, setQIdx] = useState(0);
  const [feedbackBanner, setFeedbackBanner] = useState<{ correct: boolean; text: string } | null>(null);
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [revealedCurse, setRevealedCurse] = useState<CurseType | null>(null);
  const [selectedVaultTarget, setSelectedVaultTarget] = useState<string | null>(null);
  const [buttonOrder, setButtonOrder] = useState<number[]>([0, 1, 2, 3]);

  // Connect WebSocket when needed
  const ensureSocket = (): Promise<WebSocket> => {
    if (isStaticMode()) {
      return Promise.reject(
        new Error('Live multiplayer lobbies require the live server. Try Solo Practice below!')
      );
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return Promise.resolve(wsRef.current);
    }

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsReady(true);
        resolve(ws);
      };
      ws.onerror = () => {
        setRoomError('Could not connect to multiplayer server. Solo Practice works anytime!');
        reject(new Error('WebSocket error'));
      };
      ws.onclose = () => {
        setWsReady(false);
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ws:connected') {
            setClientId(msg.clientId);
          } else if (msg.type === 'room:state') {
            setRoom(msg.room);
            setRoomError(null);
            setView('ROOM');
            if (msg.room?.status === 'FINISHED') {
              onRefreshUserFromServer();
            }
          } else if (msg.type === 'room:error') {
            setRoomError(msg.error || 'Game error');
          }
        } catch {
          // Ignore malformed message
        }
      };
    });
  };

  useEffect(() => {
    const t = setInterval(() => setClockNow(Date.now()), 250);
    return () => {
      clearInterval(t);
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
        }
        wsRef.current.close();
      }
    };
  }, []);

  const myPlayer = useMemo(() => {
    if (!room || !clientId) return null;
    return room.players.find((p) => p.playerId === clientId) || null;
  }, [room, clientId]);

  const isHost = Boolean(room && clientId && room.hostClientId === clientId);
  const isScrambled = Boolean(myPlayer && clockNow < myPlayer.scrambledUntil);

  // Shuffle button order whenever Scrambled Keys becomes active or question advances
  useEffect(() => {
    if (isScrambled) {
      setButtonOrder([0, 1, 2, 3].sort(() => Math.random() - 0.5));
    } else {
      setButtonOrder([0, 1, 2, 3]);
    }
  }, [isScrambled, qIdx]);

  // Curse Slot Reel animation trigger when pendingCurse appears
  useEffect(() => {
    if (myPlayer?.pendingCurse) {
      setSlotSpinning(true);
      setRevealedCurse(myPlayer.pendingCurse);
      const t = setTimeout(() => setSlotSpinning(false), 1000);
      return () => clearTimeout(t);
    } else {
      setSlotSpinning(false);
      setRevealedCurse(null);
    }
  }, [myPlayer?.pendingCurse]);

  const sendWs = (payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const handleCreateHostRoom = async () => {
    setRoomError(null);
    try {
      const ws = await ensureSocket();
      ws.send(
        JSON.stringify({
          type: 'host:create',
          mode: selectedHostMode,
          hostName: username,
          userId,
          setId: activeSetId,
          setTitle: activeSetTitle,
          questions,
          durationSeconds: hostDuration,
          targetCashGoal: hostTargetCash,
        })
      );
    } catch (err) {
      setRoomError(
        err instanceof Error
          ? err.message
          : 'Unable to reach multiplayer server. Solo Practice works anytime!'
      );
    }
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomError(null);
    const cleaned = joinCodeInput.replace(/\D/g, '');
    if (cleaned.length !== 7) {
      setRoomError('Please enter a valid 7-digit game code.');
      return;
    }
    try {
      const ws = await ensureSocket();
      ws.send(
        JSON.stringify({
          type: 'player:join',
          code: cleaned,
          username,
          userId,
        })
      );
    } catch (err) {
      setRoomError(
        err instanceof Error
          ? err.message
          : 'Unable to reach multiplayer server. Solo Practice works anytime!'
      );
    }
  };

  const handleHostAlsoPlay = () => {
    if (!room) return;
    sendWs({
      type: 'player:join',
      code: room.code,
      username,
      userId,
    });
  };

  const handleLeaveRoom = () => {
    sendWs({ type: 'room:leave' });
    setRoom(null);
    setRoomError(null);
    setView('MENU');
  };

  const handleAnswerOption = (optionIdx: number) => {
    if (!room || !myPlayer || room.status !== 'PLAYING' || feedbackBanner) return;
    if (myPlayer.heistPending || myPlayer.pendingCurse || myPlayer.pendingClaim) return;

    const currentQ = room.questions[qIdx % room.questions.length];
    const correct = optionIdx === currentQ.correctIndex;
    sendWs({ type: 'game:answer', isCorrect: correct });

    setFeedbackBanner({
      correct,
      text: correct
        ? room.mode === 'vault_heist'
          ? 'Correct! +35% Drill Energy!'
          : room.mode === 'curse_roulette'
          ? 'Correct! Spinning Curse Roulette...'
          : `Correct! Streak x${myPlayer.streak + 1}`
        : `Incorrect! Answer: ${currentQ.options[currentQ.correctIndex]}`,
    });

    setTimeout(() => {
      setFeedbackBanner(null);
      setQIdx((i) => i + 1);
    }, 850);
  };

  if (view === 'SOLO') {
    return (
      <PlayTriviaView
        questions={questions}
        onEarnTokens={onEarnSoloTokens}
        onExit={() => setView('MENU')}
      />
    );
  }

  const timeLeftSec =
    room?.endsAt != null ? Math.max(0, Math.ceil((room.endsAt - clockNow) / 1000)) : null;

  return (
    <div className="h-full w-full flex flex-col p-6 md:p-8 overflow-y-auto">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {view !== 'MENU' && (
            <button
              type="button"
              onClick={view === 'ROOM' ? handleLeaveRoom : () => setView('MENU')}
              className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-titan text-white text-4xl tracking-wide drop-shadow-[0_3px_0_rgba(0,0,0,0.22)]">
              Play Online
            </h1>
            <p className="font-nunito font-extrabold text-white/90 text-sm">
              Host a 7-digit lobby or enter a host&apos;s 7-digit code to compete live
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (room) handleLeaveRoom();
            onExit();
          }}
          className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-nunito font-extrabold text-sm cursor-pointer whitespace-nowrap shrink-0"
        >
          Back to Market
        </button>
      </div>

      {roomError && (
        <div className="mb-5 max-w-2xl bg-rose-500 text-white font-nunito font-extrabold text-sm px-4 py-3 rounded-2xl shadow-lg">
          {roomError}
        </div>
      )}

      {/* VIEW 1: PLAY MENU (ENTER 7-DIGIT CODE OR HOST) */}
      {view === 'MENU' && (
        <div className="max-w-5xl w-full mx-auto flex flex-col gap-6 my-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Join with 7-Digit Code */}
            <div className="bg-white rounded-3xl p-7 shadow-[0_10px_0_rgba(0,0,0,0.18)] flex flex-col justify-between text-slate-800">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-[#f87171] flex items-center justify-center mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <h2 className="font-titan text-3xl text-[#f87171] mb-2">
                  Join Live Game
                </h2>
                <p className="font-nunito font-bold text-slate-600 text-sm mb-5">
                  Enter the 7-digit code shown on the host&apos;s screen, then claim any unclaimed Circus Blook!
                </p>

                <form onSubmit={handleJoinWithCode} className="flex flex-col gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    value={joinCodeInput}
                    onChange={(e) =>
                      setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 7))
                    }
                    placeholder="7-Digit Code (e.g. 4829103)"
                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-200 font-titan text-2xl tracking-[0.2em] text-center text-slate-900 focus:outline-none focus:border-[#f87171]"
                  />
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-[#f87171] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_6px_0_#dc2626] text-white font-titan text-xl cursor-pointer transition-all"
                  >
                    Join With 7-Digit Code
                  </button>
                </form>
              </div>
            </div>

            {/* Host a Game (Choose 1 of 3 Modes) */}
            <div className="bg-white rounded-3xl p-7 shadow-[0_10px_0_rgba(0,0,0,0.18)] flex flex-col justify-between text-slate-800">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center mb-4">
                  <Radio className="w-6 h-6" />
                </div>
                <h2 className="font-titan text-3xl text-[#dc2626] mb-2">
                  Host a Live Lobby
                </h2>
                <p className="font-nunito font-bold text-slate-600 text-sm mb-5">
                  Pick from 3 original game modes—Vault Heist, Curse Roulette, or Bounty Board—and get a 7-digit code for your screen!
                </p>
                <div className="flex items-center justify-center gap-4 mb-5">
                  <GameModeLogo mode="vault_heist" className="w-16 h-16" />
                  <GameModeLogo mode="curse_roulette" className="w-16 h-16" />
                  <GameModeLogo mode="bounty_board" className="w-16 h-16" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setView('HOST_MODE')}
                className="w-full py-3.5 rounded-2xl bg-[#dc2626] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_6px_0_#991b1b] text-white font-titan text-xl cursor-pointer transition-all"
              >
                Choose Game Mode & Host
              </button>
            </div>
          </div>

          {/* Secondary Solo Trivia Practice */}
          <div className="bg-white/95 rounded-2xl p-4 shadow-[0_6px_0_rgba(0,0,0,0.15)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12">
                <BlookArt id="jester" className="w-full h-full" />
              </div>
              <div>
                <h3 className="font-titan text-lg text-slate-800">
                  Want Quick Solo Practice?
                </h3>
                <p className="font-nunito font-bold text-xs text-slate-500">
                  Play Circus Gold Quest solo to earn Clicket Tokens anytime.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onRecordSoloPlay(activeSetId);
                setView('SOLO');
              }}
              className="px-5 py-2.5 rounded-xl bg-[#fbbf24] text-amber-950 font-titan text-base shadow-[0_4px_0_#b45309] cursor-pointer whitespace-nowrap shrink-0"
            >
              Solo Practice
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: HOST CHOOSES BETWEEN 3 GAME MODES */}
      {view === 'HOST_MODE' && (
        <div className="max-w-5xl w-full mx-auto">
          <h2 className="font-titan text-white text-3xl mb-2 drop-shadow-[0_2px_0_rgba(0,0,0,0.2)]">
            Step 1: Choose Your Game Mode
          </h2>
          <p className="font-nunito font-bold text-white/90 text-sm mb-6">
            Select a game mode below, then generate your 7-digit lobby code for players to join.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {(['vault_heist', 'curse_roulette', 'bounty_board'] as MultiplayerGameMode[]).map(
              (m) => {
                const info = MODE_DETAILS[m];
                const isSelected = selectedHostMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedHostMode(m)}
                    className={`text-left bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)] border-4 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#fbbf24] scale-[1.02]'
                        : 'border-transparent hover:-translate-y-1'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <GameModeLogo mode={m} className="w-20 h-20" />
                        {isSelected && (
                          <span className="px-3 py-1 rounded-xl bg-[#fbbf24] text-amber-950 font-nunito font-black text-xs">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <h3 className="font-titan text-2xl text-slate-900 mb-1">
                        {info.name}
                      </h3>
                      <p className="font-nunito font-black text-xs mb-3" style={{ color: info.accent }}>
                        {info.tagline}
                      </p>
                      <p className="font-nunito font-bold text-xs text-slate-600 leading-relaxed mb-3">
                        {info.rules}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-100">
                      <span className="font-nunito font-black text-[11px] text-slate-400 uppercase">
                        Win Condition
                      </span>
                      <p className="font-nunito font-extrabold text-xs text-slate-800">
                        {info.winCondition}
                      </p>
                    </div>
                  </button>
                );
              }
            )}
          </div>

          {/* Match Settings & Create Lobby */}
          <div className="bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="block font-nunito font-black text-xs text-slate-400">
                  ACTIVE QUESTION SET
                </span>
                <span className="font-titan text-lg text-slate-800">
                  {activeSetTitle} ({questions.length} Qs)
                </span>
              </div>

              {selectedHostMode === 'bounty_board' ? (
                <div>
                  <label className="block font-nunito font-black text-xs text-slate-400 mb-1">
                    TARGET CASH GOAL
                  </label>
                  <select
                    value={hostTargetCash}
                    onChange={(e) => setHostTargetCash(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl border-2 border-slate-200 font-nunito font-black text-sm text-slate-800"
                  >
                    <option value={1500}>$1,500 Goal</option>
                    <option value={2000}>$2,000 Goal</option>
                    <option value={3000}>$3,000 Goal</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-nunito font-black text-xs text-slate-400 mb-1">
                    MATCH TIMER
                  </label>
                  <select
                    value={hostDuration}
                    onChange={(e) => setHostDuration(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl border-2 border-slate-200 font-nunito font-black text-sm text-slate-800"
                  >
                    <option value={90}>90 Seconds</option>
                    <option value={120}>2 Minutes</option>
                    <option value={180}>3 Minutes</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleCreateHostRoom}
              className="px-8 py-3.5 rounded-2xl bg-[#f87171] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_6px_0_#dc2626] text-white font-titan text-xl cursor-pointer whitespace-nowrap shrink-0"
            >
              Host {MODE_DETAILS[selectedHostMode].name}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 3: LIVE ROOM (LOBBY / PLAYING / FINISHED) */}
      {view === 'ROOM' && room && (
        <div className="max-w-6xl w-full mx-auto flex flex-col gap-6">
          {/* Room Header Banner */}
          <div className="bg-white rounded-3xl p-5 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <GameModeLogo mode={room.mode} className="w-16 h-16 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-titan text-2xl text-slate-900">
                    {MODE_DETAILS[room.mode].name}
                  </h2>
                  <span className="text-xs font-nunito font-black text-slate-400">
                    · {room.players.length} {room.players.length === 1 ? 'Player' : 'Players'}
                  </span>
                </div>
                <p className="font-nunito font-bold text-xs text-slate-500">
                  {room.setTitle} · {wsReady ? 'Connected Live' : 'Reconnecting...'}
                </p>
              </div>
            </div>

            {/* 7-Digit Join Code Pill */}
            <div className="flex items-center gap-3">
              <div className="bg-red-50 border-2 border-[#dc2626]/30 rounded-2xl px-4 py-2 flex items-center gap-3">
                <div>
                  <span className="block font-nunito font-black text-[10px] text-[#dc2626]">
                    7-DIGIT GAME CODE
                  </span>
                  <span className="font-titan text-3xl tracking-[0.16em] text-slate-900 tabular-nums">
                    {room.code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(room.code);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 1800);
                  }}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#dc2626] cursor-pointer"
                  title="Copy 7-digit code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {room.status === 'PLAYING' && timeLeftSec !== null && (
                <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl text-center">
                  <span className="block font-nunito font-black text-[10px] text-slate-400">
                    TIME LEFT
                  </span>
                  <span className="font-titan text-2xl tabular-nums">
                    {Math.floor(timeLeftSec / 60)}:{String(timeLeftSec % 60).padStart(2, '0')}
                  </span>
                </div>
              )}

              {room.status === 'PLAYING' && room.mode === 'bounty_board' && (
                <div className="bg-amber-100 border-2 border-amber-300 text-amber-950 px-4 py-2 rounded-2xl text-center">
                  <span className="block font-nunito font-black text-[10px]">
                    CASH GOAL
                  </span>
                  <span className="font-titan text-2xl tabular-nums">
                    ${room.targetCashGoal.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* LOBBY PHASE */}
          {room.status === 'LOBBY' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Unique Blook Picker (for joined players) or Host Controls */}
              <div className="lg:col-span-8 bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)]">
                {myPlayer ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div>
                        <h3 className="font-titan text-2xl text-[#dc2626]">
                          Pick Your Unique Blook
                        </h3>
                        <p className="font-nunito font-bold text-xs text-slate-500">
                          Choose any Circus Blook—once someone picks a Blook, nobody else in this room can take it!
                        </p>
                      </div>
                      {myPlayer.blookId && (
                        <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-700 font-nunito font-black text-xs">
                          Blook Locked In!
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                      {ALL_BLOOKS.map((blook) => {
                        const claimer = room.claimedBlooks[blook.id];
                        const isMine = claimer?.playerId === myPlayer.playerId;
                        const takenByOther = Boolean(claimer && !isMine);

                        return (
                          <button
                            key={blook.id}
                            type="button"
                            disabled={takenByOther}
                            onClick={() =>
                              sendWs({ type: 'player:select_blook', blookId: blook.id })
                            }
                            className={`relative rounded-2xl p-2.5 flex flex-col items-center text-center border-2 transition-all ${
                              isMine
                                ? 'bg-red-50 border-[#dc2626] scale-105 shadow-md cursor-pointer'
                                : takenByOther
                                ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                                : 'bg-slate-50 border-slate-200 hover:border-[#f87171] hover:bg-red-50 cursor-pointer'
                            }`}
                          >
                            <div className="w-14 h-14 mb-1.5">
                              <BlookArt id={blook.id} className="w-full h-full" />
                            </div>
                            <span className="font-nunito font-black text-[11px] text-slate-800 truncate max-w-full">
                              {blook.name}
                            </span>
                            {takenByOther && claimer && (
                              <div className="absolute inset-0 bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center p-1 text-white">
                                <Lock className="w-4 h-4 mb-0.5" />
                                <span className="font-nunito font-black text-[10px] leading-tight truncate max-w-full">
                                  {claimer.username}
                                </span>
                              </div>
                            )}
                            {isMine && (
                              <span
                                className="mt-1 px-2 py-0.5 rounded-md font-nunito font-black text-[10px] text-white"
                                style={{ backgroundColor: RARITY_COLORS[blook.rarity] }}
                              >
                                Yours
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  /* Host Screen waiting for players to enter 7-digit code */
                  <div className="text-center py-6">
                    <p className="font-nunito font-black text-sm text-[#dc2626] mb-2">
                      DISPLAY THIS 7-DIGIT CODE ON YOUR SCREEN
                    </p>
                    <div className="inline-block bg-slate-900 text-white font-titan text-5xl sm:text-6xl tracking-[0.2em] px-8 py-5 rounded-3xl shadow-xl mb-5 tabular-nums">
                      {room.code}
                    </div>
                    <p className="font-nunito font-bold text-slate-600 text-sm max-w-md mx-auto mb-6">
                      Players click <strong>Play</strong> → <strong>Join With 7-Digit Code</strong>, enter{' '}
                      <strong>{room.code}</strong>, and claim an unclaimed Blook.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleHostAlsoPlay}
                        className="px-5 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-[#dc2626] font-nunito font-black text-sm cursor-pointer"
                      >
                        Also Join as Player in This Tab
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Joined Players Roster + Host Start Button */}
              <div className="lg:col-span-4 bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-titan text-xl text-slate-800">
                    Players ({room.players.length})
                  </h3>
                </div>

                {room.players.length === 0 ? (
                  <p className="font-nunito font-bold text-xs text-slate-400 py-6 text-center">
                    Waiting for players to enter {room.code}...
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                    {room.players.map((p) => (
                      <div
                        key={p.playerId}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center">
                            {p.blookId ? (
                              <BlookArt id={p.blookId} className="w-full h-full" />
                            ) : (
                              <span className="text-xs font-black text-slate-400">?</span>
                            )}
                          </div>
                          <div>
                            <p className="font-nunito font-black text-sm text-slate-800">
                              {p.username}
                            </p>
                            <p className="font-nunito font-bold text-[11px] text-slate-400">
                              {p.blookId
                                ? ALL_BLOOKS.find((b) => b.id === p.blookId)?.name
                                : 'Picking Blook...'}
                            </p>
                          </div>
                        </div>
                        {p.blookId && <Check className="w-4 h-4 text-emerald-600" />}
                      </div>
                    ))}
                  </div>
                )}

                {isHost && (
                  <button
                    type="button"
                    onClick={() => sendWs({ type: 'host:start' })}
                    className="w-full py-3.5 rounded-2xl bg-[#f87171] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_5px_0_#dc2626] text-white font-titan text-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>Start {MODE_DETAILS[room.mode].name}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ACTIVE GAMEPLAY PHASE */}
          {room.status === 'PLAYING' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 8 Cols: Active Player Arena OR Host Spectator Dashboard */}
              <div className="lg:col-span-8 flex flex-col gap-5">
                {/* BOUNTY BOARD TOP 3 WANTED POSTERS (Always visible across everyone's screen!) */}
                {room.mode === 'bounty_board' && room.wantedTop3.length > 0 && (
                  <div className="bg-amber-950/90 border-4 border-amber-400 rounded-3xl p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-titan text-amber-300 text-xl tracking-wide flex items-center gap-2">
                        <Crosshair className="w-5 h-5 text-rose-400" />
                        <span>WANTED POSTERS — TOP 3 BOUNTIES</span>
                      </span>
                      <span className="font-nunito font-black text-xs text-amber-200">
                        3 Streak = Sniper (25%) · 6 Streak = Capture (60%)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {room.wantedTop3.map((poster) => (
                        <div
                          key={poster.playerId}
                          className="bg-[#fef3c7] border-2 border-amber-700 rounded-2xl p-3 flex items-center gap-3 text-amber-950"
                        >
                          <div className="w-12 h-12 shrink-0">
                            <BlookArt
                              id={poster.blookId || 'jester'}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block font-nunito font-black text-[10px] text-rose-700">
                              #{poster.rank} WANTED
                            </span>
                            <p className="font-titan text-base truncate">{poster.username}</p>
                            <p className="font-nunito font-black text-xs text-emerald-700 tabular-nums">
                              Bounty: ${poster.bounty.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {myPlayer ? (
                  <>
                    {/* Player HUD Strip */}
                    <div className="bg-white rounded-2xl p-4 shadow-[0_6px_0_rgba(0,0,0,0.16)] flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-red-50 p-1">
                          <BlookArt
                            id={myPlayer.blookId || 'jester'}
                            className="w-full h-full"
                          />
                        </div>
                        <div>
                          <span className="font-titan text-xl text-slate-900">
                            {myPlayer.username}
                          </span>
                          <p className="font-nunito font-black text-xs text-emerald-600 tabular-nums">
                            Bank: ${myPlayer.cash.toLocaleString()} · Streak: {myPlayer.streak}x
                          </p>
                        </div>
                      </div>

                      {room.mode === 'vault_heist' && (
                        <div className="flex-1 max-w-xs">
                          <div className="flex items-center justify-between text-xs font-nunito font-black text-[#dc2626] mb-1">
                            <span>DRILL ENERGY</span>
                            <span>{myPlayer.drillEnergy}%</span>
                          </div>
                          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className="h-full bg-[#f87171] transition-all"
                              style={{ width: `${myPlayer.drillEnergy}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {room.mode === 'curse_roulette' && (
                        <div className="flex flex-wrap items-center gap-2">
                          {isScrambled && (
                            <span className="px-3 py-1 rounded-xl bg-rose-100 text-rose-700 font-nunito font-black text-xs flex items-center gap-1">
                              <Shuffle className="w-3.5 h-3.5" />
                              Scrambled ({Math.ceil((myPlayer.scrambledUntil - clockNow) / 1000)}s)
                            </span>
                          )}
                          {myPlayer.taxCollectorCharges > 0 && (
                            <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-800 font-nunito font-black text-xs flex items-center gap-1">
                              <Coins className="w-3.5 h-3.5" />
                              Taxed x{myPlayer.taxCollectorCharges} by{' '}
                              {myPlayer.taxCollectorBeneficiaryName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* MODE 1 SPECIAL MODAL: VAULT HEIST — PICK FROM 3 VAULTS */}
                    {room.mode === 'vault_heist' && myPlayer.heistPending && (
                      <div className="bg-slate-900 text-white rounded-3xl p-6 border-4 border-[#f87171] shadow-2xl">
                        <h3 className="font-titan text-3xl text-[#fca5a5] mb-1">
                          Drill Energy Full — Pick a Vault!
                        </h3>
                        <p className="font-nunito font-bold text-slate-300 text-sm mb-5">
                          Hit the Safe NPC Vault for guaranteed cash, or target a rival&apos;s vault with Quiet Pick or Power Drill!
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                          {/* Vault 1: Safe NPC Vault */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVaultTarget(null);
                              sendWs({ type: 'vault:heist', action: 'npc' });
                            }}
                            className="bg-emerald-900/70 hover:bg-emerald-800/80 border-2 border-emerald-400 rounded-2xl p-4 text-left cursor-pointer transition-transform hover:-translate-y-1"
                          >
                            <ShieldCheck className="w-8 h-8 text-emerald-300 mb-2" />
                            <h4 className="font-titan text-xl text-white">Safe NPC Vault</h4>
                            <p className="font-nunito font-bold text-xs text-emerald-200 mt-1">
                              Guaranteed +$200 Cash · 0% Alarm Risk
                            </p>
                          </button>

                          {/* Vaults 2 & 3: Rival Players (or Reserve Vault if solo) */}
                          {[0, 1].map((slot) => {
                            const rivals = room.players.filter(
                              (p) => p.playerId !== myPlayer.playerId
                            );
                            const rival = rivals[slot];
                            if (!rival) {
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => sendWs({ type: 'vault:heist', action: 'npc' })}
                                  className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 rounded-2xl p-4 text-left cursor-pointer"
                                >
                                  <Coins className="w-8 h-8 text-amber-300 mb-2" />
                                  <h4 className="font-titan text-xl text-white">
                                    Reserve NPC Vault
                                  </h4>
                                  <p className="font-nunito font-bold text-xs text-slate-300 mt-1">
                                    Crack for +$200 Cash
                                  </p>
                                </button>
                              );
                            }

                            const isSelected = selectedVaultTarget === rival.playerId;
                            return (
                              <button
                                key={rival.playerId}
                                type="button"
                                onClick={() => setSelectedVaultTarget(rival.playerId)}
                                className={`rounded-2xl p-4 text-left border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-amber-900/80 border-amber-400 scale-[1.02]'
                                    : 'bg-slate-800 hover:bg-slate-700 border-slate-600'
                                }`}
                              >
                                <div className="w-10 h-10 mb-2">
                                  <BlookArt
                                    id={rival.blookId || 'jester'}
                                    className="w-full h-full"
                                  />
                                </div>
                                <h4 className="font-titan text-lg text-white truncate">
                                  {rival.username}&apos;s Vault
                                </h4>
                                <p className="font-nunito font-black text-xs text-amber-300 tabular-nums">
                                  Bank: ${rival.cash.toLocaleString()}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                        {selectedVaultTarget && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-700">
                            <button
                              type="button"
                              onClick={() => {
                                sendWs({
                                  type: 'vault:heist',
                                  action: 'quiet',
                                  targetPlayerId: selectedVaultTarget,
                                });
                                setSelectedVaultTarget(null);
                              }}
                              className="py-3 px-4 rounded-xl bg-[#f87171] text-white font-titan text-base cursor-pointer hover:brightness-105"
                            >
                              Quiet Pick (Steal 15% Safely)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                sendWs({
                                  type: 'vault:heist',
                                  action: 'power',
                                  targetPlayerId: selectedVaultTarget,
                                });
                                setSelectedVaultTarget(null);
                              }}
                              className="py-3 px-4 rounded-xl bg-rose-600 text-white font-titan text-base cursor-pointer hover:brightness-105"
                            >
                              Power Drill (Steal 45% · 30% Alarm Risk!)
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* MODE 2 SPECIAL MODAL: CURSE ROULETTE SLOT REEL & TARGET */}
                    {room.mode === 'curse_roulette' && myPlayer.pendingCurse && (
                      <div className="bg-red-950 text-white rounded-3xl p-6 border-4 border-amber-400 shadow-2xl">
                        <div className="flex items-center gap-3 mb-3">
                          <Skull className="w-7 h-7 text-amber-300" />
                          <h3 className="font-titan text-2xl text-amber-300">
                            Curse Slot Reel!
                          </h3>
                        </div>

                        <div className="grid grid-cols-3 gap-3 bg-slate-900 p-4 rounded-2xl border-2 border-red-500 mb-4 text-center">
                          {[0, 1, 2].map((reel) => (
                            <div
                              key={reel}
                              className={`bg-white text-slate-900 rounded-xl py-3 px-2 font-titan text-sm ${
                                slotSpinning ? 'animate-pulse' : ''
                              }`}
                            >
                              {slotSpinning
                                ? 'SPINNING...'
                                : revealedCurse === 'scrambled_keys'
                                ? 'Scrambled Keys'
                                : revealedCurse === 'tax_collector'
                                ? 'Tax Collector'
                                : 'Fog Screen'}
                            </div>
                          ))}
                        </div>

                        {!slotSpinning && (
                          <div>
                            <p className="font-nunito font-bold text-xs text-red-200 mb-3">
                              {revealedCurse === 'scrambled_keys'
                                ? 'Scrambled Keys: Shuffles a rival’s A/B/C/D buttons for 15 seconds!'
                                : revealedCurse === 'tax_collector'
                                ? 'Tax Collector: Siphons 20% of their next 3 payouts directly into your score!'
                                : 'Fog Screen: Covers their question in thick smoke they have to tap to wipe away!'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {room.players
                                .filter((p) => p.playerId !== myPlayer.playerId)
                                .map((rival) => (
                                  <button
                                    key={rival.playerId}
                                    type="button"
                                    onClick={() =>
                                      sendWs({
                                        type: 'curse:fire',
                                        targetPlayerId: rival.playerId,
                                      })
                                    }
                                    className="px-4 py-2 rounded-xl bg-amber-400 text-amber-950 font-nunito font-black text-sm cursor-pointer hover:brightness-105 flex items-center gap-2"
                                  >
                                    <span>Fire at {rival.username}</span>
                                  </button>
                                ))}
                              {room.players.filter((p) => p.playerId !== myPlayer.playerId)
                                .length === 0 && (
                                <button
                                  type="button"
                                  onClick={() => sendWs({ type: 'curse:fire', targetPlayerId: '' })}
                                  className="px-4 py-2 rounded-xl bg-white/20 text-white font-nunito font-black text-xs cursor-pointer"
                                >
                                  No Rivals Yet — Continue Questions
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* MODE 3 SPECIAL MODAL: BOUNTY BOARD SNIPER / FULL CAPTURE */}
                    {room.mode === 'bounty_board' && myPlayer.pendingClaim && (
                      <div className="bg-rose-950 text-white rounded-3xl p-6 border-4 border-amber-400 shadow-2xl">
                        <h3 className="font-titan text-2xl text-amber-300 mb-1">
                          {myPlayer.pendingClaim === 'capture'
                            ? '6-Streak! Full Capture Ready (60% Bounty + Knockdown!)'
                            : '3-Streak! Sniper Shot Ready (25% Bounty!)'}
                        </h3>
                        <p className="font-nunito font-bold text-xs text-rose-200 mb-4">
                          Pick a rival player to claim their bounty right now!
                        </p>
                        <div className="flex flex-wrap gap-2.5">
                          {room.players
                            .filter((p) => p.playerId !== myPlayer.playerId)
                            .map((rival) => (
                              <button
                                key={rival.playerId}
                                type="button"
                                onClick={() =>
                                  sendWs({
                                    type: 'bounty:claim',
                                    targetPlayerId: rival.playerId,
                                  })
                                }
                                className="px-4 py-2.5 rounded-xl bg-amber-400 text-amber-950 font-nunito font-black text-sm cursor-pointer hover:brightness-105 flex items-center gap-2"
                              >
                                <Crosshair className="w-4 h-4" />
                                <span>
                                  Target {rival.username} (${rival.cash.toLocaleString()})
                                </span>
                              </button>
                            ))}
                          {room.players.filter((p) => p.playerId !== myPlayer.playerId)
                            .length === 0 && (
                            <button
                              type="button"
                              onClick={() => sendWs({ type: 'bounty:claim', targetPlayerId: '' })}
                              className="px-4 py-2 rounded-xl bg-white/20 text-white font-nunito font-black text-xs cursor-pointer"
                            >
                              No Rivals Yet — Continue Questions
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TRIVIA QUESTION CARD (with Fog Screen Overlay if cursed) */}
                    {!myPlayer.heistPending && !myPlayer.pendingCurse && !myPlayer.pendingClaim && (
                      <div className="flex flex-col gap-4">
                        <div className="relative bg-white rounded-3xl p-7 shadow-[0_8px_0_rgba(0,0,0,0.16)] text-center overflow-hidden">
                          <span className="block font-nunito font-black text-xs text-slate-400 mb-2">
                            Question {(qIdx % room.questions.length) + 1} ·{' '}
                            {room.questions[qIdx % room.questions.length].category}
                          </span>
                          <h3 className="font-nunito font-black text-2xl text-slate-900">
                            {room.questions[qIdx % room.questions.length].question}
                          </h3>

                          {/* Fog Screen Curse Overlay — click/tap to wipe away */}
                          {myPlayer.fogLevel > 0 && (
                            <button
                              type="button"
                              onClick={() => sendWs({ type: 'curse:wipe_fog' })}
                              className="absolute inset-0 bg-slate-700/95 backdrop-blur-md text-white flex flex-col items-center justify-center p-4 cursor-pointer transition-opacity"
                              style={{ opacity: Math.min(0.98, 0.35 + myPlayer.fogLevel / 130) }}
                            >
                              <CloudFog className="w-12 h-12 text-slate-200 mb-2 animate-pulse" />
                              <span className="font-titan text-2xl">FOG SCREEN!</span>
                              <span className="font-nunito font-extrabold text-sm text-slate-200">
                                Click or tap to wipe smoke away ({myPlayer.fogLevel}% left)
                              </span>
                            </button>
                          )}
                        </div>

                        {feedbackBanner ? (
                          <div
                            className={`rounded-2xl p-6 text-center text-white font-titan text-2xl shadow-lg ${
                              feedbackBanner.correct ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          >
                            {feedbackBanner.text}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {buttonOrder.map((optIdx, posIdx) => {
                              const currentQ = room.questions[qIdx % room.questions.length];
                              const btnColors = [
                                'bg-[#f59e0b] shadow-[0_5px_0_#b45309]',
                                'bg-[#3b82f6] shadow-[0_5px_0_#1d4ed8]',
                                'bg-[#10b981] shadow-[0_5px_0_#047857]',
                                'bg-[#ef4444] shadow-[0_5px_0_#b91c1c]',
                              ];
                              const letters = ['A', 'B', 'C', 'D'];
                              return (
                                <button
                                  key={`${qIdx}-${optIdx}`}
                                  type="button"
                                  onClick={() => handleAnswerOption(optIdx)}
                                  className={`${btnColors[posIdx]} text-white font-nunito font-black text-lg p-5 rounded-2xl text-left flex items-center gap-3 cursor-pointer hover:brightness-105 active:translate-y-0.5`}
                                >
                                  <span className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center font-titan shrink-0">
                                    {letters[posIdx]}
                                  </span>
                                  <span>{currentQ.options[optIdx]}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  /* Host Live View */
                  <div className="bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.16)]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-titan text-2xl text-[#dc2626]">
                        Host Live Control — {MODE_DETAILS[room.mode].name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleHostAlsoPlay}
                          className="px-4 py-2 rounded-xl bg-red-100 text-[#dc2626] font-nunito font-black text-xs cursor-pointer"
                        >
                          Jump In & Play
                        </button>
                        <button
                          type="button"
                          onClick={() => sendWs({ type: 'host:end' })}
                          className="px-4 py-2 rounded-xl bg-rose-500 text-white font-nunito font-black text-xs cursor-pointer"
                        >
                          End Match Now
                        </button>
                      </div>
                    </div>
                    <p className="font-nunito font-bold text-sm text-slate-600 mb-4">
                      Match is live! Watch the leaderboard and heist/curse/bounty feed on the right.
                    </p>
                  </div>
                )}
              </div>

              {/* Right 4 Cols: Live Leaderboard & Event Feed */}
              <div className="lg:col-span-4 flex flex-col gap-5">
                <div className="bg-white rounded-3xl p-5 shadow-[0_8px_0_rgba(0,0,0,0.16)]">
                  <h3 className="font-titan text-xl text-slate-800 mb-3 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <span>Live Standings</span>
                  </h3>
                  <div className="flex flex-col gap-2">
                    {room.players.map((p, idx) => (
                      <div
                        key={p.playerId}
                        className={`flex items-center justify-between p-2.5 rounded-xl border ${
                          p.playerId === clientId
                            ? 'bg-red-50 border-[#dc2626]/40'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-titan text-sm text-slate-400 w-5">
                            #{idx + 1}
                          </span>
                          <div className="w-8 h-8 shrink-0">
                            <BlookArt
                              id={p.blookId || 'jester'}
                              className="w-full h-full"
                            />
                          </div>
                          <span className="font-nunito font-black text-sm text-slate-800 truncate">
                            {p.username}
                          </span>
                        </div>
                        <span className="font-titan text-base text-emerald-600 tabular-nums">
                          ${p.cash.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-5 shadow-[0_8px_0_rgba(0,0,0,0.16)]">
                  <h3 className="font-titan text-lg text-slate-800 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#dc2626]" />
                    <span>Live Feed</span>
                  </h3>
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {room.events.map((ev) => (
                      <div
                        key={ev.id}
                        className={`px-3 py-2 rounded-xl font-nunito font-bold text-xs ${
                          ev.tone === 'alarm'
                            ? 'bg-rose-50 text-rose-700'
                            : ev.tone === 'steal'
                            ? 'bg-red-50 text-red-700'
                            : ev.tone === 'curse'
                            ? 'bg-red-100 text-red-900'
                            : ev.tone === 'bounty'
                            ? 'bg-amber-50 text-amber-900'
                            : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        {ev.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FINISHED PODIUM PHASE */}
          {room.status === 'FINISHED' && (
            <div className="bg-white rounded-3xl p-8 shadow-[0_10px_0_rgba(0,0,0,0.18)] max-w-2xl mx-auto w-full text-center">
              <GameModeLogo mode={room.mode} className="w-24 h-24 mx-auto mb-3" />
              <h2 className="font-titan text-4xl text-[#dc2626] mb-2">
                Match Complete!
              </h2>
              <p className="font-nunito font-bold text-slate-600 text-sm mb-6">
                Bonus Clicket Tokens have been added to all verified players&apos; accounts!
              </p>

              <div className="flex flex-col gap-2.5 mb-6 text-left">
                {room.players.map((p, idx) => (
                  <div
                    key={p.playerId}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border-2 ${
                      idx === 0
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-titan text-xl text-slate-500 w-7">
                        #{idx + 1}
                      </span>
                      <div className="w-11 h-11">
                        <BlookArt
                          id={p.blookId || 'jester'}
                          className="w-full h-full"
                        />
                      </div>
                      <div>
                        <p className="font-titan text-lg text-slate-900">{p.username}</p>
                        <p className="font-nunito font-bold text-xs text-slate-500 flex items-center gap-1">
                          <BlooketTokenIcon className="w-4 h-4" />
                          <span>+{idx === 0 ? 100 : idx === 1 ? 65 : 40} Clicket Tokens</span>
                        </p>
                      </div>
                    </div>
                    <span className="font-titan text-2xl text-emerald-600 tabular-nums">
                      ${p.cash.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleLeaveRoom}
                className="px-8 py-3.5 rounded-2xl bg-[#f87171] text-white font-titan text-xl shadow-[0_5px_0_#dc2626] cursor-pointer"
              >
                Back to Play Menu
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
