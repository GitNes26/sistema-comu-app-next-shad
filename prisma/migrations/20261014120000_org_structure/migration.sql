-- AlterTable
ALTER TABLE `members` MODIFY `hierarchy` ENUM('believer', 'disciple', 'servant', 'leader', 'network_leader', 'pastor', 'senior_pastor') NOT NULL DEFAULT 'believer';

-- AlterTable
ALTER TABLE `ministries` ADD COLUMN `category` VARCHAR(10) NOT NULL DEFAULT 'ministry',
    ADD COLUMN `shortName` VARCHAR(20) NULL;

