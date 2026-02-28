'use client';

import { useRef, useState } from 'react';
import type { ThemeColors } from '../types';
import {
  AlertTriangle,
  TrendingUp,
  Minus,
  Swords,
  Mountain,
  Cable,
  Shield,
  Radiation,
  Ship,
  Plane,
  Users,
  Building2,
  Globe2,
  BarChart3,
  Flame,
  Activity,
} from 'lucide-react';

type AnimStyle = 'pulse' | 'shake' | 'bounce' | 'none';

interface AnimatedIconProps {
  icon: string;
  size?: number;
  color?: string;
  animation?: AnimStyle;
  strokeWidth?: number;
}

const ICON_MAP: Record<string, typeof AlertTriangle> = {
  'alert-triangle': AlertTriangle,
  'trending-up': TrendingUp,
  'minus': Minus,
  'swords': Swords,
  'mountain': Mountain,
  'cable': Cable,
  'shield': Shield,
  'radiation': Radiation,
  'ship': Ship,
  'plane': Plane,
  'users': Users,
  'building': Building2,
  'globe': Globe2,
  'bar-chart': BarChart3,
  'flame': Flame,
  'activity': Activity,
};

export function AnimatedIcon({ icon, size = 14, color, animation = 'none', strokeWidth = 2 }: AnimatedIconProps) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const IconComponent = ICON_MAP[icon] || Activity;

  const animClass =
    animation === 'pulse' ? 'ww-icon-pulse' :
    animation === 'shake' ? 'ww-icon-shake' :
    animation === 'bounce' ? 'ww-icon-bounce' :
    '';

  return (
    <span
      ref={ref}
      className={hovered ? animClass : ''}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default' }}
    >
      <IconComponent size={size} color={color} strokeWidth={strokeWidth} />
    </span>
  );
}

// Impact icon specifically for EconCalendar
export function ImpactIcon({ impact, theme }: { impact: number; theme: ThemeColors }) {
  if (impact === 3) return <AnimatedIcon icon="alert-triangle" size={14} color={theme.red} animation="pulse" strokeWidth={2.5} />;
  if (impact === 2) return <AnimatedIcon icon="trending-up" size={14} color={theme.peach} animation="bounce" strokeWidth={2} />;
  return <AnimatedIcon icon="minus" size={14} color={theme.overlay0} />;
}

// Layer icons for LayerPanel
export function LayerIcon({ layerId, theme }: { layerId: string; theme: ThemeColors }) {
  const map: Record<string, { icon: string; color: string }> = {
    'conflicts': { icon: 'swords', color: theme.red },
    'disasters': { icon: 'flame', color: theme.peach },
    'cables': { icon: 'cable', color: theme.blue },
    'military': { icon: 'shield', color: theme.mauve },
    'nuclear': { icon: 'radiation', color: theme.yellow },
    'ships': { icon: 'ship', color: theme.teal },
    'aircraft': { icon: 'plane', color: theme.blue },
    'protests': { icon: 'users', color: theme.peach },
    'infrastructure': { icon: 'building', color: theme.green },
  };
  const entry = map[layerId] || { icon: 'globe', color: theme.text };
  return <AnimatedIcon icon={entry.icon} size={14} color={entry.color} animation="bounce" />;
}

// Category icons for EventCard
export function CategoryIcon({ category, theme }: { category: string; theme: ThemeColors }) {
  const map: Record<string, { icon: string; color: string }> = {
    'conflict': { icon: 'swords', color: theme.red },
    'economic': { icon: 'bar-chart', color: theme.blue },
    'natural-disaster': { icon: 'mountain', color: theme.peach },
    'political': { icon: 'globe', color: theme.mauve },
    'health': { icon: 'activity', color: theme.green },
  };
  const entry = map[category] || { icon: 'globe', color: theme.text };
  return <AnimatedIcon icon={entry.icon} size={13} color={entry.color} animation="bounce" />;
}
