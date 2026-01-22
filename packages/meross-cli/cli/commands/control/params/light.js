'use strict';

const inquirer = require('inquirer');

/**
 * Validates RGB color input format for inquirer prompts.
 *
 * @param {string} value - RGB color string in format "r,g,b"
 * @returns {boolean|string} True if valid, error message if invalid
 */
function _validateRgb(value) {
    if (!value || value.trim() === '') {
        return true; // Optional
    }
    const parts = value.split(',');
    if (parts.length !== 3) {
        return 'RGB must be in format: r,g,b (e.g., 255,0,0)';
    }
    for (const part of parts) {
        const num = parseInt(part.trim(), 10);
        if (isNaN(num) || num < 0 || num > 255) {
            return 'Each RGB value must be between 0 and 255';
        }
    }
    return true;
}

/**
 * Builds an inquirer question for channel selection.
 *
 * @param {Object} channelParam - Channel parameter metadata
 * @returns {Object} Inquirer question configuration
 */
function _buildChannelQuestion(channelParam) {
    return {
        type: 'number',
        name: 'channel',
        message: channelParam.label || 'Channel',
        default: channelParam.default || 0
    };
}

/**
 * Builds an inquirer question for on/off state selection.
 *
 * @param {Object} onParam - On/off parameter metadata
 * @returns {Object} Inquirer question configuration
 */
function _buildOnOffQuestion(onParam) {
    return {
        type: 'list',
        name: 'on',
        message: onParam.label || 'Turn On/Off',
        choices: [
            { name: 'Skip (no change)', value: undefined },
            { name: 'On', value: true },
            { name: 'Off', value: false }
        ],
        default: 0, // Default to "Skip"
        required: false
    };
}

/**
 * Builds an inquirer question for RGB color input.
 *
 * @param {Object} rgbParam - RGB parameter metadata
 * @returns {Object} Inquirer question configuration
 */
function _buildRgbQuestion(rgbParam) {
    return {
        type: 'input',
        name: 'rgb',
        message: rgbParam.label || 'RGB Color (r,g,b)',
        required: false,
        validate: _validateRgb,
        filter: (value) => {
            if (!value || value.trim() === '') {
                return undefined;
            }
            return value.split(',').map(p => parseInt(p.trim(), 10));
        }
    };
}

/**
 * Builds an inquirer question for color temperature input.
 *
 * @param {Object} tempParam - Temperature parameter metadata
 * @returns {Object} Inquirer question configuration
 */
function _buildTemperatureQuestion(tempParam) {
    return {
        type: 'number',
        name: 'temperature',
        message: tempParam.label || 'Temperature (0-100)',
        min: tempParam.min || 0,
        max: tempParam.max || 100,
        required: false
    };
}

/**
 * Builds an inquirer question for brightness (luminance) input.
 *
 * @param {Object} luminanceParam - Luminance parameter metadata
 * @returns {Object} Inquirer question configuration
 */
function _buildLuminanceQuestion(luminanceParam) {
    return {
        type: 'number',
        name: 'luminance',
        message: luminanceParam.label || 'Brightness (0-100)',
        min: luminanceParam.min || 0,
        max: luminanceParam.max || 100,
        required: false
    };
}

/**
 * Builds an inquirer question for transition type selection.
 *
 * @param {Object} gradualParam - Gradual parameter metadata
 * @returns {Object} Inquirer question configuration
 */
function _buildGradualQuestion(gradualParam) {
    return {
        type: 'list',
        name: 'gradual',
        message: gradualParam.label || 'Transition Type',
        choices: [
            { name: 'Skip (use default)', value: undefined },
            { name: 'Gradual (smooth transition)', value: true },
            { name: 'Instant (immediate change)', value: false }
        ],
        default: 0, // Default to "Skip"
        required: false
    };
}

/**
 * Collects parameters for light.set method interactively.
 *
 * Filters available options based on device capabilities to avoid showing unsupported
 * features. Only displays RGB, temperature, and luminance options if the device supports them.
 *
 * @param {Object} methodMetadata - Method metadata from control registry
 * @param {Object} device - Device instance
 * @returns {Promise<Object>} Collected parameters object
 */
async function collectSetLightColorParams(methodMetadata, device) {
    const params = {};
    const questions = [];

    if (!methodMetadata || !methodMetadata.params) {
        return params;
    }

    let supportsRgb = false;
    let supportsTemperature = false;
    let supportsLuminance = false;

    if (device.light && device.abilities && device.abilities['Appliance.Control.Light']) {
        const lightAbility = device.abilities['Appliance.Control.Light'];
        if (lightAbility && lightAbility.capacity) {
            const { LightMode } = require('meross-iot');
            supportsRgb = (lightAbility.capacity & LightMode.MODE_RGB) === LightMode.MODE_RGB;
            supportsTemperature = (lightAbility.capacity & LightMode.MODE_TEMPERATURE) === LightMode.MODE_TEMPERATURE;
            supportsLuminance = (lightAbility.capacity & LightMode.MODE_LUMINANCE) === LightMode.MODE_LUMINANCE;
        }
    }

    const channelParam = methodMetadata.params.find(p => p.name === 'channel');
    if (channelParam) {
        questions.push(_buildChannelQuestion(channelParam));
    }

    const onParam = methodMetadata.params.find(p => p.name === 'on');
    if (onParam) {
        questions.push(_buildOnOffQuestion(onParam));
    }

    if (supportsRgb) {
        const rgbParam = methodMetadata.params.find(p => p.name === 'rgb');
        if (rgbParam) {
            questions.push(_buildRgbQuestion(rgbParam));
        }
    }

    if (supportsTemperature) {
        const tempParam = methodMetadata.params.find(p => p.name === 'temperature');
        if (tempParam) {
            questions.push(_buildTemperatureQuestion(tempParam));
        }
    }

    if (supportsLuminance) {
        const luminanceParam = methodMetadata.params.find(p => p.name === 'luminance');
        if (luminanceParam) {
            questions.push(_buildLuminanceQuestion(luminanceParam));
        }
    }

    const gradualParam = methodMetadata.params.find(p => p.name === 'gradual');
    if (gradualParam) {
        questions.push(_buildGradualQuestion(gradualParam));
    }

    if (questions.length > 0) {
        const answers = await inquirer.prompt(questions);
        Object.assign(params, answers);
    }

    return params;
}

module.exports = { collectSetLightColorParams };

