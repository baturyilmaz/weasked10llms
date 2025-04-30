import cron from 'node-cron';
import { generateDailyPuzzle } from '../services/puzzleGenerator';
import Puzzle from '../models/Puzzle';
import { simpleHash } from '../utils/hash'; // Assuming hash function is moved to utils

// TODO: Define a list of potential topics or a way to generate them
const topics = [
    "Programming Languages",
    "Programming Meme Topics",
    "Things You Do Before Bed",
    "Foods You Eat for Breakfast",
    "Things Found in a School",
    "Popular Ice Cream Flavors",
    "Things That Are Cold",
    "Things You Bring to the Beach",
    "Jobs Kids Want When They Grow Up",
    "Things You Might Lose",
    "Reasons People Are Late",
    "Things You Do on a Rainy Day",
    "Places You Have to Be Quiet",
    "Things That Can Fly",
    "Sci-Fi Movies",
    "Comic Book Heroes",
    "Cartoon Characters",
    "Classic Arcade Games",
    "Popular 90s Software",
    "Things on a 90s Desktop",
    "Famous Tech Founders",
    "Video Game Characters",
    "Famous Hackers",
    "Sci-Fi Authors",
    "80s Action Movie Stars",
    "90s Sitcom Characters",
    "Famous Scientists",
    "Comic Book Villains",
    "Famous Inventors",
    "People Who Made the Internet",
    "Programmers Everyone Knows",
    "Pop Stars from the 90s",
  ];

/**
 * Generates a puzzleId based on a specific date.
 */
const generatePuzzleIdForDate = (date: Date): string => {
    // Use UTC methods to ensure consistency regardless of server timezone
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `puzzle-${year}-${month}-${day}`;
}

/**
 * Generates and saves puzzles for the next 7 days starting from a given date.
 * Exported so it can be called on startup or by the scheduler.
 * @param startDate The first day (in UTC) for which to generate a puzzle. Defaults to today.
 */
export const generateAndSaveWeeklyPuzzles = async (startDate?: Date) => {
    console.log('[Weekly Job/Startup] Starting weekly puzzle generation...');

    const baseDate = startDate || new Date(); // Use provided start date or today
    baseDate.setUTCHours(12, 0, 0, 0); // Set to midday UTC for consistency

    const availableTopics = [...topics]; // Copy topics to avoid modifying the original
    const generatedTopicsThisRun: string[] = []; // Track used topics for this run

    for (let i = 0; i < 7; i++) {
        const targetDate = new Date(baseDate);
        targetDate.setUTCDate(baseDate.getUTCDate() + i); // Calculate date for day i
        targetDate.setUTCHours(12, 0, 0, 0); // Ensure time is consistent

        const puzzleId = generatePuzzleIdForDate(targetDate);
        const dateString = targetDate.toISOString().split('T')[0]; // For logging YYYY-MM-DD

        console.log(`[Weekly Job/Startup] Processing day ${i + 1}/7: ${dateString} (ID: ${puzzleId})`);

        // Check if a puzzle for this specific day already exists by puzzleId
        try {
            const existingPuzzle = await Puzzle.findOne({ puzzleId: puzzleId });
            if (existingPuzzle) {
                console.log(`[Weekly Job/Startup] Puzzle already exists for ${dateString} (ID ${puzzleId}). Skipping.`);
                continue; // Skip to the next day
            }

            // Optional: Double-check by date range (start/end of the target day in UTC)
            const startOfDay = new Date(targetDate);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setUTCHours(23, 59, 59, 999);

            const existingByDate = await Puzzle.findOne({
                date: { $gte: startOfDay, $lte: endOfDay }
            });

            if (existingByDate) {
                 console.log(`[Weekly Job/Startup] Puzzle already exists for date range ${dateString} (Existing ID: ${existingByDate.puzzleId}). Skipping.`);
                 continue; // Skip to the next day
            }

        } catch (dbError) {
            console.error(`[Weekly Job/Startup] Error checking for existing puzzle for ${dateString}:`, dbError);
            continue; // Skip this day if DB check fails
        }

        // Select a random topic, ensuring uniqueness for this weekly run
        if (availableTopics.length === 0) {
            console.warn('[Weekly Job/Startup] Ran out of unique topics for this week!');
            // Optionally refill or handle this case (e.g., reuse topics, stop generation)
             // For now, let's just reuse topics if we run out
             if (topics.length > 0) {
                Object.assign(availableTopics, topics); // Refill available topics
             } else {
                 console.error('[Weekly Job/Startup] No topics defined at all!');
                 break; // Stop if no topics are defined initially
             }
        }

        const topicIndex = Math.floor(Math.random() * availableTopics.length);
        const selectedTopic = availableTopics.splice(topicIndex, 1)[0]; // Remove topic from available list
        generatedTopicsThisRun.push(selectedTopic); // Track usage for this run
        console.log(`[Weekly Job/Startup] Selected topic for ${dateString}: "${selectedTopic}"`);

        // Generate the puzzle data
        const puzzleData = await generateDailyPuzzle(selectedTopic); // Still uses the "daily" generator internally

        if (puzzleData) {
            console.log(`[Weekly Job/Startup] Generated puzzle data for topic: "${selectedTopic}"`);
            try {
                // Create and save the new puzzle document
                const newPuzzle = new Puzzle({
                    puzzleId: puzzleId,
                    question: puzzleData.question,
                    answers: puzzleData.answers,
                    date: targetDate, // Use the specific target UTC date
                });

                console.log(`[Weekly Job/Startup] Saving puzzle for ${dateString} with date: ${targetDate.toISOString()}`);
                await newPuzzle.save();
                console.log(`[Weekly Job/Startup] ✅ Successfully saved puzzle ${puzzleId} to database.`);
            } catch (saveError) {
                console.error(`[Weekly Job/Startup] ❌ Error saving puzzle ${puzzleId} to database:`, saveError);
                // Put the topic back if saving failed? Maybe not, to avoid retrying the same failing topic immediately.
            }
        } else {
            console.error(`[Weekly Job/Startup] ❌ Failed to generate puzzle data for topic: "${selectedTopic}"`);
            // Put the topic back in availableTopics if generation failed
            availableTopics.push(selectedTopic);
        }
    } // End loop for 7 days

    console.log('[Weekly Job/Startup] Finished weekly puzzle generation attempt.');
};

/**
 * Schedules the weekly puzzle generation job.
 */
export const scheduleWeeklyPuzzleJob = () => {
    // Schedule to run once a week, e.g., Sunday at midnight UTC
    // '0 0 * * 0' means at minute 0, hour 0, on day-of-week 0 (Sunday)
    cron.schedule('0 0 * * 0', () => {
        console.log('[Cron Job - Weekly] Running scheduled weekly puzzle generation...');
        // Run generation for the upcoming week starting from today
        generateAndSaveWeeklyPuzzles();
    }, {
        scheduled: true,
        timezone: "Etc/UTC" // Explicitly set timezone
    });

    console.log('⏰ Weekly puzzle generation job scheduled for Sunday at 00:00 UTC.');
}; 