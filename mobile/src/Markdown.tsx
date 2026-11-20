import React, { type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { color, font } from './ui';

/**
 * Small Markdown renderer for lesson show notes. Mirrors what the website allows:
 * paragraphs, headings, lists, quotes, rules, code, bold, italic and links. No raw HTML.
 */
export default function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let i = 0, key = 0;
  const para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<Text key={key++} style={s.p}>{inline(para.join(' '))}</Text>);
    para.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { flush(); i++; continue; }
    if (/^```/.test(trimmed)) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) code.push(lines[i++]);
      i++;
      blocks.push(<View key={key++} style={s.codeBlock}><Text style={s.code}>{code.join('\n')}</Text></View>);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) { flush(); blocks.push(<Text key={key++} style={heading[1].length <= 3 ? s.h3 : s.h4}>{inline(heading[2])}</Text>); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flush(); blocks.push(<View key={key++} style={s.hr}/>); i++; continue; }
    if (/^>\s?/.test(trimmed)) {
      flush();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) quote.push(lines[i++].trim().replace(/^>\s?/, ''));
      blocks.push(<View key={key++} style={s.quote}><Text style={s.p}>{inline(quote.join(' '))}</Text></View>);
      continue;
    }
    if (/^([-*+]|\d+[.)])\s+/.test(trimmed)) {
      flush();
      const items: { marker: string; text: string }[] = [];
      while (i < lines.length && /^([-*+]|\d+[.)])\s+/.test(lines[i].trim())) {
        const m = /^([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i].trim())!;
        items.push({ marker: /\d/.test(m[1]) ? m[1].replace(')', '.') : '•', text: m[2] });
        i++;
      }
      blocks.push(<View key={key++} style={s.list}>{items.map((it, n) => <View key={n} style={s.li}>
        <Text style={s.marker}>{it.marker}</Text><Text style={[s.p, { flex: 1, marginBottom: 0 }]}>{inline(it.text)}</Text>
      </View>)}</View>);
      continue;
    }
    para.push(trimmed);
    i++;
  }
  flush();
  return <View>{blocks}</View>;
}

/** Inline: [label](url), **bold**, *italic* / _italic_, `code`. */
function inline(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index));
    if (m[1]) { const url = m[2]; out.push(<Text key={k++} style={s.link} onPress={() => void Linking.openURL(url)}>{m[1]}</Text>); }
    else if (m[3] || m[4]) out.push(<Text key={k++} style={s.bold}>{m[3] || m[4]}</Text>);
    else if (m[5] || m[6]) out.push(<Text key={k++} style={s.em}>{m[5] || m[6]}</Text>);
    else if (m[7]) out.push(<Text key={k++} style={s.inlineCode}>{m[7]}</Text>);
    last = re.lastIndex;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

const s = StyleSheet.create({
  p: { fontFamily: font.body, color: color.soft, fontSize: 15, lineHeight: 23, marginBottom: 12 },
  h3: { fontFamily: font.title, color: color.ink, fontSize: 19, lineHeight: 25, marginTop: 6, marginBottom: 8 },
  h4: { fontFamily: font.bold, color: color.ink, fontSize: 15.5, lineHeight: 22, marginTop: 4, marginBottom: 6 },
  bold: { fontFamily: font.bold, color: color.ink },
  em: { fontStyle: 'italic' },
  link: { color: color.accent, textDecorationLine: 'underline' },
  inlineCode: { fontFamily: font.mono, fontSize: 13, color: color.ink },
  code: { fontFamily: font.mono, fontSize: 12.5, lineHeight: 18, color: color.soft },
  codeBlock: { backgroundColor: 'rgba(0,0,0,.25)', borderRadius: 10, padding: 12, marginBottom: 12 },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginVertical: 14 },
  quote: { borderLeftWidth: 2, borderColor: color.accent, paddingLeft: 12, marginBottom: 12 },
  list: { gap: 6, marginBottom: 12 },
  li: { flexDirection: 'row', gap: 10 },
  marker: { fontFamily: font.mono, color: color.accent, fontSize: 13, lineHeight: 23, minWidth: 14 },
});
