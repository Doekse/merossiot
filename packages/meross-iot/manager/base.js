'use strict';

/**
 * Base class for Meross sub-managers.
 *
 * Sub-managers receive the root instance so they coordinate through public Meross
 * APIs instead of reaching into private root fields.
 */
class Manager {
    /**
     * @param {import('../lib/meross')} meross - Root Meross instance
     */
    constructor(meross) {
        this.meross = meross;
    }
}

module.exports = Manager;
