-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionTr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "beforeImageUrl" TEXT NOT NULL,
    "afterImageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionTr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_sortOrder_idx" ON "project"("sortOrder");

-- CreateIndex
CREATE INDEX "reference_sortOrder_idx" ON "reference"("sortOrder");
