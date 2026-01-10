'use strict';

const { EventEmitter } = require('events');

/**
 * Async message queue for bridging synchronous MQTT callbacks with async code.
 *
 * Allows MQTT message callbacks (which are synchronous) to enqueue messages
 * that can be awaited by async code. Similar to Python's MixedQueue pattern.
 */
class MessageQueue extends EventEmitter {
    constructor() {
        super();
        this._queue = [];
        this._waiting = [];
    }

    /**
     * Synchronously put an item into the queue.
     * If there are waiters, immediately resolve the first one.
     *
     * @param {*} item - Item to enqueue
     */
    syncPut(item) {
        if (this._waiting.length > 0) {
            const resolve = this._waiting.shift();
            resolve(item);
        } else {
            this._queue.push(item);
        }
    }

    /**
     * Asynchronously get an item from the queue.
     * If queue is empty, wait until an item is available.
     *
     * @returns {Promise<*>} Promise that resolves with the next item
     */
    async asyncGet() {
        if (this._queue.length > 0) {
            return this._queue.shift();
        }

        return new Promise((resolve) => {
            this._waiting.push(resolve);
        });
    }

    /**
     * Get the current queue length
     * @returns {number} Number of items in queue
     */
    get length() {
        return this._queue.length;
    }

    /**
     * Clear all items from the queue
     */
    clear() {
        this._queue = [];
    }
}

module.exports = MessageQueue;
