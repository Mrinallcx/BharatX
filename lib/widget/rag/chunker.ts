export type TextChunk = {
  text: string;
  index: number;
  pageUrl: string;
  pageTitle: string;
};

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 200;

/**
 * Split text into overlapping chunks of roughly `chunkSize` characters,
 * breaking at paragraph / sentence boundaries when possible.
 */
export function chunkText(
  text: string,
  opts?: { chunkSize?: number; overlap?: number; pageUrl?: string; pageTitle?: string },
): TextChunk[] {
  const chunkSize = opts?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = opts?.overlap ?? DEFAULT_OVERLAP;
  const pageUrl = opts?.pageUrl ?? '';
  const pageTitle = opts?.pageTitle ?? '';

  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);

    if (end < clean.length) {
      const window = clean.slice(Math.max(start, end - 120), end);
      const parBreak = window.lastIndexOf('\n\n');
      if (parBreak !== -1) {
        end = Math.max(start, end - 120) + parBreak + 2;
      } else {
        const sentEnd = window.search(/[.!?]\s+(?=[A-Z])/);
        if (sentEnd !== -1) {
          end = Math.max(start, end - 120) + sentEnd + 2;
        }
      }
    }

    const segment = clean.slice(start, end).trim();
    if (segment.length > 30) {
      chunks.push({ text: segment, index, pageUrl, pageTitle });
      index++;
    }

    start = end - overlap;
    if (start >= clean.length) break;
    if (end >= clean.length) break;
  }

  return chunks;
}
