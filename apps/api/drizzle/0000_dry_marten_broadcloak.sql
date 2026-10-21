CREATE TABLE "asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_type_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"room_id" uuid,
	"asset_tag" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"manufacturer" text,
	"model" text,
	"serial_number" text,
	"install_year" integer,
	"condition" smallint,
	"notes" text,
	"assessed_at" timestamp with time zone,
	"assessed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_asset_tag_unique" UNIQUE("asset_tag"),
	CONSTRAINT "asset_condition_range" CHECK ("asset"."condition" between 1 and 5),
	CONSTRAINT "asset_quantity_positive" CHECK ("asset"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "asset_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"useful_life_years" integer,
	"typically_building_level" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "building" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campus_id" uuid NOT NULL,
	"name" text NOT NULL,
	"building_type" text,
	"year_built" integer,
	"gross_sf" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"name" text NOT NULL,
	"campus_type" text,
	"address" text,
	"year_opened" integer,
	"site_acres" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "district" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "floor_building_level" UNIQUE("building_id","level")
);
--> statement-breakpoint
CREATE TABLE "room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_id" uuid NOT NULL,
	"number" text NOT NULL,
	"name" text NOT NULL,
	"room_type" text,
	"area_sf" integer,
	"capacity" integer,
	"condition" smallint,
	"notes" text,
	"assessed_at" timestamp with time zone,
	"assessed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_floor_number" UNIQUE("floor_id","number"),
	CONSTRAINT "room_condition_range" CHECK ("room"."condition" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_asset_type_id_asset_type_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building" ADD CONSTRAINT "building_campus_id_campus_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus" ADD CONSTRAINT "campus_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floor" ADD CONSTRAINT "floor_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_floor_id_floor_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_building_idx" ON "asset" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "asset_room_idx" ON "asset" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "asset_type_idx" ON "asset" USING btree ("asset_type_id");--> statement-breakpoint
CREATE INDEX "building_campus_idx" ON "building" USING btree ("campus_id");--> statement-breakpoint
CREATE INDEX "campus_district_idx" ON "campus" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "floor_building_idx" ON "floor" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "room_floor_idx" ON "room" USING btree ("floor_id");