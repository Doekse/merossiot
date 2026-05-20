declare module 'meross-iot' {
    import { EventEmitter } from 'events';

    export type Logger = (message: string, ...args: any[]) => void;

    export enum TransportMode {
        MQTT_ONLY = 0,
        LAN_HTTP_FIRST = 1,
        LAN_HTTP_FIRST_ONLY_GET = 2
    }

    export const OnlineStatus: {
        NOT_ONLINE: 0;
        ONLINE: 1;
        OFFLINE: 2;
        UNKNOWN: -1;
        UPGRADING: 3;
    };

    export enum ThermostatMode {
        HEAT = 0,
        COOL = 1,
        ECONOMY = 2,
        AUTO = 3,
        MANUAL = 4
    }

    export enum LightMode {
        MODE_RGB = 1,
        MODE_TEMPERATURE = 2,
        MODE_LUMINANCE = 4
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

    export const DNDMode: {
        DND_DISABLED: 0;
        DND_ENABLED: 1;
    };

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

    export class MerossError extends Error {
        readonly code: string;
        readonly errorCode: number | null;
        readonly isOperational: boolean;
        readonly cause: Error | null;
        toJSON(): Record<string, any>;
    }

    export class MerossAuthError extends MerossError {}
    export class MerossDeviceError extends MerossError {}
    export class MerossApiError extends MerossError {}
    export class MerossNetworkError extends MerossError {}

    export interface TokenData {
        token: string;
        key: string;
        userId: string;
        userEmail?: string;
        domain: string;
        mqttDomain: string;
        issuedOn?: string;
    }

    export interface DeviceDefinition {
        uuid: string;
        onlineStatus: number;
        devName: string;
        deviceType: string;
        domain: string;
        channels: Array<{ channel?: number; [key: string]: any }>;
        [key: string]: any;
    }

    export interface SubdeviceInfo {
        hubUuid: string;
        hubName: string;
        hubDeviceType: string;
        subdeviceId: string;
        subdeviceType: string;
        subdeviceName: string;
        [key: string]: any;
    }

    export interface ToggleFeature {
        set(options: { on: boolean; channel?: number }): Promise<void>;
        get(options?: { channel?: number }): Promise<any>;
        isOn(options?: { channel?: number }): boolean | undefined;
        getAll(): Map<number, boolean>;
    }

    export interface TimerFeature {
        get(options?: { channel?: number; timerId?: string }): Promise<any>;
        getAll(): Promise<any[]>;
        count(): Promise<number>;
        invalidateCache(options?: { channel?: number }): void;
        set(options?: any): Promise<any>;
        delete(options: { timerId: string; channel?: number }): Promise<any>;
        findTimerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        deleteTimerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        enableTimerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        disableTimerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        deleteAllTimers(options?: { channel?: number }): Promise<any[]>;
        timeToMinutes(time: string | Date | number): number;
        minutesToTime(minutes: number): string;
        daysToWeekMask(days: Array<string | number>, repeat?: boolean): number;
        createTimer(options?: Record<string, any>): Record<string, any>;
    }

    export interface TriggerFeature {
        get(options?: { channel?: number }): Promise<any>;
        getAll(): Promise<any[]>;
        count(): Promise<number>;
        invalidateCache(options?: { channel?: number }): void;
        set(options?: any): Promise<any>;
        delete(options: { triggerId: string; channel?: number }): Promise<any>;
        findTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        deleteTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        enableTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        disableTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        deleteAllTriggers(options?: { channel?: number }): Promise<any[]>;
        durationToSeconds(duration: string | number): number;
        secondsToDuration(seconds: number): string;
        createTrigger(options?: Record<string, any>): Record<string, any>;
    }

    export interface LightFeature {
        set(options?: { channel?: number; on?: boolean; rgb?: number[] | number | { r: number; g: number; b: number }; luminance?: number; temperature?: number; gradual?: boolean | number }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
        isOn(options?: { channel?: number }): boolean | undefined;
        getRgbColor(options?: { channel?: number }): number[] | undefined;
        getBrightness(options?: { channel?: number }): number | undefined;
        getTemperature(options?: { channel?: number }): number | undefined;
        supportsRgb(options?: { channel?: number }): boolean;
        supportsLuminance(options?: { channel?: number }): boolean;
        supportsTemperature(options?: { channel?: number }): boolean;
    }

    export interface ThermostatFeature {
        set(options?: Record<string, any>): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
        getSchedule(options?: { channel?: number }): Promise<any>;
        getTimer(options?: { channel?: number }): Promise<any>;
    }

    export interface RollerShutterFeature {
        set(options: { channel?: number; position: number }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
        open(options?: { channel?: number }): Promise<any>;
        close(options?: { channel?: number }): Promise<any>;
        stop(options?: { channel?: number }): Promise<any>;
        getPosition(options?: Record<string, any>): Promise<any>;
        getConfig(options?: Record<string, any>): Promise<any>;
        setConfig(options: { config: any | any[] }): Promise<any>;
    }

    export interface GarageFeature {
        set(options: { channel?: number; open: boolean }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
        isOpen(options?: { channel?: number }): boolean | undefined;
        isClosed(options?: { channel?: number }): boolean | undefined;
        open(options?: { channel?: number }): Promise<any>;
        close(options?: { channel?: number }): Promise<any>;
        toggle(options?: { channel?: number }): Promise<any>;
        getConfig(options?: Record<string, any>): Promise<any>;
        setConfig(options?: Record<string, any>): Promise<any>;
    }

    export interface ElectricityFeature {
        get(options?: { channel?: number }): Promise<any>;
        getRaw(options?: { channel?: number }): Promise<any>;
    }

    export interface ConsumptionFeature {
        get(options?: { channel?: number }): Promise<any>;
        getConfig(): Promise<any>;
    }

    export interface SprayFeature {
        set(options: { channel?: number; mode: number }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
        getMode(options?: { channel?: number }): number | null;
    }

    export interface DiffuserFeature {
        set(options?: Record<string, any>): Promise<any>;
        get(options?: { channel?: number; type?: 'light' | 'spray' }): Promise<any>;
        getLight(options?: { channel?: number }): Promise<any>;
        getSpray(options?: { channel?: number }): Promise<any>;
        getSensor(options?: Record<string, any>): Promise<any>;
        setSensor(options?: Record<string, any>): Promise<any>;
    }

    export interface DeviceCapabilities {
        channels?: {
            ids: number[];
            count: number;
        };
        [key: string]: any;
    }

    export interface PresenceFeature {
        get(options?: { channel?: number }): Promise<any>;
        getConfig(options?: { channel?: number }): Promise<any>;
        setConfig(options?: Record<string, any>): Promise<any>;
    }

    export interface AlarmFeature {
        get(options?: { channel?: number }): Promise<any>;
        getLastEvents(): any[];
    }

    export interface RuntimeFeature {
        get(): Promise<any>;
        getCached(): any;
    }

    export interface ScreenFeature {
        set(options?: Record<string, any>): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
    }

    export interface DNDFeature {
        set(options?: { mode?: number }): Promise<any>;
        get(options?: Record<string, any>): Promise<any>;
    }

    export interface ChildLockFeature {
        set(options?: { channel?: number; lock?: number | boolean }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
    }

    export interface ConfigFeature {
        get(options?: Record<string, any>): Promise<any>;
        set(options?: Record<string, any>): Promise<any>;
    }

    export interface TempUnitFeature {
        set(options?: { channel?: number; unit?: number }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
    }

    export interface SmokeConfigFeature {
        get(options?: { channel?: number }): Promise<any>;
        set(options?: { channel?: number; status: number }): Promise<any>;
    }

    export interface SensorHistoryFeature {
        get(options?: { channel?: number }): Promise<any>;
    }

    export interface SystemFeature {
        getAllData(): Promise<any>;
        getDebug(): Promise<any>;
        getAbilities(): Promise<any>;
        getEncryptSuite(): Promise<any>;
        getEncryptECDHE(): Promise<any>;
        getOnlineStatus(): Promise<any>;
        getConfigWifiList(): Promise<any>;
        getConfigTrace(): Promise<any>;
        getHardware(): Promise<any>;
        getFirmware(): Promise<any>;
        getTime(): Promise<any>;
        getPosition(): Promise<any>;
        getFactory(): Promise<any>;
        getLedMode(): Promise<any>;
        setLedMode(options: { mode: number }): Promise<any>;
        getMcuFirmware(): Promise<any>;
    }

    export class MerossDevice extends EventEmitter {
        readonly uuid: string;
        readonly name: string;
        readonly deviceType: string;
        readonly onlineStatus: number;
        readonly deviceConnected: boolean;
        readonly capabilities: DeviceCapabilities | null;
        getChannelIds(): number[];
        readonly toggle?: ToggleFeature;
        readonly light?: LightFeature;
        readonly thermostat?: ThermostatFeature;
        readonly rollerShutter?: RollerShutterFeature;
        readonly garage?: GarageFeature;
        readonly electricity?: ElectricityFeature;
        readonly consumption?: ConsumptionFeature;
        readonly spray?: SprayFeature;
        readonly diffuser?: DiffuserFeature;
        readonly presence?: PresenceFeature;
        readonly alarm?: AlarmFeature;
        readonly runtime?: RuntimeFeature;
        readonly screen?: ScreenFeature;
        readonly dnd?: DNDFeature;
        readonly childLock?: ChildLockFeature;
        readonly config?: ConfigFeature;
        readonly tempUnit?: TempUnitFeature;
        readonly smokeConfig?: SmokeConfigFeature;
        readonly sensorHistory?: SensorHistoryFeature;
        readonly system?: SystemFeature;
        readonly timer?: TimerFeature;
        readonly trigger?: TriggerFeature;
        readonly [key: string]: any;
    }

    export class MerossSubDevice extends MerossDevice {}
    export class MerossHubDevice extends MerossDevice {
        getSubdevices(): MerossSubDevice[];
    }
    export class HubTempHumSensor extends MerossSubDevice {}
    export class HubDoorWindowSensor extends MerossSubDevice {}
    export class HubThermostatValve extends MerossSubDevice {}
    export class HubWaterLeakSensor extends MerossSubDevice {}
    export class HubSmokeDetector extends MerossSubDevice {}

    export class ManagerDevices {
        get(identifier: string | { hubUuid: string; id: string }): MerossDevice | MerossHubDevice | MerossSubDevice | null;
        list(): Array<MerossDevice | MerossHubDevice | MerossSubDevice>;
        find(filters?: Record<string, any>): Array<MerossDevice | MerossHubDevice | MerossSubDevice>;
        discover(options?: { deviceTypes?: string[]; onlineOnly?: boolean; excludeHubs?: boolean }): Promise<DeviceDefinition[]>;
        discoverSubdevices(options?: { hubUuids?: string[]; subdeviceType?: string; onlineOnly?: boolean }): Promise<SubdeviceInfo[]>;
        initialize(options?: { uuids?: string[] }): Promise<number>;
        initializeDevice(identifier: string | { hubUuid: string; id: string }): Promise<MerossDevice | MerossHubDevice | MerossSubDevice | null>;
        remove(identifier: string | { hubUuid: string; id: string }): Promise<boolean>;
    }

    export interface ManagerSubscription extends EventEmitter {
        subscribe(device: MerossDevice, config?: Record<string, any>): void;
        unsubscribe(deviceUuid: string): void;
        subscribeToDeviceList(): void;
        unsubscribeFromDeviceList(): void;
        destroy(): void;
    }

    /** HTTP/MQTT diagnostics counters; enable only when needed to limit overhead. */
    export interface ManagerStatistics {
        enable(maxSamples?: number): void;
        disable(): void;
        isEnabled(): boolean;
        getMqttStats(timeWindowMs?: number): any | null;
        getHttpStats(timeWindowMs?: number): any | null;
        getDelayedMqttStats(timeWindowMs?: number): any | null;
        getDroppedMqttStats(timeWindowMs?: number): any | null;
    }

    /** Public transport preferences on {@link Meross}. */
    export interface ManagerTransport {
        defaultMode: number;
        readonly errorBudgetMaxErrors: number;
        readonly errorBudgetTimeWindow: number;
        getBudget(deviceUuid: string): number;
        resetBudget(deviceUuid: string): void;
        isOutOfBudget(deviceUuid: string): boolean;
    }

    export interface ManagerAuth {
        readonly token: string | null;
        readonly key: string | null;
        readonly userId: string | null;
        readonly userEmail: string | null;
        readonly httpDomain: string | null;
        readonly authenticated: boolean;
        readonly mqttDomain: string;
        getTokenData(): TokenData | null;
        logout(): Promise<any>;
    }

    export interface ManagerMqttConnection {
        client?: { connected?: boolean; reconnecting?: boolean; options?: Record<string, any> };
        deviceList?: string[];
        [key: string]: any;
    }

    /** MQTT broker clients keyed by domain. */
    export interface ManagerMqtt {
        readonly connections: Record<string, ManagerMqttConnection>;
        readonly clientResponseTopic: string | null;
        readonly mqttDomain: string;
        hasConnection(domain: string): boolean;
        getConnection(domain: string): ManagerMqttConnection | null;
        disconnectAll(force?: boolean): void;
    }

    export class Meross extends EventEmitter {
        /** Same enum as the named {@link TransportMode} export (attached for `Meross.TransportMode` usage). */
        static TransportMode: typeof TransportMode;

        static authenticate(options: {
            email?: string;
            password?: string;
            mfaCode?: string;
            token?: string;
            key?: string;
            userId?: string;
            domain?: string;
            mqttDomain?: string;
            logger?: Logger;
        }): Promise<Meross>;

        static connect(options: {
            email?: string;
            password?: string;
            mfaCode?: string;
            token?: string;
            key?: string;
            userId?: string;
            domain?: string;
            mqttDomain?: string;
            logger?: Logger;
        }): Promise<Meross>;

        /** Prefer {@link Meross.authenticate} or {@link Meross.connect}; the HTTP client is not part of the public API. */
        constructor(options: { httpClient: object });

        readonly auth: ManagerAuth;
        readonly devices: ManagerDevices;
        readonly mqtt: ManagerMqtt;
        readonly subscription: ManagerSubscription;
        readonly transport: ManagerTransport;
        readonly statistics: ManagerStatistics;
        readonly options: { logger?: Logger | null; [key: string]: any };
        readonly authenticated: boolean;
        readonly token: string | null;
        readonly key: string | null;
        readonly userId: string | null;
        readonly userEmail: string | null;
        readonly httpDomain: string | null;
        readonly mqttDomain: string;
        timeout: number;
        logger: Logger | null;

        connect(): Promise<number>;
        login(): Promise<number>;
        logout(): Promise<any>;
        disconnectAll(force?: boolean): void;
        getTokenData(): TokenData | null;
    }

    export default Meross;
}
