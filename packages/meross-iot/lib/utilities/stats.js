'use strict';

/**
 * Represents a single HTTP request sample captured for statistics tracking.
 *
 * Stores immutable data about a single HTTP request made to the Meross API,
 * including the URL, HTTP method, response codes, and timestamp. Samples are
 * collected over time and aggregated to provide usage statistics.
 *
 * @class HttpRequestSample
 */
class HttpRequestSample {
    /**
     * Creates a new HTTP request sample.
     *
     * @param {string} url - The URL that was requested (e.g., 'https://iot.meross.com/v1/Profile/login')
     * @param {string} method - HTTP method used (e.g., 'GET', 'POST', 'PUT', 'DELETE')
     * @param {number} httpResponseCode - HTTP response status code (e.g., 200, 404, 500)
     * @param {number|null} apiResponseCode - Meross API response code (0 for success, or error code). Can be null if not applicable.
     * @param {number} [timestamp] - Timestamp in milliseconds when the request was made. Defaults to current time if not provided.
     */
    constructor(url, method, httpResponseCode, apiResponseCode, timestamp) {
        this._url = url;
        this._method = method;
        this._httpResponseCode = httpResponseCode;
        this._apiResponseCode = apiResponseCode;
        this._timestamp = timestamp || Date.now();
    }

    /**
     * Gets the URL that was requested.
     *
     * @returns {string} The request URL
     */
    get url() {
        return this._url;
    }

    /**
     * Gets the HTTP method used for the request.
     *
     * @returns {string} The HTTP method
     */
    get method() {
        return this._method;
    }

    /**
     * Gets the HTTP response status code.
     *
     * @returns {number} The HTTP status code
     */
    get httpResponseCode() {
        return this._httpResponseCode;
    }

    /**
     * Gets the Meross API response code.
     *
     * @returns {number|null} The API response code (0 for success, or error code). Returns null if not applicable.
     */
    get apiResponseCode() {
        return this._apiResponseCode;
    }

    /**
     * Gets the timestamp when the request was made.
     *
     * @returns {number} Timestamp in milliseconds since Unix epoch
     */
    get timestamp() {
        return this._timestamp;
    }
}

/**
 * Aggregates HTTP statistics for a single URL or globally.
 *
 * This class collects and aggregates multiple HTTP request samples, providing
 * counts by HTTP response codes and Meross API response codes.
 *
 * @class HttpStat
 */
class HttpStat {
    /**
     * Creates a new HTTP statistics aggregator.
     */
    constructor() {
        this._totalApiCalls = 0;
        this._byHttpResponseCode = {};
        this._byApiResponseCode = {};
    }

    /**
     * Adds a sample to the statistics aggregation.
     *
     * Aggregates counts by HTTP response code and API response code to enable
     * analysis of error patterns and success rates.
     *
     * @param {HttpRequestSample} sample - The HTTP request sample to add
     */
    add(sample) {
        this._totalApiCalls += 1;

        if (!this._byHttpResponseCode[sample.httpResponseCode]) {
            this._byHttpResponseCode[sample.httpResponseCode] = 0;
        }
        this._byHttpResponseCode[sample.httpResponseCode] += 1;

        const apiCode = sample.apiResponseCode !== null && sample.apiResponseCode !== undefined
            ? sample.apiResponseCode
            : 'null';
        if (!this._byApiResponseCode[apiCode]) {
            this._byApiResponseCode[apiCode] = 0;
        }
        this._byApiResponseCode[apiCode] += 1;
    }

    /**
     * Gets the total number of API calls aggregated.
     *
     * @returns {number} Total number of calls
     */
    get totalCalls() {
        return this._totalApiCalls;
    }

    /**
     * Gets statistics grouped by HTTP response code.
     *
     * @returns {Array<[string, number]>} Array of [HTTP status code, count] pairs
     */
    byHttpResponseCode() {
        return Object.entries(this._byHttpResponseCode);
    }

    /**
     * Gets statistics grouped by Meross API response code.
     *
     * @returns {Array<[string, number]>} Array of [API response code, count] pairs
     */
    byApiStatusCode() {
        return Object.entries(this._byApiResponseCode);
    }
}

/**
 * Aggregates HTTP statistics results across multiple URLs.
 *
 * This class provides both global statistics (across all URLs) and per-URL statistics,
 * allowing you to analyze HTTP request patterns both globally and by specific endpoint.
 *
 * @class HttpStatsResult
 */
class HttpStatsResult {
    /**
     * Creates a new HTTP statistics result aggregator.
     */
    constructor() {
        this._global = new HttpStat();
        this._byUrl = {};
    }

    /**
     * Adds a sample to both global and per-URL statistics.
     *
     * @param {HttpRequestSample} sample - The HTTP request sample to add
     */
    add(sample) {
        this._global.add(sample);

        const { url } = sample;
        if (!this._byUrl[url]) {
            this._byUrl[url] = new HttpStat();
        }
        this._byUrl[url].add(sample);
    }

    /**
     * Gets the global statistics aggregated across all URLs.
     *
     * @returns {HttpStat} Global HTTP statistics
     */
    get globalStats() {
        return this._global;
    }

    /**
     * Gets statistics for a specific URL.
     *
     * @param {string} url - The URL to get statistics for
     * @returns {HttpStat|null} Statistics for the URL, or null if no requests were made to that URL
     */
    statsByUrl(url) {
        return this._byUrl[url] || null;
    }

    /**
     * Gets all URLs with their associated statistics.
     *
     * @returns {Array<[string, HttpStat]>} Array of [URL, HttpStat] pairs
     */
    deviceStats() {
        return Object.entries(this._byUrl);
    }
}

/**
 * Counter for tracking HTTP request statistics over time.
 *
 * This class maintains a rolling window of HTTP request samples and provides
 * methods to query statistics for specific time windows. Samples are automatically
 * pruned when the maximum sample count is exceeded, keeping only the most recent samples.
 *
 * @class HttpStatsCounter
 */
class HttpStatsCounter {
    /**
     * Creates a new HTTP statistics counter.
     *
     * @param {number} [maxSamples=1000] - Maximum number of samples to keep in memory.
     *                                     When exceeded, oldest samples are removed.
     *                                     Defaults to 1000 samples.
     */
    constructor(maxSamples = 1000) {
        this._maxSamples = maxSamples;
        this._samples = [];
    }

    /**
     * Notifies the counter of an HTTP request that was made.
     *
     * Records request details for statistical analysis. Samples are automatically
     * pruned when the maximum count is exceeded to prevent unbounded memory growth.
     *
     * Errors during statistics collection are silently caught to avoid disrupting
     * normal operation.
     *
     * @param {string} requestUrl - The URL that was requested (e.g., 'https://iot.meross.com/v1/Profile/login')
     * @param {string} method - HTTP method used (e.g., 'GET', 'POST', 'PUT', 'DELETE')
     * @param {number} httpResponseCode - HTTP response status code (e.g., 200, 404, 500)
     * @param {number|null} apiResponseCode - Meross API response code (0 for success, or error code).
     *                                        Can be null if not applicable.
     */
    notifyHttpRequest(requestUrl, method, httpResponseCode, apiResponseCode) {
        try {
            const sample = new HttpRequestSample(
                requestUrl,
                method,
                httpResponseCode,
                apiResponseCode,
                Date.now()
            );

            this._samples.push(sample);

            if (this._samples.length > this._maxSamples) {
                this._samples.shift();
            }
        } catch (error) {
            // Statistics collection failures should not disrupt normal operation
        }
    }

    /**
     * Gets aggregated statistics for requests within a specified time window.
     *
     * Filters samples to include only those within the specified time window (from now
     * going back `timeWindowMs` milliseconds) and returns aggregated statistics. The
     * time window is calculated from the current time backwards.
     *
     * Iterates backwards through chronologically ordered samples for efficiency, breaking
     * early when encountering samples outside the time window.
     *
     * @param {number} [timeWindowMs=60000] - Time window in milliseconds. Defaults to 60000 (1 minute).
     *                                        Use 3600000 for 1 hour, 86400000 for 24 hours, etc.
     * @returns {HttpStatsResult} Aggregated statistics for the time window, including:
     *                          - Global statistics across all URLs
     *                          - Per-URL statistics
     */
    getStats(timeWindowMs = 60000) {
        const result = new HttpStatsResult();
        const lowerLimit = Date.now() - timeWindowMs;

        for (let i = this._samples.length - 1; i >= 0; i--) {
            const sample = this._samples[i];
            if (sample.timestamp > lowerLimit) {
                result.add(sample);
            } else {
                break;
            }
        }

        return result;
    }
}

/**
 * Represents a single MQTT API call sample captured for statistics tracking.
 *
 * This class stores immutable data about a single MQTT message sent to a Meross device,
 * including the device UUID, namespace, method, and timestamp.
 *
 * @class ApiCallSample
 */
class ApiCallSample {
    /**
     * Creates a new MQTT API call sample.
     *
     * @param {string} deviceUuid - The UUID of the device the message was sent to
     * @param {string} namespace - The namespace of the message (e.g., 'Appliance.System.All', 'Appliance.Control.ToggleX')
     * @param {string} method - The method used (e.g., 'GET', 'SET', 'PUSH')
     * @param {number} [timestamp] - Timestamp in milliseconds when the message was sent. Defaults to current time if not provided.
     */
    constructor(deviceUuid, namespace, method, timestamp) {
        this._deviceUuid = deviceUuid;
        this._namespace = namespace;
        this._method = method;
        this._timestamp = timestamp || Date.now();
    }

    /**
     * Gets the UUID of the device the message was sent to.
     *
     * @returns {string} The device UUID
     */
    get deviceUuid() {
        return this._deviceUuid;
    }

    /**
     * Gets the namespace of the message.
     *
     * @returns {string} The namespace
     */
    get namespace() {
        return this._namespace;
    }

    /**
     * Gets the method used for the message.
     *
     * @returns {string} The method
     */
    get method() {
        return this._method;
    }

    /**
     * Gets the timestamp when the message was sent.
     *
     * @returns {number} Timestamp in milliseconds since Unix epoch
     */
    get timestamp() {
        return this._timestamp;
    }
}

/**
 * Aggregates API statistics for a single device or globally.
 *
 * This class collects and aggregates multiple MQTT API call samples, providing
 * counts by method and namespace combinations.
 *
 * @class ApiStat
 */
class ApiStat {
    /**
     * Creates a new API statistics aggregator.
     */
    constructor() {
        this._totalApiCalls = 0;
        this._byMethodNamespace = {};
    }

    /**
     * Adds a sample to the statistics aggregation.
     *
     * Aggregates counts by method and namespace combination to enable analysis
     * of which API operations are most frequently used.
     *
     * @param {ApiCallSample} sample - The API call sample to add
     */
    add(sample) {
        this._totalApiCalls += 1;

        const methodNs = `${sample.method} ${sample.namespace}`;
        if (!this._byMethodNamespace[methodNs]) {
            this._byMethodNamespace[methodNs] = 0;
        }
        this._byMethodNamespace[methodNs] += 1;
    }

    /**
     * Gets the total number of API calls aggregated.
     *
     * @returns {number} Total number of calls
     */
    get totalCalls() {
        return this._totalApiCalls;
    }

    /**
     * Gets statistics grouped by method and namespace combination.
     *
     * @returns {Array<[string, number]>} Array of [method namespace, count] pairs
     */
    byMethodNamespace() {
        return Object.entries(this._byMethodNamespace);
    }
}

/**
 * Aggregates API statistics results across multiple devices.
 *
 * This class provides both global statistics (across all devices) and per-device statistics,
 * allowing you to analyze MQTT message patterns both globally and by specific device.
 *
 * @class ApiStatsResult
 */
class ApiStatsResult {
    /**
     * Creates a new API statistics result aggregator.
     */
    constructor() {
        this._global = new ApiStat();
        this._byUuid = {};
    }

    /**
     * Adds a sample to both global and per-device statistics.
     *
     * @param {ApiCallSample} sample - The API call sample to add
     */
    add(sample) {
        this._global.add(sample);

        const uuid = sample.deviceUuid;
        if (!this._byUuid[uuid]) {
            this._byUuid[uuid] = new ApiStat();
        }
        this._byUuid[uuid].add(sample);
    }

    /**
     * Gets the global statistics aggregated across all devices.
     *
     * @returns {ApiStat} Global API statistics
     */
    get globalStats() {
        return this._global;
    }

    /**
     * Gets statistics for a specific device.
     *
     * @param {string} deviceUuid - The device UUID to get statistics for
     * @returns {ApiStat|null} Statistics for the device, or null if no messages were sent to that device
     */
    statsByUuid(deviceUuid) {
        return this._byUuid[deviceUuid] || null;
    }

    /**
     * Gets all devices with their associated statistics.
     *
     * @returns {Array<[string, ApiStat]>} Array of [device UUID, ApiStat] pairs
     */
    deviceStats() {
        return Object.entries(this._byUuid);
    }
}

/**
 * Counter for tracking MQTT message statistics over time.
 *
 * This class maintains rolling windows of MQTT API call samples and provides
 * methods to query statistics for specific time windows. It tracks three types of calls:
 * - **Sent calls**: API calls that were successfully sent
 * - **Delayed calls**: API calls that were delayed (e.g., due to rate limiting)
 * - **Dropped calls**: API calls that were dropped (e.g., due to queue overflow)
 *
 * Samples are automatically pruned when the maximum sample count is exceeded,
 * keeping only the most recent samples.
 *
 * @class MqttStatsCounter
 */
class MqttStatsCounter {
    /**
     * Creates a new MQTT statistics counter.
     *
     * @param {number} [maxSamples=1000] - Maximum number of samples to keep in memory per category
     *                                    (sent, delayed, dropped). When exceeded, oldest samples are removed.
     *                                    Defaults to 1000 samples per category.
     */
    constructor(maxSamples = 1000) {
        this._maxSamples = maxSamples;
        this.apiCalls = [];
        this.delayedCalls = [];
        this.droppedCalls = [];
    }

    /**
     * Notifies the counter of an API call that was successfully sent.
     *
     * Records call details for statistical analysis. Samples are automatically
     * pruned when the maximum count is exceeded to prevent unbounded memory growth.
     *
     * Errors during statistics collection are silently caught to avoid disrupting
     * normal operation.
     *
     * @param {string} deviceUuid - The UUID of the device the message was sent to
     * @param {string} namespace - The namespace of the message (e.g., 'Appliance.System.All', 'Appliance.Control.ToggleX')
     * @param {string} method - The method used (e.g., 'GET', 'SET', 'PUSH')
     */
    notifyApiCall(deviceUuid, namespace, method) {
        try {
            const sample = new ApiCallSample(deviceUuid, namespace, method, Date.now());
            this._addSample(this.apiCalls, sample);
        } catch (error) {
            // Statistics collection failures should not disrupt normal operation
        }
    }

    /**
     * Notifies the counter of an API call that was delayed.
     *
     * Delayed calls occur when rate limiting or queue management postpones a call
     * rather than sending it immediately. Records call details for analysis of
     * system performance and bottlenecks.
     *
     * Samples are automatically pruned when the maximum count is exceeded to prevent
     * unbounded memory growth. Errors during statistics collection are silently caught
     * to avoid disrupting normal operation.
     *
     * @param {string} deviceUuid - The UUID of the device the message was intended for
     * @param {string} namespace - The namespace of the message (e.g., 'Appliance.System.All', 'Appliance.Control.ToggleX')
     * @param {string} method - The method used (e.g., 'GET', 'SET', 'PUSH')
     */
    notifyDelayedCall(deviceUuid, namespace, method) {
        try {
            const sample = new ApiCallSample(deviceUuid, namespace, method, Date.now());
            this._addSample(this.delayedCalls, sample);
        } catch (error) {
            // Statistics collection failures should not disrupt normal operation
        }
    }

    /**
     * Notifies the counter of an API call that was dropped.
     *
     * Dropped calls occur when the message queue is full or when a call cannot be
     * processed and must be discarded. Records call details for analysis of system
     * capacity and potential queue overflow issues.
     *
     * Samples are automatically pruned when the maximum count is exceeded to prevent
     * unbounded memory growth. Errors during statistics collection are silently caught
     * to avoid disrupting normal operation.
     *
     * @param {string} deviceUuid - The UUID of the device the message was intended for
     * @param {string} namespace - The namespace of the message (e.g., 'Appliance.System.All', 'Appliance.Control.ToggleX')
     * @param {string} method - The method used (e.g., 'GET', 'SET', 'PUSH')
     */
    notifyDroppedCall(deviceUuid, namespace, method) {
        try {
            const sample = new ApiCallSample(deviceUuid, namespace, method, Date.now());
            this._addSample(this.droppedCalls, sample);
        } catch (error) {
            // Statistics collection failures should not disrupt normal operation
        }
    }

    /**
     * Internal helper to add a sample to an array while maintaining max samples limit.
     *
     * Removes oldest samples when the limit is exceeded to prevent unbounded memory growth.
     *
     * @private
     * @param {Array<ApiCallSample>} array - The array to add the sample to
     * @param {ApiCallSample} sample - The sample to add
     */
    _addSample(array, sample) {
        array.push(sample);
        if (array.length > this._maxSamples) {
            array.shift();
        }
    }

    /**
     * Gets aggregated statistics for successfully sent API calls within a specified time window.
     *
     * Filters samples to include only those within the specified time window (from now
     * going back `timeWindowMs` milliseconds) and returns aggregated statistics. The
     * time window is calculated from the current time backwards.
     *
     * Iterates backwards through chronologically ordered samples for efficiency, breaking
     * early when encountering samples outside the time window.
     *
     * @param {number} [timeWindowMs=60000] - Time window in milliseconds. Defaults to 60000 (1 minute).
     *                                        Use 3600000 for 1 hour, 86400000 for 24 hours, etc.
     * @returns {ApiStatsResult} Aggregated statistics for sent calls in the time window, including:
     *                          - Global statistics across all devices
     *                          - Per-device statistics
     */
    getApiStats(timeWindowMs = 60000) {
        return this._getStats(this.apiCalls, timeWindowMs);
    }

    /**
     * Gets aggregated statistics for delayed API calls within a specified time window.
     *
     * Filters samples to include only those within the specified time window (from now
     * going back `timeWindowMs` milliseconds) and returns aggregated statistics. The
     * time window is calculated from the current time backwards.
     *
     * Iterates backwards through chronologically ordered samples for efficiency, breaking
     * early when encountering samples outside the time window.
     *
     * @param {number} [timeWindowMs=60000] - Time window in milliseconds. Defaults to 60000 (1 minute).
     *                                        Use 3600000 for 1 hour, 86400000 for 24 hours, etc.
     * @returns {ApiStatsResult} Aggregated statistics for delayed calls in the time window, including:
     *                          - Global statistics across all devices
     *                          - Per-device statistics
     */
    getDelayedApiStats(timeWindowMs = 60000) {
        return this._getStats(this.delayedCalls, timeWindowMs);
    }

    /**
     * Gets aggregated statistics for dropped API calls within a specified time window.
     *
     * Filters samples to include only those within the specified time window (from now
     * going back `timeWindowMs` milliseconds) and returns aggregated statistics. The
     * time window is calculated from the current time backwards.
     *
     * Iterates backwards through chronologically ordered samples for efficiency, breaking
     * early when encountering samples outside the time window.
     *
     * @param {number} [timeWindowMs=60000] - Time window in milliseconds. Defaults to 60000 (1 minute).
     *                                        Use 3600000 for 1 hour, 86400000 for 24 hours, etc.
     * @returns {ApiStatsResult} Aggregated statistics for dropped calls in the time window, including:
     *                          - Global statistics across all devices
     *                          - Per-device statistics
     */
    getDroppedApiStats(timeWindowMs = 60000) {
        return this._getStats(this.droppedCalls, timeWindowMs);
    }

    /**
     * Internal helper to get statistics for a given array of samples.
     *
     * Filters samples by time window and aggregates them into statistics. Used by
     * the public getter methods to avoid code duplication.
     *
     * @private
     * @param {Array<ApiCallSample>} samples - The array of samples to process
     * @param {number} timeWindowMs - Time window in milliseconds
     * @returns {ApiStatsResult} Aggregated statistics for the time window
     */
    _getStats(samples, timeWindowMs) {
        const result = new ApiStatsResult();
        const lowerLimit = Date.now() - timeWindowMs;

        for (let i = samples.length - 1; i >= 0; i--) {
            const sample = samples[i];
            if (sample.timestamp > lowerLimit) {
                result.add(sample);
            } else {
                break;
            }
        }

        return result;
    }
}

module.exports = {
    HttpRequestSample,
    HttpStat,
    HttpStatsResult,
    HttpStatsCounter,
    ApiCallSample,
    ApiStat,
    ApiStatsResult,
    MqttStatsCounter
};

