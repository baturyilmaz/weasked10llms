import './App.css'
import LLMPuzzleGame from './components/LLMPuzzleGame'
import ThemeToggle from './components/ThemeToggle'
import MuteToggle from './components/MuteToggle'
import { useAppContext } from './contexts/ThemeContext'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import YesterdayAnswers from './components/YesterdayAnswers';
import { Toaster } from 'react-hot-toast';

function App() {
  const { isMuted, toggleMute } = useAppContext();

  return (
    <BrowserRouter>
      <div className="app">
        <Toaster 
          position="top-center"
          reverseOrder={false}
          toastOptions={{
            className: '',
            duration: 3000,
            style: {
              background: 'var(--color-bg-panel)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-panel)',
              boxShadow: 'var(--shadow-glow)'
            },
            success: {
              duration: 2000,
              style: {
                background: 'var(--color-feedback-filled)',
                color: '#FFF',
                border: '1px solid var(--color-feedback-filled)',
              },
              iconTheme: {
                primary: '#FFF',
                secondary: 'var(--color-feedback-filled)',
              },
            },
            error: {
              style: {
                background: '#EF4444',
                color: '#FFF',
                border: '1px solid #EF4444',
              },
               iconTheme: {
                primary: '#FFF',
                secondary: '#EF4444',
              },
            },
          }}
        />
        <div className="app-header">
          <Link to="/yesterday" className="nav-link">Yesterday</Link>
          <MuteToggle isMuted={isMuted} toggleMute={toggleMute} />
          <ThemeToggle />
        </div>
        <Routes>
          <Route path="/" element={
            <>
              <h1 className="app-title">
                WE ASKED 10 LLMs
              </h1>
              <LLMPuzzleGame />
            </>
          } />
          <Route path="/yesterday" element={<YesterdayAnswers />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
