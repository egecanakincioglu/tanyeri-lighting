-- AlterTable
ALTER TABLE "applicationArea" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "category" ADD COLUMN     "h1En" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "h1Tr" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "introEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "introTr" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "seoDescriptionEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "seoDescriptionTr" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "seoTitleEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "seoTitleTr" TEXT NOT NULL DEFAULT '';

-- AddForeignKey
ALTER TABLE "applicationArea" ADD CONSTRAINT "applicationArea_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

