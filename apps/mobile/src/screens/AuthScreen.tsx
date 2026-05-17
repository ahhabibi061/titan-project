import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { COLORS, FONTS } from '../constants/theme';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const [mode, setMode]         = useState<Mode>('signin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleEmail() {
    if (!email || !password) { Alert.alert('Fill in email and password'); return; }
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) Alert.alert('Error', error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) Alert.alert('Error', error.message);
      else if (!data.session) Alert.alert('Check your email', 'Confirm your account then sign in.');
      // if session exists, onAuthStateChange handles the redirect automatically
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const redirectUrl = Linking.createURL('/auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) { setLoading(false); Alert.alert('Error', error?.message ?? 'Could not start Google sign-in'); return; }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type === 'success') {
      const url    = result.url;
      const parsed = Linking.parse(url);
      const access  = parsed.queryParams?.access_token as string | undefined;
      const refresh = parsed.queryParams?.refresh_token as string | undefined;
      if (access && refresh) {
        await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
      }
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.triangle} />
          <Text style={s.brand}>IRONLAB</Text>
          <Text style={s.tagline}>BUILT IN THE DARK</Text>
        </View>

        {/* Mode toggle */}
        <View style={s.toggle}>
          <TouchableOpacity style={[s.toggleBtn, mode === 'signin' && s.toggleActive]} onPress={() => setMode('signin')}>
            <Text style={[s.toggleText, mode === 'signin' && s.toggleTextActive]}>SIGN IN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.toggleBtn, mode === 'signup' && s.toggleActive]} onPress={() => setMode('signup')}>
            <Text style={[s.toggleText, mode === 'signup' && s.toggleTextActive]}>CREATE ACCOUNT</Text>
          </TouchableOpacity>
        </View>

        {/* Email / password */}
        <View style={s.form}>
          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor={COLORS.text600}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor={COLORS.text600}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
          <TouchableOpacity style={s.primaryBtn} onPress={handleEmail} disabled={loading}>
            {loading
              ? <ActivityIndicator color={COLORS.bg} />
              : <Text style={s.primaryBtnText}>{mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}</Text>}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>OR</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Google */}
        <TouchableOpacity style={s.googleBtn} onPress={handleGoogle} disabled={loading}>
          <Ionicons name="logo-google" size={18} color={COLORS.text100} />
          <Text style={s.googleBtnText}>CONTINUE WITH GOOGLE</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: COLORS.bg },
  scroll:           { flexGrow: 1, padding: 24, justifyContent: 'center' },

  logoWrap:         { alignItems: 'center', marginBottom: 48 },
  triangle:         { width: 0, height: 0, borderLeftWidth: 22, borderRightWidth: 22, borderBottomWidth: 38, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: COLORS.accent, marginBottom: 12 },
  brand:            { fontFamily: FONTS.anton, fontSize: 36, color: COLORS.text100, letterSpacing: 4 },
  tagline:          { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, letterSpacing: 3, marginTop: 4 },

  toggle:           { flexDirection: 'row', borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  toggleBtn:        { flex: 1, paddingVertical: 10, alignItems: 'center' },
  toggleActive:     { backgroundColor: COLORS.accent },
  toggleText:       { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.text500, letterSpacing: 1 },
  toggleTextActive: { color: COLORS.bg },

  form:             { gap: 12 },
  input:            { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.border, padding: 14, color: COLORS.text100, fontFamily: FONTS.sans, fontSize: 15 },
  primaryBtn:       { backgroundColor: COLORS.accent, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  primaryBtnText:   { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.bg, letterSpacing: 2 },

  divider:          { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
  dividerLine:      { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText:      { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.text600, letterSpacing: 2 },

  googleBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 14 },
  googleBtnText:    { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.text100, letterSpacing: 1.5 },
});
