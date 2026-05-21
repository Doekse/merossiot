'use strict';

/**
 * Device and subdevice construction. Ability wiring is handled by {@link MerossDevice#_updateAbilities}
 * via the `ABILITIES` registry in `device.js`.
 *
 * @module device/factory
 * @private
 */

const { MerossDevice } = require('./device');
const { MerossHubDevice } = require('./hubdevice');

/**
 * Namespace that identifies hub devices.
 *
 * Used to distinguish hub devices from regular devices during device creation,
 * since hubs require a different base class and constructor signature.
 *
 * @private
 */
const HUB_DISCRIMINATING_ABILITY = 'Appliance.Hub.SubdeviceList';

/**
 * Builds a device instance from device info and abilities.
 *
 * Selects {@link MerossHubDevice} or {@link MerossDevice} from the hub discriminating
 * ability, then wires abilities through `_updateAbilities` when an ability map is provided.
 *
 * @param {Object} deviceInfo - Device info from HTTP API (contains deviceType, hdwareVersion, fmwareVersion, etc.)
 * @param {Object} abilities - Device abilities dictionary from `Appliance.System.Ability` namespace
 * @param {import('../meross')} meross - Root Meross instance
 * @param {Array<Object>} [subDeviceList] - Optional list of subdevices for hub devices
 * @returns {MerossDevice|MerossHubDevice} Device instance with appropriate features applied
 */
function buildDevice(deviceInfo, abilities, meross, subDeviceList) {
    const isHub = abilities && typeof abilities === 'object' &&
        HUB_DISCRIMINATING_ABILITY in abilities;
    const Cls = isHub ? MerossHubDevice : MerossDevice;
    const device = isHub
        ? new Cls(meross, deviceInfo, subDeviceList)
        : new Cls(meross, deviceInfo);
    if (abilities) {
        device._updateAbilities(abilities);
    }
    return device;
}

const { SUBDEVICE_ABILITY_MAPPING } = require('./device');

/**
 * Creates a subdevice instance from subdevice information.
 *
 * Instantiates a {@link MerossSubDevice} for the given hub subdevice record. Type-specific
 * behaviour is wired through abilities after {@link MerossSubDevice#_updateAbilities}.
 *
 * @param {Object|ApiSubdeviceInfo} subdeviceInfo - Subdevice info from Meross cloud API (contains subDeviceType/type, id, etc.) or ApiSubdeviceInfo instance
 * @param {string} hubUuid - UUID of the hub device that owns this subdevice
 * @param {Object} hubAbilities - Hub's abilities dictionary (currently unused, reserved for future use)
 * @param {import('../meross')} meross - Root Meross instance
 * @returns {MerossSubDevice} Subdevice instance
 */
function buildSubdevice(subdeviceInfo, hubUuid, hubAbilities, meross) {
    const ApiSubdeviceInfo = require('../api/subdevice');
    const { MerossSubDevice } = require('./subdevice');

    const apiSubdeviceInfo = subdeviceInfo instanceof ApiSubdeviceInfo
        ? subdeviceInfo
        : ApiSubdeviceInfo.fromDict(subdeviceInfo);

    const subdeviceId = apiSubdeviceInfo.subDeviceId;
    const subdeviceType = apiSubdeviceInfo.subDeviceType || '';

    const kwargs = {
        subDeviceType: apiSubdeviceInfo.subDeviceType,
        subDeviceName: apiSubdeviceInfo.subDeviceName
    };

    if (!subdeviceType) {
        const logger = meross?.options?.logger || console.warn;
        logger('Subdevice missing type; using generic MerossSubDevice');
    }

    return new MerossSubDevice(hubUuid, subdeviceId, meross, kwargs);
}

/**
 * Filters hub abilities to only those relevant for a specific subdevice type.
 *
 * Hubs expose abilities for all their subdevices, but each subdevice should only
 * access namespaces it supports. This filtering prevents subdevices from attempting
 * to use unsupported APIs and reduces the ability surface exposed to each subdevice.
 *
 * @param {string} subdeviceType - Subdevice type (e.g., 'ms130', 'ma151', 'mts100v3')
 * @param {Object} hubAbilities - Hub's full abilities dictionary from `Appliance.System.Ability`
 * @returns {Object} Filtered abilities object containing only namespaces relevant to the subdevice type
 */
function getSubdeviceAbilities(subdeviceType, hubAbilities) {
    if (!hubAbilities || typeof hubAbilities !== 'object') {
        return {};
    }

    const normalizedType = (subdeviceType || '').toLowerCase();
    const relevantNamespaces = SUBDEVICE_ABILITY_MAPPING[normalizedType];

    if (!relevantNamespaces) {
        return {};
    }

    const subdeviceAbilities = {};
    for (const namespace of relevantNamespaces) {
        if (hubAbilities[namespace]) {
            subdeviceAbilities[namespace] = hubAbilities[namespace];
        }
    }

    return subdeviceAbilities;
}

module.exports = {
    buildDevice,
    HUB_DISCRIMINATING_ABILITY,
    SUBDEVICE_ABILITY_MAPPING,
    buildSubdevice,
    getSubdeviceAbilities
};
