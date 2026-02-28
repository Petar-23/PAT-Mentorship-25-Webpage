'use client';

import type { DataLayer, ThemeColors } from '../types';

interface Props {
  layers: DataLayer[];
  onToggle: (id: string) => void;
  theme: ThemeColors;
  onClose: () => void;
}

export function LayerPanel({ layers, onToggle, theme, onClose }: Props) {
  return (
    <div style={{
      position: 'absolute',
      top: 52,
      right: 368,
      width: 240,
      background: theme.mantle,
      border: `1px solid ${theme.surface0}`,
      zIndex: 200,
      boxShadow: `0 8px 32px ${theme.crust}cc`,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.surface0}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.subtext0, letterSpacing: '2px' }}>
          DATA LAYERS
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: theme.overlay0,
            cursor: 'pointer',
            fontSize: 14,
            padding: '0 2px',
            fontFamily: 'inherit',
          }}
        >✕</button>
      </div>

      {/* Layers */}
      <div style={{ padding: '4px 0' }}>
        {layers.map(layer => (
          <div
            key={layer.id}
            onClick={() => onToggle(layer.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              cursor: 'pointer',
              gap: 10,
              borderBottom: `1px solid ${theme.surface0}22`,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = theme.surface0 + '44'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
          >
            {/* Toggle indicator */}
            <div style={{
              width: 14,
              height: 14,
              border: `1px solid ${layer.enabled ? layer.color : theme.overlay0}`,
              background: layer.enabled ? layer.color + '33' : 'transparent',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {layer.enabled && (
                <span style={{ fontSize: 9, color: layer.color }}>✓</span>
              )}
            </div>

            {/* Color dot */}
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: layer.enabled ? layer.color : theme.overlay0,
              flexShrink: 0,
            }} />

            {/* Icon + Name */}
            <div>
              <span style={{ fontSize: 12, marginRight: 6 }}>{layer.icon}</span>
              <span style={{
                fontSize: 11,
                color: layer.enabled ? theme.text : theme.overlay0,
                letterSpacing: '0.3px',
              }}>
                {layer.name}
              </span>
            </div>

            {/* Count */}
            <span style={{
              marginLeft: 'auto',
              fontSize: 9,
              color: theme.overlay0,
              letterSpacing: '0.5px',
            }}>
              {layer.type === 'points'
                ? `${(layer.points?.length || 0)} pts`
                : `${(layer.arcs?.length || 0)} arcs`}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        padding: '6px 12px',
        borderTop: `1px solid ${theme.surface0}`,
        fontSize: 9,
        color: theme.overlay0,
        letterSpacing: '0.5px',
      }}>
        Click to toggle layer visibility
      </div>
    </div>
  );
}
