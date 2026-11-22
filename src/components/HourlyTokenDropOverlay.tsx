import React, { useEffect, useRef } from 'react';
import { BlooketTokenIcon } from './BlookArt';

export interface HourlyTokenBurst {
  id: number;
  reward: number;
  fromTokens: number;
  toTokens: number;
}

interface HourlyTokenDropOverlayProps {
  burst: HourlyTokenBurst | null;
  targetRef: React.RefObject<HTMLDivElement | null>;
  onProgressTokens: (displayedTokens: number, pulse?: boolean) => void;
  onComplete: () => void;
}

interface CoinState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  floorY: number;
  spawnDelayMs: number;
  spawned: boolean;
  settled: boolean;
  restX: number;
  restY: number;
  restRot: number;
  glideDelayMs: number;
  glideDurationMs: number;
  ctrlOffsetX: number;
  ctrlOffsetY: number;
  arrived: boolean;
}

function playCoinPing(pitchFactor: number) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = 760 + pitchFactor * 420;
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(base * 1.32, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.075);
  } catch {
    // Ignore audio context restrictions
  }
}

export const HourlyTokenDropOverlay: React.FC<HourlyTokenDropOverlayProps> = ({
  burst,
  targetRef,
  onProgressTokens,
  onComplete,
}) => {
  const coinRefs = useRef<(HTMLDivElement | null)[]>([]);
  const callbacksRef = useRef({ onProgressTokens, onComplete });
  callbacksRef.current = { onProgressTokens, onComplete };

  const coinCount = burst
    ? Math.min(36, Math.max(24, Math.round(burst.reward / 25)))
    : 0;

  useEffect(() => {
    if (!burst || coinCount === 0) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerSpread = Math.min(vw * 0.62, 680);
    const minX = Math.max(44, vw * 0.5 - centerSpread / 2);
    const maxX = Math.min(vw - 44, vw * 0.5 + centerSpread / 2);

    const coins: CoinState[] = Array.from({ length: coinCount }, (_, i) => {
      const startX = minX + Math.random() * Math.max(60, maxX - minX);
      const startY = -36 - Math.random() * 90;
      return {
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 150,
        vy: 80 + Math.random() * 190,
        rot: (Math.random() - 0.5) * 45,
        vRot: (Math.random() - 0.5) * 320,
        floorY: vh - (38 + Math.random() * 76),
        spawnDelayMs: i * 14 + Math.random() * 60,
        spawned: false,
        settled: false,
        restX: startX,
        restY: vh - 60,
        restRot: 0,
        glideDelayMs: i * 22,
        glideDurationMs: 560 + Math.random() * 140,
        ctrlOffsetX: (Math.random() - 0.5) * 130,
        ctrlOffsetY: -60 - Math.random() * 110,
        arrived: false,
      };
    });

    // Initialize DOM elements hidden until spawned
    coins.forEach((_, idx) => {
      const el = coinRefs.current[idx];
      if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translate3d(-100px, -100px, 0) scale(1)';
      }
    });

    let rafId = 0;
    const startTime = performance.now();
    let lastTime = startTime;
    let allSettledAt: number | null = null;
    let arrivedCount = 0;
    let lastPingTime = 0;
    const PAUSE_AFTER_STOP_MS = 360;
    const GRAVITY = 2400;
    const HALF_SIZE = 22;

    const getTargetPoint = () => {
      const rect = targetRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        return {
          tx: rect.left + rect.width * 0.45,
          ty: rect.top + rect.height * 0.5,
        };
      }
      return { tx: window.innerWidth - 190, ty: 34 };
    };

    const step = (now: number) => {
      const dt = Math.min(0.035, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const elapsedMs = now - startTime;

      const { tx, ty } = getTargetPoint();
      let settledCount = 0;

      if (allSettledAt === null) {
        // Phase 1: Drop & bounce near the bottom of the screen until all coins stop moving
        for (let i = 0; i < coins.length; i++) {
          const c = coins[i];
          const el = coinRefs.current[i];

          if (!c.spawned) {
            if (elapsedMs < c.spawnDelayMs) continue;
            c.spawned = true;
          }

          if (!c.settled) {
            c.vy += GRAVITY * dt;
            c.x += c.vx * dt;
            c.y += c.vy * dt;
            c.rot += c.vRot * dt;

            // Keep inside horizontal viewport bounds
            if (c.x < 32) {
              c.x = 32;
              c.vx = Math.abs(c.vx) * 0.6;
            } else if (c.x > window.innerWidth - 32) {
              c.x = window.innerWidth - 32;
              c.vx = -Math.abs(c.vx) * 0.6;
            }

            if (c.y >= c.floorY) {
              c.y = c.floorY;
              if (Math.abs(c.vy) > 105) {
                c.vy = -c.vy * 0.34;
                c.vx *= 0.62;
                c.vRot *= 0.48;
              } else {
                // Completely stopped near the bottom
                c.vy = 0;
                c.vx = 0;
                c.vRot = 0;
                c.settled = true;
                c.restX = c.x;
                c.restY = c.y;
                c.restRot = c.rot;
              }
            }
          }

          if (c.settled) {
            settledCount += 1;
          }

          if (el) {
            el.style.opacity = '1';
            el.style.transform = `translate3d(${c.x - HALF_SIZE}px, ${c.y - HALF_SIZE}px, 0) scale(1) rotate(${c.rot}deg)`;
          }
        }

        if (settledCount === coins.length) {
          allSettledAt = now;
        }
      } else {
        const sinceSettledMs = now - allSettledAt;

        if (sinceSettledMs < PAUSE_AFTER_STOP_MS) {
          // Hold stationary near the bottom briefly after stopping
          for (let i = 0; i < coins.length; i++) {
            const c = coins[i];
            const el = coinRefs.current[i];
            if (el) {
              el.style.opacity = '1';
              el.style.transform = `translate3d(${c.restX - HALF_SIZE}px, ${c.restY - HALF_SIZE}px, 0) scale(1) rotate(${c.restRot}deg)`;
            }
          }
        } else {
          // Phase 2: Glide to the header token icon + token count, growing smaller as they approach
          const glideClockMs = sinceSettledMs - PAUSE_AFTER_STOP_MS;

          for (let i = 0; i < coins.length; i++) {
            const c = coins[i];
            const el = coinRefs.current[i];
            if (c.arrived) continue;

            const localMs = glideClockMs - c.glideDelayMs;
            if (localMs <= 0) {
              if (el) {
                el.style.opacity = '1';
                el.style.transform = `translate3d(${c.restX - HALF_SIZE}px, ${c.restY - HALF_SIZE}px, 0) scale(1) rotate(${c.restRot}deg)`;
              }
              continue;
            }

            const rawT = Math.min(1, localMs / c.glideDurationMs);
            // Smooth ease-in-out glide
            const easeT =
              rawT < 0.5
                ? 2 * rawT * rawT
                : 1 - Math.pow(-2 * rawT + 2, 2) / 2;

            // Curved quadratic Bezier path from resting spot to header token pill
            const ctrlX = (c.restX + tx) * 0.5 + c.ctrlOffsetX;
            const ctrlY = (c.restY + ty) * 0.5 + c.ctrlOffsetY;
            const oneMinusT = 1 - easeT;

            const curX =
              oneMinusT * oneMinusT * c.restX +
              2 * oneMinusT * easeT * ctrlX +
              easeT * easeT * tx;
            const curY =
              oneMinusT * oneMinusT * c.restY +
              2 * oneMinusT * easeT * ctrlY +
              easeT * easeT * ty;

            // Scale shrinks continuously as the coin gets closer to the token icon & count
            const totalDist = Math.max(1, Math.hypot(tx - c.restX, ty - c.restY));
            const remainingDist = Math.hypot(tx - curX, ty - curY);
            const closenessRatio = Math.min(1, remainingDist / totalDist);
            const scale = 0.24 + 0.76 * closenessRatio;
            const rot = c.restRot * (1 - easeT);
            const opacity = rawT > 0.9 ? Math.max(0, (1 - rawT) / 0.1) : 1;

            if (el) {
              el.style.opacity = String(opacity);
              el.style.transform = `translate3d(${curX - HALF_SIZE}px, ${curY - HALF_SIZE}px, 0) scale(${scale}) rotate(${rot}deg)`;
            }

            if (rawT >= 1) {
              c.arrived = true;
              arrivedCount += 1;
              if (el) {
                el.style.opacity = '0';
              }
              const nextDisplay = Math.round(
                burst.fromTokens +
                  (burst.toTokens - burst.fromTokens) * (arrivedCount / coins.length)
              );
              callbacksRef.current.onProgressTokens(nextDisplay, true);

              if (now - lastPingTime > 55) {
                lastPingTime = now;
                playCoinPing(arrivedCount / coins.length);
              }
            }
          }
        }
      }

      if (arrivedCount >= coins.length) {
        callbacksRef.current.onComplete();
        return;
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [burst, coinCount, targetRef]);

  if (!burst || coinCount === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      {Array.from({ length: coinCount }, (_, idx) => (
        <div
          key={`${burst.id}-${idx}`}
          ref={(el) => {
            coinRefs.current[idx] = el;
          }}
          className="absolute top-0 left-0 will-change-transform"
          style={{ width: 44, height: 44, opacity: 0 }}
        >
          <BlooketTokenIcon className="w-11 h-11 drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]" />
        </div>
      ))}
    </div>
  );
};
