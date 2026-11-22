import React, { useId } from 'react';
import { ALL_BLOOKS } from '../data/blooks';

interface BlookArtProps {
  id: string;
  className?: string;
  animated?: boolean;
}

/**
 * Circular Clicket Token Icon:
 * Golden circular coin with 3D bottom-right rim, inset ring, subtle shine, and embossed 'C' inside.
 */
export const BlooketTokenIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 3D Side Extrusion */}
    <circle cx="21.5" cy="21.5" r="15.5" fill="#b45309" />
    {/* Main Circular Coin Face */}
    <circle cx="19" cy="19" r="15.5" fill="#fbbf24" stroke="#d97706" strokeWidth="1.6" />
    {/* Inner Inset Circle */}
    <circle cx="19" cy="19" r="11.4" fill="#f59e0b" stroke="#fde68a" strokeWidth="1.3" />
    {/* Subtle Top Highlight Arc */}
    <path
      d="M11.5 12.5 A 10.5 10.5 0 0 1 25.5 11.2"
      stroke="#fef9c3"
      strokeWidth="1.6"
      strokeLinecap="round"
      opacity="0.7"
    />
    {/* Embossed C */}
    <text
      x="18.8"
      y="24.6"
      textAnchor="middle"
      fill="#fef3c7"
      fontFamily="'Titan One', cursive, sans-serif"
      fontSize="17"
      fontWeight="bold"
      style={{ filter: 'drop-shadow(1px 1.5px 0px #b45309)' }}
    >
      C
    </text>
  </svg>
);

const SvgShineSweep: React.FC<{
  maskId: string;
  gradId: string;
  width: number;
  height: number;
  isMystic?: boolean;
}> = ({ maskId, gradId, width, height, isMystic = false }) => (
  <>
    <defs>
      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="32%" stopColor={isMystic ? '#fef08a' : '#e0f2fe'} stopOpacity="0.28" />
        <stop offset="50%" stopColor="#ffffff" stopOpacity="0.88" />
        <stop offset="68%" stopColor={isMystic ? '#e9d5ff' : '#bae6fd'} stopOpacity="0.28" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <g mask={`url(#${maskId})`} style={{ pointerEvents: 'none' }}>
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`${-width} 0; ${width * 1.6} 0; ${width * 1.6} 0`}
          keyTimes="0; 0.45; 1"
          dur="2.4s"
          repeatCount="indefinite"
        />
        <polygon
          points={`0,${-height * 0.2} ${width * 0.36},${-height * 0.2} ${width * 0.14},${height * 1.2} ${-width * 0.22},${height * 1.2}`}
          fill={`url(#${gradId})`}
        />
      </g>
    </g>
  </>
);

/**
 * Exact Blook artwork from uploaded PNGs and Circus Pack SVGs
 * Chromas & Mysticals animate with smooth floating motion and a moving shine sweep;
 * Cyborg Coach additionally blinks and looks around.
 */
export const BlookArt: React.FC<BlookArtProps> = ({
  id,
  className = 'w-24 h-24',
  animated = true,
}) => {
  const uid = useId().replace(/:/g, '');
  const meta = ALL_BLOOKS.find((b) => b.id === id);
  const isChroma = meta?.rarity === 'Chroma';
  const isMystic = meta?.rarity === 'Mystic';
  const shouldAnimateSpecial = animated && (isChroma || isMystic);

  // Special animated Cyborg Coach (blinks + looks around + Chroma float & shine)
  if (id === 'athlete-cyborg') {
    const cyborgUrl = meta?.imageUrl || 'assets/aistudio/download__18__e086e375.png';
    if (!animated) {
      return (
        <img
          src={cyborgUrl}
          alt={meta?.name || 'Cyborg Coach'}
          className={`${className} object-contain select-none`}
          draggable={false}
        />
      );
    }

    const leftEyeClipId = `cyborg-left-eye-${uid}`;
    const rightLensClipId = `cyborg-right-lens-${uid}`;

    return (
      <div className={`relative ${className} animate-chroma-move select-none`}>
        <svg viewBox="0 0 160 184" className="w-full h-full overflow-visible" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id={leftEyeClipId}>
              <circle cx="30.5" cy="105.5" r="19.2" />
            </clipPath>
            <clipPath id={rightLensClipId}>
              <circle cx="125" cy="105" r="20" />
            </clipPath>
          </defs>

          {/* Base Cyborg Coach artwork */}
          <image href={cyborgUrl} x="0" y="0" width="160" height="184" />

          {/* Left Human Eye: animated sclera, looking pupil, blinking eyelid */}
          <g clipPath={`url(#${leftEyeClipId})`}>
            <circle cx="30.5" cy="105.5" r="20" fill="#ffffff" />
            <g className="animate-cyborg-look">
              <circle cx="30.5" cy="106.5" r="10.8" fill="#18181b" />
              <circle cx="36" cy="100.5" r="4" fill="#ffffff" />
              <circle cx="25.5" cy="111.5" r="2.1" fill="#ffffff" />
            </g>
            {/* Peach Eyelid Blink */}
            <rect
              x="9"
              y="84"
              width="44"
              height="44"
              fill="#fedba9"
              className="animate-cyborg-blink"
            />
          </g>

          {/* Crisp Orange-Gold Eyebrow sitting cleanly above the eye & blink */}
          <path
            d="M 19 82 Q 36 87 53 107"
            fill="none"
            stroke="#fabc2e"
            strokeWidth="7.2"
            strokeLinecap="round"
          />

          {/* Right Cybernetic Red Scanner Lens: animated tracking reticle + metallic blink shutter */}
          <g clipPath={`url(#${rightLensClipId})`}>
            <g className="animate-cyborg-look">
              <circle
                cx="125"
                cy="105"
                r="9.5"
                fill="none"
                stroke="rgba(255,255,255,0.65)"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              <circle cx="125" cy="105" r="3.4" fill="#ffffff" opacity="0.9" />
              <line x1="112" y1="105" x2="119" y2="105" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
              <line x1="131" y1="105" x2="138" y2="105" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
            </g>
            {/* Metallic Cybernetic Shutter Blink */}
            <g className="animate-cyborg-blink">
              <rect x="103" y="83" width="44" height="44" fill="#4b5563" />
              <rect x="105" y="103" width="40" height="3" fill="#38bdf8" opacity="0.85" />
            </g>
          </g>
        </svg>

        {/* Moving Chroma Shine masked strictly to the Cyborg Coach PNG silhouette */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            WebkitMaskImage: `url(${cyborgUrl})`,
            maskImage: `url(${cyborgUrl})`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
        >
          <div
            className="absolute inset-y-[-20%] w-[55%] animate-blook-shine"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(224,242,254,0.28) 32%, rgba(255,255,255,0.88) 50%, rgba(186,230,253,0.28) 68%, transparent 100%)',
            }}
          />
        </div>
      </div>
    );
  }

  if (meta?.imageUrl) {
    return (
      <img
        src={meta.imageUrl}
        alt={meta.name}
        className={`${className} object-contain select-none`}
        draggable={false}
      />
    );
  }

  switch (id) {
    case 'tightrope-walker':
      return (
        <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
          {/* Base Yellow Rounded Square */}
          <rect x="10" y="10" width="100" height="100" rx="18" fill="#ffcc00" />
          {/* Darker Yellow Bottom Shading */}
          <path d="M10 88 H110 V92 C110 101.941 101.941 110 92 110 H28 C18.059 110 10 101.941 10 92 V88 Z" fill="#f2b705" />
          {/* Purple Shoulders/Collar on Left and Right Bottom Corners */}
          <path d="M10 86 H38 C42 86 45 89 45 93 V110 H28 C18.059 110 10 101.941 10 92 V86 Z" fill="#5e439c" />
          <path d="M110 86 H82 C78 86 75 89 75 93 V110 H92 C101.941 110 110 101.941 110 92 V86 Z" fill="#5e439c" />
          {/* Purple Blush Ovals under eyes */}
          <ellipse cx="24" cy="81" rx="7" ry="3.5" fill="#9a68c7" />
          <ellipse cx="96" cy="81" rx="7" ry="3.5" fill="#9a68c7" />
          {/* Eyes */}
          <circle cx="31" cy="67" r="11.5" fill="#ffffff" />
          <circle cx="33" cy="67" r="7.5" fill="#3a3a3c" />
          <circle cx="29" cy="64" r="3" fill="#ffffff" />
          <circle cx="89" cy="67" r="11.5" fill="#ffffff" />
          <circle cx="87" cy="67" r="7.5" fill="#3a3a3c" />
          <circle cx="83" cy="64" r="3" fill="#ffffff" />
          {/* Neutral Nose/Mouth Line */}
          <rect x="52" y="79" width="16" height="3.5" rx="1.75" fill="#d99b00" />
          {/* Brown Center-Parted Hair */}
          <path d="M28 10 H92 C101.941 10 110 18.059 110 28 V48 C90 48 68 38 60 24 C52 38 30 48 10 48 V28 C10 18.059 18.059 10 28 10 Z" fill="#7d5636" />
          {/* Brown Eyebrows */}
          <ellipse cx="30" cy="44" rx="9" ry="4" fill="#634126" />
          <ellipse cx="90" cy="44" rx="9" ry="4" fill="#634126" />
        </svg>
      );

    case 'jester':
      return (
        <svg viewBox="0 0 120 130" className={className} xmlns="http://www.w3.org/2000/svg">
          {/* Base Yellow Rounded Square */}
          <rect x="10" y="20" width="100" height="100" rx="18" fill="#ffcc00" />
          {/* Red Jester Collar at Bottom */}
          <path d="M10 95 L28 104 L45 96 L60 105 L75 96 L92 104 L110 95 V102 C110 111.941 101.941 120 92 120 H28 C18.059 120 10 111.941 10 102 V95 Z" fill="#c9182b" />
          {/* Straight Brown Hair Top */}
          <path d="M28 20 H92 C101.941 20 110 28.059 110 38 V49 H10 V38 C10 28.059 18.059 20 28 20 Z" fill="#734f32" />
          {/* Brown Eyebrows */}
          <ellipse cx="32" cy="48" rx="9.5" ry="5" fill="#593a22" />
          <ellipse cx="88" cy="48" rx="9.5" ry="5" fill="#593a22" />
          {/* Eyes */}
          <circle cx="31" cy="73" r="11.5" fill="#ffffff" />
          <circle cx="33" cy="73" r="7.5" fill="#3a3a3c" />
          <circle cx="29" cy="70" r="3" fill="#ffffff" />
          <circle cx="89" cy="73" r="11.5" fill="#ffffff" />
          <circle cx="87" cy="73" r="7.5" fill="#3a3a3c" />
          <circle cx="83" cy="70" r="3" fill="#ffffff" />
          {/* Happy Open Mouth with White Teeth Bar & Tongue */}
          <path d="M49 82 H71 V92 C71 98 66 103 60 103 C54 103 49 98 49 92 V82 Z" fill="#8f111d" />
          <rect x="49" y="82" width="22" height="5.5" fill="#ffffff" />
          <path d="M53 95 Q60 91 67 95 C66 100 63 103 60 103 C57 103 54 100 53 95 Z" fill="#e02438" />
          {/* Jester Hat on Top Right */}
          <g transform="translate(36, 2)">
            <path d="M25 26 C18 10 6 12 4 22 C10 19 16 22 18 28 Z" fill="#299c52" />
            <path d="M24 26 C22 10 30 2 38 6 C33 12 32 19 34 26 Z" fill="#1f874c" />
            <path d="M33 26 C40 12 52 14 55 24 C48 20 42 23 39 28 Z" fill="#1e5bb8" />
            <path d="M16 28 L20 22 L25 27 L30 21 L35 27 L40 22 L43 28 Q30 31 16 28 Z" fill="#ffd900" />
            <circle cx="4" cy="22" r="4" fill="#ffcc00" />
            <circle cx="38" cy="6" r="4" fill="#d91b2e" />
            <circle cx="55" cy="24" r="4" fill="#d91b2e" />
          </g>
        </svg>
      );

    case 'magician':
      return (
        <svg viewBox="0 0 125 125" className={className} xmlns="http://www.w3.org/2000/svg">
          {/* Base Peach Skin Rounded Square */}
          <rect x="10" y="15" width="100" height="100" rx="18" fill="#fcc96b" />
          {/* Magician Suit & Red Cape Bottom */}
          <path d="M10 92 H110 V97 C110 106.941 101.941 115 92 115 H28 C18.059 115 10 106.941 10 97 V92 Z" fill="#ff1a1a" />
          {/* Black Suit Lapels & White Shirt V */}
          <polygon points="36,92 60,115 84,92" fill="#141414" />
          <polygon points="46,92 60,112 74,92" fill="#ffffff" />
          {/* Big Black Bowtie on Left-Center */}
          <g transform="translate(33, 98) rotate(-8)">
            <path d="M0 -8 L16 0 L0 8 Z" fill="#111111" />
            <path d="M32 -8 L16 0 L32 8 Z" fill="#111111" />
            <circle cx="16" cy="0" r="4.5" fill="#222222" />
          </g>
          {/* Ginger/Brown Swept Hair */}
          <path d="M28 15 H92 C101.941 15 110 23.059 110 33 V44 C95 44 85 32 75 26 C65 38 40 46 10 42 V33 C10 23.059 18.059 15 28 15 Z" fill="#b36b2c" />
          <path d="M22 32 C38 44 62 36 72 22 C54 24 35 22 22 32 Z" fill="#9c591f" />
          {/* Eyebrows */}
          <path d="M20 50 Q30 43 40 49" stroke="#8c4f1a" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M80 49 Q90 43 100 50" stroke="#8c4f1a" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* Eyes */}
          <circle cx="31" cy="68" r="11" fill="#ffffff" />
          <circle cx="34" cy="68" r="7.5" fill="#3a3a3c" />
          <circle cx="30" cy="65" r="3" fill="#ffffff" />
          <circle cx="89" cy="68" r="11" fill="#ffffff" />
          <circle cx="91" cy="68" r="7.5" fill="#3a3a3c" />
          <circle cx="87" cy="65" r="3" fill="#ffffff" />
          {/* Freckles */}
          <circle cx="23" cy="83" r="2.2" fill="#c78238" />
          <circle cx="30" cy="82" r="2.2" fill="#c78238" />
          <circle cx="26" cy="87" r="2.2" fill="#c78238" />
          <circle cx="90" cy="82" r="2.2" fill="#c78238" />
          <circle cx="97" cy="83" r="2.2" fill="#c78238" />
          <circle cx="94" cy="87" r="2.2" fill="#c78238" />
          {/* Curved Nose */}
          <path d="M58 67 C51 70 52 79 60 78" stroke="#c78238" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          {/* Smirk Open Mouth */}
          <path d="M52 84 L74 80 C75 90 67 95 58 94 C53 93 51 89 52 84 Z" fill="#6e1414" />
          <path d="M53 84 L73 81 L72 85 L53 87 Z" fill="#ffffff" />
          <path d="M56 91 Q64 88 70 91 C67 94 61 95 56 91 Z" fill="#e84a5f" />
          {/* Tilted Mini Top Hat on Top Right */}
          <g transform="translate(92, 18) rotate(24)">
            <ellipse cx="0" cy="12" rx="22" ry="7" fill="#1a1a1a" />
            <path d="M-14 10 L-16 -14 C-16 -18 16 -18 16 -14 L14 10 Z" fill="#262626" />
            <ellipse cx="0" cy="-14" rx="16" ry="4.5" fill="#383838" />
            <path d="M-14.5 4 H14.5 L14 10 H-14 Z" fill="#ff1a1a" />
          </g>
        </svg>
      );

    case 'top-hat':
      return (
        <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(60, 66) rotate(-5)">
            <ellipse cx="0" cy="24" rx="48" ry="18" fill="#1c1c1c" />
            <ellipse cx="0" cy="22" rx="45" ry="15" fill="#292929" />
            <path d="M-30 20 L-35 -36 C-35 -44 35 -44 35 -36 L30 20 C30 28 -30 28 -30 20 Z" fill="#242424" />
            <path d="M-24 18 L-28 -34 C-20 -36 -10 -36 -5 -35 L-5 22 C-14 22 -20 20 -24 18 Z" fill="#303030" />
            <path d="M-31 7 C-15 13 15 13 31 7 L30 20 C15 27 -15 27 -30 20 Z" fill="#e61919" />
            <ellipse cx="0" cy="-36" rx="35" ry="9" fill="#383838" />
          </g>
        </svg>
      );

    case 'popcorn':
      return (
        <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
          <g>
            <circle cx="35" cy="42" r="12" fill="#fcd34d" />
            <circle cx="52" cy="34" r="14" fill="#fbbf24" />
            <circle cx="70" cy="36" r="13" fill="#fcd34d" />
            <circle cx="85" cy="44" r="11" fill="#f59e0b" />
            <circle cx="24" cy="54" r="11" fill="#fde68a" />
            <circle cx="42" cy="50" r="13" fill="#fef08a" />
            <circle cx="60" cy="46" r="14" fill="#fde047" />
            <circle cx="78" cy="50" r="13" fill="#fef08a" />
            <circle cx="94" cy="55" r="10" fill="#fcd34d" />
            <circle cx="32" cy="60" r="11" fill="#f59e0b" />
            <circle cx="50" cy="58" r="12" fill="#fbbf24" />
            <circle cx="68" cy="58" r="12" fill="#f59e0b" />
            <circle cx="86" cy="60" r="11" fill="#fde047" />
          </g>
          <polygon points="18,58 102,58 92,112 28,112" fill="#dc2626" />
          <polygon points="33,58 44,58 40,112 31,112" fill="#ffffff" />
          <polygon points="54.5,58 65.5,58 64,112 56,112" fill="#ffffff" />
          <polygon points="76,58 87,58 89,112 80,112" fill="#ffffff" />
        </svg>
      );

    case 'cotton-candy':
      return (
        <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
          <polygon points="56,74 64,74 60,115" fill="#e0f2fe" />
          <path d="M57 80 L63 83 L62.5 87 L57.5 84 Z" fill="#38bdf8" />
          <path d="M58 91 L62 94 L61.5 98 L58.5 95 Z" fill="#38bdf8" />
          <path d="M59 102 L61 104 L60.5 108 L59.5 106 Z" fill="#38bdf8" />
          <circle cx="60" cy="24" r="16" fill="#f9a8d4" />
          <circle cx="44" cy="36" r="18" fill="#f9a8d4" />
          <circle cx="76" cy="38" r="17" fill="#f9a8d4" />
          <circle cx="38" cy="54" r="16" fill="#f9a8d4" />
          <circle cx="80" cy="54" r="16" fill="#f9a8d4" />
          <circle cx="48" cy="68" r="15" fill="#f9a8d4" />
          <circle cx="70" cy="67" r="15" fill="#f9a8d4" />
          <circle cx="60" cy="48" r="22" fill="#f9a8d4" />
          <path d="M40 30 Q52 22 64 28" stroke="#fbcfe8" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M32 52 Q42 64 56 60" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
          <path d="M72 32 Q84 42 76 56" stroke="#fbcfe8" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M52 72 Q62 78 72 70" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
        </svg>
      );

    case 'unicycler':
      return (
        <svg viewBox="0 0 120 145" className={className} xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(60, 100)">
            <rect x="-5" y="-12" width="10" height="8" rx="2" fill="#eb5e28" />
            <rect x="-3" y="-4" width="6" height="12" fill="#a3a3a3" />
            <circle cx="0" cy="24" r="18" fill="none" stroke="#6c584c" strokeWidth="6" />
            <circle cx="0" cy="24" r="14" fill="none" stroke="#dde5b6" strokeWidth="2" />
            <line x1="0" y1="9" x2="0" y2="39" stroke="#38bdf8" strokeWidth="2" />
            <line x1="-15" y1="24" x2="15" y2="24" stroke="#38bdf8" strokeWidth="2" />
            <line x1="-10" y1="14" x2="10" y2="34" stroke="#38bdf8" strokeWidth="2" />
            <line x1="10" y1="14" x2="-10" y2="34" stroke="#38bdf8" strokeWidth="2" />
            <path d="M-4 6 L0 24 L4 6 Z" fill="#f59e0b" />
            <circle cx="0" cy="24" r="4.5" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
          </g>
          <rect x="14" y="6" width="92" height="86" rx="16" fill="#ffcc00" />
          <path d="M14 70 H106 V78 C106 85.732 99.732 92 92 92 H28 C20.268 92 14 85.732 14 78 V70 Z" fill="#0f0f0f" />
          <polygon points="40,70 80,70 68,86 52,86" fill="#ffffff" />
          <circle cx="60" cy="76" r="1.5" fill="#111111" />
          <circle cx="60" cy="81" r="1.5" fill="#111111" />
          <path d="M28 6 H92 C99.732 6 106 12.268 106 20 V34 C92 34 82 22 72 16 C62 28 38 35 14 32 V20 C14 12.268 20.268 6 28 6 Z" fill="#a46729" />
          <path d="M24 37 Q33 31 42 36" stroke="#854d16" strokeWidth="5.5" strokeLinecap="round" fill="none" />
          <path d="M78 36 Q87 31 96 37" stroke="#854d16" strokeWidth="5.5" strokeLinecap="round" fill="none" />
          <circle cx="34" cy="52" r="10" fill="#ffffff" />
          <circle cx="36" cy="52" r="6.8" fill="#3a3a3c" />
          <circle cx="33" cy="49" r="2.6" fill="#ffffff" />
          <circle cx="86" cy="52" r="10" fill="#ffffff" />
          <circle cx="88" cy="52" r="6.8" fill="#3a3a3c" />
          <circle cx="85" cy="49" r="2.6" fill="#ffffff" />
          <circle cx="26" cy="65" r="2" fill="#bd7b20" />
          <circle cx="32" cy="64" r="2" fill="#bd7b20" />
          <circle cx="29" cy="68" r="2" fill="#bd7b20" />
          <circle cx="88" cy="64" r="2" fill="#bd7b20" />
          <circle cx="94" cy="65" r="2" fill="#bd7b20" />
          <circle cx="91" cy="68" r="2" fill="#bd7b20" />
          <path d="M58 51 C52 54 53 62 60 61" stroke="#bd7b20" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M52 65 L72 62 C73 70 66 75 58 74 C53 73 51 69 52 65 Z" fill="#6e1414" />
          <path d="M53 65 L71 62.5 L70 66 L53 68 Z" fill="#ffffff" />
          <path d="M56 71 Q63 68 68 71 C65 74 60 75 56 71 Z" fill="#e84a5f" />
        </svg>
      );

    case 'canon-ball':
      return (
        <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="10" width="100" height="100" rx="18" fill="#0d0d0d" />
          <path d="M10 84 H110 V92 C110 101.941 101.941 110 92 110 H28 C18.059 110 10 101.941 10 92 V84 Z" fill="#050505" />
          <ellipse cx="26" cy="28" rx="9" ry="5.5" transform="rotate(-30 26 28)" fill="#d4d4d8" />
          <circle cx="41" cy="21" r="4" fill="#d4d4d8" />
        </svg>
      );

    case 'magic-wand':
      return (
        <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(-38 55 68)">
            <rect x="4" y="64" width="76" height="7" rx="2" fill="#0a0a0a" />
            <rect x="64" y="64" width="22" height="7" rx="1" fill="#ffffff" />
          </g>
          <path
            d="M95 14 Q95 30 111 30 Q95 30 95 46 Q95 30 79 30 Q95 30 95 14 Z"
            fill="#facc15"
          />
          <path d="M81 14 Q81 18 85 18 Q81 18 81 22 Q81 18 77 18 Q81 18 81 14 Z" fill="#fde047" />
          <path d="M108 12 Q108 16 112 16 Q108 16 108 20 Q108 16 104 16 Q108 16 108 12 Z" fill="#fde047" />
          <path d="M107 40 Q107 44 111 44 Q107 44 107 48 Q107 44 103 44 Q107 44 107 40 Z" fill="#fde047" />
        </svg>
      );

    case 'tent':
      return (
        <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
          <line x1="60" y1="8" x2="60" y2="22" stroke="#d97706" strokeWidth="2.5" />
          <polygon points="60,8 78,13 60,18" fill="#dc2626" />
          <path d="M22 68 H98 L95 108 C95 111 25 111 25 108 Z" fill="#dc2626" />
          <polygon points="28,68 37,68 38,109 29,109" fill="#ffffff" />
          <polygon points="45,68 54,68 54,109 46,109" fill="#ffffff" />
          <polygon points="66,68 75,68 74,109 66,109" fill="#ffffff" />
          <polygon points="83,68 92,68 91,109 82,109" fill="#ffffff" />
          <path d="M46 109 L48 84 C48 74 72 74 72 84 L74 109 Z" fill="#7f1d1d" />
          <path d="M60 20 C52 40 35 55 16 64 H104 C85 55 68 40 60 20 Z" fill="#dc2626" />
          <path d="M60 20 C55 40 43 55 29 64 H42 C51 54 57 40 60 20 Z" fill="#ffffff" />
          <path d="M60 20 C60 40 60 55 55 64 H65 C62 54 61 40 60 20 Z" fill="#ffffff" />
          <path d="M60 20 C65 40 77 55 91 64 H78 C69 54 63 40 60 20 Z" fill="#ffffff" />
          <path d="M16 64 C20 72 28 72 32 64 C36 72 44 72 48 64 C52 72 60 72 64 64 C68 72 76 72 80 64 C84 72 92 72 96 64 C100 70 103 68 104 64 Z" fill="#facc15" />
        </svg>
      );

    case 'circus-ball': {
      const clipId = `circusBallClip-${uid}`;
      return (
        <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id={clipId}>
              <rect x="10" y="10" width="100" height="100" rx="18" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect x="10" y="10" width="100" height="100" fill="#f5e6d3" />
            <path d="M10 34 Q35 28 60 42 L26 110 H10 Z" fill="#f2b949" />
            <path d="M60 42 L24 110 H94 Z" fill="#2b59c3" />
            <path d="M66 10 H110 V48 Q86 46 60 42 Z" fill="#c93b2b" />
            <circle cx="62" cy="40" r="19" fill="#fdf8f2" />
            <circle cx="24" cy="28" r="8" fill="#ffffff" opacity="0.55" />
          </g>
        </svg>
      );
    }

    case 'circus-elephant': {
      const clipId = `elephantBallClip-${uid}`;
      const shineMaskId = `elephantShineMask-${uid}`;
      const shineGradId = `elephantShineGrad-${uid}`;
      return (
        <svg
          viewBox="0 0 120 140"
          className={`${className} ${shouldAnimateSpecial ? 'animate-chroma-move' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="24" y="50" width="72" height="60" rx="22" />
            </clipPath>
            <mask id={shineMaskId}>
              <rect x="24" y="76" width="72" height="60" rx="22" fill="#ffffff" />
              <rect x="24" y="6" width="72" height="70" rx="14" fill="#ffffff" />
              <rect x="24" y="72" width="14" height="14" rx="3" fill="#ffffff" />
              <rect x="82" y="72" width="14" height="14" rx="3" fill="#ffffff" />
            </mask>
          </defs>
          <g transform="translate(0, 26)">
            <g clipPath={`url(#${clipId})`}>
              <rect x="24" y="50" width="72" height="60" fill="#f5e6d3" />
              <path d="M24 58 L60 68 L36 110 H24 Z" fill="#f2b949" />
              <path d="M60 68 L36 110 H84 Z" fill="#2b59c3" />
              <path d="M60 50 H96 V72 L60 68 Z" fill="#c93b2b" />
              <circle cx="60" cy="68" r="12" fill="#fdf8f2" />
            </g>
          </g>
          <rect x="24" y="6" width="72" height="70" rx="14" fill="#b4c0e8" />
          <path d="M24 16 H36 V56 C28 56 24 50 24 42 Z" fill="#9ba9d9" />
          <path d="M96 16 H84 V56 C92 56 96 50 96 42 Z" fill="#9ba9d9" />
          <rect x="24" y="72" width="14" height="14" rx="3" fill="#9ba9d9" />
          <rect x="82" y="72" width="14" height="14" rx="3" fill="#9ba9d9" />
          <circle cx="27" cy="85" r="2" fill="#ffffff" />
          <circle cx="31" cy="85" r="2" fill="#ffffff" />
          <circle cx="35" cy="85" r="2" fill="#ffffff" />
          <circle cx="85" cy="85" r="2" fill="#ffffff" />
          <circle cx="89" cy="85" r="2" fill="#ffffff" />
          <circle cx="93" cy="85" r="2" fill="#ffffff" />
          <circle cx="39" cy="40" r="9.5" fill="#ffffff" />
          <circle cx="41" cy="40" r="6.5" fill="#27272a" />
          <circle cx="38" cy="38" r="2.5" fill="#ffffff" />
          <circle cx="81" cy="40" r="9.5" fill="#ffffff" />
          <circle cx="79" cy="40" r="6.5" fill="#27272a" />
          <circle cx="76" cy="38" r="2.5" fill="#ffffff" />
          <path d="M36 58 Q40 70 48 66 Q45 58 42 56 Z" fill="#ffffff" />
          <path d="M53 38 V62 C53 74 74 74 74 62 V52" stroke="#9ba9d9" strokeWidth="13" strokeLinecap="round" fill="none" />
          <path d="M53 38 V62 C53 74 74 74 74 62 V52" stroke="#b4c0e8" strokeWidth="10" strokeLinecap="round" fill="none" />
          <line x1="50" y1="45" x2="56" y2="45" stroke="#8594c7" strokeWidth="2" strokeLinecap="round" />
          <line x1="50" y1="51" x2="56" y2="51" stroke="#8594c7" strokeWidth="2" strokeLinecap="round" />
          {shouldAnimateSpecial && (
            <SvgShineSweep maskId={shineMaskId} gradId={shineGradId} width={120} height={140} />
          )}
        </svg>
      );
    }

    case 'ring-lion': {
      const shineMaskId = `lionShineMask-${uid}`;
      const shineGradId = `lionShineGrad-${uid}`;
      return (
        <svg
          viewBox="0 0 130 130"
          className={`${className} ${shouldAnimateSpecial ? 'animate-chroma-move' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id={shineMaskId}>
              <circle cx="65" cy="65" r="60" fill="none" stroke="#ffffff" strokeWidth="7" />
              <rect x="23" y="23" width="84" height="84" rx="16" fill="#ffffff" />
              <circle cx="30" cy="24" r="7" fill="#ffffff" />
              <circle cx="100" cy="24" r="7" fill="#ffffff" />
            </mask>
          </defs>
          <g className={shouldAnimateSpecial ? 'animate-ring-spin' : ''}>
            <circle cx="65" cy="65" r="57" fill="none" stroke="#14b8a6" strokeWidth="5.5" />
            <path d="M65 8 A57 57 0 0 1 122 65" fill="none" stroke="#eab308" strokeWidth="5.5" />
            <path d="M65 122 A57 57 0 0 1 8 65" fill="none" stroke="#eab308" strokeWidth="5.5" />
          </g>
          <rect x="23" y="23" width="84" height="84" rx="16" fill="#ea7317" />
          <circle cx="30" cy="24" r="7" fill="#3a2e2b" />
          <circle cx="100" cy="24" r="7" fill="#3a2e2b" />
          <rect x="30" y="34" width="70" height="62" rx="14" fill="#fcb941" />
          <ellipse cx="47" cy="44" rx="8" ry="4.5" fill="#9c4a1a" />
          <ellipse cx="83" cy="44" rx="8" ry="4.5" fill="#9c4a1a" />
          <circle cx="42" cy="62" r="10.5" fill="#ffffff" />
          <circle cx="44" cy="62" r="7" fill="#7c2d12" />
          <circle cx="41" cy="59" r="2.8" fill="#ffffff" />
          <circle cx="88" cy="62" r="10.5" fill="#ffffff" />
          <circle cx="86" cy="62" r="7" fill="#7c2d12" />
          <circle cx="83" cy="59" r="2.8" fill="#ffffff" />
          <ellipse cx="56" cy="79" rx="11" ry="8" fill="#fef3c7" />
          <ellipse cx="74" cy="79" rx="11" ry="8" fill="#fef3c7" />
          <polygon points="57,69 73,69 65,77" fill="#27272a" />
          <circle cx="51" cy="78" r="1.3" fill="#d97706" />
          <circle cx="55" cy="81" r="1.3" fill="#d97706" />
          <circle cx="50" cy="82" r="1.3" fill="#d97706" />
          <circle cx="79" cy="78" r="1.3" fill="#d97706" />
          <circle cx="75" cy="81" r="1.3" fill="#d97706" />
          <circle cx="80" cy="82" r="1.3" fill="#d97706" />
          {shouldAnimateSpecial && (
            <SvgShineSweep maskId={shineMaskId} gradId={shineGradId} width={130} height={130} />
          )}
        </svg>
      );
    }

    case 'fire-guy': {
      const shineMaskId = `fireShineMask-${uid}`;
      const shineGradId = `fireShineGrad-${uid}`;
      return (
        <svg
          viewBox="0 0 130 120"
          className={`${className} ${shouldAnimateSpecial ? 'animate-chroma-move' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id={shineMaskId}>
              <rect x="20" y="14" width="90" height="92" rx="16" fill="#ffffff" />
              <path d="M22 103 C10 103 8 88 16 78 C18 84 21 84 23 73 C31 83 36 93 28 101 Z" fill="#ffffff" />
              <path d="M108 103 C120 103 122 88 114 78 C112 84 109 84 107 73 C99 83 94 93 102 101 Z" fill="#ffffff" />
            </mask>
          </defs>
          <rect x="20" y="14" width="90" height="92" rx="16" fill="#ffcc00" />
          <path d="M20 92 H110 V94 C110 100.627 104.627 106 98 106 H32 C25.373 106 20 100.627 20 94 V92 Z" fill="#dc2626" />
          <path d="M36 14 H94 C102.837 14 110 21.163 110 30 V40 H20 V30 C20 21.163 27.163 14 36 14 Z" fill="#784f30" />
          <ellipse cx="40" cy="40" rx="8.5" ry="4.5" fill="#5c3a21" />
          <ellipse cx="90" cy="40" rx="8.5" ry="4.5" fill="#5c3a21" />
          <circle cx="39" cy="62" r="10.5" fill="#ffffff" />
          <circle cx="41" cy="62" r="7" fill="#3a3a3c" />
          <circle cx="38" cy="59" r="2.8" fill="#ffffff" />
          <circle cx="91" cy="62" r="10.5" fill="#ffffff" />
          <circle cx="89" cy="62" r="7" fill="#3a3a3c" />
          <circle cx="86" cy="59" r="2.8" fill="#ffffff" />
          <path d="M55 70 H75 V79 C75 84 70.5 89 65 89 C59.5 89 55 84 55 79 V70 Z" fill="#881337" />
          <rect x="55" y="70" width="20" height="5" fill="#ffffff" />
          <path d="M58 81 Q65 78 72 81 C71 86 68 89 65 89 C62 89 59 86 58 81 Z" fill="#e11d48" />
          <rect x="24" y="88" width="82" height="11" rx="3" fill="#fde68a" stroke="#d97706" strokeWidth="1" />
          <g className={shouldAnimateSpecial ? 'animate-flame-flicker' : ''}>
            <path d="M22 103 C10 103 8 88 16 78 C18 84 21 84 23 73 C31 83 36 93 28 101 Z" fill="#f97316" />
            <path d="M22 101 C16 101 15 92 21 84 C25 90 27 96 22 101 Z" fill="#facc15" />
          </g>
          <g className={shouldAnimateSpecial ? 'animate-flame-flicker' : ''}>
            <path d="M108 103 C120 103 122 88 114 78 C112 84 109 84 107 73 C99 83 94 93 102 101 Z" fill="#f97316" />
            <path d="M108 101 C114 101 115 92 109 84 C105 90 103 96 108 101 Z" fill="#facc15" />
          </g>
          {shouldAnimateSpecial && (
            <SvgShineSweep maskId={shineMaskId} gradId={shineGradId} width={130} height={120} />
          )}
        </svg>
      );
    }

    case 'the-golden-ticket': {
      const gradId = `goldTicketGrad-${uid}`;
      const shineMaskId = `ticketShineMask-${uid}`;
      const shineGradId = `ticketShineGrad-${uid}`;
      const ticketPath =
        'M14 16 H136 C136 22 142 24 142 28 C142 32 136 34 136 38 C136 42 142 44 142 48 C142 52 136 54 136 58 C136 62 142 64 142 68 C142 72 136 74 136 78 C136 82 142 84 142 88 C142 92 136 94 136 96 H14 C14 94 8 92 8 88 C8 84 14 82 14 78 C14 74 8 72 8 68 C8 64 14 62 14 58 C14 54 8 52 8 48 C8 44 14 42 14 38 C14 34 8 32 8 28 C8 24 14 22 14 16 Z';
      return (
        <svg
          viewBox="0 0 150 110"
          className={`${className} ${shouldAnimateSpecial ? 'animate-mystic-move' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="35%" stopColor="#eab308" />
              <stop offset="55%" stopColor="#fef9c3" />
              <stop offset="80%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#854d0e" />
            </linearGradient>
            <mask id={shineMaskId}>
              <path d={ticketPath} fill="#ffffff" />
            </mask>
          </defs>
          <path
            d={ticketPath}
            fill={`url(#${gradId})`}
            stroke="#a16207"
            strokeWidth="2"
          />
          <rect x="22" y="22" width="106" height="68" rx="4" fill="none" stroke="#713f12" strokeWidth="1.8" />
          <line x1="22" y1="40" x2="128" y2="40" stroke="#713f12" strokeWidth="1.8" />
          <line x1="22" y1="72" x2="128" y2="72" stroke="#713f12" strokeWidth="1.8" />
          <text x="75" y="36" textAnchor="middle" fill="#dc2626" fontFamily="'Nunito', sans-serif" fontWeight="900" fontSize="15">
            35726
          </text>
          <text x="75" y="63" textAnchor="middle" fill="#09090b" fontFamily="'Nunito', sans-serif" fontWeight="900" fontSize="22">
            Admit One
          </text>
          <text x="75" y="86" textAnchor="middle" fill="#dc2626" fontFamily="'Nunito', sans-serif" fontWeight="900" fontSize="15">
            35726
          </text>
          {shouldAnimateSpecial && (
            <>
              <SvgShineSweep
                maskId={shineMaskId}
                gradId={shineGradId}
                width={150}
                height={110}
                isMystic
              />
              <path d="M26 20 L28 25 L33 27 L28 29 L26 34 L24 29 L19 27 L24 25 Z" fill="#ffffff">
                <animate attributeName="opacity" values="0.2;1;0.2" dur="1.8s" repeatCount="indefinite" />
              </path>
              <path d="M126 76 L128 80 L132 82 L128 84 L126 88 L124 84 L120 82 L124 80 Z" fill="#fef9c3">
                <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
              </path>
            </>
          )}
        </svg>
      );
    }

    default:
      return (
        <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
          <rect x="12" y="14" width="96" height="94" rx="18" fill="#ffcc00" />
          <circle cx="34" cy="68" r="11" fill="#ffffff" />
          <circle cx="36" cy="68" r="7" fill="#18181b" />
          <circle cx="86" cy="68" r="11" fill="#ffffff" />
          <circle cx="84" cy="68" r="7" fill="#18181b" />
        </svg>
      );
  }
};
