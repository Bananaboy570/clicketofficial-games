import React, { useState, useEffect, useRef } from 'react';
import {
  MousePointerClick,
  Timer,
  Zap,
  ArrowUpCircle,
  Lock,
  Disc3,
  Sparkles,
  Gift,
  Clock,
} from 'lucide-react';
import { BlookArt, BlooketTokenIcon } from './BlookArt';
import { apiFetch } from '../lib/apiClient';

interface FloatingClickPopup {
  id: number;
  x: number;
  y: number;
  amount: number;
}

interface DailyClickerViewProps {
  tokens: number;
  clickUpgradeLevel: number;
  bestDailyClicks: number;
  equippedBlookId: string;
  lastDailyPlayAt: number | null;
  lastWheelSpinAt: number | null;
  lastHourlyClaimAt: number | null;
  sessionToken: string | null;
  onEarnTokens: (amount: number) => void;
  onBuyClickUpgrade: (cost: number) => void;
  onUpdateBestClicks: (clicks: number) => void;
  onLockDaily: (timestamp: number) => void;
  onRecordWheelSpin: (timestamp: number) => void;
  onClaimHourlyReward: (reward: number, newTokens: number, claimedAt: number) => void;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const WHEEL_SEGMENTS = [
  { amount: 1000, label: '+1.0k', color: '#dc2626', text: '#ffffff' },
  { amount: 1100, label: '+1.1k', color: '#fbbf24', text: '#451a03' },
  { amount: 1200, label: '+1.2k', color: '#10b981', text: '#ffffff' },
  { amount: 1300, label: '+1.3k', color: '#f87171', text: '#ffffff' },
  { amount: 1400, label: '+1.4k', color: '#3b82f6', text: '#ffffff' },
  { amount: 1500, label: '+1.5k', color: '#f59e0b', text: '#451a03' },
  { amount: 1600, label: '+1.6k', color: '#ec4899', text: '#ffffff' },
  { amount: 1700, label: '+1.7k', color: '#14b8a6', text: '#ffffff' },
  { amount: 1800, label: '+1.8k', color: '#ef4444', text: '#ffffff' },
  { amount: 1900, label: '+1.9k', color: '#6366f1', text: '#ffffff' },
  { amount: 2000, label: '+2.0k', color: '#fde047', text: '#451a03' },
];

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function playTone(freqStart: number, freqEnd: number, duration = 0.06) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration + 0.01);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch {
    // Ignore audio context restrictions
  }
}

export const DailyClickerView: React.FC<DailyClickerViewProps> = ({
  tokens,
  clickUpgradeLevel,
  bestDailyClicks,
  equippedBlookId,
  lastDailyPlayAt,
  lastWheelSpinAt,
  lastHourlyClaimAt,
  sessionToken,
  onEarnTokens,
  onBuyClickUpgrade,
  onUpdateBestClicks,
  onLockDaily,
  onRecordWheelSpin,
  onClaimHourlyReward,
}) => {
  const ROUND_DURATION = 30.0;
  const [subTab, setSubTab] = useState<'CLICKER' | 'WHEEL' | 'HOURLY'>('CLICKER');
  const [now, setNow] = useState<number>(() => Date.now());

  const [phase, setPhase] = useState<'READY' | 'ACTIVE' | 'FINISHED'>('READY');
  const [timeLeft, setTimeLeft] = useState<number>(ROUND_DURATION);
  const [clicksThisRun, setClicksThisRun] = useState<number>(0);
  const [tokensThisRun, setTokensThisRun] = useState<number>(0);
  const [popups, setPopups] = useState<FloatingClickPopup[]>([]);
  const [isPressed, setIsPressed] = useState(false);

  // Daily Wheel state
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [wheelPrize, setWheelPrize] = useState<number | null>(null);

  // Hourly Reward state
  const [claimingHourly, setClaimingHourly] = useState<boolean>(false);
  const [hourlyPrize, setHourlyPrize] = useState<number | null>(null);
  const [hourlyError, setHourlyError] = useState<string | null>(null);

  const endTimeRef = useRef<number | null>(null);
  const clicksRef = useRef<number>(0);
  const popupCounterRef = useRef<number>(0);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tokensPerClick = 1 + clickUpgradeLevel;
  // Costs 50 tokens first, then increases by 200 tokens every time you buy it (50, 250, 450, 650...)
  const nextUpgradeCost = 50 + clickUpgradeLevel * 200;
  const canAffordUpgrade = tokens >= nextUpgradeCost;

  // Live clock for 24h and 1h locks
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, []);

  const dailyUnlockAt = lastDailyPlayAt ? lastDailyPlayAt + TWENTY_FOUR_HOURS_MS : 0;
  const dailyRemainingMs = Math.max(0, dailyUnlockAt - now);
  const isDailyLocked = dailyRemainingMs > 0 && phase !== 'ACTIVE';

  useEffect(() => {
    if (phase === 'FINISHED' && dailyRemainingMs === 0) {
      setPhase('READY');
      setTimeLeft(ROUND_DURATION);
    }
  }, [phase, dailyRemainingMs]);

  const wheelUnlockAt = lastWheelSpinAt ? lastWheelSpinAt + TWENTY_FOUR_HOURS_MS : 0;
  const wheelRemainingMs = Math.max(0, wheelUnlockAt - now);
  const isWheelLocked = wheelRemainingMs > 0 && !isSpinning;

  const hourlyUnlockAt = lastHourlyClaimAt ? lastHourlyClaimAt + ONE_HOUR_MS : 0;
  const hourlyRemainingMs = Math.max(0, hourlyUnlockAt - now);
  const isHourlyLocked = hourlyRemainingMs > 0;

  useEffect(() => {
    if (phase !== 'ACTIVE') return;

    const interval = setInterval(() => {
      if (!endTimeRef.current) return;
      const remainingMs = endTimeRef.current - Date.now();
      if (remainingMs <= 0) {
        setTimeLeft(0);
        setPhase('FINISHED');
        onUpdateBestClicks(clicksRef.current);
        onLockDaily(Date.now());
        clearInterval(interval);
      } else {
        setTimeLeft(remainingMs / 1000);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [phase, onUpdateBestClicks, onLockDaily]);

  const handleTargetClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDailyLocked || phase === 'FINISHED') return;

    if (phase === 'READY') {
      clicksRef.current = 0;
      setClicksThisRun(0);
      setTokensThisRun(0);
      endTimeRef.current = Date.now() + ROUND_DURATION * 1000;
      setPhase('ACTIVE');
    }

    clicksRef.current += 1;
    setClicksThisRun(clicksRef.current);
    setTokensThisRun((prev) => prev + tokensPerClick);
    onEarnTokens(tokensPerClick);
    playTone(520, 840, 0.05);

    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 75);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
    const y = e.clientY ? e.clientY - rect.top : rect.height / 2;
    const id = ++popupCounterRef.current;

    setPopups((prev) => [...prev.slice(-14), { id, x, y, amount: tokensPerClick }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 650);
  };

  const handleSpinWheel = () => {
    if (isWheelLocked || isSpinning) return;

    // Weighted pick across the 11 +1.0k to +2.0k rewards
    const weights = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 5];
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let winningIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        winningIdx = i;
        break;
      }
    }

    const segAngle = 360 / WHEEL_SEGMENTS.length;
    // Pointer is at top (0 deg). Center of slice i is i*segAngle + segAngle/2 clockwise from top.
    const sliceCenter = winningIdx * segAngle + segAngle / 2;
    const extraSpins = 360 * 6;
    const currentMod = wheelRotation % 360;
    const targetMod = (360 - sliceCenter) % 360;
    const deltaMod = (targetMod - currentMod + 360) % 360;
    const nextRotation = wheelRotation + extraSpins + deltaMod;

    setIsSpinning(true);
    setWheelPrize(null);
    setWheelRotation(nextRotation);
    playTone(400, 720, 0.14);

    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = setTimeout(() => {
      const won = WHEEL_SEGMENTS[winningIdx].amount;
      setIsSpinning(false);
      setWheelPrize(won);
      onEarnTokens(won);
      onRecordWheelSpin(Date.now());
      playTone(587, 988, 0.22);
    }, 4100);
  };

  const handleClaimHourly = async () => {
    if (isHourlyLocked || claimingHourly) return;
    setClaimingHourly(true);
    setHourlyError(null);
    try {
      const res = await apiFetch('/api/rewards/hourly', {
        method: 'POST',
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setHourlyError(data.error || 'Hourly reward is not ready yet.');
        return;
      }
      setHourlyPrize(data.reward);
      onClaimHourlyReward(data.reward, data.tokens, data.lastHourlyClaimAt);
      playTone(587, 1046, 0.22);
    } catch {
      setHourlyError('Network error claiming hourly reward.');
    } finally {
      setClaimingHourly(false);
    }
  };

  const elapsed = phase === 'READY' ? 0 : ROUND_DURATION - timeLeft;
  const currentCps = elapsed > 0.2 ? (clicksThisRun / elapsed).toFixed(1) : '0.0';
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / ROUND_DURATION) * 100));

  return (
    <div className="relative z-10 px-9 pt-6 pb-16 min-h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="font-titan text-white text-[44px] leading-none tracking-wide drop-shadow-[0_3px_0_rgba(0,0,0,0.18)]">
            Rewards
          </h1>
          <p className="font-nunito font-extrabold text-white/90 text-sm mt-1">
            Hourly Reward (300–900 Tokens) · 30s Clicker Sprint (24h) · Daily Token Wheel
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/20 text-white px-4 py-2 rounded-xl font-nunito font-black text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-300" />
            <span className="tabular-nums">Best 30s: {bestDailyClicks} Clicks</span>
          </div>
        </div>
      </div>

      {/* Sub-Tab Switcher: 30s Clicker vs Daily Token Wheel vs Hourly Reward */}
      <div className="inline-flex flex-wrap self-start items-center gap-1.5 p-1.5 rounded-2xl bg-white/20 mb-6">
        <button
          type="button"
          onClick={() => setSubTab('CLICKER')}
          className={`px-5 py-2 rounded-xl font-titan text-base flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'CLICKER'
              ? 'bg-white text-[#dc2626] shadow-sm'
              : 'text-white hover:bg-white/10'
          }`}
        >
          <MousePointerClick className="w-4 h-4" />
          <span>30s Clicker & Upgrades</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('WHEEL')}
          className={`px-5 py-2 rounded-xl font-titan text-base flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'WHEEL'
              ? 'bg-white text-[#dc2626] shadow-sm'
              : 'text-white hover:bg-white/10'
          }`}
        >
          <Disc3 className="w-4 h-4" />
          <span>Daily Token Wheel</span>
          {!isWheelLocked && (
            <span className="text-xs font-nunito font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">
              Ready
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('HOURLY')}
          className={`px-5 py-2 rounded-xl font-titan text-base flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'HOURLY'
              ? 'bg-white text-[#dc2626] shadow-sm'
              : 'text-white hover:bg-white/10'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Hourly Reward</span>
          {!isHourlyLocked && (
            <span className="text-xs font-nunito font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">
              Ready
            </span>
          )}
        </button>
      </div>

      {/* Main 2-Column Layout: Active Daily Activity (Left) + Click Upgrades Always Unlocked (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start max-w-5xl">
        {/* LEFT COLUMN: 30s CLICKER OR DAILY WHEEL */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-col items-center">
          {subTab === 'CLICKER' ? (
            <>
              {/* Timer & Live Stats Row */}
              <div className="w-full grid grid-cols-3 gap-3 mb-4">
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs font-nunito font-black text-[#dc2626]">
                    <Timer className="w-3.5 h-3.5" />
                    <span>TIME LEFT</span>
                  </div>
                  <p className="font-titan text-2xl text-slate-900 tabular-nums mt-0.5">
                    {timeLeft.toFixed(1)}s
                  </p>
                </div>

                <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs font-nunito font-black text-[#e11d48]">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    <span>CLICKS ({currentCps}/s)</span>
                  </div>
                  <p className="font-titan text-2xl text-slate-900 tabular-nums mt-0.5">
                    {clicksThisRun}
                  </p>
                </div>

                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs font-nunito font-black text-amber-700">
                    <BlooketTokenIcon className="w-4 h-4" />
                    <span>EARNED</span>
                  </div>
                  <p className="font-titan text-2xl text-amber-600 tabular-nums mt-0.5">
                    +{tokensThisRun.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* 30s Countdown Bar */}
              <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden mb-6 border border-slate-200">
                <div
                  className="h-full transition-all duration-75 rounded-full"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: timeLeft <= 5 && phase === 'ACTIVE' ? '#b91c1c' : '#f87171',
                  }}
                />
              </div>

              {/* 24-Hour Lock State vs Active/Ready Target */}
              {isDailyLocked ? (
                <div className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-7 text-center my-2">
                  <div className="w-16 h-16 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h2 className="font-titan text-3xl text-slate-800 mb-1">
                    Daily Clicker Locked
                  </h2>
                  <p className="font-nunito font-bold text-slate-600 text-sm mb-4">
                    You already completed today&apos;s 30-second sprint! You can still buy Click Upgrades on the right or spin the Daily Wheel.
                  </p>
                  <div className="inline-flex flex-col items-center bg-white border-2 border-red-200 px-6 py-3 rounded-2xl mb-4">
                    <span className="font-nunito font-black text-xs text-[#dc2626]">
                      NEXT SPRINT UNLOCKS IN
                    </span>
                    <span className="font-titan text-3xl text-slate-900 tabular-nums mt-0.5">
                      {formatRemaining(dailyRemainingMs)}
                    </span>
                  </div>
                  {tokensThisRun > 0 && (
                    <p className="font-nunito font-extrabold text-xs text-emerald-600">
                      Last Sprint Earned: +{tokensThisRun.toLocaleString()} Tokens ({clicksThisRun} clicks)
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center py-2">
                  <button
                    type="button"
                    onClick={handleTargetClick}
                    className={`relative w-56 h-56 rounded-full bg-gradient-to-b from-[#f87171] to-[#ef4444] border-8 border-white shadow-[0_12px_0_#b91c1c,0_20px_35px_rgba(0,0,0,0.2)] flex flex-col items-center justify-center cursor-pointer transition-transform select-none ${
                      isPressed ? 'scale-95 translate-y-1.5 shadow-[0_6px_0_#b91c1c]' : 'hover:scale-[1.03]'
                    }`}
                  >
                    <div className="w-28 h-28 pointer-events-none drop-shadow-md flex items-center justify-center">
                      {equippedBlookId ? (
                        <BlookArt id={equippedBlookId} className="w-full h-full" />
                      ) : (
                        <BlooketTokenIcon className="w-24 h-24" />
                      )}
                    </div>
                    <span className="mt-2 font-titan text-white text-xl tracking-wide drop-shadow-[0_2px_0_rgba(0,0,0,0.3)] pointer-events-none">
                      {phase === 'READY' ? 'CLICK TO START!' : `+${tokensPerClick} / CLICK`}
                    </span>

                    {popups.map((popup) => (
                      <span
                        key={popup.id}
                        className="pointer-events-none absolute font-titan text-2xl text-[#fde047] drop-shadow-[0_2px_0_#78350f] animate-bounce"
                        style={{
                          left: `${popup.x}px`,
                          top: `${popup.y - 24}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        +{popup.amount}
                      </span>
                    ))}
                  </button>

                  <p className="mt-6 font-nunito font-extrabold text-sm text-slate-500 text-center">
                    {phase === 'READY'
                      ? 'Clicking the circle starts your 30-second sprint (locks for 24 hours after!).'
                      : 'Keep clicking as fast as you can before time runs out!'}
                  </p>
                </div>
              )}
            </>
          ) : subTab === 'WHEEL' ? (
            /* DAILY TOKEN WHEEL */
            <div className="w-full flex flex-col items-center py-2">
              <div className="text-center mb-4">
                <h2 className="font-titan text-3xl text-[#dc2626]">Daily Token Wheel</h2>
                <p className="font-nunito font-bold text-xs text-slate-500 mt-1">
                  Spin once every 24 hours for free Clicket Tokens (+1.0k to +2.0k Tokens)!
                </p>
              </div>

              {/* Wheel Container */}
              <div className="relative w-80 h-80 flex items-center justify-center mb-5">
                {/* Top Pointer Triangle */}
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0"
                  style={{
                    borderLeft: '14px solid transparent',
                    borderRight: '14px solid transparent',
                    borderTop: '24px solid #ef4444',
                    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))',
                  }}
                />

                {/* Rotating SVG Wheel */}
                <div
                  className="w-full h-full rounded-full shadow-[0_10px_25px_rgba(0,0,0,0.2)] border-8 border-[#dc2626]"
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    transition: isSpinning
                      ? 'transform 4s cubic-bezier(0.15, 0.88, 0.2, 1)'
                      : 'none',
                  }}
                >
                  <svg viewBox="0 0 260 260" className="w-full h-full">
                    {WHEEL_SEGMENTS.map((seg, i) => {
                      const sliceDeg = 360 / WHEEL_SEGMENTS.length;
                      const startAngle = (i * sliceDeg - 90) * (Math.PI / 180);
                      const endAngle = ((i + 1) * sliceDeg - 90) * (Math.PI / 180);
                      const x1 = 130 + 130 * Math.cos(startAngle);
                      const y1 = 130 + 130 * Math.sin(startAngle);
                      const x2 = 130 + 130 * Math.cos(endAngle);
                      const y2 = 130 + 130 * Math.sin(endAngle);
                      const midDeg = i * sliceDeg + sliceDeg / 2;

                      return (
                        <g key={i}>
                          <path
                            d={`M 130 130 L ${x1} ${y1} A 130 130 0 0 1 ${x2} ${y2} Z`}
                            fill={seg.color}
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                          <g transform={`rotate(${midDeg - 90} 130 130)`}>
                            {/* Label + Token Icon side-by-side along the slice */}
                            <text
                              x="216"
                              y="135"
                              textAnchor="end"
                              fill={seg.text}
                              fontSize="14.5"
                              fontWeight="900"
                              fontFamily="Nunito, sans-serif"
                            >
                              {seg.label}
                            </text>
                            <g transform="translate(220, 121.5) scale(0.42)">
                              <circle cx="21.5" cy="21.5" r="15.5" fill="#b45309" />
                              <circle cx="19" cy="19" r="15.5" fill="#fbbf24" stroke="#d97706" strokeWidth="1.8" />
                              <circle cx="19" cy="19" r="11.4" fill="#f59e0b" stroke="#fde68a" strokeWidth="1.4" />
                              <text
                                x="18.8"
                                y="24.6"
                                textAnchor="middle"
                                fill="#fef3c7"
                                fontFamily="'Titan One', cursive, sans-serif"
                                fontSize="17"
                                fontWeight="bold"
                              >
                                C
                              </text>
                            </g>
                          </g>
                        </g>
                      );
                    })}
                    <circle cx="130" cy="130" r="24" fill="#ffffff" stroke="#dc2626" strokeWidth="5" />
                  </svg>
                </div>
              </div>

              {wheelPrize !== null && !isSpinning && (
                <div className="mb-4 px-5 py-2.5 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center gap-2 animate-pop-reveal">
                  <Sparkles className="w-5 h-5 text-amber-700" />
                  <BlooketTokenIcon className="w-5 h-5" />
                  <span className="font-titan text-xl text-amber-800">
                    You won +{wheelPrize.toLocaleString()} Tokens!
                  </span>
                </div>
              )}

              {isWheelLocked ? (
                <div className="px-6 py-3 rounded-2xl bg-slate-100 border-2 border-slate-200 text-center">
                  <span className="block font-nunito font-black text-xs text-slate-500">
                    NEXT WHEEL SPIN IN
                  </span>
                  <span className="font-titan text-2xl text-slate-800 tabular-nums">
                    {formatRemaining(wheelRemainingMs)}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isSpinning}
                  onClick={handleSpinWheel}
                  className="px-9 py-3.5 rounded-2xl bg-[#fbbf24] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_6px_0_#b45309] text-amber-950 font-titan text-2xl cursor-pointer transition-all disabled:opacity-60"
                >
                  {isSpinning ? 'Spinning...' : 'Spin Daily Wheel!'}
                </button>
              )}
            </div>
          ) : (
            /* HOURLY REWARD (300 - 900 TOKENS, DIVISIBLE BY 5) */
            <div className="w-full flex flex-col items-center py-4 text-center">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 border-4 border-white shadow-[0_10px_25px_rgba(245,158,11,0.35)] flex items-center justify-center mb-4">
                <Gift className="w-12 h-12 text-amber-950 drop-shadow-sm" />
              </div>

              <h2 className="font-titan text-3xl text-[#dc2626]">Hourly Reward</h2>
              <p className="font-nunito font-bold text-sm text-slate-500 mt-1 max-w-sm">
                Claim once every hour for a random drop between{' '}
                <strong className="text-slate-700">300 and 900 Tokens</strong> (always a multiple of 5)!
              </p>

              {hourlyError && (
                <div className="mt-4 px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-nunito font-extrabold text-xs">
                  {hourlyError}
                </div>
              )}

              {hourlyPrize !== null && (
                <div className="mt-5 px-6 py-3 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center gap-2.5 animate-pop-reveal shadow-sm">
                  <Sparkles className="w-5 h-5 text-amber-700" />
                  <BlooketTokenIcon className="w-6 h-6" />
                  <span className="font-titan text-2xl text-amber-900">
                    +{hourlyPrize.toLocaleString()} Tokens Claimed!
                  </span>
                </div>
              )}

              <div className="mt-6">
                {isHourlyLocked ? (
                  <div className="px-7 py-4 rounded-2xl bg-slate-100 border-2 border-slate-200 text-center">
                    <span className="flex items-center justify-center gap-1.5 font-nunito font-black text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>NEXT HOURLY REWARD IN</span>
                    </span>
                    <span className="block font-titan text-3xl text-slate-800 tabular-nums mt-1">
                      {formatRemaining(hourlyRemainingMs)}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={claimingHourly}
                    onClick={handleClaimHourly}
                    className="px-10 py-4 rounded-2xl bg-[#fbbf24] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_6px_0_#b45309] text-amber-950 font-titan text-2xl cursor-pointer transition-all disabled:opacity-60 flex items-center gap-2.5"
                  >
                    <BlooketTokenIcon className="w-7 h-7" />
                    <span>{claimingHourly ? 'Claiming...' : 'Claim Hourly Reward!'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: HOURLY REWARD QUICK-CLAIM + CLICK UPGRADES */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Hourly Reward Quick-Claim Card */}
          <div className="bg-white rounded-3xl p-5 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-col gap-3.5 border-2 border-amber-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-titan text-xl text-slate-800 leading-tight">
                    Hourly Reward
                  </h2>
                  <p className="font-nunito font-bold text-xs text-slate-500">
                    300–900 Tokens every hour (x5)
                  </p>
                </div>
              </div>

              {!isHourlyLocked && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-nunito font-black text-xs shrink-0">
                  Ready!
                </span>
              )}
            </div>

            {hourlyPrize !== null && (
              <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-900 font-nunito font-black text-xs">
                <BlooketTokenIcon className="w-4 h-4" />
                <span>Last Claim: +{hourlyPrize.toLocaleString()} Tokens!</span>
              </div>
            )}

            {isHourlyLocked ? (
              <div className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                <span className="font-nunito font-black text-xs text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Cooldown</span>
                </span>
                <span className="font-titan text-lg text-slate-800 tabular-nums">
                  {formatRemaining(hourlyRemainingMs)}
                </span>
              </div>
            ) : (
              <button
                type="button"
                disabled={claimingHourly}
                onClick={handleClaimHourly}
                className="w-full py-2.5 px-4 rounded-xl font-titan text-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-[#fbbf24] hover:brightness-105 text-amber-950 shadow-[0_5px_0_#b45309] active:translate-y-0.5 active:shadow-none disabled:opacity-60"
              >
                <BlooketTokenIcon className="w-5 h-5" />
                <span>{claimingHourly ? 'Claiming...' : 'Claim'}</span>
              </button>
            )}
          </div>

          {/* Click Upgrades Card */}
          <div className="bg-white rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.18)] flex flex-col gap-5">
            <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-4">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center shrink-0">
                <ArrowUpCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-titan text-2xl text-slate-800 leading-tight">
                  Click Upgrades
                </h2>
                <p className="font-nunito font-bold text-xs text-slate-500">
                  Always open — upgrade even while Daily is locked!
                </p>
              </div>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="font-nunito font-black text-xs text-[#dc2626] uppercase">
                  Current Power (Lv. {clickUpgradeLevel})
                </span>
                <p className="font-titan text-3xl text-slate-900 mt-0.5 tabular-nums">
                  {tokensPerClick} {tokensPerClick === 1 ? 'Token' : 'Tokens'} / Click
                </p>
              </div>
              <BlooketTokenIcon className="w-11 h-11" />
            </div>

            <div className="rounded-2xl border-2 border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-titan text-lg text-slate-800">
                  +1 Token Per Click
                </span>
                <span className="font-nunito font-black text-xs text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  {tokensPerClick} → {tokensPerClick + 1} / click
                </span>
              </div>
              <p className="font-nunito font-bold text-xs text-slate-500 mb-4">
                Starts at 50 tokens and increases by 200 tokens every time you buy an upgrade.
              </p>

              <button
                type="button"
                disabled={!canAffordUpgrade}
                onClick={() => onBuyClickUpgrade(nextUpgradeCost)}
                className={`w-full py-3 px-4 rounded-xl font-titan text-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  canAffordUpgrade
                    ? 'bg-[#fbbf24] hover:brightness-105 text-amber-950 shadow-[0_5px_0_#b45309] active:translate-y-0.5 active:shadow-none'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <BlooketTokenIcon className="w-6 h-6" />
                <span>Upgrade ({nextUpgradeCost.toLocaleString()} Tokens)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
