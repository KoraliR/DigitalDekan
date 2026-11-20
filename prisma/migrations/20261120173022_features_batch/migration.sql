-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "GroupLesson" ADD COLUMN     "campus" TEXT,
ADD COLUMN     "originalEndsAt" TIMESTAMP(3),
ADD COLUMN     "originalStartsAt" TIMESTAMP(3),
ADD COLUMN     "teachers" JSONB;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "readAt" TIMESTAMP(3);
