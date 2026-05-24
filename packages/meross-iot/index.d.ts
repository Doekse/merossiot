declare module 'meross-iot' {
    import { EventEmitter } from 'events';

    type Logger = (message: string, ...args: any[]) => void;

    export type TransportMode =
        | 'mqtt'
        | 'lan-http-first'
        | 'lan-http-first-only-get';

    export type Connectivity =
        | 'online'
        | 'offline'
        | 'not-online'
        | 'upgrading'
        | 'unknown';

    export type ThermostatMode =
        | 'heat'
        | 'cool'
        | 'economy'
        | 'auto'
        | 'manual';

    export type ThermostatActivity =
        | 'idle'
        | 'heating';

    export type ThermostatModeBMode =
        | 'manual'
        | 'schedule'
        | 'timer';

    export type ThermostatModeBState =
        | 'working'
        | 'standby'
        | 'off';

    export type ThermostatModeBWorking =
        | 'heating'
        | 'cooling';

    export type ThermostatModeBOnOff =
        | 'open'
        | 'closed';

    export type ThermostatModeWarning =
        | 'valid'
        | 'failed';

    export type ThermostatSensorStatus =
        | 'valid'
        | 'invalid';

    export type Mts100Mode =
        | 'custom'
        | 'comfort'
        | 'economy'
        | 'schedule';

    export type Mts100V3Mode =
        | 'custom'
        | 'heat'
        | 'cool'
        | 'auto'
        | 'economy';

    export type DiffuserLightMode =
        | 'rotating-colors'
        | 'fixed-rgb'
        | 'fixed-luminance';

    export type DiffuserSprayMode =
        | 'light'
        | 'strong'
        | 'off';

    export type SprayMode =
        | 'off'
        | 'continuous'
        | 'intermittent';

    export type RollerShutterStatus =
        | 'idle'
        | 'opening'
        | 'closing'
        | 'unknown';

    export type RollerShutterStoppedBy =
        | 'completed'
        | 'manual'
        | 'overheated'
        | 'hall-stop'
        | 'reed-stop'
        | 'hall-failure'
        | 'reed-failure'
        | 'ntc-failure'
        | 'hall-recoil'
        | 'reed-recoil';

    export type RollerShutterCalibrationStatus =
        | 'success'
        | 'timeout'
        | 'stall'
        | 'value-too-large'
        | 'value-too-small'
        | 'hall-failure'
        | 'reed-failure'
        | 'not-calibrated';

    export type LightEffect =
        | 'none'
        | 'red-orange'
        | 'candle'
        | 'single-color-rhythm'
        | 'multi-color-breathing'
        | 'night-light-white'
        | 'yellow-night-light'
        | 'favorite'
        | 'full-light';

    export type PresenceState =
        | 'present'
        | 'absent'
        | 'unknown';

    export type TimerType =
        | 'single-point-weekly'
        | 'single-point-single-shot'
        | 'continuous-weekly'
        | 'continuous-single-shot'
        | 'auto-off'
        | 'countdown'
        | 'door-off'
        | 'door-notify';

    export type GarageDoorTimerType =
        | 'door-off'
        | 'door-notify';

    export type TriggerType =
        | 'single-point-weekly'
        | 'single-point-single-shot'
        | 'continuous-weekly'
        | 'continuous-single-shot';

    export type SmokeAlarmCondition =
        | 'safe'
        | 'alarming'
        | 'silenced'
        | 'fault'
        | 'unknown';

    export type SmokeAlarmChannel =
        | 'smoke'
        | 'temperature'
        | 'battery';

    export type DndMode =
        | 'off'
        | 'on';

    export type ContactState =
        | 'closed'
        | 'open';

    export type WaterLeakState =
        | 'dry'
        | 'leaking';

    export type GarageDoorOpen =
        | 'closed'
        | 'open';

    export type GarageDoorExecute =
        | 'not-executed'
        | 'executed';

    export type PhysicalLockState =
        | 'unlocked'
        | 'locked';

    export type TempUnit =
        | 'celsius'
        | 'fahrenheit';

    export type SmokeInterConn =
        | 'inactive'
        | 'active';

    export type SmokeTestType =
        | 'manual'
        | 'automatic';

    export type UpgradeStatus =
        | 'start-download'
        | 'success'
        | 'failed'
        | 'signing-failed';

    export type UpgradeTransferStatus =
        | 'pending-transfer'
        | 'transferring'
        | 'success'
        | 'failed';

    export type OverTempValue =
        | 'over-temp'
        | 'normal';

    export type OverTempType =
        | 'early-warning'
        | 'shutoff-relay';

    export type AlarmAction =
        | 'execute'
        | 'normal';

    export type AlarmScope =
        | 'local'
        | 'all-except-source'
        | 'all-including-source';

    export type NetType =
        | 'wifi'
        | 'ethernet';

    export type IotStatus =
        | 'connecting'
        | 'normal'
        | 'abnormal';

    interface AlarmEventField {
        action: AlarmAction;
        scope?: AlarmScope;
        time?: number;
        timestamp?: number;
    }

    interface AlarmEvent {
        channel?: number;
        subId?: string;
        event?: {
            interConn?: AlarmEventField;
            security?: AlarmEventField;
            maSecurity?: AlarmEventField;
        };
    }

    interface RuntimeInfo {
        signal?: number;
        netType?: NetType;
        iotStatus?: IotStatus;
        ssid?: string;
    }

    interface UpgradeSubdevTransfer {
        devid?: string;
        status?: UpgradeTransferStatus;
    }

    interface UpgradeInfo {
        status?: UpgradeStatus;
        percent?: number;
        subdev?: UpgradeSubdevTransfer[];
    }

    interface OverTempEvent {
        value?: OverTempValue;
        type?: OverTempType;
        timestamp?: number;
        enable?: number;
    }

    interface SmokeAlarmInterconnect {
        linkActive: boolean;
        raw: number;
    }

    /** Snapshot shape for `getState().smokeAlarm[channel]` and subscription `state` / `changes`. */
    interface SmokeAlarmState {
        condition: SmokeAlarmCondition;
        channel: SmokeAlarmChannel | null;
        interconnect: SmokeAlarmInterconnect | null;
        lastStatusUpdate: number | null;
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

    interface TokenData {
        token: string;
        key: string;
        userId: string;
        userEmail?: string;
        domain: string;
        mqttDomain: string;
        issuedOn?: string;
    }

    interface DeviceDefinition {
        uuid: string;
        connectivity: Connectivity;
        devName: string;
        deviceType: string;
        domain: string;
        channels: Array<{ channel?: number; [key: string]: any }>;
        [key: string]: any;
    }

    interface SubdeviceInfo {
        hubUuid: string;
        hubName: string;
        hubDeviceType: string;
        subdeviceId: string;
        subdeviceType: string;
        subdeviceName: string;
        [key: string]: any;
    }

    interface ToggleFeature {
        set(options: { on: boolean; channel?: number }): Promise<void>;
        get(options?: { channel?: number }): Promise<any>;
        isOn(options?: { channel?: number }): boolean | undefined;
        getAll(): Map<number, boolean>;
    }

    interface TimerCreateOptions {
        alias?: string;
        time?: string | Date | number;
        days?: Array<string | number> | number;
        on?: boolean;
        type?: TimerType;
        channel?: number;
        enabled?: boolean;
        repeat?: boolean;
        id?: string;
    }

    interface TriggerCreateOptions {
        alias?: string;
        type?: TriggerType;
        channel?: number;
        enabled?: boolean;
        [key: string]: any;
    }

    interface TimerFeature {
        get(options?: { channel?: number; timerId?: string }): Promise<any>;
        getAll(): Promise<any[]>;
        count(): Promise<number>;
        invalidateCache(options?: { channel?: number }): void;
        set(options?: TimerCreateOptions & Record<string, any>): Promise<any>;
        delete(options: { timerId: string; channel?: number }): Promise<any>;
        findTimerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        deleteTimerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        enableTimerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        disableTimerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        deleteAllTimers(options?: { channel?: number }): Promise<any[]>;
        timeToMinutes(time: string | Date | number): number;
        minutesToTime(minutes: number): string;
        daysToWeekMask(days: Array<string | number>, repeat?: boolean): number;
        createTimer(options?: TimerCreateOptions): Record<string, any>;
    }

    interface TriggerFeature {
        get(options?: { channel?: number }): Promise<any>;
        getAll(): Promise<any[]>;
        count(): Promise<number>;
        invalidateCache(options?: { channel?: number }): void;
        set(options?: TriggerCreateOptions & Record<string, any>): Promise<any>;
        delete(options: { triggerId: string; channel?: number }): Promise<any>;
        findTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        deleteTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        enableTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        disableTriggerByAlias(options: { alias: string; channel?: number }): Promise<any>;
        deleteAllTriggers(options?: { channel?: number }): Promise<any[]>;
        durationToSeconds(duration: string | number): number;
        secondsToDuration(seconds: number): string;
        createTrigger(options?: TriggerCreateOptions): Record<string, any>;
    }

    interface LightFeature {
        set(options?: {
            channel?: number;
            on?: boolean;
            rgb?: number[] | number | { r: number; g: number; b: number };
            luminance?: number;
            temperature?: number;
            effect?: LightEffect;
            gradual?: boolean | number;
        }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
        isOn(options?: { channel?: number }): boolean | undefined;
        getRgbColor(options?: { channel?: number }): number[] | undefined;
        getBrightness(options?: { channel?: number }): number | undefined;
        getTemperature(options?: { channel?: number }): number | undefined;
        supportsRgb(options?: { channel?: number }): boolean;
        supportsLuminance(options?: { channel?: number }): boolean;
        supportsTemperature(options?: { channel?: number }): boolean;
        supportsEffect(options?: { channel?: number }): boolean;
    }

    interface ThermostatSetOptions {
        channel?: number;
        onoff?: boolean | number | ThermostatModeBOnOff;
        mode?: ThermostatMode | ThermostatModeBMode;
        state?: ThermostatModeBState;
        working?: ThermostatModeBWorking;
        windowOpened?: boolean;
        [key: string]: any;
    }

    interface ThermostatFeature {
        set(options?: ThermostatSetOptions): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
        getSchedule(options?: { channel?: number }): Promise<any>;
        getTimer(options?: { channel?: number }): Promise<any>;
    }

    interface RollerShutterFeature {
        set(options: { channel?: number; position: number }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
        open(options?: { channel?: number }): Promise<any>;
        close(options?: { channel?: number }): Promise<any>;
        stop(options?: { channel?: number }): Promise<any>;
        getPosition(options?: Record<string, any>): Promise<any>;
        getConfig(options?: Record<string, any>): Promise<any>;
        setConfig(options: { config: any | any[] }): Promise<any>;
    }

    interface GarageFeature {
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

    interface ElectricityFeature {
        get(options?: { channel?: number }): Promise<any>;
        getRaw(options?: { channel?: number }): Promise<any>;
    }

    interface ConsumptionFeature {
        get(options?: { channel?: number }): Promise<any>;
        getConfig(): Promise<any>;
    }

    interface SprayFeature {
        set(options: { channel?: number; mode: SprayMode }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
        getMode(options?: { channel?: number }): SprayMode | undefined;
    }

    interface DiffuserLightSetOptions {
        channel?: number;
        onoff?: boolean | number;
        mode?: DiffuserLightMode;
        luminance?: number;
        rgb?: number;
    }

    interface DiffuserSetOptions {
        light?: DiffuserLightSetOptions;
        mode?: DiffuserSprayMode;
        channel?: number;
    }

    interface DiffuserFeature {
        set(options?: DiffuserSetOptions): Promise<any>;
        get(options?: { channel?: number; type?: 'light' | 'spray' }): Promise<any>;
        getLight(options?: { channel?: number }): Promise<any>;
        getSpray(options?: { channel?: number }): Promise<any>;
        getSensor(options?: Record<string, any>): Promise<any>;
        setSensor(options?: Record<string, any>): Promise<any>;
    }

    interface DeviceCapabilities {
        channels?: {
            ids: number[];
            count: number;
        };
        [key: string]: any;
    }

    interface PresenceFeature {
        get(options?: { channel?: number }): Promise<any>;
        getConfig(options?: { channel?: number }): Promise<any>;
        setConfig(options?: Record<string, any>): Promise<any>;
    }

    interface AlarmFeature {
        set(options?: {
            channel?: number;
            on?: boolean;
            action?: AlarmAction;
            duration?: number;
        }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
        getLastEvents(): AlarmEvent[];
    }

    interface RuntimeFeature {
        get(): Promise<RuntimeInfo>;
        getCached(): RuntimeInfo | null;
    }

    interface ScreenFeature {
        set(options?: Record<string, any>): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
    }

    interface DNDFeature {
        set(options?: {
            enabled?: boolean;
            mode?: DndMode;
        }): Promise<void>;
        get(options?: Record<string, any>): Promise<boolean>;
        getMode(): DndMode | null;
    }

    interface ChildLockFeature {
        set(options?: {
            channel?: number;
            lock?: number | boolean;
            onoff?: number;
            lockState?: PhysicalLockState;
            locked?: boolean;
            lockData?: object | object[];
            subId?: string;
        }): Promise<any>;
        get(options?: { channel?: number; subId?: string }): Promise<any>;
    }

    interface ConfigFeature {
        get(options?: Record<string, any>): Promise<{ overTemp?: OverTempEvent }>;
        set(options?: {
            enable?: boolean;
            type?: OverTempType | number;
        }): Promise<any>;
    }

    interface TempUnitFeature {
        set(options?: {
            channel?: number;
            tempUnit?: TempUnit | number;
            tempUnitData?: object | object[];
        }): Promise<any>;
        get(options?: { channel?: number }): Promise<any>;
    }

    interface SmokeConfigFeature {
        get(options?: { channel?: number }): Promise<any>;
        set(options?: { channel?: number; status: number }): Promise<any>;
    }

    interface SmokeAlarmFeature {
        get(options?: { sensorIds?: string | string[] }): Promise<any>;
        set(options?: { muteSmoke?: boolean; status?: number }): Promise<any>;
        mute(options?: { muteSmoke?: boolean }): Promise<any>;
        test(): Promise<any>;
        getStatus(): number | null;
        getCondition(): SmokeAlarmCondition;
        getChannel(): SmokeAlarmChannel | null;
        getInterconnect(): SmokeAlarmInterconnect | null;
        getInterConn(): number | null;
        getInterConnStatus(): SmokeInterConn | null;
        getLastStatusUpdate(): number | null;
        getTestEvents(): Array<{
            type: SmokeTestType;
            typeWire: number;
            timestamp: number;
        }>;
    }

    interface TempHumFeature {
        get(options?: { sensorIds?: string | string[] }): Promise<any>;
        getLastSampledTemperature(): number | null;
        getLastSampledHumidity(): number | null;
        getLastSampledTime(): Date | null;
        getMinSupportedTemperature(): number | null;
        getMaxSupportedTemperature(): number | null;
        getLux(): number | null;
    }

    interface SensorAlertFeature {
        get(options?: { sensorIds?: string | string[] }): Promise<any>;
        set(options?: { alertData?: object | object[]; temperature?: Array<Array<number>>; humidity?: Array<Array<number>> }): Promise<any>;
        getAlert(): Record<string, any>;
    }

    interface SensorAdjustFeature {
        get(options?: { sensorIds?: string | string[] }): Promise<any>;
        set(options?: { adjustData?: object | object[]; temperature?: number; humidity?: number; delta?: boolean }): Promise<any>;
        getAdjust(): Record<string, any>;
    }

    interface WaterLeakFeature {
        get(options?: { sensorIds?: string | string[] }): Promise<any>;
        isLeaking(): boolean | null;
        getLeakState(): WaterLeakState | null;
        getLatestSampleTime(): number | null;
        getLatestDetectedWaterLeakTs(): number | null;
        getLastEvents(): Array<{ leaking: boolean; timestamp: number }>;
    }

    interface DoorWindowFeature {
        get(options?: { sensorIds?: string | string[] }): Promise<any>;
        isOpen(): boolean | null;
        getContactState(): ContactState | null;
        getLatestLmTime(): number | null;
        getSamples(): Array<{ status: number; timestamp: number }>;
    }

    interface Mts100Feature {
        get(options?: { ids?: string[]; complete?: boolean }): Promise<any>;
        setSuperCtl(options: { enable?: number; level?: number; alert?: number; subId?: string; superCtlData?: object }): Promise<any>;
        setScheduleB(options: {
            subId?: string;
            scheduleData?: object;
            mon?: Array<Array<number>>;
            tue?: Array<Array<number>>;
            wed?: Array<Array<number>>;
            thu?: Array<Array<number>>;
            fri?: Array<Array<number>>;
            sat?: Array<Array<number>>;
            sun?: Array<Array<number>>;
        }): Promise<any>;
        setConfig(options: { subId?: string; configData?: object; pid?: object }): Promise<any>;
        setToggle(options: { on: boolean }): Promise<void>;
        toggle(): Promise<void>;
        setMode(options: { mode: Mts100Mode | Mts100V3Mode; subId?: string }): Promise<any>;
        setTargetTemperature(options: { temperature: number; subId?: string; temp?: object }): Promise<any>;
        setPresetTemperature(options: { preset: string; temperature: number }): Promise<void>;
        setAdjust(options: { temperature: number; subId?: string; adjustData?: object }): Promise<any>;
        isOn(): boolean;
        getMode(): Mts100Mode | Mts100V3Mode | undefined;
        getTargetTemperature(): number | null;
        getLastSampledTemperature(): number | null;
        getMinSupportedTemperature(): number | null;
        getMaxSupportedTemperature(): number | null;
        isHeating(): boolean;
        isWindowOpen(): boolean;
        getSupportedPresets(): string[];
        getPresetTemperature(preset: string): number | null;
        getAdjust(): number | null;
        getSuperCtl(): object | null;
        getScheduleB(): object | null;
        getConfig(): object | null;
    }

    interface SensorHistoryFeature {
        get(options?: { channel?: number }): Promise<any>;
    }

    interface SystemFeature {
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
        readonly connectivity: Connectivity;
        readonly isOnline: boolean;
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
        readonly smokeAlarm?: SmokeAlarmFeature;
        readonly tempHum?: TempHumFeature;
        readonly sensorAlert?: SensorAlertFeature;
        readonly sensorAdjust?: SensorAdjustFeature;
        readonly waterLeak?: WaterLeakFeature;
        readonly doorWindow?: DoorWindowFeature;
        readonly mts100?: Mts100Feature;
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

    interface ManagerDevices {
        get(identifier: string | { hubUuid: string; id: string }): MerossDevice | MerossHubDevice | MerossSubDevice | null;
        list(): Array<MerossDevice | MerossHubDevice | MerossSubDevice>;
        find(filters?: Record<string, any>): Array<MerossDevice | MerossHubDevice | MerossSubDevice>;
        discover(options?: { deviceTypes?: string[]; onlineOnly?: boolean; excludeHubs?: boolean }): Promise<DeviceDefinition[]>;
        discoverSubdevices(options?: { hubUuids?: string[]; subdeviceType?: string; onlineOnly?: boolean }): Promise<SubdeviceInfo[]>;
        initialize(options?: { uuids?: string[] }): Promise<number>;
        initializeDevice(
            identifier: string | { hubUuid: string; id: string },
        ): Promise<MerossDevice | MerossHubDevice | MerossSubDevice | null>;
        remove(identifier: string | { hubUuid: string; id: string }): Promise<boolean>;
    }

    interface ManagerSubscription extends EventEmitter {
        subscribe(device: MerossDevice, config?: Record<string, any>): void;
        unsubscribe(deviceUuid: string): void;
        subscribeToDeviceList(): void;
        unsubscribeFromDeviceList(): void;
        destroy(): void;
    }

    /** HTTP/MQTT diagnostics counters; enable only when needed to limit overhead. */
    interface ManagerStatistics {
        enable(maxSamples?: number): void;
        disable(): void;
        isEnabled(): boolean;
        getMqttStats(timeWindowMs?: number): any | null;
        getHttpStats(timeWindowMs?: number): any | null;
        getDelayedMqttStats(timeWindowMs?: number): any | null;
        getDroppedMqttStats(timeWindowMs?: number): any | null;
    }

    /** Public transport preferences on {@link Meross}. */
    interface ManagerTransport {
        defaultMode: TransportMode;
        readonly errorBudgetMaxErrors: number;
        readonly errorBudgetTimeWindow: number;
        getBudget(deviceUuid: string): number;
        resetBudget(deviceUuid: string): void;
        isOutOfBudget(deviceUuid: string): boolean;
    }

    interface ManagerAuth {
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

    interface ManagerMqttConnection {
        client?: { connected?: boolean; reconnecting?: boolean; options?: Record<string, any> };
        deviceList?: string[];
        [key: string]: any;
    }

    /** MQTT broker clients keyed by domain. */
    interface ManagerMqtt {
        readonly connections: Record<string, ManagerMqttConnection>;
        readonly clientResponseTopic: string | null;
        readonly mqttDomain: string;
        hasConnection(domain: string): boolean;
        getConnection(domain: string): ManagerMqttConnection | null;
        disconnectAll(force?: boolean): void;
    }

    export class Meross extends EventEmitter {
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
        logout(): Promise<any>;
        disconnectAll(force?: boolean): void;
        getTokenData(): TokenData | null;
    }

    export default Meross;
}
