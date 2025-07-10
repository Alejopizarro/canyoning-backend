"use strict";

const { createCoreRouter } = require("@strapi/strapi").factories;

const defaultRouter = createCoreRouter("api::reserve.reserve");

const customRouter = (innerRouter, extraRoutes = []) => {
  let routes;
  return {
    get prefix() {
      return innerRouter.prefix;
    },
    get routes() {
      if (!routes) routes = innerRouter.routes.concat(extraRoutes);
      return routes;
    },
  };
};

// Rutas personalizadas organizadas por funcionalidad
const myExtraRoutes = [
  // Rutas de pagos
  {
    method: "POST",
    path: "/reserves/create-payment-intent",
    handler: "reserve.createPaymentIntent",
    config: {
      auth: false,
      policies: [],
      middlewares: [],
    },
  },
  {
    method: "POST",
    path: "/reserves/stripe-webhook",
    handler: "reserve.stripeWebhook",
    config: {
      auth: false,
      policies: [],
      middlewares: [],
    },
  },

  // Rutas de disponibilidad
  {
    method: "GET",
    path: "/reserves/availability/:excursionId/:startDate/:endDate",
    handler: "reserve.getAvailability",
    config: {
      auth: false,
      policies: [],
      middlewares: [],
    },
  },
];

module.exports = customRouter(defaultRouter, myExtraRoutes);
