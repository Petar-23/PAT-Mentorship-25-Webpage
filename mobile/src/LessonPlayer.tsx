import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { API_ORIGIN } from './academy';

/**
 * Bunny's signed embed runs inside a tiny host page whose origin is the PAT website,
 * so referrer rules match the web player. player.js reports when the lesson ends.
 */
export default function LessonPlayer({ url, onEnded, onError }: { url: string; onEnded: () => void; onError: () => void }) {
  const html = useMemo(() => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#07090A;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
<script src="https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js"></script></head><body>
<iframe id="p" src="${url.replace(/"/g, '&quot;')}" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen" allowfullscreen></iframe>
<script>
function send(t){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(t)}
try{var player=new playerjs.Player(document.getElementById('p'));player.on('ready',function(){send('ready');player.on('ended',function(){send('ended')})})}catch(e){}
</script></body></html>`, [url]);

  // The embed needs a moment; a spinner instead of a dead black box until the player reports in.
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(false); const t = setTimeout(() => setReady(true), 6000); return () => clearTimeout(t); }, [url]);
  function message(event: WebViewMessageEvent) {
    if (event.nativeEvent.data === 'ready') setReady(true);
    if (event.nativeEvent.data === 'ended') onEnded();
  }

  return <View style={s.box}>
    <WebView source={{ html, baseUrl: API_ORIGIN + '/' }} originWhitelist={['*']} onMessage={message}
      allowsInlineMediaPlayback allowsFullscreenVideo mediaPlaybackRequiresUserAction={false}
      allowsPictureInPictureMediaPlayback bounces={false} scrollEnabled={false}
      onError={onError} style={s.web} containerStyle={s.web}/>
    {ready ? null : <View pointerEvents="none" style={s.wait}><ActivityIndicator color="#E78370"/></View>}
  </View>;
}

const s = StyleSheet.create({
  box: { flex: 1, backgroundColor: '#07090A' },
  web: { flex: 1, backgroundColor: '#07090A' },
  wait: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07090A' },
});
