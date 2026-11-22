import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BlookItem, PackInfo, RARITY_COLORS } from '../data/blooks';
import { BlookArt } from './BlookArt';
import { PackCoverArt } from './PackCoverArt';

export interface PackPullResult {
  blook: BlookItem;
  isNew: boolean;
}

interface PackRevealModalProps {
  pack: PackInfo;
  pulls: PackPullResult[];
  onClose: () => void;
  onOpenAnother?: () => void;
  canAffordAnother: boolean;
}

type PackAnimationPhase = 'READY' | 'SHAKING' | 'TEARING' | 'BURST' | 'REVEALED';
type ConfettiShape = 'triangle' | 'rectangle' | 'circle';

function playSfx(type: 'shake' | 'rip' | 'reveal' | 'mystic') {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'shake') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } else if (type === 'rip') {
      const bufferSize = ctx.sampleRate * 0.25;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, ctx.currentTime);
      filter.Q.setValueAtTime(1.5, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } else if (type === 'reveal' || type === 'mystic') {
      const freqs =
        type === 'mystic'
          ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
          : [440, 554.37, 659.25, 880];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.06 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.06);
        osc.stop(ctx.currentTime + idx * 0.06 + 0.38);
      });
    }
  } catch {
    // Ignore audio autoplay restrictions
  }
}

/**
 * Generates lighter & darker shades of the exact rarity color so all confetti stays within that rarity shade.
 */
function getRarityShades(hex: string): string[] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) {
    return [hex];
  }

  const mix = (targetR: number, targetG: number, targetB: number, amount: number) => {
    const nr = Math.round(r + (targetR - r) * amount);
    const ng = Math.round(g + (targetG - g) * amount);
    const nb = Math.round(b + (targetB - b) * amount);
    return `rgb(${nr}, ${ng}, ${nb})`;
  };

  return [
    hex,
    mix(255, 255, 255, 0.25),
    mix(255, 255, 255, 0.45),
    mix(0, 0, 0, 0.18),
    mix(0, 0, 0, 0.32),
  ];
}

const ConfettiPieceSvg: React.FC<{ shape: ConfettiShape; color: string; size: number }> = ({
  shape,
  color,
  size,
}) => {
  if (shape === 'triangle') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="12,2 22,21 2,21" fill={color} />
      </svg>
    );
  }
  if (shape === 'rectangle') {
    return (
      <svg width={size * 1.15} height={size * 0.72} viewBox="0 0 28 18" aria-hidden="true">
        <rect x="1" y="1" width="26" height="16" rx="2.5" fill={color} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={color} />
    </svg>
  );
};

const StageRevealCard: React.FC<{ packId: string; blook: BlookItem; isNew: boolean }> = ({
  packId,
  blook,
  isNew,
}) => {
  const rarityColor = RARITY_COLORS[blook.rarity];
  const isAthletes = packId === 'athletes' || blook.packId === 'athletes';

  return (
    <div className="flex flex-col items-center">
      {/* Rarity Pill Badge */}
      <div
        className="mb-3 px-6 py-1.5 rounded-full font-nunito font-black text-lg tracking-wide shadow-xl border-2 border-white/50 animate-new-badge"
        style={{ backgroundColor: rarityColor, color: '#ffffff' }}
      >
        {blook.rarity}
      </div>

      {/* Rounded Black Frame matching real Blooket pack reveal card */}
      <div className="relative w-[340px] h-[360px] bg-black rounded-[38px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.65)] flex items-center justify-center overflow-hidden border-2 border-white/20">
        {isAthletes ? (
          <svg viewBox="0 0 300 320" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <clipPath id="athletesWindowClip">
                <rect x="14" y="12" width="272" height="296" rx="28" />
              </clipPath>
              <linearGradient id="stadiumSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="45%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#bbf7d0" />
              </linearGradient>
            </defs>

            <g clipPath="url(#athletesWindowClip)">
              {/* Stadium Sky & Floodlight Glow */}
              <rect x="14" y="12" width="272" height="190" fill="url(#stadiumSky)" />
              <circle cx="52" cy="40" r="32" fill="#ffffff" opacity="0.22" />
              <circle cx="248" cy="40" r="32" fill="#ffffff" opacity="0.22" />

              {/* Stadium Bleachers Silhouette */}
              <rect x="14" y="110" width="272" height="45" fill="#1e293b" opacity="0.45" />
              <line x1="14" y1="125" x2="286" y2="125" stroke="#ffffff" strokeWidth="2" opacity="0.25" />
              <line x1="14" y1="140" x2="286" y2="140" stroke="#ffffff" strokeWidth="2" opacity="0.25" />

              {/* Mowed Green Athletic Turf Stripes */}
              <rect x="14" y="150" width="272" height="160" fill="#22c55e" />
              {[14, 48, 82, 116, 150, 184, 218, 252].map((x, idx) => (
                <rect
                  key={x}
                  x={x}
                  y="150"
                  width="34"
                  height="160"
                  fill={idx % 2 === 0 ? '#4ade80' : '#22c55e'}
                />
              ))}

              {/* Crisp White Field Markings */}
              <line x1="14" y1="154" x2="286" y2="154" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
              <ellipse cx="150" cy="232" rx="68" ry="26" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.7" />
              <line x1="150" y1="154" x2="150" y2="308" stroke="#ffffff" strokeWidth="3.5" opacity="0.7" />
            </g>
          </svg>
        ) : (
          <svg viewBox="0 0 300 320" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <clipPath id="stageWindowClip">
                <path d="M18 32 Q150 4 282 32 V298 H18 Z" />
              </clipPath>
            </defs>

            <g clipPath="url(#stageWindowClip)">
              <rect x="18" y="10" width="264" height="245" fill="#d97706" />
              {[18, 42, 66, 90, 114, 138, 162, 186, 210, 234, 258].map((x, idx) => (
                <rect
                  key={x}
                  x={x}
                  y="10"
                  width="24"
                  height="245"
                  fill={idx % 2 === 0 ? '#ea8a1a' : '#c96f0c'}
                />
              ))}

              {/* Left Curtain */}
              <path d="M18 35 H108 C88 100 72 165 65 245 H18 Z" fill="#991b1b" />
              <path d="M18 35 H85 C70 100 58 165 50 245 H18 Z" fill="#dc2626" />
              <path d="M18 35 H56 C46 100 38 165 32 245 H18 Z" fill="#b91c1c" />
              <path d="M18 112 L68 124 L64 142 L18 134 Z" fill="#facc15" />

              {/* Right Curtain */}
              <path d="M282 35 H192 C212 100 228 165 235 245 H282 Z" fill="#991b1b" />
              <path d="M282 35 H215 C230 100 242 165 250 245 H282 Z" fill="#dc2626" />
              <path d="M282 35 H244 C254 100 262 165 268 245 H282 Z" fill="#b91c1c" />
              <path d="M282 112 L232 124 L236 142 L282 134 Z" fill="#facc15" />

              {/* Proscenium Arch */}
              <path d="M14 28 Q150 -2 286 28 L286 78 Q150 48 14 78 Z" fill="#6b3410" />
              {[55, 95, 135, 165, 205, 245].map((x) => (
                <line key={x} x1={x} y1="12" x2={x} y2="72" stroke="#4a2208" strokeWidth="2.5" />
              ))}
              <path d="M14 74 Q150 44 286 74 L286 82 Q150 52 14 82 Z" fill="#4a2208" />

              {/* Stage Floor and Posts */}
              <rect x="24" y="252" width="252" height="46" fill="#2b1204" />
              {[32, 58, 84, 110, 136, 162, 188, 214, 240, 260].map((x) => (
                <rect key={x} x={x} y="254" width="14" height="44" fill="#783912" />
              ))}
              <rect x="12" y="236" width="276" height="14" rx="2" fill="#6b3410" />
              <rect x="18" y="248" width="264" height="8" fill="#4a2208" />
            </g>
          </svg>
        )}

        {/* Blook Name at Top */}
        <div className="absolute top-9 inset-x-4 flex justify-center text-center pointer-events-none">
          <h3
            className="font-titan text-white text-[26px] leading-tight tracking-wide drop-shadow-[0_3px_2px_rgba(0,0,0,0.65)]"
            style={{
              WebkitTextStroke: isAthletes ? '2px #14532d' : '2px #3b1908',
              paintOrder: 'stroke fill',
            }}
          >
            {blook.name}
          </h3>
        </div>

        {/* Blook Center Stage */}
        <div className="absolute top-[92px] w-36 h-36 flex items-center justify-center pointer-events-none drop-shadow-[0_8px_10px_rgba(0,0,0,0.45)]">
          <BlookArt id={blook.id} className="w-full h-full" />
        </div>

        {/* Bottom percentage & "- New!" label */}
        <div className="absolute bottom-5 inset-x-4 flex justify-center text-center pointer-events-none">
          <span
            className="font-titan text-white text-[22px] tracking-wide drop-shadow-[0_2px_2px_rgba(0,0,0,0.85)]"
            style={{
              WebkitTextStroke: isAthletes ? '1.8px #14532d' : '1.8px #2b1204',
              paintOrder: 'stroke fill',
            }}
          >
            {blook.chanceLabel}
            {isNew ? ' - New!' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

export const PackRevealModal: React.FC<PackRevealModalProps> = ({
  pack,
  pulls,
  onClose,
  onOpenAnother,
  canAffordAnother,
}) => {
  const [phase, setPhase] = useState<PackAnimationPhase>('READY');
  const [inspectedPull, setInspectedPull] = useState<PackPullResult | null>(null);
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearPhaseTimers = () => {
    phaseTimersRef.current.forEach((t) => clearTimeout(t));
    phaseTimersRef.current = [];
  };

  const isMulti = pulls.length > 1;

  const rarityRank: Record<string, number> = {
    Uncommon: 1,
    Rare: 2,
    Epic: 3,
    Legendary: 4,
    Chroma: 5,
    Mystic: 6,
  };
  const bestPull = pulls.reduce((best, curr) =>
    rarityRank[curr.blook.rarity] > rarityRank[best.blook.rarity] ? curr : best
  );
  const rarityColor = RARITY_COLORS[bestPull.blook.rarity];

  useEffect(() => {
    clearPhaseTimers();
    setPhase('READY');
    setInspectedPull(null);
    return clearPhaseTimers;
  }, [pulls, pack]);

  const handleStartOpening = () => {
    if (phase !== 'READY') return;
    clearPhaseTimers();

    setPhase('SHAKING');
    playSfx('shake');
    phaseTimersRef.current.push(
      setTimeout(() => playSfx('shake'), 250),
      setTimeout(() => playSfx('shake'), 500),
      setTimeout(() => {
        setPhase('TEARING');
        playSfx('rip');
      }, 750),
      setTimeout(() => {
        setPhase('BURST');
        if (bestPull.blook.rarity === 'Mystic' || bestPull.blook.rarity === 'Chroma') {
          playSfx('mystic');
        } else {
          playSfx('reveal');
        }
      }, 1150),
      setTimeout(() => {
        setPhase('REVEALED');
      }, 1450)
    );
  };

  // Confetti strictly using Triangle, Rectangle, and Circle shapes in shades of the pulled blook's rarity color
  const confettiParticles = useMemo(() => {
    const shades = getRarityShades(rarityColor);
    const shapes: ConfettiShape[] = ['triangle', 'rectangle', 'circle'];
    const total = 33;
    return Array.from({ length: total }, (_, idx) => {
      const angle = (idx / total) * Math.PI * 2 + (idx % 3) * 0.14;
      const dist = 160 + (idx % 5) * 58;
      const tx = Math.round(Math.cos(angle) * dist);
      const ty = Math.round(Math.sin(angle) * dist + 25);
      const rot = (idx % 2 === 0 ? 1 : -1) * (180 + (idx % 4) * 90);
      return {
        tx: `${tx}px`,
        ty: `${ty}px`,
        rot: `${rot}deg`,
        shape: shapes[idx % 3],
        color: shades[idx % shades.length],
        size: 13 + (idx % 4) * 3,
        delay: `${(idx % 6) * 0.035}s`,
        duration: `${0.95 + (idx % 3) * 0.2}s`,
      };
    });
  }, [rarityColor]);

  // Aggregate multi-pulls by blook id
  const groupedPulls = Object.values(
    pulls.reduce<Record<string, { blook: BlookItem; count: number; isNew: boolean }>>(
      (acc, p) => {
        if (!acc[p.blook.id]) {
          acc[p.blook.id] = { blook: p.blook, count: 1, isNew: p.isNew };
        } else {
          acc[p.blook.id].count += 1;
          acc[p.blook.id].isNew = acc[p.blook.id].isNew || p.isNew;
        }
        return acc;
      },
      {}
    )
  ).sort((a, b) => rarityRank[b.blook.rarity] - rarityRank[a.blook.rarity]);

  const isOpenedBg = phase === 'BURST' || phase === 'REVEALED';

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-4 select-none overflow-y-auto transition-colors duration-500 ${
        isOpenedBg ? '' : 'bg-black/80 backdrop-blur-[4px]'
      }`}
      style={
        isOpenedBg
          ? {
              backgroundColor: pack.revealBgColor,
              backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.45) 0%, ${pack.revealBgColor} 68%)`,
            }
          : undefined
      }
      onClick={() => {
        if (phase === 'REVEALED' && !inspectedPull) onClose();
      }}
    >
      {/* Dynamic Background Rays during Burst and Revealed */}
      {isOpenedBg && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden opacity-45">
          <div
            className="w-[850px] h-[850px] rounded-full animate-rays-fast"
            style={{
              background: `repeating-conic-gradient(from 0deg, ${rarityColor} 0deg 12deg, transparent 12deg 24deg)`,
              maskImage: 'radial-gradient(circle, black 25%, transparent 72%)',
              WebkitMaskImage: 'radial-gradient(circle, black 25%, transparent 72%)',
            }}
          />
        </div>
      )}

      {/* Confetti Explosion: Triangle, Rectangle, and Circle in Rarity Color Shades */}
      {isOpenedBg && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden z-20">
          {confettiParticles.map((p, i) => (
            <div
              key={i}
              className="absolute"
              style={
                {
                  '--tx': p.tx,
                  '--ty': p.ty,
                  '--rot': p.rot,
                  animation: `particleBurst ${p.duration} cubic-bezier(0.12, 0.8, 0.32, 1) ${p.delay} forwards`,
                  filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.2))`,
                } as React.CSSProperties
              }
            >
              <ConfettiPieceSvg shape={p.shape} color={p.color} size={p.size} />
            </div>
          ))}
        </div>
      )}

      {/* Center White Flash Burst */}
      {phase === 'BURST' && (
        <div className="pointer-events-none fixed z-30 w-72 h-72 rounded-full bg-white animate-flash-burst shadow-[0_0_90px_rgba(255,255,255,1)]" />
      )}

      {/* PHASES 1-3: READY, SHAKING, TEARING */}
      {phase !== 'REVEALED' && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleStartOpening();
          }}
          className="relative flex flex-col items-center cursor-pointer group z-10"
        >
          <div
            className={`relative flex items-center justify-center ${
              pack.id === 'athletes' ? 'w-[340px] h-80' : 'w-64 h-80'
            }`}
          >
            {phase === 'READY' && (
              <div className="w-full h-full animate-float-pack transition-transform group-hover:scale-105 relative">
                <PackCoverArt packId={pack.id} className="w-full h-full" />
                {isMulti && (
                  <span className="absolute -top-2 -right-2 bg-[#fbbf24] text-amber-950 font-titan text-xl px-3.5 py-1 rounded-2xl shadow-lg border-2 border-white rotate-6">
                    x{pulls.length}
                  </span>
                )}
              </div>
            )}

            {phase === 'SHAKING' && (
              <div className="w-full h-full animate-pack-shake-intense">
                <PackCoverArt packId={pack.id} className="w-full h-full" />
                <div className="absolute inset-0 rounded-2xl bg-amber-400/25 blur-md animate-pulse pointer-events-none" />
              </div>
            )}

            {(phase === 'TEARING' || phase === 'BURST') && (
              <div className="relative w-full h-full">
                <div className="absolute inset-x-0 top-0 h-[45%] z-20 animate-foil-top overflow-hidden">
                  <PackCoverArt packId={pack.id} className="w-full h-80" />
                </div>
                <div className="absolute top-[38%] inset-x-4 h-16 bg-gradient-to-r from-transparent via-white to-transparent blur-sm z-30 animate-pulse" />
                <div className="absolute inset-x-0 bottom-0 h-[60%] z-10 animate-foil-bottom overflow-hidden">
                  <div className="-translate-y-[40%]">
                    <PackCoverArt packId={pack.id} className="w-full h-80" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center">
            <p className="font-titan text-white text-2xl md:text-3xl tracking-wide drop-shadow-[0_4px_0_rgba(0,0,0,0.6)]">
              {phase === 'READY' &&
                (isMulti ? `Click to Open ${pulls.length} Packs!` : 'Click Pack to Open!')}
              {phase === 'SHAKING' && 'Opening...'}
              {(phase === 'TEARING' || phase === 'BURST') && 'Ripping Foil!'}
            </p>
            {phase === 'READY' && (
              <span className="mt-2 text-white/80 font-nunito font-extrabold text-sm bg-black/30 px-3.5 py-1 rounded-full">
                Cost: {(pack.price * pulls.length).toLocaleString()} Tokens
              </span>
            )}
          </div>
        </div>
      )}

      {/* PHASE 4: SINGLE PACK STAGE REVEAL */}
      {phase === 'REVEALED' && !isMulti && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative z-30 flex flex-col items-center animate-stage-reveal"
        >
          <StageRevealCard packId={pack.id} blook={pulls[0].blook} isNew={pulls[0].isNew} />

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-7 py-2.5 rounded-xl bg-white text-[#dc2626] font-titan text-lg shadow-[0_5px_0_#cbd5e1] active:translate-y-1 active:shadow-none hover:bg-slate-50 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              OK
            </button>
            {onOpenAnother && canAffordAnother && (
              <button
                onClick={onOpenAnother}
                className="px-7 py-2.5 rounded-xl bg-[#f87171] text-white font-titan text-lg shadow-[0_5px_0_#dc2626] active:translate-y-1 active:shadow-none hover:brightness-105 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Open Another ({pack.price})
              </button>
            )}
          </div>
        </div>
      )}

      {/* PHASE 4: MULTI-PACK REVEAL GALLERY */}
      {phase === 'REVEALED' && isMulti && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative z-30 flex flex-col items-center max-w-4xl w-full animate-stage-reveal"
        >
          {inspectedPull ? (
            <div className="flex flex-col items-center">
              <StageRevealCard
                packId={pack.id}
                blook={inspectedPull.blook}
                isNew={inspectedPull.isNew}
              />
              <button
                onClick={() => setInspectedPull(null)}
                className="mt-5 px-6 py-2.5 rounded-xl bg-white text-[#dc2626] font-titan text-lg shadow-[0_5px_0_#cbd5e1] cursor-pointer"
              >
                Back to All {pulls.length} Pulls
              </button>
            </div>
          ) : (
            <div className="w-full bg-slate-900/90 border-4 border-white/25 rounded-3xl p-6 shadow-2xl">
              <div className="text-center mb-5">
                <h2 className="font-titan text-3xl text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">
                  Opened {pulls.length} {pack.name}s!
                </h2>
                <p className="font-nunito font-bold text-white/75 text-sm">
                  Click any blook card below to view its reveal card
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 max-h-[55vh] overflow-y-auto p-1">
                {groupedPulls.map((entry) => {
                  const color = RARITY_COLORS[entry.blook.rarity];
                  return (
                    <button
                      key={entry.blook.id}
                      type="button"
                      onClick={() =>
                        setInspectedPull({ blook: entry.blook, isNew: entry.isNew })
                      }
                      className="relative bg-black/60 hover:bg-black/80 border-2 rounded-2xl p-3 flex flex-col items-center text-center transition-transform hover:scale-105 cursor-pointer"
                      style={{ borderColor: color }}
                    >
                      {entry.isNew && (
                        <span className="absolute -top-2 -left-2 bg-[#fbbf24] text-amber-950 font-titan text-xs px-2 py-0.5 rounded-lg shadow">
                          NEW!
                        </span>
                      )}
                      <span
                        className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md font-titan text-xs text-white"
                        style={{ backgroundColor: color }}
                      >
                        x{entry.count}
                      </span>
                      <div className="w-16 h-16 my-1">
                        <BlookArt id={entry.blook.id} className="w-full h-full" />
                      </div>
                      <span className="font-titan text-white text-sm leading-tight mt-1">
                        {entry.blook.name}
                      </span>
                      <span
                        className="font-nunito font-black text-[11px] mt-0.5"
                        style={{ color }}
                      >
                        {entry.blook.rarity} {entry.blook.chanceLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={onClose}
                  className="px-7 py-2.5 rounded-xl bg-white text-[#dc2626] font-titan text-lg shadow-[0_5px_0_#cbd5e1] active:translate-y-1 active:shadow-none hover:bg-slate-50 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  OK
                </button>
                {onOpenAnother && canAffordAnother && (
                  <button
                    onClick={onOpenAnother}
                    className="px-7 py-2.5 rounded-xl bg-[#f87171] text-white font-titan text-lg shadow-[0_5px_0_#dc2626] active:translate-y-1 active:shadow-none hover:brightness-105 transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Open {pulls.length} More ({(pack.price * pulls.length).toLocaleString()})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
