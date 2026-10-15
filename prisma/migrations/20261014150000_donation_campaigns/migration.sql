-- AlterTable
ALTER TABLE `company_profiles` ADD COLUMN `publicGiving` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `incomes` ADD COLUMN `campaignId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `donations` ADD COLUMN `campaignId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `donation_campaigns` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `kind` VARCHAR(12) NOT NULL DEFAULT 'project',
    `goalAmount` DECIMAL(14, 2) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `startsAt` DATE NULL,
    `endsAt` DATE NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'active',
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `donation_campaigns_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `incomes_campaignId_idx` ON `incomes`(`campaignId`);

-- AddForeignKey
ALTER TABLE `incomes` ADD CONSTRAINT `incomes_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `donation_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donations` ADD CONSTRAINT `donations_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `donation_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation_campaigns` ADD CONSTRAINT `donation_campaigns_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

