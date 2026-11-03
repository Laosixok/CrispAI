import OpenAI from "openai";
import { embeddingConfig, requestEmbedding } from "@/utils/embedding";

const openai = new OpenAI({
  baseURL: Bun.env.OPENAI_URL,
  apiKey: Bun.env.OPENAI_KEY,
});

// 对话模型，可换成任何 OpenAI 兼容接口支持的模型
export const CHAT_MODEL = Bun.env.OPENAI_MODEL || "gpt-4.1-nano";
// Saving knowledge, importing knowledge, and searching questions all use this client.
const config = embeddingConfig(Bun.env);
const embeddingClient = new OpenAI({
  baseURL: config.baseURL,
  apiKey: config.apiKey,
});
export const EMBEDDING_MODEL = config.model;
export const EMBEDDING_DIMENSIONS = config.size;

export const createEmbedding = (input: string) =>
  requestEmbedding(embeddingClient, config, input);

export default openai;
