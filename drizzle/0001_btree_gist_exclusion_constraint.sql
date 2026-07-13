-- Hand-written: drizzle-kit cannot generate exclusion constraints from the
-- Drizzle schema, so this file is authored directly and only ever grown by
-- hand-written migrations, never overwritten by `drizzle-kit generate`.
--
-- Makes double-booking impossible at the database level: two appointments
-- with overlapping [starts_at, ends_at) ranges cannot both be pending or
-- confirmed at the same time, regardless of any race in application code.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "appointments"
	ADD CONSTRAINT "appointments_no_overlap"
	EXCLUDE USING gist (
		tstzrange("starts_at", "ends_at") WITH &&
	) WHERE (status IN ('pending', 'confirmed'));