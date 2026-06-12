// /app/api/chat/route.ts
import {
  generateTitleFromUserMessage,
  getGroupConfig,
  getUserMessageCount,
  getExtremeSearchUsageCount,
  getCurrentUser,
  getLightweightUser,
} from '@/app/actions';
import {
  convertToModelMessages,
  streamText,
  pruneMessages,
  NoSuchToolError,
  createUIMessageStream,
  generateObject,
  stepCountIs,
  JsonToSseTransformStream,
} from 'ai';
import { createMemoryTools } from '@/lib/tools/supermemory';
import {
  bharatX,
  shouldBypassRateLimits,
  getModelParameters,
  hasReasoningSupport,
} from '@/ai/providers';
import { xai } from '@ai-sdk/xai';
import {
  createStreamId,
  getChatById,
  saveChat,
  saveMessages,
  incrementExtremeSearchUsage,
  incrementMessageUsage,
  updateChatTitleById,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { createResumableStreamContext, type ResumableStreamContext } from 'resumable-stream';
import { after } from 'next/server';
import { CustomInstructions } from '@/lib/db/schema';
import { v7 as uuidv7 } from 'uuid';
import { geolocation } from '@vercel/functions';

import {
  stockChartTool,
  currencyConverterTool,
  xSearchTool,
  textTranslateTool,
  webSearchTool,
  movieTvSearchTool,
  trendingMoviesTool,
  trendingTvTool,
  academicSearchTool,
  youtubeSearchTool,
  retrieveTool,
  weatherTool,
  codeInterpreterTool,
  findPlaceOnMapTool,
  nearbyPlacesSearchTool,
  flightTrackerTool,
  coinDataTool,
  coinDataByContractTool,
  coinOhlcTool,
  datetimeTool,
  greetingTool,
  // mcpSearchTool,
  redditSearchTool,
  extremeSearchTool,
  createConnectorsSearchTool,
  codeContextTool,
  predictionSearchTool,
} from '@/lib/tools';
import { GroqProviderOptions } from '@ai-sdk/groq';
import { markdownJoinerTransform } from '@/lib/parser';
import { ChatMessage } from '@/lib/types';
import { OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { getCachedCustomInstructionsByUserId } from '@/lib/user-data-server';
import { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { unauthenticatedRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { CohereChatModelOptions } from '@ai-sdk/cohere';
import { isSearchGroupComingSoon } from '@/lib/utils';

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
        keyPrefix: 'bharatx-ai',
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(' > Resumable streams are disabled due to missing REDIS_URL');
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(req: Request) {
  const requestStartTime = Date.now();
  const {
    messages,
    model,
    group,
    timezone,
    id,
    selectedVisibilityType,
    isCustomInstructionsEnabled,
    searchProvider,
    selectedConnectors,
  } = await req.json();
  const { latitude, longitude } = geolocation(req);
  const streamId = 'stream-' + uuidv7();

  console.log('🔍 Search API:', { model: model.trim(), group, latitude, longitude });

  // Get auth status (optional - guest users allowed)
  const lightweightUser = await getLightweightUser();

  // ALL FEATURES AVAILABLE TO EVERYONE - NO RESTRICTIONS
  // Treat all users (including guests) as Pro users with full access
  const isProUser = true; // Always true - all features free for everyone

  const effectiveGroup = isSearchGroupComingSoon(group) ? 'web' : group;

  // Per-request config only — never share a module-level promise: concurrent or
  // back-to-back POSTs would overwrite it and the wrong search mode's tools/prompt
  // would be used (e.g. X mode getting web/stocks tools mid-chat).
  const groupConfigPromise = getGroupConfig(effectiveGroup);

  // 2. Full user data (needed for usage checks and custom instructions)
  const fullUserPromise = lightweightUser ? getCurrentUser() : Promise.resolve(null);

  // 3. Custom instructions (only if enabled and authenticated)
  const customInstructionsPromise = lightweightUser && (isCustomInstructionsEnabled ?? true)
    ? fullUserPromise.then(user => user ? getCachedCustomInstructionsByUserId(user.id) : null)
    : Promise.resolve(null);

  // 4. For authenticated users: start ALL operations in parallel
  let criticalChecksPromise: Promise<{
    canProceed: boolean;
    error?: any;
    isProUser: boolean;
    messageCount?: number;
    extremeSearchUsage?: number;
    subscriptionData?: any;
    shouldBypassLimits?: boolean;
  }>;

  if (lightweightUser) {
    // Chat validation and creation (must be synchronous for DB consistency)
    const chatValidationPromise = getChatById({ id }).then(async (existingChat) => {
      // Validate ownership if chat exists
      if (existingChat && existingChat.userId !== lightweightUser.userId) {
        throw new ChatSDKError('forbidden:chat', 'This chat belongs to another user');
      }

      // Create chat if it doesn't exist (MUST be sync - other operations depend on it)
      if (!existingChat) {
        await saveChat({
          id,
          userId: lightweightUser.userId,
          title: 'New Chat',
          visibility: selectedVisibilityType,
        });

        // Generate better title in background (non-critical)
        after(async () => {
          try {
            const title = await generateTitleFromUserMessage({
              message: messages[messages.length - 1],
            });
            await updateChatTitleById({ chatId: id, title });
          } catch (error) {
            console.error('Background title generation failed:', error);
          }
        });
      }

      // Stream tracking (must be sync for proper stream management)
      await createStreamId({ streamId, chatId: id });

      return existingChat;
    });

    // All users (including guests) get Pro access - no restrictions
    criticalChecksPromise = Promise.all([
      fullUserPromise,
      chatValidationPromise,
    ]).then(([user]) => ({
      canProceed: true,
      isProUser: true, // Always true - all features free
      messageCount: 0,
      extremeSearchUsage: 0,
      subscriptionData: user?.polarSubscription
        ? { hasSubscription: true, subscription: { ...user.polarSubscription, organizationId: null } }
        : { hasSubscription: false },
      shouldBypassLimits: true, // Always bypass limits
    }));
  } else {
    // Guest users: full access, no restrictions
    criticalChecksPromise = Promise.resolve({
      canProceed: true,
      isProUser: true, // Guests get Pro access
      messageCount: 0,
      extremeSearchUsage: 0,
      subscriptionData: null,
      shouldBypassLimits: true, // Always bypass limits
    });
  }

  let customInstructions: CustomInstructions | null = null;

  // Start streaming immediately while background operations continue
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer: dataStream }) => {
      // Wait for critical checks and config in parallel (only what's needed to start streaming)
      const [criticalResult, { tools: activeTools, instructions }, customInstructionsResult, user] = await Promise.all([
        criticalChecksPromise,
        groupConfigPromise,
        customInstructionsPromise,
        fullUserPromise,
      ]);

      if (!criticalResult.canProceed) {
        throw criticalResult.error;
      }

      customInstructions = customInstructionsResult;

      // Ensure activeTools is always an array
      const safeActiveTools = Array.isArray(activeTools) ? activeTools : [];

      // Save user message BEFORE streaming (critical for conversation history)
      if (user) {
        await saveMessages({
          messages: [{
            chatId: id,
            id: messages[messages.length - 1].id,
            role: 'user',
            parts: messages[messages.length - 1].parts,
            attachments: messages[messages.length - 1].experimental_attachments ?? [],
            createdAt: new Date(),
            model: model,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            completionTime: 0,
          }],
        });
      }

      const shouldUseXaiMultiAgent = group === 'multi-agent' && !isSearchGroupComingSoon('multi-agent');

      const setupTime = (Date.now() - requestStartTime) / 1000;
      console.log(`🚀 Time to streamText: ${setupTime.toFixed(2)}s`, shouldUseXaiMultiAgent ? '(multi-agent mode)' : '');

      const streamStartTime = Date.now();

      const result = streamText({
        model: shouldUseXaiMultiAgent ? xai.responses('grok-4.20-multi-agent') : bharatX.languageModel(model),
        messages: await convertToModelMessages(messages),
        ...getModelParameters(shouldUseXaiMultiAgent ? 'grok-4.20-multi-agent' : model),
        stopWhen: stepCountIs(shouldUseXaiMultiAgent ? 5 : 5),
        onAbort: ({ steps }) => {
          console.log('Stream aborted after', steps.length, 'steps');
        },
        maxRetries: 10,
        activeTools: shouldUseXaiMultiAgent ? ['xai_web_search', 'xai_x_search'] : safeActiveTools,
        experimental_transform: markdownJoinerTransform(),
        system:
          instructions +
          (customInstructions && (isCustomInstructionsEnabled ?? true)
            ? `\n\nThe user's custom instructions are as follows and YOU MUST FOLLOW THEM AT ALL COSTS: ${customInstructions?.content}`
            : '\n') +
          (latitude && longitude ? `\n\nThe user's location is ${latitude}, ${longitude}.` : '') +
          (shouldUseXaiMultiAgent
            ? '\n\nWhen multi-agent mode is enabled, you are operating in a high-agency research workflow. Use only the xAI server-side web search and X search tools available in this environment. Do not call any other research or search tools.\n\nYour job is to behave like a rigorous research analyst:\n- Break the request into sub-questions when useful.\n- Search broadly first, then narrow based on what you find.\n- Use multiple searches when the topic is ambiguous, fast-moving, comparative, or requires validation.\n- Cross-check important claims across multiple sources whenever possible.\n- Prefer recent and primary sources for news, releases, product changes, pricing, benchmarks, and policy updates.\n- Use X search when social signals, firsthand announcements, or fast-moving discourse are relevant.\n- Use web search when you need official documentation, articles, product pages, blogs, papers, or other published sources.\n- If both web and X are relevant, use both.\n\nOutput requirements:\n- Synthesize findings into a clear, direct answer instead of narrating every search step.\n- Be concise but complete.\n- Include uncertainty when evidence is mixed, incomplete, or time-sensitive.\n- Do not fabricate facts, sources, timelines, quotes, or consensus.\n- If you cannot verify a claim well enough, say so plainly.\n- Ground the final answer in the sources you found and make sure the answer actually reflects them.\n\nResponse structure guidelines:\n- Start with a direct answer or conclusion in 1-3 sentences.\n- Then present the most important findings as short sections or bullet points.\n- For comparative questions, explicitly compare the options point-by-point.\n- For fast-moving topics, clearly separate confirmed facts from tentative signals.\n- End with a brief takeaway, recommendation, or next step when useful.\n- Keep the response skimmable and avoid long, repetitive paragraphs.\n\nTool behavior requirements:\n- Do not mention internal tool limitations unless necessary.\n- Do not ask for permission to search.\n- Do not stop after a single weak search if the question clearly needs deeper verification.\n- Avoid redundant searches that do not add evidence.\n- Prefer quality of evidence over quantity of searches.'
            : ''),
        toolChoice: 'auto',
        providerOptions: {
          gateway: {
            only: ['zai', 'deepseek', 'alibaba', 'baseten'],
          },
          openai: {
            ...(model !== 'bharatx-qwen-coder'
              ? {
                parallelToolCalls: false,
              }
              : {}),
            ...((model === 'bharatx-gpt5' ||
              model === 'bharatx-gpt5-mini' ||
              model === 'bharatx-o3' ||
              model === 'bharatx-gpt5-nano' ||
              model === 'bharatx-gpt5-codex' ||
              model === 'bharatx-gpt5-medium' ||
              model === 'bharatx-o4-mini' ||
              model === 'bharatx-gpt-4.1' ||
              model === 'bharatx-gpt-4.1-mini' ||
              model === 'bharatx-gpt-4.1-nano'
              ? {
                reasoningEffort: (
                  model === 'bharatx-gpt5-nano' ||
                    model === 'bharatx-gpt5' ||
                    model === 'bharatx-gpt5-mini' ?
                    'minimal' :
                    'medium'
                ),
                promptCacheKey: 'bharatx-oai',
                parallelToolCalls: false,
                reasoningSummary: 'detailed',
                textVerbosity: (model === 'bharatx-o3' || model === 'bharatx-gpt5-codex' || model === 'bharatx-o4-mini' || model === 'bharatx-gpt-4.1' || model === 'bharatx-gpt-4.1-mini' || model === 'bharatx-gpt-4.1-nano' ? 'medium' : 'high'),
              }
              : {}) satisfies OpenAIResponsesProviderOptions),
          },
          deepseek: {
            parallelToolCalls: false,
          },
          groq: {
            ...(model === 'bharatx-gpt-oss-20' || model === 'bharatx-gpt-oss-120'
              ? {
                reasoningEffort: 'high',
                reasoningFormat: 'hidden',
              }
              : {}),
            ...(model === 'bharatx-qwen-32b'
              ? {
                reasoningEffort: 'none',
              }
              : {}),
            parallelToolCalls: false,
            structuredOutputs: true,
            serviceTier: 'auto',
          } satisfies GroqProviderOptions,
          xai: shouldUseXaiMultiAgent
            ? {
                reasoningEffort: 'high',
                parallel_function_calling: true,
                parallel_tool_calls: true,
                parallelToolCalls: true,
              }
            : {
                parallel_tool_calls: false,
              },
          cohere: {
            ...(model === 'bharatx-cmd-a-think'
              ? {
                thinking: {
                  type: 'enabled',
                  tokenBudget: 1000,
                },
              }
              : {}),
          } satisfies CohereChatModelOptions,
          anthropic: {
            ...(model === 'bharatx-anthropic-think'
              ? {
                sendReasoning: true,
                thinking: {
                  type: 'enabled',
                  budgetTokens: 4000,
                },
              }
              : {}),
            disableParallelToolUse: true,
          } satisfies AnthropicProviderOptions,
          google: {
            ...(model === 'bharatx-google-think' || model === 'bharatx-google-pro-think'
              ? {
                thinkingConfig: {
                  thinkingBudget: 400,
                  includeThoughts: true,
                },
              }
              : {}),
            threshold: "OFF"
          } satisfies GoogleGenerativeAIProviderOptions,
          moonshot: {
            ...(model === 'bharatx-kimi-k2-6-think'
              ? {
                thinking: {
                  type: 'enabled',
                  keep: 'all',
                },
              }
              : {}),
          },
        },
        prepareStep: async ({ steps, messages }) => {
          // Multi-agent mode: keep tools available across all steps
          if (shouldUseXaiMultiAgent) {
            return {
              toolChoice: 'auto' as const,
              activeTools: ['xai_web_search', 'xai_x_search'],
            };
          }

          // Calculate total token usage across all steps
          const totalTokens = steps.reduce((sum, step) => sum + (step.usage?.totalTokens ?? 0), 0);

          // Check if we need to prune messages
          const shouldPrune = messages.length > 10 || totalTokens > 100000;
          
          // Always check if model supports reasoning
          const modelHasReasoning = hasReasoningSupport(model);

          let prunedMessages = messages;
          
          if (!modelHasReasoning) {
            prunedMessages = pruneMessages({
              messages,
              reasoning: 'all',
              toolCalls: shouldPrune ? 'before-last-2-messages' : 'none',
              emptyMessages: shouldPrune ? 'remove' : 'keep',
            });
            console.log(`🧹 Removed reasoning content for non-reasoning model (${messages.length} → ${prunedMessages.length} messages)`);
          } else if (shouldPrune) {
            console.log(`🔧 Pruning messages: ${messages.length} messages, ${totalTokens} tokens used`);
            prunedMessages = pruneMessages({
              messages,
              toolCalls: 'before-last-2-messages',
              emptyMessages: 'remove',
            });
            console.log(`✂️ Pruned to ${prunedMessages.length} messages`);
          }

          if (steps.length > 0) {
            const lastStep = steps[steps.length - 1];

            if (lastStep.toolCalls.length > 0 && lastStep.toolResults.length > 0) {
              return {
                toolChoice: 'none',
                activeTools: [],
                messages: (!modelHasReasoning || shouldPrune) ? prunedMessages : undefined,
              };
            }
          }

          return (!modelHasReasoning || shouldPrune) ? { messages: prunedMessages } : undefined;
        },
        tools: (() => {
          const baseTools = {
            stock_chart: stockChartTool,
            currency_converter: currencyConverterTool,
            coin_data: coinDataTool,
            coin_data_by_contract: coinDataByContractTool,
            coin_ohlc: coinOhlcTool,

            x_search: xSearchTool,
            web_search: webSearchTool(dataStream, searchProvider),
            academic_search: academicSearchTool,
            youtube_search: youtubeSearchTool,
            reddit_search: redditSearchTool,
            retrieve: retrieveTool,

            movie_or_tv_search: movieTvSearchTool,
            trending_movies: trendingMoviesTool,
            trending_tv: trendingTvTool,

            find_place_on_map: findPlaceOnMapTool,
            nearby_places_search: nearbyPlacesSearchTool,
            get_weather_data: weatherTool,

            text_translate: textTranslateTool,
            code_interpreter: codeInterpreterTool,
            track_flight: flightTrackerTool,
            datetime: datetimeTool,
            extreme_search: extremeSearchTool(dataStream),
            greeting: greetingTool(timezone),
            code_context: codeContextTool,
            prediction_search: predictionSearchTool(dataStream),
          };

          const toolsWithXai = shouldUseXaiMultiAgent
            ? {
                ...baseTools,
                xai_web_search: xai.tools.webSearch(),
                xai_x_search: xai.tools.xSearch(),
              }
            : baseTools;

          if (!user) {
            return toolsWithXai;
          }

          const memoryTools = createMemoryTools(user.id);
          return {
            ...toolsWithXai,
            search_memories: memoryTools.searchMemories as any,
            add_memory: memoryTools.addMemory as any,
            connectors_search: createConnectorsSearchTool(user.id, selectedConnectors),
          } as any;
        })(),
        experimental_repairToolCall: async ({ toolCall, tools, inputSchema, error }) => {
          if (NoSuchToolError.isInstance(error)) {
            return null;
          }

          console.log('Fixing tool call================================');
          console.log('toolCall', toolCall);
          console.log('tools', tools);
          console.log('parameterSchema', inputSchema);
          console.log('error', error);

          const tool = tools[toolCall.toolName as keyof typeof tools];

          if (!tool) {
            return null;
          }

          const { object: repairedArgs } = await generateObject({
            model: bharatX.languageModel('bharatx-grok-4-fast'),
            schema: tool.inputSchema,
            prompt: [
              `The model tried to call the tool "${toolCall.toolName}"` + ` with the following arguments:`,
              JSON.stringify(toolCall.input),
              `The tool accepts the following schema:`,
              JSON.stringify(inputSchema(toolCall)),
              'Please fix the arguments.',
              'For the code interpreter tool do not use print statements.',
              `For the web search make multiple queries to get the best results but avoid using the same query multiple times and do not use te include and exclude parameters.`,
              `Today's date is ${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}`,
            ].join('\n'),
          });

          console.log('repairedArgs', repairedArgs);

          return { ...toolCall, args: JSON.stringify(repairedArgs) };
        },
        onChunk(event) {
          if (event.chunk.type === 'tool-call') {
            console.log('Called Tool: ', event.chunk.toolName);
          }
        },
        onStepFinish(event) {
          console.log('Step Request:', event.request);
          if (event.warnings) {
            console.log('Warnings: ', event.warnings);
          }
        },
        onFinish: async (event) => {
          const processingTime = (Date.now() - requestStartTime) / 1000;
          console.log(`✅ Request completed: ${processingTime.toFixed(2)}s (${event.finishReason})`);

          if (user?.id && event.finishReason === 'stop') {
            // Track usage in background
            after(async () => {
              try {
                if (!shouldBypassRateLimits(model, user)) {
                  await incrementMessageUsage({ userId: user.id });
                }

                // Track extreme search usage if used
                if (group === 'extreme') {
                  const extremeSearchUsed = event.steps?.some((step) =>
                    step.toolCalls?.some((toolCall) => toolCall && toolCall.toolName === 'extreme_search'),
                  );
                  if (extremeSearchUsed) {
                    await incrementExtremeSearchUsage({ userId: user.id });
                  }
                }
              } catch (error) {
                console.error('Failed to track usage:', error);
              }
            });
          }
        },
        onError(event) {
          const processingTime = (Date.now() - requestStartTime) / 1000;
          console.error(`❌ Request failed: ${processingTime.toFixed(2)}s`, event.error);
        },
      });

      dataStream.merge(
        result.toUIMessageStream({
          sendReasoning: true,
          sendSources: shouldUseXaiMultiAgent,
          messageMetadata: ({ part }) => {
            if (part.type === 'finish') {
              console.log('Finish part: ', part);
              const processingTime = (Date.now() - streamStartTime) / 1000;
              return {
                model: model as string,
                createdAt: new Date().toISOString(),
                multiAgentMode: shouldUseXaiMultiAgent,
                completionTime: processingTime,
                totalTokens: part.totalUsage?.totalTokens ?? null,
                inputTokens: part.totalUsage?.inputTokens ?? null,
                outputTokens: part.totalUsage?.outputTokens ?? null,
              };
            }

            return {
              model: model as string,
              createdAt: new Date().toISOString(),
              multiAgentMode: shouldUseXaiMultiAgent,
              completionTime: null,
              inputTokens: null,
              outputTokens: null,
              totalTokens: null,
            };
          },
        }),
      );

      // Consume the original stream after we've attached it to the UI stream.
      // This prevents intermittent undefined chunks during piping.
      result.consumeStream();
    },
    onError(error) {
      console.log('Error: ', error);
      if (error instanceof Error && error.message.includes('Rate Limit')) {
        return 'Oops, you have reached the rate limit! Please try again later.';
      }
      return 'Oops, an error occurred!';
    },
    onFinish: async ({ messages }) => {
      if (lightweightUser) {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
            model: model,
            completionTime: message.metadata?.completionTime ?? 0,
            inputTokens: message.metadata?.inputTokens ?? 0,
            outputTokens: message.metadata?.outputTokens ?? 0,
            totalTokens: message.metadata?.totalTokens ?? 0,
          })),
        });
      }
    },
  });
  // const streamContext = getStreamContext();

  // if (streamContext) {
  //   return new Response(
  //     await streamContext.resumableStream(streamId, () => stream.pipeThrough(new JsonToSseTransformStream())),
  //   );
  // }
  return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
}
