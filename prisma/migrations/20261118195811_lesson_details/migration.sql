-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LessonType" ADD VALUE 'SEMINAR';
ALTER TYPE "LessonType" ADD VALUE 'LAB';
ALTER TYPE "LessonType" ADD VALUE 'TEST';
ALTER TYPE "LessonType" ADD VALUE 'EXAM';

-- AlterTable
ALTER TABLE "Deadline" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "lessonId" TEXT;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "campus" TEXT,
ADD COLUMN     "groups" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "originalEndsAt" TIMESTAMP(3),
ADD COLUMN     "originalStartsAt" TIMESTAMP(3),
ADD COLUMN     "teachers" JSONB;

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_userId_idx" ON "Attendance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_lessonId_userId_key" ON "Attendance"("lessonId", "userId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
