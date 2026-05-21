// /app/api/lookout/route.ts
import { generateTitleFromUserMessage } from '@/app/actions';
import { convertToModelMessages, streamText, createUIMessageStream, stepCountIs, JsonToSseTransformStream } from 'ai';
import { bharatX } from '@/ai/providers';
import {
  createStreamId,
  saveChat,
  saveMessages,
  incrementExtremeSearchUsage,
  updateChatTitleById,
  getLookoutById,
  updateLookoutLastRun,
  updateLookout,
  updateLookoutStatus,
  getUserById,
} from '@/lib/db/queries';
import { createResumableStreamContext, type ResumableStreamContext } from 'resumable-stream';
import { after } from 'next/server';
import { v7 as uuidv7 } from 'uuid';
import { CronExpressionParser } from 'cron-parser';
import { sendLookoutCompletionEmail } from '@/lib/email';
import { db } from '@/lib/db';
import { subscription, payment } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

import {
  extremeSearchTool,
  webSearchTool,
  academicSearchTool,
  youtubeSearchTool,
  redditSearchTool,
  stockChartTool,
  indianStockChartTool,
  currencyConverterTool,
  coinDataTool,
  coinOhlcTool,
  coinDataByContractTool,
  codeContextTool,
  xSearchTool,
  datetimeTool,
  greetingTool,
  retrieveTool,
  weatherTool,
  codeInterpreterTool,
  findPlaceOnMapTool,
  nearbyPlacesSearchTool,
  flightTrackerTool,
  movieTvSearchTool,
  trendingMoviesTool,
  trendingTvTool,
  textTranslateTool,
  predictionSearchTool,
  binanceTickerTool,
  binanceKlineTool,
  binanceOrderbookTool,
  growwQuoteTool,
  growwHistoricalCandleTool,
  growwPriceForecastTool,
} from '@/lib/tools';
import { ChatMessage } from '@/lib/types';
import { type UIMessageStreamWriter } from 'ai';

function truncateMarkdown(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const softLimit = Math.min(text.length, maxLength + 400);
  let cutIndex = maxLength;

  const nextNewlineIndex = text.indexOf('\n\n', cutIndex);
  if (nextNewlineIndex !== -1 && nextNewlineIndex <= softLimit) {
    cutIndex = nextNewlineIndex;
  } else {
    const sentenceEnd = text.lastIndexOf('. ', cutIndex);
    if (sentenceEnd > maxLength - 200) cutIndex = sentenceEnd + 1;
  }

  return text.slice(0, cutIndex).trimEnd();
}

const STATIC_TOOLS: Record<string, any> = {
  youtube_search: youtubeSearchTool,
  stock_chart: stockChartTool,
  indian_stock_chart: indianStockChartTool,
  currency_converter: currencyConverterTool,
  coin_data: coinDataTool,
  coin_ohlc: coinOhlcTool,
  coin_data_by_contract: coinDataByContractTool,
  code_context: codeContextTool,
  datetime: datetimeTool,
  greeting: greetingTool,
  retrieve: retrieveTool,
  get_weather_data: weatherTool,
  code_interpreter: codeInterpreterTool,
  find_place_on_map: findPlaceOnMapTool,
  nearby_places_search: nearbyPlacesSearchTool,
  track_flight: flightTrackerTool,
  movie_or_tv_search: movieTvSearchTool,
  trending_movies: trendingMoviesTool,
  trending_tv: trendingTvTool,
  text_translate: textTranslateTool,
  binance_ticker: binanceTickerTool,
  binance_kline: binanceKlineTool,
  binance_orderbook: binanceOrderbookTool,
  groww_quote: growwQuoteTool,
  groww_historical_candle: growwHistoricalCandleTool,
  groww_price_forecast: growwPriceForecastTool,
  academic_search: academicSearchTool,
  reddit_search: redditSearchTool,
  x_search: xSearchTool,
};

const DATASTREAM_TOOL_FACTORIES: Record<string, (dataStream: UIMessageStreamWriter<ChatMessage>) => any> = {
  extreme_search: (dataStream) => extremeSearchTool(dataStream),
  web_search: (dataStream) => webSearchTool(dataStream),
  prediction_search: (dataStream) => predictionSearchTool(dataStream),
};

const SEARCH_MODE_TOOLS: Record<string, readonly string[]> = {
  extreme: ['extreme_search'],
  web: [
    'web_search',
    'greeting',
    'code_interpreter',
    'get_weather_data',
    'retrieve',
    'text_translate',
    'nearby_places_search',
    'track_flight',
    'movie_or_tv_search',
    'trending_movies',
    'find_place_on_map',
    'trending_tv',
    'datetime',
  ],
  academic: ['academic_search', 'code_interpreter', 'datetime'],
  youtube: ['youtube_search', 'datetime'],
  reddit: ['reddit_search', 'datetime'],
  github: ['extreme_search'],
  stocks: ['stock_chart', 'currency_converter', 'datetime'],
  ise: ['indian_stock_chart', 'currency_converter', 'datetime'],
  groww: ['groww_quote', 'groww_historical_candle', 'groww_price_forecast', 'datetime'],
  code: ['code_context'],
  x: ['x_search'],
  chat: [],
  finagent: [
    'extreme_search',
    'coin_data',
    'coin_ohlc',
    'coin_data_by_contract',
    'stock_chart',
    'currency_converter',
    'code_interpreter',
    'prediction_search',
    'web_search',
    'x_search',
    'reddit_search',
    'binance_ticker',
    'binance_kline',
    'groww_quote',
    'groww_historical_candle',
    'datetime',
  ],
};

function getToolsForSearchMode(
  searchMode: string,
  dataStream: UIMessageStreamWriter<ChatMessage>,
): Record<string, any> {
  const toolNames = SEARCH_MODE_TOOLS[searchMode] || SEARCH_MODE_TOOLS.extreme;
  const tools: Record<string, any> = {};

  for (const toolName of toolNames) {
    if (toolName in DATASTREAM_TOOL_FACTORIES) {
      tools[toolName] = DATASTREAM_TOOL_FACTORIES[toolName](dataStream);
    } else if (toolName in STATIC_TOOLS) {
      tools[toolName] = STATIC_TOOLS[toolName];
    }
  }

  return tools;
}

function getSystemPromptForSearchMode(searchMode: string): string {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    weekday: 'short',
  });

  const toolNamesForMode = SEARCH_MODE_TOOLS[searchMode] || SEARCH_MODE_TOOLS.extreme;
  const primaryToolName = toolNamesForMode[0];
  const isFinAgent = searchMode === 'finagent';

  const basePrompt = `# BharatX Scheduled Research Assistant

You are an advanced research assistant focused on deep analysis and comprehensive understanding, with a focus on being backed by citations.

**Today's Date:** ${today}

---

## CRITICAL OPERATION RULES

### Immediate Tool Execution
${isFinAgent
    ? `- **MANDATORY**: Start executing tools IMMEDIATELY — use MULTIPLE tools in sequence to build the report
- **NO PRE-ANALYSIS**: Do NOT write any text before running the first tool
- **MULTI-TOOL REQUIRED**: FinAgent runs MUST use at least 3 tools — market data, prediction markets, and sentiment/analysis
- **NO CLARIFICATION**: Never ask for clarification - make best interpretation and proceed
- **DIRECT ANSWERS**: Go straight to answering after running the tools`
    : `- **MANDATORY**: ${primaryToolName ? `Run \`${primaryToolName}\` INSTANTLY when processing ANY scheduled query` : 'Do NOT call tools unless required by the user'} - NO EXCEPTIONS
- **NO PRE-ANALYSIS**: Do NOT write any text before running the tool (if a tool is required)
- **ONE TOOL ONLY**: Run the tool once and only once per scheduled search
- **NO CLARIFICATION**: Never ask for clarification - make best interpretation and proceed
- **DIRECT ANSWERS**: Go straight to answering after running the tool`
  }

### Response Format Requirements
- **MANDATORY**: Always respond with markdown format
- **CITATIONS REQUIRED**: EVERY factual claim MUST have a citation
- **IMMEDIATE CITATIONS**: Citations must appear immediately after each sentence with factual content
- **NO END CITATIONS**: Never put citations at the end of paragraphs/sections
- **STRICT MARKDOWN**: All responses must use proper markdown formatting throughout

### Response Structure - MANDATORY
- **CRITICAL**: ALWAYS start your response with "## Key Points" followed by a bulleted list of main findings
- **MINIMUM REQUIRED**: The "## Key Points" section MUST contain at least 10 bullet points
- After Key Points, write well formatted super detailed sections and finish with a conclusion

## CITATION FORMAT - CRITICAL RULES

### Link Formatting (MANDATORY)
- **USE INLINE TEXT CITATIONS**: Citations must use markdown link format with text as display text
- **FORMAT**: \`[text](url)\`
- **NO NUMBERED FOOTNOTES**: Never use [1], [2], [3] style references
- **NO REFERENCE SECTIONS**: Never create separate "References", "Sources", or "Links" sections
- **INLINE ONLY**: Citations must appear immediately after the sentence they support
- **NO BARE URLs**: Never include bare URLs`;

  const modeInstructions: Record<string, string> = {
    extreme: `

## TOOL GUIDELINES

### Extreme Search Tool
- **Purpose**: Multi-step research planning with parallel web and academic searches
- **Output**: Comprehensive 3-page research paper with citations`,
    web: `

## TOOL GUIDELINES

### Web Search Tool
- **Purpose**: Search across the web for relevant information
- **Output**: Well-structured summary with citations from web sources`,
    academic: `

## TOOL GUIDELINES

### Academic Search Tool
- **Purpose**: Search academic papers and research publications
- **Output**: Academic summary with proper citations from research sources`,
    youtube: `

## TOOL GUIDELINES

### YouTube Search Tool
- **Purpose**: Search YouTube videos for relevant content
- **Output**: Summary of video content with links to relevant videos`,
    reddit: `

## TOOL GUIDELINES

### Reddit Search Tool - MULTI-QUERY FORMAT REQUIRED
- **MANDATORY**: ALWAYS use MULTIPLE QUERIES (3-5 queries) in ARRAY FORMAT
- **FORMAT**: Use queries: ["query1", "query2", "query3"]
- When searching Reddit, set maxResults array to at least [10, 10, 10]`,
    github: `

## TOOL GUIDELINES

### GitHub Search
- **Purpose**: Search GitHub repositories and code
- **Output**: Summary of repositories with descriptions and metadata`,
    stocks: `

## TOOL GUIDELINES

### Stock Chart Tool
- **Purpose**: Get stock market data and charts
- **Output**: Stock analysis with current prices and trends`,
    ise: `

## TOOL GUIDELINES

### Indian Stock Chart Tool (indian_stock_chart)
- **Purpose**: NSE/BSE equities in INR via Yahoo Finance (.NS / .BO)
- **MANDATORY**: Use for any Indian company or index comparison on Indian exchanges
- **DO NOT** use \`stock_chart\` — use \`indian_stock_chart\` only
- **Output**: Price history chart + narrative in INR`,
    groww: `

## TOOL GUIDELINES

### Groww Trade API Tools
- **\`groww_quote\`**: Live quote snapshot for an Indian market instrument
- **\`groww_historical_candle\`**: Historical OHLC candles by date range
- **\`groww_price_forecast\`**: Model-based future scenario projection from historical candles
- Use exchange/segment carefully:
  - Equities/index cash: NSE or BSE + CASH
  - Derivatives: NFO + FNO
  - Commodities: MCX + COMMODITY`,
    code: `

## TOOL GUIDELINES

### Code Context Tool
- **Purpose**: Retrieve technical context about languages/frameworks/libraries
- **Output**: Technical explanation with concrete code examples`,
    x: `

## TOOL GUIDELINES

### X Search Tool - MULTI-QUERY FORMAT REQUIRED
- **MANDATORY**: ALWAYS use MULTIPLE QUERIES (3-5 queries) in ARRAY FORMAT
- **FORMAT**: Use queries: ["query1", "query2", "query3"]
- **NATURAL LANGUAGE ONLY**: Write queries in natural language
- **NO TWITTER SYNTAX**: NEVER use Twitter search syntax like "from:handle"
- **EXTRACT HANDLES SEPARATELY**: Use includeXHandles parameter for handles`,
    chat: `

## TOOL GUIDELINES

### Chat Mode
- **Purpose**: Respond directly without tool usage
- **Output**: Helpful, concise answer in markdown`,
    finagent: `

## FINAGENT — FINANCE & CRYPTO INTELLIGENCE MODE

You are a professional crypto and financial intelligence analyst. Produce institutional-grade research briefs by combining live market data, on-chain intelligence, prediction market signals, social sentiment, and quantitative code execution.

### Available Tools & When to Use Each

| Tool | Purpose | When to Use |
|------|---------|-------------|
| \`coin_data\` | Live CoinGecko price, market cap, volume | For any named crypto asset |
| \`coin_ohlc\` | OHLC candlestick data for charting | For price history, technical analysis |
| \`coin_data_by_contract\` | Token lookup by contract address | For new/unknown tokens, DeFi research |
| \`stock_chart\` | Equities OHLC, earnings, financials | For stocks, crypto-adjacent equities |
| \`currency_converter\` | Live forex + crypto conversion rates | For macro backdrop |
| \`prediction_search\` | Polymarket + Kalshi live market odds | For event probabilities |
| \`code_interpreter\` | Python sandbox execution | For quantitative analysis |
| \`web_search\` | Financial news and research | For recent news |
| \`x_search\` | Real-time X/Twitter social sentiment | For narrative tracking |
| \`reddit_search\` | Community sentiment on Reddit | For crypto community sentiment |
| \`extreme_search\` | Deep multi-source research | For thorough research |
| \`binance_ticker\` | Live Binance spot prices | For real-time exchange data |
| \`binance_kline\` | Binance candlestick/OHLC data | For exchange-level charts |
| \`groww_quote\` | Live NSE/BSE/F&O quote snapshot | For Indian market live quote checks |
| \`groww_historical_candle\` | Historical candles for Indian symbols | For trend analysis on Groww instruments |
| \`datetime\` | Current date/time | For timestamping reports |

### Tool Orchestration Strategy — CRITICAL
- **USE MULTIPLE TOOLS**: FinAgent briefs require combining AT LEAST 3 tools per run
- **SEQUENCE MATTERS**: Run data tools first, then analysis tools, then synthesis
- **PREDICTION MARKETS ALWAYS**: Every FinAgent run MUST query prediction markets

### Output Structure — MANDATORY

\`\`\`
## Key Points
- [10+ bullet points with the most critical findings, each with citation]

## Market Data
[Live prices, OHLC summary, notable moves]

## Prediction Market Signals
[Active prediction market odds for relevant events]

## Social & Narrative Intelligence
[X/Twitter + Reddit sentiment summary]

## Quantitative Analysis
[Python code output: returns, correlations, EV calculations]

## Risk & Outlook
[Forward-looking synthesis: catalysts, risks, key dates]
\`\`\`

### Financial Disclaimer
- Always include: *This report is for informational purposes only and does not constitute financial advice.*`,
  };

  return basePrompt + (modeInstructions[searchMode] || modeInstructions.extreme);
}

async function checkUserIsProById(userId: string): Promise<boolean> {
  return true;
}

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
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
  console.log('🔍 Lookout API endpoint hit from QStash');

  const requestStartTime = Date.now();
  let runDuration = 0;
  let runError: string | undefined;

  try {
    const { lookoutId, prompt, userId } = await req.json();

    console.log('--------------------------------');
    console.log('Lookout ID:', lookoutId);
    console.log('User ID:', userId);
    console.log('Prompt:', prompt);
    console.log('--------------------------------');

    let lookout: any = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (!lookout && retryCount < maxRetries) {
      lookout = await getLookoutById({ id: lookoutId });
      if (!lookout) {
        retryCount++;
        if (retryCount < maxRetries) {
          const delay = 500 * Math.pow(2, retryCount - 1);
          console.log(`Lookout not found on attempt ${retryCount}, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (!lookout) {
      console.error('Lookout not found after', maxRetries, 'attempts:', lookoutId);
      return new Response('Lookout not found', { status: 404 });
    }

    const userResult = await getUserById(userId);
    if (!userResult) {
      console.error('User not found:', userId);
      return new Response('User not found', { status: 404 });
    }

    const isUserPro = await checkUserIsProById(userId);
    if (!isUserPro) {
      console.error('User is not pro, cannot run lookout:', userId);
      return new Response('Lookouts require a Pro subscription', { status: 403 });
    }

    const chatId = uuidv7();
    const streamId = 'stream-' + uuidv7();

    await saveChat({
      id: chatId,
      userId: userResult.id,
      title: `Scheduled: ${lookout.title}`,
      visibility: 'private',
    });

    const userMessage = {
      id: uuidv7(),
      role: 'user' as const,
      content: prompt,
      parts: [{ type: 'text' as const, text: prompt }],
      experimental_attachments: [],
    };

    await Promise.all([
      saveMessages({
        messages: [
          {
            chatId,
            id: userMessage.id,
            role: 'user',
            parts: userMessage.parts,
            attachments: [],
            createdAt: new Date(),
            model: 'bharatx-grok-4-fast-think',
            completionTime: null,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
          },
        ],
      }),
      createStreamId({ streamId, chatId }),
    ]);

    await updateLookoutStatus({
      id: lookoutId,
      status: 'running',
    });

    const searchMode = lookout.searchMode || 'extreme';
    console.log('🔍 Using search mode:', searchMode);

    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer: dataStream }) => {
        const streamStartTime = Date.now();

        const tools = getToolsForSearchMode(searchMode, dataStream);
        const activeToolNames = Object.keys(tools);
        const systemPrompt = getSystemPromptForSearchMode(searchMode);

        console.log('🛠️ Active tools:', activeToolNames);

        const maxSteps = searchMode === 'finagent' ? 8 : 2;

        const result = streamText({
          model: bharatX.languageModel('bharatx-grok-4-fast-think'),
          messages: await convertToModelMessages([userMessage]),
          stopWhen: stepCountIs(maxSteps),
          maxRetries: 10,
          activeTools: activeToolNames,
          system: systemPrompt,
          toolChoice: 'auto',
          tools,
          onChunk(event) {
            if (event.chunk.type === 'tool-call') {
              console.log('Called Tool: ', event.chunk.toolName);
            }
          },
          onStepFinish(event) {
            if (event.warnings) {
              console.log('Warnings: ', event.warnings);
            }
          },
          onFinish: async (event) => {
            console.log('Finish reason: ', event.finishReason);
            console.log('Steps: ', event.steps);
            console.log('Usage: ', event.usage);

            if (event.finishReason === 'stop') {
              try {
                const title = await generateTitleFromUserMessage({
                  message: userMessage,
                });

                console.log('Generated title: ', title);

                await updateChatTitleById({
                  chatId,
                  title: `Scheduled: ${title}`,
                });

                const extremeSearchUsed = event.steps?.some((step) =>
                  step.toolCalls?.some((toolCall) => toolCall.toolName === 'extreme_search'),
                );

                if (extremeSearchUsed) {
                  console.log('Extreme search was used, incrementing count');
                  await incrementExtremeSearchUsage({ userId: userResult.id });
                }

                runDuration = Date.now() - requestStartTime;

                const searchesPerformed =
                  event.steps?.reduce((total, step) => {
                    return total + (step.toolCalls?.length ?? 0);
                  }, 0) ?? 0;

                await updateLookoutLastRun({
                  id: lookoutId,
                  lastRunAt: new Date(),
                  lastRunChatId: chatId,
                  runStatus: 'success',
                  duration: runDuration,
                  tokensUsed: event.usage?.totalTokens,
                  searchesPerformed,
                });

                if (lookout.frequency !== 'once' && lookout.cronSchedule) {
                  try {
                    const options = {
                      currentDate: new Date(),
                      tz: lookout.timezone,
                    };

                    const cleanCronSchedule = lookout.cronSchedule.startsWith('CRON_TZ=')
                      ? lookout.cronSchedule.split(' ').slice(1).join(' ')
                      : lookout.cronSchedule;

                    const interval = CronExpressionParser.parse(cleanCronSchedule, options);
                    const nextRunAt = interval.next().toDate();

                    await updateLookout({
                      id: lookoutId,
                      nextRunAt,
                    });
                  } catch (error) {
                    console.error('Error calculating next run time:', error);
                  }
                } else if (lookout.frequency === 'once') {
                  await updateLookoutStatus({
                    id: lookoutId,
                    status: 'paused',
                  });
                }

                if (userResult.email) {
                  try {
                    let assistantResponseText = event.text || '';

                    if (!assistantResponseText.trim()) {
                      const assistantMessages = event.response.messages.filter((msg: any) => msg.role === 'assistant');

                      for (const msg of assistantMessages) {
                        if (typeof msg.content === 'string') {
                          assistantResponseText += msg.content + '\n';
                        } else if (Array.isArray(msg.content)) {
                          const textContent = msg.content
                            .filter((part: any) => part.type === 'text')
                            .map((part: any) => part.text)
                            .join('\n');
                          assistantResponseText += textContent + '\n';
                        }
                      }
                    }

                    console.log('📧 Assistant response length:', assistantResponseText.length);

                    const trimmedResponse = assistantResponseText.trim() || 'No response available.';
                    const finalResponse = truncateMarkdown(trimmedResponse, 2000);

                    await sendLookoutCompletionEmail({
                      to: userResult.email,
                      chatTitle: title,
                      assistantResponse: finalResponse,
                      chatId,
                    });
                  } catch (emailError) {
                    console.error('Failed to send completion email:', emailError);
                  }
                }

                await updateLookoutStatus({
                  id: lookoutId,
                  status: 'active',
                });

                console.log('Scheduled search completed successfully');
              } catch (error) {
                console.error('Error in onFinish:', error);
              }
            }

            const requestEndTime = Date.now();
            const processingTime = (requestEndTime - requestStartTime) / 1000;
            console.log('--------------------------------');
            console.log(`Total request processing time: ${processingTime.toFixed(2)} seconds`);
            console.log('--------------------------------');
          },
          onError: async (event) => {
            console.log('Error: ', event.error);

            runDuration = Date.now() - requestStartTime;
            runError = (event.error as string) || 'Unknown error occurred';

            try {
              await updateLookoutLastRun({
                id: lookoutId,
                lastRunAt: new Date(),
                lastRunChatId: chatId,
                runStatus: 'error',
                error: runError,
                duration: runDuration,
              });
            } catch (updateError) {
              console.error('Failed to update lookout with error info:', updateError);
            }

            try {
              await updateLookoutStatus({
                id: lookoutId,
                status: 'active',
              });
              console.log('Reset lookout status to active after error');
            } catch (statusError) {
              console.error('Failed to reset lookout status after error:', statusError);
            }

            const requestEndTime = Date.now();
            const processingTime = (requestEndTime - requestStartTime) / 1000;
            console.log('--------------------------------');
            console.log(`Request processing time (with error): ${processingTime.toFixed(2)} seconds`);
            console.log('--------------------------------');
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
            messageMetadata: ({ part }) => {
              if (part.type === 'finish') {
                console.log('Finish part: ', part);
                const processingTime = (Date.now() - streamStartTime) / 1000;
                return {
                  model: 'bharatx-grok-4-fast-think',
                  completionTime: processingTime,
                  createdAt: new Date().toISOString(),
                  totalTokens: part.totalUsage?.totalTokens ?? null,
                  inputTokens: part.totalUsage?.inputTokens ?? null,
                  outputTokens: part.totalUsage?.outputTokens ?? null,
                };
              }
            },
          }),
        );
      },
      onError(error) {
        console.log('Error: ', error);
        return 'Oops, an error occurred in scheduled search!';
      },
      onFinish: async ({ messages }) => {
        if (userId) {
          const user = await getUserById(userId);
          const isUserPro = user ? await checkUserIsProById(userId) : false;

          if (user && isUserPro) {
            await saveMessages({
              messages: messages.map((message) => ({
                id: message.id,
                role: message.role,
                parts: message.parts,
                createdAt: new Date(),
                attachments: [],
                chatId: chatId,
                model: 'bharatx-grok-4-fast-think',
                completionTime: message.metadata?.completionTime ?? 0,
                inputTokens: message.metadata?.inputTokens ?? 0,
                outputTokens: message.metadata?.outputTokens ?? 0,
                totalTokens: message.metadata?.totalTokens ?? 0,
              })),
            });
          } else {
            console.error('User validation failed in onFinish - user not found or not pro:', userId);
          }
        }
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () => stream.pipeThrough(new JsonToSseTransformStream())),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    console.error('Error in lookout API:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
