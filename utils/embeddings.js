import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    throw new Error('Vectors must be same length');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function getEmbeddingForText(text) {
  const clean = (text || "").trim();
  if (!clean) {
    throw new Error("Cannot embed an empty text");
  }

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: clean,
  });

  const embedding = response.data[0]?.embedding;

  
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Invalid embedding response');
  }

  return embedding;
}


