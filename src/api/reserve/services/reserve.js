'use strict';

/**
 * reserve service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::reserve.reserve');
