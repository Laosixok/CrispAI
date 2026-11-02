import type OpenAI from "openai";

export const EMBEDDING_SIZE = 1536;

export function embeddingConfig(env: Record<string, string | undefined>) {
  const dimensions = env.OPENAI_EMBEDDING_DIMENSIONS?.trim();
  if (dimensions && dimensions !== String(EMBEDDING_SIZE)) {
    throw new Error("OPENAI_EMBEDDING_DIMENSIONS 必须为 1536（当前数据库维度）");
  }
  const baseURL = env.OPENAI_EMBEDDING_URL?.trim() || env.OPENAI_URL;
  const apiKey = env.OPENAI_EMBEDDING_KEY?.trim() || env.OPENAI_KEY;
  return {
    baseURL,
    apiKey,
    model: env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
    dimensions: dimensions ? EMBEDDING_SIZE : undefined,
  };
}

export async function requestEmbedding(
  client: Pick<OpenAI, "embeddings">,
  config: ReturnType<typeof embeddingConfig>,
  input: string,
): Promise<number[]> {
  const response = await client.embeddings.create({
    model: config.model,
    input,
    ...(config.dimensions ? { dimensions: config.dimensions } : {}),
    encoding_format: "float",
  });
  const vector = response.data[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_SIZE ||
      !vector.every(value => typeof value === "number" && Number.isFinite(value))) {
    throw new Error(`向量接口必须返回 ${EMBEDDING_SIZE} 维有效数值，实际为 ${Array.isArray(vector) ? vector.length : "空响应"}；请检查向量模型和维度配置`);
  }
  return vector;
}
