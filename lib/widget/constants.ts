/** Max characters of page text accepted (client should truncate similarly). */
export const WIDGET_MAX_CONTENT_CHARS = 24_000;

/** Below this (after trim), reject without calling the model. */
export const WIDGET_MIN_CONTENT_CHARS = 80;

/** Hard cap for JSON body size check (bytes). */
export const WIDGET_MAX_BODY_BYTES = 512 * 1024;

export const WIDGET_MODEL_ID = 'bharatx-widget' as const;

/** Max chat turns (user + assistant pairs); enforced server-side. */
export const WIDGET_MAX_CHAT_MESSAGES = 24;

/** Max characters per chat message (role content). */
export const WIDGET_MAX_MESSAGE_CHARS = 8_000;
