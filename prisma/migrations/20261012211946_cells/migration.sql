-- CreateTable
CREATE TABLE `cell_networks` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `leaderMemberId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cell_networks_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cell_types` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `cell_types_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cells` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `typeId` VARCHAR(191) NULL,
    `networkId` VARCHAR(191) NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `hostMemberId` VARCHAR(191) NULL,
    `hostName` VARCHAR(191) NULL,
    `street` VARCHAR(191) NULL,
    `neighborhood` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cells_organizationId_isActive_idx`(`organizationId`, `isActive`),
    INDEX `cells_networkId_idx`(`networkId`),
    UNIQUE INDEX `cells_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cell_members` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `cellId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `role` ENUM('leader', 'support', 'member') NOT NULL DEFAULT 'member',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `cell_members_memberId_isActive_idx`(`memberId`, `isActive`),
    UNIQUE INDEX `cell_members_cellId_memberId_key`(`cellId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cell_meetings` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `cellId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `topic` VARCHAR(191) NULL,
    `topicUrl` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `evidenceUrls` JSON NOT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cell_meetings_organizationId_date_idx`(`organizationId`, `date`),
    UNIQUE INDEX `cell_meetings_cellId_date_key`(`cellId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cell_attendance` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `present` BOOLEAN NOT NULL DEFAULT true,
    `isNew` BOOLEAN NOT NULL DEFAULT false,

    INDEX `cell_attendance_memberId_idx`(`memberId`),
    UNIQUE INDEX `cell_attendance_meetingId_memberId_key`(`meetingId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cell_transfers` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `fromCellId` VARCHAR(191) NOT NULL,
    `toCellId` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `reason` VARCHAR(191) NULL,
    `requestedByUserId` VARCHAR(191) NULL,
    `decidedByUserId` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cell_transfers_toCellId_status_idx`(`toCellId`, `status`),
    INDEX `cell_transfers_fromCellId_status_idx`(`fromCellId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cell_networks` ADD CONSTRAINT `cell_networks_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_networks` ADD CONSTRAINT `cell_networks_leaderMemberId_fkey` FOREIGN KEY (`leaderMemberId`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_types` ADD CONSTRAINT `cell_types_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cells` ADD CONSTRAINT `cells_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cells` ADD CONSTRAINT `cells_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `cell_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cells` ADD CONSTRAINT `cells_networkId_fkey` FOREIGN KEY (`networkId`) REFERENCES `cell_networks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cells` ADD CONSTRAINT `cells_hostMemberId_fkey` FOREIGN KEY (`hostMemberId`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_members` ADD CONSTRAINT `cell_members_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_members` ADD CONSTRAINT `cell_members_cellId_fkey` FOREIGN KEY (`cellId`) REFERENCES `cells`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_members` ADD CONSTRAINT `cell_members_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_meetings` ADD CONSTRAINT `cell_meetings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_meetings` ADD CONSTRAINT `cell_meetings_cellId_fkey` FOREIGN KEY (`cellId`) REFERENCES `cells`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_attendance` ADD CONSTRAINT `cell_attendance_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_attendance` ADD CONSTRAINT `cell_attendance_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `cell_meetings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_attendance` ADD CONSTRAINT `cell_attendance_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_transfers` ADD CONSTRAINT `cell_transfers_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_transfers` ADD CONSTRAINT `cell_transfers_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_transfers` ADD CONSTRAINT `cell_transfers_fromCellId_fkey` FOREIGN KEY (`fromCellId`) REFERENCES `cells`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cell_transfers` ADD CONSTRAINT `cell_transfers_toCellId_fkey` FOREIGN KEY (`toCellId`) REFERENCES `cells`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
