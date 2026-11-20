import React from 'react';
import type { PlayerProps } from './Player';

export default function Player({ uri, title, initialTime, onPosition, onEnd, onError }: PlayerProps) {
  return <video src={uri} aria-label={title} controls playsInline autoPlay preload="auto"
    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#090c0d', display: 'block' }}
    onLoadedMetadata={(event) => { event.currentTarget.currentTime = initialTime; }}
    onTimeUpdate={(event) => { if (!event.currentTarget.ended) onPosition(event.currentTarget.currentTime); }}
    onEnded={onEnd} onError={onError} />;
}
