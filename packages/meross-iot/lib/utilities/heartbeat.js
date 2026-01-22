'use strict';

const { OnlineStatus } = require('../model/enums');

/**
 * Manages device online/offline detection using multiple strategies.
 *
 * Provides comprehensive connectivity monitoring through periodic heartbeat checks,
 * response tracking, failure counting, and System.All monitoring. Automatically
 * updates device online status when connectivity issues are detected.
 *
 * @class Heartbeat
 */
class Heartbeat {
    /**
     * Creates a new Heartbeat instance.
     *
     * @param {Object} device - MerossDevice instance to monitor
     * @param {Object} [options={}] - Configuration options
     * @param {number} [options.heartbeatInterval=120000] - Heartbeat interval in milliseconds (120 seconds)
     * @param {number} [options.consecutiveFailureThreshold=1] - Number of consecutive failures before marking offline
     * @param {boolean} [options.enabled=true] - Whether heartbeat monitoring is enabled
     */
    constructor(device, options = {}) {
        this.device = device;
        this.heartbeatInterval = options.heartbeatInterval || 120000;
        this.consecutiveFailureThreshold = options.consecutiveFailureThreshold || 1;
        this.enabled = options.enabled !== false;

        this._lastResponseTime = null;
        this._consecutiveFailures = 0;
        this._heartbeatTimer = null;
        this._isRunning = false;
        // Exponential backoff: starts at base delay, doubles when offline, capped at heartbeat interval
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
     * Should be called when device disconnects.
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
     * Updates last response time and resets consecutive failure counter.
     * Resets polling delay to base interval when device comes back online.
     * Called whenever any successful response is received.
     */
    recordResponse() {
        const wasOffline = this.device.onlineStatus === OnlineStatus.OFFLINE;
        this._lastResponseTime = Date.now();
        this._consecutiveFailures = 0;

        if (wasOffline) {
            this._pollingDelay = Math.floor(this.heartbeatInterval / 2);
        }

        this._evaluateStatus();
    }

    /**
     * Records a command failure or timeout.
     *
     * Increments consecutive failure counter and evaluates if device should
     * be marked offline. Called when commands fail or timeout.
     */
    recordFailure() {
        this._consecutiveFailures++;
        this._evaluateStatus();
    }

    /**
     * Records a System.All response.
     *
     * System.All responses indicate device is active and responding.
     * Updates last response time and resets failure counter.
     */
    recordSystemAll() {
        this.recordResponse();
    }

    /**
     * Evaluates device status and updates if necessary.
     *
     * Checks multiple conditions to determine if device should be marked offline:
     * - 1 consecutive failure
     * - No response for > 2x heartbeat interval (240s) when device was online
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
     * Determines if device should be marked offline based on tracking data.
     *
     * @private
     * @returns {boolean} True if device should be marked offline
     */
    _shouldBeOffline() {
        if (this._consecutiveFailures >= this.consecutiveFailureThreshold) {
            return true;
        }

        if (this._lastResponseTime && this.device.onlineStatus === OnlineStatus.ONLINE) {
            const timeSinceLastResponse = Date.now() - this._lastResponseTime;
            const maxSilenceInterval = this.heartbeatInterval * 2;
            if (timeSinceLastResponse > maxSilenceInterval) {
                return true;
            }
        }

        return false;
    }

    /**
     * Schedules the next heartbeat check.
     *
     * Uses exponential backoff delay when device is offline, otherwise uses
     * heartbeat interval. Checks if heartbeat is needed (conditional triggering).
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
     * Only performs heartbeat if device has been silent for >= heartbeat interval
     * (conditional triggering, like meross_lan). On success, the response will be
     * handled by recordResponse() via the normal message handling flow. On failure,
     * records a failure and applies exponential backoff when offline.
     *
     * @private
     */
    async _performHeartbeat() {
        if (!this._isRunning || !this.device.deviceConnected) {
            return;
        }

        // Only perform heartbeat if no response received for >= heartbeat interval
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
            this.recordFailure();

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
