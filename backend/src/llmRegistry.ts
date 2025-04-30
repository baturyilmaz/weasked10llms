import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { ChatTogetherAI } from '@langchain/community/chat_models/togetherai';
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

interface LLMConfig {
  name: string;
  instance: BaseChatModel;
}

// Ensure API keys are loaded
if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not found in .env. OpenAI model may not work.");
}
if (!process.env.TOGETHER_API_KEY) {
  console.warn("TOGETHER_API_KEY not found in .env. TogetherAI model may not work.");
}

const llmConfigs: LLMConfig[] = [
  {
    name: 'openai',
    instance: new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.7,
      modelName: 'gpt-3.5-turbo',
    }),
  },
  {
    name: 'together-mixtral',
    instance: new ChatTogetherAI({
      apiKey: process.env.TOGETHER_API_KEY,
      modelName: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      temperature: 0.7,
    }),
  },
  // New models added via TogetherAI
  {
    name: 'together-dbrx',
    instance: new ChatTogetherAI({
      apiKey: process.env.TOGETHER_API_KEY,
      modelName: 'databricks/dbrx-instruct',
      temperature: 0.7,
    }),
  },
  {
    name: 'together-llama3-70b',
    instance: new ChatTogetherAI({
      apiKey: process.env.TOGETHER_API_KEY,
      modelName: 'meta-llama/Llama-3-70b-chat-hf',
      temperature: 0.7,
    }),
  },
  {
    name: 'together-yi-34b',
    instance: new ChatTogetherAI({
      apiKey: process.env.TOGETHER_API_KEY,
      modelName: 'zero-one-ai/Yi-34B-Chat',
      temperature: 0.7,
    }),
  },
  {
    name: 'together-deepseek-67b',
    instance: new ChatTogetherAI({
      apiKey: process.env.TOGETHER_API_KEY,
      modelName: 'deepseek-ai/deepseek-llm-67b-chat',
      temperature: 0.7,
    }),
  },
  {
    name: 'together-openchat-3.5',
    instance: new ChatTogetherAI({
      apiKey: process.env.TOGETHER_API_KEY,
      modelName: 'openchat/openchat-3.5-1210',
      temperature: 0.7,
    }),
  },
  {
    name: 'together-gemma-7b',
    instance: new ChatTogetherAI({
      apiKey: process.env.TOGETHER_API_KEY,
      modelName: 'google/gemma-7b-it',
      temperature: 0.7,
    }),
  },
  {
    name: 'together-mythomax-13b',
    instance: new ChatTogetherAI({
      apiKey: process.env.TOGETHER_API_KEY,
      modelName: 'Gryphe/MythoMax-L2-13b-Lite',
      temperature: 0.7,
    }),
  },
  {
    name: 'together-solar-11b',
    instance: new ChatTogetherAI({
      apiKey: process.env.TOGETHER_API_KEY,
      modelName: 'upstage/SOLAR-10.7B-Instruct-v1.0',
      temperature: 0.7,
    }),
  },
];

export const llmRegistry = new Map<string, BaseChatModel>(
  llmConfigs.map(cfg => [cfg.name, cfg.instance])
); 