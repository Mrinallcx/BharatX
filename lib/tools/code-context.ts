import { tool } from 'ai';
import { z } from 'zod';
import { serverEnv } from '@/env/server';

export const codeContextTool = tool({
  description: 'Get the context about coding, programming, and development libraries, frameworks, and tools',
  inputSchema: z.object({
    query: z.string().min(1).max(100).describe('The query to search for'),
  }),
  execute: async ({ query }: { query: string }) => {
    const response = await fetch('https://api.exa.ai/context', {
      method: 'POST',
      headers: {
        'x-api-key': serverEnv.EXA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        tokensNum: 'dynamic',
      }),
    });
    const data = await response.json();
    return data;
  },
});
