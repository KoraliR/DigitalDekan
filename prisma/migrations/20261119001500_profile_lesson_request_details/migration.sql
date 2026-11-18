-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "Funding" AS ENUM ('BUDGET', 'CONTRACT');

-- AlterEnum
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

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "number" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "course" INTEGER,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "faculty" TEXT,
ADD COLUMN     "funding" "Funding",
ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "institute" TEXT,
ADD COLUMN     "messengerUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "programCode" TEXT,
ADD COLUMN     "programName" TEXT,
ADD COLUMN     "studentId" TEXT;

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

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_number_key" ON "ServiceRequest"("number");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_studentId_key" ON "StudentProfile"("studentId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
