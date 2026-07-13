CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_code" text NOT NULL,
	"service_id" uuid NOT NULL,
	"patient_name" text NOT NULL,
	"patient_mobile" text NOT NULL,
	"patient_email" text,
	"notes" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_ref_code_unique" UNIQUE("ref_code")
);
--> statement-breakpoint
CREATE TABLE "blocked_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "clinic_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"mobile" text NOT NULL,
	"open_hours" jsonb NOT NULL,
	"slot_minutes" integer DEFAULT 30 NOT NULL,
	"min_lead_hours" integer DEFAULT 2 NOT NULL,
	"max_advance_days" integer DEFAULT 30 NOT NULL,
	CONSTRAINT "clinic_settings_single_row" CHECK ("clinic_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"duration_min" integer NOT NULL,
	"price_php" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_starts_at_idx" ON "appointments" USING btree ("starts_at");