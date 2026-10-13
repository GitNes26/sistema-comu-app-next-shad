-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NULL,
    `concept` VARCHAR(191) NOT NULL,
    `category` VARCHAR(40) NOT NULL DEFAULT 'otro',
    `amount` DECIMAL(10, 2) NOT NULL,
    `spentAt` DATE NOT NULL,
    `vendor` VARCHAR(191) NULL,
    `receiptUrl` VARCHAR(191) NULL,
    `paymentMethod` ENUM('cash', 'transfer', 'card', 'other') NULL,
    `notes` TEXT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `expenses_organizationId_spentAt_idx`(`organizationId`, `spentAt`),
    INDEX `expenses_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
