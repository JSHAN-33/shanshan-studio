-- CreateTable
CREATE TABLE "WaxReminder" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaxReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaxReminder_dueDate_idx" ON "WaxReminder"("dueDate");

-- CreateIndex
CREATE INDEX "WaxReminder_phone_idx" ON "WaxReminder"("phone");
