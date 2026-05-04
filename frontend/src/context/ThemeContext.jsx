import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const COLOR_THEMES = [
  { id: 'teal',     label: 'Teal',     swatch: '#00b894', desc: 'Default brand — fresh and balanced' },
  { id: 'sunset',   label: 'Sunset',   swatch: '#f4552c', desc: 'Warm orange — bold and energetic' },
  { id: 'midnight', label: 'Midnight', swatch: '#634fea', desc: 'Deep indigo — focused and calm' },
  { id: 'rose',     label: 'Rose',     swatch: '#e83e8c', desc: 'Vibrant pink — playful and modern' },
];

export function ThemeProvider({ children }) {
  // Dark mode
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    return stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Color theme variant
  const [colorTheme, setColorTheme] = useState(() => {
    const stored = localStorage.getItem('colorTheme');
    return COLOR_THEMES.some((t) => t.id === stored) ? stored : 'teal';
  });

  // Apply dark class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Apply color theme class — remove all theme-* classes, add the active one
  useEffect(() => {
    const html = document.documentElement;
    for (const t of COLOR_THEMES) html.classList.remove(`theme-${t.id}`);
    html.classList.add(`theme-${colorTheme}`);
    localStorage.setItem('colorTheme', colorTheme);
  }, [colorTheme]);

  const toggle = () => setDark((d) => !d);

  return (
    <ThemeContext.Provider value={{ dark, toggle, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
