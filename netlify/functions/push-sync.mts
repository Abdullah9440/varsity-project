import type { Config } from "@netlify/functions";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { alarms, pushSubscriptions } from "../../db/schema.js";

const MAX_ALARMS = 300;

type IncomingAlarm = { taskId: unknown; title: unknown; body?: unknown; fireAt: unknown };

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

// Saves this device's push subscription and replaces its list of upcoming alarms
export default async (req: Request) => {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sub = payload?.subscription;
  const endpoint = cleanText(sub?.endpoint, 2000);
  const p256dh = cleanText(sub?.keys?.p256dh, 500);
  const auth = cleanText(sub?.keys?.auth, 500);
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const list: IncomingAlarm[] = Array.isArray(payload.alarms) ? payload.alarms.slice(0, MAX_ALARMS) : [];
  const now = Date.now();
  const rows = list
    .map((a) => {
      const fireAt = new Date(typeof a.fireAt === "string" || typeof a.fireAt === "number" ? a.fireAt : NaN);
      return {
        taskId: cleanText(String(a.taskId ?? ""), 100),
        title: cleanText(a.title, 200) || "Task alarm",
        body: cleanText(a.body, 300),
        fireAt,
      };
    })
    // Only keep valid alarms that are still in the future (with 1 minute of slack)
    .filter((a) => a.taskId && !isNaN(a.fireAt.getTime()) && a.fireAt.getTime() > now - 60_000);

  // Remove duplicate task ids (last one wins)
  const unique = [...new Map(rows.map((r) => [r.taskId, r])).values()];

  await db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(pushSubscriptions)
      .values({ endpoint, p256dh, auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh, auth, updatedAt: sql`now()` },
      })
      .returning({ id: pushSubscriptions.id });

    await tx.delete(alarms).where(eq(alarms.subscriptionId, saved.id));

    if (unique.length) {
      await tx.insert(alarms).values(unique.map((a) => ({ ...a, subscriptionId: saved.id })));
    }
  });

  return Response.json({ ok: true, alarms: unique.length });
};

export const config: Config = {
  path: "/api/push/sync",
  method: "POST",
};
