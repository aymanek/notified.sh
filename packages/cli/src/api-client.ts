import { z } from "zod";
import { ErrorResponseSchema } from "@notified.sh/shared";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

async function request<T>(
  schema: z.ZodType<T>,
  url: string,
  options: RequestInit = {},
  timeoutMs = 8_000,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = ErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      const { code, message, request_id } = parsed.data.error;
      throw new ApiError(res.status, code, message, request_id);
    }
    throw new ApiError(res.status, "http_error", `HTTP ${res.status}`);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`Unexpected response shape: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export function get<T>(schema: z.ZodType<T>, url: string, token?: string, timeoutMs?: number): Promise<T> {
  return request(schema, url, { method: "GET", headers: buildHeaders(token) }, timeoutMs);
}

export function post<T>(
  schema: z.ZodType<T>,
  url: string,
  body?: unknown,
  token?: string,
  timeoutMs?: number,
): Promise<T> {
  return request(
    schema,
    url,
    { method: "POST", headers: buildHeaders(token), body: body != null ? JSON.stringify(body) : undefined },
    timeoutMs,
  );
}
