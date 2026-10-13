-- CreateTable
CREATE TABLE `bank_statements` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `fileName` VARCHAR(200) NULL,
    `periodFrom` DATE NULL,
    `periodTo` DATE NULL,
    `uploadedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bank_statements_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_lines` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `statementId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `description` VARCHAR(300) NOT NULL,
    `reference` VARCHAR(100) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `balance` DECIMAL(12, 2) NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'pending',
    `matchKind` VARCHAR(10) NULL,
    `matchId` VARCHAR(191) NULL,
    `matchedByUserId` VARCHAR(191) NULL,
    `matchedAt` DATETIME(3) NULL,
    `dedupeKey` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bank_lines_statementId_status_idx`(`statementId`, `status`),
    UNIQUE INDEX `bank_lines_organizationId_dedupeKey_key`(`organizationId`, `dedupeKey`),
    UNIQUE INDEX `bank_lines_organizationId_matchKind_matchId_key`(`organizationId`, `matchKind`, `matchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bank_statements` ADD CONSTRAINT `bank_statements_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_lines` ADD CONSTRAINT `bank_lines_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_lines` ADD CONSTRAINT `bank_lines_statementId_fkey` FOREIGN KEY (`statementId`) REFERENCES `bank_statements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
