'use strict';

const inquirer = require('inquirer');

/**
 * Validates an RGB color value.
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
 * Builds a channel question for inquirer.
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
 * Builds an on/off question for inquirer.
 */
function _buildOnOffQuestion(onoffParam) {
    return {
        type: 'list',
        name: 'onoff',
        message: onoffParam.label || 'Turn On/Off',
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
 * Builds an RGB question for inquirer.
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
 * Builds a temperature question for inquirer.
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
 * Builds a luminance question for inquirer.
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
 * Builds a gradual transition question for inquirer.
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
 * Collects parameters for setLightColor method, filtering options based on device capabilities.
 * Only shows RGB, temperature, and luminance options if the device actually supports them.
 */
async function collectSetLightColorParams(methodMetadata, device) {
    const params = {};
    const questions = [];

    if (!methodMetadata || !methodMetadata.params) {
        return params;
    }

    // Check device capabilities
    const supportsRgb = typeof device.getSupportsRgb === 'function' && device.getSupportsRgb(0);
    const supportsTemperature = typeof device.getSupportsTemperature === 'function' && device.getSupportsTemperature(0);
    const supportsLuminance = typeof device.getSupportsLuminance === 'function' && device.getSupportsLuminance(0);

    // Channel parameter (always available)
    const channelParam = methodMetadata.params.find(p => p.name === 'channel');
    if (channelParam) {
        questions.push(_buildChannelQuestion(channelParam));
    }

    // On/Off parameter (always available, but optional)
    const onoffParam = methodMetadata.params.find(p => p.name === 'onoff');
    if (onoffParam) {
        questions.push(_buildOnOffQuestion(onoffParam));
    }

    // RGB parameter (only if device supports it)
    if (supportsRgb) {
        const rgbParam = methodMetadata.params.find(p => p.name === 'rgb');
        if (rgbParam) {
            questions.push(_buildRgbQuestion(rgbParam));
        }
    }

    // Temperature parameter (only if device supports it)
    if (supportsTemperature) {
        const tempParam = methodMetadata.params.find(p => p.name === 'temperature');
        if (tempParam) {
            questions.push(_buildTemperatureQuestion(tempParam));
        }
    }

    // Luminance parameter (only if device supports it)
    if (supportsLuminance) {
        const luminanceParam = methodMetadata.params.find(p => p.name === 'luminance');
        if (luminanceParam) {
            questions.push(_buildLuminanceQuestion(luminanceParam));
        }
    }

    // Gradual parameter (always available as an option)
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

