-- Paleta de la marca: azul comunidad con apoyo cian (antes el acento era ámbar).
ALTER TABLE `app_settings` MODIFY `accentHue` INTEGER NOT NULL DEFAULT 215;
UPDATE `app_settings` SET `accentHue` = 215 WHERE `accentHue` = 85;
