type SyndicationEntityArrays = {
  hashtags?: unknown;
  user_mentions?: unknown;
  urls?: unknown;
  symbols?: unknown;
  media?: unknown;
};

type SyndicationTweet = {
  text?: string;
  display_text_range?: [number, number];
  entities?: SyndicationEntityArrays;
  quoted_tweet?: SyndicationTweet;
  [key: string]: unknown;
};

/** X syndication API often omits entity arrays; react-tweet requires them. */
export function normalizeSyndicationTweet<T extends SyndicationTweet>(tweet: T): T {
  const entities = tweet.entities ?? {};
  const normalizedEntities = {
    hashtags: Array.isArray(entities.hashtags) ? entities.hashtags : [],
    user_mentions: Array.isArray(entities.user_mentions) ? entities.user_mentions : [],
    urls: Array.isArray(entities.urls) ? entities.urls : [],
    symbols: Array.isArray(entities.symbols) ? entities.symbols : [],
    ...(Array.isArray(entities.media) ? { media: entities.media } : {}),
  };

  const normalized = {
    ...tweet,
    entities: normalizedEntities,
    display_text_range: Array.isArray(tweet.display_text_range)
      ? tweet.display_text_range
      : ([0, String(tweet.text ?? '').length] as [number, number]),
  } as T;

  if (tweet.quoted_tweet && typeof tweet.quoted_tweet === 'object') {
    (normalized as SyndicationTweet).quoted_tweet = normalizeSyndicationTweet(
      tweet.quoted_tweet as SyndicationTweet,
    );
  }

  return normalized;
}
