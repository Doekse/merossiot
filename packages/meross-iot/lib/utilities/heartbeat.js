'use strict';

const { OnlineStatus } = require('../model/enums');

/**
 * Manages device online/offline detection using time-based silence detection.
 *
 * Tracks the last response time from the device and marks it offline when no
 * response is received for the configured timeout period. Uses time-based detection
 * rather than failure counting to avoid false offline states from transient network
 * issues or temporary HTTP unavailability when MQTT is still functional.
 *
 * @class Heartbeat
 */
class Heartbeat {
    /**
     * Creates a new Heartbeat instance.
     *
     * @param {Object} device - MerossDevice instance to monitor
     * @param {Object} [options={}] - Configuration options
     * @param {number} [options.heartbeatInterval=295000] - Heartbeat interval in milliseconds (295 seconds)
     * @param {boolean} [options.enabled=true] - Whether heartbeat monitoring is enabled
     */
    constructor(device, options = {}) {
        this.device = device;
        this.heartbeatInterval = options.heartbeatInterval || 295000;
        this.enabled = options.enabled !== false;

        this._lastResponseTime = null;
        this._heartbeatTimer = null;
        this._isRunning = false;
        // Start with shorter delay to quickly detect when device comes back online
        this._pollingDelay = Math.floor(this.heartbeatInterval / 2);
    }

    /**
     * Starts heartbeat monitoring.
     *
     * Begins periodic heartbeat checks if enabled and device is connected.
     * Should be called when device connects.
     */
    start() {
        if (!this.enabled || this._isRunning) {
            return;
        }

        this._isRunning = true;
        this._scheduleHeartbeat();
    }

    /**
     * Stops heartbeat monitoring and cleans up timers.
     *
     * Prevents memory leaks by clearing scheduled timers when device disconnects.
     */
    stop() {
        this._isRunning = false;
        if (this._heartbeatTimer) {
            clearTimeout(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    /**
     * Records a successful response from the device.
     *
     * Updates the last response timestamp to reset the silence timer. Resets polling
     * delay when device transitions from offline to online to quickly detect if it
     * goes offline again.
     */
    recordResponse() {
        const wasOffline = this.device.onlineStatus === OnlineStatus.OFFLINE;
        this._lastResponseTime = Date.now();

        if (wasOffline) {
            this._pollingDelay = Math.floor(this.heartbeatInterval / 2);
        }

        this._evaluateStatus();
    }

    /**
     * Records a System.All response.
     *
     * System.All responses are comprehensive state updates that confirm device
     * connectivity, so they reset the silence timer.
     */
    recordSystemAll() {
        this.recordResponse();
    }

    /**
     * Evaluates device status and updates if necessary.
     *
     * Only marks devices offline that are currently online to avoid redundant
     * status updates and ensure we don't mark already-offline devices offline again.
     *
     * @private
     */
    _evaluateStatus() {
        if (!this.enabled || !this.device.deviceConnected) {
            return;
        }

        const currentStatus = this.device.onlineStatus;
        const shouldBeOffline = this._shouldBeOffline();

        if (shouldBeOffline && currentStatus === OnlineStatus.ONLINE) {
            this.device._updateOnlineStatus(OnlineStatus.OFFLINE);
        }
    }

    /**
     * Determines if device should be marked offline based on silence timeout.
     *
     * Requires device to be currently online to avoid marking already-offline devices.
     * Requires at least one previous response to have a baseline for silence detection.
     *
     * @private
     * @returns {boolean} True if device should be marked offline
     */
    _shouldBeOffline() {
        if (this._lastResponseTime && this.device.onlineStatus === OnlineStatus.ONLINE) {
            const timeSinceLastResponse = Date.now() - this._lastResponseTime;
            if (timeSinceLastResponse >= this.heartbeatInterval) {
                return true;
            }
        }

        return false;
    }

    /**
     * Schedules the next heartbeat check.
     *
     * Uses shorter polling delay when offline to quickly detect when device comes
     * back online. Uses standard heartbeat interval when online to avoid unnecessary
     * network traffic when device is actively responding.
     *
     * @private
     */
    _scheduleHeartbeat() {
        if (!this._isRunning || !this.device.deviceConnected) {
            return;
        }

        const delay = this.device.onlineStatus === OnlineStatus.OFFLINE
            ? this._pollingDelay
            : this.heartbeatInterval;

        this._heartbeatTimer = setTimeout(() => {
            this._performHeartbeat();
        }, delay);
    }

    /**
     * Performs a heartbeat check by querying System.Online.
     *
     * Skips heartbeat if device responded recently to avoid redundant requests when
     * device is actively communicating. On failure, increases polling delay when
     * already offline to reduce network load while waiting for device recovery.
     *
     * @private
     */
    async _performHeartbeat() {
        if (!this._isRunning || !this.device.deviceConnected) {
            return;
        }

        if (this._lastResponseTime) {
            const timeSinceLastResponse = Date.now() - this._lastResponseTime;
            if (timeSinceLastResponse < this.heartbeatInterval) {
                this._scheduleHeartbeat();
                return;
            }
        }

        try {
            await this.device.system.getOnlineStatus();
        } catch (error) {
            // Single heartbeat failure doesn't mark device offline; only extended
            // silence triggers offline detection to handle transient network issues
            if (this.device.onlineStatus === OnlineStatus.OFFLINE) {
                this._pollingDelay = Math.min(
                    this._pollingDelay * 2,
                    this.heartbeatInterval
                );
            }
        } finally {
            this._scheduleHeartbeat();
        }
    }
}

module.exports = Heartbeat;
