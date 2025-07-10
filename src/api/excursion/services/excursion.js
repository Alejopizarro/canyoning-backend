'use strict';

/**
 * excursion service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::excursion.excursion');
