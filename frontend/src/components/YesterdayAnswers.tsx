import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import '../styles/YesterdayAnswers.css';
import { fetchYesterdaysPuzzle } from '../utils/api';
import type { ApiAnswer } from '../utils/api';
import { formatDate } from '../utils/dateUtils'; // Create this utility

// YesterdayAnswers component
const YesterdayAnswers: FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<string>('');
  const [answers, setAnswers] = useState<ApiAnswer[]>([]);
  const [puzzleDate, setPuzzleDate] = useState<string>('');

  useEffect(() => {
    const loadYesterdaysPuzzle = async () => {
      try {
        setIsLoading(true);
        const data = await fetchYesterdaysPuzzle();
        
        setQuestion(data.question);
        // Sort answers by points (descending)
        setAnswers([...data.answers].sort((a, b) => b.points - a.points));
        
        // Format the date
        const date = new Date(data.date);
        setPuzzleDate(formatDate(date));
      } catch (err) {
        console.error('Failed to load yesterday\'s puzzle:', err);
        setError('Could not load yesterday\'s puzzle. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadYesterdaysPuzzle();
  }, []);

  if (isLoading) {
    return (
      <div className="yesterday-container">
        <Link to="/" className="back-link">← Back to Today's Puzzle</Link>
        <h1 className="yesterday-title">Yesterday's Answers</h1>
        <div className="loading-indicator">Loading yesterday's puzzle...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="yesterday-container">
        <Link to="/" className="back-link">← Back to Today's Puzzle</Link>
        <h1 className="yesterday-title">Yesterday's Answers</h1>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="yesterday-container">
      <Link to="/" className="back-link">← Back to Today's Puzzle</Link>
      <h1 className="yesterday-title">Yesterday's Answers</h1>
      {puzzleDate && <div className="yesterday-date">{puzzleDate}</div>}
      <h2 className="yesterday-question">{question}</h2>
      <div className="answers-list-box">
        <ul className="answers-list">
          {answers.map((item) => (
            <li key={item.answer} className="answer-list-item">
              <span className="answer-list-text">{item.answer}</span>
              <span className="answer-list-points">{item.points} pts</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default YesterdayAnswers; 