"use strict";

/**
 * Rutas de disponibilidad para producción
 * src/api/availability/routes/availability.js
 */

module.exports = {
  routes: [
    // Ruta principal para verificar disponibilidad
    {
      method: "GET",
      path: "/availability/check-availability/:excursionId/:date/:quantity",
      handler: "availability.checkAvailability",
      config: {
        auth: false, // Sin autenticación requerida
      },
    },

    // Ruta para obtener disponibilidad de una fecha específica
    {
      method: "GET",
      path: "/availability/:excursionId/:date",
      handler: "availability.getAvailability",
      config: {
        auth: false,
      },
    },

    // Ruta para obtener disponibilidad de un rango de fechas
    {
      method: "GET",
      path: "/availability/range/:excursionId/:startDate/:endDate",
      handler: "availability.getAvailabilityRange",
      config: {
        auth: false,
      },
    },

    // Mantener rutas de test para desarrollo (opcional)
    {
      method: "GET",
      path: "/availability/test/check-availability/:excursionId/:date/:requestedSpots",
      handler: "availability.checkAvailabilityTest",
      config: {
        auth: false,
      },
    },

    {
      method: "GET",
      path: "/availability",
      handler: "availability.getAllAvailabilities",
      config: {
        auth: false, // Sin autenticación requerida
      },
    },
    // Ruta de debug (opcional, para desarrollo)
    {
      method: "GET",
      path: "/availability/debug/:excursionId/:date",
      handler: "availability.debug",
      config: {
        auth: false,
      },
    },
  ],
};
