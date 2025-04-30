import type { ReactNode, FC } from 'react';
import { createContext, useState, useEffect, useContext } from 'react';

interface AppContextType {
  theme: string;
  toggleTheme: () => void;
  isMuted: boolean;
  toggleMute: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: FC<AppProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<string>(() => {
    const savedTheme = localStorage.getItem('theme');
    // Check system preference if no saved theme
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return savedTheme ?? (prefersDark ? 'dark' : 'light');
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('isMuted') === 'true';
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    // Don't save initial theme derived from system preference to localStorage
    // Only save explicit user toggles (handled in toggleTheme)

    // Listener for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only change theme automatically if the user hasn't explicitly set one
      if (localStorage.getItem('theme') === null) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    try {
      mediaQuery.addEventListener('change', handleChange);
    } catch {
      // Safari < 14 compatibility
      mediaQuery.addListener(handleChange);
    }

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleChange);
      } catch {
        // Safari < 14 compatibility
        mediaQuery.removeListener(handleChange);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]); // Rerun effect if theme changes externally (e.g., localStorage sync)

  useEffect(() => {
    localStorage.setItem('isMuted', String(isMuted));
  }, [isMuted]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    // Explicitly save user choice to override system preference
    localStorage.setItem('theme', newTheme);
  };

  const toggleMute = () => {
    setIsMuted(prevMuted => {
      const newMutedState = !prevMuted;
      localStorage.setItem('isMuted', String(newMutedState));
      return newMutedState;
    });
  };

  return (
    <AppContext.Provider value={{ theme, toggleTheme, isMuted, toggleMute }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}; 