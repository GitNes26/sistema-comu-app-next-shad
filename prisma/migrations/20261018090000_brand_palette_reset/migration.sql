-- Una sola iglesia: toda la apariencia parte de la paleta de la marca (azul comunidad + cian).
ALTER TABLE `app_settings` MODIFY `primaryHue` INTEGER NOT NULL DEFAULT 245;
UPDATE `app_settings` SET `primaryHue` = 245, `accentHue` = 215;
