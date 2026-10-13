-- AlterTable
ALTER TABLE `kids_sessions` ADD COLUMN `endDate` DATE NULL,
    ADD COLUMN `kind` VARCHAR(10) NOT NULL DEFAULT 'service',
    ADD COLUMN `location` VARCHAR(191) NULL;
