-- CreateTable
CREATE TABLE "BookingMonth" (
    "yearMonth" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BookingMonth_pkey" PRIMARY KEY ("yearMonth")
);
