'use strict';

/**
 * System feature module.
 * Provides access to device system information including hardware, firmware, online status, and configuration.
 */
module.exports = {
    /**
     * Gets all system data from the device.
     *
     * Returns comprehensive system information including hardware, firmware, and online status.
     * Automatically extracts and caches MAC address, LAN IP, MQTT host/port, and online status
     * from the response.
     *
     * @returns {Promise<Object>} Response containing all system data
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSystemAllData() {
        const response = await this.publishMessage('GET', 'Appliance.System.All', {});

        if (response && response.all && response.all.system) {
            const { system } = response.all;

            if (system.hardware && system.hardware.macAddress) {
                this.updateMacAddress(system.hardware.macAddress);
            }

            if (system.firmware) {
                const { firmware } = system;
                if (firmware.innerIp) {
                    this._lanIp = firmware.innerIp;
                }
                if (firmware.server) {
                    this._mqttHost = firmware.server;
                }
                if (firmware.port) {
                    this._mqttPort = firmware.port;
                }
                this._lastFullUpdateTimestamp = Date.now();
            }
            if (system.online) {
                const onlineStatus = system.online.status;
                this._updateOnlineStatus(onlineStatus);
            }
        }

        return response;
    },

    /**
     * Gets system debug information from the device.
     *
     * @returns {Promise<Object>} Response containing debug information
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSystemDebug() {
        return await this.publishMessage('GET', 'Appliance.System.Debug', {});
    },

    /**
     * Gets the device abilities (supported namespaces).
     *
     * Automatically updates the internal abilities cache when the response is received.
     *
     * @returns {Promise<Object>} Response containing device abilities
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSystemAbilities() {
        const response = await this.publishMessage('GET', 'Appliance.System.Ability', {});
        if (response && response.ability) {
            this.updateAbilities(response.ability);
        }
        return response;
    },

    /**
     * Gets encryption suite information from the device.
     *
     * @returns {Promise<Object>} Response containing encryption suite info
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getEncryptSuite() {
        return await this.publishMessage('GET', 'Appliance.Encrypt.Suite', {});
    },

    /**
     * Gets ECDHE encryption information from the device.
     *
     * @returns {Promise<Object>} Response containing ECDHE encryption info
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getEncryptECDHE() {
        return await this.publishMessage('GET', 'Appliance.Encrypt.ECDHE', {});
    },

    /**
     * Gets the online status from the device.
     *
     * @returns {Promise<Object>} Response containing online status
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getOnlineStatus() {
        return await this.publishMessage('GET', 'Appliance.System.Online', {});
    },

    /**
     * Gets the WiFi list configuration from the device.
     *
     * Automatically decodes SSIDs from base64 encoding in the response.
     *
     * @returns {Promise<Object>} Response containing WiFi list with decoded SSIDs
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getConfigWifiList() {
        const response = await this.publishMessage('GET', 'Appliance.Config.WifiList', {});

        if (response && response.wifiList) {
            const { decodeSSID } = require('../../utilities/ssid');
            const wifiList = Array.isArray(response.wifiList) ? response.wifiList : [response.wifiList];
            wifiList.forEach(wifi => {
                if (wifi.ssid) {
                    wifi.ssid = decodeSSID(wifi.ssid);
                }
            });
        }

        return response;
    },

    /**
     * Gets trace configuration from the device.
     *
     * Automatically decodes SSID from base64 encoding in the response.
     *
     * @returns {Promise<Object>} Response containing trace config with decoded SSID
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getConfigTrace() {
        const response = await this.publishMessage('GET', 'Appliance.Config.Trace', {});

        if (response && response.trace && response.trace.ssid) {
            const { decodeSSID } = require('../../utilities/ssid');
            response.trace.ssid = decodeSSID(response.trace.ssid);
        }

        return response;
    },

    /**
     * Gets system hardware information from the device.
     *
     * Automatically updates the MAC address cache if available in the response.
     *
     * @returns {Promise<Object>} Response containing hardware information
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSystemHardware() {
        const response = await this.publishMessage('GET', 'Appliance.System.Hardware', {});
        if (response && response.hardware) {
            this._systemHardware = response.hardware;
            if (response.hardware.macAddress) {
                this.updateMacAddress(response.hardware.macAddress);
            }
        }
        return response;
    },

    /**
     * Gets system firmware information from the device.
     *
     * Automatically extracts and caches LAN IP and MQTT connection information if available.
     *
     * @returns {Promise<Object>} Response containing firmware information
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSystemFirmware() {
        const response = await this.publishMessage('GET', 'Appliance.System.Firmware', {});
        if (response && response.firmware) {
            this._systemFirmware = response.firmware;
            if (response.firmware.innerIp) {
                this._lanIp = response.firmware.innerIp;
            }
            if (response.firmware.server) {
                this._mqttHost = response.firmware.server;
            }
            if (response.firmware.port) {
                this._mqttPort = response.firmware.port;
            }
        }
        return response;
    },

    /**
     * Gets system time information from the device.
     *     * @returns {Promise<Object>} Response containing time information
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSystemTime() {
        return await this.publishMessage('GET', 'Appliance.System.Time', {});
    },

    /**
     * Gets system position information from the device.
     *
     * @returns {Promise<Object>} Response containing position information
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSystemPosition() {
        return await this.publishMessage('GET', 'Appliance.System.Position', {});
    },

    /**
     * Gets system factory test information from the device.
     *     * @returns {Promise<Object>} Response containing factory test information
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSystemFactory() {
        return await this.publishMessage('GET', 'Appliance.System.Factory', {});
    },

    /**
     * Gets system LED mode configuration from the device.
     *
     * @returns {Promise<Object>} Response containing LED mode configuration
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getSystemLedMode() {
        return await this.publishMessage('GET', 'Appliance.System.LedMode', {});
    },

    /**
     * Controls the system LED mode configuration.
     *
     * @param {Object} ledModeData - LED mode data object with mode property (0=off, 1=match power, 2=opposite power) *
     * @returns {Promise<Object>} Response from the device
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async setSystemLedMode(ledModeData) {
        const payload = { LedMode: ledModeData };
        return await this.publishMessage('SET', 'Appliance.System.LedMode', payload);
    },

    /**
     * Gets MCU firmware information from the device.
     *
     * @returns {Promise<Object>} Response containing MCU firmware information
     * @throws {import('../lib/errors/errors').UnconnectedError} If device is not connected
     * @throws {import('../lib/errors/errors').CommandTimeoutError} If command times out
     */
    async getMcuFirmware() {
        return await this.publishMessage('GET', 'Appliance.Mcu.Firmware', {});
    }
};

