'use strict';

/**
 * Diffuser device live tests (diffuser feature: light + spray).
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, getPrimaryChannel, assertFeatureOrSkip, REQUIRE_ONLINE } = require('./test-helper');


const metadata = {
    name: 'diffuser',
    description: 'Tests light RGB control, brightness, and spray mode for diffuser devices',
    requiredAbilities: ['Appliance.Control.Diffuser.Light', 'Appliance.Control.Diffuser.Spray'],
    minDevices: 1
};

/**
 * @param {Object} context - Test context from the CLI runner
 * @returns {Promise<Array<Object>>} Per-assertion result rows
 */
async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];

    let lightDevices = [];
    let sprayDevices = [];

    if (devices && devices.length > 0) {
        lightDevices = devices.filter(d =>
            d.abilities && d.abilities['Appliance.Control.Diffuser.Light']
        );
        sprayDevices = devices.filter(d =>
            d.abilities && d.abilities['Appliance.Control.Diffuser.Spray']
        );
    } else {
        lightDevices = await findDevicesByAbility(manager, 'Appliance.Control.Diffuser.Light', REQUIRE_ONLINE);
        sprayDevices = await findDevicesByAbility(manager, 'Appliance.Control.Diffuser.Spray', REQUIRE_ONLINE);
    }

    for (const device of lightDevices) {
        await waitForDeviceConnection(device, timeout);
        const ch = getPrimaryChannel(device);
        if (device.diffuser) {
            await device.diffuser.get({ type: 'light', channel: ch });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    for (const device of sprayDevices) {
        await waitForDeviceConnection(device, timeout);
        const ch = getPrimaryChannel(device);
        if (device.diffuser) {
            await device.diffuser.get({ type: 'spray', channel: ch });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test 1: Set RGB color on diffuser light
    if (lightDevices.length < 1) {
        results.push({
            name: 'should set RGB color on diffuser light',
            passed: false,
            skipped: true,
            error: 'Could not find any DiffuserLight device within the given set of devices',
            device: null
        });
    } else {
        const light = lightDevices[0];
        const deviceName = getDeviceName(light);
        const channel = getPrimaryChannel(light);

        try {
            if (!assertFeatureOrSkip(results, light, 'diffuser', deviceName, 'should set RGB color on diffuser light')) {
                // skip
            } else {
                await light.diffuser.get({ type: 'light', channel });

                await light.diffuser.set({
                    light: {
                        channel,
                        mode: 'fixed-rgb'
                    }
                });

                const r = Math.floor(Math.random() * 256);
                const g = Math.floor(Math.random() * 256);
                const b = Math.floor(Math.random() * 256);
                const rgbInt = (r << 16) | (g << 8) | b;

                await light.diffuser.set({
                    light: {
                        channel,
                        mode: 'fixed-rgb',
                        rgb: rgbInt,
                        onoff: 1
                    }
                });

                await new Promise(resolve => setTimeout(resolve, 1000));

                const state = await light.diffuser.get({ type: 'light', channel });
                const color = state && state.rgbTuple ? state.rgbTuple : null;

                if (!color || !Array.isArray(color) || color.length !== 3) {
                    results.push({
                        name: 'should set RGB color on diffuser light',
                        passed: false,
                        skipped: false,
                        error: `Invalid color returned: ${JSON.stringify(color)}`,
                        device: deviceName
                    });
                } else if (color[0] !== r || color[1] !== g || color[2] !== b) {
                    results.push({
                        name: 'should set RGB color on diffuser light',
                        passed: false,
                        skipped: false,
                        error: `Color mismatch. Expected [${r}, ${g}, ${b}], got [${color[0]}, ${color[1]}, ${color[2]}]`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should set RGB color on diffuser light',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { rgb: [r, g, b] }
                    });
                }
            }
        } catch (error) {
            results.push({
                name: 'should set RGB color on diffuser light',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName
            });
        }
    }

    // Test 2: Turn diffuser light on and off
    if (lightDevices.length < 1) {
        results.push({
            name: 'should turn diffuser light on and off',
            passed: false,
            skipped: true,
            error: 'Could not find any DiffuserLight device within the given set of devices',
            device: null
        });
    } else {
        const light = lightDevices[0];
        const deviceName = getDeviceName(light);
        const channel = getPrimaryChannel(light);

        try {
            if (!assertFeatureOrSkip(results, light, 'diffuser', deviceName, 'should turn diffuser light on and off')) {
                // skip
            } else {
                await light.diffuser.get({ type: 'light', channel });

                await light.diffuser.set({
                    light: {
                        channel,
                        mode: 'fixed-rgb'
                    }
                });

                await light.diffuser.set({
                    light: {
                        channel,
                        onoff: 0
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 1000));

                let state = await light.diffuser.get({ type: 'light', channel });
                const isOff = state && state.isOn === false;
                if (isOff !== true) {
                    results.push({
                        name: 'should turn diffuser light on and off',
                        passed: false,
                        skipped: false,
                        error: `Device should be off but isOn returned ${state && state.isOn}`,
                        device: deviceName
                    });
                } else {
                    await light.diffuser.set({
                        light: {
                            channel,
                            rgb: 0xFF0000
                        }
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    state = await light.diffuser.get({ type: 'light', channel });
                    const stillOff = state && state.isOn === false;
                    const color = state && state.rgbTuple ? state.rgbTuple : null;

                    if (stillOff !== true) {
                        results.push({
                            name: 'should turn diffuser light on and off',
                            passed: false,
                            skipped: false,
                            error: 'Device should still be off after color change',
                            device: deviceName
                        });
                    } else if (color && Array.isArray(color) && color.length === 3) {
                        if (color[0] !== 255 || color[1] !== 0 || color[2] !== 0) {
                            results.push({
                                name: 'should turn diffuser light on and off',
                                passed: false,
                                skipped: false,
                                error: `Color mismatch. Expected [255, 0, 0], got [${color[0]}, ${color[1]}, ${color[2]}]`,
                                device: deviceName
                            });
                        } else {
                            await light.diffuser.set({
                                light: {
                                    channel,
                                    onoff: 1
                                }
                            });
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            state = await light.diffuser.get({ type: 'light', channel });
                            const isOn = state && state.isOn === true;
                            if (isOn !== true) {
                                results.push({
                                    name: 'should turn diffuser light on and off',
                                    passed: false,
                                    skipped: false,
                                    error: `Device should be on but isOn returned ${state && state.isOn}`,
                                    device: deviceName
                                });
                            } else {
                                await light.diffuser.set({
                                    light: {
                                        channel,
                                        onoff: 0
                                    }
                                });
                                await new Promise(resolve => setTimeout(resolve, 1000));

                                state = await light.diffuser.get({ type: 'light', channel });
                                const finalIsOff = state && state.isOn === false;
                                if (finalIsOff !== true) {
                                    results.push({
                                        name: 'should turn diffuser light on and off',
                                        passed: false,
                                        skipped: false,
                                        error: 'Device should be off but isOn returned true',
                                        device: deviceName
                                    });
                                } else {
                                    results.push({
                                        name: 'should turn diffuser light on and off',
                                        passed: true,
                                        skipped: false,
                                        error: null,
                                        device: deviceName
                                    });
                                }
                            }
                        }
                    } else {
                        results.push({
                            name: 'should turn diffuser light on and off',
                            passed: false,
                            skipped: false,
                            error: `Invalid color after off-state change: ${JSON.stringify(color)}`,
                            device: deviceName
                        });
                    }
                }
            }
        } catch (error) {
            results.push({
                name: 'should turn diffuser light on and off',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName
            });
        }
    }

    // Test 3: Change diffuser light mode
    if (lightDevices.length < 1) {
        results.push({
            name: 'should change diffuser light mode',
            passed: false,
            skipped: true,
            error: 'Could not find any DiffuserLight device within the given set of devices',
            device: null
        });
    } else {
        const light = lightDevices[0];
        const deviceName = getDeviceName(light);
        const channel = getPrimaryChannel(light);

        try {
            if (!assertFeatureOrSkip(results, light, 'diffuser', deviceName, 'should change diffuser light mode')) {
                // skip
            } else {
                await light.diffuser.get({ type: 'light', channel });

                await light.diffuser.set({
                    light: {
                        channel,
                        mode: 'fixed-luminance',
                        onoff: 1
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 1000));

                let state = await light.diffuser.get({ type: 'light', channel });
                if (!state || state.mode !== 'fixed-luminance') {
                    results.push({
                        name: 'should change diffuser light mode',
                        passed: false,
                        skipped: false,
                        error: `Failed to set FIXED_LUMINANCE. Expected ${'fixed-luminance'}, got ${state && state.mode}`,
                        device: deviceName
                    });
                } else {
                    await light.diffuser.set({
                        light: {
                            channel,
                            mode: 'rotating-colors'
                        }
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    state = await light.diffuser.get({ type: 'light', channel });
                    if (!state || state.mode !== 'rotating-colors') {
                        results.push({
                            name: 'should change diffuser light mode',
                            passed: false,
                            skipped: false,
                            error: `Failed to set ROTATING_COLORS. Expected ${'rotating-colors'}, got ${state && state.mode}`,
                            device: deviceName
                        });
                    } else {
                        await light.diffuser.set({
                            light: {
                                channel,
                                mode: 'fixed-rgb'
                            }
                        });
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        state = await light.diffuser.get({ type: 'light', channel });
                        if (!state || state.mode !== 'fixed-rgb') {
                            results.push({
                                name: 'should change diffuser light mode',
                                passed: false,
                                skipped: false,
                                error: `Failed to set FIXED_RGB. Expected ${'fixed-rgb'}, got ${state && state.mode}`,
                                device: deviceName
                            });
                        } else {
                            results.push({
                                name: 'should change diffuser light mode',
                                passed: true,
                                skipped: false,
                                error: null,
                                device: deviceName
                            });
                        }
                    }
                }
            }
        } catch (error) {
            results.push({
                name: 'should change diffuser light mode',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName
            });
        }
    }

    // Test 4: Change diffuser light brightness
    if (lightDevices.length < 1) {
        results.push({
            name: 'should change diffuser light brightness',
            passed: false,
            skipped: true,
            error: 'Could not find any DiffuserLight device within the given set of devices',
            device: null
        });
    } else {
        const light = lightDevices[0];
        const deviceName = getDeviceName(light);
        const channel = getPrimaryChannel(light);

        try {
            if (!assertFeatureOrSkip(results, light, 'diffuser', deviceName, 'should change diffuser light brightness')) {
                // skip
            } else {
                await light.diffuser.get({ type: 'light', channel });

                await light.diffuser.set({
                    light: {
                        channel,
                        onoff: 1
                    }
                });

                let allPassed = true;
                for (let i = 0; i <= 100; i += 10) {
                    await light.diffuser.set({
                        light: {
                            channel,
                            luminance: i
                        }
                    });
                    await new Promise(resolve => setTimeout(resolve, 500));

                    const state = await light.diffuser.get({ type: 'light', channel });
                    const brightness = state && state.luminance;
                    if (brightness !== i) {
                        allPassed = false;
                        break;
                    }
                }

                if (!allPassed) {
                    results.push({
                        name: 'should change diffuser light brightness',
                        passed: false,
                        skipped: false,
                        error: 'Brightness values did not match expected values',
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should change diffuser light brightness',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName
                    });
                }
            }
        } catch (error) {
            results.push({
                name: 'should change diffuser light brightness',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName
            });
        }
    }

    // Test 5: Change diffuser spray mode
    if (sprayDevices.length < 1) {
        results.push({
            name: 'should change diffuser spray mode',
            passed: false,
            skipped: true,
            error: 'Could not find any DiffuserSpray device within the given set of devices',
            device: null
        });
    } else {
        const spray = sprayDevices[0];
        const deviceName = getDeviceName(spray);
        const channel = getPrimaryChannel(spray);

        try {
            if (!assertFeatureOrSkip(results, spray, 'diffuser', deviceName, 'should change diffuser spray mode')) {
                // skip
            } else {
                await spray.diffuser.get({ type: 'spray', channel });

                await spray.diffuser.set({ channel, mode: 'light' });
                await new Promise(resolve => setTimeout(resolve, 1000));

                let state = await spray.diffuser.get({ type: 'spray', channel });
                if (!state || state.mode !== 'light') {
                    results.push({
                        name: 'should change diffuser spray mode',
                        passed: false,
                        skipped: false,
                        error: `Failed to set LIGHT. Expected ${'light'}, got ${state && state.mode}`,
                        device: deviceName
                    });
                } else {
                    await spray.diffuser.set({ channel, mode: 'strong' });
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    state = await spray.diffuser.get({ type: 'spray', channel });
                    if (!state || state.mode !== 'strong') {
                        results.push({
                            name: 'should change diffuser spray mode',
                            passed: false,
                            skipped: false,
                            error: `Failed to set STRONG. Expected ${'strong'}, got ${state && state.mode}`,
                            device: deviceName
                        });
                    } else {
                        await spray.diffuser.set({ channel, mode: 'off' });
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        state = await spray.diffuser.get({ type: 'spray', channel });
                        if (!state || state.mode !== 'off') {
                            results.push({
                                name: 'should change diffuser spray mode',
                                passed: false,
                                skipped: false,
                                error: `Failed to set OFF. Expected ${'off'}, got ${state && state.mode}`,
                                device: deviceName
                            });
                        } else {
                            results.push({
                                name: 'should change diffuser spray mode',
                                passed: true,
                                skipped: false,
                                error: null,
                                device: deviceName
                            });
                        }
                    }
                }
            }
        } catch (error) {
            results.push({
                name: 'should change diffuser spray mode',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName
            });
        }
    }

    return results;
}

module.exports = {
    metadata,
    runTests
};
