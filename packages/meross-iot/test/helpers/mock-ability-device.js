'use strict';

const EventEmitter = require('events');

/**
 * Shared stubs for unit-testing {@link module:controller/abilities} feature factories
 * without MQTT, HTTP, or {@link MerossDevice}.
 */

const updateToggleState = require('../../lib/controller/abilities/toggle-ability')._updateToggleState;

/**
 * Minimal `EventEmitter` so state updaters can emit `stateChange` during tests.
 *
 * @returns {EventEmitter}
 */
function createDeviceEmitter() {
    return new EventEmitter();
}

/**
 * Returns a `publishMessage` stub that records every call and resolves with a configurable payload.
 *
 * @param {Object} [options]
 * @param {function(string, string, *): *} [options.responseFor] - Return value for each call (sync or async)
 * @returns {{ calls: Array<{ method: string, namespace: string, payload: * }>, publishMessage: Function }}
 */
function createPublishRecorder(options = {}) {
    const { responseFor } = options;
    const calls = [];

    /**
     * @param {string} method
     * @param {string} namespace
     * @param {*} payload
     * @returns {Promise<*>}
     */
    async function publishMessage(method, namespace, payload) {
        calls.push({ method, namespace, payload });
        if (typeof responseFor === 'function') {
            return responseFor(method, namespace, payload, calls.length);
        }
        return {};
    }

    return { calls, publishMessage };
}

/**
 * Binds {@link module:controller/abilities/toggle-ability}'s `_updateToggleState` contract
 * (`(toggleData, source)`) to the module implementation, which expects `(device, toggleData, source)`.
 * Real devices are expected to expose the same shape so the toggle feature can refresh caches.
 *
 * @param {Object} device - Minimal device object (mutated)
 * @returns {void}
 */
function wireToggleStateUpdater(device) {
    if (!device._toggleStateByChannel) {
        device._toggleStateByChannel = new Map();
    }
    device._updateToggleState = (toggleData, source) =>
        updateToggleState(device, toggleData, source);
}

module.exports = {
    createDeviceEmitter,
    createPublishRecorder,
    wireToggleStateUpdater
};
