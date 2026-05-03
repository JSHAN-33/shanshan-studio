-- Fix paidAt: set to booking date+time instead of checkout timestamp
UPDATE "Booking"
SET "paidAt" = ("date" || 'T' || "time" || ':00')::timestamp
WHERE "paidAt" IS NOT NULL;
