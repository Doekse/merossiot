'use strict';

/**
 * Light Device Tests
 * Tests RGB color, brightness, and temperature control for light devices
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, getPrimaryChannel, assertFeatureOrSkip, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'light',
    description: 'Tests RGB color, brightness, and temperature control for light devices',
    requiredAbilities: ['Appliance.Control.Light'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let lightDevices = devices || [];
    if (lightDevices.length === 0) {
        lightDevices = await findDevicesByAbility(manager, 'Appliance.Control.Light', OnlineStatus.ONLINE);
    }
    
    // Wait for devices to be connected and update their states
    for (const device of lightDevices) {
        await waitForDeviceConnection(device, timeout);
        const ch = getPrimaryChannel(device);
        if (device.light) {
            await device.light.get({ channel: ch });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Find RGB-capable devices
    const { LightMode } = require('meross-iot');
    const rgbCapable = lightDevices.filter(d => {
        if (!d.light || !d.abilities || !d.abilities['Appliance.Control.Light']) {
            return false;
        }
        const lightAbility = d.abilities['Appliance.Control.Light'];
        if (!lightAbility || !lightAbility.capacity) {
            return false;
        }
        return (lightAbility.capacity & LightMode.MODE_RGB) === LightMode.MODE_RGB;
    });
    
    // Use RGB-capable device if available, otherwise use first light device
    const testLight = rgbCapable.length > 0 ? rgbCapable[0] : (lightDevices.length > 0 ? lightDevices[0] : null);
    
    if (!testLight) {
        results.push({
            name: 'should find light device',
            passed: false,
            skipped: true,
            error: 'Could not find any Light device within the given set of devices',
            device: null
        });
        return results;
    }
    
    const channel = getPrimaryChannel(testLight);
    const deviceName = getDeviceName(testLight);
    const hasRgbSupport = rgbCapable.length > 0 && testLight.light && testLight.light.supportsRgb({ channel });
    
    // Test 1: Set RGB color
    try {
        if (assertFeatureOrSkip(results, testLight, 'light', deviceName, 'should set RGB color')) {
        if (!hasRgbSupport) {
            results.push({
                name: 'should set RGB color',
                passed: false,
                skipped: true,
                error: 'Device does not support RGB color',
                device: deviceName
            });
        } else {
        await testLight.light.get({ channel });
        
        // Set a random color
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        
        await testLight.light.set({
            channel,
            rgb: [r, g, b],
            on: true
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check the color property returns the set color
        const lightState = await testLight.light.get({ channel });
        const color = lightState && lightState.rgbTuple ? lightState.rgbTuple : null;
        
        if (!color || !Array.isArray(color) || color.length !== 3) {
            results.push({
                name: 'should set RGB color',
                passed: false,
                skipped: false,
                error: `Invalid color returned: ${JSON.stringify(color)}`,
                device: deviceName
            });
        } else if (color[0] !== r || color[1] !== g || color[2] !== b) {
            results.push({
                name: 'should set RGB color',
                passed: false,
                skipped: false,
                error: `Color mismatch. Expected [${r}, ${g}, ${b}], got [${color[0]}, ${color[1]}, ${color[2]}]`,
                device: deviceName
            });
        } else {
            results.push({
                name: 'should set RGB color',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { rgb: [r, g, b] }
            });
        }
        }
        }
    } catch (error) {
        results.push({
            name: 'should set RGB color',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Turn light on and off
    try {
        if (assertFeatureOrSkip(results, testLight, 'light', deviceName, 'should turn light on and off')) {
            await testLight.light.get({ channel });
            
            // Turn device off
            await testLight.light.set({
                channel,
                rgb: [255, 255, 255],
                on: false
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Make sure device is now off
            await testLight.light.get({ channel });
            const isOff = testLight.light.isOn({ channel });
            if (isOff !== false) {
                results.push({
                    name: 'should turn light on and off',
                    passed: false,
                    skipped: false,
                    error: `Device should be off but isOn returned ${isOff}`,
                    device: deviceName
                });
            } else {
                // Set a color and turn the device on
                await testLight.light.set({
                    channel,
                    rgb: [0, 255, 0],
                    on: true
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Make sure device is now on with that specific color set
                const lightStateOn = await testLight.light.get({ channel });
                const isOn = testLight.light.isOn({ channel });
                const color = lightStateOn && lightStateOn.rgbTuple ? lightStateOn.rgbTuple : null;
                
                if (!isOn) {
                    results.push({
                        name: 'should turn light on and off',
                        passed: false,
                        skipped: false,
                        error: 'Device should be on but isOn returned false',
                        device: deviceName
                    });
                } else if (!color || !Array.isArray(color) || color.length !== 3 || 
                    color[0] !== 0 || color[1] !== 255 || color[2] !== 0) {
                    results.push({
                        name: 'should turn light on and off',
                        passed: false,
                        skipped: false,
                        error: `Color mismatch. Expected [0, 255, 0], got ${JSON.stringify(color)}`,
                        device: deviceName
                    });
                } else {
                    // Set a color without changing the on-off state
                    await testLight.light.set({
                        channel,
                        rgb: [255, 0, 0]
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Make sure device is still on and showing the specific color
                    const lightStateStill = await testLight.light.get({ channel });
                    const stillOn = testLight.light.isOn({ channel });
                    const newColor = lightStateStill && lightStateStill.rgbTuple ? lightStateStill.rgbTuple : null;
                    
                    if (!stillOn) {
                        results.push({
                            name: 'should turn light on and off',
                            passed: false,
                            skipped: false,
                            error: 'Device should still be on after color change',
                            device: deviceName
                        });
                    } else if (!newColor || !Array.isArray(newColor) || newColor.length !== 3 || 
                        newColor[0] !== 255 || newColor[1] !== 0 || newColor[2] !== 0) {
                        results.push({
                            name: 'should turn light on and off',
                            passed: false,
                            skipped: false,
                            error: `Color mismatch. Expected [255, 0, 0], got ${JSON.stringify(newColor)}`,
                            device: deviceName
                        });
                    } else {
                        // Turn off device without changing color
                        await testLight.light.set({
                            channel,
                            on: false
                        });
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Make sure device is now off
                        // Refresh toggle state if device supports ToggleX, since light.isOn() checks toggle state
                        if (testLight.toggle && testLight.abilities?.['Appliance.Control.ToggleX']) {
                            await testLight.toggle.get({ channel });
                        }
                        await testLight.light.get({ channel });
                        const finalIsOff = testLight.light.isOn({ channel });
                        if (finalIsOff !== false) {
                            results.push({
                                name: 'should turn light on and off',
                                passed: false,
                                skipped: false,
                                error: 'Device should be off but isOn returned true',
                                device: deviceName
                            });
                        } else {
                            results.push({
                                name: 'should turn light on and off',
                                passed: true,
                                skipped: false,
                                error: null,
                                device: deviceName
                            });
                        }
                    }
                }
            }
        }
    } catch (error) {
        results.push({
            name: 'should turn light on and off',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: RGB input formats (array, integer, object)
    try {
        if (assertFeatureOrSkip(results, testLight, 'light', deviceName, 'should accept RGB in different formats')) {
        if (!hasRgbSupport) {
            results.push({
                name: 'should accept RGB in different formats',
                passed: false,
                skipped: true,
                error: 'Device does not support RGB',
                device: deviceName
            });
        } else {
            await testLight.light.get({ channel });
            
            // Test RGB as array
            await testLight.light.set({
                channel,
                rgb: [100, 150, 200],
                on: true
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            const color1 = testLight.light.getRgbColor({ channel });
            
            // Test RGB as integer
            const rgbInt = (100 << 16) | (150 << 8) | 200;
            await testLight.light.set({
                channel,
                rgb: rgbInt,
                on: true
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            const color2 = testLight.light.getRgbColor({ channel });
            
            // Test RGB as object
            await testLight.light.set({
                channel,
                rgb: { r: 100, g: 150, b: 200 },
                on: true
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            const color3 = testLight.light.getRgbColor({ channel });
            
            if (!color1 || !Array.isArray(color1) || color1.length !== 3 ||
                !color2 || !Array.isArray(color2) || color2.length !== 3 ||
                !color3 || !Array.isArray(color3) || color3.length !== 3) {
                results.push({
                    name: 'should accept RGB in different formats',
                    passed: false,
                    skipped: false,
                    error: `Invalid colors returned. Array: ${JSON.stringify(color1)}, Integer: ${JSON.stringify(color2)}, Object: ${JSON.stringify(color3)}`,
                    device: deviceName
                });
            } else if (color1[0] !== 100 || color1[1] !== 150 || color1[2] !== 200 ||
                       color2[0] !== 100 || color2[1] !== 150 || color2[2] !== 200 ||
                       color3[0] !== 100 || color3[1] !== 150 || color3[2] !== 200) {
                results.push({
                    name: 'should accept RGB in different formats',
                    passed: false,
                    skipped: false,
                    error: `Color mismatch. Expected [100, 150, 200] for all formats`,
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should accept RGB in different formats',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
        }
    } catch (error) {
        results.push({
            name: 'should accept RGB in different formats',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 4: Brightness/Luminance control
    try {
        if (assertFeatureOrSkip(results, testLight, 'light', deviceName, 'should set brightness/luminance')) {
        if (!testLight.light.supportsLuminance({ channel })) {
            results.push({
                name: 'should set brightness/luminance',
                passed: false,
                skipped: true,
                error: 'Device does not support luminance control',
                device: deviceName
            });
        } else {
            await testLight.light.get({ channel });
            
            // Set brightness to 50
            await testLight.light.set({
                channel,
                luminance: 50,
                on: true
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const lightState = await testLight.light.get({ channel });
            const brightness = testLight.light.getBrightness({ channel });
            const brightnessFromState = lightState ? lightState.luminance : undefined;
            
            if (brightness === undefined && brightnessFromState === undefined) {
                results.push({
                    name: 'should set brightness/luminance',
                    passed: false,
                    skipped: false,
                    error: 'Brightness not returned from device',
                    device: deviceName
                });
            } else {
                const actualBrightness = brightness !== undefined ? brightness : brightnessFromState;
                // Allow some tolerance as devices may round values
                if (actualBrightness >= 45 && actualBrightness <= 55) {
                    results.push({
                        name: 'should set brightness/luminance',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { brightness: actualBrightness }
                    });
                } else {
                    results.push({
                        name: 'should set brightness/luminance',
                        passed: false,
                        skipped: false,
                        error: `Brightness mismatch. Expected ~50, got ${actualBrightness}`,
                        device: deviceName
                    });
                }
            }
        }
        }
    } catch (error) {
        results.push({
            name: 'should set brightness/luminance',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 5: Temperature control
    try {
        if (assertFeatureOrSkip(results, testLight, 'light', deviceName, 'should set color temperature')) {
        if (!testLight.light.supportsTemperature({ channel })) {
            results.push({
                name: 'should set color temperature',
                passed: false,
                skipped: true,
                error: 'Device does not support temperature control',
                device: deviceName
            });
        } else {
            await testLight.light.get({ channel });
            
            // Set temperature to 50 (middle of range)
            // Note: Some RGB-capable devices may override temperature when RGB mode is active
            // from previous operations, so we wait longer for state to stabilize
            await testLight.light.set({
                channel,
                temperature: 50,
                on: true
            });
            // Wait longer to allow push notifications to arrive and stabilize
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Refresh state to get latest from device (including any push notifications)
            const lightState = await testLight.light.get({ channel });
            const temperature = testLight.light.getTemperature({ channel });
            const temperatureFromState = lightState ? lightState.temperature : undefined;
            
            if (temperature === undefined && temperatureFromState === undefined) {
                results.push({
                    name: 'should set color temperature',
                    passed: false,
                    skipped: false,
                    error: 'Temperature not returned from device',
                    device: deviceName
                });
            } else {
                const actualTemp = temperature !== undefined ? temperature : temperatureFromState;
                // Allow some tolerance as devices may round values
                // Some RGB-capable devices may override temperature when RGB mode is active,
                // so we use a wider tolerance for RGB-capable devices
                const tolerance = hasRgbSupport ? 20 : 5;
                if (actualTemp >= 50 - tolerance && actualTemp <= 50 + tolerance) {
                    results.push({
                        name: 'should set color temperature',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { temperature: actualTemp }
                    });
                } else {
                    results.push({
                        name: 'should set color temperature',
                        passed: false,
                        skipped: false,
                        error: `Temperature mismatch. Expected ~50, got ${actualTemp}${hasRgbSupport ? ' (device may override temperature in RGB mode)' : ''}`,
                        device: deviceName
                    });
                }
            }
        }
        }
    } catch (error) {
        results.push({
            name: 'should set color temperature',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 6: Convenience methods
    try {
        if (assertFeatureOrSkip(results, testLight, 'light', deviceName, 'should provide convenience methods')) {
            await testLight.light.get({ channel });
            
            // Set a known state
            await testLight.light.set({
                channel,
                rgb: [128, 64, 192],
                luminance: 75,
                temperature: 60,
                on: true
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await testLight.light.get({ channel });
            
            const isOn = testLight.light.isOn({ channel });
            const rgbColor = testLight.light.getRgbColor({ channel });
            const brightness = testLight.light.getBrightness({ channel });
            const temperature = testLight.light.getTemperature({ channel });
            
            const supportsRgb = testLight.light.supportsRgb({ channel });
            const supportsLum = testLight.light.supportsLuminance({ channel });
            const supportsTemp = testLight.light.supportsTemperature({ channel });
            
            if (isOn === undefined) {
                results.push({
                    name: 'should provide convenience methods',
                    passed: false,
                    skipped: false,
                    error: 'isOn() returned undefined',
                    device: deviceName
                });
            } else if (supportsRgb && !rgbColor) {
                results.push({
                    name: 'should provide convenience methods',
                    passed: false,
                    skipped: false,
                    error: 'getRgbColor() returned undefined for RGB-capable device',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should provide convenience methods',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: {
                        isOn,
                        rgbColor: supportsRgb ? rgbColor : 'not supported',
                        brightness: supportsLum ? brightness : 'not supported',
                        temperature: supportsTemp ? temperature : 'not supported'
                    }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should provide convenience methods',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 7: Gradual transition parameter
    try {
        if (assertFeatureOrSkip(results, testLight, 'light', deviceName, 'should support gradual transition parameter')) {
        if (!hasRgbSupport) {
            results.push({
                name: 'should support gradual transition parameter',
                passed: false,
                skipped: true,
                error: 'Device does not support RGB',
                device: deviceName
            });
        } else {
            await testLight.light.get({ channel });
            
            // Test with gradual: true
            await testLight.light.set({
                channel,
                rgb: [255, 0, 0],
                gradual: true,
                on: true
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Test with gradual: false
            await testLight.light.set({
                channel,
                rgb: [0, 255, 0],
                gradual: false,
                on: true
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const color = testLight.light.getRgbColor({ channel });
            if (!color || !Array.isArray(color) || color.length !== 3) {
                results.push({
                    name: 'should support gradual transition parameter',
                    passed: false,
                    skipped: false,
                    error: `Invalid color returned: ${JSON.stringify(color)}`,
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should support gradual transition parameter',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { note: 'Gradual parameter accepted, visual transition not verified' }
                });
            }
        }
        }
    } catch (error) {
        results.push({
            name: 'should support gradual transition parameter',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    return results;
}

module.exports = {
    metadata,
    runTests
};
