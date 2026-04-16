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
    }

    export interface TimerFeature {
        get(options?: { channel?: number; timerId?: string }): Promise<any>;
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

    export class MerossDevice extends EventEmitter {
        readonly uuid: string;
        readonly name: string;
        readonly deviceType: string;
        readonly onlineStatus: number;
        readonly deviceConnected: boolean;
        readonly toggle?: ToggleFeature;
        readonly timer?: TimerFeature;
        readonly trigger?: TriggerFeature;
        readonly [key: string]: any;
    }

    export class MerossSubDevice extends MerossDevice {}
    export class MerossHubDevice extends MerossDevice {
        getSubdevices(): MerossSubDevice[];
    }
    export class HubTempHumSensor extends MerossSubDevice {}
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

    export class ManagerMeross extends EventEmitter {
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
        }): Promise<ManagerMeross>;

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
        }): Promise<ManagerMeross>;

        /** Prefer {@link ManagerMeross.authenticate} or {@link ManagerMeross.connect}; the HTTP client is not part of the public API. */
        constructor(options: { httpClient: object });

        readonly devices: ManagerDevices;
        readonly transport: { defaultMode: number };
        readonly options: { logger?: Logger | null; [key: string]: any };
        readonly authenticated: boolean;
        timeout: number;
        transportMode: number;
        logger: Logger | null;

        connect(): Promise<number>;
        login(): Promise<number>;
        logout(): Promise<any>;
        disconnectAll(force?: boolean): void;
        getTokenData(): TokenData | null;
        enableStats(maxSamples?: number): void;
        disableStats(): void;
        getDebugInfo(): {
            getErrorBudget(deviceUuid: string): number;
            resetErrorBudget(deviceUuid: string): void;
            getMqttStats(timeWindowMs?: number): any;
            getHttpStats(timeWindowMs?: number): any;
            getDelayedMqttStats(timeWindowMs?: number): any;
            getDroppedMqttStats(timeWindowMs?: number): any;
            enableStats(maxStatsSamples?: number): void;
            disableStats(): void;
            isStatsEnabled(): boolean;
        };
    }

    export default ManagerMeross;
}
