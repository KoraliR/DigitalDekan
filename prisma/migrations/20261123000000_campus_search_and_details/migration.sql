-- AlterTable
ALTER TABLE "CampusBook" ADD COLUMN     "isbn" TEXT;

-- AlterTable
ALTER TABLE "CampusPost" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT;

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "attendanceScore" INTEGER,
ADD COLUMN     "controlScore" INTEGER,
ADD COLUMN     "practiceScore" INTEGER;
