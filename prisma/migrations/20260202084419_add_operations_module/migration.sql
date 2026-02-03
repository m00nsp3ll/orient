-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'PICKING_UP', 'AT_SPA', 'IN_SERVICE', 'DROPPING_OFF', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DRIVER';

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_staffId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "staffId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "driverId" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "pickupTime" TIMESTAMP(3),
    "arrivalTime" TIMESTAMP(3),
    "departureTime" TIMESTAMP(3),
    "dropoffTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE INDEX "Transfer_appointmentId_idx" ON "Transfer"("appointmentId");

-- CreateIndex
CREATE INDEX "Transfer_driverId_idx" ON "Transfer"("driverId");

-- CreateIndex
CREATE INDEX "Transfer_status_idx" ON "Transfer"("status");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
