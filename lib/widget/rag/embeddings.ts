import { embedMany, embed } from 'ai';
import { google } from '@ai-sdk/google';

const EMBEDDING_MODEL_ID = 'gemini-embedding-001';
const OUTPUT_DIMENSIONS = 768;

const model = google.embedding(EMBEDDING_MODEL_ID);

/** Embed a single query string. Returns a float array. */
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model,
    value: text,
    providerOptions: {
      google: {
        outputDimensionality: OUTPUT_DIMENSIONS,
        taskType: 'RETRIEVAL_QUERY',
      },
    },
  });
  return embedding;
}

/** Embed multiple texts in one call (used during ingest). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model,
      values: batch,
      providerOptions: {
        google: {
          outputDimensionality: OUTPUT_DIMENSIONS,
          taskType: 'RETRIEVAL_DOCUMENT',
        },
      },
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
