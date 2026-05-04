-- CreateTable
CREATE TABLE "ForcedOpenSlot" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,

    CONSTRAINT "ForcedOpenSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForcedOpenSlot_date_time_key" ON "ForcedOpenSlot"("date", "time");
