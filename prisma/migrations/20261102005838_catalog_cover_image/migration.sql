-- Existing catalogs get an empty cover (no picture); new rows must state it.
ALTER TABLE "catalog" ADD COLUMN "coverImageUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "catalog" ALTER COLUMN "coverImageUrl" DROP DEFAULT;
