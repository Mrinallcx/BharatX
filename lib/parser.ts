import type { TextStreamPart, ToolSet } from 'ai';

const LINK_PATTERN = /^\[.*?\]\(.*?\)$/;
const BOLD_PATTERN = /^\*\*.*?\*\*$/;
const ITALIC_PATTERN = /^\*(?!\*).+\*$/;
const TABLE_ROW_PATTERN = /^\|.+\|$/;
const TABLE_DELIMITER_PATTERN = /^\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|\s*$/;
const WHITESPACE_PATTERN = /\s/;

const RICH_TAGS = ['app_preview', 'download'] as const;
const RICH_TAG_OPEN_RE = new RegExp(`<(${RICH_TAGS.join('|')})>`, 'i');

class MarkdownJoiner {
  private buffer = '';
  private bufferMode: 'inline' | 'rich-tag' | null = null;
  private richTagName: string | null = null;
  private tableLineBuffer = '';
  private tableLineMode: 'header' | 'delimiter' | null = null;
  private isAtLineStart = true;
  private isInTable = false;
  private pendingTableHeaderLine: string | null = null;

  processText(text: string): string {
    let output = '';

    for (const char of text) {
      if (this.bufferMode === 'rich-tag') {
        this.buffer += char;
        const closeTag = `</${this.richTagName}>`;
        if (this.buffer.endsWith(closeTag)) {
          output += this.buffer;
          this.richTagName = null;
          this.clearBuffer();
        }
        continue;
      }

      if (this.tableLineMode) {
        this.tableLineBuffer += char;
        if (char === '\n') {
          output += this.flushTableLine();
          this.isAtLineStart = true;
        } else {
          this.isAtLineStart = false;
        }
      } else if (this.bufferMode === 'inline') {
        this.buffer += char;

        if (this.buffer.startsWith('<')) {
          const match = RICH_TAG_OPEN_RE.exec(this.buffer);
          if (match && this.buffer.endsWith('>')) {
            this.richTagName = match[1];
            this.bufferMode = 'rich-tag';
            this.isAtLineStart = false;
            continue;
          }
          if (!this.isFalsePositiveTag(char)) {
            this.isAtLineStart = char === '\n';
            continue;
          }
          output += this.buffer;
          this.clearBuffer();
          this.isAtLineStart = char === '\n';
          continue;
        }

        if (this.isCompleteLink() || this.isCompleteBold() || this.isCompleteItalic()) {
          output += this.buffer;
          this.clearBuffer();
        } else if (this.isFalsePositive(char)) {
          output += this.buffer;
          this.clearBuffer();
        }

        this.isAtLineStart = char === '\n';
      } else {
        if (this.isAtLineStart) {
          if (this.pendingTableHeaderLine) {
            if (char !== '|') {
              output += this.pendingTableHeaderLine;
              this.pendingTableHeaderLine = null;
            } else {
              this.tableLineMode = 'delimiter';
              this.tableLineBuffer = char;
              this.isAtLineStart = false;
              continue;
            }
          }

          if (this.isInTable && char !== '|') this.isInTable = false;

          if (!this.isInTable && !this.pendingTableHeaderLine && char === '|') {
            this.tableLineMode = 'header';
            this.tableLineBuffer = char;
            this.isAtLineStart = false;
            continue;
          }
        }

        if (char === '<') {
          this.buffer = char;
          this.bufferMode = 'inline';
          this.isAtLineStart = false;
          continue;
        }

        if (char === '[' || char === '*') {
          this.buffer = char;
          this.bufferMode = 'inline';
          this.isAtLineStart = false;
          continue;
        }

        output += char;
        this.isAtLineStart = char === '\n';
      }
    }

    return output;
  }

  private flushTableLine(): string {
    const lineWithNewline = this.tableLineBuffer;
    const line = lineWithNewline.endsWith('\n') ? lineWithNewline.slice(0, -1) : lineWithNewline;

    this.tableLineBuffer = '';
    const mode = this.tableLineMode;
    this.tableLineMode = null;

    if (mode === 'header') {
      if (this.isTableHeaderCandidate(line)) {
        this.pendingTableHeaderLine = lineWithNewline;
        return '';
      }

      return lineWithNewline;
    }

    if (mode === 'delimiter') {
      const headerLine = this.pendingTableHeaderLine ?? '';
      this.pendingTableHeaderLine = null;

      if (TABLE_DELIMITER_PATTERN.test(line)) this.isInTable = true;

      return headerLine + lineWithNewline;
    }

    return lineWithNewline;
  }

  private isTableHeaderCandidate(line: string): boolean {
    return TABLE_ROW_PATTERN.test(line) && !TABLE_DELIMITER_PATTERN.test(line);
  }

  private isCompleteLink(): boolean {
    return LINK_PATTERN.test(this.buffer);
  }

  private isCompleteBold(): boolean {
    return BOLD_PATTERN.test(this.buffer);
  }

  private isCompleteItalic(): boolean {
    return ITALIC_PATTERN.test(this.buffer);
  }

  private isFalsePositiveTag(char: string): boolean {
    if (char === '\n' || (char === '<' && this.buffer.length > 1)) return true;
    if (char === '>' && !RICH_TAG_OPEN_RE.test(this.buffer)) return true;
    return false;
  }

  private isFalsePositive(char: string): boolean {
    if (this.buffer.startsWith('[')) {
      return char === '\n' || (char === '[' && this.buffer.length > 1);
    }

    if (this.buffer.startsWith('*')) {
      if (this.buffer.length === 2 && WHITESPACE_PATTERN.test(char)) {
        return true;
      }
      return char === '\n';
    }

    return false;
  }

  private clearBuffer(): void {
    this.buffer = '';
    this.bufferMode = null;
  }

  flush(): string {
    const remaining = (this.pendingTableHeaderLine ?? '') + this.tableLineBuffer + this.buffer;
    this.pendingTableHeaderLine = null;
    this.tableLineBuffer = '';
    this.tableLineMode = null;
    this.clearBuffer();
    return remaining;
  }
}

export const markdownJoinerTransform =
  <TOOLS extends ToolSet>() =>
  () => {
    const joiner = new MarkdownJoiner();
    let lastTextDeltaId: string | null = null;

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        if (!chunk) return;

        if (chunk.type === 'text-delta') {
          const rawText = (chunk as unknown as { text?: unknown }).text;
          if (typeof rawText !== 'string') {
            controller.enqueue(chunk);
            return;
          }

          lastTextDeltaId = chunk.id;
          const processedText = joiner.processText(rawText);
          if (processedText) {
            controller.enqueue({
              ...chunk,
              text: processedText,
            });
          }
        } else {
          controller.enqueue(chunk);
        }
      },
      flush(controller) {
        const remaining = joiner.flush();
        if (remaining) {
          if (!lastTextDeltaId) return;
          controller.enqueue({
            type: 'text-delta',
            id: lastTextDeltaId,
            text: remaining,
          } as TextStreamPart<TOOLS>);
        }
      },
    });
  };
