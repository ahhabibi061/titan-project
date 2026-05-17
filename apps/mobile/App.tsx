import React, { useCallback } from 'react';
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

import AppNavigator from './src/navigation/AppNavigator';
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

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: COLORS.bg }} onLayout={onLayoutRootView}>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}
