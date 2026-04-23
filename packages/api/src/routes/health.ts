import { Hono } from "hono";
import type { HonoEnv } from "../env.js";

export const healthRoute = new Hono<HonoEnv>();

healthRoute.get("/health", (c) => {
  return c.json({
    ok: true,
    version: c.env.APP_VERSION,
    git_sha: typeof GIT_SHA !== "undefined" ? GIT_SHA : "dev",
  });
});

// Global type augmentation so tsc knows about the define injected by wrangler.
declare const GIT_SHA: string | undefined;
