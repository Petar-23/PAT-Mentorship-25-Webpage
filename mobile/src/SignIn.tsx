import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { isClerkAPIResponseError } from '@clerk/expo';
import { useSignIn } from '@clerk/expo/legacy';
import type { EmailCodeFactor } from '@clerk/expo/types';
import { Glass, GlassButton, Symbol, tick } from './glass';
import { API_ORIGIN } from './academy';
import { color, font } from './ui';

type Step = 'email' | 'code';

function message(error: unknown) {
  if (isClerkAPIResponseError(error)) {
    const code = error.errors[0]?.code;
    if (code === 'form_identifier_not_found') return 'Zu dieser E-Mail gibt es noch kein PAT-Konto. Prüfe die Adresse oder registriere dich auf der Website.';
    if (code === 'form_code_incorrect') return 'Der Code stimmt nicht. Prüfe die Ziffern und versuche es erneut.';
    if (code === 'verification_expired') return 'Der Code ist abgelaufen. Fordere einen neuen an.';
    if (code === 'too_many_requests') return 'Zu viele Versuche. Warte kurz und probiere es dann erneut.';
    return error.errors[0]?.longMessage || error.errors[0]?.message || 'Die Anmeldung hat nicht geklappt.';
  }
  return 'Keine Verbindung zum PAT-Konto. Prüfe dein Internet und versuche es erneut.';
}

export default function SignInScreen() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const codeInput = useRef<React.ComponentRef<typeof TextInput>>(null);

  async function sendCode() {
    if (!isLoaded || busy) return;
    const identifier = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(identifier)) { setError('Bitte gib deine E-Mail-Adresse ein.'); return; }
    setBusy(true); setError('');
    try {
      const attempt = await signIn.create({ identifier });
      const factor = attempt.supportedFirstFactors?.find((f): f is EmailCodeFactor => f.strategy === 'email_code');
      if (!factor) throw new Error('no-email-code');
      await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
      setStep('code'); setCode('');
      setTimeout(() => codeInput.current?.focus(), 350);
    } catch (e) {
      setError(e instanceof Error && e.message === 'no-email-code' ? 'Für dieses Konto ist kein E-Mail-Code aktiviert.' : message(e));
    } finally { setBusy(false); }
  }

  async function verify(value = code) {
    if (!isLoaded || busy || value.length < 6) return;
    setBusy(true); setError('');
    try {
      const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code: value });
      if (result.status === 'complete') await setActive({ session: result.createdSessionId });
      else setError('Für dieses Konto ist ein weiterer Anmeldeschritt nötig. Melde dich bitte vorerst über die Website an.');
    } catch (e) {
      setError(message(e)); setCode('');
    } finally { setBusy(false); }
  }

  return <View style={s.root}>
    <Image source={require('../assets/art/fvg-cover.jpg')} alt="" accessible={false} resizeMode="cover" style={s.art}/>
    <LinearGradient colors={['rgba(13,17,19,.2)', 'rgba(13,17,19,.85)', color.page]} locations={[0, .42, .62]} style={StyleSheet.absoluteFill}/>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={s.brand}>
          <Text style={s.monogram}>PAT</Text>
          <View style={s.divider}/>
          <Text style={s.brandName}>{'PRICE ACTION\nTRADER'}</Text>
        </View>
        <View style={{ flex: 1 }}/>
        <Text style={s.kicker}>Mentorship</Text>
        <Text accessibilityRole="header" style={s.title}>{step === 'email' ? 'Willkommen\nzurück.' : 'Code\neingeben.'}</Text>
        <Text style={s.lead}>{step === 'email' ? 'Melde dich mit der E-Mail-Adresse deines PAT-Kontos an. Wir schicken dir einen Code.' :
          'Wir haben einen 6-stelligen Code an ' + email.trim() + ' geschickt.'}</Text>

        {step === 'email' ? <Glass style={s.field}>
          <Symbol name="envelope" size={17} tint={color.muted}/>
          <TextInput value={email} onChangeText={setEmail} placeholder="name@beispiel.de" placeholderTextColor="#7E8584"
            autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" autoCorrect={false}
            returnKeyType="send" onSubmitEditing={sendCode} style={s.input} accessibilityLabel="E-Mail-Adresse" editable={!busy}/>
        </Glass> :
          <Pressable onPress={() => codeInput.current?.focus()} style={s.codeRow} accessibilityLabel="Bestätigungscode">
            {Array.from({ length: 6 }, (_, i) => <Glass key={i} style={[s.digit, code.length === i && s.digitActive]}>
              <Text style={s.digitText}>{code[i] ?? ''}</Text>
            </Glass>)}
            <TextInput ref={codeInput} value={code} maxLength={6} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"
              onChangeText={v => { const d = v.replace(/\D/g, '').slice(0, 6); setCode(d); if (d.length === 6) void verify(d); }}
              style={s.hiddenInput} caretHidden accessibilityLabel="Bestätigungscode eingeben"/>
          </Pressable>}

        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}

        <View style={s.actions}>
          {busy ? <View style={s.busy}><ActivityIndicator color={color.accent}/></View> :
            <GlassButton prominent symbol={step === 'email' ? 'arrow.right' : 'checkmark'} label={step === 'email' ? 'Code senden' : 'Anmelden'}
              onPress={step === 'email' ? sendCode : () => void verify()} disabled={step === 'code' && code.length < 6}/>}
        </View>
        {step === 'code' ? <View style={s.links}>
          <GlassButton plain symbol="arrow.clockwise" label="Code erneut senden" disabled={busy} onPress={() => void sendCode()}/>
          <GlassButton plain symbol="envelope" label="Andere E-Mail" onPress={() => { setStep('email'); setError(''); }}/>
        </View> : <View style={s.signup}>
          <Text style={s.linkMuted}>Noch kein Konto?</Text>
          <GlassButton plain symbol="safari" label="Auf der Website registrieren" onPress={() => void Linking.openURL(API_ORIGIN + '/sign-up')}/>
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.page },
  art: { position: 'absolute', top: 0, left: 0, width: '100%', height: '58%' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 70, paddingBottom: 34 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  monogram: { fontFamily: font.title, fontSize: 30, letterSpacing: -1.6, color: color.ink },
  divider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,.35)' },
  brandName: { fontFamily: font.bold, fontSize: 9.5, letterSpacing: 1.5, color: color.soft, lineHeight: 12.5 },
  kicker: { fontFamily: font.bold, color: color.accent, fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase', marginTop: 40 },
  title: { fontFamily: font.title, color: color.ink, fontSize: 46, lineHeight: 50, letterSpacing: -1.8, marginTop: 8 },
  lead: { fontFamily: font.body, color: color.soft, fontSize: 16, lineHeight: 23, marginTop: 12, marginBottom: 24 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, minHeight: 56, borderRadius: 18 },
  input: { flex: 1, color: color.ink, fontFamily: font.body, fontSize: 17, paddingVertical: 14 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  digit: { flex: 1, aspectRatio: .82, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  digitActive: { borderWidth: 1.5, borderColor: color.accent },
  digitText: { fontFamily: font.title, color: color.ink, fontSize: 28, fontVariant: ['tabular-nums'] },
  hiddenInput: { position: 'absolute', opacity: 0.01, width: 1, height: 1 },
  error: { fontFamily: font.body, color: '#F1AA96', fontSize: 14, lineHeight: 20, marginTop: 14 },
  actions: { flexDirection: 'row', marginTop: 22 },
  busy: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 4 },
  signup: { marginTop: 20, alignItems: 'center' },
  link: { fontFamily: font.bold, color: color.accent, fontSize: 15 },
  linkMuted: { fontFamily: font.body, color: color.muted, fontSize: 15 },
});
