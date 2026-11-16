CREATE TABLE "briefs" (
	"day" date PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"figures" jsonb NOT NULL,
	"writer" text NOT NULL,
	"refused" text,
	"guarded" boolean DEFAULT false NOT NULL,
	"written_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefs_writer_named" CHECK (length("briefs"."writer") > 0)
);
