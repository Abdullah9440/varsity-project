CREATE TABLE "alarms" (
	"id" serial PRIMARY KEY,
	"subscription_id" integer NOT NULL,
	"task_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"fire_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "alarms_subscription_task_idx" ON "alarms" ("subscription_id","task_id");--> statement-breakpoint
CREATE INDEX "alarms_due_idx" ON "alarms" ("sent_at","fire_at");--> statement-breakpoint
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_subscription_id_push_subscriptions_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "push_subscriptions"("id") ON DELETE CASCADE;