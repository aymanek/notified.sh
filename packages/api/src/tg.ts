/** Telegram Bot API fetch wrapper. All methods throw on non-OK responses. */

const BASE = "https://api.telegram.org/bot";

type TgResult<T> = { ok: true; result: T } | { ok: false; error_code: number; description: string };

async function call<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json()) as TgResult<T>;
  if (!data.ok) {
    throw new TgError(method, data.error_code, data.description);
  }
  return data.result;
}

export class TgError extends Error {
  constructor(
    public readonly method: string,
    public readonly code: number,
    public readonly description: string,
  ) {
    super(`Telegram ${method} failed (${code}): ${description}`);
  }
}

export type TgBot = {
  id: number;
  username: string;
  first_name: string;
  is_bot: boolean;
};

export async function getMe(token: string): Promise<TgBot> {
  return call<TgBot>(token, "getMe");
}

export async function setWebhook(token: string, url: string, secretToken: string): Promise<void> {
  await call<boolean>(token, "setWebhook", { url, secret_token: secretToken, drop_pending_updates: false });
}

export async function deleteWebhook(token: string): Promise<void> {
  await call<boolean>(token, "deleteWebhook", { drop_pending_updates: false });
}

/**
 * Bot API 9.6: retrieve the token for a managed child bot.
 * The manager bot must have the "Can manage other bots" permission.
 */
export async function getManagedBotToken(managerToken: string, botUserId: number): Promise<string> {
  // Returns a plain string (not wrapped in an object) per Bot API 9.6 behaviour.
  return call<string>(managerToken, "getManagedBotToken", { user_id: botUserId });
}

export async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
  await call<unknown>(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
  });
}

/** Telegram Update shape (only fields we care about). */
export type TgMessage = {
  message_id: number;
  chat: { id: number };
  from?: { id: number };
  text?: string;
};

/** Bot API 9.6 managed_bot update field. */
export type TgManagedBot = {
  bot: TgBot;
  /** Present on token rotation updates. */
  token?: string;
};

export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  /** Fired when manager bot creates or rotates a child bot. */
  managed_bot?: TgManagedBot;
};
