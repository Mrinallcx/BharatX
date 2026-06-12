import Firecrawl from '@mendable/firecrawl-js';
import { serverEnv } from '@/env/server';
import { chunkText, type TextChunk } from './chunker';
import { embedTexts } from './embeddings';
import { getVectorIndex } from './vector-store';

export type IngestResult = {
  pagesProcessed: number;
  chunksIndexed: number;
  errors: string[];
};

/**
 * Crawl a site with Firecrawl v2, chunk the content, embed with Gemini,
 * and upsert into Upstash Vector. Vectors are filtered by `siteKey`.
 */
export async function ingestSite(
  siteKey: string,
  crawlUrl: string,
  opts?: { maxPages?: number },
): Promise<IngestResult> {
  const vecIndex = getVectorIndex();
  if (!vecIndex) {
    throw new Error('Vector store not configured (WIDGET_VECTOR_REST_URL / TOKEN missing)');
  }

  const firecrawl = new Firecrawl({ apiKey: serverEnv.FIRECRAWL_API_KEY });

  console.log(`[widget/rag] Crawling ${crawlUrl} for siteKey=${siteKey}…`);
  const crawlResult = await firecrawl.crawl(crawlUrl, {
    limit: opts?.maxPages ?? 200,
    scrapeOptions: { formats: ['markdown'] },
  });

  const pages = crawlResult.data ?? [];
  console.log(`[widget/rag] Crawled ${pages.length} pages.`);

  const allChunks: TextChunk[] = [];
  const errors: string[] = [];

  for (const page of pages) {
    const text = page.markdown ?? '';
    if (text.trim().length < 80) continue;
    try {
      const chunks = chunkText(text, {
        pageUrl: page.metadata?.url ?? '',
        pageTitle: page.metadata?.title ?? '',
      });
      allChunks.push(...chunks);
    } catch (e) {
      errors.push(`Chunk error for ${page.metadata?.url}: ${(e as Error).message}`);
    }
  }

  if (allChunks.length === 0) {
    return { pagesProcessed: pages.length, chunksIndexed: 0, errors };
  }

  console.log(`[widget/rag] Embedding ${allChunks.length} chunks…`);
  const vectors = await embedTexts(allChunks.map((c) => c.text));

  const upsertBatch = 50;
  let indexed = 0;

  for (let i = 0; i < allChunks.length; i += upsertBatch) {
    const batch = allChunks.slice(i, i + upsertBatch);
    const batchVectors = vectors.slice(i, i + upsertBatch);

    const records = batch.map((chunk, j) => ({
      id: `${siteKey}:${chunk.pageUrl}:${chunk.index}`,
      vector: batchVectors[j]!,
      metadata: {
        siteKey,
        pageUrl: chunk.pageUrl,
        pageTitle: chunk.pageTitle,
        chunkIndex: chunk.index,
        text: chunk.text.slice(0, 3600),
      },
    }));

    await vecIndex.upsert(records);
    indexed += records.length;
  }

  console.log(`[widget/rag] Indexed ${indexed} chunks for siteKey=${siteKey}.`);
  return { pagesProcessed: pages.length, chunksIndexed: indexed, errors };
}
