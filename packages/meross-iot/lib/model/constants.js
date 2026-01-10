'use strict';

/**
 * Secret key for Meross API request signing.
 *
 * Used by the Meross API protocol to sign authentication requests. This value
 * is required by the API and changing it will break communication.
 *
 * @constant {string}
 * @private
 */
const SECRET = '23x17ahWarFH6w29';

/**
 * Meross HTTP API domain.
 *
 * Base domain for cloud API endpoints. Used for authentication and device
 * management operations that require HTTP requests rather than MQTT.
 *
 * @constant {string}
 */
const MEROSS_DOMAIN = 'iotx.meross.com';

/**
 * Meross MQTT broker domain for EU region.
 *
 * Separate from the HTTP API domain to support real-time bidirectional
 * communication with devices. MQTT is used for device commands and state
 * updates, while HTTP is used for account management and device enumeration.
 *
 * @constant {string}
 */
const MEROSS_MQTT_DOMAIN = 'eu-iotx.meross.com';

/**
 * Authentication endpoint path.
 *
 * Used to obtain access tokens required for subsequent API calls. Tokens
 * authenticate the client session and must be included in all API requests.
 *
 * @constant {string}
 */
const LOGIN_URL = '/v1/Auth/signIn';

/**
 * Logout endpoint path.
 *
 * Used to invalidate the current session's authentication token on the server,
 * preventing further API access with the same token.
 *
 * @constant {string}
 */
const LOGOUT_URL = '/v1/Profile/logout';

/**
 * Device enumeration endpoint path.
 *
 * Used to retrieve all devices associated with the authenticated account.
 * Returns device metadata including UUIDs, names, and capabilities needed
 * for device initialization.
 *
 * @constant {string}
 */
const DEV_LIST = '/v1/Device/devList';

/**
 * Subdevice enumeration endpoint path.
 *
 * Used to retrieve subdevices (sensors, valves, etc.) connected to hub devices.
 * Subdevices are not returned by the standard device list endpoint because they
 * are managed through their parent hub device rather than directly.
 *
 * @constant {string}
 */
const SUBDEV_LIST = '/v1/Hub/getSubDevices';

/**
 * User activity logging endpoint path.
 *
 * Used to log client information to Meross servers for analytics and telemetry.
 * Called automatically after successful login to provide usage statistics.
 *
 * @constant {string}
 */
const LOG_URL = '/v1/log/user';

/**
 * Default MQTT broker hostname.
 *
 * Used as fallback when device-specific domain information is not available
 * from the device enumeration response.
 *
 * @constant {string}
 */
const DEFAULT_MQTT_HOST = 'mqtt.meross.com';

/**
 * Default MQTT broker port.
 *
 * Used as fallback when device-specific port information is not available
 * from the device enumeration response.
 *
 * @constant {number}
 */
const DEFAULT_MQTT_PORT = 443;

module.exports = {
    SECRET,
    MEROSS_DOMAIN,
    MEROSS_MQTT_DOMAIN,
    LOGIN_URL,
    LOGOUT_URL,
    LOG_URL,
    DEV_LIST,
    SUBDEV_LIST,
    DEFAULT_MQTT_HOST,
    DEFAULT_MQTT_PORT
};

