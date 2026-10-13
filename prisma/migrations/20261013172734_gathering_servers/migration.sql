-- CreateTable
CREATE TABLE `gathering_servers` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `gatheringId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `status` ENUM('present', 'absent', 'excused') NOT NULL,
    `note` VARCHAR(200) NULL,
    `markedByUserId` VARCHAR(191) NULL,
    `markedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gathering_servers_ministryId_memberId_idx`(`ministryId`, `memberId`),
    INDEX `gathering_servers_organizationId_gatheringId_idx`(`organizationId`, `gatheringId`),
    UNIQUE INDEX `gathering_servers_gatheringId_ministryId_memberId_key`(`gatheringId`, `ministryId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `gathering_servers` ADD CONSTRAINT `gathering_servers_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gathering_servers` ADD CONSTRAINT `gathering_servers_gatheringId_fkey` FOREIGN KEY (`gatheringId`) REFERENCES `gatherings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gathering_servers` ADD CONSTRAINT `gathering_servers_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gathering_servers` ADD CONSTRAINT `gathering_servers_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
