import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
} from '@expo-google-fonts/manrope';
import { Session } from '@supabase/supabase-js';

import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import { supabase } from './src/lib/supabase';
import { COLORS } from './src/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Anton_400Regular,
    JetBrainsMono_400Regular,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
  });

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if ((fontsLoaded || fontError) && authReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, authReady]);

  if ((!fontsLoaded && !fontError) || !authReady) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: COLORS.bg }} onLayout={onLayoutRootView}>
        <NavigationContainer>
          {session ? <AppNavigator /> : <AuthScreen />}
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}
