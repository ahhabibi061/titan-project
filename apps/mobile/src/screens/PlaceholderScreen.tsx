import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

interface Props { name: string; }

export default function PlaceholderScreen({ name }: Props) {
  return (
    <View style={s.root}>
      <Text style={s.title}>{name}</Text>
      <Text style={s.sub}>Coming soon</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.anton, fontSize: 36, color: COLORS.text100, textTransform: 'uppercase', letterSpacing: 1 },
  sub:   { fontFamily: FONTS.mono,  fontSize: 12, color: COLORS.text600, textTransform: 'uppercase', letterSpacing: 2, marginTop: 8 },
});
