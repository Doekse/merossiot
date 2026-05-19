'use strict';

/**
 * Lazy-load map for sub-managers to avoid circular requires at module init.
 *
 * @type {Record<string, () => typeof import('./base')>}
 */
const ENABLED_MANAGERS = {
    auth: () => require('./auth'),
    devices: () => require('./devices'),
    mqtt: () => require('./mqtt'),
    http: () => require('./http'),
    transport: () => require('./transport'),
    statistics: () => require('./statistics')
};

/**
 * Optional sub-managers loaded on first access (e.g. subscription polling).
 *
 * @type {Record<string, () => typeof import('./subscription')>}
 */
const OPTIONAL_MANAGERS = {
    subscription: () => require('./subscription')
};

module.exports = { ENABLED_MANAGERS, OPTIONAL_MANAGERS };
