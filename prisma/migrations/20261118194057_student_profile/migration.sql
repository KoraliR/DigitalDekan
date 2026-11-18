-- CreateEnum
CREATE TYPE "Funding" AS ENUM ('BUDGET', 'CONTRACT');

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "studentId" TEXT,
    "institute" TEXT,
    "faculty" TEXT,
    "department" TEXT,
    "programCode" TEXT,
    "programName" TEXT,
    "course" INTEGER,
    "groupName" TEXT,
    "funding" "Funding",
    "phone" TEXT,
    "contactEmail" TEXT,
    "messengerUrl" TEXT,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_studentId_key" ON "StudentProfile"("studentId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
