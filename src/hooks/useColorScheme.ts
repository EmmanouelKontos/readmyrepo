import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'color-scheme';

function getMeta(): HTMLMetaElement | null {
  return document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
}

function resolveIsDark(): boolean {
  const content = getMeta()?.content ?? 'light dark';
  if (content === 'dark') return true;
  if (content === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Briefly enables colour transitions on every element so the theme flip cross-fades. */
function withThemeTransition(apply: () => void) {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) root.classList.add('theme-transition');
  apply();
  if (!reduce) window.setTimeout(() => root.classList.remove('theme-transition'), 260);
}

export function useColorScheme() {
  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark());

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setIsDark(resolveIsDark());
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const meta = getMeta();
      if (meta) meta.content = e.newValue ?? 'light dark';
      sync();
    };
    mq.addEventListener('change', sync);
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggle = useCallback(() => {
    const target = resolveIsDark() ? 'light' : 'dark';
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    withThemeTransition(() => {
      const meta = getMeta();
      try {
        if (target === system) {
          localStorage.removeItem(STORAGE_KEY);
          if (meta) meta.content = 'light dark';
        } else {
          localStorage.setItem(STORAGE_KEY, target);
          if (meta) meta.content = target;
        }
      } catch {
        if (meta) meta.content = target;
      }
    });
    setIsDark(target === 'dark');
  }, []);

  return { isDark, toggle };
}
