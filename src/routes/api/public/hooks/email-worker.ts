// Scheduled email worker. Called by pg_cron; secured by the project anon key.
import { createFileRoute } from "@tanstack/react-router";

async function run(request: Request): Promise<Response> {
  const token =
    request.headers.get("apikey") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const expected =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const { runEmailWorker } = await import("@/lib/email-jobs.server");
    const summary = await runEmailWorker(new Date());
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[email-worker] failed:", (error as Error).message);
    return new Response(JSON.stringify({ ok: false, error: "worker_failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/public/hooks/email-worker")({
  server: {
    handlers: {
      POST: ({ request }) => run(request),
    },
  },
});
