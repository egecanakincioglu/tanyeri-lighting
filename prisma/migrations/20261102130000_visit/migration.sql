-- CreateTable
CREATE TABLE "visit" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "address" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "views" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visit_day_idx" ON "visit"("day");

-- CreateIndex
CREATE UNIQUE INDEX "visit_day_address_key" ON "visit"("day", "address");
