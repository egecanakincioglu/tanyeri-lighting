-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "colorTr" TEXT NOT NULL,
    "colorEn" TEXT NOT NULL,
    "materialTr" TEXT NOT NULL,
    "materialEn" TEXT NOT NULL,
    "power" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productSlugRedirect" (
    "id" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productSlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog" (
    "id" TEXT NOT NULL,
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_key_key" ON "category"("key");

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_key" ON "product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_code_key" ON "product"("code");

-- CreateIndex
CREATE INDEX "product_categoryId_sortOrder_idx" ON "product"("categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "productSlugRedirect_oldSlug_key" ON "productSlugRedirect"("oldSlug");

-- CreateIndex
CREATE INDEX "productSlugRedirect_productId_idx" ON "productSlugRedirect"("productId");

-- CreateIndex
CREATE INDEX "catalog_sortOrder_idx" ON "catalog"("sortOrder");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productSlugRedirect" ADD CONSTRAINT "productSlugRedirect_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
