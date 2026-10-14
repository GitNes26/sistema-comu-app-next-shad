-- AlterTable
ALTER TABLE `employees` ADD COLUMN `dailyHours` DECIMAL(5, 2) NOT NULL DEFAULT 8,
    ADD COLUMN `holidayRate` DECIMAL(5, 2) NOT NULL DEFAULT 2,
    ADD COLUMN `overtimeRate` DECIMAL(5, 2) NOT NULL DEFAULT 2,
    ADD COLUMN `restDayRate` DECIMAL(5, 2) NOT NULL DEFAULT 2,
    ADD COLUMN `shiftEnd` VARCHAR(5) NULL,
    ADD COLUMN `shiftStart` VARCHAR(5) NULL,
    ADD COLUMN `workDays` JSON NULL;

-- AlterTable
ALTER TABLE `payroll_entries` ADD COLUMN `absences` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `dailyRate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `daysWorked` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `deductionLines` JSON NULL,
    ADD COLUMN `emailedAt` DATETIME(3) NULL,
    ADD COLUMN `grossPay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `holidayDays` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `holidayPay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `hourlyRate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `hoursWorked` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `overtimeHours` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `overtimePay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `payMethod` VARCHAR(191) NOT NULL DEFAULT 'cash',
    ADD COLUMN `perceptionLines` JSON NULL,
    ADD COLUMN `restDayPay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `restDaysWorked` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `salaryAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `salaryType` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `payroll_runs` ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `folio` VARCHAR(191) NULL,
    ADD COLUMN `frequency` VARCHAR(191) NOT NULL DEFAULT 'custom',
    ADD COLUMN `holidays` JSON NULL,
    ADD COLUMN `notes` TEXT NULL,
    MODIFY `status` ENUM('draft', 'closed', 'paid') NOT NULL DEFAULT 'draft';

-- CreateTable
CREATE TABLE `payroll_concepts` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `calc` VARCHAR(191) NOT NULL DEFAULT 'fixed',
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payroll_concepts_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payroll_concepts` ADD CONSTRAINT `payroll_concepts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: las nóminas anteriores (sueldo + bono − deducciones) conservan sus importes.
UPDATE `payroll_entries` SET `grossPay` = `base` + `bonus`;
UPDATE `payroll_entries` e JOIN `payroll_runs` r ON r.`id` = e.`runId` SET e.`paidAt` = r.`paidAt` WHERE r.`status` = 'paid';
UPDATE `payroll_runs` SET `closedAt` = `paidAt` WHERE `status` = 'paid' AND `closedAt` IS NULL;
