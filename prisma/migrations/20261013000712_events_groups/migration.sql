-- AlterTable
ALTER TABLE `cell_networks` ADD COLUMN `ministryId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `cells` ADD COLUMN `ministryId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `gathering_series` ADD COLUMN `ministryId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `gatherings` ADD COLUMN `ministryId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `venues` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `kind` VARCHAR(20) NOT NULL DEFAULT 'auditorium',
    `planWidth` INTEGER NOT NULL DEFAULT 1000,
    `planHeight` INTEGER NOT NULL DEFAULT 600,
    `layout` JSON NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `venues_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NULL,
    `scope` ENUM('internal', 'external') NOT NULL DEFAULT 'internal',
    `kind` VARCHAR(40) NOT NULL DEFAULT 'general',
    `name` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `location` VARCHAR(191) NULL,
    `venueId` VARCHAR(191) NULL,
    `status` ENUM('draft', 'published', 'closed', 'cancelled') NOT NULL DEFAULT 'draft',
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `capacity` INTEGER NULL,
    `audience` ENUM('open', 'leaders', 'ministries') NOT NULL DEFAULT 'open',
    `seating` ENUM('free', 'sections', 'seats') NOT NULL DEFAULT 'free',
    `seatSelection` ENUM('self', 'assigned', 'both') NOT NULL DEFAULT 'both',
    `selfRegistration` BOOLEAN NOT NULL DEFAULT true,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `events_organizationId_startsAt_idx`(`organizationId`, `startsAt`),
    INDEX `events_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_audience_ministries` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `event_audience_ministries_eventId_ministryId_key`(`eventId`, `ministryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_sections` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `layoutSectionId` VARCHAR(191) NULL,

    UNIQUE INDEX `event_sections_eventId_name_key`(`eventId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_itinerary` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `durationMin` INTEGER NOT NULL DEFAULT 30,
    `kind` ENUM('activity', 'clinic', 'break', 'meal') NOT NULL DEFAULT 'activity',
    `title` VARCHAR(191) NOT NULL,
    `speakerName` VARCHAR(191) NULL,
    `responsibleMemberId` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `event_itinerary_eventId_startsAt_idx`(`eventId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_checklist` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `itineraryId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `isDone` BOOLEAN NOT NULL DEFAULT false,
    `doneAt` DATETIME(3) NULL,
    `doneByUserId` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `event_checklist_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_tickets` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NULL,
    `guestName` VARCHAR(191) NULL,
    `guestPhone` VARCHAR(191) NULL,
    `status` ENUM('reserved', 'paid', 'cancelled') NOT NULL DEFAULT 'reserved',
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `sectionId` VARCHAR(191) NULL,
    `seatCode` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `checkedInAt` DATETIME(3) NULL,
    `checkedInByUserId` VARCHAR(191) NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cancelledAt` DATETIME(3) NULL,

    UNIQUE INDEX `event_tickets_code_key`(`code`),
    INDEX `event_tickets_eventId_status_idx`(`eventId`, `status`),
    INDEX `event_tickets_memberId_idx`(`memberId`),
    UNIQUE INDEX `event_tickets_eventId_seatCode_key`(`eventId`, `seatCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_payments` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `method` ENUM('cash', 'transfer', 'card', 'other') NOT NULL DEFAULT 'cash',
    `reference` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedByUserId` VARCHAR(191) NULL,

    INDEX `event_payments_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cell_networks` ADD CONSTRAINT `cell_networks_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cells` ADD CONSTRAINT `cells_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gathering_series` ADD CONSTRAINT `gathering_series_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gatherings` ADD CONSTRAINT `gatherings_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venues` ADD CONSTRAINT `venues_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_venueId_fkey` FOREIGN KEY (`venueId`) REFERENCES `venues`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_audience_ministries` ADD CONSTRAINT `event_audience_ministries_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_audience_ministries` ADD CONSTRAINT `event_audience_ministries_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_audience_ministries` ADD CONSTRAINT `event_audience_ministries_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_sections` ADD CONSTRAINT `event_sections_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_sections` ADD CONSTRAINT `event_sections_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_itinerary` ADD CONSTRAINT `event_itinerary_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_itinerary` ADD CONSTRAINT `event_itinerary_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_itinerary` ADD CONSTRAINT `event_itinerary_responsibleMemberId_fkey` FOREIGN KEY (`responsibleMemberId`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_checklist` ADD CONSTRAINT `event_checklist_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_checklist` ADD CONSTRAINT `event_checklist_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_checklist` ADD CONSTRAINT `event_checklist_itineraryId_fkey` FOREIGN KEY (`itineraryId`) REFERENCES `event_itinerary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_tickets` ADD CONSTRAINT `event_tickets_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_tickets` ADD CONSTRAINT `event_tickets_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_tickets` ADD CONSTRAINT `event_tickets_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_tickets` ADD CONSTRAINT `event_tickets_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `event_sections`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_payments` ADD CONSTRAINT `event_payments_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_payments` ADD CONSTRAINT `event_payments_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `event_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
