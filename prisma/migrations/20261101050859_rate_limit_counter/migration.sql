-- CreateTable
CREATE TABLE "rateLimitCounter" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "rateLimitCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "rateLimitCounter_windowStart_idx" ON "rateLimitCounter"("windowStart");
