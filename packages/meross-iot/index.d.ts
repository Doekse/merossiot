declare module 'meross-iot' {
    import { EventEmitter } from 'events'

    /**
     * Logger function type for debug output.
     * 
     * @param message - The log message
     * @param args - Additional arguments to log
     * 
     * @example
     * ```typescript
     * const logger: Logger = (msg, ...args) => console.log(`[Meross] ${msg}`, ...args);
     * ```
     */
    export type Logger = (message: string, ...args: any[]) => void

    /**
     * Channel data structure from device definitions.
     * 
     * Represents channel information parsed from device initialization data.
     * Devices can have multiple channels (e.g., master channel at index 0, sub-channels at 1-n).
     */
    export interface ChannelData {
        /** Channel index. 0 is master channel, 1-n are sub-channels. */
        channel?: number
        deviceName?: string
        /** Non-zero if this is the master channel. */
        master?: number
        [key: string]: any
    }

    /**
     * Device definition structure from the Meross API.
     * 
     * Contains all device metadata returned from the HTTP API when fetching device lists.
     * This is the raw device information used to initialize MerossDevice instances.
     * 
     * @example
     * ```typescript
     * const devices = await httpClient.getDevices();
     * const deviceDef = devices[0]; // DeviceDefinition
     * ```
     */
    export interface DeviceDefinition {
        uuid: string
        /** Online status: 0=connecting, 1=online, 2=offline, -1=unknown, 3=upgrading */
        onlineStatus: number
        devName: string
        devIconId: string
        /** Unix timestamp when device was bound to account */
        bindTime: number
        deviceType: string
        subType: string
        channels: ChannelData[]
        region: string
        fmwareVersion: string
        hdwareVersion: string
        userDevIcon: string
        iconType: number
        skillNumber: string
        domain: string
        reservedDomain: string
    }

    /**
     * Subdevice information structure with hub context.
     * 
     * Contains subdevice metadata returned from discoverSubdevices() with additional
     * hub context information for device selection UIs.
     * 
     * @example
     * ```typescript
     * const smokeAlarms = await manager.devices.discoverSubdevices({ subdeviceType: 'ma151' });
     * const alarm = smokeAlarms[0]; // SubdeviceInfo
     * console.log(`Smoke alarm: ${alarm.subdeviceName} on hub ${alarm.hubName}`);
     * ```
     */
    export interface SubdeviceInfo {
        hubUuid: string
        hubName: string
        hubDeviceType: string
        subdeviceId: string
        subdeviceType: string
        subdeviceName: string
        subdeviceIconId?: string
        subdeviceSubType?: string
        subdeviceVendor?: string
        trueId?: string
        /** Unix timestamp when subdevice was bound */
        bindTime?: number
        iconType?: number
        /** Additional properties from HTTP API */
        [key: string]: any
    }

    /**
     * Channel metadata for a device.
     * 
     * Encapsulates channel information parsed from device initialization data.
     * Devices can have multiple channels (e.g., master channel at index 0, sub-channels at 1-n),
     * each representing a separate control point or feature.
     * 
     * @example
     * ```typescript
     * const channels = device.channels;
     * channels.forEach(channel => {
     *   console.log(`Channel ${channel.index}: ${channel.name} (USB: ${channel.isUsb})`);
     * });
     * ```
     */
    export class ChannelInfo {
        /** Channel index. 0 is master channel, 1-n are sub-channels. */
        readonly index: number
        readonly name: string | null
        readonly isUsb: boolean
        readonly isMasterChannel: boolean
        
        /**
         * Creates a new ChannelInfo instance.
         * 
         * @param index - Channel index (0 for master channel, 1-n for sub-channels)
         * @param name - Channel name (defaults to 'Main channel' for index 0)
         * @param channelType - Channel type (e.g., 'USB')
         * @param isMasterChannel - Whether this is the master channel
         */
        constructor(index: number, name?: string | null, channelType?: string | null, isMasterChannel?: boolean)
    }

    /**
     * HTTP API device information.
     * 
     * Represents device information retrieved from the Meross HTTP API.
     * This class normalizes device data from the API and provides convenient accessors.
     * Instances are created using the static `fromDict` factory method.
     * 
     * @example
     * ```typescript
     * const devices = await httpClient.getDevices();
     * const deviceInfo = HttpDeviceInfo.fromDict(devices[0]);
     * const mqttHost = deviceInfo.getMqttHost();
     * ```
     */
    export class HttpDeviceInfo {
        readonly uuid: string
        readonly devName: string
        readonly deviceType: string
        readonly channels: ChannelData[]
        readonly fmwareVersion: string
        readonly hdwareVersion: string
        readonly domain: string
        readonly reservedDomain: string | null
        readonly subType: string | null
        readonly bindTime: Date | null
        readonly skillNumber: string | null
        readonly userDevIcon: string | null
        readonly iconType: number | null
        readonly region: string | null
        /** Device icon ID or null */
        readonly devIconId: string | null
        /** Online status (0=connecting, 1=online, 2=offline, -1=unknown, 3=upgrading) */
        readonly onlineStatus: number
        
        /**
         * Creates an HttpDeviceInfo instance from a dictionary object.
         * 
         * Accepts camelCase API response format directly (no normalization needed).
         * This is the only way to create instances.
         * 
         * @param jsonDict - Dictionary object from the API response with camelCase keys
         * @returns New HttpDeviceInfo instance
         */
        static fromDict(jsonDict: { [key: string]: any }): HttpDeviceInfo
        
        /** @private */
        private constructor()
        
        /**
         * Converts the instance to a plain object dictionary with camelCase keys.
         * 
         * @returns Plain object with camelCase keys
         */
        toDict(): {
            uuid: string
            devName: string
            deviceType: string
            channels: ChannelData[]
            fmwareVersion: string
            hdwareVersion: string
            domain: string
            reservedDomain: string | null
            subType: string | null
            bindTime: Date | null
            skillNumber: string | null
            userDevIcon: string | null
            iconType: number | null
            region: string | null
            devIconId: string | null
            onlineStatus: number
        }
        
        /**
         * Gets the MQTT host for this device.
         * 
         * @returns MQTT broker hostname
         */
        getMqttHost(): string
        
        /**
         * Gets the MQTT port for this device.
         * 
         * @returns MQTT broker port number
         */
        getMqttPort(): number
    }

    export class HttpSubdeviceInfo {
        readonly subDeviceId: string | null
        readonly trueId: string | null
        readonly subDeviceType: string | null
        readonly subDeviceVendor: string | null
        readonly subDeviceName: string | null
        readonly subDeviceIconId: string | null
        /**
         * Creates an HttpSubdeviceInfo instance from a dictionary object.
         * Accepts camelCase API response format. Generic keys ('id', 'type', 'name') are supported
         * as fallbacks for API variations and are normalized to camelCase properties.
         * This is the only way to create instances.
         */
        static fromDict(jsonDict: { [key: string]: any }): HttpSubdeviceInfo
        private constructor()
        /**
         * Converts the instance to a plain object dictionary with camelCase keys.
         */
        toDict(): {
            subDeviceId: string | null
            trueId: string | null
            subDeviceType: string | null
            subDeviceVendor: string | null
            subDeviceName: string | null
            subDeviceIconId: string | null
        }
        toString(): string
        toJSON(): string
    }

    export class HardwareInfo {
        readonly version: string | null
        readonly uuid: string | null
        readonly type: string | null
        readonly subType: string | null
        readonly macAddress: string | null
        readonly chipType: string | null
        /**
         * Creates a HardwareInfo instance from a dictionary object.
         * Accepts camelCase API response format directly (no normalization needed).
         * This is the only way to create instances.
         */
        static fromDict(jsonDict: { [key: string]: any }): HardwareInfo | null
        private constructor()
        /**
         * Converts the instance to a plain object dictionary with camelCase keys.
         */
        toDict(): {
            version: string | null
            uuid: string | null
            type: string | null
            subType: string | null
            macAddress: string | null
            chipType: string | null
        }
    }

    export class FirmwareInfo {
        readonly wifiMac: string | null
        readonly version: string | null
        readonly userId: string | null
        readonly server: string | null
        readonly port: number | null
        readonly innerIp: string | null
        readonly compileTime: string | null
        /**
         * Creates a FirmwareInfo instance from a dictionary object.
         * Accepts camelCase API response format directly (no normalization needed).
         * This is the only way to create instances.
         */
        static fromDict(jsonDict: { [key: string]: any }): FirmwareInfo | null
        private constructor()
        /**
         * Converts the instance to a plain object dictionary with camelCase keys.
         */
        toDict(): {
            wifiMac: string | null
            version: string | null
            userId: string | null
            server: string | null
            port: number | null
            innerIp: string | null
            compileTime: string | null
        }
    }

    export class TimeInfo {
        readonly timezone: string | null
        readonly timestamp: number | null
        readonly timeRule: string | null
        /**
         * Creates a TimeInfo instance from a dictionary object.
         * Accepts camelCase API response format directly (no normalization needed).
         * This is the only way to create instances.
         */
        static fromDict(jsonDict: { [key: string]: any }): TimeInfo | null
        private constructor()
        /**
         * Converts the instance to a plain object dictionary with camelCase keys.
         */
        toDict(): {
            timezone: string | null
            timestamp: number | null
            timeRule: string | null
        }
    }

    export interface GetControlPowerConsumptionXResponse {
        consumptionx: {
            date: string
            /**
             * timestamp, utc.
             * has to be multiplied by 1000 to use on new Date(time)
             */
            time: number
            value: number
        }[]
    }
    export interface GetControlElectricityResponse {
        electricity: {
            channel: number
            /**
             * current in decimilliAmp. Has to get divided by 10000 to get Amp(s)
             */
            current: number
            /**
             * voltage in deciVolt. Has to get divided by 10 to get Volt(s)
             */
            voltage: number
            /**
             * power in milliWatt. Has to get divided by 1000 to get Watt(s)
             */
            power: number
            config: {
                voltageRatio: number
                electricityRatio: number
            }
        }
    }

    /**
     * Authentication token data.
     * 
     * Contains all information needed to authenticate with the Meross API.
     * Can be saved and reused with MerossHttpClient.fromCredentials().
     * 
     * @example
     * ```typescript
     * const tokenData = manager.getTokenData();
     * // Save tokenData for later use
     * const httpClient = MerossHttpClient.fromCredentials({
     *   token: tokenData.token,
     *   key: tokenData.key,
     *   userId: tokenData.userId,
     *   domain: tokenData.domain,
     *   mqttDomain: tokenData.mqttDomain
     * });
     * ```
     */
    export interface TokenData {
        /** Authentication token */
        token: string;
        /** Encryption key */
        key: string;
        /** User ID */
        userId: string;
        /** Hash value */
        hash: string;
        /** API domain */
        domain: string;
        /** MQTT domain */
        mqttDomain: string;
        /** Token issue timestamp (optional) */
        issuedOn?: string;
    }

    /**
     * Transport mode for device communication.
     * 
     * Determines how the library communicates with Meross devices. Each mode
     * uses different protocols and network paths, affecting latency, reliability,
     * and whether remote access is required.
     */
    export enum TransportMode {
        /** MQTT-only communication through Meross cloud broker */
        MQTT_ONLY = 0,
        /** LAN HTTP with MQTT fallback - attempts direct HTTP first, falls back to MQTT */
        LAN_HTTP_FIRST = 1,
        /** LAN HTTP for reads only, MQTT for writes - uses LAN for GET requests, MQTT for SET */
        LAN_HTTP_FIRST_ONLY_GET = 2
    }

    export const OnlineStatus: {
        NOT_ONLINE: 0;
        ONLINE: 1;
        OFFLINE: 2;
        UNKNOWN: -1;
        UPGRADING: 3;
    }

    export const DNDMode: {
        DND_DISABLED: 0;
        DND_ENABLED: 1;
    }

    export const PresenceState: {
        ABSENCE: 1;
        PRESENCE: 2;
    }

    export const SensitivityLevel: {
        RESPONSIVE: 3;
        ANTI_INTERFERENCE: 1;
        BALANCE: 2;
    }

    export const WorkMode: {
        UNKNOWN: 0;
        BIOLOGICAL_DETECTION_ONLY: 1;
        SECURITY: 2;
    }

    /**
     * Configuration options for ManagerMeross cloud manager.
     * 
     * @example
     * ```typescript
     * const httpClient = await MerossHttpClient.fromUserPassword({
     *   email: 'user@example.com',
     *   password: 'password'
     * });
     * 
     * const manager = new ManagerMeross({
     *   httpClient,
     *   transportMode: TransportMode.LAN_HTTP_FIRST,
     *   logger: console.log
     * });
     * ```
     */
    export interface CloudOptions {
        /** HTTP client instance (required - use MerossHttpClient.fromUserPassword()) */
        httpClient: MerossHttpClient;
        /** Logger function for debug output */
        logger?: Logger;
        /** Transport mode for device communication */
        transportMode?: TransportMode;
        /** Request timeout in milliseconds */
        timeout?: number,
        /** Automatically retry on bad domain errors */
        autoRetryOnBadDomain?: boolean,
        /** Maximum errors allowed per device before skipping LAN HTTP (default: 1) */
        maxErrors?: number,
        /** Time window in milliseconds for error budget (default: 60000) */
        errorBudgetTimeWindow?: number,
        /** Enable statistics tracking (default: false) */
        enableStats?: boolean,
        /** Maximum number of samples to keep in statistics (default: 1000) */
        maxStatsSamples?: number,
        /** Number of concurrent requests per device (default: 1) */
        requestBatchSize?: number,
        /** Delay in milliseconds between batches (default: 200) */
        requestBatchDelay?: number,
        /** Enable/disable request throttling (default: true) */
        enableRequestThrottling?: boolean,
        /** Subscription manager options for automatic polling and data provisioning */
        subscription?: ManagerSubscriptionOptions
    }

    export interface LightData {
        channel: number;
        capacity: number;
        gradual: number;
        rgb?: number;
        temperature?: number;
        luminance?: number;
    }

    export interface ThermostatModeData {
        channel: number;
        heatTemp?: number;
        coolTemp?: number;
        manualTemp?: number;
        ecoTemp?: number;
        targetTemp?: number;
        mode?: number;
        onoff?: number;
    }

    export enum ThermostatMode {
        HEAT = 0,
        COOL = 1,
        ECONOMY = 2,
        AUTO = 3,
        MANUAL = 4
    }

    export enum ThermostatWorkingMode {
        HEAT = 1,
        COOL = 2
    }

    export enum ThermostatModeBState {
        HEATING_COOLING = 1,
        NOT_HEATING_COOLING = 2
    }

    /**
     * State update data for ThermostatState
     */
    export interface ThermostatStateUpdate {
        onoff?: number
        channel?: number
        mode?: number
        targetTemp?: number
        currentTemp?: number
        working?: number
        state?: number
        warning?: number
        min?: number
        max?: number
        heatTemp?: number
        coolTemp?: number
        ecoTemp?: number
        manualTemp?: number
        [key: string]: any
    }

    export interface ThermostatState {
        readonly isOn?: boolean;
        readonly mode?: number;
        readonly workingMode?: number;
        readonly state?: number;
        readonly warning?: boolean;
        readonly targetTemperatureCelsius?: number;
        readonly currentTemperatureCelsius?: number;
        readonly minTemperatureCelsius?: number;
        readonly maxTemperatureCelsius?: number;
        readonly heatTemperatureCelsius?: number;
        readonly coolTemperatureCelsius?: number;
        readonly ecoTemperatureCelsius?: number;
        readonly manualTemperatureCelsius?: number;
        update(state: ThermostatStateUpdate): void;
    }

    export enum LightMode {
        MODE_RGB = 1,
        MODE_TEMPERATURE = 2,
        MODE_LUMINANCE = 4
    }

    /**
     * State update data for LightState
     */
    export interface LightStateUpdate {
        onoff?: number
        channel?: number
        rgb?: number
        luminance?: number
        temperature?: number
        capacity?: number
        [key: string]: any
    }

    export interface LightState {
        readonly isOn?: boolean;
        readonly rgbTuple?: [number, number, number];
        readonly rgbInt?: number;
        readonly luminance?: number;
        readonly temperature?: number;
        readonly capacity?: number;
        update(state: LightStateUpdate): void;
    }

    /**
     * Options for setting light color and properties.
     * 
     * Used with MerossDevice.light.set() to control RGB lights.
     * 
     * @example
     * ```typescript
     * // Set RGB color
     * await device.light.set({
     *   channel: 0,
     *   rgb: [255, 0, 0], // Red
     *   luminance: 50,
     *   on: true
     * });
     * 
     * // Set color temperature
     * await device.light.set({
     *   channel: 0,
     *   temperature: 50,
     *   luminance: 75
     * });
     * ```
     */
    export interface LightColorOptions {
        /** Channel number (default: 0) */
        channel?: number;
        /** Whether to turn the light on */
        onoff?: boolean;
        /** RGB color - can be array [r,g,b], object {r,g,b}, or integer */
        rgb?: [number, number, number] | { r: number; g: number; b: number } | { red: number; green: number; blue: number } | number;
        /** Brightness level (1-100) */
        luminance?: number;
        /** Color temperature (1-100, where 1 is warmest, 100 is coolest) */
        temperature?: number;
    }

    export enum DiffuserLightMode {
        ROTATING_COLORS = 0,
        FIXED_RGB = 1,
        FIXED_LUMINANCE = 2
    }

    export enum DiffuserSprayMode {
        LIGHT = 0,
        STRONG = 1,
        OFF = 2
    }

    export enum SprayMode {
        OFF = 0,
        CONTINUOUS = 1,
        INTERMITTENT = 2
    }

    export enum RollerShutterStatus {
        UNKNOWN = -1,
        IDLE = 0,
        OPENING = 1,
        CLOSING = 2
    }

    export enum SmokeAlarmStatus {
        NORMAL = 23,
        MUTE_TEMPERATURE_ALARM = 26,
        MUTE_SMOKE_ALARM = 27,
        INTERCONNECTION_STATUS = 170
    }

    export enum TimerType {
        SINGLE_POINT_WEEKLY_CYCLE = 1,
        SINGLE_POINT_SINGLE_SHOT = 2,
        CONTINUOUS_WEEKLY_CYCLE = 3,
        CONTINUOUS_SINGLE_SHOT = 4,
        AUTO_OFF = 1,
        COUNTDOWN = 2
    }

    export enum TriggerType {
        SINGLE_POINT_WEEKLY_CYCLE = 1,
        SINGLE_POINT_SINGLE_SHOT = 2,
        CONTINUOUS_WEEKLY_CYCLE = 3,
        CONTINUOUS_SINGLE_SHOT = 4
    }

    /**
     * State update data for DiffuserLightState
     */
    export interface DiffuserLightStateUpdate {
        onoff?: number
        channel?: number
        mode?: number
        rgb?: number
        luminance?: number
        [key: string]: any
    }

    export interface DiffuserLightState {
        readonly isOn?: boolean;
        readonly mode?: number;
        readonly rgbTuple?: [number, number, number];
        readonly rgbInt?: number;
        readonly luminance?: number;
        update(state: DiffuserLightStateUpdate): void;
    }

    /**
     * State update data for DiffuserSprayState
     */
    export interface DiffuserSprayStateUpdate {
        channel?: number
        mode?: number
        [key: string]: any
    }

    export interface DiffuserSprayState {
        readonly mode?: number;
        update(state: DiffuserSprayStateUpdate): void;
    }

    /**
     * State update data for SprayState
     */
    export interface SprayStateUpdate {
        channel?: number
        mode?: number
        [key: string]: any
    }

    export interface SprayState {
        readonly mode?: number;
        update(state: SprayStateUpdate): void;
    }

    /**
     * State update data for RollerShutterState
     */
    export interface RollerShutterStateUpdate {
        channel?: number
        state?: number
        position?: number
        [key: string]: any
    }

    export interface RollerShutterState {
        readonly state?: number;
        readonly position?: number;
        readonly channel?: number;
        update(state: RollerShutterStateUpdate): void;
    }

    /**
     * State update data for GarageDoorState
     */
    export interface GarageDoorStateUpdate {
        channel?: number
        open?: number
        [key: string]: any
    }

    export interface GarageDoorState {
        readonly isOpen?: boolean;
        readonly channel?: number;
        update(state: GarageDoorStateUpdate): void;
    }

    /**
     * State update data for TimerState
     */
    export interface TimerStateUpdate {
        id?: string | number
        channel?: number
        week?: number
        time?: number
        enable?: number | boolean
        alias?: string
        type?: number
        duration?: number
        sunOffset?: number
        createTime?: number
        extend?: Record<string, any>
        [key: string]: any
    }

    export interface TimerState {
        readonly id?: string | number;
        readonly channel?: number;
        readonly week?: number;
        readonly time?: number;
        readonly enable?: boolean;
        readonly alias?: string;
        readonly type?: number;
        readonly duration?: number;
        readonly sunOffset?: number;
        readonly createTime?: number;
        readonly extend?: Record<string, any>;
        update(state: TimerStateUpdate): void;
    }

    /**
     * State update data for TriggerState
     */
    export interface TriggerStateUpdate {
        id?: string | number
        channel?: number
        alias?: string
        enable?: number | boolean
        type?: number
        createTime?: number
        rule?: Record<string, any>
        ruleDuration?: number
        ruleWeek?: number
        [key: string]: any
    }

    export interface TriggerState {
        readonly id?: string | number;
        readonly channel?: number;
        readonly alias?: string;
        readonly enable?: boolean;
        readonly type?: number;
        readonly createTime?: number;
        readonly rule?: Record<string, any>;
        readonly ruleDuration?: number;
        readonly ruleWeek?: number;
        update(state: TriggerStateUpdate): void;
    }

    /**
     * State update data for PresenceSensorState
     */
    export interface PresenceSensorStateUpdate {
        channel?: number
        presence?: Record<string, any>
        light?: Record<string, any>
        [key: string]: any
    }

    export interface PresenceSensorState {
        readonly isPresent?: boolean;
        readonly presenceValue?: number;
        readonly presenceState?: string;
        readonly distanceMeters?: number;
        readonly distanceRaw?: number;
        readonly presenceTimestamp?: Date;
        readonly presenceTimes?: number;
        readonly lightLux?: number;
        readonly lightTimestamp?: Date;
        readonly channel?: number;
        readonly rawPresence?: Record<string, any>;
        readonly rawLight?: Record<string, any>;
        update(state: PresenceSensorStateUpdate): void;
    }

    /**
     * State update data for ToggleState
     */
    export interface ToggleStateUpdate {
        channel?: number
        onoff?: number
        lmTime?: number
        entity?: number
        [key: string]: any
    }

    export interface ToggleState {
        readonly isOn?: boolean;
        readonly onoff?: number;
        readonly channel?: number;
        readonly lmTime?: number;
        readonly entity?: number;
        update(state: ToggleStateUpdate): void;
    }

    export class GenericPushNotification {
        readonly namespace: string;
        readonly originatingDeviceUuid: string;
        readonly rawData: any;
        constructor(namespace: string, originatingDeviceUuid: string, rawData: any);
    }

    export class OnlinePushNotification extends GenericPushNotification {
        readonly status?: number;
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class AlarmPushNotification extends GenericPushNotification {
        readonly value?: number | string | Record<string, any>;
        readonly timestamp?: number;
        readonly channel?: number;
        readonly subdeviceId?: string;
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class BindPushNotification extends GenericPushNotification {
        readonly time: TimeInfo | null
        readonly hwinfo: HardwareInfo | null
        readonly fwinfo: FirmwareInfo | null
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class UnbindPushNotification extends GenericPushNotification {
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class WaterLeakPushNotification extends GenericPushNotification {
        readonly syncedTime?: number | Record<string, any>;
        readonly latestSampleTime?: number;
        readonly latestSampleIsLeak?: number;
        readonly subdeviceId?: string;
        readonly samples?: Array<{ time: number; isLeak: number; [key: string]: any }>;
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    /**
     * Hub online data structure
     */
    export interface HubOnlineData {
        subdeviceId: string
        onlineStatus: number
        [key: string]: any
    }

    /**
     * Hub toggle data structure
     */
    export interface HubToggleXData {
        subdeviceId: string
        onoff: number
        [key: string]: any
    }

    /**
     * Hub battery data structure
     */
    export interface HubBatteryData {
        subdeviceId: string
        battery: number
        [key: string]: any
    }

    /**
     * Hub sensor data structure
     */
    export interface HubSensorData {
        subdeviceId: string
        [key: string]: any
    }

    export class HubOnlinePushNotification extends GenericPushNotification {
        readonly onlineData: HubOnlineData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class HubToggleXPushNotification extends GenericPushNotification {
        readonly togglexData: HubToggleXData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class HubBatteryPushNotification extends GenericPushNotification {
        readonly batteryData: HubBatteryData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class HubSensorAllPushNotification extends GenericPushNotification {
        readonly allData: HubSensorData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class HubSensorTempHumPushNotification extends GenericPushNotification {
        readonly tempHumData: HubSensorData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class HubSensorAlertPushNotification extends GenericPushNotification {
        readonly alertData: HubSensorData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class HubSensorSmokePushNotification extends GenericPushNotification {
        readonly subdeviceId?: string | number;
        readonly status?: number;
        readonly interConn?: number | Record<string, any>;
        readonly timestamp?: number;
        readonly testEvent?: boolean;
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    /**
     * MTS100 thermostat data structure
     */
    export interface HubMts100Data {
        subdeviceId: string
        [key: string]: any
    }

    /**
     * Subdevice list data structure
     */
    export interface HubSubdeviceListData {
        subdeviceId: string
        subDeviceType: string
        [key: string]: any
    }

    /**
     * Timer data structure
     */
    export interface TimerXData {
        timerId: string
        channel: number
        [key: string]: any
    }

    /**
     * Trigger data structure
     */
    export interface TriggerXData {
        triggerId: string
        channel: number
        [key: string]: any
    }

    /**
     * Presence study data structure
     */
    export interface PresenceStudyData {
        channel: number
        [key: string]: any
    }

    /**
     * Sensor latest data structure
     */
    export interface SensorLatestXData {
        channel: number
        [key: string]: any
    }

    /**
     * Diffuser light data structure
     */
    export interface DiffuserLightData {
        channel: number
        onoff: number
        [key: string]: any
    }

    /**
     * Diffuser spray data structure
     */
    export interface DiffuserSprayData {
        channel: number
        mode: number
        [key: string]: any
    }

    export class HubMts100AllPushNotification extends GenericPushNotification {
        readonly allData: HubMts100Data[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class HubMts100ModePushNotification extends GenericPushNotification {
        readonly modeData: HubMts100Data[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class HubMts100TemperaturePushNotification extends GenericPushNotification {
        readonly temperatureData: HubMts100Data[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class HubSubdeviceListPushNotification extends GenericPushNotification {
        readonly subdeviceListData: HubSubdeviceListData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class TimerXPushNotification extends GenericPushNotification {
        readonly timerxData: TimerXData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class TriggerXPushNotification extends GenericPushNotification {
        readonly triggerxData: TriggerXData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class PresenceStudyPushNotification extends GenericPushNotification {
        readonly studyData: PresenceStudyData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class ToggleXPushNotification extends GenericPushNotification {
        readonly togglexData: HubToggleXData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class SensorLatestXPushNotification extends GenericPushNotification {
        readonly latestData: SensorLatestXData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class DiffuserLightPushNotification extends GenericPushNotification {
        readonly lightData: DiffuserLightData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export class DiffuserSprayPushNotification extends GenericPushNotification {
        readonly sprayData: DiffuserSprayData[];
        constructor(originatingDeviceUuid: string, rawData: any);
    }

    export function parsePushNotification(namespace: string, messagePayload: any, deviceUuid: string): GenericPushNotification | null;

    export type MessageId = string
    /** @deprecated Use Promise-based methods instead */
    export type Callback<T> = (error: Error | null, data: T) => void
    /** @deprecated Use Promise-based methods instead */
    export type ErrorCallback = (error: Error | null) => void
    export type DeviceInitializedEvent = 'deviceInitialized'

    export type DeviceInitializedCallback = (deviceId: string, device: MerossDevice) => void

    export type PushNotificationEvent = 'pushNotification'
    export type PushNotificationCallback = (deviceId: string, notification: GenericPushNotification, device: MerossDevice) => void

    export type ErrorEvent = 'error'
    export type CloudErrorCallback = (error: Error, deviceId: string | null) => void

    /**
     * Filter options for finding devices.
     * 
     * Used with DeviceRegistry.find() to filter the device list.
     * 
     * @example
     * ```typescript
     * // Find online devices
     * const onlineDevices = manager.devices.find({ onlineStatus: 1 });
     * 
     * // Find specific device types
     * const plugs = manager.devices.find({ deviceType: 'mss310' });
     * 
     * // Find by custom filter function
     * const customDevices = manager.devices.find({
     *   deviceClass: (device) => device.deviceType.startsWith('mss')
     * });
     * ```
     */
    export interface FindDevicesFilters {
        /** Array of device UUIDs to filter by */
        deviceUuids?: string[];
        /** Array of internal device IDs to filter by */
        internalIds?: string[];
        /** Device type to filter by */
        deviceType?: string;
        /** Device name to filter by */
        deviceName?: string;
        /** Online status to filter by (0=connecting, 1=online, 2=offline, -1=unknown, 3=upgrading) */
        onlineStatus?: number;
        /** Device class filter - can be a string, function, or array of filters */
        deviceClass?: string | ((device: MerossDevice) => boolean) | Array<string | ((device: MerossDevice) => boolean)>;
    }

    /**
     * Registry for managing Meross devices and subdevices.
     * 
     * Maintains indexes for efficient device lookups across base devices and subdevices.
     * Base devices can be looked up by UUID, while internal IDs enable unified lookup
     * for both base devices and subdevices.
     * 
     * Internal IDs unify device identification:
     * - Base devices: `#BASE:{uuid}`
     * - Subdevices: `#SUB:{hubUuid}:{subdeviceId}`
     * 
     * @example
     * ```typescript
     * // Look up device by UUID
     * const device = manager.devices.get('device-uuid');
     * 
     * // Look up subdevice by hub UUID and subdevice ID
     * const subdevice = manager.devices.get({ hubUuid: 'hub-uuid', id: 'subdevice-id' });
     * 
     * // Find devices matching filters
     * const lights = manager.devices.find({ deviceClass: 'light' });
     * 
     * // Get all devices
     * const allDevices = manager.devices.list();
     * ```
     */
    export class DeviceRegistry {
        /**
         * Generates an internal ID for a device or subdevice.
         * 
         * @param uuid - Device UUID (for base devices) or hub UUID (for subdevices)
         * @param isSubdevice - Whether this is a subdevice
         * @param hubUuid - Hub UUID (required if isSubdevice is true)
         * @param subdeviceId - Subdevice ID (required if isSubdevice is true)
         * @returns Internal ID string
         */
        static generateInternalId(uuid: string, isSubdevice?: boolean, hubUuid?: string | null, subdeviceId?: string | null): string
        
        /**
         * Registers a device in the registry.
         * 
         * @param device - Device instance to register
         */
        registerDevice(device: MerossDevice | MerossHubDevice | MerossSubDevice): void
        
        /**
         * Removes a device from the registry.
         * 
         * @param device - Device instance to remove
         */
        removeDevice(device: MerossDevice | MerossHubDevice | MerossSubDevice): void
        
        /**
         * Unified method to get a device by identifier.
         * 
         * Supports both base devices (by UUID string) and subdevices (by object with hubUuid and id).
         * Internally converts the identifier to an internal ID format and performs the lookup.
         * 
         * @param identifier - Device identifier
         * @returns Device instance, or null if not found
         * @example
         * // Get base device by UUID
         * const device = registry.get('device-uuid');
         * 
         * @example
         * // Get subdevice by hub UUID and subdevice ID
         * const subdevice = registry.get({ hubUuid: 'hub-uuid', id: 'subdevice-id' });
         */
        get(identifier: string | { hubUuid: string; id: string }): MerossDevice | MerossHubDevice | MerossSubDevice | null
        
        /**
         * Gets all registered devices.
         * 
         * @returns Array of all registered devices
         */
        list(): Array<MerossDevice | MerossHubDevice | MerossSubDevice>
        
        /**
         * Finds devices matching the specified filters.
         * 
         * @param filters - Optional filter criteria
         * @returns Array of matching devices
         */
        find(filters?: FindDevicesFilters): Array<MerossDevice | MerossHubDevice | MerossSubDevice>
        
        /**
         * Clears all devices from the registry.
         */
        clear(): void
        
        /**
         * Gets the total number of devices registered (including subdevices).
         */
        readonly size: number
    }

    // Statistics types
    export class HttpRequestSample {
        readonly url: string;
        readonly method: string;
        readonly httpResponseCode: number;
        readonly apiResponseCode: number | null;
        readonly timestamp: number;
    }

    export class HttpStat {
        readonly totalCalls: number;
        byHttpResponseCode(): Array<[number, number]>;
        byApiStatusCode(): Array<[string, number]>;
    }

    export class HttpStatsResult {
        readonly globalStats: HttpStat;
        statsByUrl(url: string): HttpStat | null;
        deviceStats(): Array<[string, HttpStat]>;
    }

    export class HttpStatsCounter {
        constructor(maxSamples?: number);
        notifyHttpRequest(requestUrl: string, method: string, httpResponseCode: number, apiResponseCode: number | null): void;
        getStats(timeWindowMs?: number): HttpStatsResult;
    }

    export class ApiCallSample {
        readonly deviceUuid: string;
        readonly namespace: string;
        readonly method: string;
        readonly timestamp: number;
    }

    export class ApiStat {
        readonly totalCalls: number;
        byMethodNamespace(): Array<[string, number]>;
    }

    export class ApiStatsResult {
        readonly globalStats: ApiStat;
        statsByUuid(deviceUuid: string): ApiStat | null;
        deviceStats(): Array<[string, ApiStat]>;
    }

    export class MqttStatsCounter {
        constructor(maxSamples?: number);
        readonly apiCalls: ApiCallSample[];
        readonly delayedCalls: ApiCallSample[];
        readonly droppedCalls: ApiCallSample[];
        notifyApiCall(deviceUuid: string, namespace: string, method: string): void;
        notifyDelayedCall(deviceUuid: string, namespace: string, method: string): void;
        notifyDroppedCall(deviceUuid: string, namespace: string, method: string): void;
        getApiStats(timeWindowMs?: number): ApiStatsResult;
        getDelayedApiStats(timeWindowMs?: number): ApiStatsResult;
        getDroppedApiStats(timeWindowMs?: number): ApiStatsResult;
    }

    /**
     * Utility class for timer operations.
     * 
     * Provides static methods for working with device timers, including time conversion,
     * day mask generation, and timer creation.
     * 
     * @example
     * ```typescript
     * const minutes = TimerUtils.timeToMinutes('14:30');
     * const weekMask = TimerUtils.daysToWeekMask(['monday', 'wednesday', 'friday']);
     * const timer = TimerUtils.createTimer({
     *   channel: 0,
     *   time: '18:00',
     *   days: ['monday', 'tuesday', 'wednesday'],
     *   on: true
     * });
     * ```
     */
    export class TimerUtils {
        /**
         * Converts a time string, Date, or minutes to total minutes since midnight.
         * 
         * @param time - Time as string ('HH:MM'), Date object, or minutes number
         * @returns Total minutes since midnight
         */
        static timeToMinutes(time: string | Date | number): number;
        
        /**
         * Converts minutes since midnight to time string.
         * 
         * @param minutes - Minutes since midnight
         * @returns Time string in 'HH:MM' format
         */
        static minutesToTime(minutes: number): string;
        
        /**
         * Converts an array of days to a week mask bitmask.
         * 
         * @param days - Array of day names or numbers
         * @param repeat - Whether to repeat weekly (default: true)
         * @returns Week mask bitmask
         */
        static daysToWeekMask(days: Array<string | number>, repeat?: boolean): number;
        
        /**
         * Generates a unique timer ID.
         * 
         * @returns Timer ID string
         */
        static generateTimerId(): string;
        
        /**
         * Creates a timer object with the specified options.
         * 
         * @param options - Timer options
         * @returns Timer object ready to be sent to device
         */
        static createTimer(options: {
            channel?: number;
            alias?: string;
            time?: string | Date | number;
            days?: string[] | number[];
            on?: boolean;
            enabled?: boolean;
            type?: number;
        }): any;
    }

    /**
     * Utility class for trigger operations.
     * 
     * Provides static methods for working with device triggers, including duration
     * conversion and trigger creation.
     * 
     * @example
     * ```typescript
     * const seconds = TriggerUtils.durationToSeconds('1h30m');
     * const duration = TriggerUtils.secondsToDuration(5400);
     * const trigger = TriggerUtils.createTrigger({
     *   channel: 0,
     *   duration: '2h',
     *   days: ['monday', 'friday'],
     *   enabled: true
     * });
     * ```
     */
    export class TriggerUtils {
        /**
         * Converts a duration string or number to seconds.
         * 
         * @param duration - Duration as string ('1h30m') or seconds number
         * @returns Total seconds
         */
        static durationToSeconds(duration: string | number): number;
        
        /**
         * Converts seconds to duration string.
         * 
         * @param seconds - Total seconds
         * @returns Duration string (e.g., '1h30m')
         */
        static secondsToDuration(seconds: number): string;
        
        /**
         * Creates a trigger object with the specified options.
         * 
         * @param options - Trigger options
         * @returns Trigger object ready to be sent to device
         */
        static createTrigger(options: {
            channel?: number;
            alias?: string;
            duration?: string | number;
            days?: string[] | number[];
            type?: number;
            enabled?: boolean;
        }): any;
    }

    export interface DebugUtils {
        getErrorBudget(deviceUuid: string): number;
        resetErrorBudget(deviceUuid: string): void;
        getMqttStats(timeWindowMs?: number): ApiStatsResult | null;
        getHttpStats(timeWindowMs?: number): HttpStatsResult | null;
        getDelayedMqttStats(timeWindowMs?: number): ApiStatsResult | null;
        getDroppedMqttStats(timeWindowMs?: number): ApiStatsResult | null;
        enableStats(maxStatsSamples?: number): void;
        disableStats(): void;
        isStatsEnabled(): boolean;
    }

    export function createDebugUtils(manager: ManagerMeross): DebugUtils;

    export interface ManagerSubscriptionOptions {
        /** Logger function for debug output */
        logger?: Logger;
        deviceStateInterval?: number;
        electricityInterval?: number;
        consumptionInterval?: number;
        httpDeviceListInterval?: number;
        smartCaching?: boolean;
        cacheMaxAge?: number;
    }

    /**
     * Device update event data
     */
    export interface DeviceUpdate {
        source: string
        timestamp: number
        event?: any
        device: MerossDevice
        state: any
        changes: Record<string, any>
        [key: string]: any
    }

    /**
     * Device list update event data
     */
    export interface DeviceListUpdate {
        devices: DeviceDefinition[]
        added: DeviceDefinition[]
        removed: DeviceDefinition[]
        changed: DeviceDefinition[]
        timestamp: number
    }

    export class ManagerSubscription extends EventEmitter {
        constructor(manager: ManagerMeross, options?: ManagerSubscriptionOptions);
        subscribe(device: MerossDevice, config?: ManagerSubscriptionOptions): void;
        unsubscribe(deviceUuid: string): void;
        subscribeToDeviceList(): void;
        unsubscribeFromDeviceList(): void;
        destroy(): void;
        
        // EventEmitter events
        on(event: `deviceUpdate:${string}`, listener: (update: DeviceUpdate) => void): this;
        on(event: 'deviceListUpdate', listener: (update: DeviceListUpdate) => void): this;
        on(event: 'error', listener: (error: Error, context?: string) => void): this;
    }

    /**
     * Main Meross IoT cloud manager.
     * 
     * Manages connections to Meross devices via cloud MQTT and local HTTP.
     * Handles device discovery, connection management, and provides access to device instances.
     * 
     * @example
     * ```typescript
     * const httpClient = await MerossHttpClient.fromUserPassword({
     *   email: 'user@example.com',
     *   password: 'password'
     * });
     * 
     * const manager = new ManagerMeross({ httpClient });
     * await manager.connect();
     * 
     * manager.on('deviceInitialized', (deviceId, device) => {
     *   console.log(`Device ${deviceId} initialized: ${device.name}`);
     * });
     * 
     * const devices = manager.devices.list();
     * ```
     */
    /**
     * Manages device discovery, initialization, and lifecycle.
     * 
     * Handles device discovery from Meross cloud, device enrollment,
     * subdevice management, and device removal. Provides a clean
     * interface for device operations separate from transport concerns.
     * 
     * @example
     * ```typescript
     * // Discover devices
     * const devices = await manager.devices.discover({ onlineOnly: true });
     * 
     * // Initialize all devices
     * const count = await manager.devices.initialize();
     * 
     * // Get a device
     * const device = manager.devices.get('device-uuid');
     * 
     * // List all devices
     * const allDevices = manager.devices.list();
     * ```
     */
    export class ManagerDevices {
        /**
         * Gets a device by UUID or subdevice identifier.
         * 
         * @param identifier - Device UUID or subdevice identifier
         * @returns Device instance or null if not found
         */
        get(identifier: string | { hubUuid: string; id: string }): MerossDevice | MerossHubDevice | MerossSubDevice | null
        
        /**
         * Lists all registered devices.
         * 
         * @returns Array of device instances
         */
        list(): Array<MerossDevice | MerossHubDevice | MerossSubDevice>
        
        /**
         * Finds devices matching the provided filters.
         * 
         * @param filters - Filter criteria
         * @returns Array of matching device instances
         */
        find(filters?: FindDevicesFilters): Array<MerossDevice | MerossHubDevice | MerossSubDevice>
        
        /**
         * Discovers available base devices without initializing them.
         * 
         * @param options - Optional filter options
         * @returns Promise resolving to array of device info objects
         */
        discover(options?: { deviceTypes?: string[], onlineOnly?: boolean, excludeHubs?: boolean }): Promise<DeviceDefinition[]>
        
        /**
         * Discovers available subdevices without initializing devices.
         * 
         * @param options - Optional filter options
         * @returns Promise resolving to array of subdevice info objects
         */
        discoverSubdevices(options?: { hubUuids?: string[], subdeviceType?: string, onlineOnly?: boolean }): Promise<SubdeviceInfo[]>
        
        /**
         * Initializes devices from the Meross cloud.
         * 
         * @param options - Optional filter options
         * @returns Promise resolving to the number of devices initialized
         */
        initialize(options?: { uuids?: string[] }): Promise<number>
        
        /**
         * Initializes a single device by UUID or subdevice by identifier.
         * 
         * @param identifier - Device identifier
         * @returns Promise resolving to device instance, or null if initialization fails
         */
        initializeDevice(identifier: string | { hubUuid: string, id: string }): Promise<MerossDevice | MerossHubDevice | MerossSubDevice | null>
        
        /**
         * Removes a device from the manager.
         * 
         * @param identifier - Device identifier
         * @returns Promise resolving to true if device was removed, false if not found
         */
        remove(identifier: string | { hubUuid: string, id: string }): Promise<boolean>
    }

    /**
     * Manages MQTT connections and message publishing.
     * 
     * Handles MQTT client creation, connection management, message encoding,
     * and message routing. Provides a clean interface for MQTT operations
     * separate from device management.
     * 
     * @example
     * ```typescript
     * // Initialize MQTT for a device
     * await manager.mqtt.init(deviceDef);
     * 
     * // Encode a message
     * const data = manager.mqtt.encode('GET', 'Appliance.Control.ToggleX', {}, 'device-uuid');
     * 
     * // Send a message
     * manager.mqtt.send(device, data);
     * ```
         */
    export class ManagerMqtt {
        /**
         * Initializes MQTT connection for a device.
         * 
         * @param dev - Device definition object with uuid and optional domain
         * @returns Promise that resolves when MQTT connection is ready
         */
        init(dev: { uuid: string; domain?: string }): Promise<void>
        
        /**
         * Sends a message to a device via MQTT.
         * 
         * @param device - Device instance
         * @param data - Message data object with header and payload
         * @returns True if message was sent successfully, false if MQTT connection not available
         */
        send(device: MerossDevice | MerossHubDevice | MerossSubDevice, data: any): boolean
        
        /**
         * Encodes a message for Meross device communication.
         * 
         * @param method - Message method ('GET', 'SET', 'PUSH')
         * @param namespace - Message namespace
         * @param payload - Message payload object
         * @param deviceUuid - Target device UUID
         * @returns Encoded message object with header and payload
         */
        encode(method: string, namespace: string, payload: any, deviceUuid: string): any
        
        /**
         * Disconnects all MQTT connections.
         * 
         * @param force - Force disconnect flag
         */
        disconnectAll(force?: boolean): void
    }

    /**
     * Manages LAN HTTP communication with devices.
     * 
     * Handles local HTTP communication directly with Meross devices
     * on the local network, bypassing the cloud MQTT broker.
     * 
     * @example
     * ```typescript
     * // Send a message via LAN HTTP
     * await manager.http.send(device, '192.168.1.100', data);
     * ```
     */
    export class ManagerHttp {
        /**
         * Sends a message to a device via LAN HTTP.
         * 
         * @param device - Device instance
         * @param ip - Device LAN IP address
         * @param payload - Message payload
         * @param timeoutOverride - Optional timeout override in milliseconds
         * @returns Promise that resolves when message is sent
         */
        send(device: MerossDevice | MerossHubDevice | MerossSubDevice, ip: string, payload: any, timeoutOverride?: number): Promise<void>
    }

    /**
     * Manages transport mode selection and message routing.
     * 
     * Handles transport mode configuration and coordinates between MQTT and HTTP
     * managers to route messages based on the selected transport mode. Provides
     * error budget checking and automatic fallback logic.
     * 
     * @example
     * ```typescript
     * // Set default transport mode
     * manager.transport.defaultMode = TransportMode.LAN_HTTP_FIRST;
     * 
     * // Request a message with transport mode override
     * await manager.transport.request(device, '192.168.1.100', data, TransportMode.MQTT_ONLY);
     * ```
     */
    export class ManagerTransport {
        /**
         * Gets or sets the default transport mode for device communication.
         */
        get defaultMode(): number
        set defaultMode(value: number)
        
        /**
         * Requests a message to be sent to a device.
         * 
         * @param device - Device instance
         * @param ip - Device LAN IP address (null if not available)
         * @param data - Message data object with header and payload
         * @param overrideMode - Optional override transport mode
         * @returns Promise that resolves to true if message was sent successfully
         */
        request(device: MerossDevice | MerossHubDevice | MerossSubDevice, ip: string | null, data: any, overrideMode?: number | null): Promise<boolean>
    }

    export class ManagerMeross extends EventEmitter {
        /**
         * Creates a new ManagerMeross instance.
         * 
         * @param options - Configuration options
         */
        constructor(options: CloudOptions)
        
        /**
         * Connects to the Meross cloud and initializes devices.
         * 
         * @returns Promise resolving to the number of devices initialized
         * @throws {MerossError} If connection fails
         */
        connect(): Promise<number>
        
        /**
         * Authenticates with Meross cloud and discovers devices.
         * 
         * Alias for devices.initialize(). Retrieves device list and initializes device connections.
         * The httpClient should already be authenticated when passed to the constructor.
         * 
         * @returns Promise resolving to the number of devices discovered
         * @throws {HttpApiError} If API request fails
         * @throws {TokenExpiredError} If authentication token has expired
         */
        login(): Promise<number>
        
        /**
         * Registers a handler for device initialization events.
         * 
         * @param name - Event name ('deviceInitialized')
         * @param handler - Callback function
         * @returns This instance for method chaining
         */
        on(name: DeviceInitializedEvent, handler: DeviceInitializedCallback): this
        
        /**
         * Registers a handler for push notification events.
         * 
         * @param name - Event name ('pushNotification')
         * @param handler - Callback function
         * @returns This instance for method chaining
         */
        on(name: PushNotificationEvent, handler: PushNotificationCallback): this
        
        /**
         * Registers a handler for error events.
         * 
         * @param name - Event name ('error')
         * @param handler - Callback function
         * @returns This instance for method chaining
         */
        on(name: ErrorEvent, handler: CloudErrorCallback): this
        
        /**
         * Logs out and invalidates the current session.
         * 
         * @returns Promise that resolves when logout is complete
         */
        logout(): Promise<void>
        
        /**
         * Disconnects all devices.
         * 
         * @param force - Whether to force disconnect immediately
         */
        disconnectAll(force: boolean): void
        
        /**
         * Gets the current token data.
         * 
         * @returns Token data or null if not authenticated
         */
        getTokenData(): TokenData | null
        
        /** HTTP client instance */
        readonly httpClient: MerossHttpClient
        
        /** Subscription manager instance for automatic polling and data provisioning */
        readonly subscription: ManagerSubscription
        
        /** Device manager instance for device discovery, initialization, and lifecycle */
        readonly devices: ManagerDevices
        
        /** MQTT manager instance for MQTT connection management and message publishing */
        readonly mqtt: ManagerMqtt
        
        /** HTTP manager instance for LAN HTTP communication */
        readonly http: ManagerHttp
        
        /** Transport manager instance for transport mode selection and message routing */
        readonly transport: ManagerTransport
    }


    /**
     * HTTP client for Meross cloud API.
     * 
     * Handles authentication and HTTP API requests to the Meross cloud.
     * Provides factory methods for easy initialization from credentials.
     * 
     * @example
     * ```typescript
     * // Login with username/password
     * const httpClient = await MerossHttpClient.fromUserPassword({
     *   email: 'user@example.com',
     *   password: 'password'
     * });
     * 
     * // Or use saved credentials
     * const httpClient = MerossHttpClient.fromCredentials({
     *   token: '...',
     *   key: '...',
     *   userId: '...',
     *   domain: '...'
     * });
     * 
     * const devices = await httpClient.getDevices();
     * ```
     */
    export class MerossHttpClient {
        /**
         * Creates a new MerossHttpClient instance.
         * 
         * @param options - Client configuration options
         */
        constructor(options?: {
            logger?: Logger;
            timeout?: number;
            autoRetryOnBadDomain?: boolean;
            mqttDomain?: string | null;
            enableStats?: boolean;
            maxStatsSamples?: number;
        });
        
        /**
         * Sets the authentication token.
         * 
         * @param token - Authentication token
         */
        setToken(token: string): void;
        
        /**
         * Sets the HTTP API domain.
         * 
         * @param domain - API domain (e.g., 'us.meross.com')
         */
        setHttpDomain(domain: string): void;
        
        /**
         * Sets the MQTT domain.
         * 
         * @param domain - MQTT domain or null to use default
         */
        setMqttDomain(domain: string | null): void;
        
        /** HTTP statistics counter (null if stats not enabled) */
        readonly stats: HttpStatsCounter | null;
        
        /**
         * Logs in with email and password.
         * 
         * @param email - User email address
         * @param password - User password
         * @param mfaCode - Optional MFA code if required
         * @returns Promise resolving to login response with token data
         * @throws {MFARequiredError} If MFA is required
         * @throws {AuthenticationError} If login fails
         */
        login(email: string, password: string, mfaCode?: string): Promise<{
            token: string;
            key: string;
            userId: string;
            email: string;
            mqttDomain?: string;
        }>;
        
        /**
         * Gets the list of devices for the authenticated user.
         * 
         * @returns Promise resolving to array of device definitions
         * @throws {UnauthorizedError} If not authenticated
         */
        getDevices(): Promise<DeviceDefinition[]>;
        
        /**
         * Gets subdevices for a hub device.
         * 
         * @param deviceUuid - Hub device UUID
         * @returns Promise resolving to array of subdevice definitions
         */
        getSubDevices(deviceUuid: string): Promise<any[]>;
        
        /**
         * Logs out and invalidates the current session.
         * 
         * @returns Promise that resolves when logout is complete
         */
        logout(): Promise<void>;
        
        /**
         * Factory method: Creates an HTTP client from username/password credentials.
         * 
         * This method handles login and returns a configured client instance.
         * 
         * @param options - Login options including email and password
         * @returns Promise resolving to configured MerossHttpClient instance
         * 
         * @example
         * ```typescript
         * const httpClient = await MerossHttpClient.fromUserPassword({
         *   email: 'user@example.com',
         *   password: 'password',
         *   mfaCode: '123456' // if MFA is enabled
         * });
         * ```
         */
        static fromUserPassword(options: {
            email: string;
            password: string;
            mfaCode?: string;
            logger?: Logger;
            timeout?: number;
            autoRetryOnBadDomain?: boolean;
            enableStats?: boolean;
            maxStatsSamples?: number;
        }): Promise<MerossHttpClient>;
        
        /**
         * Factory method: Creates an HTTP client from saved credentials.
         * 
         * Use this when you have previously saved token data from a login.
         * 
         * @param credentials - Saved credential data
         * @param options - Optional client configuration
         * @returns Configured MerossHttpClient instance
         * 
         * @example
         * ```typescript
         * const httpClient = MerossHttpClient.fromCredentials({
         *   token: savedToken,
         *   key: savedKey,
         *   userId: savedUserId,
         *   domain: savedDomain,
         *   mqttDomain: savedMqttDomain
         * });
         * ```
         */
        static fromCredentials(credentials: {
            token: string;
            key: string;
            userId: string;
            domain: string;
            mqttDomain?: string;
        }, options?: {
            logger?: Logger;
            timeout?: number;
            autoRetryOnBadDomain?: boolean;
            enableStats?: boolean;
            maxStatsSamples?: number;
        }): MerossHttpClient;
    }

    /**
     * Toggle feature interface.
     * 
     * Provides control over device on/off state.
     */
    export interface ToggleFeature {
        /**
         * Sets the toggle state (on/off) for a channel.
         * 
         * Automatically detects whether device uses Toggle or ToggleX protocol.
         * 
         * @param options - Toggle options
         * @param options.on - True to turn on, false to turn off
         * @param options.channel - Channel to control (default: 0)
         * @returns Promise that resolves when state is set
         */
        set(options: { on: boolean; channel?: number }): Promise<void>
        
        /**
         * Gets the current toggle state for a channel.
         * 
         * Uses cached state if fresh (<5 seconds), otherwise fetches from device.
         * This transparent caching reduces unnecessary network requests.
         * 
         * @param options - Get options
         * @param options.channel - Channel to get state for (default: 0)
         * @returns Promise that resolves with toggle state or undefined
         */
        get(options?: { channel?: number }): Promise<ToggleState | undefined>
        
        /**
         * Checks if the device is on for the specified channel.
         * 
         * Convenience method that reads from cached state. Returns undefined if state not available.
         * 
         * @param options - Options
         * @param options.channel - Channel to check (default: 0)
         * @returns True if on, false if off, undefined if not available
         */
        isOn(options?: { channel?: number }): boolean | undefined
    }

    /**
     * Light feature interface.
     * 
     * Provides control over light settings including color, brightness, temperature.
     */
    export interface LightFeature {
        /**
         * Sets the light color, brightness, temperature, and on/off state.
         * 
         * Automatically detects device capabilities (RGB, temperature, luminance support).
         * Only sends parameters that the device supports to avoid errors.
         * 
         * @param options - Light control options
         * @param options.channel - Channel to control (default: 0)
         * @param options.on - Turn on/off (only used if device doesn't support Toggle/ToggleX)
         * @param options.rgb - RGB color [r, g, b], integer, or {r,g,b} object
         * @param options.luminance - Brightness value (0-100)
         * @param options.temperature - Temperature value (0-100)
         * @param options.gradual - Enable gradual transition (default: true for RGB, false otherwise)
         * @returns Promise that resolves with response or null if no changes needed
         */
        set(options?: {
            channel?: number;
            on?: boolean;
            rgb?: [number, number, number] | { r: number; g: number; b: number } | { red: number; green: number; blue: number } | number;
            luminance?: number;
            temperature?: number;
            gradual?: boolean | number;
        }): Promise<any | null>
        
        /**
         * Gets the current light state for a channel.
         * 
         * Uses cached state if fresh (<5 seconds), otherwise fetches from device.
         * 
         * @param options - Get options
         * @param options.channel - Channel to get state for (default: 0)
         * @returns Promise that resolves with light state or undefined
         */
        get(options?: { channel?: number }): Promise<LightState | undefined>
        
        /**
         * Checks if the light is on for the specified channel.
         * 
         * Convenience method that reads from cached state.
         * 
         * @param options - Options
         * @param options.channel - Channel to check (default: 0)
         * @returns True if on, false if off, undefined if not available
         */
        isOn(options?: { channel?: number }): boolean | undefined
        
        /**
         * Gets the light RGB color for the specified channel.
         * 
         * Reads from cached state. Returns undefined if device doesn't support RGB or state unavailable.
         * 
         * @param options - Options
         * @param options.channel - Channel to get color for (default: 0)
         * @returns RGB tuple [r, g, b] or undefined if not available
         */
        getRgbColor(options?: { channel?: number }): [number, number, number] | undefined
        
        /**
         * Gets the light brightness for the specified channel.
         * 
         * Reads from cached state. Returns undefined if device doesn't support brightness control.
         * 
         * @param options - Options
         * @param options.channel - Channel to get brightness for (default: 0)
         * @returns Brightness value or undefined if not available
         */
        getBrightness(options?: { channel?: number }): number | undefined
        
        /**
         * Gets the light temperature for the specified channel.
         * 
         * @param options - Options
         * @param options.channel - Channel to get temperature for (default: 0)
         * @returns Temperature value or undefined if not available
         */
        getTemperature(options?: { channel?: number }): number | undefined
        
        /**
         * Checks if the light supports RGB mode for the specified channel.
         * 
         * @param options - Options
         * @param options.channel - Channel to check (default: 0)
         * @returns True if RGB is supported
         */
        supportsRgb(options?: { channel?: number }): boolean
        
        /**
         * Checks if the light supports luminance mode for the specified channel.
         * 
         * @param options - Options
         * @param options.channel - Channel to check (default: 0)
         * @returns True if luminance is supported
         */
        supportsLuminance(options?: { channel?: number }): boolean
        
        /**
         * Checks if the light supports temperature mode for the specified channel.
         * 
         * @param options - Options
         * @param options.channel - Channel to check (default: 0)
         * @returns True if temperature is supported
         */
        supportsTemperature(options?: { channel?: number }): boolean
    }

    /**
     * System feature interface.
     *
     * Provides access to device system information.
     */
    export interface SystemFeature {
        getAllData(): Promise<any>
        getDebug(): Promise<any>
        getAbilities(): Promise<any>
        getEncryptSuite(): Promise<any>
        getEncryptECDHE(): Promise<any>
        getOnlineStatus(): Promise<any>
        getConfigWifiList(): Promise<any>
        getConfigTrace(): Promise<any>
        getRuntime(): Promise<any>
    }

    /**
     * Encryption feature interface.
     *
     * Provides encryption-related functionality.
     */
    export interface EncryptionFeature {
        supportEncryption(): boolean
        isEncryptionKeySet(): boolean
        setEncryptionKey(uuid: string, mrskey: string, mac: string): void
        encryptMessage(messageData: string | Buffer): string
        decryptMessage(encryptedData: string | Buffer): Buffer
    }

    /**
     * Thermostat feature interface.
     *
     * Provides control over thermostat mode, temperature settings, and schedules.
     */
    export interface ThermostatFeature {
        set(options?: {
            channel?: number;
            mode?: number;
            onoff?: number;
            heatTemperature?: number;
            coolTemperature?: number;
            ecoTemperature?: number;
            manualTemperature?: number;
            partialUpdate?: boolean;
            state?: number;
            windowOpened?: boolean;
        }): Promise<any>
        get(options?: { channel?: number }): Promise<any>
        getSchedule(options?: { channel?: number }): Promise<any>
        getTimer(options?: { channel?: number }): Promise<any>
    }

    /**
     * Roller shutter feature interface.
     *
     * Provides control over roller shutter/blind position and movement.
     */
    export interface RollerShutterFeature {
        set(options: { channel?: number; position: number }): Promise<any>
        get(options?: { channel?: number }): Promise<RollerShutterState | undefined>
        open(options?: { channel?: number }): Promise<any>
        close(options?: { channel?: number }): Promise<any>
        stop(options?: { channel?: number }): Promise<any>
        getPosition(options?: { channel?: number }): Promise<any>
        getConfig(options?: { channel?: number }): Promise<any>
        setConfig(options: { config: any }): Promise<any>
    }

    /**
     * Garage door feature interface.
     *
     * Provides control over garage door open/close state and configuration.
     */
    export interface GarageFeature {
        set(options: { channel?: number; open: boolean }): Promise<any>
        get(options?: { channel?: number }): Promise<GarageDoorState | undefined>
        isOpen(options?: { channel?: number }): boolean | undefined
        isClosed(options?: { channel?: number }): boolean | undefined
        open(options?: { channel?: number }): Promise<any>
        close(options?: { channel?: number }): Promise<any>
        toggle(options?: { channel?: number }): Promise<any>
        getMultipleConfig(options?: { channel?: number }): Promise<any>
        getConfig(options?: { channel?: number }): Promise<any>
        setConfig(options: {
            configData?: any;
            signalDuration?: number;
            buzzerEnable?: boolean;
            doorOpenDuration?: number;
            doorCloseDuration?: number;
        }): Promise<any>
    }

    /**
     * Diffuser feature interface.
     *
     * Provides control over diffuser light and spray settings.
     */
    export interface DiffuserFeature {
        set(options?: {
            channel?: number;
            type?: 'light' | 'spray';
            on?: boolean;
            rgb?: [number, number, number] | { r: number; g: number; b: number } | number;
            luminance?: number;
            temperature?: number;
            mode?: number;
            gradual?: boolean | number;
        }): Promise<any>
        get(options?: { channel?: number; type?: 'light' | 'spray' }): Promise<any>
        getSensor(options?: { channel?: number }): Promise<any>
        setSensor(options: { channel?: number; sensorData: any }): Promise<any>
    }

    /**
     * Spray feature interface.
     *
     * Provides control over spray mode.
     */
    export interface SprayFeature {
        set(options: { channel?: number; mode: SprayMode | number }): Promise<any>
        get(options?: { channel?: number }): Promise<any>
        getMode(options?: { channel?: number }): number | undefined
        getRawMode(options?: { channel?: number }): number | undefined
    }

    /**
     * Consumption feature interface.
     *
     * Provides access to power consumption data.
     */
    export interface ConsumptionFeature {
        get(options?: { channel?: number }): Promise<Array<{date: Date, totalConsumptionKwh: number}>>
        getRaw(options?: { channel?: number }): Promise<any>
        getX(options?: { channel?: number }): Promise<Array<{date: Date, totalConsumptionKwh: number}>>
        getRawX(options?: { channel?: number }): Promise<any>
        getConfig(options?: { channel?: number }): Promise<any>
    }

    /**
     * Electricity feature interface.
     *
     * Provides access to real-time electricity metrics.
     */
    export interface ElectricityFeature {
        get(options?: { channel?: number }): Promise<{amperage: number, voltage: number, wattage: number, sampleTimestamp: Date}>
        getRaw(options?: { channel?: number }): Promise<any>
    }

    /**
     * Timer feature interface.
     *
     * Provides control over device timers.
     */
    export interface TimerFeature {
        set(options: {
            channel?: number;
            timerId?: string;
            alias?: string;
            time?: string;
            days?: string[];
            on?: boolean;
            enabled?: boolean;
            type?: number;
            timerx?: any;
        }): Promise<any>
        get(options?: { channel?: number; timerId?: string }): Promise<any>
        delete(options: { timerId: string; channel?: number }): Promise<any>
        findByAlias(options: { alias: string; channel?: number }): Promise<any>
        deleteByAlias(options: { alias: string; channel?: number }): Promise<any>
        enableByAlias(options: { alias: string; channel?: number }): Promise<any>
        disableByAlias(options: { alias: string; channel?: number }): Promise<any>
        deleteAll(options?: { channel?: number }): Promise<any>
    }

    /**
     * Trigger feature interface.
     *
     * Provides control over device triggers.
     */
    export interface TriggerFeature {
        set(options: {
            channel?: number;
            triggerId?: string;
            alias?: string;
            duration?: string;
            days?: string[];
            type?: number;
            enabled?: boolean;
            triggerx?: any;
        }): Promise<any>
        get(options?: { channel?: number }): Promise<any>
        delete(options: { triggerId: string; channel?: number }): Promise<any>
        findByAlias(options: { alias: string; channel?: number }): Promise<any>
        deleteByAlias(options: { alias: string; channel?: number }): Promise<any>
        enableByAlias(options: { alias: string; channel?: number }): Promise<any>
        disableByAlias(options: { alias: string; channel?: number }): Promise<any>
        deleteAll(options?: { channel?: number }): Promise<any>
    }

    /**
     * Presence sensor feature interface.
     *
     * Provides access to presence detection and light sensor data.
     */
    export interface PresenceSensorFeature {
        get(options?: { channel?: number; dataTypes?: string[] }): Promise<PresenceSensorState | undefined>
        getPresence(options?: { channel?: number }): { value: number; isPresent: boolean; state: number; distance: number; distanceRaw: number; timestamp: number; times: number } | null
        isPresent(options?: { channel?: number }): boolean | null
        getLight(options?: { channel?: number }): { value: number; timestamp: number } | null
        getAllSensorReadings(options?: { channel?: number }): { presence: Record<string, any> | null; light: Record<string, any> | null }
        getConfig(options?: { channel?: number }): Promise<any>
        setConfig(options: { configData: any }): Promise<any>
        getStudy(options?: { channel?: number }): Promise<any>
        setStudy(options: { studyData: any }): Promise<any>
    }

    /**
     * Alarm feature interface.
     *
     * Provides access to alarm events and status.
     */
    export interface AlarmFeature {
        get(options?: { channel?: number }): Promise<any>
        getLastEvents(options?: { channel?: number }): Array<{timestamp: number, type: string, data: any}>
    }

    /**
     * Child lock feature interface.
     *
     * Provides control over child lock settings.
     */
    export interface ChildLockFeature {
        set(options: { lockData: any }): Promise<any>
        get(): Promise<any>
    }

    /**
     * Screen feature interface.
     *
     * Provides control over device screen settings.
     */
    export interface ScreenFeature {
        set(options: { screenData: any }): Promise<any>
        get(): Promise<any>
    }

    /**
     * Runtime feature interface.
     *
     * Provides access to device runtime information.
     */
    export interface RuntimeFeature {
        get(): Promise<any>
        refreshState(): Promise<void>
    }

    /**
     * Config feature interface.
     *
     * Provides access to device configuration.
     */
    export interface ConfigFeature {
        set(options: { configData: any }): Promise<any>
        get(_options?: { channel?: number }): Promise<any>
    }

    /**
     * DND (Do Not Disturb) feature interface.
     *
     * Provides control over DND mode.
     */
    export interface DNDFeature {
        set(options: { mode: boolean | number }): Promise<any>
        get(_options?: { channel?: number }): Promise<any>
        getRaw(_options?: { channel?: number }): Promise<any>
    }

    /**
     * Temperature unit feature interface.
     *
     * Provides control over temperature unit settings.
     */
    export interface TempUnitFeature {
        set(options: { unit: number }): Promise<any>
        get(): Promise<any>
    }

    /**
     * Smoke config feature interface.
     *
     * Provides access to smoke sensor configuration.
     */
    export interface SmokeConfigFeature {
        set(options: { channel?: number; subId?: string; configData: any }): Promise<any>
        get(options?: { channel?: number; subId?: string }): Promise<any>
    }

    /**
     * Sensor history feature interface.
     *
     * Provides access to sensor history data.
     */
    export interface SensorHistoryFeature {
        get(options: { channel?: number; capacity: number }): Promise<any>
        delete(options: { channel?: number; capacity: number }): Promise<any>
    }

    /**
     * Digest timer feature interface.
     *
     * Provides access to timer digest information.
     */
    export interface DigestTimerFeature {
        get(): Promise<any>
    }

    /**
     * Digest trigger feature interface.
     *
     * Provides access to trigger digest information.
     */
    export interface DigestTriggerFeature {
        get(): Promise<any>
    }

    /**
     * Control feature interface.
     *
     * Provides various control functions.
     */
    export interface ControlFeature {
        setMultiple(options: { channel?: number; payload: any }): Promise<any>
        acknowledgeOverTemp(options: { channel?: number }): Promise<any>
        setUpgrade(options: { channel?: number; upgradeData: any }): Promise<any>
    }


    /**
     * Hub feature interface.
     *
     * Provides functionality for hub devices including sensor management and MTS100 thermostat control.
     */
    export interface HubFeature {
        refreshState(): Promise<void>
        getBattery(): Promise<any>
        /**
         * Controls a hub toggleX subdevice (on/off).
         * 
         * @param options - Toggle options
         * @param options.subId - Subdevice ID
         * @param options.on - True to turn on, false to turn off
         */
        setToggle(options: { subId: string; on: boolean }): Promise<any>
        getAllSensors(sensorIds?: string[]): Promise<any>
        getMts100All(options?: { ids?: string[] }): Promise<any>
        getException(): Promise<any>
        getLatestSensorReadings(options?: { sensorIds?: string[]; dataTypes?: string[] }): Promise<any>
    }

    /**
     * Represents a Meross device.
     * 
     * Provides methods to control and query Meross devices. Devices are automatically
     * initialized when the manager connects. This class extends EventEmitter and emits
     * events for device state changes and connection status.
     * 
     * @example
     * ```typescript
     * const device = manager.devices.get('device-uuid');
     * 
     * device.on('connected', () => {
     *   console.log('Device connected');
     * });
     * 
     * device.on('state', (event) => {
     *   if (event.type === 'toggle') {
     *     console.log('Toggle state changed:', event.value);
     *   }
     * });
     * 
     * await device.toggle.set({ on: true });
     * ```
     */
    export class MerossDevice extends EventEmitter {
        /**
         * Registers a handler for state events.
         * 
         * Unified event emitted for all device state changes (toggle, light, thermostat, etc.).
         * Use this instead of feature-specific events for consistent state handling.
         * 
         * @param event - Event name ('state')
         * @param listener - Callback function receiving state change event
         * @returns This instance for method chaining
         */
        on(event: 'state', listener: (event: {
            type: string;
            channel: number;
            value: any;
            source: string;
            timestamp: number;
        }) => void): this;
        
        /**
         * Registers a handler for connected events.
         * 
         * Emitted when the device successfully connects to MQTT.
         * 
         * @param event - Event name ('connected')
         * @param listener - Callback function
         * @returns This instance for method chaining
         */
        on(event: 'connected', listener: () => void): this;
        
        /**
         * Registers a handler for disconnected events.
         * 
         * Emitted when the device disconnects from MQTT, either intentionally or due to error.
         * 
         * @param event - Event name ('disconnected')
         * @param listener - Callback function receiving optional error message
         * @returns This instance for method chaining
         */
        on(event: 'disconnected', listener: (error?: string) => void): this;
        
        /**
         * Registers a handler for reconnected events.
         * 
         * Emitted when the MQTT connection is re-established after a disconnection.
         * 
         * @param event - Event name ('reconnected')
         * @param listener - Callback function
         * @returns This instance for method chaining
         */
        on(event: 'reconnected', listener: () => void): this;
        
        /**
         * Registers a handler for error events.
         * 
         * Emitted when device operations fail or communication errors occur.
         * 
         * @param event - Event name ('error')
         * @param listener - Callback function receiving the error
         * @returns This instance for method chaining
         */
        on(event: 'error', listener: (error: Error) => void): this;
        
        /**
         * Connects the device to MQTT.
         * 
         * @deprecated Devices are automatically connected by the manager. This method is kept for backward compatibility.
         */
        connect(): void
        
        /**
         * Disconnects the device from MQTT.
         * 
         * @param force - Whether to force immediate disconnect
         * @deprecated Use manager.disconnectAll() instead. This method is kept for backward compatibility.
         */
        disconnect(force: boolean): void

        /**
         * Sets a known local IP address for the device.
         * 
         * This helps the library use LAN HTTP communication when available.
         * 
         * @param ip - Local IP address (e.g., '192.168.1.100')
         */
        setKnownLocalIp(ip: string): void
        
        /**
         * Removes the known local IP address.
         * 
         * After removal, library will attempt to discover IP via mDNS or use MQTT only.
         */
        removeKnownLocalIp(): void

        /**
         * Checks if the device supports encryption.
         * 
         * Some newer devices require encryption for local communication.
         * 
         * @returns True if encryption is supported
         */
        supportEncryption(): boolean
        
        /**
         * Checks if an encryption key is set for this device.
         * 
         * Encryption key must be set before communicating with encrypted devices.
         * 
         * @returns True if encryption key is set
         */
        isEncryptionKeySet(): boolean
        
        /**
         * Sets the encryption key for this device.
         * 
         * Required for devices that support encryption. Key is typically obtained from
         * device discovery or Meross app. Without this key, encrypted devices cannot communicate.
         * 
         * @param uuid - Device UUID
         * @param mrskey - Encryption key
         * @param mac - MAC address
         */
        setEncryptionKey(uuid: string, mrskey: string, mac: string): void
        
        /**
         * Encrypts a message for this device.
         * 
         * @param messageData - Message data to encrypt
         * @returns Encrypted message string
         */
        encryptMessage(messageData: string | Buffer): string
        
        /**
         * Decrypts a message from this device.
         * 
         * @param encryptedData - Encrypted message data
         * @returns Decrypted message buffer
         */
        decryptMessage(encryptedData: string | Buffer): Buffer
        
        /**
         * Updates device abilities.
         * 
         * @param abilities - Abilities object containing supported features
         */
        updateAbilities(abilities: Record<string, any>): void
        
        /**
         * Updates the device MAC address.
         * 
         * @param mac - MAC address string
         */
        updateMacAddress(mac: string): void

        readonly macAddress: string | null
        readonly firmwareVersion: string
        readonly hardwareVersion: string
        readonly lanIp: string | null
        readonly mqttHost: string | null
        readonly mqttPort: number | null
        /** Device capabilities object containing supported features and namespaces */
        readonly abilities: Record<string, any> | null
        /** Unix timestamp of last full state refresh */
        readonly lastFullUpdateTimestamp: number | null
        /** Online status: 0=connecting, 1=online, 2=offline, -1=unknown, 3=upgrading */
        readonly onlineStatus: number
        readonly isOnline: boolean
        readonly internalId: string
        readonly channels: ChannelInfo[]
        /** Fallback MQTT domain used if primary domain fails */
        readonly reservedDomain: string | null
        readonly subType: string | null
        readonly bindTime: Date | null
        readonly skillNumber: string | null
        readonly userDevIcon: string | null
        readonly iconType: number | null
        readonly region: string | null
        readonly devIconId: string | null
        
        /**
         * Refreshes device state by querying the device.
         * 
         * Forces a fresh state fetch from the device, bypassing cache. Useful when
         * you need to ensure you have the latest state.
         * 
         * @param timeout - Optional timeout in milliseconds
         * @returns Promise that resolves when state is refreshed
         */
        refreshState(timeout?: number): Promise<void>
        
        /**
         * Feature objects for device control.
         * 
         * Each feature provides methods to control specific device capabilities.
         * Features are only available if the device supports them.
         */
        readonly system: SystemFeature
        readonly encryption: EncryptionFeature
        readonly toggle: ToggleFeature
        readonly light: LightFeature
        readonly thermostat: ThermostatFeature
        readonly rollerShutter: RollerShutterFeature
        readonly garage: GarageFeature
        readonly diffuser: DiffuserFeature
        readonly spray: SprayFeature
        readonly consumption: ConsumptionFeature
        readonly electricity: ElectricityFeature
        readonly timer: TimerFeature
        readonly trigger: TriggerFeature
        readonly presence: PresenceSensorFeature
        readonly alarm: AlarmFeature
        readonly childLock: ChildLockFeature
        readonly screen: ScreenFeature
        readonly runtime: RuntimeFeature
        readonly config: ConfigFeature
        readonly dnd: DNDFeature
        readonly tempUnit: TempUnitFeature
        readonly smokeConfig: SmokeConfigFeature
        readonly sensorHistory: SensorHistoryFeature
        readonly digestTimer: DigestTimerFeature
        readonly digestTrigger: DigestTriggerFeature
        readonly control: ControlFeature
        
        /**
         * Looks up channel information by ID or name.
         * 
         * Useful for finding channel details when you only have an index or name.
         * 
         * @param channelIdOrName - Channel index or name
         * @returns ChannelInfo instance
         * @throws {Error} If channel not found
         */
        lookupChannel(channelIdOrName: number | string): ChannelInfo
        
        /**
         * Updates device state from HTTP device info.
         * 
         * Called internally when device information is refreshed from the HTTP API.
         * Updates device metadata and connection information.
         * 
         * @param deviceInfo - HTTP device information
         * @returns Promise resolving to this device instance
         */
        updateFromHttpState(deviceInfo: HttpDeviceInfo): Promise<MerossDevice>

        /**
         * Publishes a message to the device.
         * 
         * Low-level method for sending raw messages. Typically not needed by users;
         * use feature methods (e.g., `toggle.set()`) instead.
         * 
         * @param method - Message method ('GET' or 'SET')
         * @param namespace - Namespace for the message
         * @param payload - Message payload
         * @returns Promise resolving to device response
         */
        publishMessage(method: 'GET' | 'SET', namespace: string, payload: any): Promise<any>
    }

    export class MerossSubDevice extends MerossDevice {
        /**
         * Registers a handler for subdevice notification events.
         * 
         * Emitted when the hub receives a notification specifically for this subdevice.
         * 
         * @param event - Event name ('subdeviceNotification')
         * @param listener - Callback function receiving namespace and data
         * @returns This instance for method chaining
         */
        on(event: 'subdeviceNotification', listener: (namespace: string, data: any) => void): this;
        /**
         * Registers a handler for state events.
         * 
         * Unified event for all device state changes (toggle, light, thermostat, etc.).
         * 
         * @param event - Event name ('state')
         * @param listener - Callback function receiving state change event
         * @returns This instance for method chaining
         */
        on(event: 'state', listener: (event: {
            type: string;
            channel: number;
            value: any;
            source: string;
            timestamp: number;
        }) => void): this;
        /**
         * Registers a handler for connected events.
         * 
         * @param event - Event name ('connected')
         * @param listener - Callback function
         * @returns This instance for method chaining
         */
        on(event: 'connected', listener: () => void): this;
        /**
         * Registers a handler for disconnected events.
         * 
         * @param event - Event name ('disconnected')
         * @param listener - Callback function receiving optional error
         * @returns This instance for method chaining
         */
        on(event: 'disconnected', listener: (error?: string) => void): this;
        /**
         * Registers a handler for reconnected events.
         * 
         * Emitted when the MQTT connection is re-established after a disconnection.
         * 
         * @param event - Event name ('reconnected')
         * @param listener - Callback function
         * @returns This instance for method chaining
         */
        on(event: 'reconnected', listener: () => void): this;
        /**
         * Registers a handler for error events.
         * 
         * @param event - Event name ('error')
         * @param listener - Callback function receiving the error
         * @returns This instance for method chaining
         */
        on(event: 'error', listener: (error: Error) => void): this;
        
        readonly subdeviceId: string
        readonly hub: MerossHubDevice
        readonly type: string
        readonly name: string
        handleSubdeviceNotification(namespace: string, data: any): Promise<void>
    }

    export class HubTempHumSensor extends MerossSubDevice {
        getLastSampledTemperature(): number | null
        getLastSampledHumidity(): number | null
        getLastSampledTime(): Date | null
        getMinSupportedTemperature(): number | null
        getMaxSupportedTemperature(): number | null
        getLux(): number | null
    }

    export class HubThermostatValve extends MerossSubDevice {
        /**
         * Note: This class inherits a `toggle` property (ToggleFeature) from MerossDevice.
         * The runtime implementation also has a `toggle()` convenience method, but it's not
         * available in TypeScript due to the property/method conflict. Use `toggle.set()` instead.
         */
        isOn(): boolean
        getMode(): number | undefined
        setMode(mode: number): Promise<void>
        getTargetTemperature(): number | null
        setTargetTemperature(temperature: number): Promise<void>
        getLastSampledTemperature(): number | null
        getMinSupportedTemperature(): number | null
        getMaxSupportedTemperature(): number | null
        isHeating(): boolean
        isWindowOpen(): boolean
        getSupportedPresets(): string[]
        getPresetTemperature(preset: string): number | null
        setPresetTemperature(preset: string, temperature: number): Promise<void>
        getAdjust(): number | null
        setAdjust(temperature: number): Promise<void>
    }

    export class HubWaterLeakSensor extends MerossSubDevice {
        isLeaking(): boolean | null
        getLatestSampleTime(): number | null
        getLatestDetectedWaterLeakTs(): number | null
        getLastEvents(): Array<{ leaking: boolean, timestamp: number }>
    }

    export class HubSmokeDetector extends MerossSubDevice {
        getSmokeAlarmStatus(): number | null
        getInterConnStatus(): number | null
        getLastStatusUpdate(): number | null
        muteAlarm(muteSmoke?: boolean): Promise<any>
        getTestEvents(): Array<{ type: number, timestamp: number }>
        refreshAlarmStatus(): Promise<any>
    }

    export class MerossHubDevice extends MerossDevice {
        /**
         * Hub feature for hub-specific functionality.
         */
        readonly hub: HubFeature
        
        getSubdevices(): MerossSubDevice[]
        getSubdevice(subdeviceId: string): MerossSubDevice | null
        registerSubdevice(subdevice: MerossSubDevice): void
        getHubBattery(): Promise<any>
        getHubSubdeviceList(): Promise<any>
        getHubOnline(): Promise<any>
        getHubException(): Promise<any>
        getHubReport(): Promise<any>
        setHubPairSubDev(): Promise<any>
        setHubSubDeviceBeep(subIds: string | string[], onoff: boolean): Promise<any>
        getHubSubDeviceBeep(subIds: string | string[]): Promise<any>
        getHubSubDeviceMotorAdjust(subIds: string | string[]): Promise<any>
        setHubSubDeviceMotorAdjust(adjustData: any): Promise<any>
        getHubSubDeviceVersion(subIds?: string[]): Promise<any>
        getAllSensors(sensorIds: string[] | string): Promise<any>
        getLatestHubSensorReadings(sensorIds: string[] | string, dataTypes?: string[]): Promise<any>
        getTempHumSensor(sensorIds: string[] | string): Promise<any>
        getAlertSensor(sensorIds: string[] | string): Promise<any>
        getSmokeAlarmStatus(sensorIds: string[] | string): Promise<any>
        getWaterLeakSensor(sensorIds: string[] | string): Promise<any>
        getHubSensorAdjust(sensorIds?: string[]): Promise<any>
        setHubSensorAdjust(adjustData: any): Promise<any>
        getHubSensorDoorWindow(sensorIds?: string[]): Promise<any>
        setHubSensorDoorWindow(doorWindowData: any): Promise<any>
        getMts100All(ids: string[] | string): Promise<any>
        setHubToggleX(subId: string, onoff: boolean): Promise<any>
        setHubMts100Mode(subId: string, mode: number): Promise<any>
        setHubMts100Temperature(subId: string, temp: any): Promise<any>
        setHubMts100Adjust(subId: string, adjustData: any): Promise<any>
        getMts100Adjust(ids: string[] | string): Promise<any>
        getMts100SuperCtl(ids: string[] | string): Promise<any>
        getMts100ScheduleB(ids: string[] | string): Promise<any>
        getMts100Config(ids: string[] | string): Promise<any>
    }

    /**
     * Base error class for all Meross errors.
     * 
     * All library-specific errors extend this class to enable instanceof checks
     * and consistent error handling throughout the library.
     */
    export class MerossError extends Error {
        /** String identifier for the error type */
        code: string
        /** API error code (if available) */
        errorCode: number | null
        /** Whether this is an operational (recoverable) error */
        isOperational: boolean
        /** The underlying error that caused this error (error chaining) */
        cause?: Error | null
        constructor(message: string, errorCode?: number | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        /** Returns a JSON-serializable representation of the error */
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
        }
    }

    /**
     * HTTP API error.
     * 
     * Thrown when an HTTP request to the Meross API fails or returns an error response.
     */
    export class MerossErrorHttpApi extends MerossError {
        /** HTTP status code (if available) */
        httpStatusCode: number | null
        constructor(message?: string, errorCode?: number | null, httpStatusCode?: number | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            httpStatusCode?: number
        }
    }

    /**
     * Authentication error.
     * 
     * Thrown when authentication fails due to invalid credentials or account issues.
     */
    export class MerossErrorAuthentication extends MerossError {
        constructor(message?: string, errorCode?: number, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * MFA required error.
     * 
     * Thrown when multi-factor authentication is required but not provided.
     */
    export class MerossErrorMFARequired extends MerossErrorAuthentication {
        constructor(message?: string, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * Missing MFA error.
     * 
     * Thrown when MFA is required but the code was not provided.
     */
    export class MerossErrorMissingMFA extends MerossErrorMFARequired {
        constructor(message?: string, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * Wrong MFA error.
     * 
     * Thrown when an incorrect MFA code is provided.
     */
    export class MerossErrorWrongMFA extends MerossErrorAuthentication {
        constructor(message?: string, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * Token expired error.
     * 
     * Thrown when the authentication token has expired and needs to be refreshed.
     */
    export class MerossErrorTokenExpired extends MerossError {
        constructor(message?: string, errorCode?: number, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * Too many tokens error.
     * 
     * Thrown when the maximum number of active tokens has been reached.
     */
    export class MerossErrorTooManyTokens extends MerossError {
        constructor(message?: string, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * Unauthorized error.
     * 
     * Thrown when authentication is required but not provided or invalid.
     */
    export class MerossErrorUnauthorized extends MerossErrorHttpApi {
        constructor(message?: string, errorCode?: number | null, httpStatusCode?: number, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * Bad domain error.
     * 
     * Thrown when the API or MQTT domain is incorrect or unreachable.
     */
    export class MerossErrorBadDomain extends MerossError {
        /** API domain that failed */
        apiDomain: string | null
        /** MQTT domain that failed */
        mqttDomain: string | null
        constructor(message?: string, apiDomain?: string | null, mqttDomain?: string | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            apiDomain?: string
            mqttDomain?: string
        }
    }

    /**
     * API limit reached error.
     * 
     * Thrown when the API rate limit has been exceeded.
     */
    export class MerossErrorApiLimitReached extends MerossError {
        constructor(message?: string, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * Resource access denied error.
     * 
     * Thrown when access to a resource is denied due to insufficient permissions.
     */
    export class MerossErrorResourceAccessDenied extends MerossError {
        constructor(message?: string, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * Command timeout error.
     * 
     * Thrown when a device command doesn't receive a response within the timeout period.
     */
    export class MerossErrorCommandTimeout extends MerossError {
        /** UUID of the device that timed out */
        deviceUuid: string | null
        /** Timeout duration in milliseconds */
        timeout: number | null
        /** Command information */
        command: any
        constructor(message?: string, deviceUuid?: string | null, timeout?: number | null, command?: any, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            deviceUuid?: string
            timeout?: number
            command?: any
        }
    }

    /**
     * Command error.
     * 
     * Thrown when a device command fails and the device returns an error response.
     */
    export class MerossErrorCommand extends MerossError {
        /** Error payload from device response */
        errorPayload: any
        /** UUID of the device that returned the error */
        deviceUuid: string | null
        constructor(message?: string, errorPayload?: any, deviceUuid?: string | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            errorPayload?: any
            deviceUuid?: string
        }
    }

    /**
     * MQTT error.
     * 
     * Thrown when MQTT connection or communication fails.
     */
    export class MerossErrorMqtt extends MerossError {
        /** MQTT topic related to the error */
        topic: string | null
        /** MQTT message related to the error */
        mqttMessage: any
        constructor(message?: string, topic?: string | null, mqttMessage?: any, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            topic?: string
            mqttMessage?: any
        }
    }

    /**
     * Unconnected error.
     * 
     * Thrown when attempting to send a command to a device that is not connected.
     */
    export class MerossErrorUnconnected extends MerossError {
        /** UUID of the device that is not connected */
        deviceUuid: string | null
        constructor(message?: string, deviceUuid?: string | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            deviceUuid?: string
        }
    }

    /**
     * Unknown device type error.
     * 
     * Thrown when a device operation is attempted on a device type that doesn't support it.
     */
    export class MerossErrorUnknownDeviceType extends MerossError {
        /** Device type that is unsupported */
        deviceType: string | null
        constructor(message?: string, deviceType?: string | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            deviceType?: string
        }
    }

    /**
     * Validation error.
     * 
     * Thrown when function arguments are invalid, missing required parameters,
     * or have incorrect types/values. Indicates a programming error.
     */
    export class MerossErrorValidation extends MerossError {
        /** The field/parameter that failed validation */
        field: string | null
        constructor(message?: string, field?: string | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            field?: string
        }
    }

    /**
     * Resource not found error.
     * 
     * Thrown when a requested resource (device, channel, trigger, timer, etc.)
     * cannot be found. Indicates the resource doesn't exist or is not accessible.
     */
    export class MerossErrorNotFound extends MerossError {
        /** Type of resource that was not found (e.g., 'device', 'channel') */
        resourceType: string | null
        /** Identifier of the resource that was not found */
        resourceId: string | null
        constructor(message?: string, resourceType?: string | null, resourceId?: string | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            resourceType?: string
            resourceId?: string
        }
    }

    /**
     * Network/HTTP request timeout error.
     * 
     * Thrown when an HTTP or network request times out before receiving a response.
     * Different from CommandTimeoutError which is for device command timeouts.
     */
    export class MerossErrorNetworkTimeout extends MerossError {
        /** Timeout duration in milliseconds */
        timeout: number | null
        /** URL or endpoint that timed out */
        url: string | null
        constructor(message?: string, timeout?: number | null, url?: string | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            timeout?: number
            url?: string
        }
    }

    /**
     * Parse/serialization error.
     * 
     * Thrown when data parsing fails (e.g., JSON parsing, protocol parsing).
     * Indicates data corruption, protocol mismatch, or malformed data.
     */
    export class MerossErrorParse extends MerossError {
        /** The data that failed to parse */
        data: any
        /** The expected format (e.g., 'json', 'xml') */
        format: string | null
        constructor(message?: string, data?: any, format?: string | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            format?: string
        }
    }

    /**
     * Rate limit error (error code 1028).
     * 
     * Thrown when requests are made too frequently. Different from ApiLimitReachedError
     * (1042) which indicates the API top limit has been reached.
     */
    export class MerossErrorRateLimit extends MerossError {
        constructor(message?: string, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * Operation locked error (error code 1035).
     * 
     * Thrown when an operation is locked and cannot be performed at this time.
     * The operation may become available after a delay or when the lock is released.
     */
    export class MerossErrorOperationLocked extends MerossError {
        constructor(message?: string, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
    }

    /**
     * Unsupported operation error (error code 20112).
     * 
     * Thrown when an operation is not supported by the device, API, or current
     * configuration. Indicates the requested functionality is not available.
     */
    export class MerossErrorUnsupported extends MerossError {
        /** The operation that is unsupported */
        operation: string | null
        /** Reason why the operation is unsupported */
        reason: string | null
        constructor(message?: string, operation?: string | null, reason?: string | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            operation?: string
            reason?: string
        }
    }

    /**
     * Initialization error.
     * 
     * Thrown when device or component initialization fails. This may occur due to
     * network issues, missing dependencies, or configuration problems. May be
     * retryable in some cases.
     */
    export class MerossErrorInitialization extends MerossError {
        /** The component that failed to initialize */
        component: string | null
        /** Reason for initialization failure */
        reason: string | null
        constructor(message?: string, component?: string | null, reason?: string | null, options?: {
            code?: string
            isOperational?: boolean
            cause?: Error | null
        })
        toJSON(): {
            name: string
            code: string
            message: string
            errorCode?: number
            isOperational?: boolean
            component?: string
            reason?: string
        }
    }

    /**
     * Maps error codes to appropriate error classes.
     * 
     * Converts API error codes into specific error class instances based on the
     * error code value and context.
     * 
     * @param errorCode - The error code from API response
     * @param context - Additional context (info, deviceUuid, httpStatusCode, etc.)
     * @returns Appropriate error instance
     */
    export function mapErrorCodeToError(errorCode: number, context?: {
        info?: string
        deviceUuid?: string
        httpStatusCode?: number
        apiDomain?: string
        mqttDomain?: string
    }): MerossError

    export default ManagerMeross
}
