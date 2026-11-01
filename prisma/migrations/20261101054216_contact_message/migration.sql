-- CreateTable
CREATE TABLE "contactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "contactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contactMessage_createdAt_idx" ON "contactMessage"("createdAt");
