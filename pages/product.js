// pages/product.js
// Product page with comprehensive feature overview and sales pitch
// Premium redesign inspired by Figma/Linear marketing pages

import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Grid, Button, keyframes, Container } from '@mui/material';
import Link from 'next/link';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SpeedIcon from '@mui/icons-material/Speed';
import BrushIcon from '@mui/icons-material/Brush';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import GroupsIcon from '@mui/icons-material/Groups';
import SecurityIcon from '@mui/icons-material/Security';
import CloudIcon from '@mui/icons-material/Cloud';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CodeIcon from '@mui/icons-material/Code';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import HubIcon from '@mui/icons-material/Hub';
import SchemaIcon from '@mui/icons-material/Schema';
import CategoryIcon from '@mui/icons-material/Category';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LayersIcon from '@mui/icons-material/Layers';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import TerminalIcon from '@mui/icons-material/Terminal';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import PageLayout, { SKY } from '../components/landing/PageLayout';

// Keyframe animations
const float = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-10px) rotate(1deg); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
`;

const draw = keyframes`
  0% { stroke-dashoffset: 1000; }
  100% { stroke-dashoffset: 0; }
`;

const fadeInUp = keyframes`
  0% { opacity: 0; transform: translateY(30px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const scaleIn = keyframes`
  0% { opacity: 0; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
`;

const gradientShift = keyframes`
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
`;

const slideInLeft = keyframes`
  0% { opacity: 0; transform: translateX(-30px); }
  100% { opacity: 1; transform: translateX(0); }
`;

const borderGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 20px rgba(79, 179, 206, 0.1),
                inset 0 0 20px rgba(79, 179, 206, 0.05);
  }
  50% {
    box-shadow: 0 0 40px rgba(154, 138, 200, 0.15),
                inset 0 0 30px rgba(154, 138, 200, 0.08);
  }
`;

const typewriter = keyframes`
  0% { width: 0; }
  100% { width: 100%; }
`;

// Animated diagram preview component
function DiagramPreview({ type = 'flowchart' }) {
  const configs = {
    flowchart: {
      nodes: [
        { x: 50, y: 30, w: 70, h: 30, color: SKY.deepCyan, label: 'Start', shape: 'rounded' },
        { x: 50, y: 90, w: 80, h: 35, color: SKY.steelBlue, label: 'Process', shape: 'rect' },
        { x: 50, y: 155, w: 50, h: 50, color: SKY.deepLavender, label: '?', shape: 'diamond' },
        { x: 20, y: 230, w: 60, h: 30, color: SKY.warmPeach, label: 'Yes', shape: 'rect' },
        { x: 80, y: 230, w: 60, h: 30, color: SKY.mauveRose, label: 'No', shape: 'rect' },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3, offset: -30 },
        { from: 2, to: 4, offset: 30 },
      ],
    },
    mindmap: {
      nodes: [
        { x: 85, y: 120, w: 70, h: 35, color: SKY.deepLavender, label: 'Main', shape: 'pill', isCenter: true },
        { x: 25, y: 50, w: 50, h: 24, color: SKY.deepCyan, label: 'Topic A', shape: 'pill' },
        { x: 145, y: 50, w: 50, h: 24, color: SKY.steelBlue, label: 'Topic B', shape: 'pill' },
        { x: 15, y: 190, w: 55, h: 24, color: SKY.mauveRose, label: 'Topic C', shape: 'pill' },
        { x: 155, y: 190, w: 50, h: 24, color: SKY.warmPeach, label: 'Topic D', shape: 'pill' },
      ],
      connections: [
        { from: 0, to: 1, curve: true },
        { from: 0, to: 2, curve: true },
        { from: 0, to: 3, curve: true },
        { from: 0, to: 4, curve: true },
      ],
    },
    erd: {
      nodes: [
        { x: 30, y: 70, w: 70, h: 50, color: SKY.deepCyan, label: 'User', shape: 'rect' },
        { x: 140, y: 70, w: 70, h: 50, color: SKY.steelBlue, label: 'Order', shape: 'rect' },
        { x: 85, y: 180, w: 70, h: 50, color: SKY.deepLavender, label: 'Product', shape: 'rect' },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
      ],
    },
  };

  const config = configs[type] || configs.flowchart;

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 240 280" preserveAspectRatio="xMidYMid meet">
        {/* Connection lines */}
        <g>
          {config.connections.map((conn, i) => {
            const fromNode = config.nodes[conn.from];
            const toNode = config.nodes[conn.to];
            const x1 = fromNode.x + fromNode.w / 2;
            const y1 = fromNode.y + fromNode.h;
            const x2 = toNode.x + toNode.w / 2 + (conn.offset || 0);
            const y2 = toNode.y;

            if (conn.curve) {
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} Q ${mx} ${y1} ${x2} ${y2}`}
                  fill="none"
                  stroke={`${SKY.deepLavender}60`}
                  strokeWidth="2"
                  strokeDasharray="1000"
                  sx={{ animation: `${draw} 2s ease-out forwards`, animationDelay: `${i * 0.2}s` }}
                />
              );
            }

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={`${SKY.deepLavender}60`}
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            );
          })}
        </g>

        {/* Nodes */}
        {config.nodes.map((node, i) => {
          let shape;
          if (node.shape === 'diamond') {
            shape = (
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx="4"
                transform={`rotate(45 ${node.x + node.w / 2} ${node.y + node.h / 2})`}
                fill={`${node.color}40`}
                stroke={`${node.color}80`}
                strokeWidth="1.5"
              />
            );
          } else if (node.shape === 'pill' || node.shape === 'rounded') {
            shape = (
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx={node.shape === 'pill' ? node.h / 2 : 6}
                fill={`${node.color}40`}
                stroke={`${node.color}80`}
                strokeWidth="1.5"
              />
            );
          } else {
            shape = (
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx="4"
                fill={`${node.color}40`}
                stroke={`${node.color}80`}
                strokeWidth="1.5"
              />
            );
          }

          return (
            <g key={i}>
              {shape}
              <text
                x={node.x + node.w / 2}
                y={node.y + node.h / 2 + 4}
                textAnchor="middle"
                fill="rgba(255, 255, 255, 0.8)"
                fontSize={node.isCenter ? 11 : 9}
                fontWeight={node.isCenter ? 600 : 500}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

// Premium Bento Feature Card - Performance Optimized
function BentoFeatureCard({ icon: Icon, title, description, color, size = 'normal', diagram, stats, highlight }) {
  const [isHovered, setIsHovered] = useState(false);

  const isLarge = size === 'large';
  const isWide = size === 'wide';
  const isFeatured = size === 'featured';

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: 'relative',
        borderRadius: '20px',
        background: isFeatured
          ? `linear-gradient(135deg, ${color}08, rgba(255,255,255,0.02))`
          : 'rgba(255, 255, 255, 0.015)',
        border: '1px solid',
        borderColor: isHovered ? `${color}40` : 'rgba(255, 255, 255, 0.06)',
        transition: 'all 0.3s ease',
        height: '100%',
        overflow: 'hidden',
        cursor: 'default',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered
          ? `0 16px 32px -8px ${color}15`
          : '0 2px 12px -4px rgba(0,0,0,0.2)',
      }}
    >
      {/* Simple top accent line on hover */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1, p: isFeatured ? 5 : isLarge ? 4.5 : 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Icon with simple styling */}
        <Box
          sx={{
            width: isFeatured ? 64 : isLarge ? 56 : 48,
            height: isFeatured ? 64 : isLarge ? 56 : 48,
            borderRadius: '14px',
            background: `linear-gradient(135deg, ${color}20, ${color}08)`,
            border: `1px solid ${color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
            transition: 'transform 0.3s ease',
            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          <Icon sx={{
            fontSize: isFeatured ? 32 : isLarge ? 28 : 24,
            color,
          }} />
        </Box>

        {/* Title with optional highlight badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Typography
            variant="h3"
            sx={{
              fontSize: isFeatured ? 28 : isLarge ? 22 : 18,
              fontWeight: 650,
              color: 'white',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
          {highlight && (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: '6px',
                background: `${color}20`,
                border: `1px solid ${color}40`,
                fontSize: 11,
                fontWeight: 600,
                color,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {highlight}
            </Box>
          )}
        </Box>

        <Typography
          sx={{
            color: 'rgba(255, 255, 255, 0.55)',
            fontSize: isFeatured ? 16 : 14,
            lineHeight: 1.75,
            flex: diagram || stats ? 0 : 1,
          }}
        >
          {description}
        </Typography>

        {/* Stats row for featured cards */}
        {stats && (
          <Box sx={{ display: 'flex', gap: 4, mt: 4, pt: 3, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {stats.map((stat, i) => (
              <Box key={i}>
                <Typography sx={{
                  fontSize: 28,
                  fontWeight: 700,
                  color,
                  lineHeight: 1,
                }}>
                  {stat.value}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>
                  {stat.label}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Embedded diagram preview */}
        {diagram && (
          <Box
            sx={{
              mt: 'auto',
              pt: 3,
              height: 180,
              borderRadius: '12px',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2))',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <DiagramPreview type={diagram} />
            {/* Fade overlay */}
            <Box sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 40,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
              pointerEvents: 'none',
            }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Premium Diagram Type Card - Showcase style
function DiagramTypeCard({ title, description, stencils, icon: Icon, color, preview, featured }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: 'relative',
        borderRadius: '20px',
        background: featured
          ? `linear-gradient(135deg, ${color}06, rgba(255,255,255,0.01))`
          : 'rgba(255, 255, 255, 0.01)',
        border: '1px solid',
        borderColor: isHovered ? `${color}40` : 'rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
        transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
        cursor: 'pointer',
        transform: isHovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0)',
        boxShadow: isHovered
          ? `0 32px 64px -12px ${color}15, 0 0 80px ${color}08`
          : '0 4px 24px -8px rgba(0,0,0,0.2)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Preview area with animated diagram sketch */}
      <Box
        sx={{
          height: featured ? 180 : 140,
          background: `linear-gradient(180deg, ${color}08 0%, transparent 100%)`,
          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated grid pattern */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(${color}10 1px, transparent 1px),
              linear-gradient(90deg, ${color}10 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
            opacity: isHovered ? 0.8 : 0.3,
            transition: 'opacity 0.4s ease',
          }}
        />

        {/* Central icon - simplified */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${color}25, ${color}12)`,
              border: `1px solid ${color}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              transform: isHovered ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            <Icon sx={{ fontSize: 28, color }} />
          </Box>
        </Box>

        {/* Simple decorative shapes - no animations */}
        {[
          { top: '18%', left: '15%', size: 20 },
          { top: '22%', right: '18%', size: 16 },
          { bottom: '20%', left: '20%', size: 14 },
          { bottom: '25%', right: '15%', size: 18 },
        ].map((shape, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              top: shape.top,
              left: shape.left,
              right: shape.right,
              bottom: shape.bottom,
              width: shape.size,
              height: shape.size,
              borderRadius: i % 2 === 0 ? '4px' : '50%',
              border: `1.5px solid ${color}30`,
              background: `${color}06`,
              opacity: isHovered ? 0.7 : 0.3,
              transition: 'opacity 0.3s ease',
            }}
          />
        ))}
      </Box>

      {/* Content */}
      <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography
          sx={{
            fontSize: featured ? 20 : 17,
            fontWeight: 650,
            color: 'white',
            mb: 1,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </Typography>
        <Typography sx={{
          color: 'rgba(255, 255, 255, 0.45)',
          fontSize: 13,
          lineHeight: 1.6,
          mb: 2.5,
          flex: 1,
        }}>
          {description}
        </Typography>

        {/* Stencil tags - horizontal scroll on small screens */}
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.75,
          pt: 2,
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          {stencils.slice(0, featured ? 5 : 3).map((stencil, i) => (
            <Box
              key={stencil}
              sx={{
                px: 1.5,
                py: 0.5,
                fontSize: 11,
                borderRadius: '6px',
                background: isHovered ? `${color}20` : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${isHovered ? `${color}30` : 'transparent'}`,
                color: isHovered ? color : 'rgba(255, 255, 255, 0.5)',
                fontWeight: 500,
                transition: 'all 0.3s ease',
                transitionDelay: `${i * 0.03}s`,
              }}
            >
              {stencil}
            </Box>
          ))}
          {stencils.length > (featured ? 5 : 3) && (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                fontSize: 11,
                borderRadius: '6px',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.35)',
                fontWeight: 500,
              }}
            >
              +{stencils.length - (featured ? 5 : 3)}
            </Box>
          )}
        </Box>
      </Box>

      {/* Hover arrow indicator */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: `${color}15`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? 'translateX(0)' : 'translateX(-8px)',
          transition: 'all 0.4s ease',
        }}
      >
        <ArrowForwardIcon sx={{ fontSize: 16, color }} />
      </Box>
    </Box>
  );
}

// Premium Capability item with icon and animated entry
function CapabilityItem({ children, icon: Icon, color = SKY.deepCyan, delay = 0 }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        mb: 2,
        p: 2,
        borderRadius: '12px',
        background: isHovered ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
        border: '1px solid',
        borderColor: isHovered ? `${color}20` : 'transparent',
        transition: 'all 0.3s ease',
        cursor: 'default',
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          background: `linear-gradient(135deg, ${color}20, ${color}08)`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.3s ease',
          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        {Icon ? (
          <Icon sx={{ color, fontSize: 18 }} />
        ) : (
          <CheckCircleOutlineIcon sx={{ color, fontSize: 18 }} />
        )}
      </Box>
      <Typography sx={{
        color: isHovered ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.65)',
        fontSize: 14,
        lineHeight: 1.7,
        pt: 0.5,
        transition: 'color 0.3s ease',
      }}>
        {children}
      </Typography>
    </Box>
  );
}

// Premium Stats display with animated counters
function StatsBar() {
  const stats = [
    { value: '50+', label: 'Stencil Types', color: SKY.deepCyan },
    { value: '6', label: 'Diagram Families', color: SKY.steelBlue },
    { value: '<1s', label: 'Load Time', color: SKY.deepLavender },
    { value: '100%', label: 'Browser Based', color: SKY.mauveRose },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: { xs: 2, md: 3 },
      }}
    >
      {stats.map((stat, i) => (
        <Box
          key={i}
          sx={{
            textAlign: 'center',
            py: { xs: 4, md: 5 },
            px: 3,
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.015)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.4s ease',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.025)',
              borderColor: `${stat.color}30`,
              transform: 'translateY(-4px)',
            },
          }}
        >
          {/* Gradient top accent */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: '20%',
              right: '20%',
              height: '2px',
              background: `linear-gradient(90deg, transparent, ${stat.color}60, transparent)`,
            }}
          />
          <Typography
            sx={{
              fontSize: { xs: 36, md: 48 },
              fontWeight: 800,
              color: stat.color,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              mb: 1,
            }}
          >
            {stat.value}
          </Typography>
          <Typography
            sx={{
              fontSize: 13,
              color: 'rgba(255, 255, 255, 0.45)',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            {stat.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// Interactive Hero Canvas Demo with draggable nodes - Polished version
function HeroCanvas() {
  const canvasRef = useRef(null);
  const [nodes, setNodes] = useState([
    { id: 0, x: 60, y: 35, w: 90, h: 36, color: SKY.deepCyan, label: 'Start', shape: 'pill' },
    { id: 1, x: 220, y: 30, w: 100, h: 40, color: SKY.steelBlue, label: 'Validate', shape: 'rect' },
    { id: 2, x: 400, y: 35, w: 100, h: 40, color: SKY.deepLavender, label: 'Process', shape: 'rect' },
    { id: 3, x: 140, y: 120, w: 50, h: 50, color: SKY.mauveRose, label: '?', shape: 'diamond' },
    { id: 4, x: 300, y: 115, w: 110, h: 40, color: SKY.warmPeach, label: 'Execute', shape: 'rect' },
    { id: 5, x: 480, y: 120, w: 80, h: 36, color: SKY.goldenHour, label: 'Done', shape: 'pill' },
    { id: 6, x: 60, y: 190, w: 100, h: 40, color: SKY.skyReturn, label: 'Retry', shape: 'rect' },
  ]);
  const connections = [
    { from: 0, to: 1 },
    { from: 1, to: 2 },
    { from: 2, to: 4 },
    { from: 1, to: 3 },
    { from: 3, to: 4 },
    { from: 3, to: 6 },
    { from: 4, to: 5 },
    { from: 6, to: 0 },
  ];
  const [dragging, setDragging] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  const handleMouseDown = (e, nodeId) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId);
    setDragging({
      nodeId,
      offsetX: e.clientX - rect.left - node.x,
      offsetY: e.clientY - rect.top - node.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const node = nodes.find(n => n.id === dragging.nodeId);
    const x = Math.max(10, Math.min(rect.width - node.w - 10, e.clientX - rect.left - dragging.offsetX));
    const y = Math.max(10, Math.min(rect.height - node.h - 10, e.clientY - rect.top - dragging.offsetY));
    setNodes(prev => prev.map(n => n.id === dragging.nodeId ? { ...n, x, y } : n));
  };

  const handleMouseUp = () => setDragging(null);

  // Smart connection path - finds best route
  const getConnectionPath = (fromNode, toNode) => {
    const fcx = fromNode.x + fromNode.w / 2;
    const fcy = fromNode.y + fromNode.h / 2;
    const tcx = toNode.x + toNode.w / 2;
    const tcy = toNode.y + toNode.h / 2;

    // Determine best exit/entry points
    let x1, y1, x2, y2;
    const dx = tcx - fcx;
    const dy = tcy - fcy;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection
      if (dx > 0) {
        x1 = fromNode.x + fromNode.w; y1 = fcy;
        x2 = toNode.x; y2 = tcy;
      } else {
        x1 = fromNode.x; y1 = fcy;
        x2 = toNode.x + toNode.w; y2 = tcy;
      }
    } else {
      // Vertical connection
      if (dy > 0) {
        x1 = fcx; y1 = fromNode.y + fromNode.h;
        x2 = tcx; y2 = toNode.y;
      } else {
        x1 = fcx; y1 = fromNode.y;
        x2 = tcx; y2 = toNode.y + toNode.h;
      }
    }

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} Q ${midX} ${y1}, ${midX} ${midY} T ${x2} ${y2}`;
  };

  // Render node shape
  const renderNodeShape = (node, isActive) => {
    const baseOpacity = isActive ? '60' : '35';
    const borderOpacity = isActive ? 'cc' : '80';

    if (node.shape === 'diamond') {
      return {
        width: node.w,
        height: node.h,
        background: `${node.color}${baseOpacity}`,
        border: `2px solid ${node.color}${borderOpacity}`,
        borderRadius: '6px',
        transform: 'rotate(45deg)',
        '& > *': { transform: 'rotate(-45deg)' },
      };
    }
    if (node.shape === 'pill') {
      return {
        width: node.w,
        height: node.h,
        background: `linear-gradient(135deg, ${node.color}${baseOpacity}, ${node.color}45)`,
        border: `2px solid ${node.color}${borderOpacity}`,
        borderRadius: node.h / 2,
      };
    }
    return {
      width: node.w,
      height: node.h,
      background: `${node.color}${baseOpacity}`,
      border: `2px solid ${node.color}${borderOpacity}`,
      borderRadius: '8px',
    };
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 750,
        aspectRatio: '16/9',
        mx: 'auto',
        mt: 6,
        borderRadius: 3,
        overflow: 'hidden',
        background: 'linear-gradient(145deg, rgba(15, 15, 28, 0.95), rgba(8, 8, 18, 0.98))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: `
          0 0 0 1px rgba(255, 255, 255, 0.05),
          0 25px 80px rgba(0, 0, 0, 0.6),
          0 0 120px ${SKY.deepLavender}12,
          inset 0 1px 0 rgba(255, 255, 255, 0.05)
        `,
      }}
    >
      {/* Top toolbar */}
      <Box
        sx={{
          height: 40,
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          px: 2,
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
            <Box key={i} sx={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
        </Box>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', gap: 0.5, px: 2, py: 0.5, borderRadius: 1, background: 'rgba(255,255,255,0.04)' }}>
            {['⊞', '↗', '◇', '⬭'].map((icon, i) => (
              <Box key={i} sx={{ px: 1, py: 0.25, fontSize: 12, color: i === 0 ? SKY.deepCyan : 'rgba(255,255,255,0.4)' }}>{icon}</Box>
            ))}
          </Box>
        </Box>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
          Try dragging →
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', height: 'calc(100% - 40px)' }}>
        {/* Left mini sidebar */}
        <Box
          sx={{
            width: 44,
            background: 'rgba(255, 255, 255, 0.02)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 1.5,
            gap: 0.5,
          }}
        >
          {[
            { icon: '▢', color: SKY.deepCyan },
            { icon: '○', color: SKY.deepLavender },
            { icon: '◇', color: SKY.mauveRose },
            { icon: '⬭', color: SKY.warmPeach },
          ].map((item, i) => (
            <Box
              key={i}
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: item.color,
                background: i === 0 ? `${item.color}15` : 'transparent',
                border: i === 0 ? `1px solid ${item.color}30` : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { background: `${item.color}15`, borderColor: `${item.color}30` },
              }}
            >
              {item.icon}
            </Box>
          ))}
        </Box>

        {/* Canvas */}
        <Box
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          sx={{
            flex: 1,
            position: 'relative',
            cursor: dragging ? 'grabbing' : 'default',
            userSelect: 'none',
            // Dot grid pattern
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        >
          {/* Connection lines */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <linearGradient id="connGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={SKY.deepCyan} stopOpacity="0.7" />
                <stop offset="100%" stopColor={SKY.deepLavender} stopOpacity="0.7" />
              </linearGradient>
              <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill={`${SKY.deepLavender}90`} />
              </marker>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {connections.map((conn, i) => {
              const fromNode = nodes.find(n => n.id === conn.from);
              const toNode = nodes.find(n => n.id === conn.to);
              if (!fromNode || !toNode) return null;
              return (
                <path
                  key={i}
                  d={getConnectionPath(fromNode, toNode)}
                  fill="none"
                  stroke="url(#connGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  markerEnd="url(#arrow)"
                  filter="url(#glow)"
                  style={{ transition: dragging ? 'none' : 'd 0.12s ease-out' }}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node, i) => {
            const isActive = hoveredNode === node.id || dragging?.nodeId === node.id;
            const shapeStyles = renderNodeShape(node, isActive);
            return (
              <Box
                key={node.id}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                sx={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  ...shapeStyles,
                  boxShadow: isActive
                    ? `0 8px 32px ${node.color}50, 0 0 0 2px ${node.color}40, inset 0 1px 0 rgba(255,255,255,0.1)`
                    : `0 4px 16px ${node.color}25`,
                  cursor: dragging?.nodeId === node.id ? 'grabbing' : 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: dragging?.nodeId === node.id ? 'none' : 'all 0.2s ease',
                  animation: dragging ? 'none' : `${float} ${5 + i * 0.7}s ease-in-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: node.shape === 'diamond' ? 14 : 11,
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.9)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    pointerEvents: 'none',
                    letterSpacing: '0.02em',
                  }}
                >
                  {node.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export default function ProductPage() {
  const features = [
    {
      icon: ElectricBoltIcon,
      title: 'Instant Canvas',
      description: 'Zero loading time. Your canvas is ready the moment you need it. Drag, drop, and create without waiting.',
      color: SKY.deepCyan,
      size: 'featured',
      highlight: 'Fast',
      stats: [
        { value: '<1s', label: 'Load time' },
        { value: '60fps', label: 'Smooth pan' },
        { value: '∞', label: 'Canvas size' },
      ],
    },
    {
      icon: LayersIcon,
      title: 'Smart Connections',
      description: 'Intelligent routing that automatically avoids obstacles. Step, curved, and orthogonal line styles with real-time updates.',
      color: SKY.deepLavender,
      size: 'large',
    },
    {
      icon: BrushIcon,
      title: 'Professional Styling',
      description: 'Gradient fills, custom borders, shadows, and precise typography. Publication-ready from the start.',
      color: SKY.mauveRose,
    },
    {
      icon: GroupsIcon,
      title: 'Real-time Collaboration',
      description: 'Work together seamlessly. See teammates\' cursors, changes sync instantly.',
      color: SKY.warmPeach,
    },
    {
      icon: SecurityIcon,
      title: 'Enterprise Security',
      description: 'Bank-grade encryption and fine-grained access controls protect your IP.',
      color: SKY.goldenHour,
    },
    {
      icon: CloudIcon,
      title: 'Cloud-Native',
      description: 'Access from anywhere. Automatic versioning keeps every change safe.',
      color: SKY.skyReturn,
    },
  ];

  const diagramTypes = [
    {
      title: 'Flowcharts & Process',
      description: 'Map processes, decisions, and workflows with clarity. The foundation of visual communication.',
      stencils: ['Start/End', 'Process', 'Decision', 'Document', 'Data', 'Connector'],
      icon: DeviceHubIcon,
      color: SKY.deepCyan,
      featured: true,
    },
    {
      title: 'Mind Maps',
      description: 'Brainstorm and organize ideas hierarchically. Perfect for ideation and planning.',
      stencils: ['Central Topic', 'Topic', 'Subtopic', 'Note', 'Boundary'],
      icon: PsychologyIcon,
      color: SKY.deepLavender,
      featured: true,
    },
    {
      title: 'UML Diagrams',
      description: 'Software architecture and design patterns',
      stencils: ['Class', 'Interface', 'Actor', 'Use Case', 'Component', 'Package'],
      icon: SchemaIcon,
      color: SKY.steelBlue,
    },
    {
      title: 'Entity Relationship',
      description: 'Database design and data modeling',
      stencils: ['Entity', 'Attribute', 'Relationship', 'Weak Entity', 'Key'],
      icon: HubIcon,
      color: SKY.mauveRose,
    },
    {
      title: 'Causal Loop Diagrams',
      description: 'Systems thinking and feedback loops',
      stencils: ['Variable', 'Stock', 'Flow', 'Delay', 'Reinforcing', 'Balancing'],
      icon: AutoAwesomeIcon,
      color: SKY.warmPeach,
    },
    {
      title: 'Capability Maps',
      description: 'Business capability modeling',
      stencils: ['Capability', 'Sub-capability', 'Process', 'Application', 'Data'],
      icon: AccountBalanceIcon,
      color: SKY.goldenHour,
    },
  ];

  return (
    <PageLayout
      title="Product"
      description="Professional diagramming for modern teams. Visualize ideas, design systems, and collaborate in real-time."
      maxWidth="lg"
    >
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', mb: 12, pt: 4 }}>
        {/* Badge */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 2.5,
            py: 0.75,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            mb: 4,
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: SKY.deepCyan,
              boxShadow: `0 0 8px ${SKY.deepCyan}`,
            }}
          />
          <Typography sx={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
            Now in Public Beta
          </Typography>
        </Box>

        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: 40, md: 60, lg: 72 },
            fontWeight: 700,
            color: 'white',
            mb: 3,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          Professional Diagramming,
          <Box
            component="span"
            sx={{
              display: 'block',
              background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender}, ${SKY.mauveRose}, ${SKY.warmPeach})`,
              backgroundSize: '200% auto',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              animation: `${shimmer} 4s linear infinite`,
            }}
          >
            Redefined
          </Box>
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: 17, md: 20 },
            color: 'rgba(255, 255, 255, 0.55)',
            maxWidth: 640,
            mx: 'auto',
            mb: 5,
            lineHeight: 1.7,
          }}
        >
          Ontographia Lab combines the fluidity of a whiteboard with the precision of professional design tools.
          Create diagrams that communicate clearly and look stunning.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{
                background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                color: 'white',
                px: 4,
                py: 1.75,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 2,
                textTransform: 'none',
                boxShadow: `0 8px 32px ${SKY.deepCyan}40, 0 0 0 1px ${SKY.deepCyan}30 inset`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: `linear-gradient(135deg, ${SKY.steelBlue}, ${SKY.mauveRose})`,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 12px 40px ${SKY.deepCyan}50`,
                },
              }}
            >
              Start Creating Free
            </Button>
          </Link>
          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.15)',
              color: 'rgba(255, 255, 255, 0.8)',
              px: 3,
              py: 1.75,
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 2,
              textTransform: 'none',
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: `${SKY.deepCyan}60`,
                background: 'rgba(79, 179, 206, 0.1)',
              },
            }}
          >
            Watch Demo
          </Button>
        </Box>

        {/* Hero canvas mockup */}
        <HeroCanvas />
      </Box>

      {/* Stats Bar */}
      <Box sx={{ mb: 12 }}>
        <StatsBar />
      </Box>

      {/* Features Bento Grid - Premium Layout */}
      <Box id="features" sx={{ mb: 16 }}>
        {/* Section header with decorative line */}
        <Box sx={{ textAlign: 'center', mb: 10, position: 'relative' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              px: 3,
              py: 1,
              borderRadius: '100px',
              background: `linear-gradient(135deg, ${SKY.deepCyan}10, ${SKY.deepLavender}10)`,
              border: `1px solid ${SKY.deepCyan}20`,
              mb: 4,
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: SKY.deepCyan }} />
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: SKY.deepCyan,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
              }}
            >
              Features
            </Typography>
          </Box>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: 36, md: 52 },
              fontWeight: 750,
              color: 'white',
              mb: 3,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
            }}
          >
            Built for
            <Box
              component="span"
              sx={{
                display: 'block',
                background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Professionals
            </Box>
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: { xs: 16, md: 18 },
              maxWidth: 560,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            Every feature designed with one goal: help you create better diagrams, faster.
            No bloat, no friction—just results.
          </Typography>
        </Box>

        {/* Premium Bento grid layout */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(12, 1fr)' },
            gap: 3,
          }}
        >
          {/* Featured large card - spans 7 columns */}
          <Box sx={{ gridColumn: { xs: '1', md: '1 / 8' }, minHeight: { md: 380 } }}>
            <BentoFeatureCard {...features[0]} />
          </Box>

          {/* Stack of two cards on right - spans 5 columns */}
          <Box sx={{ gridColumn: { xs: '1', md: '8 / 13' }, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <BentoFeatureCard {...features[1]} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <BentoFeatureCard {...features[2]} />
            </Box>
          </Box>

          {/* Bottom row - 3 equal cards */}
          <Box sx={{ gridColumn: { xs: '1', md: '1 / 5' } }}>
            <BentoFeatureCard {...features[3]} />
          </Box>
          <Box sx={{ gridColumn: { xs: '1', md: '5 / 9' } }}>
            <BentoFeatureCard {...features[4]} />
          </Box>
          <Box sx={{ gridColumn: { xs: '1', md: '9 / 13' } }}>
            <BentoFeatureCard {...features[5]} />
          </Box>
        </Box>
      </Box>

      {/* Diagram Types - Premium Showcase */}
      <Box id="diagrams" sx={{ mb: 16, position: 'relative' }}>

        {/* Section header */}
        <Box sx={{ textAlign: 'center', mb: 10, position: 'relative' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              px: 3,
              py: 1,
              borderRadius: '100px',
              background: `linear-gradient(135deg, ${SKY.deepLavender}10, ${SKY.mauveRose}10)`,
              border: `1px solid ${SKY.deepLavender}20`,
              mb: 4,
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: SKY.deepLavender }} />
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: SKY.deepLavender,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
              }}
            >
              Diagram Types
            </Typography>
          </Box>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: 36, md: 52 },
              fontWeight: 750,
              color: 'white',
              mb: 3,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
            }}
          >
            Every Diagram
            <Box
              component="span"
              sx={{
                display: 'block',
                background: `linear-gradient(90deg, ${SKY.deepLavender}, ${SKY.mauveRose})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              You Need
            </Box>
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: { xs: 16, md: 18 },
              maxWidth: 560,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            From quick sketches to enterprise architecture, the right stencils for every use case.
          </Typography>
        </Box>

        {/* 2+4 Layout - Two featured cards on top, four below */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
          {/* Featured row - 2 large cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3,
            }}
          >
            {diagramTypes.slice(0, 2).map((type, index) => (
              <DiagramTypeCard key={index} {...type} />
            ))}
          </Box>

          {/* Regular row - 4 cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
              gap: 3,
            }}
          >
            {diagramTypes.slice(2).map((type, index) => (
              <DiagramTypeCard key={index + 2} {...type} />
            ))}
          </Box>
        </Box>

        {/* "And more coming" indicator */}
        <Box sx={{ textAlign: 'center', mt: 6 }}>
          <Typography
            sx={{
              fontSize: 14,
              color: 'rgba(255, 255, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            <Box sx={{ width: 40, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            More diagram types coming soon
            <Box sx={{ width: 40, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </Typography>
        </Box>
      </Box>

      {/* Collaboration Section - Premium Full-Width Layout */}
      <Box
        id="collaboration"
        sx={{
          mb: 16,
          position: 'relative',
          py: { xs: 8, md: 12 },
          mx: { xs: -2, md: -4 },
          px: { xs: 2, md: 4 },
          background: `linear-gradient(180deg, transparent 0%, ${SKY.warmPeach}03 20%, ${SKY.warmPeach}04 50%, ${SKY.warmPeach}03 80%, transparent 100%)`,
        }}
      >

        {/* Section header - centered */}
        <Box sx={{ textAlign: 'center', mb: 10 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              px: 3,
              py: 1,
              borderRadius: '100px',
              background: `linear-gradient(135deg, ${SKY.warmPeach}10, ${SKY.goldenHour}10)`,
              border: `1px solid ${SKY.warmPeach}20`,
              mb: 4,
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: SKY.warmPeach }} />
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: SKY.warmPeach,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
              }}
            >
              Collaboration
            </Typography>
          </Box>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: 36, md: 52 },
              fontWeight: 750,
              color: 'white',
              mb: 3,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
            }}
          >
            Work Together,
            <Box
              component="span"
              sx={{
                display: 'block',
                background: `linear-gradient(90deg, ${SKY.warmPeach}, ${SKY.goldenHour})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Seamlessly
            </Box>
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: { xs: 16, md: 18 },
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            Diagramming is a team sport. Real-time collaboration that feels natural,
            whether you're in the same room or across the globe.
          </Typography>
        </Box>

        {/* Two-column layout */}
        <Grid container spacing={6} alignItems="stretch">
          {/* Left - Canvas mockup */}
          <Grid item xs={12} md={7}>
            <Box
              sx={{
                position: 'relative',
                aspectRatio: { xs: '4/3', md: '16/10' },
                borderRadius: '20px',
                background: 'linear-gradient(145deg, rgba(15, 15, 28, 0.95), rgba(8, 8, 18, 0.98))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                overflow: 'hidden',
                boxShadow: `
                  0 32px 64px -16px rgba(0, 0, 0, 0.5),
                  0 0 100px ${SKY.warmPeach}08,
                  inset 0 1px 0 rgba(255, 255, 255, 0.05)
                `,
              }}
            >
              {/* Browser chrome */}
              <Box
                sx={{
                  height: 36,
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  px: 2,
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                    <Box key={i} sx={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                  ))}
                </Box>
                <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <Box sx={{ px: 3, py: 0.5, borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>ontographia.app/project/team-diagram</Typography>
                  </Box>
                </Box>
                {/* Avatar stack */}
                <Box sx={{ display: 'flex' }}>
                  {['#FF6B6B', '#4ECDC4', '#9B59B6', '#F0D98A'].map((c, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: c,
                        border: '2px solid rgba(15, 15, 28, 1)',
                        marginLeft: i > 0 ? '-6px' : 0,
                        zIndex: 4 - i,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'white',
                      }}
                    >
                      {['A', 'B', 'C', '+2'][i]}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Canvas area with grid */}
              <Box
                sx={{
                  position: 'relative',
                  height: 'calc(100% - 36px)',
                  backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
                  backgroundSize: '16px 16px',
                }}
              >
                {/* Diagram shapes - static, no animations */}
                {[
                  { x: '8%', y: '15%', w: 100, h: 44, color: SKY.deepCyan, label: 'API Gateway' },
                  { x: '35%', y: '10%', w: 90, h: 44, color: SKY.steelBlue, label: 'Auth Service' },
                  { x: '62%', y: '15%', w: 95, h: 44, color: SKY.deepLavender, label: 'User DB' },
                  { x: '20%', y: '50%', w: 105, h: 48, color: SKY.mauveRose, label: 'Order Service' },
                  { x: '55%', y: '55%', w: 90, h: 44, color: SKY.warmPeach, label: 'Payment' },
                ].map((el, i) => (
                  <Box
                    key={i}
                    sx={{
                      position: 'absolute',
                      left: el.x,
                      top: el.y,
                      width: el.w,
                      height: el.h,
                      borderRadius: '10px',
                      background: `${el.color}20`,
                      border: `1.5px solid ${el.color}50`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{el.label}</Typography>
                  </Box>
                ))}

                {/* Cursors - static */}
                {[
                  { x: '25%', y: '35%', color: '#FF6B6B', name: 'Sarah' },
                  { x: '70%', y: '40%', color: '#4ECDC4', name: 'Mike' },
                ].map((cursor, i) => (
                  <Box
                    key={i}
                    sx={{
                      position: 'absolute',
                      left: cursor.x,
                      top: cursor.y,
                      zIndex: 10,
                    }}
                  >
                    <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
                      <path d="M1 1L17 11L9 13L7 21L1 1Z" fill={cursor.color} stroke="white" strokeWidth="1.5" />
                    </svg>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 18,
                        left: 6,
                        px: 1.5,
                        py: 0.25,
                        borderRadius: '4px',
                        background: cursor.color,
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'white',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cursor.name}
                    </Box>
                  </Box>
                ))}

                {/* Comment indicator */}
                <Box
                  sx={{
                    position: 'absolute',
                    right: '12%',
                    bottom: '20%',
                    p: 1.5,
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    maxWidth: 140,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', background: '#9B59B6' }} />
                    <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Chris</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                    Should we add caching here?
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>

          {/* Right - Features grid */}
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%', justifyContent: 'center' }}>
              <CapabilityItem icon={GroupsIcon} color={SKY.warmPeach}>
                Real-time cursor presence shows who's working where
              </CapabilityItem>
              <CapabilityItem icon={AutoAwesomeIcon} color={SKY.warmPeach}>
                Inline comments attached to specific elements
              </CapabilityItem>
              <CapabilityItem icon={SecurityIcon} color={SKY.warmPeach}>
                Share with view-only or edit permissions
              </CapabilityItem>
              <CapabilityItem icon={CloudIcon} color={SKY.warmPeach}>
                Export to PNG, SVG, PDF, or JSON
              </CapabilityItem>
              <CapabilityItem icon={LayersIcon} color={SKY.warmPeach}>
                Version history to restore any previous state
              </CapabilityItem>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Developer Section - Premium with Code Preview */}
      <Box
        id="developers"
        sx={{
          mb: 16,
          position: 'relative',
        }}
      >
        {/* Section header - centered */}
        <Box sx={{ textAlign: 'center', mb: 10 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              px: 3,
              py: 1,
              borderRadius: '100px',
              background: `linear-gradient(135deg, ${SKY.deepCyan}10, ${SKY.steelBlue}10)`,
              border: `1px solid ${SKY.deepCyan}20`,
              mb: 4,
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: SKY.deepCyan }} />
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: SKY.deepCyan,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
              }}
            >
              For Developers
            </Typography>
          </Box>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: 36, md: 52 },
              fontWeight: 750,
              color: 'white',
              mb: 3,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
            }}
          >
            Technical Docs
            <Box
              component="span"
              sx={{
                display: 'block',
                background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.steelBlue})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Made Visual
            </Box>
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: { xs: 16, md: 18 },
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            Create diagrams that developers actually want to read. From system architecture
            to API docs—visualize complexity, communicate clearly.
          </Typography>
        </Box>

        {/* Two-row layout: Terminal preview + capability grid */}
        <Grid container spacing={4}>
          {/* Left - Terminal-style code preview */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                borderRadius: '16px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                overflow: 'hidden',
              }}
            >
              {/* Terminal header */}
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                    <Box key={i} sx={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                  ))}
                </Box>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                  system-architecture.json
                </Typography>
              </Box>
              {/* Code content */}
              <Box sx={{ p: 3, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>
                <Box sx={{ color: 'rgba(255,255,255,0.4)' }}>{'// Auto-generated from diagram'}</Box>
                <Box sx={{ color: SKY.mauveRose }}>{'{'}</Box>
                <Box sx={{ pl: 2 }}>
                  <Box><Box component="span" sx={{ color: SKY.deepCyan }}>"services"</Box>: {'['}</Box>
                  <Box sx={{ pl: 2 }}>
                    <Box sx={{ color: 'rgba(255,255,255,0.7)' }}>{'{ "name": "API Gateway", "port": 8080 },'}</Box>
                    <Box sx={{ color: 'rgba(255,255,255,0.7)' }}>{'{ "name": "Auth Service", "port": 8081 },'}</Box>
                    <Box sx={{ color: 'rgba(255,255,255,0.7)' }}>{'{ "name": "User Service", "port": 8082 }'}</Box>
                  </Box>
                  <Box>{'],'}</Box>
                  <Box><Box component="span" sx={{ color: SKY.deepCyan }}>"connections"</Box>: <Box component="span" sx={{ color: SKY.warmPeach }}>12</Box></Box>
                </Box>
                <Box sx={{ color: SKY.mauveRose }}>{'}'}</Box>
              </Box>
            </Box>
          </Grid>

          {/* Right - Capability grid */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 2,
              }}
            >
              {[
                { icon: SchemaIcon, label: 'UML Class Diagrams', desc: 'Full UML 2.0 support' },
                { icon: HubIcon, label: 'ERD Modeling', desc: 'Database design' },
                { icon: CategoryIcon, label: 'System Architecture', desc: 'Cloud & on-prem' },
                { icon: DeviceHubIcon, label: 'Network Topology', desc: 'Infrastructure mapping' },
                { icon: AccountTreeIcon, label: 'State Machines', desc: 'Behavioral modeling' },
                { icon: IntegrationInstructionsIcon, label: 'API Documentation', desc: 'Endpoint flows' },
              ].map((item, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 2.5,
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.015)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'all 0.25s ease',
                    cursor: 'default',
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderColor: `${SKY.deepCyan}30`,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <item.icon sx={{ color: SKY.deepCyan, fontSize: 22, mb: 1.5 }} />
                  <Typography sx={{ color: 'white', fontSize: 14, fontWeight: 600, mb: 0.5 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                    {item.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* CTA Section - Clean & Minimal */}
      <Box
        sx={{
          textAlign: 'center',
          py: { xs: 10, md: 14 },
          px: 4,
          borderRadius: '24px',
          background: `linear-gradient(135deg, ${SKY.deepCyan}06, ${SKY.deepLavender}06)`,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          position: 'relative',
        }}
      >
        {/* Simple gradient accent line at top */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '20%',
            right: '20%',
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${SKY.deepCyan}50, ${SKY.deepLavender}50, transparent)`,
          }}
        />

        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: 36, md: 56 },
            fontWeight: 750,
            color: 'white',
            mb: 3,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
          }}
        >
          Ready to
          <Box
            component="span"
            sx={{
              background: `linear-gradient(90deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {' '}Visualize?
          </Box>
        </Typography>
        <Typography
          sx={{
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: { xs: 16, md: 18 },
            mb: 6,
            maxWidth: 480,
            mx: 'auto',
            lineHeight: 1.7,
          }}
        >
          Start creating professional diagrams today. No credit card required,
          no complicated setup—just open and start diagramming.
        </Typography>

        {/* Feature checklist */}
        <Box sx={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', mb: 6 }}>
          {['Free forever plan', '50+ stencil types', 'Export to any format'].map((item, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 18, color: SKY.deepCyan }} />
              <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{item}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{
                background: `linear-gradient(135deg, ${SKY.deepCyan}, ${SKY.deepLavender})`,
                color: 'white',
                px: 5,
                py: 2,
                fontSize: 17,
                fontWeight: 600,
                borderRadius: '12px',
                textTransform: 'none',
                boxShadow: `0 8px 24px ${SKY.deepCyan}25`,
                transition: 'all 0.25s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 12px 32px ${SKY.deepCyan}35`,
                },
              }}
            >
              Get Started Free
            </Button>
          </Link>
          <Link href="/guide" style={{ textDecoration: 'none' }}>
            <Button
              variant="outlined"
              size="large"
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.15)',
                color: 'rgba(255, 255, 255, 0.8)',
                px: 4,
                py: 2,
                fontSize: 17,
                fontWeight: 500,
                borderRadius: '12px',
                textTransform: 'none',
                transition: 'all 0.25s ease',
                '&:hover': {
                  borderColor: `${SKY.deepCyan}50`,
                  background: 'rgba(79, 179, 206, 0.06)',
                },
              }}
            >
              Documentation
            </Button>
          </Link>
        </Box>
      </Box>
    </PageLayout>
  );
}
