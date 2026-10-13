-- CreateTable
CREATE TABLE `payment_gateways` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(20) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `mode` VARCHAR(10) NOT NULL DEFAULT 'test',
    `publicKey` VARCHAR(255) NULL,
    `secretKeyEnc` TEXT NOT NULL,
    `webhookSecretEnc` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_gateways_organizationId_provider_key`(`organizationId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_gateways` ADD CONSTRAINT `payment_gateways_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
