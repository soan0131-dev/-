-- CreateEnum
CREATE TYPE "DocumentChecklistType" AS ENUM ('GENERAL', 'EXPERIENCED_CPA', 'SIMPLIFIED');

-- AlterTable
ALTER TABLE "employee_cases" ADD COLUMN     "checklistType" "DocumentChecklistType";
