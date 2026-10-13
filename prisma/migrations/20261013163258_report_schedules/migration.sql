-- CreateTable
CREATE TABLE `report_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(30) NOT NULL,
    `frequency` VARCHAR(10) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL DEFAULT 1,
    `dayOfMonth` INTEGER NOT NULL DEFAULT 1,
    `hour` INTEGER NOT NULL DEFAULT 8,
    `recipients` JSON NOT NULL,
    `includeCsv` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `nextRunAt` DATETIME(3) NULL,
    `lastRunAt` DATETIME(3) NULL,
    `lastStatus` VARCHAR(10) NULL,
    `lastError` VARCHAR(300) NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `report_schedules_isActive_nextRunAt_idx`(`isActive`, `nextRunAt`),
    INDEX `report_schedules_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `report_schedules` ADD CONSTRAINT `report_schedules_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
