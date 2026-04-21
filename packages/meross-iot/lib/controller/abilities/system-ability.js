'use strict';

const { registerNamespaceDescriptor } = require('../state-dispatcher');

/**
 * Creates a system feature object for a device.
 *
 * Provides access to device system information including hardware, firmware, online status, and configuration.
 *
 * @param {Object} device - The device instance
 * @returns {Object} System feature object with various getter methods
 */
function createSystemAbility(device) {
    return {
        /**
         * Gets all system data from the device.
         *
         * @returns {Promise<Object>} Response containing all system data
         */
        async getAllData() {
            const { header: systemAllHeader, payload: response } = await device.publishMessage(
                'GET',
                'Appliance.System.All',
                {}
            );

            if (response && response.all) {
                this.handleSystemAllUpdate(response, systemAllHeader);
            }

            return response;
        },

        /**
         * Handles System.All update responses.
         *
         * Extracts device metadata (abilities, MAC address), network configuration (LAN IP,
         * MQTT host/port), hardware and firmware versions, and routes digest data to feature modules.
         * Called automatically when System.All responses are received.
         *
         * @param {Object} payload - Message payload containing System.All data
         * @param {Object} [allHeader] - Response header (timestamps for digest ordering)
         * @returns {boolean} True if any properties were updated
         */
        handleSystemAllUpdate(payload, allHeader) {
            if (payload.ability) {
                device._updateAbilities(payload.ability);
            }

            const system = payload.all?.system;
            if (!system) {
                return false;
            }

            const hardwareUpdates = this._updateHardwareProperties(system.hardware);
            const firmwareUpdates = this._updateFirmwareProperties(system.firmware);

            if (system.online) {
                device._updateOnlineStatus(system.online.status);
            }

            if (payload.all.digest) {
                device._routeDigestToFeatures(payload.all.digest, allHeader);
            }

            return hardwareUpdates || firmwareUpdates;
        },

        /**
         * Updates hardware properties from hardware data.
         *
         * @private
         * @param {Object} hardware - Hardware data object
         * @returns {boolean} True if any properties were updated
         */
        _updateHardwareProperties(hardware) {
            if (!hardware) {
                return false;
            }

            const updates = [
                { source: 'type', target: 'deviceType' },
                { source: 'subType', target: 'subType' },
                { source: 'version', target: 'hardwareVersion' },
                { source: 'chipType', target: 'chipType' }
            ];

            let hasUpdates = false;
            for (const { source, target } of updates) {
                if (hardware[source] !== undefined && hardware[source] !== device[target]) {
                    hasUpdates = true;
                    device[target] = hardware[source];
                }
            }

            if (hardware.macAddress && hardware.macAddress !== device.macAddress) {
                hasUpdates = true;
                device.updateMacAddress(hardware.macAddress);
            }

            return hasUpdates;
        },

        /**
         * Updates firmware properties from firmware data.
         *
         * @private
         * @param {Object} firmware - Firmware data object
         * @returns {boolean} True if any properties were updated
         */
        _updateFirmwareProperties(firmware) {
            if (!firmware) {
                return false;
            }

            const updates = [
                { source: 'version', target: 'firmwareVersion' },
                { source: 'homekitVersion', target: 'homekitVersion' },
                { source: 'compileTime', target: 'firmwareCompileTime' },
                { source: 'encrypt', target: 'wifiEncrypt' },
                { source: 'wifiMac', target: 'wifiMac' },
                { source: 'innerIp', target: 'lanIp' },
                { source: 'server', target: 'mqttHost' },
                { source: 'port', target: 'mqttPort' },
                { source: 'userId', target: 'userId' }
            ];

            let hasUpdates = false;
            for (const { source, target } of updates) {
                if (firmware[source] !== undefined && firmware[source] !== device[target]) {
                    hasUpdates = true;
                    device[target] = firmware[source];
                }
            }

            device.lastFullUpdateTimestamp = Date.now();
            return hasUpdates;
        },

        /**
         * Gets system debug information from the device.
         *
         * @returns {Promise<Object>} Response containing debug information
         */
        async getDebug() {
            const { payload: response } = await device.publishMessage('GET', 'Appliance.System.Debug', {});
            if (response && response.debug) {
                device._systemDebug = response.debug;
                if (response.debug.network) {
                    this._updateNetworkProperties(response.debug.network);
                }
            }
            return response;
        },

        /**
         * Updates network properties from network data.
         *
         * @private
         * @param {Object} network - Network data object
         * @returns {boolean} True if any properties were updated
         */
        _updateNetworkProperties(network) {
            const updates = [
                { source: 'rssi', target: 'rssi' },
                { source: 'signal', target: 'wifiSignal' },
                { source: 'ssid', target: 'wifiSsid' },
                { source: 'channel', target: 'wifiChannel' },
                { source: 'snr', target: 'wifiSnr' },
                { source: 'linkStatus', target: 'wifiLinkStatus' },
                { source: 'gatewayMac', target: 'wifiGatewayMac' },
                { source: 'wifiDisconnectCount', target: 'wifiDisconnectCount' }
            ];

            let hasUpdates = false;
            for (const { source, target } of updates) {
                if (network[source] !== undefined && network[source] !== device[target]) {
                    hasUpdates = true;
                    device[target] = network[source];
                }
            }

            // Network innerIp overrides firmware innerIp when present
            if (network.innerIp && network.innerIp !== device.lanIp) {
                hasUpdates = true;
                device.lanIp = network.innerIp;
            }

            // Store wifiDisconnectDetail object if present
            if (network.wifiDisconnectDetail && network.wifiDisconnectDetail !== device.wifiDisconnectDetail) {
                hasUpdates = true;
                device.wifiDisconnectDetail = network.wifiDisconnectDetail;
            }

            return hasUpdates;
        },

        /**
         * Gets the device abilities (supported namespaces).
         *
         * @returns {Promise<Object>} Response containing device abilities
         */
        async getAbilities() {
            const { payload: response } = await device.publishMessage('GET', 'Appliance.System.Ability', {});
            if (response && response.ability) {
                device._updateAbilities(response.ability);
            }
            return response;
        },

        /**
         * Gets encryption suite information from the device.
         *
         * @returns {Promise<Object>} Response containing encryption suite info
         */
        async getEncryptSuite() {
            const { payload } = await device.publishMessage('GET', 'Appliance.Encrypt.Suite', {});
            return payload;
        },

        /**
         * Gets ECDHE encryption information from the device.
         *
         * @returns {Promise<Object>} Response containing ECDHE encryption info
         */
        async getEncryptECDHE() {
            const { payload } = await device.publishMessage('GET', 'Appliance.Encrypt.ECDHE', {});
            return payload;
        },

        /**
         * Gets the online status from the device.
         *
         * @returns {Promise<Object>} Response containing online status
         */
        async getOnlineStatus() {
            const { payload } = await device.publishMessage('GET', 'Appliance.System.Online', {});
            return payload;
        },

        /**
         * Gets the WiFi list configuration from the device.
         *
         * @returns {Promise<Object>} Response containing WiFi list with decoded SSIDs
         */
        async getConfigWifiList() {
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Config.WifiList', {});

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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.Config.Trace', {});

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
            const { payload: response } = await device.publishMessage('GET', 'Appliance.System.Hardware', {});
            if (response && response.hardware) {
                device._systemHardware = response.hardware;
                this._updateHardwareProperties(response.hardware);
            }
            return response;
        },

        /**
         * Gets system firmware information from the device.
         *
         * @returns {Promise<Object>} Response containing firmware information
         */
        async getFirmware() {
            const { payload: response } = await device.publishMessage('GET', 'Appliance.System.Firmware', {});
            if (response && response.firmware) {
                device._systemFirmware = response.firmware;
                this._updateFirmwareProperties(response.firmware);
            }
            return response;
        },

        /**
         * Gets system time information from the device.
         *
         * @returns {Promise<Object>} Response containing time information
         */
        async getTime() {
            const { payload } = await device.publishMessage('GET', 'Appliance.System.Time', {});
            return payload;
        },

        /**
         * Gets system position information from the device.
         *
         * @returns {Promise<Object>} Response containing position information
         */
        async getPosition() {
            const { payload } = await device.publishMessage('GET', 'Appliance.System.Position', {});
            return payload;
        },

        /**
         * Gets system factory test information from the device.
         *
         * @returns {Promise<Object>} Response containing factory test information
         */
        async getFactory() {
            const { payload } = await device.publishMessage('GET', 'Appliance.System.Factory', {});
            return payload;
        },

        /**
         * Gets system LED mode configuration from the device.
         *
         * @returns {Promise<Object>} Response containing LED mode configuration
         */
        async getLedMode() {
            const { payload } = await device.publishMessage('GET', 'Appliance.System.LedMode', {});
            return payload;
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
            const { payload: out } = await device.publishMessage('SET', 'Appliance.System.LedMode', payload);
            return out;
        },

        /**
         * Gets MCU firmware information from the device.
         *
         * @returns {Promise<Object>} Response containing MCU firmware information
         */
        async getMcuFirmware() {
            const { payload } = await device.publishMessage('GET', 'Appliance.Mcu.Firmware', {});
            return payload;
        }
    };
}

/**
 * Appliance.System.Online carries a single scalar status with no channel, so it uses a
 * whole-payload `customApply` with one gate key. The heartbeat bypasses this path on
 * purpose: heartbeat-driven offline transitions are local and must not be rejected by
 * the ordering gate.
 */
registerNamespaceDescriptor('Appliance.System.Online', {
    namespace: 'Appliance.System.Online',
    gateKey: 'Appliance.System.Online',
    customApply: (device, payload) => {
        const status = payload?.online?.status;
        if (status === undefined || status === null) {
            return;
        }
        device._updateOnlineStatus(status);
    }
});

module.exports = createSystemAbility;
