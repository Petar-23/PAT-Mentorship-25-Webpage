import React, { useEffect, useRef } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';

export type PlayerProps = {
  uri: string;
  title: string;
  initialTime: number;
  onPosition: (seconds: number) => void;
  onEnd: () => void;
  onError: () => void;
};

export default function Player(props: PlayerProps) {
  const callbacks = useRef(props);
  useEffect(() => { callbacks.current = props; }, [props]);
  const player = useVideoPlayer(props.uri, (instance) => {
    instance.timeUpdateEventInterval = 1;
  });

  useEffect(() => {
    let started = false;
    function start() {
      if (started) return;
      started = true;
      const resume = callbacks.current.initialTime;
      if (resume > 0) player.seekBy(resume - player.currentTime);
      player.play();
    }
    const status = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') start();
      if (status === 'error') callbacks.current.onError();
    });
    const position = player.addListener('timeUpdate', ({ currentTime }) => {
      if (started) callbacks.current.onPosition(currentTime);
    });
    const ended = player.addListener('playToEnd', () => callbacks.current.onEnd());
    if (player.status === 'readyToPlay') start();
    if (player.status === 'error') callbacks.current.onError();
    return () => { status.remove(); position.remove(); ended.remove(); };
  }, [player]);

  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain"
    nativeControls fullscreenOptions={{ enable: true, orientation: 'landscape' }} accessibilityLabel={props.title} />;
}
