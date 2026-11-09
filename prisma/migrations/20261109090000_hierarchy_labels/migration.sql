-- Jerarquía editable: nombre, descripción y visibilidad de cada nivel, por iglesia.
ALTER TABLE `app_settings` ADD COLUMN `hierarchyLabels` JSON NULL;
