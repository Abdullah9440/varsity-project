import type { Config } from "@netlify/functions";
import { and, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { alarms, pushSubscriptions } from "../../db/schema.js";
import { configureWebPush } from "../../lib/push.js";

// Alarms more than this late (e.g. after an outage) are skipped instead of sent
const LATE_LIMIT_MS = 15 * 60 * 1000;

// Runs every minute and sends a push notification for every alarm that is due
export default async () => {
  // Claim due alarms atomically so overlapping runs never send twice
  const claimed = await db
    .update(alarms)
    .set({ sentAt: sql`now()` })
    .where(and(isNull(alarms.sentAt), lte(alarms.fireAt, sql`now()`)))
    .returning();

  if (!claimed.length) return;

  const subIds = [...new Set(claimed.map((a) => a.subscriptionId))];
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.id, subIds));
  const subById = new Map(subs.map((s) => [s.id, s]));

  const webpush = await configureWebPush();
  const gone = new Set<number>();
  const now = Date.now();

  await Promise.all(
    claimed.map(async (alarm) => {
      const sub = subById.get(alarm.subscriptionId);
      if (!sub || gone.has(sub.id)) return;
      if (now - alarm.fireAt.getTime() > LATE_LIMIT_MS) return;

      const message = JSON.stringify({
        taskId: alarm.taskId,
        title: alarm.title,
        body: alarm.body,
        fireAt: alarm.fireAt.toISOString(),
      });

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
          { TTL: 600, urgency: "high", topic: ("t" + alarm.taskId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) }
        );
      } catch (err: any) {
        // 404/410: the user unsubscribed or the browser dropped the subscription
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          gone.add(sub.id);
        } else {
          console.error("Push failed for alarm", alarm.id, err?.statusCode, err?.body || err?.message);
        }
      }
    })
  );

  if (gone.size) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, [...gone]));
  }

  // Tidy up old sent alarms
  await db.delete(alarms).where(lte(alarms.sentAt, sql`now() - interval '2 days'`));
};

export const config: Config = {
  schedule: "* * * * *",
};
