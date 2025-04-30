import { z } from "zod";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser, OutputFixingParser } from "langchain/output_parsers";
import { llmRegistry } from "../llmRegistry";
import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

// --- SCHEMAS & PARSERS ---

// Schema/Parser for generating the QUESTION
const questionSchema = z.object({
  question: z.string().describe("A short, engaging question suitable for a word-guessing game (like 'Family Feud' or 'Top 10') based on the provided topic. It should elicit common, single-word or short-phrase answers.")
});
type QuestionOutput = z.infer<typeof questionSchema>;
const questionParser = StructuredOutputParser.fromZodSchema(questionSchema);

// Schema/Parser for generating ANSWERS
const answersSchema = z.object({
  answers: z.array(z.string())
    .length(10)
    .describe("An array of EXACTLY 10 single-word or short-phrase answers to the provided question, ordered from most common/expected to least common."),
});
type AnswersOutput = z.infer<typeof answersSchema>;
const answersParser = StructuredOutputParser.fromZodSchema(answersSchema);

// Schema/Parser for deduplicating/consolidating answers
const consolidatedAnswersSchema = z.object({
  consolidatedAnswers: z.array(z.object({
    answer: z.string().describe("The standardized, canonical form of the answer (choose the most complete/formal version)"),
    originalAnswers: z.array(z.string()).describe("List of all original answers that are considered variations or duplicates of this consolidated answer")
  })).describe("A list of unique, deduplicated answers where similar variations are consolidated")
});
type ConsolidatedAnswersOutput = z.infer<typeof consolidatedAnswersSchema>;
const consolidatedAnswersParser = StructuredOutputParser.fromZodSchema(consolidatedAnswersSchema);

// --- PROMPT TEMPLATES ---

const questionPromptTemplate = new PromptTemplate({
    template: `Generate a short, engaging question for a word-guessing game (like 'Family Feud' or 'Top 10') based on the given topic.Ensure the question is clear and likely to have multiple common answers. Make sure question is appropiate for 10 different unique answers. {format_instructions}\n\nTopic: {topic}\n`,
    inputVariables: ["topic"],
    partialVariables: { format_instructions: questionParser.getFormatInstructions() },
});

const answersPromptTemplate = new PromptTemplate({
    template: `You are assisting in creating content for a word-guessing game like 'Family Feud' or 'Top 10'.
Given the following question, provide a list of EXACTLY 10 single-word or short-phrase answers.
Order the answers from the most common/expected answer (first) to the least common answer (last).

{format_instructions}

Question: {question}
`,
    inputVariables: ["question"],
    partialVariables: { format_instructions: answersParser.getFormatInstructions() },
});

const consolidateAnswersPromptTemplate = new PromptTemplate({
  template: `You are processing answers for a word guessing game. Your task is to identify and consolidate semantically similar answers in this list to ensure the final list has no duplicates or very similar items.

For each group of similar answers:
1. Choose the most complete, formal, or standard form as the canonical answer 
2. List all of its variants/duplicates (including the canonical form itself)

Consolidate answers that are:
- Full names vs. first names only (e.g., "Michael Jackson" and "Michael" should be consolidated)
- Abbreviations and their full forms (e.g., "TV" and "television")
- Same entity with slight spelling variations
- Same concept in singular/plural form

Do NOT consolidate:
- Different entities that merely belong to the same category
- Similar but distinct concepts or people (e.g., "Mozart" and "Beethoven" should remain separate)

Here is the question that was asked: {question}
Here is the list of answers to consolidate: {answersToConsolidate}

{format_instructions}

Provide your consolidated answer list:`,
  inputVariables: ["question", "answersToConsolidate"],
  partialVariables: { format_instructions: consolidatedAnswersParser.getFormatInstructions() },
});

// --- INTERFACES --- 

interface AnswerFrequency {
    answer: string;
    count: number;
}

export interface FinalAnswer {
    answer: string;
    points: number;
}

export interface FinalPuzzle {
    question: string;
    answers: FinalAnswer[];
}

interface ConsolidatedAnswer {
  answer: string;
  originalAnswers: string[];
  score: number;
}

// --- HELPER FUNCTIONS ---

const normalizeAnswer = (answer: string): string => {
    return answer.trim().toLowerCase();
};

// This is a weight factor for how much we value frequency vs order
// Higher values give more weight to frequency over order
const FREQUENCY_WEIGHT = 0.7;
const ORDER_WEIGHT = 1 - FREQUENCY_WEIGHT;

// --- CORE FUNCTIONS ---

/**
 * Generates only the question for a given topic using a specified LLM.
 */
const generateQuestionOnly = async (topic: string, modelName = 'openai'): Promise<string | null> => {
    const llm = llmRegistry.get(modelName);
    if (!llm) {
        console.error(`❌ Model "${modelName}" not found for question generation.`);
        return null;
    }
    console.log(`⏳ Generating question for topic: "${topic}" using ${modelName}...`);
    try {
        const formattedPrompt = await questionPromptTemplate.format({ topic });
        const response = await llm.invoke([new HumanMessage(formattedPrompt)]);
        const responseContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        
        // Attempt parse, fallback with OutputFixingParser
        let parsedQuestion: QuestionOutput;
         try {
             parsedQuestion = await questionParser.parse(responseContent);
         } catch (parseError) {
             console.warn(`   ⚠️ Failed to parse question response from ${modelName}, attempting to fix...`);
             const fixParser = OutputFixingParser.fromLLM(llm, questionParser);
             parsedQuestion = await fixParser.parse(responseContent);
             console.warn(`   ✅ Fixed question response from ${modelName}.`);
         }
        
        console.log(`✅ Question generated: "${parsedQuestion.question}"`);
        return parsedQuestion.question;
    } catch (error) {
        console.error(`❌ Error generating question for topic "${topic}" using ${modelName}:`, error);
        return null;
    }
};

/**
 * Gets answers for a given question from all registered LLMs.
 */
const getAllAnswers = async (question: string): Promise<string[]> => {
    const allAnswersRaw: string[] = [];
    const answerPromises: Promise<void>[] = [];
    const answerFormattedPrompt = await answersPromptTemplate.format({ question });

    console.log(`⏳ Querying ${llmRegistry.size} model(s) for answers to: "${question}"`);
    for (const [modelName, llm] of llmRegistry.entries()) {
        answerPromises.push(
            (async () => {
                 try {
                     console.log(`   ➡️ Querying ${modelName}...`);
                     const response = await llm.invoke([new HumanMessage(answerFormattedPrompt)]);
                     const responseContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

                     let parsedOutput: AnswersOutput | null = null;
                     try {
                         parsedOutput = await answersParser.parse(responseContent);
                     } catch (parseError) {
                         console.warn(`   ⚠️ Failed to parse answer response from ${modelName}, attempting to fix...`);
                         try {
                             const fixParser = OutputFixingParser.fromLLM(llm, answersParser);
                             parsedOutput = await fixParser.parse(responseContent);
                             console.warn("   ✅ Fixed answer response from", modelName);
                         } catch (fixError) {
                             console.error(`   ❌ Failed to fix answer response from ${modelName}:`, fixError);
                         }
                     }

                     const answers = parsedOutput?.answers;
                     if (answers && Array.isArray(answers) && answers.length === 10) {
                         const normalized = answers.map(normalizeAnswer).filter(a => a);
                         allAnswersRaw.push(...normalized);
                         console.log(`   ✔️ Received ${normalized.length} VALID answers from ${modelName}.`);
                     } else {
                          console.warn(`   ⚠️ Invalid answer format/count from ${modelName}. Expected 10, got ${answers?.length ?? 0}.`);
                     }
                 } catch (error) {
                     console.error(`   ❌ Error querying model "${modelName}" for answers:`, error);
                 }
             })()
        );
    }
    await Promise.all(answerPromises);
    console.log("✅ Answer collection complete. Total valid raw answers:", allAnswersRaw.length);
    return allAnswersRaw;
};

/**
 * Consolidates raw answers, selects top answers, and assigns points based on 
 * statistical analysis of frequency and order of appearance.
 */
const scoreAnswers = async (allAnswersRaw: string[], question: string): Promise<FinalAnswer[] | null> => {
    if (allAnswersRaw.length === 0) {
        console.error("❌ Cannot score answers, no valid raw answers provided.");
        return null;
    }

    console.log("⏳ Consolidating and ranking answers...");
    
    // Track both frequency and positions
    const frequencyMap: Map<string, number> = new Map();
    const orderPositions: Map<string, number[]> = new Map();
    const numLLMs = Math.ceil(allAnswersRaw.length / 10); // Estimate how many LLMs contributed
    
    // Process the answers in batches of 10 (each batch represents one LLM's answers)
    for (let i = 0; i < allAnswersRaw.length; i++) {
        const answer = allAnswersRaw[i];
        const llmPosition = i % 10; // Position within the current LLM's list (0-9)
        
        // Track frequency
        frequencyMap.set(answer, (frequencyMap.get(answer) || 0) + 1);
        
        // Track all positions for this answer across different LLMs
        const positions = orderPositions.get(answer) || [];
        positions.push(llmPosition);
        orderPositions.set(answer, positions);
    }
    
    // Calculate combined score (frequency + position)
    const scoreMap: Map<string, number> = new Map();
    const maxFrequency = Math.max(...Array.from(frequencyMap.values()));
    
    for (const [answer, frequency] of frequencyMap.entries()) {
        // Normalize frequency score (0-1 range)
        const normalizedFrequency = frequency / maxFrequency;
        
        // Calculate average position (lower is better)
        const positions = orderPositions.get(answer) || [];
        const avgPosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
        // Normalize position score (0-1 range, reversed so higher is better)
        const normalizedPosition = 1 - (avgPosition / 9);  // positions are 0-9, so divide by 9
        
        // Combined weighted score
        const combinedScore = (FREQUENCY_WEIGHT * normalizedFrequency) + 
                             (ORDER_WEIGHT * normalizedPosition);
                              
        scoreMap.set(answer, combinedScore);
    }
    
    // --- NEW: Use OpenAI to consolidate similar answers ---
    console.log("⏳ Using AI to consolidate similar answers...");
    
    try {
        // Get OpenAI model (or another suitable model) for consolidation
        const aiModel = llmRegistry.get('openai');
        if (!aiModel) {
            console.warn("⚠️ OpenAI model not available for answer consolidation. Proceeding with raw answers.");
        } else {
            // Format the list of answers with their scores for the prompt
            const answersToConsolidate = Array.from(scoreMap.entries())
                .map(([answer, score]) => `"${answer}" (score: ${score.toFixed(3)})`)
                .join('\n');
            
            // Call the LLM to consolidate answers
            const formattedPrompt = await consolidateAnswersPromptTemplate.format({
                question,
                answersToConsolidate
            });
            
            const response = await aiModel.invoke([new HumanMessage(formattedPrompt)]);
            const responseContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
            
            // Parse the consolidated answers
            let consolidatedResult: ConsolidatedAnswersOutput;
            try {
                consolidatedResult = await consolidatedAnswersParser.parse(responseContent);
            } catch (parseError) {
                console.warn("⚠️ Failed to parse consolidated answers, attempting to fix...");
                const fixParser = OutputFixingParser.fromLLM(aiModel, consolidatedAnswersParser);
                consolidatedResult = await fixParser.parse(responseContent);
            }
            
            // Process consolidated answers: combine scores from all originals
            const consolidatedScoreMap: ConsolidatedAnswer[] = consolidatedResult.consolidatedAnswers
                .map(group => {
                    // Calculate combined score based on the max score among the original answers
                    const groupScores = group.originalAnswers.map(original => 
                        scoreMap.get(original) || 0
                    );
                    const maxScore = Math.max(...groupScores);
                    
                    return {
                        answer: group.answer,
                        originalAnswers: group.originalAnswers,
                        score: maxScore
                    };
                })
                .sort((a, b) => b.score - a.score);
            
            console.log(`✅ Successfully consolidated ${frequencyMap.size} answers into ${consolidatedScoreMap.length} unique entries.`);
            
            // Take the top 10 consolidated answers (or fewer if not enough)
            const topConsolidatedAnswers = consolidatedScoreMap.slice(0, 10);
            
            // Convert normalized scores to points totaling 100
            const totalScore = topConsolidatedAnswers.reduce((sum, ans) => sum + ans.score, 0);
            
            console.log(`⏳ Assigning points based on consolidated answers (using ${topConsolidatedAnswers.length} answers)...`);
            const finalAnswersWithPoints: FinalAnswer[] = topConsolidatedAnswers.map(ans => {
                // Scale to a total of 100 points across all answers
                const points = Math.round((ans.score / totalScore) * 100);
                // Ensure each answer gets at least 1 point
                return { answer: ans.answer, points: Math.max(1, points) };
            });
            
            // Normalize to exactly 100 points total (handle rounding errors)
            const pointSum = finalAnswersWithPoints.reduce((sum, ans) => sum + ans.points, 0);
            if (pointSum !== 100 && finalAnswersWithPoints.length > 0) {
                // Adjust the highest-scored answer to make total exactly 100
                const diff = 100 - pointSum;
                finalAnswersWithPoints[0].points += diff;
            }
            
            console.log("✅ Statistical scoring complete with consolidated answers. Points distribution:", 
                finalAnswersWithPoints.map(a => a.points).join(', '));
            return finalAnswersWithPoints;
        }
    } catch (aiError) {
        console.error("❌ Error during answer consolidation:", aiError);
        console.log("⚠️ Proceeding with raw answers without consolidation.");
        // Continue with the original approach if AI consolidation fails
    }
    
    // Original approach as fallback (without consolidation)
    // Sort by score and take top answers
    const sortedAnswers = Array.from(scoreMap.entries())
        .map(([answer, score]) => ({ answer, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    
    if (sortedAnswers.length === 0) {
        console.error("❌ No unique answers found after consolidation.");
        return null;
    }
    
    if (sortedAnswers.length < 10) {
        console.warn("⚠️ Only", sortedAnswers.length, "unique answers found. Puzzle will have fewer than 10 items.");
    }
    
    // Convert normalized scores to points totaling 100
    const totalScore = sortedAnswers.reduce((sum, ans) => sum + ans.score, 0);
    
    console.log(`⏳ Assigning points based on statistical analysis (using ${sortedAnswers.length} answers)...`);
    const finalAnswersWithPoints: FinalAnswer[] = sortedAnswers.map(ans => {
        // Scale to a total of 100 points across all answers
        const points = Math.round((ans.score / totalScore) * 100);
        // Ensure each answer gets at least 1 point
        return { answer: ans.answer, points: Math.max(1, points) };
    });
    
    // Normalize to exactly 100 points total (handle rounding errors)
    const pointSum = finalAnswersWithPoints.reduce((sum, ans) => sum + ans.points, 0);
    if (pointSum !== 100 && finalAnswersWithPoints.length > 0) {
        // Adjust the highest-scored answer to make total exactly 100
        const diff = 100 - pointSum;
        finalAnswersWithPoints[0].points += diff;
    }
    
    console.log("✅ Statistical scoring complete. Points distribution:", 
        finalAnswersWithPoints.map(a => a.points).join(', '));
    return finalAnswersWithPoints;
};

// --- EXPORTED GENERATOR FUNCTION ---

/**
 * Generates a complete puzzle (question + ranked/scored answers) for a given topic.
 * Uses a dedicated LLM call for the question, then queries all LLMs for answers.
 */
export const generateDailyPuzzle = async (topic: string): Promise<FinalPuzzle | null> => {
    // 1. Generate Question (using default 'openai' or a specified model)
    const question = await generateQuestionOnly(topic); 
    if (!question) {
        return null; // Error logged in generateQuestionOnly
    }

    // 2. Get all answers for the generated question
    const allAnswersRaw = await getAllAnswers(question);
    if (allAnswersRaw.length === 0) {
        return null; // Error logged in getAllAnswers
    }

    // 3. Score the answers (now also passes the question for context)
    const scoredAnswers = await scoreAnswers(allAnswersRaw, question);
    if (!scoredAnswers) {
        return null; // Error logged in scoreAnswers
    }

    // 4. Return the final puzzle structure
    return {
        question,
        answers: scoredAnswers,
    };
}; 