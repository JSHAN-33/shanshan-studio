-- AlterTable: Booking - add missing columns
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "duration" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "walletUsed" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "depositAmount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "depositStatus" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_paidAt_idx" ON "Booking"("paidAt");

-- AlterTable: Member - add missing columns
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "lineOaUserId" TEXT;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "pictureUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Member_lineUserId_key" ON "Member"("lineUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "Member_lineOaUserId_key" ON "Member"("lineOaUserId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ServiceHistory" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServiceHistory_phone_idx" ON "ServiceHistory"("phone");
CREATE INDEX IF NOT EXISTS "ServiceHistory_date_idx" ON "ServiceHistory"("date");
