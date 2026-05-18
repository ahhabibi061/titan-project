import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../constants/theme';
import DashboardScreen from '../screens/DashboardScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import ForgeScreen from '../screens/ForgeScreen';
import SessionReviewScreen from '../screens/SessionReviewScreen';
import VaultScreen from '../screens/VaultScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TABS = [
  { name: 'Home',     label: 'Home',     icon: 'home',         Screen: () => <DashboardScreen /> },
  { name: 'Forge',    label: 'Forge',    icon: 'barbell',      Screen: () => <ForgeScreen /> },
  { name: 'Sentinel', label: 'Sentinel', icon: 'eye',          Screen: () => <PlaceholderScreen name="Sentinel" /> },
  { name: 'Vault',    label: 'Vault',    icon: 'lock-closed',  Screen: () => <VaultScreen /> },
  { name: 'Oracle',   label: 'Oracle',   icon: 'sparkles',     Screen: () => <PlaceholderScreen name="Oracle" /> },
] as const;

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0c0b0a',
          borderTopColor:  COLORS.border,
          borderTopWidth:  1,
          height:          52 + insets.bottom,
          paddingBottom:   insets.bottom,
          paddingTop:      8,
        },
        tabBarActiveTintColor:   COLORS.accent,
        tabBarInactiveTintColor: COLORS.text600,
        tabBarLabelStyle: {
          fontFamily:    FONTS.mono,
          fontSize:      9,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginTop:     2,
        },
        tabBarIcon: ({ color }) => {
          const tab = TABS.find(t => t.name === route.name);
          return <Ionicons name={tab?.icon as any} size={20} color={color} />;
        },
      })}
    >
      {TABS.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.Screen}
          options={{ title: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"          component={TabNavigator} />
      <Stack.Screen name="SessionReview" component={SessionReviewScreen} />
    </Stack.Navigator>
  );
}
