'use strict';

const { OnlineStatus } = require('meross-iot');

/**
 * Test Helper Utilities
 * 
 * Pure utility functions for device discovery and connection management.
 * All functions accept explicit parameters - no globals or environment variables.
 */

/**
 * Waits for devices to be discovered.
 *
 * Returns an array of MerossDevice instances once they are initialized. Uses
 * device UUID (or subdevice ID) for deduplication to avoid returning the same
 * device multiple times.
 *
 * @param {Object} manager - ManagerMeross instance
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Array<MerossDevice>>} Array of device instances
 */
function waitForDevices(manager, timeout = 5000) {
    return new Promise((resolve) => {
        // If devices already exist, return them immediately
        const existingDevices = manager.devices.list();
        if (existingDevices && existingDevices.length > 0) {
            const devices = [];
            const deviceIds = new Set();
            
            for (const device of existingDevices) {
                // Use unique identifier for subdevices (parentUUID:subdeviceId) or UUID for base devices
                const deviceId = device.subdeviceId 
                    ? `${device.uuid}:${device.subdeviceId}` 
                    : device.uuid;
                
                if (!deviceIds.has(deviceId)) {
                    deviceIds.add(deviceId);
                    devices.push(device);
                }
            }
            resolve(devices);
            return;
        }
        
        const devices = [];
        const deviceIds = new Set();
        let timeoutId = null;
        
        const onDeviceInitialized = (deviceId, device) => {
            if (!deviceIds.has(deviceId)) {
                deviceIds.add(deviceId);
                devices.push(device);
            }
        };
        
        manager.on('deviceInitialized', onDeviceInitialized);
        
        timeoutId = setTimeout(() => {
            manager.removeListener('deviceInitialized', onDeviceInitialized);
            resolve(devices);
        }, timeout);
        
        // Periodic check handles cases where deviceInitialized event was missed
        // (e.g., devices initialized before event handler was attached)
        const checkInterval = setInterval(() => {
            const currentDevices = manager.devices.list();
            if (currentDevices && currentDevices.length > 0) {
                clearInterval(checkInterval);
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                manager.removeListener('deviceInitialized', onDeviceInitialized);
                
                for (const device of currentDevices) {
                    const deviceId = device.subdeviceId 
                        ? `${device.uuid}:${device.subdeviceId}` 
                        : device.uuid;
                    
                    if (!deviceIds.has(deviceId)) {
                        deviceIds.add(deviceId);
                        devices.push(device);
                    }
                }
                resolve(devices);
            }
        }, 200);
    });
}

/**
 * Gets device online status
 * @param {Object} device - Device instance
 * @returns {number|null} OnlineStatus value or null if not available
 */
function getDeviceOnlineStatus(device) {
    return device.onlineStatus !== undefined ? device.onlineStatus : null;
}

/**
 * Checks if device has a specific ability
 * @param {Object} device - Device instance
 * @param {string} namespace - Ability namespace
 * @returns {boolean} True if device has the ability
 */
function deviceHasAbility(device, namespace) {
    return !!(device.abilities && device.abilities[namespace]);
}

/**
 * Finds devices by ability namespace
 * @param {Object} manager - ManagerMeross instance
 * @param {string} namespace - Ability namespace (e.g., 'Appliance.Control.ToggleX')
 * @param {number|null} onlineStatus - OnlineStatus filter (optional, null = any status)
 * @param {Array<Object>} deviceFilter - Optional pre-filtered device list (for CLI device selection)
 * @returns {Promise<Array>} Array of devices with the specified ability
 */
async function findDevicesByAbility(manager, namespace, onlineStatus = null, deviceFilter = null) {
    // If device filter is provided, use it instead of discovering devices
    if (deviceFilter && Array.isArray(deviceFilter) && deviceFilter.length > 0) {
        return deviceFilter.filter(device => {
            // Check ability
            if (!deviceHasAbility(device, namespace)) {
                return false;
            }
            // Filter by online status if specified
            if (onlineStatus !== null) {
                const deviceOnlineStatus = getDeviceOnlineStatus(device);
                return deviceOnlineStatus === onlineStatus;
            }
            return true;
        });
    }
    
    // Normal behavior - discover devices
    const devices = await waitForDevices(manager, 2000);
    const filteredDevices = [];
    
    for (const device of devices) {
        // Check if device has the ability
        if (deviceHasAbility(device, namespace)) {
            // Filter by online status if specified
            if (onlineStatus !== null) {
                const deviceOnlineStatus = getDeviceOnlineStatus(device);
                if (deviceOnlineStatus === onlineStatus) {
                    filteredDevices.push(device);
                }
            } else {
                filteredDevices.push(device);
            }
        }
    }
    
    return filteredDevices;
}

/**
 * Finds devices by device type
 * @param {Object} manager - ManagerMeross instance
 * @param {string} deviceType - Device type (e.g., 'mss310', 'msg100')
 * @param {number|null} onlineStatus - OnlineStatus filter (optional, null = any status)
 * @param {Array<Object>} deviceFilter - Optional pre-filtered device list (for CLI device selection)
 * @returns {Promise<Array>} Array of devices with the specified type
 */
async function findDevicesByType(manager, deviceType, onlineStatus = null, deviceFilter = null) {
    // If device filter is provided, use it instead of discovering devices
    if (deviceFilter && Array.isArray(deviceFilter) && deviceFilter.length > 0) {
        return deviceFilter.filter(device => {
            const baseDeviceType = device.deviceType;
            const subdeviceType = device.type || device._type;
            const matchesType = baseDeviceType === deviceType || subdeviceType === deviceType;
            
            if (!matchesType) {
                return false;
            }
            
            // Filter by online status if specified
            if (onlineStatus !== null) {
                const deviceOnlineStatus = getDeviceOnlineStatus(device);
                return deviceOnlineStatus === onlineStatus;
            }
            return true;
        });
    }
    
    // Normal behavior - discover devices
    const devices = await waitForDevices(manager, 2000);
    const filteredDevices = [];
    
    for (const device of devices) {
        // Check both base device type and subdevice type
        const baseDeviceType = device.deviceType;
        const subdeviceType = device.type || device._type;
        const matchesType = baseDeviceType === deviceType || subdeviceType === deviceType;
        
        if (matchesType) {
            // Filter by online status if specified
            if (onlineStatus !== null) {
                const deviceOnlineStatus = getDeviceOnlineStatus(device);
                if (deviceOnlineStatus === onlineStatus) {
                    filteredDevices.push(device);
                }
            } else {
                filteredDevices.push(device);
            }
        }
    }
    
    return filteredDevices;
}

/**
 * Waits for a device to be connected
 * @param {Object} device - Device instance
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<boolean>} True if connected, false if timeout
 */
function waitForDeviceConnection(device, timeout = 10000) {
    return new Promise((resolve) => {
        if (device.deviceConnected) {
            resolve(true);
            return;
        }
        
        const onConnected = () => {
            device.removeListener('connected', onConnected);
            device.removeListener('error', onError);
            clearTimeout(timeoutId);
            resolve(true);
        };
        
        const onError = (error) => {
            device.removeListener('connected', onConnected);
            device.removeListener('error', onError);
            clearTimeout(timeoutId);
            resolve(false);
        };
        
        const timeoutId = setTimeout(() => {
            device.removeListener('connected', onConnected);
            device.removeListener('error', onError);
            resolve(false);
        }, timeout);
        
        device.on('connected', onConnected);
        device.on('error', onError);
    });
}

/**
 * Waits for a push notification on a device
 * @param {Object} device - Device instance
 * @param {string} namespace - Namespace to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Object>} Push notification payload
 */
function waitForPushNotification(device, namespace, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            device.removeListener('data', onData);
            reject(new Error(`Timeout waiting for push notification: ${namespace}`));
        }, timeout);
        
        const onData = (ns, payload) => {
            if (ns === namespace) {
                clearTimeout(timeoutId);
                device.removeListener('data', onData);
                resolve(payload);
            }
        };
        
        device.on('state', onData);
    });
}

/**
 * Gets device display name
 * @param {Object} device - Device instance
 * @returns {string} Device display name
 */
function getDeviceName(device) {
    if (!device) return 'Unknown device';
    return device.name || device.uuid || 'Unknown device';
}

module.exports = {
    // Device discovery
    waitForDevices,
    findDevicesByAbility,
    findDevicesByType,
    
    // Device connection
    waitForDeviceConnection,
    waitForPushNotification,
    
    // Device utilities
    getDeviceName,
    getDeviceOnlineStatus,
    deviceHasAbility,
    
    // Enums
    OnlineStatus
};
