-- Itinerario: cada actividad puede ser pública o solo para organizadores y servidores.
ALTER TABLE `event_itinerary` ADD COLUMN `isPublic` BOOLEAN NOT NULL DEFAULT true;
