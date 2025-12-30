// components/ui/Logo.js
// Ontographia Logo - Gradient Pinwheel with Three-Ring Hub
// Clean design with cyan-blue-purple gradient palette

import { useId } from 'react';
import { Box } from '@mui/material';

// Updated palette based on new gradient logo
const SKY_COLORS = {
  // Arm gradient endpoints
  cyanLight: '#7AD9E8',
  cyanDark: '#5FB8E6',
  blueLight: '#7A8EE8',
  blueDark: '#5E6FD6',
  purpleLight: '#9C8FE8',
  purpleDark: '#7A6AD6',
  // Center hub colors
  hubOuter: '#6F7FDB',
  hubMid: '#3F466E',
  hubInner: '#7A8EE8',
  // Legacy exports for compatibility
  skyCyan: '#5FB8E6',
  periwinkle: '#7A8EE8',
  lavender: '#9C8FE8',
};

export default function Logo({ size = 40, showText = true, textColor = 'inherit' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <LogoIcon size={size} />
      {showText && (
        <Box
          component="span"
          sx={{
            fontSize: size * 0.35,
            fontFamily: '"TASA Explorer", sans-serif',
            fontWeight: 600,
            fontStyle: 'normal',
            letterSpacing: '0.04em',
            color: textColor === 'inherit' ? 'white' : textColor,
            whiteSpace: 'nowrap',
          }}
        >
          ONTOGRAPHIA LAB
        </Box>
      )}
    </Box>
  );
}

// Animated version for landing page
export function AnimatedLogo({ size = 60 }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <AnimatedLogoIcon size={size} />
      <Box
        component="span"
        sx={{
          fontSize: size * 0.4,
          fontFamily: '"TASA Explorer", sans-serif',
          fontWeight: 600,
          fontStyle: 'normal',
          letterSpacing: '0.04em',
          color: 'white',
          whiteSpace: 'nowrap',
        }}
      >
        ONTOGRAPHIA LAB
      </Box>
    </Box>
  );
}

// Icon only version - Gradient Pinwheel with Three-Ring Hub
export function LogoIcon({ size = 32 }) {
  const id = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${id}-armA`} x1="160" y1="130" x2="260" y2="260">
          <stop offset="0%" stopColor={SKY_COLORS.cyanLight}/>
          <stop offset="100%" stopColor={SKY_COLORS.cyanDark}/>
        </linearGradient>
        <linearGradient id={`${id}-armB`} x1="260" y1="260" x2="440" y2="260">
          <stop offset="0%" stopColor={SKY_COLORS.blueLight}/>
          <stop offset="100%" stopColor={SKY_COLORS.blueDark}/>
        </linearGradient>
        <linearGradient id={`${id}-armC`} x1="260" y1="260" x2="190" y2="440">
          <stop offset="0%" stopColor={SKY_COLORS.purpleLight}/>
          <stop offset="100%" stopColor={SKY_COLORS.purpleDark}/>
        </linearGradient>
      </defs>

      {/* Three curved arms with gradients */}
      <path
        d="M256 256 C232 216, 198 182, 164 138"
        stroke={`url(#${id}-armA)`}
        strokeWidth="54"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M256 256 C308 236, 370 242, 438 268"
        stroke={`url(#${id}-armB)`}
        strokeWidth="54"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M256 256 C258 318, 228 368, 204 432"
        stroke={`url(#${id}-armC)`}
        strokeWidth="54"
        strokeLinecap="round"
        fill="none"
      />

      {/* Two-ring center hub */}
      <circle cx="256" cy="256" r="36" fill={SKY_COLORS.hubOuter} opacity="0.95"/>
      <circle cx="256" cy="256" r="7" fill={SKY_COLORS.hubMid} opacity="0.95"/>
    </svg>
  );
}

// Animated logo icon with gentle rotation and color cycling
export function AnimatedLogoIcon({ size = 32 }) {
  const id = `anim-${useId().replace(/:/g, '')}`;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>
        {`
          @keyframes pinwheel-float {
            0%, 100% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(3deg) scale(1.02); }
          }
          .pinwheel-animated {
            animation: pinwheel-float 4s ease-in-out infinite;
          }
        `}
      </style>
      <svg
        className="pinwheel-animated"
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Animated gradient for arm A */}
          <linearGradient id={`${id}-armA`} x1="160" y1="130" x2="260" y2="260">
            <stop offset="0%" stopColor={SKY_COLORS.cyanLight}>
              <animate
                attributeName="stop-color"
                values={`${SKY_COLORS.cyanLight};${SKY_COLORS.blueLight};${SKY_COLORS.purpleLight};${SKY_COLORS.cyanLight}`}
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor={SKY_COLORS.cyanDark}>
              <animate
                attributeName="stop-color"
                values={`${SKY_COLORS.cyanDark};${SKY_COLORS.blueDark};${SKY_COLORS.purpleDark};${SKY_COLORS.cyanDark}`}
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
          {/* Animated gradient for arm B */}
          <linearGradient id={`${id}-armB`} x1="260" y1="260" x2="440" y2="260">
            <stop offset="0%" stopColor={SKY_COLORS.blueLight}>
              <animate
                attributeName="stop-color"
                values={`${SKY_COLORS.blueLight};${SKY_COLORS.purpleLight};${SKY_COLORS.cyanLight};${SKY_COLORS.blueLight}`}
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor={SKY_COLORS.blueDark}>
              <animate
                attributeName="stop-color"
                values={`${SKY_COLORS.blueDark};${SKY_COLORS.purpleDark};${SKY_COLORS.cyanDark};${SKY_COLORS.blueDark}`}
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
          {/* Animated gradient for arm C */}
          <linearGradient id={`${id}-armC`} x1="260" y1="260" x2="190" y2="440">
            <stop offset="0%" stopColor={SKY_COLORS.purpleLight}>
              <animate
                attributeName="stop-color"
                values={`${SKY_COLORS.purpleLight};${SKY_COLORS.cyanLight};${SKY_COLORS.blueLight};${SKY_COLORS.purpleLight}`}
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor={SKY_COLORS.purpleDark}>
              <animate
                attributeName="stop-color"
                values={`${SKY_COLORS.purpleDark};${SKY_COLORS.cyanDark};${SKY_COLORS.blueDark};${SKY_COLORS.purpleDark}`}
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>

        {/* Three curved arms with animated gradients */}
        <path
          d="M256 256 C232 216, 198 182, 164 138"
          stroke={`url(#${id}-armA)`}
          strokeWidth="54"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M256 256 C308 236, 370 242, 438 268"
          stroke={`url(#${id}-armB)`}
          strokeWidth="54"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M256 256 C258 318, 228 368, 204 432"
          stroke={`url(#${id}-armC)`}
          strokeWidth="54"
          strokeLinecap="round"
          fill="none"
        />

        {/* Two-ring center hub */}
        <circle cx="256" cy="256" r="36" fill={SKY_COLORS.hubOuter} opacity="0.95"/>
        <circle cx="256" cy="256" r="7" fill={SKY_COLORS.hubMid} opacity="0.95"/>
      </svg>
    </Box>
  );
}

// Loading version with spinning
export function LoadingLogo({ size = 60 }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <style>
        {`
          @keyframes logo-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes logo-breathe {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
          }
          @keyframes text-shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}
      </style>
      <Box
        sx={{
          animation: 'logo-breathe 2s ease-in-out infinite',
        }}
      >
        <Box
          sx={{
            animation: 'logo-spin 4s linear infinite',
            display: 'flex',
          }}
        >
          <LogoIcon size={size} />
        </Box>
      </Box>
      <Box
        component="span"
        sx={{
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          background: `linear-gradient(90deg, ${SKY_COLORS.cyanLight}, ${SKY_COLORS.blueLight}, ${SKY_COLORS.purpleLight}, ${SKY_COLORS.cyanLight})`,
          backgroundSize: '200% 100%',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          animation: 'text-shimmer 3s linear infinite',
        }}
      >
        Loading
      </Box>
    </Box>
  );
}

// Export the palette for use in other components
export const ETHEREAL_SKY_PALETTE = SKY_COLORS;
