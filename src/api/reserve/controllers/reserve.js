// @ts-nocheck
"use strict";

/**
 * reserve controller - Versión optimizada y corregida
 */

const { createCoreController } = require("@strapi/strapi").factories;
// @ts-ignore
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = createCoreController("api::reserve.reserve", ({ strapi }) => ({
  // Método para crear Payment Intent
  async createPaymentIntent(ctx) {
    try {
      const { excursionId, quantityPeople, bookingDate } = ctx.request.body;

      // Validaciones básicas
      if (!excursionId || !quantityPeople || !bookingDate) {
        return ctx.badRequest(
          "Faltan campos requeridos: excursionId, quantityPeople, bookingDate"
        );
      }

      // Validar que quantityPeople sea un número positivo
      if (quantityPeople <= 0 || !Number.isInteger(quantityPeople)) {
        return ctx.badRequest(
          "La cantidad de personas debe ser un número entero positivo"
        );
      }

      // Obtener la excursión
      const excursionRecord = await strapi.db
        .query("api::excursion.excursion")
        .findOne({
          where: { documentId: excursionId },
        });

      if (!excursionRecord) {
        return ctx.badRequest(
          `Excursión con documentId ${excursionId} no encontrada`
        );
      }

      // Verificar disponibilidad
      const availabilityCheck = await strapi
        .service("api::availability.availability-manager")
        .checkAvailability(excursionId, bookingDate, quantityPeople);

      if (!availabilityCheck.available) {
        return ctx.badRequest(
          `No hay suficientes cupos disponibles. Disponibles: ${availabilityCheck.availableSpots}, Solicitados: ${quantityPeople}`
        );
      }

      // Calcular el total
      const totalAmount = excursionRecord.price * quantityPeople;

      // Crear el Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Stripe maneja centavos
        currency: "eur",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          excursionId: excursionId,
          excursionTitle: excursionRecord.title,
          quantityPeople: quantityPeople.toString(),
          bookingDate: bookingDate,
          pricePerPerson: excursionRecord.price.toString(),
          totalAmount: totalAmount.toString(),
        },
      });

      ctx.body = {
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: totalAmount,
          excursion: {
            id: excursionRecord.id,
            documentId: excursionRecord.documentId,
            title: excursionRecord.title,
            price: excursionRecord.price,
          },
        },
      };
    } catch (error) {
      strapi.log.error("Error creando Payment Intent:", error);
      ctx.status = 500;
      ctx.body = {
        error: {
          status: 500,
          name: "PaymentIntentError",
          message: "Error interno del servidor",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        },
      };
    }
  },

  async create(ctx) {
    try {
      // Extraer los datos del objeto 'data' si existe, o usar el body directamente
      const requestData = ctx.request.body.data || ctx.request.body;

      console.log("Datos procesados:", requestData);

      const { excursion: excursionDocumentId, ...otrosData } = requestData;

      console.log("DocumentId extraído:", excursionDocumentId);
      console.log("Tipo de documentId:", typeof excursionDocumentId);

      // Validar que se envió el documentId
      if (!excursionDocumentId || typeof excursionDocumentId !== "string") {
        console.log("Error: DocumentId no válido");
        return ctx.badRequest(
          "Se requiere un documentId válido de la excursión"
        );
      }

      // Buscar la excursión por documentId para obtener su ID numérico
      const excursiones = await strapi.entityService.findMany(
        "api::excursion.excursion",
        {
          filters: { documentId: excursionDocumentId },
          limit: 1,
        }
      );

      console.log("Excursiones encontradas:", excursiones);

      if (!excursiones || excursiones.length === 0) {
        return ctx.badRequest("Excursión no encontrada");
      }

      const excursionId = excursiones[0].id;
      console.log("ID de excursión a usar:", excursionId);

      // Crear la reserva usando el ID numérico
      const reserva = await strapi.entityService.create(
        "api::reserve.reserve",
        {
          data: {
            ...otrosData,
            excursion: excursionId,
          },
          populate: {
            excursion: true,
          },
        }
      );

      return ctx.send(reserva);
    } catch (error) {
      console.error("Error al crear reserva:", error);
      return ctx.internalServerError("Error interno del servidor");
    }
  },

  // También puedes modificar el update si es necesario
  async update(ctx) {
    try {
      const { id } = ctx.params;
      const { excursion: excursionDocumentId, ...otrosData } = ctx.request.body;

      let updateData = { ...otrosData };

      // Si se envía una nueva excursión, resolverla
      if (excursionDocumentId && typeof excursionDocumentId === "string") {
        const excursiones = await strapi.entityService.findMany(
          "api::excursion.excursion",
          {
            filters: { documentId: excursionDocumentId },
            limit: 1,
          }
        );

        if (!excursiones || excursiones.length === 0) {
          return ctx.badRequest("Excursión no encontrada");
        }

        updateData.excursion = excursiones[0].id;
      }

      const reserva = await strapi.entityService.update(
        "api::reserve.reserve",
        id,
        {
          data: updateData,
          populate: {
            excursion: true,
          },
        }
      );

      return ctx.send(reserva);
    } catch (error) {
      console.error("Error al actualizar reserva:", error);
      return ctx.internalServerError("Error interno del servidor");
    }
  },

  // Webhook optimizado para manejar eventos de Stripe
  async stripeWebhook(ctx) {
    const sig = ctx.request.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        ctx.request.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      strapi.log.error("Webhook signature verification failed:", err);
      ctx.status = 400;
      return ctx.badRequest("Webhook signature verification failed");
    }

    try {
      // Manejar el evento
      switch (event.type) {
        case "payment_intent.succeeded":
          const paymentIntent = event.data.object;
          strapi.log.info("PaymentIntent succeeded:", paymentIntent.id);

          // Opcional: Actualizar estado de la reserva si es necesario
          await this.handlePaymentSuccess(paymentIntent);
          break;

        case "payment_intent.payment_failed":
          const failedPayment = event.data.object;
          strapi.log.error("PaymentIntent failed:", failedPayment.id);

          // Opcional: Manejar pago fallido
          await this.handlePaymentFailure(failedPayment);
          break;

        default:
          strapi.log.info("Unhandled event type:", event.type);
      }

      ctx.body = { received: true };
    } catch (error) {
      strapi.log.error("Error processing webhook:", error);
      ctx.status = 500;
      ctx.body = { error: "Internal server error" };
    }
  },

  // Método helper para manejar pagos exitosos
  async handlePaymentSuccess(paymentIntent) {
    // Implementar lógica adicional si es necesario
    // Por ejemplo, enviar emails de confirmación
  },

  // Método helper para manejar pagos fallidos
  async handlePaymentFailure(failedPayment) {
    // Implementar lógica para pagos fallidos
    // Por ejemplo, liberar disponibilidad si se había reservado
  },

  // Método optimizado para obtener disponibilidad
  async getAvailability(ctx) {
    try {
      const { excursionId, startDate, endDate } = ctx.params;

      // Validar fechas
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        return ctx.badRequest(
          "La fecha de inicio debe ser anterior a la fecha de fin"
        );
      }

      // Limitar el rango de fechas para evitar consultas muy grandes
      const daysDifference = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (daysDifference > 365) {
        return ctx.badRequest(
          "El rango de fechas no puede ser superior a 365 días"
        );
      }

      const availabilities = await strapi
        .service("api::availability.availability-manager")
        .getAvailabilityRange(excursionId, startDate, endDate);

      ctx.body = {
        data: availabilities,
        meta: {
          count: availabilities.length,
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
      };
    } catch (error) {
      strapi.log.error("Error obteniendo disponibilidad:", error);
      ctx.status = 500;
      ctx.body = {
        error: {
          status: 500,
          name: "AvailabilityError",
          message: "Error interno del servidor",
        },
      };
    }
  },
}));
