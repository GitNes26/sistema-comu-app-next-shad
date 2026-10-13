-- CreateTable
CREATE TABLE `gathering_series` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('general', 'youth') NOT NULL DEFAULT 'general',
    `dayOfWeek` INTEGER NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `gathering_series_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gatherings` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `seriesId` VARCHAR(191) NULL,
    `kind` ENUM('general', 'youth') NOT NULL DEFAULT 'general',
    `date` DATE NOT NULL,
    `startTime` VARCHAR(5) NULL,
    `topic` VARCHAR(191) NULL,
    `speakerMemberId` VARCHAR(191) NULL,
    `speakerName` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `evidenceUrls` JSON NOT NULL,
    `menCount` INTEGER NOT NULL DEFAULT 0,
    `womenCount` INTEGER NOT NULL DEFAULT 0,
    `youthCount` INTEGER NOT NULL DEFAULT 0,
    `kidsCount` INTEGER NOT NULL DEFAULT 0,
    `newCount` INTEGER NOT NULL DEFAULT 0,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `gatherings_organizationId_date_idx`(`organizationId`, `date`),
    INDEX `gatherings_organizationId_kind_date_idx`(`organizationId`, `kind`, `date`),
    UNIQUE INDEX `gatherings_seriesId_date_key`(`seriesId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gathering_ministries` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `gatheringId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `gathering_ministries_gatheringId_ministryId_key`(`gatheringId`, `ministryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `gathering_series` ADD CONSTRAINT `gathering_series_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gatherings` ADD CONSTRAINT `gatherings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gatherings` ADD CONSTRAINT `gatherings_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `gathering_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gatherings` ADD CONSTRAINT `gatherings_speakerMemberId_fkey` FOREIGN KEY (`speakerMemberId`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gathering_ministries` ADD CONSTRAINT `gathering_ministries_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gathering_ministries` ADD CONSTRAINT `gathering_ministries_gatheringId_fkey` FOREIGN KEY (`gatheringId`) REFERENCES `gatherings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gathering_ministries` ADD CONSTRAINT `gathering_ministries_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
