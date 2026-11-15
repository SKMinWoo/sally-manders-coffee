CREATE TYPE "public"."menu_group" AS ENUM('bar', 'brewed', 'not-coffee', 'food');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('sim', 'visitor');--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group" "menu_group" NOT NULL,
	"price_cents" integer NOT NULL,
	"note" text,
	"sort" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "menu_price_positive" CHECK ("menu_items"."price_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"order_id" bigint NOT NULL,
	"item_id" text NOT NULL,
	"qty" integer NOT NULL,
	"price_cents" integer NOT NULL,
	CONSTRAINT "order_lines_order_id_item_id_pk" PRIMARY KEY("order_id","item_id"),
	CONSTRAINT "lines_qty_positive" CHECK ("order_lines"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"day" date NOT NULL,
	"ticket" text NOT NULL,
	"source" "order_source" NOT NULL,
	"placed_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	CONSTRAINT "orders_publicId_unique" UNIQUE("public_id"),
	CONSTRAINT "orders_day_ticket" UNIQUE("day","ticket"),
	CONSTRAINT "orders_ready_after_placed" CHECK ("orders"."ready_at" > "orders"."placed_at"),
	CONSTRAINT "orders_money_whole" CHECK ("orders"."subtotal_cents" > 0 and "orders"."tax_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sim_days" (
	"day" date PRIMARY KEY NOT NULL,
	"seed" bigint NOT NULL,
	"orders" integer NOT NULL,
	"written_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_day_placed" ON "orders" USING btree ("day","placed_at");