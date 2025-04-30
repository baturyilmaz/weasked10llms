import express, { type Request, type Response } from 'express';
// import { runLLM } from './runLLM'; // No longer needed directly here
import 'dotenv/config'; // Make sure env variables are loaded
import connectDB from './db'; // Import the DB connection function
import { generateDailyPuzzle } from './services/puzzleGenerator'; // Corrected import name
import Puzzle from './models/Puzzle'; // Import the Puzzle model
import {
  scheduleWeeklyPuzzleJob, 
  generateAndSaveWeeklyPuzzles 
} from './jobs/dailyPuzzleJob'; // Import the RENAMED scheduler and generation function
import cors from 'cors'; // Import CORS
import { z } from 'zod'; // Import Zod
import { PromptTemplate } from "@langchain/core/prompts"; // Import PromptTemplate
import { StructuredOutputParser, OutputFixingParser } from "langchain/output_parsers"; // Import Parsers
import { HumanMessage } from "@langchain/core/messages"; // Import HumanMessage
import { llmRegistry } from './llmRegistry'; // Import LLM Registry

const app = express();
const port = process.env.PORT || 3001; // Use 3001 to avoid potential conflict with frontend

// Middleware
app.use(express.json()); // Middleware to parse JSON bodies
app.use(cors()); // Enable CORS for all routes

app.get('/', (req: Request, res: Response) => {
  res.send('Backend is running and puzzle job is scheduled!');
});

// --- API Route for Today's Puzzle ---
app.get('/api/todays-question', async (req: Request, res: Response) => {
  try {
    // Get today's date (start of day in UTC for consistency)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    console.log('API: Looking for today\'s puzzle, date:', today.toISOString());
    
    // Find the puzzle for today with a more flexible date range (entire day)
    const todayEnd = new Date(today);
    todayEnd.setUTCHours(23, 59, 59, 999);
    
    // More detailed query with debugging
    console.log('API: Date range:', today.toISOString(), 'to', todayEnd.toISOString());
    
    // First try with exact date range
    let puzzle = await Puzzle.findOne({ 
        date: { 
            $gte: today,
            $lte: todayEnd 
        }
    }).sort({ date: -1 }); // Get the most recent one for today
    
    // If not found, try with a more flexible approach - get most recent puzzle
    if (!puzzle) {
      console.log('API: No puzzle found in today\'s date range, trying to find most recent puzzle');
      
      puzzle = await Puzzle.findOne({}).sort({ date: -1 });
      
      if (puzzle) {
        console.log('API: Found most recent puzzle from date:', puzzle.date);
      }
    } else {
      console.log('API: Found today\'s puzzle for date:', puzzle.date);
    }

    if (!puzzle) {
      console.warn('API: No puzzles found in database at all');
      return res.status(404).json({ message: "Today's puzzle not found. Check back later!" });
    }

    // Return only the necessary fields to the frontend
    res.json({
      puzzleId: puzzle.puzzleId,
      question: puzzle.question,
      // IMPORTANT: Do NOT send the answers array to the frontend initially!
      // Only send the answers count or structure if needed by the UI.
      answerCount: puzzle.answers.length // Send the count
    });

  } catch (error) {
    console.error("API: Error fetching today's puzzle:", error);
    res.status(500).json({ message: "Error fetching puzzle data." });
  }
});

// --- API Route for Yesterday's Puzzle (with answers) ---
app.get('/api/yesterdays-puzzle', async (req: Request, res: Response) => {
  try {
    // Get today's and yesterday's date in a more reliable way
    const now = new Date();
    
    // Get yesterday's date range
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Set to beginning and end of yesterday
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    console.log(`API: Looking for yesterday's puzzle between:`, 
      yesterdayStart.toISOString(), 
      yesterdayEnd.toISOString());
    
    // Find the puzzle for yesterday (puzzles are stored with a date field)
    const puzzle = await Puzzle.findOne({ 
      date: { 
        $gte: yesterdayStart,
        $lte: yesterdayEnd
      } 
    }).sort({ date: -1 }); // Get the most recent one from yesterday if multiple exist

    if (!puzzle) {
      // If we didn't find yesterday's puzzle directly, try looking for the most recent
      // puzzle before today as a fallback
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      
      console.log('API: No direct match, looking for most recent puzzle before today:', todayStart.toISOString());
      
      const fallbackPuzzle = await Puzzle.findOne({
        date: { $lt: todayStart }
      }).sort({ date: -1 });
      
      if (!fallbackPuzzle) {
        console.warn('API: No puzzle found for yesterday or earlier');
        return res.status(404).json({ message: "Yesterday's puzzle not found." });
      }
      
      console.log('API: Found fallback puzzle from:', fallbackPuzzle.date);
      
      // Return the fallback puzzle
      return res.json({
        puzzleId: fallbackPuzzle.puzzleId,
        question: fallbackPuzzle.question,
        answers: fallbackPuzzle.answers,
        date: fallbackPuzzle.date
      });
    }

    console.log(`API: Found yesterday's puzzle from:`, puzzle.date);
    
    // Return full puzzle with answers (it's okay to reveal all answers for yesterday's puzzle)
    res.json({
      puzzleId: puzzle.puzzleId,
      question: puzzle.question,
      answers: puzzle.answers,
      date: puzzle.date
    });

  } catch (error) {
    console.error("API: Error fetching yesterday's puzzle:", error);
    res.status(500).json({ message: "Error fetching yesterday's puzzle data." });
  }
});

// --- LLM Answer Check Schema and Prompt ---
const answerCheckSchema = z.object({ 
    isCorrect: z.boolean().describe("Whether the submitted answer is semantically equivalent (e.g., synonym, plural/singular) to any of the correct answers."), 
    matchedAnswerIndex: z.number().nullable().describe("The 0-based index of the correct answer from the list that the submitted answer matches. Return null if isCorrect is false or no clear match exists.") 
});
type AnswerCheckOutput = z.infer<typeof answerCheckSchema>;
const answerCheckParser = StructuredOutputParser.fromZodSchema(answerCheckSchema);

const answerCheckPromptTemplate = new PromptTemplate({
    template: `You are an evaluator for a word puzzle game. Your task is to determine if the user's "Submitted Answer" **matches** (or is a very close variation of) **ONE** of the specific answers provided in the "Correct Answer List".

**Only consider a match valid if the submitted answer directly corresponds to an item in the list.** Allow for:
- Minor typos or spelling errors (e.g., "Javascrpt" for "JavaScript")
- Plural/singular forms (e.g., "language" for "languages")
- Common abbreviations IF they clearly map to a specific list item (e.g., "JS" for "JavaScript")
- Variations in capitalization or punctuation.

**Do NOT match based on general semantic similarity or category.** For example, if the list contains "C#", do NOT match "C" or "PHP" to it just because they are programming languages. The submitted answer must clearly represent one specific answer *from the list*.

{format_instructions}

Correct Answer List (index: answer):
{correctAnswersFormatted}

Submitted Answer: {submittedAnswer}

Your Evaluation:`,
    inputVariables: ["correctAnswersFormatted", "submittedAnswer"],
    partialVariables: { format_instructions: answerCheckParser.getFormatInstructions() },
});

// --- API Route for Checking an Answer (LLM Powered) ---
app.post('/api/check-answer', async (req: Request, res: Response) => {
  const { puzzleId, submittedAnswer } = req.body;

  if (!puzzleId || typeof submittedAnswer !== 'string' || submittedAnswer.trim() === '') {
    return res.status(400).json({ message: 'Missing or invalid puzzleId or submittedAnswer in request body.' });
  }

  try {
    const puzzle = await Puzzle.findOne({ puzzleId: puzzleId });

    if (!puzzle || !puzzle.answers || puzzle.answers.length === 0) {
      return res.status(404).json({ message: 'Puzzle not found or has no answers for the given ID.' });
    }

    // --- Use LLM for Validation ---
    const llmToCheckWith = llmRegistry.get('together-mixtral'); // Correct key for Mixtral
    if (!llmToCheckWith) {
        console.error("API: LLM for answer checking ('together-mixtral') not found in registry.");
        return res.status(500).json({ message: 'Answer checking service unavailable.' });
    }
    
    // Format the correct answers for the prompt
    const correctAnswersFormatted = puzzle.answers
        .map((ans, index) => `${index}: ${ans.answer}`)
        .join('\n');
        
    const formattedPrompt = await answerCheckPromptTemplate.format({
        correctAnswersFormatted: correctAnswersFormatted,
        submittedAnswer: submittedAnswer
    });
    
    console.log(`API: Checking answer "${submittedAnswer}" for puzzle ${puzzleId} using LLM...`);
    
    const response = await llmToCheckWith.invoke([new HumanMessage(formattedPrompt)]);
    const responseContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    let parsedResult: AnswerCheckOutput;
    try {
        parsedResult = await answerCheckParser.parse(responseContent);
    } catch (parseError) {
        console.warn(`API: Failed to parse LLM answer check response, attempting to fix... Raw: ${responseContent}`);
        try {
            const fixParser = OutputFixingParser.fromLLM(llmToCheckWith, answerCheckParser);
            parsedResult = await fixParser.parse(responseContent);
            console.warn("API: Fixed LLM answer check response.");
        } catch (fixError) {
            console.error('API: Failed to fix LLM answer check response:', fixError);
            // Fallback or error? For now, treat as incorrect if fixing fails.
            return res.json({ correct: false, points: 0 });
        }
    }
    
    // --- Process LLM Result ---
    if (parsedResult.isCorrect && 
        typeof parsedResult.matchedAnswerIndex === 'number' && 
        parsedResult.matchedAnswerIndex >= 0 && 
        parsedResult.matchedAnswerIndex < puzzle.answers.length) 
    {
        // LLM confirmed correct and provided a valid index
        const matchedIndex = parsedResult.matchedAnswerIndex;
        const foundAnswer = puzzle.answers[matchedIndex];
        console.log(`API: LLM judged "${submittedAnswer}" as CORRECT, matching index ${matchedIndex} ("${foundAnswer.answer}")`);
        res.json({
            correct: true,
            answer: foundAnswer.answer, // Return the original canonical answer
            points: foundAnswer.points,
            index: matchedIndex, 
        });
        
    } else {
        // LLM judged incorrect or gave invalid index
         console.log(`API: LLM judged "${submittedAnswer}" as INCORRECT (isCorrect: ${parsedResult.isCorrect}, index: ${parsedResult.matchedAnswerIndex})`);
        res.json({
            correct: false,
            points: 0, 
        });
    }

  } catch (error) {
    console.error(`API: Error checking answer for puzzle ${puzzleId} with LLM:`, error);
    res.status(500).json({ message: 'Error checking answer using LLM.' });
  }
});

// --- Server Startup Logic ---
const startServer = async () => {
  try {
    // 1. Connect to Database
    await connectDB();

    // 2. Check if puzzle exists for today, if not, generate for the week
    console.log('[Startup] Checking if puzzle exists for today...');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const todaysPuzzle = await Puzzle.findOne({ 
        date: { $gte: today, $lte: todayEnd }
    });

    if (!todaysPuzzle) {
        console.log('[Startup] No puzzle found for today. Triggering weekly generation...');
        // Generate puzzles starting from today
        await generateAndSaveWeeklyPuzzles(today); 
    } else {
        console.log(`[Startup] Puzzle found for today (ID: ${todaysPuzzle.puzzleId}). Skipping generation.`);
    }

    // 3. Schedule the weekly job for future weeks
    scheduleWeeklyPuzzleJob(); 

    // 4. Start listening for requests
    app.listen(port, () => {
      console.log(`Backend server listening at http://localhost:${port}`);
    });

  } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
  }
};

// Execute the startup function
startServer(); 