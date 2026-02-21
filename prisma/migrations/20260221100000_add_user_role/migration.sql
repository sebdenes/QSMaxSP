-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PLANNER', 'VIEWER');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'PLANNER';
