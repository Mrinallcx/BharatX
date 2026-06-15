import { wrapLanguageModel, customProvider, extractReasoningMiddleware } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { xai } from '@ai-sdk/xai';
import { groq } from '@ai-sdk/groq';
import {
  models,
  DEFAULT_MODEL_ID,
  SELECTABLE_MODEL_IDS,
  type Model,
} from './models-list';
import type { ModelParameters } from './model-types';

const middleware = extractReasoningMiddleware({
  tagName: 'think',
});

const moonshot = createOpenAICompatible({
  name: 'moonshot',
  baseURL: 'https://api.moonshot.ai/v1',
  apiKey: process.env.MOONSHOT_API_KEY,
});

/**
 * Agent Thor custom fetch — does two things on every request to Moonshot:
 *
 * Outbound: renames the `kimi_web_search` tool to `$web_search` and changes
 *   its type to `builtin_function` so Moonshot recognises it as its native
 *   built-in search.  Also explicitly disables `thinking` ({ type: 'disabled' }),
 *   which Kimi K2.6 has ON by default. Thinking is incompatible with forced
 *   tool_choice, the builtin $web_search tool, and our multi-step tool flow.
 *
 * Inbound (SSE stream): renames `$web_search` back to `kimi_web_search` in
 *   every chunk so the Vercel AI SDK can match the tool call to our registered
 *   tool definition.  The SDK then calls our execute() which returns an empty
 *   result — Moonshot already ran the search internally and injects real
 *   results into the model's context regardless of what we return.
 */
function createAgentThorFetch(): typeof fetch {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  // Matches the literal JSON key-value `"name":"$web_search"` in any SSE chunk
  const RE = /"name"\s*:\s*"\$web_search"/g;

  return async (url, init) => {
    // ── outbound transform ────────────────────────────────────────────────
    if (init?.body && typeof init.body === 'string') {
      const body = JSON.parse(init.body) as Record<string, unknown>;

      if (Array.isArray(body.tools)) {
        body.tools = (body.tools as any[]).map((t) =>
          t?.function?.name === 'kimi_web_search'
            ? { type: 'builtin_function', function: { name: '$web_search' } }
            : t,
        );
      }

      // Keep tool_choice in sync with the renamed tool. The builtin $web_search
      // can't actually be force-selected, but never leave a dangling reference to
      // kimi_web_search (which no longer exists in body.tools after the rename).
      const tc = body.tool_choice as any;
      if (tc && typeof tc === 'object' && tc.function?.name === 'kimi_web_search') {
        body.tool_choice = 'auto';
      }

      // Kimi K2.6 has thinking ENABLED by default and it must be explicitly disabled
      // (not just omitted). Agent Thor relies on:
      //   - forced/specified tool_choice (incompatible with thinking)
      //   - the builtin $web_search tool (incompatible with K2.6 thinking mode)
      //   - multi-step tool calling (thinking would require preserving reasoning_content
      //     across every turn, which breaks when earlier turns ran without thinking)
      // So thinking is disabled for the entire Agent Thor flow to keep every step valid.
      body.thinking = { type: 'disabled' };

      init = { ...init, body: JSON.stringify(body) };
    }

    const response = await fetch(url as RequestInfo, init);
    if (!response.body) return response;

    // ── inbound SSE stream transform ──────────────────────────────────────
    // Buffer across chunk boundaries so we never split a JSON token.
    let leftover = '';
    const transformed = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctrl) {
          leftover += dec.decode(chunk, { stream: true });
          const lines = leftover.split('\n');
          leftover = lines.pop() ?? '';
          ctrl.enqueue(
            enc.encode(
              lines.map((l) => l.replace(RE, '"name":"kimi_web_search"')).join('\n') + '\n',
            ),
          );
        },
        flush(ctrl) {
          if (leftover) {
            ctrl.enqueue(enc.encode(leftover.replace(RE, '"name":"kimi_web_search"')));
          }
        },
      }),
    );

    return new Response(transformed, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

const moonshotAgentThorProvider = createOpenAICompatible({
  name: 'moonshot-thor',
  baseURL: 'https://api.moonshot.ai/v1',
  apiKey: process.env.MOONSHOT_API_KEY,
  fetch: createAgentThorFetch(),
});

/** Kimi K2.6 with Moonshot $web_search builtin + thinking on synthesis steps. */
export const moonshotAgentThorModel = moonshotAgentThorProvider('kimi-k2.6');

const groqQwen32b = wrapLanguageModel({
  model: groq('qwen/qwen3-32b'),
  middleware,
});

const groqGptOss20 = wrapLanguageModel({
  model: groq('openai/gpt-oss-20b'),
  middleware,
});

const groqGptOssSafeguard20 = wrapLanguageModel({
  model: groq('openai/gpt-oss-safeguard-20b'),
  middleware,
});

const moonshotKimiK26Think = moonshot('kimi-k2.6');

const groqFollowUp = groq('qwen/qwen3-32b');

export const bharatX = customProvider({
  languageModels: {
    // Active Groq models (user-selectable)
    'bharatx-qwen-32b': groqQwen32b,
    'bharatx-gpt-oss-20': groqGptOss20,
    'bharatx-gpt-oss-safeguard-20': groqGptOssSafeguard20,
    // Active xAI / Moonshot models (user-selectable)
    'bharatx-grok-4-fast-think': xai('grok-4-fast'),
    'bharatx-kimi-k2-6-think': moonshotKimiK26Think,
    // Internal / legacy aliases
    'bharatx-default': moonshotKimiK26Think,
    'bharatx-widget': groqGptOss20,
    'bharatx-grok-4-fast': xai('grok-4-fast-non-reasoning'),
    'bharatx-follow-up': groqFollowUp,
    'bharatx-name': groqGptOss20,
    'bharatx-enhance': groq('moonshotai/kimi-k2-instruct-0905'),
    'bharatx-nano': groq('llama-3.3-70b-versatile'),
  },
});

export { models, DEFAULT_MODEL_ID, SELECTABLE_MODEL_IDS };
export type { Model };

export function isModelComingSoon(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return Boolean(model?.comingSoon);
}

export function isSelectableModel(modelValue: string): boolean {
  return (SELECTABLE_MODEL_IDS as readonly string[]).includes(modelValue);
}

export function getModelConfig(modelValue: string) {
  return models.find((model) => model.value === modelValue);
}

export function requiresAuthentication(_modelValue: string): boolean {
  return false;
}

export function requiresProSubscription(_modelValue: string): boolean {
  return false;
}

export function isFreeUnlimited(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.freeUnlimited || false;
}

export function hasVisionSupport(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.vision || false;
}

export function hasPdfSupport(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.pdf || false;
}

export function hasReasoningSupport(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.reasoning || false;
}

export function isExperimentalModel(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.experimental || false;
}

export function getMaxOutputTokens(modelValue: string): number {
  const model = getModelConfig(modelValue);
  return model?.maxOutputTokens || 8000;
}

export function getModelParameters(modelValue: string): ModelParameters {
  const model = getModelConfig(modelValue);
  return model?.parameters || {};
}

export function canUseModel(modelValue: string, _user: unknown, _isProUser: boolean): { canUse: boolean; reason?: string } {
  const model = getModelConfig(modelValue);

  if (!model) {
    return { canUse: false, reason: 'Model not found' };
  }

  if (model.comingSoon || !isSelectableModel(modelValue)) {
    return { canUse: false, reason: 'Model coming soon' };
  }

  return { canUse: true };
}

export function shouldBypassRateLimits(_modelValue: string, _user: unknown): boolean {
  return true;
}

export function getAcceptedFileTypes(modelValue: string, isProUser: boolean): string {
  const model = getModelConfig(modelValue);
  if (model?.pdf && isProUser) {
    return 'image/*,.pdf';
  }
  return 'image/*';
}

export function supportsExtremeMode(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.extreme || false;
}

export function getExtremeModels(): Model[] {
  return models.filter((model) => model.extreme && !model.comingSoon);
}

const RESTRICTED_REGIONS = ['CN', 'KP', 'RU'];

const OPENAI_MODELS = ['bharatx-gpt-oss-20', 'bharatx-gpt-oss-safeguard-20'];

const ANTHROPIC_MODELS = ['bharatx-anthropic'];

export function isModelRestrictedInRegion(modelValue: string, countryCode?: string): boolean {
  if (!countryCode) return false;

  const isRestricted = RESTRICTED_REGIONS.includes(countryCode.toUpperCase());
  if (!isRestricted) return false;

  return OPENAI_MODELS.includes(modelValue) || ANTHROPIC_MODELS.includes(modelValue);
}

export function getFilteredModels(countryCode?: string): Model[] {
  if (!countryCode || !RESTRICTED_REGIONS.includes(countryCode.toUpperCase())) {
    return models;
  }

  return models.filter((model) => !isModelRestrictedInRegion(model.value, countryCode));
}

export const authRequiredModels = models.filter((m) => m.requiresAuth).map((m) => m.value);
export const proRequiredModels = models.filter((m) => m.pro).map((m) => m.value);
export const freeUnlimitedModels = models.filter((m) => m.freeUnlimited).map((m) => m.value);
