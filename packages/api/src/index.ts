import { Hono } from "hono";
import type { HonoEnv, Env } from "./env.js";
import { healthRoute } from "./routes/health.js";
import { pairRoute } from "./routes/pair.js";
import { unpairRoute } from "./routes/unpair.js";
import { log } from "./log.js";

const app = new Hono<HonoEnv>();

app.route("/", healthRoute);
app.route("/", pairRoute);
app.route("/", unpairRoute);

app.notFound((c) =>
  c.json({ error: { code: "not_found", message: "Route not found." } }, 404),
);

app.onError((err, c) => {
  log({ event: "unhandled_error", err_code: err.message });
  return c.json(
    { error: { code: "internal_error", message: "An unexpected error occurred." } },
    500,
  );
});

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return Promise.resolve(app.fetch(req, env, ctx));
  },
  async scheduled(_controller: ScheduledController, _env: Env, _ctx: ExecutionContext): Promise<void> {
    // M5: cron dispatcher (atomic claim → send → finalize + reap + GC)
    log({ event: "cron_tick_stub" });
  },
} satisfies ExportedHandler<Env>;
