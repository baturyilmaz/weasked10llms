import type { FC } from 'react';
import { useAppContext } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import '../styles/ThemeToggle.css';

const ThemeToggle: FC = () => {
  const { theme, toggleTheme } = useAppContext();

  return (
    <button type="button" onClick={toggleTheme} className="theme-toggle-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
};

export default ThemeToggle; 