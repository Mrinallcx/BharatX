import { embedQuery } from './embeddings';
import { getVectorIndex } from './vector-store';

export type RetrievedChunk = {
  text: string;
  pageUrl: string;
  pageTitle: string;
  score: number;
};

/**
 * Embed the user question and search Upstash Vector for the top-k
 * most relevant chunks belonging to the given `siteKey`.
 */
export async function retrieveChunks(
  siteKey: string,
  query: string,
  topK = 6,
): Promise<RetrievedChunk[]> {
  const vecIndex = getVectorIndex();
  if (!vecIndex) return [];

  const queryVector = await embedQuery(query);

  const results = await vecIndex.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter: `siteKey = '${siteKey}'`,
  });

  return results
    .filter((r) => r.metadata && typeof r.metadata === 'object' && 'text' in r.metadata)
    .map((r) => {
      const meta = r.metadata as Record<string, unknown>;
      return {
        text: String(meta.text ?? ''),
        pageUrl: String(meta.pageUrl ?? ''),
        pageTitle: String(meta.pageTitle ?? ''),
        score: r.score ?? 0,
      };
    });
}

/** Format retrieved chunks into a text block for the system prompt. */
export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '';
  const sections = chunks.map(
    (c, i) =>
      `[Source ${i + 1}: "${c.pageTitle || 'Untitled'}" — ${c.pageUrl}]\n${c.text}`,
  );
  return `---BEGIN_SITE_KNOWLEDGE---\n${sections.join('\n\n')}\n---END_SITE_KNOWLEDGE---`;
}
