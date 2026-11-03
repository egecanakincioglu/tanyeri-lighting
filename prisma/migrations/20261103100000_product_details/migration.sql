-- AlterTable
ALTER TABLE "product" ADD COLUMN     "descriptionEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "descriptionTr" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "luminousFlux" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "colorTemperature" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cri" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ip" TEXT NOT NULL DEFAULT '';
