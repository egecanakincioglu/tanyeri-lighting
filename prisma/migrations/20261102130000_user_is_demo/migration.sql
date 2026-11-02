-- Marks the published demo account; the session guard ignores it outside demo mode.
ALTER TABLE "user" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
