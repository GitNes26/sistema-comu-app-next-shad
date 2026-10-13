-- CreateTable
CREATE TABLE `ministries` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(30) NOT NULL DEFAULT 'general',
    `description` TEXT NULL,
    `requirements` TEXT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ministries_organizationId_isActive_idx`(`organizationId`, `isActive`),
    UNIQUE INDEX `ministries_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ministry_members` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `role` ENUM('leader', 'assistant', 'servant') NOT NULL DEFAULT 'servant',
    `positionTitle` VARCHAR(191) NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ministry_members_organizationId_memberId_isActive_idx`(`organizationId`, `memberId`, `isActive`),
    UNIQUE INDEX `ministry_members_ministryId_memberId_key`(`ministryId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ministry_meetings` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `kind` ENUM('internal', 'rehearsal', 'service') NOT NULL DEFAULT 'internal',
    `startsAt` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ministry_meetings_ministryId_startsAt_idx`(`ministryId`, `startsAt`),
    INDEX `ministry_meetings_organizationId_startsAt_idx`(`organizationId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ministry_attendance` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `status` ENUM('present', 'absent', 'excused') NOT NULL,
    `note` VARCHAR(191) NULL,
    `markedByUserId` VARCHAR(191) NULL,
    `markedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ministry_attendance_organizationId_memberId_idx`(`organizationId`, `memberId`),
    UNIQUE INDEX `ministry_attendance_meetingId_memberId_key`(`meetingId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ministry_requests` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `quantity` INTEGER NULL,
    `neededBy` DATE NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    `requestedByUserId` VARCHAR(191) NOT NULL,
    `decidedByUserId` VARCHAR(191) NULL,
    `decisionNote` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ministry_requests_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `ministry_requests_ministryId_createdAt_idx`(`ministryId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ministries` ADD CONSTRAINT `ministries_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministries` ADD CONSTRAINT `ministries_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ministries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministry_members` ADD CONSTRAINT `ministry_members_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministry_members` ADD CONSTRAINT `ministry_members_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministry_members` ADD CONSTRAINT `ministry_members_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministry_meetings` ADD CONSTRAINT `ministry_meetings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministry_meetings` ADD CONSTRAINT `ministry_meetings_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministry_attendance` ADD CONSTRAINT `ministry_attendance_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministry_attendance` ADD CONSTRAINT `ministry_attendance_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `ministry_meetings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministry_attendance` ADD CONSTRAINT `ministry_attendance_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministry_requests` ADD CONSTRAINT `ministry_requests_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ministry_requests` ADD CONSTRAINT `ministry_requests_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
