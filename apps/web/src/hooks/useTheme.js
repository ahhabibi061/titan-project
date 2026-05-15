import { useState, useEffect } from 'react';

const STORAGE_KEY = 'ironlab_theme';

export const THEME_OPTIONS = [
  {
    id: 'dark',
    name: 'Dark',
    bg: '#0a0908',
    card: '#1c1917',
    border: '#292524',
  },
  {
    id: 'neutral',
    name: 'Neutral',
    bg: '#0d1117',
    card: '#161b22',
    border: '#30363d',
  },
  {
    id: 'rose',
    name: 'Rose',
    bg: '#0e0a1a',
    card: '#1a1228',
    border: '#3d2d5c',
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
