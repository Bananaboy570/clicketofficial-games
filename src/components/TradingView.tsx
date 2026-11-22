import React, { useState } from 'react';
import {
  Users,
  ArrowLeftRight,
  ShieldCheck,
  AlertTriangle,
  Check,
  X,
  User,
  Clock,
  Sparkles,
  History,
} from 'lucide-react';
import { ALL_BLOOKS, RARITY_COLORS, RARITY_RANK, BlookItem } from '../data/blooks';
import { BlookArt } from './BlookArt';
import type { TradeHistoryItem } from './AuthScreen';
import { isStaticMode } from '../lib/apiClient';

export interface OnlinePlayerSummary {
  clientId: string;
  userId: string;
  username: string;
  avatarBlookId: string;
  unlockedCount: number;
  inTrade: boolean;
}

export interface LiveTradeParticipant {
  clientId: string;
  userId: string;
  username: string;
  avatarBlookId: string;
}

export interface LiveTradeSession {
  tradeId: string;
  status: 'PENDING' | 'NEGOTIATING' | 'COMPLETED' | 'CANCELLED';
  initiator: LiveTradeParticipant | null;
  target: LiveTradeParticipant | null;
  offerByClient: Record<string, string | null>;
  acceptedByClient: Record<string, boolean>;
}

export interface TradeCompletedNotice {
  gaveBlookId: string;
  receivedBlookId: string;
  partnerUsername: string;
}

interface TradingViewProps {
  myClientId: string | null;
  myUserId: string;
  wsConnected: boolean;
  inventory: Record<string, number>;
  onlinePlayers: OnlinePlayerSummary[];
  activeTrade: LiveTradeSession | null;
  tradeError: string | null;
  tradeNotice: TradeCompletedNotice | null;
  tradeHistory: TradeHistoryItem[];
  onDismissNotice: () => void;
  onInitiateTrade: (targetClientId: string) => void;
  onRespondTrade: (tradeId: string, accept: boolean) => void;
  onSelectBlook: (tradeId: string, blookId: string | null) => void;
  onConfirmTrade: (tradeId: string, accepted: boolean) => void;
  onCancelTrade: (tradeId: string) => void;
}

export const TradingView: React.FC<TradingViewProps> = ({
  myClientId,
  myUserId,
  wsConnected,
  inventory,
  onlinePlayers,
  activeTrade,
  tradeError,
  tradeNotice,
  tradeHistory,
  onDismissNotice,
  onInitiateTrade,
  onRespondTrade,
  onSelectBlook,
  onConfirmTrade,
  onCancelTrade,
}) => {
  const [showUnbalancedSign, setShowUnbalancedSign] = useState(false);

  const otherPlayers = onlinePlayers.filter((p) => p.userId !== myUserId);
  const ownedBlooks = ALL_BLOOKS.filter((b) => (inventory[b.id] || 0) > 0);

  const isInitiator = Boolean(
    activeTrade && myClientId && activeTrade.initiator?.clientId === myClientId
  );
  const meParticipant = activeTrade
    ? isInitiator
      ? activeTrade.initiator
      : activeTrade.target
    : null;
  const partnerParticipant = activeTrade
    ? isInitiator
      ? activeTrade.target
      : activeTrade.initiator
    : null;

  const myOfferId =
    activeTrade && myClientId ? activeTrade.offerByClient[myClientId] || null : null;
  const partnerOfferId =
    activeTrade && partnerParticipant
      ? activeTrade.offerByClient[partnerParticipant.clientId] || null
      : null;

  const myAccepted = Boolean(
    activeTrade && myClientId && activeTrade.acceptedByClient[myClientId]
  );
  const partnerAccepted = Boolean(
    activeTrade &&
      partnerParticipant &&
      activeTrade.acceptedByClient[partnerParticipant.clientId]
  );

  const myOfferBlook: BlookItem | null = myOfferId
    ? ALL_BLOOKS.find((b) => b.id === myOfferId) || null
    : null;
  const partnerOfferBlook: BlookItem | null = partnerOfferId
    ? ALL_BLOOKS.find((b) => b.id === partnerOfferId) || null
    : null;

  // Fairness evaluation
  const bothSelected = Boolean(myOfferBlook && partnerOfferBlook);
  const myRank = myOfferBlook ? RARITY_RANK[myOfferBlook.rarity] : 0;
  const partnerRank = partnerOfferBlook ? RARITY_RANK[partnerOfferBlook.rarity] : 0;
  const isFairTrade = bothSelected && myRank === partnerRank;
  const isUnbalanced = bothSelected && myRank !== partnerRank;
  const losingValue = Boolean(bothSelected && myRank > partnerRank);

  const handleConfirmClick = () => {
    if (!activeTrade || !bothSelected) return;
    if (myAccepted) {
      onConfirmTrade(activeTrade.tradeId, false);
      return;
    }
    if (isUnbalanced) {
      setShowUnbalancedSign(true);
      return;
    }
    onConfirmTrade(activeTrade.tradeId, true);
  };

  const completedGave = tradeNotice
    ? ALL_BLOOKS.find((b) => b.id === tradeNotice.gaveBlookId)
    : null;
  const completedGot = tradeNotice
    ? ALL_BLOOKS.find((b) => b.id === tradeNotice.receivedBlookId)
    : null;

  return (
    <div className="relative z-10 px-9 pt-6 pb-16 min-h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-titan text-white text-[44px] leading-none tracking-wide drop-shadow-[0_3px_0_rgba(0,0,0,0.18)]">
            Trading
          </h1>
          <p className="font-nunito font-extrabold text-white/90 text-sm mt-1">
            View live online players and initiate safe 1-to-1 Blook trades.
          </p>
        </div>

        <div className="bg-white/20 text-white px-4 py-2 rounded-xl font-nunito font-black text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-200" />
          <span>
            {wsConnected
              ? `${otherPlayers.length} Other ${otherPlayers.length === 1 ? 'Player' : 'Players'} Online`
              : isStaticMode()
              ? 'Static Website Mode (Local)'
              : 'Connecting to Live Server...'}
          </span>
        </div>
      </div>

      {!wsConnected && isStaticMode() && (
        <div className="mb-5 max-w-3xl bg-white/95 border-2 border-amber-300 text-slate-700 px-5 py-3.5 rounded-2xl shadow-lg font-nunito font-bold text-sm">
          You are playing on static web hosting. Live cross-device trading requires the Node WebSocket server, while <strong className="text-[#dc2626]">Bazaar</strong>, <strong className="text-[#dc2626]">Market</strong>, <strong className="text-[#dc2626]">Blooks</strong>, <strong className="text-[#dc2626]">Rewards</strong>, <strong className="text-[#dc2626]">Clans</strong>, and <strong className="text-[#dc2626]">Solo Trivia</strong> work right in your browser!
        </div>
      )}

      {/* Error / Status Banner */}
      {tradeError && (
        <div className="mb-5 max-w-3xl bg-white border-2 border-rose-400 text-rose-700 px-5 py-3 rounded-2xl shadow-lg font-nunito font-extrabold text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{tradeError}</span>
        </div>
      )}

      {/* Completed Trade Celebration Banner */}
      {tradeNotice && completedGave && completedGot && (
        <div className="mb-6 max-w-3xl bg-white border-4 border-emerald-400 rounded-3xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4 animate-pop-reveal">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-titan text-xl text-emerald-700 leading-tight">
                1-to-1 Trade Completed with {tradeNotice.partnerUsername}!
              </h3>
              <p className="font-nunito font-extrabold text-xs text-slate-600">
                Traded <strong>{completedGave.name}</strong> ({completedGave.rarity}) → Received{' '}
                <strong>{completedGot.name}</strong> ({completedGot.rarity})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissNotice}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-nunito font-black text-xs cursor-pointer"
          >
            Nice!
          </button>
        </div>
      )}

      {/* ACTIVE PENDING INVITE (SENT OR RECEIVED) */}
      {activeTrade && activeTrade.status === 'PENDING' && (
        <div className="mb-6 max-w-2xl bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)] border-4 border-amber-300">
          {isInitiator ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="font-titan text-2xl text-slate-800">
                    Waiting for {partnerParticipant?.username}...
                  </h2>
                  <p className="font-nunito font-bold text-xs text-slate-500">
                    Your 1-to-1 trade request has been sent live.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCancelTrade(activeTrade.tradeId)}
                className="px-5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-nunito font-black text-sm cursor-pointer"
              >
                Cancel Request
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-titan text-2xl text-[#dc2626]">
                  Incoming Trade Request!
                </h2>
                <p className="font-nunito font-bold text-sm text-slate-600">
                  <strong>{partnerParticipant?.username}</strong> wants to do a 1-to-1 Blook trade
                  with you.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onRespondTrade(activeTrade.tradeId, true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-titan text-base shadow-[0_4px_0_#065f46] cursor-pointer"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => onRespondTrade(activeTrade.tradeId, false)}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-titan text-base shadow-[0_4px_0_#991b1b] cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LIVE 1-TO-1 TRADE NEGOTIATION ROOM */}
      {activeTrade && activeTrade.status === 'NEGOTIATING' && (
        <div className="max-w-6xl w-full flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center">
                  <ArrowLeftRight className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-titan text-2xl text-slate-900">
                    Live 1-to-1 Trade with {partnerParticipant?.username}
                  </h2>
                  <p className="font-nunito font-bold text-xs text-slate-500">
                    Pick 1 obtained Blook each. Changing either Blook automatically resets locks.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowUnbalancedSign(false);
                  onCancelTrade(activeTrade.tradeId);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-nunito font-black text-xs cursor-pointer"
              >
                Leave Trade
              </button>
            </div>

            {/* 2-Side Offer Comparison + Live Fairness Meter */}
            <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center mb-6">
              {/* YOUR OFFER */}
              <div
                className={`md:col-span-4 rounded-3xl p-5 border-4 flex flex-col items-center text-center transition-all ${
                  myAccepted
                    ? 'bg-emerald-50 border-emerald-400'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="font-nunito font-black text-xs text-slate-500 uppercase mb-2">
                  Your Offer ({meParticipant?.username})
                </span>
                {myOfferBlook ? (
                  <>
                    <div className="w-24 h-24 mb-2">
                      <BlookArt id={myOfferBlook.id} className="w-full h-full" />
                    </div>
                    <h3 className="font-titan text-xl text-slate-900">{myOfferBlook.name}</h3>
                    <span
                      className="mt-1 px-2.5 py-0.5 rounded-lg font-nunito font-black text-xs text-white"
                      style={{ backgroundColor: RARITY_COLORS[myOfferBlook.rarity] }}
                    >
                      {myOfferBlook.rarity} · {myOfferBlook.chanceLabel}
                    </span>
                  </>
                ) : (
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 font-nunito font-bold text-xs px-2 my-3">
                    Pick 1 Blook below
                  </div>
                )}
                <div className="mt-3">
                  {myAccepted ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white font-nunito font-black text-xs">
                      <Check className="w-3.5 h-3.5" /> Locked In
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-200 text-slate-600 font-nunito font-black text-xs">
                      Choosing
                    </span>
                  )}
                </div>
              </div>

              {/* CENTER FAIRNESS INDICATOR */}
              <div className="md:col-span-3 flex flex-col items-center justify-center text-center px-2 gap-3">
                <div className="w-11 h-11 rounded-full bg-red-100 text-[#dc2626] flex items-center justify-center">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>

                {!bothSelected ? (
                  <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 text-slate-600 font-nunito font-bold text-xs">
                    Waiting for both players to select 1 Blook to check trade fairness.
                  </div>
                ) : isFairTrade ? (
                  <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-3 text-emerald-800">
                    <div className="flex items-center justify-center gap-1.5 font-titan text-base text-emerald-700">
                      <ShieldCheck className="w-5 h-5" />
                      <span>FAIR TRADE</span>
                    </div>
                    <p className="font-nunito font-bold text-xs mt-1">
                      Both Blooks are <strong>{myOfferBlook?.rarity}</strong> rarity (
                      {myOfferBlook?.chanceLabel}).
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-50 border-2 border-red-400 rounded-2xl p-3 text-red-900">
                    <div className="flex items-center justify-center gap-1.5 font-titan text-base text-red-600">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span>UNBALANCED TRADE</span>
                    </div>
                    <p className="font-nunito font-extrabold text-xs mt-1">
                      {losingValue
                        ? `Warning: Your ${myOfferBlook?.rarity} (${myOfferBlook?.chanceLabel}) is rarer than their ${partnerOfferBlook?.rarity} (${partnerOfferBlook?.chanceLabel})!`
                        : `Notice: Their ${partnerOfferBlook?.rarity} (${partnerOfferBlook?.chanceLabel}) is a different rarity than your ${myOfferBlook?.rarity}!`}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!bothSelected}
                  onClick={handleConfirmClick}
                  className={`w-full py-2.5 px-4 rounded-xl font-titan text-base transition-all ${
                    !bothSelected
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : myAccepted
                      ? 'bg-slate-700 hover:bg-slate-800 text-white cursor-pointer'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_0_#065f46] cursor-pointer'
                  }`}
                >
                  {myAccepted ? 'Unlock / Edit Offer' : 'Confirm Trade'}
                </button>
              </div>

              {/* PARTNER OFFER */}
              <div
                className={`md:col-span-4 rounded-3xl p-5 border-4 flex flex-col items-center text-center transition-all ${
                  partnerAccepted
                    ? 'bg-emerald-50 border-emerald-400'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="font-nunito font-black text-xs text-slate-500 uppercase mb-2">
                  {partnerParticipant?.username}&apos;s Offer
                </span>
                {partnerOfferBlook ? (
                  <>
                    <div className="w-24 h-24 mb-2">
                      <BlookArt id={partnerOfferBlook.id} className="w-full h-full" />
                    </div>
                    <h3 className="font-titan text-xl text-slate-900">{partnerOfferBlook.name}</h3>
                    <span
                      className="mt-1 px-2.5 py-0.5 rounded-lg font-nunito font-black text-xs text-white"
                      style={{ backgroundColor: RARITY_COLORS[partnerOfferBlook.rarity] }}
                    >
                      {partnerOfferBlook.rarity} · {partnerOfferBlook.chanceLabel}
                    </span>
                  </>
                ) : (
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 font-nunito font-bold text-xs px-2 my-3">
                    Partner hasn&apos;t picked yet
                  </div>
                )}
                <div className="mt-3">
                  {partnerAccepted ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white font-nunito font-black text-xs">
                      <Check className="w-3.5 h-3.5" /> Locked In
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-200 text-slate-600 font-nunito font-black text-xs">
                      Choosing
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* YOUR OBTAINED BLOOK PICKER */}
            <div className="border-t-2 border-slate-100 pt-5">
              <h3 className="font-titan text-xl text-slate-800 mb-3">
                Select 1 Obtained Blook From Your Locker
              </h3>
              {ownedBlooks.length === 0 ? (
                <p className="font-nunito font-bold text-sm text-slate-500 py-4">
                  You do not own any Blooks yet. Open packs in the Market first!
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3">
                  {ownedBlooks.map((blook) => {
                    const count = inventory[blook.id] || 0;
                    const isPicked = myOfferId === blook.id;
                    return (
                      <button
                        key={blook.id}
                        type="button"
                        onClick={() =>
                          onSelectBlook(activeTrade.tradeId, isPicked ? null : blook.id)
                        }
                        className={`relative rounded-2xl p-2 flex flex-col items-center border-2 transition-all cursor-pointer ${
                          isPicked
                            ? 'bg-red-50 border-[#dc2626] scale-105 shadow-md'
                            : 'bg-slate-50 border-slate-200 hover:border-[#f87171]'
                        }`}
                      >
                        <div className="w-14 h-14">
                          <BlookArt id={blook.id} className="w-full h-full" />
                        </div>
                        <span className="mt-1 font-nunito font-extrabold text-[11px] text-slate-800 truncate max-w-full">
                          {blook.name}
                        </span>
                        <span
                          className="font-nunito font-black text-[10px]"
                          style={{ color: RARITY_COLORS[blook.rarity] }}
                        >
                          x{count} · {blook.rarity}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ONLINE PLAYERS DIRECTORY (SHOWN WHEN NOT ACTIVELY NEGOTIATING) */}
      {(!activeTrade || activeTrade.status !== 'NEGOTIATING') && (
        <div className="max-w-5xl w-full bg-white/95 rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4 mb-5">
            <div>
              <h2 className="font-titan text-2xl text-[#dc2626]">Online Players</h2>
              <p className="font-nunito font-bold text-xs text-slate-500">
                Click &ldquo;Trade 1-to-1&rdquo; next to any online player to send a live Blook trade invite.
              </p>
            </div>
          </div>

          {otherPlayers.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="font-titan text-2xl text-slate-800 mb-1">
                No Other Players Online Right Now
              </h3>
              <p className="font-nunito font-bold text-sm text-slate-500 max-w-md mx-auto">
                Live online players appear here automatically in real time as soon as another Clicket
                account connects.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherPlayers.map((player) => (
                <div
                  key={player.clientId}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border-2 border-slate-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center p-1 shrink-0">
                      {player.avatarBlookId ? (
                        <BlookArt id={player.avatarBlookId} className="w-full h-full" />
                      ) : (
                        <User className="w-6 h-6 text-[#dc2626]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-titan text-lg text-slate-800 truncate">
                          {player.username}
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            player.inTrade ? 'bg-amber-400' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      <p className="font-nunito font-extrabold text-xs text-slate-500">
                        {player.unlockedCount} / {ALL_BLOOKS.length} Blooks Unlocked ·{' '}
                        {player.inTrade ? 'Busy in Trade' : 'Available'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={player.inTrade || Boolean(activeTrade)}
                    onClick={() => onInitiateTrade(player.clientId)}
                    className={`px-4 py-2 rounded-xl font-titan text-sm flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                      player.inTrade || activeTrade
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-[#f87171] hover:brightness-105 shadow-[0_4px_0_#dc2626] active:translate-y-0.5 active:shadow-none text-white'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>{player.inTrade ? 'In Trade' : 'Trade 1-to-1'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TRADING HISTORY SECTION */}
      <div className="mt-6 max-w-5xl w-full bg-white/95 rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-titan text-2xl text-[#dc2626]">Trading History</h2>
              <p className="font-nunito font-bold text-xs text-slate-500">
                Your past completed 1-to-1 Blook trades saved to your account.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-xl bg-slate-100 font-nunito font-black text-xs text-slate-600">
            {tradeHistory.length} Completed {tradeHistory.length === 1 ? 'Trade' : 'Trades'}
          </span>
        </div>

        {tradeHistory.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-titan text-xl text-slate-700 mb-1">No Trades Yet</p>
            <p className="font-nunito font-bold text-xs text-slate-500">
              Completed 1-to-1 trades with other players will appear here with full details.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
            {tradeHistory.map((entry) => {
              const gaveBlook = ALL_BLOOKS.find((b) => b.id === entry.gaveBlookId);
              const receivedBlook = ALL_BLOOKS.find((b) => b.id === entry.receivedBlookId);
              const gaveRank = gaveBlook ? RARITY_RANK[gaveBlook.rarity] : 0;
              const receivedRank = receivedBlook ? RARITY_RANK[receivedBlook.rarity] : 0;
              const fair = Boolean(gaveBlook && receivedBlook && gaveRank === receivedRank);

              return (
                <div
                  key={entry.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border-2 border-slate-200"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Gave Blook */}
                    <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                      <div className="w-10 h-10 shrink-0">
                        {gaveBlook ? (
                          <BlookArt id={gaveBlook.id} className="w-full h-full" />
                        ) : (
                          <User className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="leading-tight">
                        <div className="font-nunito font-black text-[10px] text-slate-400 uppercase">
                          You Gave
                        </div>
                        <div className="font-titan text-sm text-slate-800">
                          {gaveBlook ? gaveBlook.name : entry.gaveBlookId}
                        </div>
                        {gaveBlook && (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded font-nunito font-black text-[10px] text-white"
                            style={{ backgroundColor: RARITY_COLORS[gaveBlook.rarity] }}
                          >
                            {gaveBlook.rarity}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowLeftRight className="w-5 h-5 text-[#dc2626] shrink-0" />

                    {/* Received Blook */}
                    <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                      <div className="w-10 h-10 shrink-0">
                        {receivedBlook ? (
                          <BlookArt id={receivedBlook.id} className="w-full h-full" />
                        ) : (
                          <User className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="leading-tight">
                        <div className="font-nunito font-black text-[10px] text-slate-400 uppercase">
                          You Received
                        </div>
                        <div className="font-titan text-sm text-slate-800">
                          {receivedBlook ? receivedBlook.name : entry.receivedBlookId}
                        </div>
                        {receivedBlook && (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded font-nunito font-black text-[10px] text-white"
                            style={{ backgroundColor: RARITY_COLORS[receivedBlook.rarity] }}
                          >
                            {receivedBlook.rarity}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-start sm:items-end justify-between gap-1.5 shrink-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-lg font-nunito font-black text-[10px] ${
                          fair
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {fair ? 'FAIR TRADE' : 'UNBALANCED'}
                      </span>
                      <span className="font-nunito font-black text-xs text-slate-700">
                        with {entry.partnerUsername}
                      </span>
                    </div>
                    <span className="font-nunito font-bold text-[11px] text-slate-400">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UNBALANCED / SCAM WARNING SIGN MODAL */}
      {showUnbalancedSign && activeTrade && myOfferBlook && partnerOfferBlook && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border-4 border-red-500 shadow-2xl text-center animate-pop-reveal">
            <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-10 h-10" />
            </div>

            <div className="bg-red-600 text-white rounded-2xl px-4 py-3 mb-4 shadow-md border-2 border-red-800">
              <p className="font-titan text-xl sm:text-2xl tracking-wide leading-snug">
                THE TRADE IS UNBALANCED OR SCAM WORTHY WILL YOU CONTINUE?
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 mb-6 bg-slate-50 rounded-2xl p-3 border border-slate-200">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14">
                  <BlookArt id={myOfferBlook.id} className="w-full h-full" />
                </div>
                <span className="font-nunito font-black text-xs text-slate-700 mt-1">
                  Yours: {myOfferBlook.rarity}
                </span>
              </div>
              <ArrowLeftRight className="w-5 h-5 text-red-500" />
              <div className="flex flex-col items-center">
                <div className="w-14 h-14">
                  <BlookArt id={partnerOfferBlook.id} className="w-full h-full" />
                </div>
                <span className="font-nunito font-black text-xs text-slate-700 mt-1">
                  Theirs: {partnerOfferBlook.rarity}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowUnbalancedSign(false);
                  onConfirmTrade(activeTrade.tradeId, true);
                }}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:translate-y-0.5 active:shadow-none shadow-[0_5px_0_#065f46] text-white font-titan text-xl cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                <span>Yes</span>
              </button>
              <button
                type="button"
                onClick={() => setShowUnbalancedSign(false)}
                className="py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-500 active:translate-y-0.5 active:shadow-none shadow-[0_5px_0_#991b1b] text-white font-titan text-xl cursor-pointer flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                <span>NO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
