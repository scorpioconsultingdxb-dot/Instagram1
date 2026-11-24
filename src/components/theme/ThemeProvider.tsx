'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type AccentPreset = 'violet' | 'cyan' | 'emerald' | 'indigo';

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  accent: AccentPreset;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  setAccent: (accent: AccentPreset) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'viewora_theme';
const ACCENT_KEY = 'viewora_accent';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function applyAccentAttr(accent: AccentPreset) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-accent', accent);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [accent, setAccentState] = useState<AccentPreset>('violet');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const initial: ThemePreference =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    const resolved = initial === 'system' ? getSystemTheme() : initial;
    setThemeState(initial);
    setResolvedTheme(resolved);
    applyThemeClass(resolved);

    const storedAccent = window.localStorage.getItem(ACCENT_KEY) as AccentPreset | null;
    if (
      storedAccent === 'violet' ||
      storedAccent === 'cyan' ||
      storedAccent === 'emerald' ||
      storedAccent === 'indigo'
    ) {
      setAccentState(storedAccent);
      applyAccentAttr(storedAccent);
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      const current = (window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? 'system';
      if (current === 'system') {
        const next = media.matches ? 'dark' : 'light';
        setResolvedTheme(next);
        applyThemeClass(next);
      }
    };

    media.addEventListener('change', handleMediaChange);
    return () => media.removeEventListener('change', handleMediaChange);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    const resolved = next === 'system' ? getSystemTheme() : next;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemePreference = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  const setAccent = useCallback((next: AccentPreset) => {
    setAccentState(next);
    window.localStorage.setItem(ACCENT_KEY, next);
    applyAccentAttr(next);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, accent, setTheme, toggleTheme, setAccent }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
