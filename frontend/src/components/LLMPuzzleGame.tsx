import { useState, useEffect, useRef, useMemo } from 'react';
import { Copy, X } from 'lucide-react'; // Removed Triangle import
// import { Share2 } from 'lucide-react'; // Keep for potential future use
import '../styles/LLMPuzzleGame.css';
import { playSound } from '../utils/soundPlayer'; // Import the new sound player
import { useAppContext } from '../contexts/ThemeContext'; // Import useAppContext
import toast from 'react-hot-toast'; // Import toast
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { fetchTodaysPuzzle, checkAnswer } from '../utils/api'; // Import API functions

interface Guess {
  id: string; // Add unique ID
  text: string;
  points: number;
  isValid: boolean;
  allMatchedPositions: boolean[]; // Keep track of grid state at the time of guess
}

// This interface matches the backend model but is not used directly in the component
// Keeping it for reference and potential future use
// interface Answer {
//   answer: string;
//   points: number;
// }

interface StoredGameData {
  played: boolean;
  score: number;
  totalPossible: number;
  grid: boolean[];
  guesses: Guess[]; // Add guesses here
  puzzleId: string; // Add puzzleId to stored data
  question: string; // Add question to stored data
}

const INITIAL_INCORRECT_GUESSES = 3;

// Helper to format date
const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
};

// Not using simpleHash anymore since we get puzzleId from API
// Removed simpleHash function

const LLMPuzzleGame = () => {
  const currentDate = formatDate(new Date()); // Get current date
  
  // State variables for API data
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [puzzleId, setPuzzleId] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  // answerCount is used when initializing matchedPositions
  
  // State variables for game
  const [currentGuess, setCurrentGuess] = useState("");
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [errorGuessesLeft, setErrorGuessesLeft] = useState(INITIAL_INCORRECT_GUESSES);
  const [gameEnded, setGameEnded] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalPossiblePoints, setTotalPossiblePoints] = useState(100); // Default
  const [matchedPositions, setMatchedPositions] = useState<boolean[]>([]);
  const [animateMistakeIndex, setAnimateMistakeIndex] = useState<number | null>(null);
  const [hasPlayed, setHasPlayed] = useState<boolean>(false);
  const [storedGameData, setStoredGameData] = useState<StoredGameData | null>(null);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false); // Add state for answer checking
  
  const guessesContainerRef = useRef<HTMLDivElement>(null);
  
  // Get mute state from context
  const { isMuted } = useAppContext();

  // Create stable mistake placeholder IDs
  const mistakePlaceholderIds = useMemo(() => 
    Array.from({ length: INITIAL_INCORRECT_GUESSES }, (_, i) => `mistake-${i}-${Date.now()}`),
  []);
  
  // Setup a ref to track when guesses change
  const guessesLengthRef = useRef(0);
  
  // Fetch today's puzzle on mount
  useEffect(() => {
    const loadPuzzle = async () => {
      try {
        setIsLoading(true);
        const puzzleData = await fetchTodaysPuzzle();
        setPuzzleId(puzzleData.puzzleId);
        setQuestion(puzzleData.question);
        
        // Initialize matched positions array based on answer count
        setMatchedPositions(Array(puzzleData.answerCount).fill(false));
        
        // Check localStorage for saved game with this puzzleId
        try {
          const storedDataString = localStorage.getItem(puzzleData.puzzleId);
          if (storedDataString) {
            const storedData: StoredGameData = JSON.parse(storedDataString);
            if (storedData.played) {
              setStoredGameData(storedData);
              setHasPlayed(true);
              setGameEnded(true); // Mark game as ended if already played
              // Set state based on stored data for display purposes
              setTotalPoints(storedData.score);
              setMatchedPositions(storedData.grid);
              setGuesses(storedData.guesses || []); // Load stored guesses, default to empty array if missing
              setTotalPossiblePoints(storedData.totalPossible);
            }
          }
        } catch (localStorageError) {
          console.error("Failed to read from local storage:", localStorageError);
        }
        
      } catch (fetchError) {
        console.error("Failed to fetch puzzle:", fetchError);
        setError("Failed to load today's puzzle. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPuzzle();
  }, []);
  
  // Effect to save to local storage when game ends
  useEffect(() => {
    // Only save if the game has truly ended *this session* and hasn't been loaded as already played
    // Also make sure we have a valid puzzleId
    if (gameEnded && !hasPlayed && puzzleId) { 
      const dataToStore: StoredGameData = {
        played: true,
        score: totalPoints,
        totalPossible: totalPossiblePoints,
        grid: matchedPositions,
        guesses: guesses, // Save the current guesses
        puzzleId: puzzleId, // Store the puzzleId
        question: question  // Store the question
      };
      try {
        localStorage.setItem(puzzleId, JSON.stringify(dataToStore));
        setHasPlayed(true); // Mark as played for this session too
        setStoredGameData(dataToStore); // Update stored data state
      } catch (error) {
        console.error("Failed to save to local storage:", error);
        toast.error("Could not save game progress.");
      }
    }
  }, [gameEnded, hasPlayed, totalPoints, totalPossiblePoints, matchedPositions, puzzleId, question, guesses]);

  // Generate share text - Adapts based on whether game was just played or loaded
  const generateShareText = () => {
    const score = storedGameData ? storedGameData.score : totalPoints;
    const possible = storedGameData ? storedGameData.totalPossible : totalPossiblePoints;
    const gridState = storedGameData ? storedGameData.grid : matchedPositions;

    let shareText = `weasked10llms
(${currentDate})

`;
    // Convert grid to emoji, making sure to format as a 2-rows grid for visual appeal
    // First calculate how to split the grid
    const halfLength = Math.ceil(gridState.length / 2);
    const firstRow = gridState.slice(0, halfLength);
    const secondRow = gridState.slice(halfLength);
    
    // Now convert to emoji
    const firstRowEmoji = firstRow.map(m => m ? '🟩' : '⬜').join('');
    const secondRowEmoji = secondRow.map(m => m ? '🟩' : '⬜').join('');
    
    // Add to share text, with each row on a separate line
    shareText += `${firstRowEmoji}\n${secondRowEmoji}\n\n`;
    shareText += `Score: ${score} / ${possible}`;
    return shareText;
  };
  
  // Share results - Copy to Clipboard
  const handleCopyShare = () => { // Renamed from handleShare
    const shareText = generateShareText();
    navigator.clipboard.writeText(shareText).then(() => {
      toast.success('Results copied to clipboard!');
    }).catch((err) => {
      console.error('Failed to copy: ', err);
      toast.error('Could not copy results.');
    });
  };
  
  // Share results - Share on X (Twitter)
  const handleShareX = () => {
    const shareText = generateShareText();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(twitterUrl, '_blank');
  };

  // Effect to scroll guesses container when guesses change
  useEffect(() => {
    const container = guessesContainerRef.current;
    // Only scroll if guesses have actually increased (new guess added)
    if (container && guesses.length > guessesLengthRef.current) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
    // Update the ref to current length
    guessesLengthRef.current = guesses.length;
  }, [guesses]); // This dependency is necessary for the scroll functionality

  // Handle submit guess - updated to use API
  const handleSubmit = async () => {
    // Prevent submission if game ended, already played, or no guesses left
    if (gameEnded || hasPlayed || errorGuessesLeft <= 0 || !puzzleId || isCheckingAnswer) return; // Add isCheckingAnswer check

    const trimmedGuess = currentGuess.trim();
    if (trimmedGuess === "") return; // Don't submit empty guesses

    const lowerCaseGuess = trimmedGuess.toLowerCase();

    if (guesses.some(g => g.text.toLowerCase() === lowerCaseGuess)) {
      toast.error("You already guessed this!");
      return;
    }
    
    try {
      setIsCheckingAnswer(true); // Set loading state before API call
      // Call API to check the answer
      const result = await checkAnswer(puzzleId, trimmedGuess);
      
      const earnedPoints = result.points;
      const isValidAnswer = result.correct;
      let anyNewMatch = false;
      
      // Important: Create a *new* array to track changes for this specific guess
      const updatedMatchedPositions = [...matchedPositions]; 
      
      // Find the first empty position and mark it if answer was correct
      // Use the returned index to mark the specific position
      if (isValidAnswer && typeof result.index === 'number') {
        const answerIndex = result.index;
        if (answerIndex >= 0 && answerIndex < updatedMatchedPositions.length && !updatedMatchedPositions[answerIndex]) {
          updatedMatchedPositions[answerIndex] = true; 
          anyNewMatch = true;
        }
      }

      // Update the main matchedPositions state only if a new match occurred
      if (anyNewMatch) {
        setMatchedPositions(updatedMatchedPositions);
      }

      let nextErrorGuessesLeft = errorGuessesLeft; 
      if (isValidAnswer) {
        setTotalPoints(prev => prev + earnedPoints);
        if (!isMuted) playSound('correct');
      } else {
        nextErrorGuessesLeft = errorGuessesLeft - 1;
        setErrorGuessesLeft(nextErrorGuessesLeft);
        const mistakeIndex = INITIAL_INCORRECT_GUESSES - nextErrorGuessesLeft - 1;
        setAnimateMistakeIndex(mistakeIndex);
        setTimeout(() => setAnimateMistakeIndex(null), 500);
        if (!isMuted) playSound('incorrect');
      }
      
      const newGuessEntry: Guess = {
        id: uuidv4(), // Assign a unique ID
        text: result.correct && result.answer ? result.answer : trimmedGuess.toUpperCase(),
        points: earnedPoints,
        isValid: isValidAnswer,
        allMatchedPositions: [...updatedMatchedPositions] // Store grid state *with* this guess
      };

      // Add the new guess
      const updatedGuesses = [...guesses, newGuessEntry];
      setGuesses(updatedGuesses);
      setCurrentGuess(""); // Clear input

      // Check game end condition
      const allRevealed = updatedMatchedPositions.every(pos => pos);
      const outOfIncorrectGuesses = nextErrorGuessesLeft <= 0;

      if (outOfIncorrectGuesses || allRevealed) {
        setGameEnded(true); // Trigger the save effect
        if (allRevealed) {
          if (!isMuted) playSound('win');
        } else { 
          if (!isMuted) playSound('lose');
        }
      }
    } catch (error) {
      console.error("Error checking answer:", error);
      toast.error("Failed to check your answer. Please try again.");
    } finally {
        setIsCheckingAnswer(false); // Reset loading state after API call completes or fails
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <main className="game-main">
        <div className="current-date">{currentDate}</div>
        <div className="game-box loading">
          <h2>Loading today's puzzle...</h2>
        </div>
      </main>
    );
  }
  
  // Error state
  if (error) {
    return (
      <main className="game-main">
        <div className="current-date">{currentDate}</div>
        <div className="game-box error">
          <h2>Error</h2>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="guess-button"
            type="button"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  // Display stored result if already played
  if (hasPlayed && storedGameData) {
    return (
      <main className="game-main">
        <div className="current-date">{currentDate}</div>
        <div className="game-box already-played">
          <h2 className="game-question">{storedGameData.question}</h2>
          {/* Guesses Container for stored game */} 
          <div className="guesses-container" ref={guessesContainerRef}>
             {guesses.map((guess) => ( // Use the loaded guesses state
                 <div key={guess.id} 
                      className={`guess-item ${!guess.isValid ? 'invalid-guess' : ''}`}
                 >
                     {guess.text} 
                     {guess.isValid && <span className="points-earned"> (+{guess.points} pts)</span>}
                     {!guess.isValid && <span className="mistake-mark">X</span>}
                 </div>
             ))}
          </div>
          <div className="game-over-message">
              <p>Final Score: {storedGameData.score} / {storedGameData.totalPossible}</p>
              <div className="share-buttons-container">
                 <button onClick={handleShareX} className="share-button share-button-x" type="button" aria-label="Share on X">
                   <X size={18} />
                 </button>
                 <button onClick={handleCopyShare} className="share-button share-button-copy" type="button" aria-label="Copy score">
                   <Copy size={18} />
                 </button>
               </div>
          </div>
          <div className="feedback-grid stored-grid">
            {storedGameData.grid.map((filled, i) => (
              <div 
                key={`grid-${i}-${filled}`} // Use index and value to create a more stable key
                className={`feedback-square ${filled ? 'filled' : 'empty'}`} 
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Render the game if not played yet
  return (
    <main className="game-main">
        {/* Render active game or just-finished game */}
        {!hasPlayed && (
          <>
            <div className="current-date">{currentDate}</div>
            {/* Add game-over class when game is ended but not loaded as played */}
            <div className={`game-box ${gameEnded ? 'game-over' : ''}`}>
                <h2 className="game-question">{question}</h2>
                {/* Guesses Container (will lose scrollbar via CSS when game-over) */} 
                <div className="guesses-container" ref={guessesContainerRef}>
                    {guesses.map((guess) => (
                        <div key={guess.id}
                              className={`guess-item ${!guess.isValid ? 'invalid-guess' : ''}`}
                        >
                            {guess.text} 
                            {guess.isValid && <span className="points-earned"> (+{guess.points} pts)</span>}
                            {!guess.isValid && <span className="mistake-mark">X</span>}
                        </div>
                    ))}
                </div>
                {/* Input Area or Game Over Message */}
                {!gameEnded ? (
                    <div className="input-area">
                         <div className="input-wrapper">
                            <input
                              type="text"
                              value={currentGuess}
                              onChange={(e) => setCurrentGuess(e.target.value)}
                              onKeyPress={handleKeyPress}
                              placeholder="Type your answer..."
                              className="guess-input"
                              disabled={gameEnded || errorGuessesLeft <= 0 || isCheckingAnswer} // Disable while checking
                            />
                            <button 
                              onClick={handleSubmit} 
                              className="guess-button" 
                              type="button"
                              disabled={gameEnded || errorGuessesLeft <= 0 || isCheckingAnswer} // Disable while checking
                            >
                                {isCheckingAnswer ? 'Checking...' : 'Guess'} {/* Change button text */}
                            </button>
                        </div>
                        <div className="board-progress">
                            Board Progress {totalPoints} / {totalPossiblePoints}
                        </div>
                    </div>
                ) : (
                    // Game over message (with new share buttons)
                    <div className="game-over-message">
                        <p>Game Over! Final Score: {totalPoints} / {totalPossiblePoints}</p>
                         <div className="share-buttons-container">
                             <button onClick={handleShareX} className="share-button share-button-x" type="button" aria-label="Share on X">
                                 <X size={18} />
                             </button>
                             <button onClick={handleCopyShare} className="share-button share-button-copy" type="button" aria-label="Copy score">
                                <Copy size={18} />
                             </button>
                         </div>
                    </div>
                )}
            </div>
            
            {/* Feedback Grid */}
            <div className="feedback-grid">
                {matchedPositions.map((filled, i) => (
                    <div 
                        key={`grid-${i}-${filled}`} // Create a more stable key using index and value
                        className={`feedback-square ${filled ? 'filled' : 'empty'}`} 
                    />
                ))}
            </div>
            
            {/* Mistake Tracker - Reverted to X span */}
            <div className="mistake-tracker">
                {mistakePlaceholderIds.map((id, index) => {
                    const mistakeMade = index < (INITIAL_INCORRECT_GUESSES - errorGuessesLeft);
                    const isAnimating = animateMistakeIndex === index;
                    return (
                        <div 
                            key={id}
                            className={`mistake-placeholder ${mistakeMade ? 'has-mistake' : ''} ${isAnimating ? 'animate-mistake' : ''}`}
                        >
                            {/* Reverted to using span with X */} 
                            {mistakeMade && <span className="mistake-mark">X</span>}
                        </div>
                    );
                })}
            </div>
          </>
        )}
    </main>
  );
};

export default LLMPuzzleGame; 