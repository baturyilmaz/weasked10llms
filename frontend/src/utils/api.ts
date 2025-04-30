// API base URL - update based on environment if needed
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Response types
export interface ApiPuzzle {
  puzzleId: string;
  question: string;
  answerCount: number;
}

export interface ApiAnswerCheckResponse {
  correct: boolean;
  answer?: string; // Original answer text (only returned if correct)
  points: number;
  index?: number; // Add optional index field
}

export interface ApiAnswer {
  answer: string;
  points: number;
}

export interface ApiYesterdayPuzzle {
  puzzleId: string;
  question: string;
  answers: ApiAnswer[];
  date: string;
}

// API functions
export const fetchTodaysPuzzle = async (): Promise<ApiPuzzle> => {
  try {
    const response = await fetch(`${API_BASE_URL}/todays-question`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to fetch puzzle: ${response.status} ${response.statusText}`
      );
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching today\'s puzzle:', error);
    throw error; // Re-throw for component to handle
  }
};

export const checkAnswer = async (
  puzzleId: string, 
  submittedAnswer: string
): Promise<ApiAnswerCheckResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/check-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        puzzleId,
        submittedAnswer,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to check answer: ${response.status} ${response.statusText}`
      );
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking answer:', error);
    throw error; // Re-throw for component to handle
  }
};

export const fetchYesterdaysPuzzle = async (): Promise<ApiYesterdayPuzzle> => {
  try {
    const response = await fetch(`${API_BASE_URL}/yesterdays-puzzle`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to fetch yesterday's puzzle: ${response.status} ${response.statusText}`
      );
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching yesterday's puzzle:", error);
    throw error; // Re-throw for component to handle
  }
}; 