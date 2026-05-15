import { useState, useEffect } from 'react';

const STORAGE_KEY = 'ironlab_theme';

export const THEME_OPTIONS = [
  {
    id: 'dark',
    name: 'Dark',
    bg: '#0a0908',
    card: '#1c1917',
    border: '#292524',
    accent: '#ed7a2a',  /* orange */
    textOnAccent: '#0a0908',
  },
  {
    id: 'neutral',
    name: 'Neutral',
    bg: '#f8fafc',
    card: '#e2e8f0',
    border: '#cbd5e1',
    accent: '#0ea5e9',  /* sky-blue */
    textOnAccent: '#ffffff',
  },
  {
    id: 'rose',
    name: 'Rose',
    bg: '#fdf2f8',
    card: '#fce7f3',
    border: '#fbcfe8',
    accent: '#ec4899',  /* pink-500 */
    textOnAccent: '#ffffff',
  },
];

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// Apply saved theme immediately (before React renders) to prevent flash.
applyTheme(localStorage.getItem(STORAGE_KEY) || 'dark');

export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'dark');

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme: setThemeState, themes: THEME_OPTIONS };
}
