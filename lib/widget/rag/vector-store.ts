import { Index } from '@upstash/vector';
import { serverEnv } from '@/env/server';

let vectorIndex: Index | null | undefined;

/**
 * Lazy-init Upstash Vector client.  Returns `null` when env vars are missing.
 */
export function getVectorIndex(): Index | null {
  if (vectorIndex !== undefined) return vectorIndex;
  const url = serverEnv.WIDGET_VECTOR_REST_URL;
  const token = serverEnv.WIDGET_VECTOR_REST_TOKEN;
  if (!url || !token) {
    console.warn('[widget/rag] WIDGET_VECTOR_REST_URL / TOKEN not set; RAG disabled.');
    vectorIndex = null;
    return null;
  }
  vectorIndex = new Index({ url, token });
  return vectorIndex;
}
