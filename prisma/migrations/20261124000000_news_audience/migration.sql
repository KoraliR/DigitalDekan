-- AlterTable
ALTER TABLE "News" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'news';

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
