import React from 'react';

export type MultiplayerGameMode = 'vault_heist' | 'curse_roulette' | 'bounty_board';

interface GameModeLogoProps {
  mode: MultiplayerGameMode;
  className?: string;
}

export const GameModeLogo: React.FC<GameModeLogoProps> = ({ mode, className = 'w-24 h-24' }) => {
  if (mode === 'vault_heist') {
    return (
      <svg
        viewBox="0 0 120 120"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Vault Heist Logo"
      >
        <defs>
          <linearGradient id="vh-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>
          <linearGradient id="vh-steel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="vh-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
        </defs>

        {/* Emblem Shield */}
        <rect x="6" y="6" width="108" height="108" rx="26" fill="url(#vh-bg)" stroke="#0f172a" strokeWidth="5" />
        <rect x="12" y="12" width="96" height="96" rx="21" fill="none" stroke="#38bdf8" strokeWidth="2.5" opacity="0.45" />

        {/* Vault Outer Frame */}
        <rect x="22" y="24" width="68" height="68" rx="14" fill="url(#vh-steel)" stroke="#0f172a" strokeWidth="4" />
        {/* Vault Dark Interior Peek */}
        <rect x="30" y="32" width="52" height="52" rx="9" fill="#0f172a" />

        {/* Cash & Gold Inside Vault */}
        <rect x="36" y="54" width="28" height="16" rx="3" fill="#22c55e" stroke="#14532d" strokeWidth="2.5" />
        <circle cx="50" cy="62" r="4" fill="#86efac" />
        <circle cx="42" cy="70" r="9" fill="url(#vh-gold)" stroke="#854d0e" strokeWidth="2.5" />
        <text x="42" y="74" textAnchor="middle" fontSize="11" fontWeight="900" fill="#854d0e">$</text>
        <circle cx="62" cy="72" r="8" fill="url(#vh-gold)" stroke="#854d0e" strokeWidth="2.5" />

        {/* Heavy Vault Door Swung Open */}
        <g transform="translate(8, 0)">
          <rect x="48" y="29" width="38" height="58" rx="8" fill="#64748b" stroke="#0f172a" strokeWidth="3.5" />
          <circle cx="67" cy="58" r="13" fill="#e2e8f0" stroke="#0f172a" strokeWidth="3" />
          <line x1="67" y1="45" x2="67" y2="71" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
          <line x1="54" y1="58" x2="80" y2="58" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="67" cy="58" r="4.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
        </g>

        {/* Cyan Power Drill Spark */}
        <g transform="translate(68, 72) rotate(-20)">
          <rect x="0" y="6" width="24" height="14" rx="5" fill="#06b6d4" stroke="#0f172a" strokeWidth="3" />
          <polygon points="0,10 -12,13 0,16" fill="#e2e8f0" stroke="#0f172a" strokeWidth="2" />
          <rect x="14" y="18" width="9" height="14" rx="3" fill="#0e7490" stroke="#0f172a" strokeWidth="2.5" />
        </g>
        <circle cx="30" cy="30" r="3" fill="#fde047" />
        <circle cx="94" cy="24" r="2.5" fill="#38bdf8" />
      </svg>
    );
  }

  if (mode === 'curse_roulette') {
    return (
      <svg
        viewBox="0 0 120 120"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Curse Roulette Logo"
      >
        <defs>
          <linearGradient id="cr-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b0764" />
            <stop offset="100%" stopColor="#6b21a8" />
          </linearGradient>
          <linearGradient id="cr-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Emblem Backdrop */}
        <rect x="6" y="6" width="108" height="108" rx="26" fill="url(#cr-bg)" stroke="#1e1b4b" strokeWidth="5" />
        <circle cx="60" cy="60" r="44" fill="#581c87" opacity="0.7" />

        {/* Slot Machine Frame */}
        <rect x="18" y="30" width="76" height="56" rx="14" fill="url(#cr-gold)" stroke="#1e1b4b" strokeWidth="4" />
        <rect x="25" y="38" width="62" height="40" rx="8" fill="#0f172a" />

        {/* Three Slot Reels */}
        <rect x="29" y="42" width="16" height="32" rx="4" fill="#f8fafc" />
        <rect x="48" y="42" width="16" height="32" rx="4" fill="#f8fafc" />
        <rect x="67" y="42" width="16" height="32" rx="4" fill="#f8fafc" />

        {/* Reel 1: Lightning Scramble */}
        <polygon points="39,47 32,59 37,59 34,69 43,56 38,56" fill="#f59e0b" stroke="#78350f" strokeWidth="1.2" />

        {/* Reel 2: Toxic Potion */}
        <circle cx="56" cy="62" r="6" fill="#22c55e" stroke="#14532d" strokeWidth="1.5" />
        <rect x="54" y="51" width="4" height="6" fill="#86efac" stroke="#14532d" strokeWidth="1.2" />

        {/* Reel 3: Fog Skull/Cloud */}
        <circle cx="75" cy="59" r="5" fill="#94a3b8" />
        <circle cx="71" cy="61" r="3.5" fill="#cbd5e1" />
        <circle cx="79" cy="61" r="3.5" fill="#cbd5e1" />

        {/* Lever Arm */}
        <line x1="94" y1="54" x2="104" y2="38" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
        <circle cx="104" cy="36" r="7" fill="#ef4444" stroke="#1e1b4b" strokeWidth="3" />

        {/* Magic Curse Swirls */}
        <path d="M 22 24 Q 38 14 54 22" fill="none" stroke="#4ade80" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="28" cy="96" r="5" fill="#4ade80" opacity="0.85" />
        <circle cx="88" cy="95" r="4" fill="#fde047" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Bounty Board Logo"
    >
      <defs>
        <linearGradient id="bb-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c2d12" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
        <linearGradient id="bb-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
      </defs>

      {/* Emblem Backdrop */}
      <rect x="6" y="6" width="108" height="108" rx="26" fill="url(#bb-bg)" stroke="#450a0a" strokeWidth="5" />

      {/* Wanted Poster */}
      <rect x="26" y="18" width="68" height="84" rx="8" fill="url(#bb-paper)" stroke="#451a03" strokeWidth="4" />
      {/* Poster Top Pin */}
      <circle cx="60" cy="24" r="4.5" fill="#ef4444" stroke="#450a03" strokeWidth="2" />

      {/* WANTED Header Bar */}
      <rect x="33" y="32" width="54" height="13" rx="3" fill="#78350f" />
      <text x="60" y="42" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#fef08a" letterSpacing="1">
        WANTED
      </text>

      {/* Character Silhouette & Target Scope */}
      <rect x="36" y="49" width="48" height="32" rx="6" fill="#fffbeb" stroke="#b45309" strokeWidth="2" />
      <circle cx="60" cy="65" r="11" fill="#f59e0b" stroke="#451a03" strokeWidth="2.5" />
      {/* Crosshair Reticle */}
      <circle cx="60" cy="65" r="15" fill="none" stroke="#dc2626" strokeWidth="2.5" />
      <line x1="60" y1="46" x2="60" y2="54" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="60" y1="76" x2="60" y2="84" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="41" y1="65" x2="49" y2="65" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="71" y1="65" x2="79" y2="65" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />

      {/* Bounty Cash Bar */}
      <rect x="36" y="85" width="48" height="11" rx="3" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
      <text x="60" y="93.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#ffffff">
        $$ BOUNTY $$
      </text>

      {/* Sheriff Gold Star Badge */}
      <polygon
        points="92,70 95,78 104,78 97,83 100,91 92,86 84,91 87,83 80,78 89,78"
        fill="#fbbf24"
        stroke="#451a03"
        strokeWidth="2.5"
      />
    </svg>
  );
};
