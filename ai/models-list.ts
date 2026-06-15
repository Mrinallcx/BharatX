import type { ModelParameters } from './model-types';

export interface Model {
  value: string;
  label: string;
  description: string;
  vision: boolean;
  reasoning: boolean;
  experimental: boolean;
  category: string;
  pdf: boolean;
  pro: boolean;
  requiresAuth: boolean;
  freeUnlimited: boolean;
  maxOutputTokens: number;
  extreme?: boolean;
  fast?: boolean;
  isNew?: boolean;
  comingSoon?: boolean;
  parameters?: ModelParameters;
}

export const DEFAULT_MODEL_ID = 'bharatx-kimi-k2-6-think';

export const SELECTABLE_MODEL_IDS = [
  'bharatx-kimi-k2-6-think',
  'bharatx-qwen-32b',
  'bharatx-gpt-oss-20',
  'bharatx-gpt-oss-safeguard-20',
  'bharatx-grok-4-fast-think',
] as const;

const activeBase = {
  vision: false,
  reasoning: false,
  experimental: false,
  category: 'Free',
  pdf: false,
  pro: false,
  requiresAuth: false,
  freeUnlimited: false,
  comingSoon: false,
} as const;

const bestModelBase = {
  ...activeBase,
  category: 'Best',
} as const;

export const activeGroqModels: Model[] = [
  {
    ...bestModelBase,
    value: 'bharatx-kimi-k2-6-think',
    label: 'Kimi K2.6 Thinking',
    description: "Moonshot AI's advanced reasoning LLM",
    reasoning: true,
    maxOutputTokens: 32768,
    fast: true,
    isNew: true,
  },
  {
    ...activeBase,
    value: 'bharatx-qwen-32b',
    label: 'Qwen 3 32B',
    description: "Alibaba's advanced LLM, powered by Groq",
    maxOutputTokens: 40960,
    extreme: true,
    fast: true,
    isNew: true,
    parameters: { temperature: 0.7, topP: 0.8, topK: 20, minP: 0 },
  },
  {
    ...activeBase,
    value: 'bharatx-gpt-oss-20',
    label: 'GPT OSS 20B',
    description: "OpenAI's open-weight LLM, powered by Groq",
    maxOutputTokens: 16000,
    extreme: true,
    fast: true,
  },
  {
    ...activeBase,
    value: 'bharatx-gpt-oss-safeguard-20',
    label: 'GPT OSS Safeguard 20B',
    description: "OpenAI's safety-focused open-weight LLM, powered by Groq",
    maxOutputTokens: 16000,
    fast: true,
    isNew: true,
  },
  {
    ...bestModelBase,
    value: 'bharatx-grok-4-fast-think',
    label: 'Grok 4 Fast Thinking',
    description: "xAI's fastest multimodel reasoning LLM",
    vision: true,
    reasoning: true,
    maxOutputTokens: 16000,
    extreme: true,
    fast: true,
  },
];

const soon = (model: Omit<Model, 'comingSoon'>): Model => ({ ...model, comingSoon: true });

/** Shown in picker as Coming soon — not selectable for chat. */
export const comingSoonModels: Model[] = [
  soon({
    value: 'bharatx-gpt-oss-120',
    label: 'GPT OSS 120B',
    description: "OpenAI's large open-weight LLM, powered by Groq",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Coming soon',
    pdf: false,
    pro: false,
    requiresAuth: false,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    extreme: true,
    fast: true,
    isNew: true,
  }),
  soon({
    value: 'bharatx-default',
    label: 'Grok 4 Fast',
    description: "xAI's fastest multimodel LLM",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Coming soon',
    pdf: false,
    pro: false,
    requiresAuth: false,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    extreme: true,
    fast: true,
  }),
  soon({
    value: 'bharatx-grok-4',
    label: 'Grok 4',
    description: "xAI's most intelligent LLM",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Coming soon',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
  }),
  soon({
    value: 'bharatx-gpt5',
    label: 'GPT 5',
    description: "OpenAI's flagship LLM",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Coming soon',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    extreme: true,
  }),
  soon({
    value: 'bharatx-google-pro',
    label: 'Gemini 2.5 Pro',
    description: "Google's advanced LLM",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Coming soon',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 10000,
    extreme: true,
  }),
  soon({
    value: 'bharatx-anthropic',
    label: 'Claude Sonnet 4.5',
    description: "Anthropic's latest LLM",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Coming soon',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 8000,
  }),
  soon({
    value: 'bharatx-deepseek-r1',
    label: 'DeepSeek R1',
    description: "DeepSeek's advanced reasoning LLM",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Coming soon',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
  }),
  soon({
    value: 'bharatx-qwen-235',
    label: 'Qwen 3 235B A22B',
    description: "Qwen's large instruct LLM",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Coming soon',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 100000,
  }),
  soon({
    value: 'bharatx-code',
    label: 'Grok Code',
    description: "xAI's advanced coding LLM",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Coming soon',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
  }),
];

export const models: Model[] = [...activeGroqModels, ...comingSoonModels];
