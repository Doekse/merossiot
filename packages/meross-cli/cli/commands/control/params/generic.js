'use strict';

const inquirer = require('inquirer');

/**
 * Validates a number value against parameter constraints.
 */
function _validateNumber(value, paramDef) {
    if (paramDef.required && (value === null || value === undefined)) {
        return `${paramDef.label || paramDef.name} is required`;
    }
    if (value !== null && value !== undefined) {
        if (paramDef.min !== undefined && value < paramDef.min) {
            return `Value must be at least ${paramDef.min}`;
        }
        if (paramDef.max !== undefined && value > paramDef.max) {
            return `Value must be at most ${paramDef.max}`;
        }
    }
    return true;
}

/**
 * Validates a string value.
 */
function _validateString(value, paramDef) {
    if (paramDef.required && (!value || value.trim() === '')) {
        return `${paramDef.label || paramDef.name} is required`;
    }
    return true;
}

/**
 * Validates an RGB color value.
 */
function _validateRgb(value, paramDef) {
    if (paramDef.required && (!value || value.trim() === '')) {
        return 'RGB color is required';
    }
    if (value && value.trim() !== '') {
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
    }
    return true;
}

/**
 * Builds a number type question for inquirer.
 */
function _buildNumberQuestion(paramDef) {
    return {
        type: 'number',
        name: paramDef.name,
        message: paramDef.label || paramDef.name,
        default: paramDef.default,
        validate: (value) => _validateNumber(value, paramDef),
        when: paramDef.when || (() => true)
    };
}

/**
 * Builds a boolean type question for inquirer.
 */
function _buildBooleanQuestion(paramDef) {
    if (paramDef.choices) {
        return {
            type: 'list',
            name: paramDef.name,
            message: paramDef.label || paramDef.name,
            choices: paramDef.choices,
            required: paramDef.required || false
        };
    }
    return {
        type: 'confirm',
        name: paramDef.name,
        message: paramDef.label || paramDef.name,
        default: paramDef.default
    };
}

/**
 * Builds an enum type question for inquirer.
 */
function _buildEnumQuestion(paramDef) {
    return {
        type: 'list',
        name: paramDef.name,
        message: paramDef.label || paramDef.name,
        choices: paramDef.choices,
        required: paramDef.required || false
    };
}

/**
 * Builds a string type question for inquirer.
 */
function _buildStringQuestion(paramDef) {
    return {
        type: 'input',
        name: paramDef.name,
        message: paramDef.label || paramDef.name,
        default: paramDef.default,
        validate: (value) => _validateString(value, paramDef)
    };
}

/**
 * Builds an RGB type question for inquirer.
 */
function _buildRgbQuestion(paramDef) {
    return {
        type: 'input',
        name: paramDef.name,
        message: paramDef.label || 'RGB Color (r,g,b)',
        default: paramDef.default,
        validate: (value) => _validateRgb(value, paramDef),
        filter: (value) => {
            if (!value || value.trim() === '') {return null;}
            const parts = value.split(',').map(p => parseInt(p.trim(), 10));
            return parts;
        }
    };
}

/**
 * Collects object properties interactively.
 */
async function _collectObjectProperties(paramDef) {
    const objectParams = {};
    if (!paramDef.properties) {
        return objectParams;
    }

    for (const prop of paramDef.properties) {
        if (prop.type === 'number') {
            const propValue = await inquirer.prompt([{
                type: 'number',
                name: 'value',
                message: prop.label || prop.name,
                default: prop.default,
                validate: (value) => _validateNumber(value, prop)
            }]);
            objectParams[prop.name] = propValue.value;
        } else if (prop.type === 'boolean') {
            const propValue = await inquirer.prompt([{
                type: 'confirm',
                name: 'value',
                message: prop.label || prop.name,
                default: prop.default
            }]);
            objectParams[prop.name] = propValue.value ? 1 : 0;
        } else if (prop.type === 'string') {
            const propValue = await inquirer.prompt([{
                type: 'input',
                name: 'value',
                message: prop.label || prop.name,
                default: prop.default,
                validate: (value) => _validateString(value, prop)
            }]);
            objectParams[prop.name] = propValue.value;
        }
    }
    return objectParams;
}

/**
 * Builds a question for a parameter definition based on its type.
 */
function _buildQuestionForType(paramDef) {
    switch (paramDef.type) {
    case 'number':
        return _buildNumberQuestion(paramDef);
    case 'boolean':
        return _buildBooleanQuestion(paramDef);
    case 'enum':
        return _buildEnumQuestion(paramDef);
    case 'string':
        return _buildStringQuestion(paramDef);
    case 'rgb':
        return _buildRgbQuestion(paramDef);
    default:
        return null;
    }
}

/**
 * Generic parameter collection based on methodMetadata.params.
 * Handles all standard parameter types: number, boolean, enum, string, rgb, object.
 */
async function collectGenericParams(methodMetadata) {
    const params = {};
    const questions = [];

    if (!methodMetadata || !methodMetadata.params) {
        return params;
    }

    for (const paramDef of methodMetadata.params) {
        if (paramDef.type === 'object') {
            const objectParams = await _collectObjectProperties(paramDef);
            params[paramDef.name] = objectParams;
            continue;
        }

        const question = _buildQuestionForType(paramDef);
        if (question) {
            questions.push(question);
        }
    }

    if (questions.length > 0) {
        const answers = await inquirer.prompt(questions);
        Object.assign(params, answers);
    }

    return params;
}

module.exports = { collectGenericParams };

