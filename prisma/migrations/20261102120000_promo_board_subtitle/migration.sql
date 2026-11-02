-- Existing promo boards get an empty subtitle (none shown); new rows must state it.
ALTER TABLE "promoBoard" ADD COLUMN "subtitleTr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "promoBoard" ADD COLUMN "subtitleEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "promoBoard" ALTER COLUMN "subtitleTr" DROP DEFAULT;
ALTER TABLE "promoBoard" ALTER COLUMN "subtitleEn" DROP DEFAULT;
