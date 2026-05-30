CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_rule_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"value" double precision NOT NULL,
	"message" varchar,
	"slack_sent" boolean DEFAULT false NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"endpoint_id" uuid,
	"name" varchar NOT NULL,
	"description" varchar,
	"condition" varchar NOT NULL,
	"threshold" double precision NOT NULL,
	"window_minutes" integer DEFAULT 5 NOT NULL,
	"slack_webhook_url" varchar,
	"email_addresses" text[],
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"key_hash" varchar NOT NULL,
	"key_preview" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"endpoint" varchar NOT NULL,
	"method" varchar NOT NULL,
	"description" varchar,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_1d" (
	"time" timestamp with time zone NOT NULL,
	"workspace_id" uuid NOT NULL,
	"endpoint" varchar NOT NULL,
	"method" varchar NOT NULL,
	"count" integer NOT NULL,
	"latency_p50" double precision,
	"latency_p75" double precision,
	"latency_p95" double precision,
	"latency_p99" double precision,
	"latency_avg" double precision,
	"latency_max" double precision,
	"latency_min" double precision,
	"status_2xx_count" integer,
	"status_3xx_count" integer,
	"status_4xx_count" integer,
	"status_5xx_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_1h" (
	"time" timestamp with time zone NOT NULL,
	"workspace_id" uuid NOT NULL,
	"endpoint" varchar NOT NULL,
	"method" varchar NOT NULL,
	"count" integer NOT NULL,
	"latency_p50" double precision,
	"latency_p75" double precision,
	"latency_p95" double precision,
	"latency_p99" double precision,
	"latency_avg" double precision,
	"latency_max" double precision,
	"latency_min" double precision,
	"status_2xx_count" integer,
	"status_3xx_count" integer,
	"status_4xx_count" integer,
	"status_5xx_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_5min" (
	"time" timestamp with time zone NOT NULL,
	"workspace_id" uuid NOT NULL,
	"endpoint" varchar NOT NULL,
	"method" varchar NOT NULL,
	"count" integer NOT NULL,
	"latency_p50" double precision,
	"latency_p75" double precision,
	"latency_p95" double precision,
	"latency_p99" double precision,
	"latency_avg" double precision,
	"latency_max" double precision,
	"latency_min" double precision,
	"status_2xx_count" integer,
	"status_3xx_count" integer,
	"status_4xx_count" integer,
	"status_5xx_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_raw" (
	"time" timestamp with time zone NOT NULL,
	"workspace_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"endpoint" varchar NOT NULL,
	"method" varchar NOT NULL,
	"latency_ms" double precision NOT NULL,
	"status_code" integer NOT NULL,
	"payload_size_bytes" integer,
	"request_id" uuid NOT NULL,
	"user_agent" varchar,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"stripe_customer_id" varchar NOT NULL,
	"stripe_subscription_id" varchar NOT NULL,
	"stripe_product_id" varchar,
	"plan" varchar DEFAULT 'free' NOT NULL,
	"status" varchar NOT NULL,
	"current_period_start" date,
	"current_period_end" date,
	"trial_end" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_subscriptions_workspace_id_unique" UNIQUE("workspace_id"),
	CONSTRAINT "stripe_subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "stripe_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"month" date NOT NULL,
	"requests_tracked" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"name" varchar,
	"email_verified" boolean DEFAULT false NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"plan" varchar DEFAULT 'free' NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_subscriptions" ADD CONSTRAINT "stripe_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_events_workspace_triggered_at_idx" ON "alert_events" USING btree ("workspace_id","triggered_at");--> statement-breakpoint
CREATE INDEX "alert_events_alert_rule_triggered_at_idx" ON "alert_events" USING btree ("alert_rule_id","triggered_at");--> statement-breakpoint
CREATE INDEX "alert_events_resolved_at_idx" ON "alert_events" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "alert_rules_workspace_id_idx" ON "alert_rules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "alert_rules_status_idx" ON "alert_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "api_keys_workspace_id_idx" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoints_workspace_endpoint_method_idx" ON "endpoints" USING btree ("workspace_id","endpoint","method");--> statement-breakpoint
CREATE INDEX "metrics_1d_workspace_time_idx" ON "metrics_1d" USING btree ("workspace_id","time");--> statement-breakpoint
CREATE INDEX "metrics_1h_workspace_time_idx" ON "metrics_1h" USING btree ("workspace_id","time");--> statement-breakpoint
CREATE INDEX "metrics_5min_workspace_time_idx" ON "metrics_5min" USING btree ("workspace_id","time");--> statement-breakpoint
CREATE INDEX "metrics_5min_endpoint_time_idx" ON "metrics_5min" USING btree ("endpoint","time");--> statement-breakpoint
CREATE INDEX "metrics_raw_workspace_time_idx" ON "metrics_raw" USING btree ("workspace_id","time");--> statement-breakpoint
CREATE INDEX "metrics_raw_endpoint_time_idx" ON "metrics_raw" USING btree ("endpoint","time");--> statement-breakpoint
CREATE INDEX "metrics_raw_api_key_time_idx" ON "metrics_raw" USING btree ("api_key_id","time");--> statement-breakpoint
CREATE INDEX "metrics_raw_status_code_time_idx" ON "metrics_raw" USING btree ("status_code","time");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_raw_request_id_time_idx" ON "metrics_raw" USING btree ("request_id","time");--> statement-breakpoint
CREATE INDEX "stripe_subscriptions_status_idx" ON "stripe_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_tracking_workspace_month_idx" ON "usage_tracking" USING btree ("workspace_id","month");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_workspace_user_id_idx" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaces_user_id_idx" ON "workspaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaces_slug_idx" ON "workspaces" USING btree ("slug");