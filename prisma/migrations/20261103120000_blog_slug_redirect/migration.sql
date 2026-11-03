-- CreateTable
CREATE TABLE "blogPostSlugRedirect" (
    "id" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blogPostSlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blogPostSlugRedirect_oldSlug_key" ON "blogPostSlugRedirect"("oldSlug");

-- CreateIndex
CREATE INDEX "blogPostSlugRedirect_postId_idx" ON "blogPostSlugRedirect"("postId");

-- AddForeignKey
ALTER TABLE "blogPostSlugRedirect" ADD CONSTRAINT "blogPostSlugRedirect_postId_fkey" FOREIGN KEY ("postId") REFERENCES "blog_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
