-- CreateTable
CREATE TABLE `consolidation_cases` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `visitedAt` DATE NOT NULL,
    `serviceLabel` VARCHAR(191) NULL,
    `acceptedChrist` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('received', 'following', 'channeled', 'closed') NOT NULL DEFAULT 'received',
    `assignedMemberId` VARCHAR(191) NULL,
    `outcome` ENUM('cell', 'meeting', 'none') NULL,
    `outcomeNote` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `closedAt` DATETIME(3) NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `consolidation_cases_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `consolidation_cases_assignedMemberId_status_idx`(`assignedMemberId`, `status`),
    UNIQUE INDEX `consolidation_cases_ministryId_memberId_key`(`ministryId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consolidation_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `contactedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `channel` ENUM('call', 'message', 'visit', 'in_person') NOT NULL,
    `summary` TEXT NOT NULL,
    `interest` ENUM('yes', 'maybe', 'no') NULL,
    `nextContactAt` DATETIME(3) NULL,
    `madeByMemberId` VARCHAR(191) NULL,
    `madeByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `consolidation_contacts_caseId_contactedAt_idx`(`caseId`, `contactedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kids_rooms` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `section` ENUM('baby', 'child') NOT NULL DEFAULT 'child',
    `minAgeMonths` INTEGER NOT NULL,
    `maxAgeMonths` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `kids_rooms_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kids_children` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `birthDate` DATE NOT NULL,
    `gender` ENUM('male', 'female') NULL,
    `imageUrl` VARCHAR(191) NULL,
    `roomId` VARCHAR(191) NULL,
    `indications` TEXT NULL,
    `qrToken` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `kids_children_qrToken_key`(`qrToken`),
    INDEX `kids_children_organizationId_isActive_fullName_idx`(`organizationId`, `isActive`, `fullName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kids_guardians` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `childId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `relation` VARCHAR(40) NOT NULL DEFAULT 'Padre/Madre',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kids_guardians_memberId_idx`(`memberId`),
    UNIQUE INDEX `kids_guardians_childId_memberId_key`(`childId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kids_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ministryId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `label` VARCHAR(60) NOT NULL DEFAULT 'Servicio',
    `status` ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    `openedByUserId` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kids_sessions_organizationId_date_idx`(`organizationId`, `date`),
    UNIQUE INDEX `kids_sessions_ministryId_date_label_key`(`ministryId`, `date`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kids_attendance` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `childId` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `checkInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checkInByUserId` VARCHAR(191) NULL,
    `checklist` JSON NOT NULL,
    `note` VARCHAR(191) NULL,
    `checkOutAt` DATETIME(3) NULL,
    `checkOutByUserId` VARCHAR(191) NULL,
    `pickedUpBy` VARCHAR(191) NULL,

    INDEX `kids_attendance_childId_checkInAt_idx`(`childId`, `checkInAt`),
    UNIQUE INDEX `kids_attendance_sessionId_childId_key`(`sessionId`, `childId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kids_room_staff` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `role` ENUM('teacher', 'support') NOT NULL,

    UNIQUE INDEX `kids_room_staff_sessionId_roomId_memberId_key`(`sessionId`, `roomId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kids_messages` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `childId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `direction` ENUM('to_parent', 'to_staff') NOT NULL,
    `kind` ENUM('message', 'alert') NOT NULL DEFAULT 'message',
    `body` TEXT NOT NULL,
    `senderUserId` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kids_messages_childId_createdAt_idx`(`childId`, `createdAt`),
    INDEX `kids_messages_organizationId_direction_readAt_idx`(`organizationId`, `direction`, `readAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `consolidation_cases` ADD CONSTRAINT `consolidation_cases_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consolidation_cases` ADD CONSTRAINT `consolidation_cases_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consolidation_cases` ADD CONSTRAINT `consolidation_cases_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consolidation_cases` ADD CONSTRAINT `consolidation_cases_assignedMemberId_fkey` FOREIGN KEY (`assignedMemberId`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consolidation_contacts` ADD CONSTRAINT `consolidation_contacts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consolidation_contacts` ADD CONSTRAINT `consolidation_contacts_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `consolidation_cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consolidation_contacts` ADD CONSTRAINT `consolidation_contacts_madeByMemberId_fkey` FOREIGN KEY (`madeByMemberId`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_rooms` ADD CONSTRAINT `kids_rooms_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_children` ADD CONSTRAINT `kids_children_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_children` ADD CONSTRAINT `kids_children_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `kids_rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_guardians` ADD CONSTRAINT `kids_guardians_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_guardians` ADD CONSTRAINT `kids_guardians_childId_fkey` FOREIGN KEY (`childId`) REFERENCES `kids_children`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_guardians` ADD CONSTRAINT `kids_guardians_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_sessions` ADD CONSTRAINT `kids_sessions_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_sessions` ADD CONSTRAINT `kids_sessions_ministryId_fkey` FOREIGN KEY (`ministryId`) REFERENCES `ministries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_attendance` ADD CONSTRAINT `kids_attendance_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_attendance` ADD CONSTRAINT `kids_attendance_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `kids_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_attendance` ADD CONSTRAINT `kids_attendance_childId_fkey` FOREIGN KEY (`childId`) REFERENCES `kids_children`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_attendance` ADD CONSTRAINT `kids_attendance_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `kids_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_room_staff` ADD CONSTRAINT `kids_room_staff_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_room_staff` ADD CONSTRAINT `kids_room_staff_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `kids_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_room_staff` ADD CONSTRAINT `kids_room_staff_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `kids_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_room_staff` ADD CONSTRAINT `kids_room_staff_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_messages` ADD CONSTRAINT `kids_messages_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_messages` ADD CONSTRAINT `kids_messages_childId_fkey` FOREIGN KEY (`childId`) REFERENCES `kids_children`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kids_messages` ADD CONSTRAINT `kids_messages_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `kids_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
