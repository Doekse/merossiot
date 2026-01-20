'use strict';

/**
 * Creates a system feature object for a device.
 *
 * Provides access to device system information including hardware, firmware, online status, and configuration.
 *
 * @param {Object} device - The device instance
 * @returns {Object} System feature object with various getter methods
 */
function createSystemFeature(device) {
    return {
        /**
         * Gets all system data from the device.
         *
         * @returns {Promise<Object>} Response containing all system data
         */
        async getAllData() {
            const response = await device.publishMessage('GET', 'Appliance.System.All', {});

            if (response && response.all) {
                device._handleSystemAllUpdate(response);
            }

            return response;
        },

        /**
         * Gets system debug information from the device.
         *
         * @returns {Promise<Object>} Response containing debug information
         */
        async getDebug() {
            return await device.publishMessage('GET', 'Appliance.System.Debug', {});
        },

        /**
         * Gets the device abilities (supported namespaces).
         *
         * @returns {Promise<Object>} Response containing device abilities
         */
        async getAbilities() {
            const response = await device.publishMessage('GET', 'Appliance.System.Ability', {});
            if (response && response.ability) {
                device.updateAbilities(response.ability);
            }
            return response;
        },

        /**
         * Gets encryption suite information from the device.
         *
         * @returns {Promise<Object>} Response containing encryption suite info
         */
        async getEncryptSuite() {
            return await device.publishMessage('GET', 'Appliance.Encrypt.Suite', {});
        },

        /**
         * Gets ECDHE encryption information from the device.
         *
         * @returns {Promise<Object>} Response containing ECDHE encryption info
         */
        async getEncryptECDHE() {
            return await device.publishMessage('GET', 'Appliance.Encrypt.ECDHE', {});
        },

        /**
         * Gets the online status from the device.
         *
         * @returns {Promise<Object>} Response containing online status
         */
        async getOnlineStatus() {
            return await device.publishMessage('GET', 'Appliance.System.Online', {});
        },

        /**
         * Gets the WiFi list configuration from the device.
         *
         * @returns {Promise<Object>} Response containing WiFi list with decoded SSIDs
         */
        async getConfigWifiList() {
            const response = await device.publishMessage('GET', 'Appliance.Config.WifiList', {});

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
         * @returns {Promise<Object>} Response containing trace config with decoded SSID
         */
        async getConfigTrace() {
            const response = await device.publishMessage('GET', 'Appliance.Config.Trace', {});

            if (response && response.trace && response.trace.ssid) {
                const { decodeSSID } = require('../../utilities/ssid');
                response.trace.ssid = decodeSSID(response.trace.ssid);
            }

            return response;
        },

        /**
         * Gets system hardware information from the device.
         *
         * @returns {Promise<Object>} Response containing hardware information
         */
        async getHardware() {
            const response = await device.publishMessage('GET', 'Appliance.System.Hardware', {});
            if (response && response.hardware) {
                device._systemHardware = response.hardware;
                if (response.hardware.macAddress) {
                    device.updateMacAddress(response.hardware.macAddress);
                }
            }
            return response;
        },

        /**
         * Gets system firmware information from the device.
         *
         * @returns {Promise<Object>} Response containing firmware information
         */
        async getFirmware() {
            const response = await device.publishMessage('GET', 'Appliance.System.Firmware', {});
            if (response && response.firmware) {
                device._systemFirmware = response.firmware;
                if (response.firmware.innerIp) {
                    device.lanIp = response.firmware.innerIp;
                }
                if (response.firmware.server) {
                    device.mqttHost = response.firmware.server;
                }
                if (response.firmware.port) {
                    device.mqttPort = response.firmware.port;
                }
            }
            return response;
        },

        /**
         * Gets system time information from the device.
         *
         * @returns {Promise<Object>} Response containing time information
         */
        async getTime() {
            return await device.publishMessage('GET', 'Appliance.System.Time', {});
        },

        /**
         * Gets system position information from the device.
         *
         * @returns {Promise<Object>} Response containing position information
         */
        async getPosition() {
            return await device.publishMessage('GET', 'Appliance.System.Position', {});
        },

        /**
         * Gets system factory test information from the device.
         *
         * @returns {Promise<Object>} Response containing factory test information
         */
        async getFactory() {
            return await device.publishMessage('GET', 'Appliance.System.Factory', {});
        },

        /**
         * Gets system LED mode configuration from the device.
         *
         * @returns {Promise<Object>} Response containing LED mode configuration
         */
        async getLedMode() {
            return await device.publishMessage('GET', 'Appliance.System.LedMode', {});
        },

        /**
         * Controls the system LED mode configuration.
         *
         * @param {Object} options - LED mode options
         * @param {Object} options.ledModeData - LED mode data object with mode property
         * @returns {Promise<Object>} Response from the device
         */
        async setLedMode(options) {
            const { ledModeData } = options;
            const payload = { LedMode: ledModeData };
            return await device.publishMessage('SET', 'Appliance.System.LedMode', payload);
        },

        /**
         * Gets MCU firmware information from the device.
         *
         * @returns {Promise<Object>} Response containing MCU firmware information
         */
        async getMcuFirmware() {
            return await device.publishMessage('GET', 'Appliance.Mcu.Firmware', {});
        }
    };
}

module.exports = createSystemFeature;
