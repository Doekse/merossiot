'use strict';

/**
 * Diffuser Device Tests
 * Tests light RGB control, brightness, and spray mode for diffuser devices
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');
const { DiffuserLightMode, DiffuserSprayMode } = require('meross-iot');

const metadata = {
    name: 'diffuser',
    description: 'Tests light RGB control, brightness, and spray mode for diffuser devices',
    requiredAbilities: ['Appliance.Control.Diffuser.Light', 'Appliance.Control.Diffuser.Spray'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let lightDevices = [];
    let sprayDevices = [];
    
    if (devices && devices.length > 0) {
        // Use provided devices, filter by capabilities
        lightDevices = devices.filter(d => 
            d.abilities && d.abilities['Appliance.Control.Diffuser.Light']
        );
        sprayDevices = devices.filter(d => 
            d.abilities && d.abilities['Appliance.Control.Diffuser.Spray']
        );
    } else {
        // Find diffuser light devices
        lightDevices = await findDevicesByAbility(manager, 'Appliance.Control.Diffuser.Light', OnlineStatus.ONLINE);
        
        // Find diffuser spray devices
        sprayDevices = await findDevicesByAbility(manager, 'Appliance.Control.Diffuser.Spray', OnlineStatus.ONLINE);
    }
    
    // Wait for devices to be connected
    for (const device of lightDevices) {
        await waitForDeviceConnection(device, timeout);
        await device.diffuser.get({ type: 'light', channel: 0 });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    for (const device of sprayDevices) {
        await waitForDeviceConnection(device, timeout);
        await device.diffuser.get({ type: 'spray', channel: 0 });
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
        
        try {
            await light.diffuser.get({ type: 'light', channel: 0 });
            
            // Set mode to FIXED_RGB
            await light.setDiffuserLight({
                channel: 0,
                mode: DiffuserLightMode.FIXED_RGB
            });
            
            // Set a random color
            const r = Math.floor(Math.random() * 256);
            const g = Math.floor(Math.random() * 256);
            const b = Math.floor(Math.random() * 256);
            await light.setDiffuserLight({
                channel: 0,
                mode: DiffuserLightMode.FIXED_RGB,
                rgb: (r << 16) | (g << 8) | b,
                onoff: 1
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check the color property returns the set color
            const color = light.getDiffuserLightRgbColor(0);
            
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
        
        try {
            await light.diffuser.get({ type: 'light', channel: 0 });
            
            // Set mode to FIXED RGB
            await light.setDiffuserLight({
                channel: 0,
                mode: DiffuserLightMode.FIXED_RGB
            });
            
            // Turn device off
            await light.setDiffuserLight({
                channel: 0,
                onoff: 0
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const isOff = light.getDiffuserLightIsOn(0);
            if (isOff !== false) {
                results.push({
                    name: 'should turn diffuser light on and off',
                    passed: false,
                    skipped: false,
                    error: `Device should be off but isOn returned ${isOff}`,
                    device: deviceName
                });
                return results;
            }
            
            // Change the color without turning it on
            await light.setDiffuserLight({
                channel: 0,
                rgb: 0xFF0000 // Red
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Make sure device is still off but color changed
            const stillOff = light.getDiffuserLightIsOn(0);
            const color = light.getDiffuserLightRgbColor(0);
            
            if (stillOff !== false) {
                results.push({
                    name: 'should turn diffuser light on and off',
                    passed: false,
                    skipped: false,
                    error: 'Device should still be off after color change',
                    device: deviceName
                });
                return results;
            }
            
            if (color && Array.isArray(color) && color.length === 3) {
                if (color[0] !== 255 || color[1] !== 0 || color[2] !== 0) {
                    results.push({
                        name: 'should turn diffuser light on and off',
                        passed: false,
                        skipped: false,
                        error: `Color mismatch. Expected [255, 0, 0], got [${color[0]}, ${color[1]}, ${color[2]}]`,
                        device: deviceName
                    });
                    return results;
                }
            }
            
            // Turn device on
            await light.setDiffuserLight({
                channel: 0,
                onoff: 1
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const isOn = light.getDiffuserLightIsOn(0);
            if (isOn !== true) {
                results.push({
                    name: 'should turn diffuser light on and off',
                    passed: false,
                    skipped: false,
                    error: `Device should be on but isOn returned ${isOn}`,
                    device: deviceName
                });
                return results;
            }
            
            // Turn off device without changing color
            await light.setDiffuserLight({
                channel: 0,
                onoff: 0
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const finalIsOff = light.getDiffuserLightIsOn(0);
            if (finalIsOff !== false) {
                results.push({
                    name: 'should turn diffuser light on and off',
                    passed: false,
                    skipped: false,
                    error: 'Device should be off but isOn returned true',
                    device: deviceName
                });
                return results;
            }
            
            results.push({
                name: 'should turn diffuser light on and off',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
            
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
        
        try {
            await light.diffuser.get({ type: 'light', channel: 0 });
            
            await light.setDiffuserLight({
                channel: 0,
                mode: DiffuserLightMode.FIXED_LUMINANCE,
                onoff: 1
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mode1 = light.getDiffuserLightMode(0);
            if (mode1 !== DiffuserLightMode.FIXED_LUMINANCE) {
                results.push({
                    name: 'should change diffuser light mode',
                    passed: false,
                    skipped: false,
                    error: `Failed to set FIXED_LUMINANCE. Expected ${DiffuserLightMode.FIXED_LUMINANCE}, got ${mode1}`,
                    device: deviceName
                });
                return results;
            }
            
            await light.setDiffuserLight({
                channel: 0,
                mode: DiffuserLightMode.ROTATING_COLORS
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mode2 = light.getDiffuserLightMode(0);
            if (mode2 !== DiffuserLightMode.ROTATING_COLORS) {
                results.push({
                    name: 'should change diffuser light mode',
                    passed: false,
                    skipped: false,
                    error: `Failed to set ROTATING_COLORS. Expected ${DiffuserLightMode.ROTATING_COLORS}, got ${mode2}`,
                    device: deviceName
                });
                return results;
            }
            
            await light.setDiffuserLight({
                channel: 0,
                mode: DiffuserLightMode.FIXED_RGB
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mode3 = light.getDiffuserLightMode(0);
            if (mode3 !== DiffuserLightMode.FIXED_RGB) {
                results.push({
                    name: 'should change diffuser light mode',
                    passed: false,
                    skipped: false,
                    error: `Failed to set FIXED_RGB. Expected ${DiffuserLightMode.FIXED_RGB}, got ${mode3}`,
                    device: deviceName
                });
                return results;
            }
            
            results.push({
                name: 'should change diffuser light mode',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
            
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
        
        try {
            await light.diffuser.get({ type: 'light', channel: 0 });
            
            await light.setDiffuserLight({
                channel: 0,
                onoff: 1
            });
            
            // Test brightness from 0 to 100 in steps of 10
            let allPassed = true;
            for (let i = 0; i <= 100; i += 10) {
                await light.setDiffuserLight({
                    channel: 0,
                    luminance: i
                });
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const brightness = light.getDiffuserLightBrightness(0);
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
        
        try {
            await spray.diffuser.getSpray({ channel: 0 });
            
            await spray.setDiffuserSpray(0, DiffuserSprayMode.LIGHT);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mode1 = spray.getDiffuserSprayMode(0);
            if (mode1 !== DiffuserSprayMode.LIGHT) {
                results.push({
                    name: 'should change diffuser spray mode',
                    passed: false,
                    skipped: false,
                    error: `Failed to set LIGHT. Expected ${DiffuserSprayMode.LIGHT}, got ${mode1}`,
                    device: deviceName
                });
                return results;
            }
            
            await spray.setDiffuserSpray(0, DiffuserSprayMode.STRONG);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mode2 = spray.getDiffuserSprayMode(0);
            if (mode2 !== DiffuserSprayMode.STRONG) {
                results.push({
                    name: 'should change diffuser spray mode',
                    passed: false,
                    skipped: false,
                    error: `Failed to set STRONG. Expected ${DiffuserSprayMode.STRONG}, got ${mode2}`,
                    device: deviceName
                });
                return results;
            }
            
            await spray.setDiffuserSpray(0, DiffuserSprayMode.OFF);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mode3 = spray.getDiffuserSprayMode(0);
            if (mode3 !== DiffuserSprayMode.OFF) {
                results.push({
                    name: 'should change diffuser spray mode',
                    passed: false,
                    skipped: false,
                    error: `Failed to set OFF. Expected ${DiffuserSprayMode.OFF}, got ${mode3}`,
                    device: deviceName
                });
                return results;
            }
            
            results.push({
                name: 'should change diffuser spray mode',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
            
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
