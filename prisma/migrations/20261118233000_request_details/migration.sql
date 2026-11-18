-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_number_key" ON "ServiceRequest"("number");
