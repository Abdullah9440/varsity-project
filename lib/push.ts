import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { appSettings } from "../db/schema.js";

type VapidKeys = { publicKey: string; privateKey: string };

let cached: VapidKeys | null = null;

// Web Push keys are generated once and stored in the database,
// so no manual setup is needed.
export async function getVapidKeys(): Promise<VapidKeys> {
  if (cached) return cached;

  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "vapid_keys"));
  if (row) {
    cached = JSON.parse(row.value) as VapidKeys;
    return cached;
  }

  const fresh = webpush.generateVAPIDKeys();
  // If two requests race, only the first insert wins; everyone reads the stored value
  await db
    .insert(appSettings)
    .values({ key: "vapid_keys", value: JSON.stringify(fresh) })
    .onConflictDoNothing();

  const [stored] = await db.select().from(appSettings).where(eq(appSettings.key, "vapid_keys"));
  cached = JSON.parse(stored.value) as VapidKeys;
  return cached;
}

export async function configureWebPush() {
  const keys = await getVapidKeys();
  const subject = process.env.URL || "https://student-task-manager-habhit.netlify.app";
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  return webpush;
}
