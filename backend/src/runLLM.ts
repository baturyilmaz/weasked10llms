import { llmRegistry } from './llmRegistry';
import { SystemMessage, HumanMessage } from "@langchain/core/messages"; // Updated import path

/**
 * Calls the requested LLM
 * @param {string} modelName - Registered model name (e.g., 'openai', 'anthropic')
 * @param {string} prompt - User input prompt
 * @returns {Promise<string | undefined>} The text response from the LLM, or undefined if an error occurs.
 */
export async function runLLM(modelName: string, prompt: string): Promise<string | undefined> {
  const llm = llmRegistry.get(modelName);
  if (!llm) {
    console.error(`❌ Model "${modelName}" not found in registry.`);
    return undefined; // Return undefined for clarity
  }

  try {
    console.log(`⏳ Calling model: ${modelName}...`);
    const response = await llm.invoke([ // Use invoke instead of call
      new SystemMessage("You are a helpful assistant."),
      new HumanMessage(prompt),
    ]);

    // Access content instead of text for newer LangChain versions
    const responseText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    console.log(`✅ [${modelName.toUpperCase()}] Response received.`);
    return responseText;

  } catch (error) {
    console.error(`❌ Error calling model "${modelName}":`, error);
    return undefined; // Return undefined on error
  }
} 