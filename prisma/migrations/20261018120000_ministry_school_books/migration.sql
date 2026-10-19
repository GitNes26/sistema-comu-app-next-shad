-- Los cuatro libros de la Escuela de Ministerio (somoscomunidad.mx), idempotente:
--   1. ¿Quién es Jesús?   2. Entrando en su presencia
--   3. Fundamentos para la vida cristiana   4. Extendiendo el fuego

-- La escuela, si la iglesia aún no la tiene.
INSERT INTO `schools` (`id`, `organizationId`, `kind`, `name`, `description`, `updatedAt`)
SELECT UUID(), o.`id`, 'ministry', 'Escuela de Ministerio', 'El proceso para formar líderes, libro por libro.', NOW(3)
FROM `organizations` o
WHERE NOT EXISTS (SELECT 1 FROM `schools` s WHERE s.`organizationId` = o.`id` AND s.`kind` = 'ministry');

-- Los libros de ejemplo del demo pasan a llamarse como los reales (solo si el nombre real no existe).
UPDATE `courses` c
JOIN `schools` s ON s.`id` = c.`schoolId` AND s.`kind` = 'ministry'
SET c.`name` = 'Entrando en su presencia', c.`sortOrder` = 2
WHERE c.`name` = 'Identidad en Cristo'
  AND NOT EXISTS (SELECT 1 FROM (SELECT `schoolId`, `name` FROM `courses`) x WHERE x.`schoolId` = c.`schoolId` AND x.`name` = 'Entrando en su presencia');

UPDATE `courses` c
JOIN `schools` s ON s.`id` = c.`schoolId` AND s.`kind` = 'ministry'
SET c.`name` = 'Fundamentos para la vida cristiana', c.`sortOrder` = 3
WHERE c.`name` = 'Vida en el Espíritu'
  AND NOT EXISTS (SELECT 1 FROM (SELECT `schoolId`, `name` FROM `courses`) x WHERE x.`schoolId` = c.`schoolId` AND x.`name` = 'Fundamentos para la vida cristiana');

UPDATE `courses` c
JOIN `schools` s ON s.`id` = c.`schoolId` AND s.`kind` = 'ministry'
SET c.`name` = 'Extendiendo el fuego', c.`sortOrder` = 4
WHERE c.`name` = 'Llamado y servicio'
  AND NOT EXISTS (SELECT 1 FROM (SELECT `schoolId`, `name` FROM `courses`) x WHERE x.`schoolId` = c.`schoolId` AND x.`name` = 'Extendiendo el fuego');

-- Los libros que falten.
INSERT INTO `courses` (`id`, `organizationId`, `schoolId`, `name`, `description`, `sortOrder`)
SELECT UUID(), s.`organizationId`, s.`id`, b.`name`, b.`description`, b.`sortOrder`
FROM `schools` s
JOIN (
  SELECT 1 AS `sortOrder`, '¿Quién es Jesús?' AS `name`, 'El primer paso: conocer a Jesús y lo que hizo por nosotros.' AS `description`
  UNION ALL SELECT 2, 'Entrando en su presencia', 'Aprende a acercarte a Dios en la adoración y la oración.'
  UNION ALL SELECT 3, 'Fundamentos para la vida cristiana', 'Los cimientos de la fe: la Palabra, la comunidad y el carácter.'
  UNION ALL SELECT 4, 'Extendiendo el fuego', 'Prepárate para servir y compartir lo que Dios hizo en ti.'
) b
WHERE s.`kind` = 'ministry'
  AND NOT EXISTS (SELECT 1 FROM `courses` c WHERE c.`schoolId` = s.`id` AND c.`name` COLLATE utf8mb4_unicode_ci = b.`name` COLLATE utf8mb4_unicode_ci);

-- Orden y descripción de los libros que ya existían sin ellos.
UPDATE `courses` c
JOIN `schools` s ON s.`id` = c.`schoolId` AND s.`kind` = 'ministry'
SET c.`sortOrder` = CASE c.`name`
    WHEN '¿Quién es Jesús?' THEN 1
    WHEN 'Entrando en su presencia' THEN 2
    WHEN 'Fundamentos para la vida cristiana' THEN 3
    WHEN 'Extendiendo el fuego' THEN 4
    ELSE c.`sortOrder` END,
  c.`description` = COALESCE(c.`description`, CASE c.`name`
    WHEN '¿Quién es Jesús?' THEN 'El primer paso: conocer a Jesús y lo que hizo por nosotros.'
    WHEN 'Entrando en su presencia' THEN 'Aprende a acercarte a Dios en la adoración y la oración.'
    WHEN 'Fundamentos para la vida cristiana' THEN 'Los cimientos de la fe: la Palabra, la comunidad y el carácter.'
    WHEN 'Extendiendo el fuego' THEN 'Prepárate para servir y compartir lo que Dios hizo en ti.'
    ELSE NULL END)
WHERE c.`name` IN ('¿Quién es Jesús?', 'Entrando en su presencia', 'Fundamentos para la vida cristiana', 'Extendiendo el fuego');
