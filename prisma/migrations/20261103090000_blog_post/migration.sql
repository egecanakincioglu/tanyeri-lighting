-- CreateTable
CREATE TABLE "blog_post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionTr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "excerptTr" TEXT NOT NULL,
    "excerptEn" TEXT NOT NULL,
    "bodyTr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageAltTr" TEXT NOT NULL,
    "imageAltEn" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_slug_key" ON "blog_post"("slug");

-- CreateIndex
CREATE INDEX "blog_post_publishedAt_idx" ON "blog_post"("publishedAt");
