-- CreateTable
CREATE TABLE `course_documents` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `kind` ENUM('pdf', 'image', 'docx') NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `pageCount` INTEGER NOT NULL DEFAULT 1,
    `pagesHtml` LONGTEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `course_documents_courseId_sortOrder_idx`(`courseId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_sections` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `week` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fromPage` INTEGER NOT NULL,
    `toPage` INTEGER NOT NULL,

    INDEX `document_sections_documentId_week_idx`(`documentId`, `week`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_annotations` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `page` INTEGER NOT NULL,
    `kind` ENUM('highlight', 'text', 'note') NOT NULL,
    `color` VARCHAR(9) NOT NULL DEFAULT '#facc15',
    `rects` JSON NOT NULL,
    `text` TEXT NULL,
    `quote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_annotations_documentId_memberId_page_idx`(`documentId`, `memberId`, `page`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `diplomas` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `schoolId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `serial` VARCHAR(191) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `eventId` VARCHAR(191) NULL,
    `issuedByUserId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,

    UNIQUE INDEX `diplomas_organizationId_serial_key`(`organizationId`, `serial`),
    UNIQUE INDEX `diplomas_schoolId_memberId_key`(`schoolId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `course_documents` ADD CONSTRAINT `course_documents_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_documents` ADD CONSTRAINT `course_documents_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_sections` ADD CONSTRAINT `document_sections_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_sections` ADD CONSTRAINT `document_sections_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `course_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_annotations` ADD CONSTRAINT `document_annotations_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_annotations` ADD CONSTRAINT `document_annotations_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `course_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_annotations` ADD CONSTRAINT `document_annotations_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `diplomas` ADD CONSTRAINT `diplomas_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `diplomas` ADD CONSTRAINT `diplomas_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `diplomas` ADD CONSTRAINT `diplomas_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `diplomas` ADD CONSTRAINT `diplomas_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
