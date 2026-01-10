'use strict';

/**
 * Manages per-device request queues with batch processing and inter-batch delays.
 *
 * Meross devices enforce rate limits on API requests. This class throttles requests
 * per device by processing them in configurable batches with delays between batches,
 * preventing rate limit violations while maintaining reasonable throughput. Each device
 * has an isolated queue to ensure fair resource allocation.
 *
 * @module utilities/request-queue
 */
class RequestQueue {
    /**
     * Creates a new RequestQueue instance.
     *
     * @param {Object} options - Configuration options
     * @param {number} [options.batchSize=3] - Maximum concurrent requests per device per batch.
     *     Higher values increase throughput but risk hitting rate limits.
     * @param {number} [options.batchDelay=100] - Delay in milliseconds between batches.
     *     Prevents overwhelming devices with rapid successive batches.
     * @param {Function} [options.logger] - Optional logger function for debugging
     */
    constructor(options = {}) {
        this.batchSize = options.batchSize || 3;
        this.batchDelay = options.batchDelay || 100;
        this.logger = options.logger;

        this._queues = new Map();
        this._processing = new Map();
    }

    /**
     * Enqueues a request for asynchronous processing.
     *
     * Adds a request to the device's queue and returns a promise that resolves when
     * the request completes. The queue handles throttling and ordering automatically,
     * allowing callers to await results without managing rate limits directly.
     *
     * @param {string} deviceUuid - Device UUID
     * @param {Function} requestFn - Function that returns a Promise
     * @returns {Promise} Promise that resolves when the request completes
     */
    enqueue(deviceUuid, requestFn) {
        return new Promise((resolve, reject) => {
            const queueEntry = {
                requestFn,
                resolve,
                reject
            };

            if (!this._queues.has(deviceUuid)) {
                this._queues.set(deviceUuid, []);
            }
            const queue = this._queues.get(deviceUuid);
            queue.push(queueEntry);

            if (!this._processing.get(deviceUuid)) {
                this._processQueue(deviceUuid);
            }
        });
    }

    /**
     * Processes queued requests for a device in batches with delays.
     *
     * Uses a processing flag to prevent concurrent execution, ensuring only one
     * batch processor runs per device at a time. This prevents race conditions
     * and ensures requests are processed in order.
     *
     * @private
     * @param {string} deviceUuid - Device UUID
     */
    async _processQueue(deviceUuid) {
        this._processing.set(deviceUuid, true);

        try {
            const queue = this._queues.get(deviceUuid);
            if (!queue || queue.length === 0) {
                return;
            }

            while (queue.length > 0) {
                const batch = queue.splice(0, this.batchSize);

                await this._processBatch(deviceUuid, batch);

                if (queue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.batchDelay));
                }
            }
        } finally {
            this._processing.set(deviceUuid, false);

            const queue = this._queues.get(deviceUuid);
            if (!queue || queue.length === 0) {
                this._queues.delete(deviceUuid);
            }
        }
    }

    /**
     * Executes a batch of requests concurrently and forwards results to callers.
     *
     * Each request's promise is resolved or rejected individually, allowing partial
     * success within a batch without affecting other requests. This ensures that
     * one failed request doesn't prevent others in the same batch from completing.
     *
     * @private
     * @param {string} deviceUuid - Device UUID
     * @param {Array} batch - Array of queue entries
     */
    async _processBatch(deviceUuid, batch) {
        const promises = batch.map(entry => {
            return Promise.resolve(entry.requestFn())
                .then(result => {
                    entry.resolve(result);
                    return { success: true, result };
                })
                .catch(error => {
                    entry.reject(error);
                    return { success: false, error };
                });
        });

        await Promise.all(promises);
    }

    /**
     * Clears all pending requests for a device and rejects their promises.
     *
     * Useful when a device disconnects or needs to be reset, preventing
     * stale requests from executing after the device is no longer available.
     *
     * @param {string} deviceUuid - Device UUID
     */
    clearQueue(deviceUuid) {
        const queue = this._queues.get(deviceUuid);
        if (queue) {
            queue.forEach(entry => {
                entry.reject(new Error(`Queue cleared for device ${deviceUuid}`));
            });
            this._queues.delete(deviceUuid);
        }
        this._processing.delete(deviceUuid);
    }

    /**
     * Returns the number of pending requests for a device.
     *
     * @param {string} deviceUuid - Device UUID
     * @returns {number} Number of queued requests, or 0 if no queue exists
     */
    getQueueLength(deviceUuid) {
        const queue = this._queues.get(deviceUuid);
        return queue ? queue.length : 0;
    }
}

module.exports = RequestQueue;

