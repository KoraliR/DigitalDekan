-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('EXAM', 'TEST', 'COURSEWORK');

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "assessment" "AssessmentType",
ADD COLUMN     "finalGrade" INTEGER,
ADD COLUMN     "passed" BOOLEAN;
