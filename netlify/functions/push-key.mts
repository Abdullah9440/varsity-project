import type { Config } from "@netlify/functions";
import { getVapidKeys } from "../../lib/push.js";

// Returns the public Web Push key the browser needs to subscribe
export default async () => {
  const { publicKey } = await getVapidKeys();
  return Response.json({ publicKey });
};

export const config: Config = {
  path: "/api/push/key",
  method: "GET",
};
