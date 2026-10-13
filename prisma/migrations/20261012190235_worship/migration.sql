-- CreateTable
CREATE TABLE `songs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `artist` VARCHAR(191) NULL,
    `songKey` VARCHAR(10) NULL,
    `bpm` INTEGER NULL,
    `lyrics` LONGTEXT NULL,
    `notes` TEXT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `links` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `songs_organizationId_isActive_title_idx`(`organizationId`, `isActive`, `title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `worship_programs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,
    `weekStart` DATE NOT NULL,
    `title` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `worship_programs_organizationId_weekStart_idx`(`organizationId`, `weekStart`),
    UNIQUE INDEX `worship_programs_ministryId_weekStart_key`(`ministryId`, `weekStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `worship_program_songs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `songId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `keyUsed` VARCHAR(10) NULL,
    `notes` VARCHAR(191) NULL,

    INDEX `worship_program_songs_songId_idx`(`songId`),
    UNIQUE INDEX `worship_program_songs_programId_position_key`(`programId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `worship_roster` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,
    `serviceAt` DATETIME(3) NOT NULL,
    `serviceLabel` VARCHAR(191) NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `instrument` VARCHAR(191) NULL,
    `status` ENUM('pending', 'confirmed', 'declined') NOT NULL DEFAULT 'pending',
    `createdByUserId` VARCHAR(191) NULL,
    `respondedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `worship_roster_organizationId_serviceAt_idx`(`organizationId`, `serviceAt`),
    INDEX `worship_roster_memberId_serviceAt_idx`(`memberId`, `serviceAt`),
    UNIQUE INDEX `worship_roster_ministryId_serviceAt_memberId_key`(`ministryId`, `serviceAt`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `worship_auditions` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `instrument` VARCHAR(191) NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `status` ENUM('scheduled', 'passed', 'failed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    `notes` TEXT NULL,
    `decidedByUserId` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `worship_auditions_ministryId_scheduledAt_idx`(`ministryId`, `scheduledAt`),
    INDEX `worship_auditions_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `songs` ADD CONSTRAINT `songs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_programs` ADD CONSTRAINT `worship_programs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_programs` ADD CONSTRAINT `worship_programs_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_program_songs` ADD CONSTRAINT `worship_program_songs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_program_songs` ADD CONSTRAINT `worship_program_songs_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `worship_programs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_program_songs` ADD CONSTRAINT `worship_program_songs_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `songs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_roster` ADD CONSTRAINT `worship_roster_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_roster` ADD CONSTRAINT `worship_roster_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_roster` ADD CONSTRAINT `worship_roster_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_auditions` ADD CONSTRAINT `worship_auditions_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_auditions` ADD CONSTRAINT `worship_auditions_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `worship_auditions` ADD CONSTRAINT `worship_auditions_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
