CREATE TABLE "engineering_facts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "engineering_facts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"value" jsonb NOT NULL,
	"run_id" bigint NOT NULL,
	"run_url" text NOT NULL,
	"sha" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facts_kind_run" UNIQUE("kind","run_id"),
	CONSTRAINT "facts_sha_hex" CHECK ("engineering_facts"."sha" ~ '^[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE INDEX "facts_kind_recorded" ON "engineering_facts" USING btree ("kind","recorded_at");