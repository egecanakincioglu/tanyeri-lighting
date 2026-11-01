-- CreateTable
CREATE TABLE "homeBanner" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionTr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "primaryLabelTr" TEXT NOT NULL,
    "primaryLabelEn" TEXT NOT NULL,
    "primaryTarget" TEXT NOT NULL,
    "secondaryLabelTr" TEXT NOT NULL,
    "secondaryLabelEn" TEXT NOT NULL,
    "secondaryTarget" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homeBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featuredProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "featuredProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promoBoard" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promoBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationArea" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionTr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicationArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionTr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "noteTr" TEXT NOT NULL,
    "noteEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aboutPage" (
    "id" TEXT NOT NULL,
    "bodyTr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "visionTr" TEXT NOT NULL,
    "visionEn" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aboutPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "featuredProduct_productId_key" ON "featuredProduct"("productId");

-- CreateIndex
CREATE INDEX "featuredProduct_sortOrder_idx" ON "featuredProduct"("sortOrder");

-- CreateIndex
CREATE INDEX "promoBoard_sortOrder_idx" ON "promoBoard"("sortOrder");

-- CreateIndex
CREATE INDEX "promoBoard_catalogId_idx" ON "promoBoard"("catalogId");

-- CreateIndex
CREATE INDEX "applicationArea_sortOrder_idx" ON "applicationArea"("sortOrder");

-- CreateIndex
CREATE INDEX "service_sortOrder_idx" ON "service"("sortOrder");

-- AddForeignKey
ALTER TABLE "featuredProduct" ADD CONSTRAINT "featuredProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoBoard" ADD CONSTRAINT "promoBoard_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
