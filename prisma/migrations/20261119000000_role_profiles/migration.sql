BEGIN;

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" TEXT NOT NULL,
    "groupId" TEXT,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "userId" TEXT NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "_ScopedGroups" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ScopedGroups_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "StudentProfile_groupId_idx" ON "StudentProfile"("groupId");

-- CreateIndex
CREATE INDEX "_ScopedGroups_B_index" ON "_ScopedGroups"("B");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScopedGroups" ADD CONSTRAINT "_ScopedGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "StaffProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScopedGroups" ADD CONSTRAINT "_ScopedGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve current student memberships and staff group assignments.
INSERT INTO "StudentProfile" ("userId", "groupId")
SELECT "id", "groupId" FROM "User" WHERE "role" = 'STUDENT';

INSERT INTO "StaffProfile" ("userId")
SELECT "id" FROM "User" WHERE "role" = 'STAFF';

INSERT INTO "_ScopedGroups" ("A", "B")
SELECT membership."B", membership."A"
FROM "_StaffGroups" AS membership
JOIN "StaffProfile" AS profile ON profile."userId" = membership."B";

DROP TABLE "_StaffGroups";
ALTER TABLE "User" DROP COLUMN "groupId";

COMMIT;
