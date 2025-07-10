"use strict";

/**
 * availability controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::availability.availability",
  ({ strapi }) => ({
    // Método principal para verificar disponibilidad
    async checkAvailability(ctx) {
      try {
        const { excursionId, date, quantity } = ctx.params;

        // Validaciones
        if (!excursionId || !date || !quantity) {
          return ctx.badRequest(
            "Faltan parámetros requeridos: excursionId, date, quantity"
          );
        }

        const quantityNumber = parseInt(quantity);
        if (isNaN(quantityNumber) || quantityNumber <= 0) {
          return ctx.badRequest("La cantidad debe ser un número positivo");
        }

        // Verificar disponibilidad usando el servicio
        const availability = await strapi
          .service("api::availability.availability-manager")
          .checkAvailability(excursionId, date, quantityNumber);

        ctx.body = {
          data: availability,
          meta: {
            excursionId,
            date,
            requestedQuantity: quantityNumber,
          },
        };
      } catch (error) {
        strapi.log.error("Error verificando disponibilidad:", error);
        ctx.status = 400;
        ctx.body = {
          error: {
            status: 400,
            name: "AvailabilityCheckError",
            message: error.message,
          },
        };
      }
    },

    // Método para obtener todas las disponibilidades (opcional)
    async getAllAvailabilities(ctx) {
      try {
        const availabilities = await strapi.db
          .query("api::availability.availability")
          .findMany({
            populate: ["excursion"],
          });
        ctx.body = {
          data: availabilities,
          meta: {
            count: availabilities.length,
          },
        };
      } catch (error) {
        strapi.log.error("Error obteniendo todas las disponibilidades:", error);
        ctx.status = 400;
        ctx.body = {
          error: {
            status: 400,
            name: "GetAllAvailabilitiesError",
            message: error.message,
          },
        };
      }
    },

    // Obtener disponibilidad para una fecha específica
    async getAvailability(ctx) {
      try {
        const { excursionId, date } = ctx.params;

        if (!excursionId || !date) {
          return ctx.badRequest(
            "Faltan parámetros requeridos: excursionId, date"
          );
        }

        // Usar el servicio para obtener/crear disponibilidad
        const availability = await strapi
          .service("api::availability.availability-manager")
          .getOrCreateAvailability(excursionId, date);

        ctx.body = {
          data: availability,
          meta: {
            excursionId,
            date,
          },
        };
      } catch (error) {
        strapi.log.error("Error obteniendo disponibilidad:", error);
        ctx.status = 400;
        ctx.body = {
          error: {
            status: 400,
            name: "AvailabilityError",
            message: error.message,
          },
        };
      }
    },

    // Obtener disponibilidad para un rango de fechas
    async getAvailabilityRange(ctx) {
      try {
        const { excursionId, startDate, endDate } = ctx.params;

        if (!excursionId || !startDate || !endDate) {
          return ctx.badRequest(
            "Faltan parámetros requeridos: excursionId, startDate, endDate"
          );
        }

        const availabilities = await strapi
          .service("api::availability.availability-manager")
          .getAvailabilityRange(excursionId, startDate, endDate);

        ctx.body = {
          data: availabilities,
          meta: {
            excursionId,
            dateRange: {
              start: startDate,
              end: endDate,
            },
            count: availabilities.length,
          },
        };
      } catch (error) {
        strapi.log.error("Error obteniendo rango de disponibilidad:", error);
        ctx.status = 400;
        ctx.body = {
          error: {
            status: 400,
            name: "AvailabilityRangeError",
            message: error.message,
          },
        };
      }
    },

    // Mantener método de test (puedes eliminarlo después)
    async checkAvailabilityTest(ctx) {
      try {
        const { excursionId, date, requestedSpots } = ctx.params;

        const result = await strapi
          .service("api::availability.availability-manager")
          .checkAvailability(excursionId, date, parseInt(requestedSpots));

        ctx.body = {
          success: true,
          data: result,
        };
      } catch (error) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: error.message,
        };
      }
    },

    // Método de debug (opcional, para desarrollo)
    async debug(ctx) {
      try {
        const { excursionId, date } = ctx.params;

        // Verificar si la excursión existe usando documentId
        const excursion = await strapi.db
          .query("api::excursion.excursion")
          .findOne({
            where: { documentId: excursionId },
          });

        // Si encontramos la excursión, buscar disponibilidad con su ID numérico
        let availability = null;
        if (excursion) {
          availability = await strapi.db
            .query("api::availability.availability")
            .findOne({
              where: {
                excursion: excursion.id,
                date: date,
              },
              populate: ["excursion"],
            });
        }

        ctx.body = {
          success: true,
          debug: {
            excursionDocumentId: excursionId,
            date: date,
            excursionExists: !!excursion,
            excursion: excursion,
            availabilityExists: !!availability,
            availability: availability,
          },
        };
      } catch (error) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: error.message,
          stack: error.stack,
        };
      }
    },
  })
);
