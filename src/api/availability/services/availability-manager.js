"use strict";

/**
 * Servicio para gestionar la disponibilidad de excursiones
 */

module.exports = ({ strapi }) => ({
  /**
   * Obtiene o crea la disponibilidad para una excursión en una fecha específica
   * @param {string} excursionDocumentId - DocumentId de la excursión
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @returns {Promise<Object>} Registro de disponibilidad
   */
  async getOrCreateAvailability(excursionDocumentId, date) {
    try {
      // Primero obtenemos la excursión usando documentId para obtener su ID numérico
      const excursion = await strapi.db
        .query("api::excursion.excursion")
        .findOne({
          where: { documentId: excursionDocumentId },
        });

      if (!excursion) {
        throw new Error(
          `Excursión con documentId ${excursionDocumentId} no encontrada`
        );
      }

      // Buscar disponibilidad existente usando el ID numérico
      let availability = await strapi.db
        .query("api::availability.availability")
        .findOne({
          where: {
            excursion: excursion.id, // Usar ID numérico
            date: date,
          },
          populate: ["excursion"],
        });

      // Si no existe, lo creamos con la capacidad máxima de la excursión
      if (!availability) {
        // Creamos el registro de disponibilidad usando el ID numérico
        availability = await strapi.db
          .query("api::availability.availability")
          .create({
            data: {
              excursion: excursion.id, // ID numérico para la relación
              date: date,
              availableSpots: excursion.quantityPeople,
              isActive: true,
            },
            populate: ["excursion"],
          });
      }

      return availability;
    } catch (error) {
      strapi.log.error("Error en getOrCreateAvailability:", error);
      throw error;
    }
  },

  /**
   * Verifica si hay cupos disponibles para una reserva
   * @param {string} excursionDocumentId - DocumentId de la excursión
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @param {number} requestedSpots - Número de cupos solicitados
   * @returns {Promise<Promise<Object>>} { available: boolean, availableSpots: number }
   */
  async checkAvailability(excursionDocumentId, date, requestedSpots) {
    try {
      const availability = await this.getOrCreateAvailability(
        excursionDocumentId,
        date
      );

      return {
        available:
          availability.isActive &&
          availability.availableSpots >= requestedSpots,
        availableSpots: availability.availableSpots,
        isActive: availability.isActive,
      };
    } catch (error) {
      strapi.log.error("Error en checkAvailability:", error);
      throw error;
    }
  },

  /**
   * Reduce la disponibilidad cuando se hace una reserva
   * @param {string} excursionDocumentId - DocumentId de la excursión
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @param {number} reservedSpots - Número de cupos reservados
   * @returns {Promise<Object>} Registro actualizado de disponibilidad
   */
  async reduceAvailability(excursionDocumentId, date, reservedSpots) {
    try {
      const availability = await this.getOrCreateAvailability(
        excursionDocumentId,
        date
      );

      // Verificar que hay cupos suficientes
      if (availability.availableSpots < reservedSpots) {
        throw new Error(
          `No hay suficientes cupos disponibles. Disponibles: ${availability.availableSpots}, Solicitados: ${reservedSpots}`
        );
      }

      // Actualizar la disponibilidad
      const updatedAvailability = await strapi.db
        .query("api::availability.availability")
        .update({
          where: { id: availability.id },
          data: {
            availableSpots: availability.availableSpots - reservedSpots,
          },
          populate: ["excursion"],
        });

      return updatedAvailability;
    } catch (error) {
      strapi.log.error("Error en reduceAvailability:", error);
      throw error;
    }
  },

  /**
   * Restaura la disponibilidad cuando se cancela una reserva
   * @param {string} excursionDocumentId - DocumentId de la excursión
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @param {number} releasedSpots - Número de cupos liberados
   * @returns {Promise<Object>} Registro actualizado de disponibilidad
   */
  async restoreAvailability(excursionDocumentId, date, releasedSpots) {
    try {
      const availability = await this.getOrCreateAvailability(
        excursionDocumentId,
        date
      );

      // Obtener la capacidad máxima de la excursión para no excederla
      const excursion = await strapi.db
        .query("api::excursion.excursion")
        .findOne({
          where: { documentId: excursionDocumentId },
        });

      const newAvailableSpots = Math.min(
        availability.availableSpots + releasedSpots,
        excursion.quantityPeople
      );

      // Actualizar la disponibilidad
      const updatedAvailability = await strapi.db
        .query("api::availability.availability")
        .update({
          where: { id: availability.id },
          data: {
            availableSpots: newAvailableSpots,
          },
          populate: ["excursion"],
        });

      return updatedAvailability;
    } catch (error) {
      strapi.log.error("Error en restoreAvailability:", error);
      throw error;
    }
  },

  /**
   * Obtiene la disponibilidad para múltiples fechas de una excursión
   * @param {string} excursionDocumentId - DocumentId de la excursión
   * @param {string} startDate - Fecha inicial en formato YYYY-MM-DD
   * @param {string} endDate - Fecha final en formato YYYY-MM-DD
   * @returns {Promise<any[]>} Array de registros de disponibilidad
   */
  async getAvailabilityRange(excursionDocumentId, startDate, endDate) {
    try {
      // Primero obtenemos el ID numérico de la excursión
      const excursion = await strapi.db
        .query("api::excursion.excursion")
        .findOne({
          where: { documentId: excursionDocumentId },
        });

      if (!excursion) {
        throw new Error(
          `Excursión con documentId ${excursionDocumentId} no encontrada`
        );
      }

      const availabilities = await strapi.db
        .query("api::availability.availability")
        .findMany({
          where: {
            excursion: excursion.id,
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
          populate: ["excursion"],
          orderBy: [{ date: "asc" }],
        });

      return availabilities;
    } catch (error) {
      strapi.log.error("Error en getAvailabilityRange:", error);
      throw error;
    }
  },

  /**
   * Desactiva la disponibilidad para una fecha específica (ej: feriados)
   * @param {string} excursionDocumentId - DocumentId de la excursión
   * @param {string} date - Fecha en formato YYYY-MM-DD
   * @returns {Promise<Object>} Registro actualizado de disponibilidad
   */
  async deactivateDate(excursionDocumentId, date) {
    try {
      const availability = await this.getOrCreateAvailability(
        excursionDocumentId,
        date
      );

      const updatedAvailability = await strapi.db
        .query("api::availability.availability")
        .update({
          where: { id: availability.id },
          data: {
            isActive: false,
            availableSpots: 0,
          },
          populate: ["excursion"],
        });

      return updatedAvailability;
    } catch (error) {
      strapi.log.error("Error en deactivateDate:", error);
      throw error;
    }
  },
});
