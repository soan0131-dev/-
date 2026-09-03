-- DropForeignKey
ALTER TABLE "employee_cases" DROP CONSTRAINT "employee_cases_employeeId_fkey";

-- AddForeignKey
ALTER TABLE "employee_cases" ADD CONSTRAINT "employee_cases_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey (auto-diff missed this one; confirmed via --from-empty comparison)
ALTER TABLE "users" DROP CONSTRAINT "users_employeeId_fkey";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
