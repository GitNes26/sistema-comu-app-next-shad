-- Código corto de puerta para cada boleto (se escribe en lugar del QR largo).
ALTER TABLE `event_tickets` ADD COLUMN `shortCode` VARCHAR(8) NULL;

-- Boletos existentes: 6 caracteres derivados de su id (únicos dentro de cada evento en la práctica;
-- si hubiera colisión se reasigna con el sufijo del código largo).
UPDATE `event_tickets` SET `shortCode` = UPPER(SUBSTRING(MD5(`id`), 1, 6)) WHERE `shortCode` IS NULL;
UPDATE `event_tickets` t
JOIN (
  SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `eventId`, `shortCode` ORDER BY `createdAt`, `id`) AS rn
  FROM `event_tickets`
) d ON d.`id` = t.`id`
SET t.`shortCode` = UPPER(SUBSTRING(MD5(CONCAT(t.`id`, t.`code`)), 1, 6))
WHERE d.rn > 1;

CREATE UNIQUE INDEX `event_tickets_eventId_shortCode_key` ON `event_tickets`(`eventId`, `shortCode`);
