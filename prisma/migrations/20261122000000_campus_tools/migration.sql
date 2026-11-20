-- CreateEnum
CREATE TYPE "CampusSlotKind" AS ENUM ('CONSULTATION', 'RETAKE', 'ROOM', 'COWORKING', 'EQUIPMENT', 'SPORT');

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "surnameStress" INTEGER;

-- CreateTable
CREATE TABLE "CampusSlot" (
    "id" TEXT NOT NULL,
    "kind" "CampusSlotKind" NOT NULL,
    "title" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "staffId" TEXT,
    "groupId" TEXT,
    "retakeTerm" INTEGER,

    CONSTRAINT "CampusSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampusBooking" (
    "slotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CampusBooking_pkey" PRIMARY KEY ("slotId","userId")
);

-- CreateTable
CREATE TABLE "CampusBook" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,

    CONSTRAINT "CampusBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampusLoan" (
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "renewed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CampusLoan_pkey" PRIMARY KEY ("bookId","userId")
);

-- CreateTable
CREATE TABLE "CampusHold" (
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampusHold_pkey" PRIMARY KEY ("bookId","userId")
);

-- CreateTable
CREATE TABLE "CampusPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "flagged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CampusPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampusReply" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "CampusReply_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "CampusPortfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "link" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CampusPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampusPass" (
    "userId" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampusPass_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "CampusSlot_startsAt_idx" ON "CampusSlot"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampusSlot_kind_place_startsAt_key" ON "CampusSlot"("kind", "place", "startsAt");

-- CreateIndex
CREATE INDEX "CampusBooking_userId_idx" ON "CampusBooking"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CampusBook_title_key" ON "CampusBook"("title");

-- CreateIndex
CREATE INDEX "CampusHold_bookId_createdAt_idx" ON "CampusHold"("bookId", "createdAt");

-- CreateIndex
CREATE INDEX "CampusPortfolio_userId_idx" ON "CampusPortfolio"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CampusPass_digest_key" ON "CampusPass"("digest");

-- AddForeignKey
ALTER TABLE "CampusSlot" ADD CONSTRAINT "CampusSlot_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusBooking" ADD CONSTRAINT "CampusBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "CampusSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusBooking" ADD CONSTRAINT "CampusBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusLoan" ADD CONSTRAINT "CampusLoan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "CampusBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusLoan" ADD CONSTRAINT "CampusLoan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusHold" ADD CONSTRAINT "CampusHold_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "CampusBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusHold" ADD CONSTRAINT "CampusHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusPost" ADD CONSTRAINT "CampusPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusReply" ADD CONSTRAINT "CampusReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CampusPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusReply" ADD CONSTRAINT "CampusReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusPortfolio" ADD CONSTRAINT "CampusPortfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusPass" ADD CONSTRAINT "CampusPass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
