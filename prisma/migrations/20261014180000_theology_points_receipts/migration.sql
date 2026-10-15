-- AlterTable
ALTER TABLE `schools` ADD COLUMN `pointsAssignments` INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN `pointsAttendance` INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN `pointsPayments` INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN `pointsToPass` INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE `courses` ADD COLUMN `credential` VARCHAR(120) NULL,
    ADD COLUMN `year` INTEGER NULL;

-- AlterTable
ALTER TABLE `enrollments` ADD COLUMN `points` INTEGER NULL;

-- AlterTable
ALTER TABLE `donations` ADD COLUMN `receiptFolio` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `credentials` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `schoolId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `year` INTEGER NULL,
    `name` VARCHAR(120) NOT NULL,
    `serial` VARCHAR(30) NOT NULL,
    `points` INTEGER NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `credentials_schoolId_memberId_idx`(`schoolId`, `memberId`),
    UNIQUE INDEX `credentials_memberId_courseId_key`(`memberId`, `courseId`),
    UNIQUE INDEX `credentials_organizationId_serial_key`(`organizationId`, `serial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `donations_organizationId_receiptFolio_key` ON `donations`(`organizationId`, `receiptFolio`);

-- AddForeignKey
ALTER TABLE `credentials` ADD CONSTRAINT `credentials_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credentials` ADD CONSTRAINT `credentials_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credentials` ADD CONSTRAINT `credentials_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credentials` ADD CONSTRAINT `credentials_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

