'use strict';

const Manager = require('./base');
const { MEROSS_MQTT_DOMAIN } = require('../lib/api/constants');
const { generateClientAndAppId } = require('../lib/utilities/mqtt');
const { MerossAuthError, MerossDeviceError } = require('../lib/exception');

/**
 * Owns Meross cloud authentication and the Meross HTTP API client.
 *
 * @class ManagerAuth
 * @extends Manager
 */
class ManagerAuth extends Manager {
    /**
     * @param {import('../lib/meross')} meross - Root Meross instance
     * @param {import('../lib/api/client')} client - Meross cloud API client
     */
    constructor(meross, client) {
        super(meross);
        this._client = client;
        this.authenticated = false;
        this.mqttDomain = MEROSS_MQTT_DOMAIN;
        this.issuedOn = null;
    }

    /**
     * Creates an authenticated HTTP client from login or saved credentials.
     *
     * @static
     * @async
     * @param {Object} options - Authentication options
     * @returns {Promise<import('../lib/api/client')>}
     */
    static async createClient(options) {
        const normalizedOptions = options || {};
        const isPasswordAuth = !!(normalizedOptions.email && normalizedOptions.password);
        const isCredentialAuth = !!(normalizedOptions.token &&
            normalizedOptions.key &&
            normalizedOptions.userId &&
            normalizedOptions.domain);

        if (!isPasswordAuth && !isCredentialAuth) {
            throw new MerossDeviceError(
                'Provide either {email, password} or {token, key, userId, domain}',
                'VALIDATION_ERROR',
                { field: 'options' }
            );
        }

        const MerossApiClient = require('../lib/api/client');
        const httpClientOpts = {
            logger: normalizedOptions.logger
        };

        if (isPasswordAuth) {
            return MerossApiClient.fromUserPassword({
                email: normalizedOptions.email,
                password: normalizedOptions.password,
                mfaCode: normalizedOptions.mfaCode,
                ...httpClientOpts
            });
        }

        return MerossApiClient.fromCredentials({
            token: normalizedOptions.token,
            key: normalizedOptions.key,
            userId: normalizedOptions.userId,
            domain: normalizedOptions.domain,
            mqttDomain: normalizedOptions.mqttDomain
        }, httpClientOpts);
    }

    /**
     * Seeds manager session state from a client that may already hold credentials.
     *
     * Attaches statistics before MQTT seeding so early HTTP traffic is counted when
     * callers construct Meross with a pre-authenticated client.
     */
    initializeFromClient() {
        this.meross.statistics.attachHttpClient(this._client);
        if (this._client.token) {
            this.mqttDomain = this._client.mqttDomain || this.mqttDomain;
            this.authenticated = true;
            const { appId } = generateClientAndAppId();
            this.meross.mqtt.seedSession(this.userId, appId);
        }
    }

    /** @returns {import('../lib/api/client')} */
    get client() {
        return this._client;
    }

    get token() {
        return this._client.token || null;
    }

    get key() {
        return this._client.key || null;
    }

    get userId() {
        return this._client.userId || null;
    }

    get userEmail() {
        return this._client.userEmail || null;
    }

    get httpDomain() {
        return this._client.httpDomain || null;
    }

    /**
     * @returns {Object|null}
     */
    getTokenData() {
        if (!this.authenticated || !this.token) {
            return null;
        }
        return {
            token: this.token,
            key: this.key,
            userId: this.userId,
            userEmail: this.userEmail,
            domain: this.httpDomain,
            mqttDomain: this.mqttDomain,
            issuedOn: this.issuedOn || new Date().toISOString()
        };
    }

    /**
     * @async
     * @returns {Promise<Object|null>}
     */
    async logout() {
        if (!this.authenticated || !this.token) {
            throw new MerossAuthError('Not authenticated', 'AUTHENTICATION');
        }
        const response = await this._client.logout();
        this.authenticated = false;
        return response;
    }

    /**
     * Marks the session authenticated after device discovery succeeds.
     *
     * Separates credential presence (constructor) from a completed cloud connect
     * so logout and token export reflect an active session only after initialize().
     */
    markConnected() {
        this.authenticated = true;
    }
}

module.exports = ManagerAuth;
