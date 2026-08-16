CREATE TABLE "auth_login_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_key" varchar(64) NOT NULL,
	"network_key" varchar(64) NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_login_failures_account_key_format" CHECK ("auth_login_failures"."account_key" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "auth_login_failures_network_key_format" CHECK ("auth_login_failures"."network_key" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_security_version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" varchar(160) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "security_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_login_failures_account_time_idx" ON "auth_login_failures" USING btree ("account_key","attempted_at");--> statement-breakpoint
CREATE INDEX "auth_login_failures_network_time_idx" ON "auth_login_failures" USING btree ("network_key","attempted_at");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_security_version_positive" CHECK ("sessions"."user_security_version" > 0);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_name_not_blank" CHECK (length(trim("users"."name")) > 0);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_security_version_positive" CHECK ("users"."security_version" > 0);