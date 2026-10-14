-- AlterTable
ALTER TABLE `company_profiles` ADD COLUMN `heroImageUrl` VARCHAR(191) NULL,
    ADD COLUMN `mapUrl` VARCHAR(500) NULL,
    ADD COLUMN `pastorMessage` TEXT NULL,
    ADD COLUMN `pastorName` VARCHAR(120) NULL,
    ADD COLUMN `publicEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `publicSlug` VARCHAR(60) NULL,
    ADD COLUMN `tagline` VARCHAR(160) NULL;

-- AlterTable
ALTER TABLE `gathering_series` ADD COLUMN `description` VARCHAR(200) NULL,
    ADD COLUMN `endTime` VARCHAR(5) NULL,
    ADD COLUMN `isPublic` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `modality` VARCHAR(12) NOT NULL DEFAULT 'in_person';

-- CreateTable
CREATE TABLE `prayer_requests` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NULL,
    `name` VARCHAR(120) NULL,
    `contact` VARCHAR(150) NULL,
    `body` TEXT NOT NULL,
    `visibility` VARCHAR(10) NOT NULL DEFAULT 'team',
    `status` VARCHAR(10) NOT NULL DEFAULT 'open',
    `answeredNote` VARCHAR(300) NULL,
    `source` VARCHAR(10) NOT NULL DEFAULT 'portal',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `answeredAt` DATETIME(3) NULL,

    INDEX `prayer_requests_organizationId_status_createdAt_idx`(`organizationId`, `status`, `createdAt`),
    INDEX `prayer_requests_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `connection_cards` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(12) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(150) NULL,
    `message` TEXT NULL,
    `interest` VARCHAR(80) NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'new',
    `memberId` VARCHAR(191) NULL,
    `handledNote` VARCHAR(300) NULL,
    `handledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `connection_cards_organizationId_status_createdAt_idx`(`organizationId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `company_profiles_publicSlug_key` ON `company_profiles`(`publicSlug`);

-- AddForeignKey
ALTER TABLE `prayer_requests` ADD CONSTRAINT `prayer_requests_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prayer_requests` ADD CONSTRAINT `prayer_requests_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `connection_cards` ADD CONSTRAINT `connection_cards_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `connection_cards` ADD CONSTRAINT `connection_cards_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Tonos de marca por defecto (azul comunidad + dorado). Las iglesias existentes conservan sus valores.
ALTER TABLE `app_settings` ALTER COLUMN `primaryHue` SET DEFAULT 245, ALTER COLUMN `accentHue` SET DEFAULT 85;
