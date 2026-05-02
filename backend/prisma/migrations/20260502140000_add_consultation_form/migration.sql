-- CreateTable
CREATE TABLE "ConsultationForm" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "birthday" TEXT,
    "mobile" TEXT,
    "address" TEXT,
    "hairRemoval" JSONB NOT NULL,
    "isFirstWax" BOOLEAN NOT NULL DEFAULT false,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isAlcoholSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isPeriod" BOOLEAN NOT NULL DEFAULT false,
    "isPregnant" BOOLEAN NOT NULL DEFAULT false,
    "isSick" BOOLEAN NOT NULL DEFAULT false,
    "hasAcne" BOOLEAN NOT NULL DEFAULT false,
    "consentAgreed" BOOLEAN NOT NULL DEFAULT false,
    "signatureData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationForm_phone_key" ON "ConsultationForm"("phone");
