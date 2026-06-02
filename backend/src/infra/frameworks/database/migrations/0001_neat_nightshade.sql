CREATE TABLE "metric_idempotency_keys" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
