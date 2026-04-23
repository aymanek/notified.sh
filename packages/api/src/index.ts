import { Hono } from "hono";
import type { HonoEnv, Env } from "./env.js";
import { healthRoute } from "./routes/health.js";
import { pairRoute } from "./routes/pair.js";
import { unpairRoute } from "./routes/unpair.js";
import { tgManagerRoute } from "./routes/tgManager.js";
import { tgChildRoute } from "./routes/tgChild.js";
import { notifyRoute } from "./routes/notify.js";
import { testRoute } from "./routes/test.js";
import { runDispatch } from "./dispatch.js";
import { log } from "./log.js";

const app = new Hono<HonoEnv>();

app.route("/", healthRoute);
app.route("/", pairRoute);
app.route("/", tgManagerRoute);
app.route("/", tgChildRoute);
app.route("/", notifyRoute);
app.route("/", testRoute);
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
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runDispatch(env));
  },
} satisfies ExportedHandler<Env>;
