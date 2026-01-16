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
        /** Channel index (0 for master channel, 1-n for sub-channels) */
        channel?: number
        /** Channel name */
        deviceName?: string
        /** Whether this is the master channel */
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
        /** Unique device identifier */
        uuid: string
        /** Online status (0=connecting, 1=online, 2=offline, -1=unknown, 3=upgrading) */
        onlineStatus: number
        /** Device name */
        devName: string
        /** Device icon ID */
        devIconId: string
        /** Device bind time (Unix timestamp) */
        bindTime: number
        /** Device type identifier */
        deviceType: string
        /** Device subtype */
        subType: string
        /** Array of channel information */
        channels: ChannelData[]
        /** Device region */
        region: string
        /** Firmware version */
        fmwareVersion: string
        /** Hardware version */
        hdwareVersion: string
        /** User-defined device icon */
        userDevIcon: string
        /** Icon type */
        iconType: number
        /** Skill number */
        skillNumber: string
        /** API domain */
        domain: string
        /** Reserved domain */
        reservedDomain: string
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
        /** Channel index (0 for master channel, 1-n for sub-channels) */
        readonly index: number
        /** Channel name or null if not set */
        readonly name: string | null
        /** Whether this channel is a USB channel */
        readonly isUsb: boolean
        /** Whether this is the master channel */
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
        /** Unique device identifier */
        readonly uuid: string
        /** Device name */
        readonly devName: string
        /** Device type identifier */
        readonly deviceType: string
        /** Array of channel information */
        readonly channels: ChannelData[]
        /** Firmware version */
        readonly fmwareVersion: string
        /** Hardware version */
        readonly hdwareVersion: string
        /** API domain */
        readonly domain: string
        /** Reserved domain or null */
        readonly reservedDomain: string | null
        /** Device subtype or null */
        readonly subType: string | null
        /** Device bind time as Date or null */
        readonly bindTime: Date | null
        /** Skill number or null */
        readonly skillNumber: string | null
        /** User-defined device icon or null */
        readonly userDevIcon: string | null
        /** Icon type or null */
        readonly iconType: number | null
        /** Device region or null */
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
        RESPONSIVE: 0;
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
     * Used with MerossDevice.setLightColor() to control RGB lights.
     * 
     * @example
     * ```typescript
     * // Set RGB color
     * await device.setLightColor({
     *   channel: 0,
     *   rgb: [255, 0, 0], // Red
     *   luminance: 50,
     *   onoff: true
     * });
     * 
     * // Set color temperature
     * await device.setLightColor({
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

    export type DeviceInitializedCallback = (deviceId: string, deviceDef: DeviceDefinition, device: MerossDevice) => void

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
     * manager.on('deviceInitialized', (deviceId, deviceDef, device) => {
     *   console.log(`Device ${deviceId} initialized`);
     * });
     * 
     * const devices = manager.devices.list();
     * ```
     */
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
        
        /** Device registry instance for device lookups and queries */
        readonly devices: DeviceRegistry
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
     * Represents a Meross device.
     * 
     * Provides methods to control and query Meross devices. Devices are automatically
     * initialized when the manager connects. This class extends EventEmitter and emits
     * events for device state changes, push notifications, and connection status.
     * 
     * @example
     * ```typescript
     * const device = manager.devices.get('device-uuid');
     * 
     * device.on('connected', () => {
     *   console.log('Device connected');
     * });
     * 
     * device.on('pushNotification', (notification) => {
     *   if (notification instanceof ToggleXPushNotification) {
     *     console.log('Toggle state changed');
     *   }
     * });
     * 
     * await device.turnOn();
     * ```
     */
    export class MerossDevice extends EventEmitter {
        /**
         * Registers a handler for push notification events.
         * 
         * @param event - Event name ('pushNotification')
         * @param listener - Callback function receiving the notification
         * @returns This instance for method chaining
         */
        on(event: 'pushNotification', listener: (notification: GenericPushNotification) => void): this;
        
        /**
         * Registers a handler for data events.
         * 
         * @param event - Event name ('data')
         * @param listener - Callback function receiving namespace and payload
         * @returns This instance for method chaining
         */
        on(event: 'data', listener: (namespace: string, payload: Record<string, any>) => void): this;
        
        /**
         * Registers a handler for raw data events.
         * 
         * @param event - Event name ('rawData')
         * @param listener - Callback function receiving raw message
         * @returns This instance for method chaining
         */
        on(event: 'rawData', listener: (message: Record<string, any>) => void): this;
        
        /**
         * Registers a handler for connected events.
         * 
         * @param event - Event name ('connected')
         * @param listener - Callback function
         * @returns This instance for method chaining
         */
        on(event: 'connected', listener: () => void): this;
        
        /**
         * Registers a handler for close events.
         * 
         * @param event - Event name ('close')
         * @param listener - Callback function
         * @returns This instance for method chaining
         */
        on(event: 'close', listener: () => void): this;
        
        /**
         * Registers a handler for error events.
         * 
         * @param event - Event name ('error')
         * @param listener - Callback function receiving the error
         * @returns This instance for method chaining
         */
        on(event: 'error', listener: (error: Error) => void): this;
        
        /**
         * Registers a handler for online status change events.
         * 
         * @param event - Event name ('onlineStatusChange')
         * @param listener - Callback function receiving new and old status
         * @returns This instance for method chaining
         */
        on(event: 'onlineStatusChange', listener: (newStatus: number, oldStatus: number) => void): this;
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
         */
        removeKnownLocalIp(): void

        /**
         * Checks if the device supports encryption.
         * 
         * @returns True if encryption is supported
         */
        supportEncryption(): boolean
        
        /**
         * Checks if an encryption key is set for this device.
         * 
         * @returns True if encryption key is set
         */
        isEncryptionKeySet(): boolean
        
        /**
         * Sets the encryption key for this device.
         * 
         * Required for devices that support encryption.
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
        /** Device abilities object containing supported features and namespaces */
        readonly abilities: Record<string, any> | null
        readonly lastFullUpdateTimestamp: number | null
        readonly onlineStatus: number
        readonly isOnline: boolean
        readonly internalId: string
        readonly channels: ChannelInfo[]
        readonly cachedHttpInfo: HttpDeviceInfo | null

        /**
         * Validates the current device state.
         * 
         * @returns True if state is valid
         */
        validateState(): boolean
        
        /**
         * Refreshes device state by querying the device.
         * 
         * @param timeout - Optional timeout in milliseconds
         * @returns Promise that resolves when state is refreshed
         */
        refreshState(timeout?: number): Promise<void>
        
        /**
         * Looks up channel information by ID or name.
         * 
         * @param channelIdOrName - Channel index or name
         * @returns ChannelInfo instance
         * @throws {Error} If channel not found
         */
        lookupChannel(channelIdOrName: number | string): ChannelInfo
        
        /**
         * Updates device state from HTTP device info.
         * 
         * @param deviceInfo - HTTP device information
         * @returns Promise resolving to this device instance
         */
        updateFromHttpState(deviceInfo: HttpDeviceInfo): Promise<MerossDevice>

        /**
         * Publishes a message to the device.
         * 
         * @param method - Message method ('GET' or 'SET')
         * @param namespace - Namespace for the message
         * @param payload - Message payload
         * @returns Promise resolving to device response
         */
        publishMessage(method: 'GET' | 'SET', namespace: string, payload: any): Promise<any>

        getSystemAllData(): Promise<any>
        getSystemDebug(): Promise<any>
        getSystemAbilities(): Promise<any>
        getSystemRuntime(): Promise<any>
        getSystemDNDMode(): Promise<any>
        getEncryptSuite(): Promise<any>
        getEncryptECDHE(): Promise<any>
        getOnlineStatus(): Promise<any>
        getConfigWifiList(): Promise<any>
        getConfigTrace(): Promise<any>
        getControlPowerConsumption(options?: { channel?: number }): Promise<any>
        getControlPowerConsumptionX(options?: { channel?: number }): Promise<GetControlPowerConsumptionXResponse>
        getControlElectricity(options?: { channel?: number }): Promise<GetControlElectricityResponse>
        getPowerConsumption(options?: { channel?: number }): Promise<Array<{date: Date, totalConsumptionKwh: number}>>
        getPowerConsumptionX(options?: { channel?: number }): Promise<Array<{date: Date, totalConsumptionKwh: number}>>
        getRawPowerConsumption(options?: { channel?: number }): Promise<any>
        getRawPowerConsumptionX(options?: { channel?: number }): Promise<any>
        getElectricity(options?: { channel?: number }): Promise<{amperage: number, voltage: number, wattage: number, sampleTimestamp: Date}>
        getRawElectricity(options?: { channel?: number }): Promise<any>
        getTimerX(options?: { channel?: number; timerId?: string }): Promise<any>
        setTimerX(options: { channel?: number; alias?: string; time?: string; days?: string[]; on?: boolean; enabled?: boolean; type?: number; timerx?: any }): Promise<any>
        deleteTimerX(options: { timerId: string; channel?: number }): Promise<any>
        findTimerByAlias(options: { alias: string; channel?: number }): Promise<any>
        deleteTimerByAlias(options: { alias: string; channel?: number }): Promise<any>
        enableTimerByAlias(options: { alias: string; channel?: number }): Promise<any>
        disableTimerByAlias(options: { alias: string; channel?: number }): Promise<any>
        deleteAllTimers(options?: { channel?: number }): Promise<any>
        getTriggerX(options?: { channel?: number }): Promise<any>
        deleteTriggerX(options: { triggerId: string; channel?: number }): Promise<any>
        findTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>
        deleteTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>
        enableTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>
        disableTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>
        deleteAllTriggers(options?: { channel?: number }): Promise<any>
        getSmokeConfig(options?: { channel?: number; subId?: string }): Promise<any>
        getSensorHistory(options: { channel?: number; capacity: number }): Promise<any>
        getThermostatSchedule(options?: { channel?: number }): Promise<any>
        getThermostatTimer(options?: { channel?: number }): Promise<any>
        getAlarmStatus(options?: { channel?: number }): Promise<any>
        getRollerShutterState(): Promise<any>
        getRollerShutterPosition(): Promise<any>
        getRollerShutterConfig(): Promise<any>
        getFilterMaintenance(): Promise<any>
        getPhysicalLockState(): Promise<any>
        getFanState(): Promise<any>

        setToggle(onoff: boolean): Promise<any>
        setToggleX(options: { channel?: number; onoff: boolean }): Promise<any>
        controlBind(payload: any): Promise<any>
        controlUnbind(payload: any): Promise<any>
        controlTrigger(channel: number, payload: any): Promise<any>
        setTriggerX(options: { channel?: number; alias?: string; duration?: string; days?: string[]; type?: number; enabled?: boolean; triggerx?: any }): Promise<any>
        setSpray(options: { channel?: number; mode: SprayMode | number }): Promise<any>
        getSprayState(): Promise<any>
        getCachedSprayState(channel?: number): SprayState | undefined
        getCurrentSprayMode(channel?: number): number | undefined
        setRollerShutterPosition(options: { channel?: number; position: number }): Promise<any>
        setRollerShutterUp(options?: { channel?: number }): Promise<any>
        setRollerShutterDown(options?: { channel?: number }): Promise<any>
        setRollerShutterStop(options?: { channel?: number }): Promise<any>
        openRollerShutter(options?: { channel?: number }): Promise<any>
        closeRollerShutter(options?: { channel?: number }): Promise<any>
        stopRollerShutter(options?: { channel?: number }): Promise<any>
        getCachedRollerShutterState(channel?: number): RollerShutterState | undefined
        getRollerShutterState(options?: { channel?: number }): Promise<any>
        getRollerShutterPosition(options?: { channel?: number }): Promise<any>
        getRollerShutterConfig(options?: { channel?: number }): Promise<any>
        setGarageDoor(options: { channel?: number; open: boolean }): Promise<any>
        getGarageDoorState(options?: { channel?: number }): Promise<any>
        getGarageDoorMultipleState(): Promise<any>
        getCachedGarageDoorState(channel?: number): GarageDoorState | undefined
        isGarageDoorOpened(channel?: number): boolean | undefined
        isGarageDoorClosed(channel?: number): boolean | undefined
        getGarageDoorConfig(options?: { channel?: number }): Promise<any>
        openGarageDoor(options?: { channel?: number }): Promise<any>
        closeGarageDoor(options?: { channel?: number }): Promise<any>
        toggleGarageDoor(options?: { channel?: number }): Promise<any>
        setLight(light: LightData): Promise<any>
        getLightState(options?: { channel?: number }): Promise<any>
        getCachedLightState(channel?: number): LightState | undefined
        getLightIsOn(channel?: number): boolean | undefined
        getLightRgbColor(channel?: number): [number, number, number] | undefined
        getLightBrightness(channel?: number): number | undefined
        getLightTemperature(channel?: number): number | undefined
        getLightMode(channel?: number): number | undefined
        getSupportsRgb(channel?: number): boolean
        getSupportsLuminance(channel?: number): boolean
        getSupportsTemperature(channel?: number): boolean
        /**
         * Turns the device on.
         * 
         * @param options - Optional channel specification
         * @returns Promise resolving to device response
         * 
         * @example
         * ```typescript
         * await device.turnOn();
         * await device.turnOn({ channel: 1 });
         * ```
         */
        turnOn(options?: { channel?: number }): Promise<any>
        
        /**
         * Turns the device off.
         * 
         * @param options - Optional channel specification
         * @returns Promise resolving to device response
         * 
         * @example
         * ```typescript
         * await device.turnOff();
         * await device.turnOff({ channel: 1 });
         * ```
         */
        turnOff(options?: { channel?: number }): Promise<any>
        
        /**
         * Sets the light color, brightness, and/or temperature.
         * 
         * @param options - Light color options
         * @returns Promise resolving to device response
         * 
         * @example
         * ```typescript
         * await device.setLightColor({
         *   channel: 0,
         *   rgb: [255, 0, 0], // Red
         *   luminance: 50,
         *   onoff: true
         * });
         * ```
         */
        setLightColor(options?: LightColorOptions): Promise<any>
        setDiffuserSpray(options: { channel?: number; mode: number }): Promise<any>
        setDiffuserLight(light: LightData): Promise<any>
        getDiffuserLightState(options?: { channel?: number }): Promise<any>
        getDiffuserSprayState(options?: { channel?: number }): Promise<any>
        getCachedDiffuserLightState(channel?: number): DiffuserLightState | undefined
        getDiffuserLightMode(channel?: number): number | undefined
        getDiffuserLightBrightness(channel?: number): number | undefined
        getDiffuserLightRgbColor(channel?: number): [number, number, number] | undefined
        getDiffuserLightIsOn(channel?: number): boolean | undefined
        getCachedDiffuserSprayState(channel?: number): DiffuserSprayState | undefined
        getDiffuserSprayMode(channel?: number): number | undefined
        getCurrentSprayMode(channel?: number): number | undefined
        setThermostatMode(options: { channel?: number; partialUpdate?: boolean; mode?: number; onoff?: number; heatTemperature?: number; coolTemperature?: number; ecoTemperature?: number; manualTemperature?: number }): Promise<any>
        setThermostatModeB(options: { channel?: number; state?: number }): Promise<any>
        setThermostatWindowOpened(options: { channel?: number; windowOpened: boolean }): Promise<any>
        getThermostatMode(options?: { channel?: number }): Promise<any>
        getThermostatModeB(options?: { channel?: number }): Promise<any>
        getThermostatWindowOpened(options?: { channel?: number }): Promise<any>
        getCachedThermostatState(channel?: number): ThermostatState | undefined
        getCachedThermostatModeBState(channel?: number): ThermostatState | undefined
        setChildLock(options: { lockData: any }): Promise<any>
        controlFan(channel: number, speed: number, maxSpeed: number): Promise<any>
        setDNDMode(options: { mode: boolean | number }): Promise<any>
        getCachedPresenceSensorState(channel?: number): PresenceSensorState | undefined
        getCachedToggleState(channel?: number): ToggleState | undefined
        getPresence(channel?: number): { value: number; isPresent: boolean; state: number; distance: number; distanceRaw: number; timestamp: number; times: number } | null
        getLight(channel?: number): { value: number; timestamp: number } | null
        getAllSensorReadings(channel?: number): { presence: Record<string, any> | null; light: Record<string, any> | null }
        getPresenceConfig(options?: { channel?: number }): Promise<any>
        setPresenceConfig(options: { channel?: number; partialUpdate?: boolean; configData?: any; mode?: any; sensitivity?: any; distance?: any; noBodyTime?: any; mthx?: any }): Promise<any>
        getPresenceStudy(options?: { channel?: number }): Promise<any>
        setPresenceStudy(options: { channel?: number; partialUpdate?: boolean; studyData?: any }): Promise<any>
        getLatestSensorReadings(options?: { dataTypes?: string[] }): Promise<any>
    }

    export class MerossSubDevice extends MerossDevice {
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
        isOn(): boolean
        turnOn(): Promise<void>
        turnOff(): Promise<void>
        toggle(): Promise<void>
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
        /** API error code (if available) */
        errorCode: number | null
        constructor(message: string, errorCode?: number | null)
    }

    /**
     * HTTP API error.
     * 
     * Thrown when an HTTP request to the Meross API fails or returns an error response.
     */
    export class HttpApiError extends MerossError {
        /** HTTP status code (if available) */
        httpStatusCode: number | null
        constructor(message?: string, errorCode?: number | null, httpStatusCode?: number | null)
    }

    /**
     * Authentication error.
     * 
     * Thrown when authentication fails due to invalid credentials or account issues.
     */
    export class AuthenticationError extends MerossError {
        constructor(message?: string, errorCode?: number)
    }

    /**
     * MFA required error.
     * 
     * Thrown when multi-factor authentication is required but not provided.
     */
    export class MFARequiredError extends AuthenticationError {
        constructor(message?: string)
    }

    /**
     * Missing MFA error.
     * 
     * Thrown when MFA is required but the code was not provided.
     */
    export class MissingMFAError extends MFARequiredError {
        constructor(message?: string)
    }

    /**
     * Wrong MFA error.
     * 
     * Thrown when an incorrect MFA code is provided.
     */
    export class WrongMFAError extends AuthenticationError {
        constructor(message?: string)
    }

    /**
     * Token expired error.
     * 
     * Thrown when the authentication token has expired and needs to be refreshed.
     */
    export class TokenExpiredError extends MerossError {
        constructor(message?: string, errorCode?: number)
    }

    /**
     * Too many tokens error.
     * 
     * Thrown when the maximum number of active tokens has been reached.
     */
    export class TooManyTokensError extends MerossError {
        constructor(message?: string)
    }

    /**
     * Unauthorized error.
     * 
     * Thrown when authentication is required but not provided or invalid.
     */
    export class UnauthorizedError extends HttpApiError {
        constructor(message?: string, errorCode?: number | null, httpStatusCode?: number)
    }

    /**
     * Bad domain error.
     * 
     * Thrown when the API or MQTT domain is incorrect or unreachable.
     */
    export class BadDomainError extends MerossError {
        /** API domain that failed */
        apiDomain: string | null
        /** MQTT domain that failed */
        mqttDomain: string | null
        constructor(message?: string, apiDomain?: string | null, mqttDomain?: string | null)
    }

    /**
     * API limit reached error.
     * 
     * Thrown when the API rate limit has been exceeded.
     */
    export class ApiLimitReachedError extends MerossError {
        constructor(message?: string)
    }

    /**
     * Resource access denied error.
     * 
     * Thrown when access to a resource is denied due to insufficient permissions.
     */
    export class ResourceAccessDeniedError extends MerossError {
        constructor(message?: string)
    }

    /**
     * Command timeout error.
     * 
     * Thrown when a device command doesn't receive a response within the timeout period.
     */
    export class CommandTimeoutError extends MerossError {
        /** UUID of the device that timed out */
        deviceUuid: string | null
        /** Timeout duration in milliseconds */
        timeout: number | null
        /** Command information */
        command: any
        constructor(message?: string, deviceUuid?: string | null, timeout?: number | null, command?: any)
    }

    /**
     * Command error.
     * 
     * Thrown when a device command fails and the device returns an error response.
     */
    export class CommandError extends MerossError {
        /** Error payload from device response */
        errorPayload: any
        /** UUID of the device that returned the error */
        deviceUuid: string | null
        constructor(message?: string, errorPayload?: any, deviceUuid?: string | null)
    }

    /**
     * MQTT error.
     * 
     * Thrown when MQTT connection or communication fails.
     */
    export class MqttError extends MerossError {
        /** MQTT topic related to the error */
        topic: string | null
        /** MQTT message related to the error */
        mqttMessage: any
        constructor(message?: string, topic?: string | null, mqttMessage?: any)
    }

    /**
     * Unconnected error.
     * 
     * Thrown when attempting to send a command to a device that is not connected.
     */
    export class UnconnectedError extends MerossError {
        /** UUID of the device that is not connected */
        deviceUuid: string | null
        constructor(message?: string, deviceUuid?: string | null)
    }

    /**
     * Unknown device type error.
     * 
     * Thrown when a device operation is attempted on a device type that doesn't support it.
     */
    export class UnknownDeviceTypeError extends MerossError {
        /** Device type that is unsupported */
        deviceType: string | null
        constructor(message?: string, deviceType?: string | null)
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
