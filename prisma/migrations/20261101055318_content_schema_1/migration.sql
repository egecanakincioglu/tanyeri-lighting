-- CreateTable
CREATE TABLE "siteSettings" (
    "id" TEXT NOT NULL,
    "siteNameTr" TEXT NOT NULL,
    "siteNameEn" TEXT NOT NULL,
    "logoUrl" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "addressTr" TEXT NOT NULL,
    "addressEn" TEXT NOT NULL,
    "workingHoursTr" TEXT NOT NULL,
    "workingHoursEn" TEXT NOT NULL,
    "serviceAreaTr" TEXT NOT NULL,
    "serviceAreaEn" TEXT NOT NULL,
    "languagesTr" TEXT NOT NULL,
    "languagesEn" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socialLink" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "labelTr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "socialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pageMetadata" (
    "pageKey" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionTr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pageMetadata_pkey" PRIMARY KEY ("pageKey")
);

-- CreateTable
CREATE TABLE "legalPage" (
    "pageKey" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyTr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legalPage_pkey" PRIMARY KEY ("pageKey")
);

-- CreateIndex
CREATE INDEX "socialLink_position_idx" ON "socialLink"("position");
