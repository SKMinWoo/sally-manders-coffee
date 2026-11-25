CREATE TYPE "public"."call_kind" AS ENUM('customer', 'manager');--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('live', 'measured');--> statement-breakpoint
CREATE TYPE "public"."experiment_verdict" AS ENUM('kept', 'rolled-back');--> statement-breakpoint
CREATE TABLE "calls" (
	"day" date NOT NULL,
	"kind" "call_kind" NOT NULL,
	"speaker" text NOT NULL,
	"body" text NOT NULL,
	"figures" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"writer" text NOT NULL,
	"refused" text,
	"guarded" boolean DEFAULT false NOT NULL,
	"written_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calls_day_kind_pk" PRIMARY KEY("day","kind"),
	CONSTRAINT "calls_writer_named" CHECK (length("calls"."writer") > 0)
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "experiments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lever" text NOT NULL,
	"heard" text NOT NULL,
	"proposed_on" date NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" "experiment_status" DEFAULT 'live' NOT NULL,
	"verdict" "experiment_verdict",
	"until" date,
	"effect" jsonb,
	"measured_on" date,
	CONSTRAINT "experiments_week" CHECK ("experiments"."ends_on" >= "experiments"."starts_on"),
	CONSTRAINT "experiments_measured" CHECK (("experiments"."status" = 'live') = ("experiments"."verdict" is null))
);
--> statement-breakpoint
ALTER TABLE "sim_days" ADD COLUMN "levers" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "experiments_one_live" ON "experiments" USING btree ("status") WHERE "experiments"."status" = 'live';--> statement-breakpoint
CREATE INDEX "experiments_lever" ON "experiments" USING btree ("lever");