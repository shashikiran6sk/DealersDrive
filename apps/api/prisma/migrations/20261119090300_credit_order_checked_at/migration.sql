-- When an unpaid order was last asked about at Razorpay, so the re-check job
-- spaces its questions out instead of asking every run.
ALTER TABLE "credit_orders" ADD COLUMN "checkedAt" TIMESTAMP(3);
