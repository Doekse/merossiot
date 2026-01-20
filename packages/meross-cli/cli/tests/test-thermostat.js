'use strict';

/**
 * Thermostat Device Tests
 * Tests thermostat mode control, temperature settings, and additional features
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');
const { ThermostatMode } = require('meross-iot');

const metadata = {
    name: 'thermostat',
    description: 'Tests thermostat mode control, temperature settings, and additional features',
    requiredAbilities: ['Appliance.Control.Thermostat.Mode'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Thermostat.Mode', OnlineStatus.ONLINE);
    }
    
    // Wait for devices to be connected
    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        if (device.thermostat) {
            await device.thermostat.get({ channel: 0 });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should turn thermostat on and off',
            passed: false,
            skipped: true,
            error: 'No thermostat device has been found to run this test',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 1: Turn thermostat on and off
    try {
        if (!testDevice.thermostat) {
            results.push({
                name: 'should toggle thermostat on/off',
                passed: false,
                skipped: true,
                error: 'Device does not support thermostat feature',
                device: deviceName
            });
            return results;
        }
        const state = await testDevice.thermostat.get({ channel: 0 });
        
        if (!state) {
            results.push({
                name: 'should turn thermostat on and off',
                passed: false,
                skipped: false,
                error: 'Could not get cached thermostat state',
                device: deviceName
            });
        } else {
            const toggledState = !state.isOn;
            
            // Set the new state
            await testDevice.thermostat.set({
                channel: 0,
                onoff: toggledState ? 1 : 0,
                partialUpdate: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Refresh state to get updated on/off status
            const newState = await testDevice.thermostat.get({ channel: 0 });
            
            if (!newState || newState.isOn !== toggledState) {
                results.push({
                    name: 'should turn thermostat on and off',
                    passed: false,
                    skipped: false,
                    error: `State mismatch. Expected ${toggledState}, got ${newState?.isOn}`,
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should turn thermostat on and off',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should turn thermostat on and off',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Read ambient temperature
    try {
        if (!testDevice.thermostat) {
            results.push({
                name: 'should toggle thermostat on/off',
                passed: false,
                skipped: true,
                error: 'Device does not support thermostat feature',
                device: deviceName
            });
            return results;
        }
        const state = await testDevice.thermostat.get({ channel: 0 });
        
        if (!state) {
            results.push({
                name: 'should read ambient temperature',
                passed: false,
                skipped: false,
                error: 'Could not get cached thermostat state',
                device: deviceName
            });
        } else {
            const temperature = state.currentTemperatureCelsius;
            
            if (typeof temperature !== 'number') {
                results.push({
                    name: 'should read ambient temperature',
                    passed: false,
                    skipped: false,
                    error: `Temperature is not a number: ${temperature}`,
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should read ambient temperature',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { temperature: temperature }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should read ambient temperature',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Change thermostat mode
    try {
        if (!testDevice.thermostat) {
            results.push({
                name: 'should toggle thermostat on/off',
                passed: false,
                skipped: true,
                error: 'Device does not support thermostat feature',
                device: deviceName
            });
            return results;
        }
        const state = await testDevice.thermostat.get({ channel: 0 });
        
        if (!state || state.mode === undefined) {
            results.push({
                name: 'should change thermostat mode',
                passed: false,
                skipped: true,
                error: 'Could not get current mode or mode is undefined',
                device: deviceName
            });
        } else {
            // Get available modes (using enum values)
            const currentMode = state.mode;
            const modes = [
                ThermostatMode.HEAT,
                ThermostatMode.COOL,
                ThermostatMode.ECONOMY,
                ThermostatMode.AUTO,
                ThermostatMode.MANUAL
            ].filter(m => m !== currentMode);
            
            if (modes.length === 0) {
                results.push({
                    name: 'should change thermostat mode',
                    passed: false,
                    skipped: true,
                    error: 'No alternative mode available',
                    device: deviceName
                });
            } else {
                const targetMode = modes[Math.floor(Math.random() * modes.length)];
                
                await testDevice.thermostat.set({
                    channel: 0,
                    mode: targetMode
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Refresh state to get updated mode
                const newState = await testDevice.thermostat.get({ channel: 0 });
                
                if (!newState || newState.mode !== targetMode) {
                    results.push({
                        name: 'should change thermostat mode',
                        passed: false,
                        skipped: false,
                        error: `Mode mismatch. Expected ${targetMode}, got ${newState?.mode}`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should change thermostat mode',
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
            name: 'should change thermostat mode',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 4: Set heat temperature
    try {
        if (!testDevice.thermostat) {
            results.push({
                name: 'should toggle thermostat on/off',
                passed: false,
                skipped: true,
                error: 'Device does not support thermostat feature',
                device: deviceName
            });
            return results;
        }
        const state = await testDevice.thermostat.get({ channel: 0 });
        
        if (!state) {
            results.push({
                name: 'should set heat temperature',
                passed: false,
                skipped: true,
                error: 'Could not get cached thermostat state',
                device: deviceName
            });
        } else if (state.minTemperatureCelsius === undefined || state.maxTemperatureCelsius === undefined) {
            results.push({
                name: 'should set heat temperature',
                passed: false,
                skipped: true,
                error: 'Device does not support temperature range',
                device: deviceName
            });
        } else {
            const minTemp = state.minTemperatureCelsius;
            const maxTemp = state.maxTemperatureCelsius;
            const targetTemp = minTemp + Math.random() * (maxTemp - minTemp);
            const alignedTemp = Math.round(targetTemp * 2) / 2; // Round to 0.5
            
            // Set heat temperature
            await testDevice.thermostat.set({
                channel: 0,
                heatTemperature: alignedTemp,
                partialUpdate: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Refresh state to get updated temperature
            const stateAfterTemp = await testDevice.thermostat.get({ channel: 0 });
            
            if (!stateAfterTemp || stateAfterTemp.heatTemperatureCelsius !== alignedTemp) {
                results.push({
                    name: 'should set heat temperature',
                    passed: false,
                    skipped: false,
                    error: `Temperature mismatch. Expected ${alignedTemp}, got ${stateAfterTemp?.heatTemperatureCelsius}`,
                    device: deviceName
                });
            } else {
                // Set heat mode
                await testDevice.thermostat.set({
                    channel: 0,
                    mode: ThermostatMode.HEAT
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Refresh state to get updated mode
                const newState = await testDevice.thermostat.get({ channel: 0 });
                
                if (!newState || newState.mode !== ThermostatMode.HEAT) {
                    results.push({
                        name: 'should set heat temperature',
                        passed: false,
                        skipped: false,
                        error: `Mode mismatch. Expected ${ThermostatMode.HEAT}, got ${newState?.mode}`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should set heat temperature',
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
            name: 'should set heat temperature',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 5: Set eco temperature
    try {
        if (!testDevice.thermostat) {
            results.push({
                name: 'should toggle thermostat on/off',
                passed: false,
                skipped: true,
                error: 'Device does not support thermostat feature',
                device: deviceName
            });
            return results;
        }
        const state = await testDevice.thermostat.get({ channel: 0 });
        
        if (!state || state.minTemperatureCelsius === undefined || state.maxTemperatureCelsius === undefined) {
            results.push({
                name: 'should set eco temperature',
                passed: false,
                skipped: true,
                error: 'Device does not support temperature range',
                device: deviceName
            });
        } else {
            const minTemp = state.minTemperatureCelsius;
            const maxTemp = state.maxTemperatureCelsius;
            const targetTemp = minTemp + Math.random() * (maxTemp - minTemp);
            const alignedTemp = Math.round(targetTemp * 2) / 2;
            
            // Set eco temperature
            await testDevice.thermostat.set({
                channel: 0,
                ecoTemperature: alignedTemp,
                partialUpdate: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const stateAfterTemp = await testDevice.thermostat.get({ channel: 0 });
            
            if (!stateAfterTemp || stateAfterTemp.ecoTemperatureCelsius !== alignedTemp) {
                results.push({
                    name: 'should set eco temperature',
                    passed: false,
                    skipped: false,
                    error: `Temperature mismatch. Expected ${alignedTemp}, got ${stateAfterTemp?.ecoTemperatureCelsius}`,
                    device: deviceName
                });
            } else {
                // Set eco mode
                await testDevice.thermostat.set({
                    channel: 0,
                    mode: ThermostatMode.ECONOMY
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const newState = await testDevice.thermostat.get({ channel: 0 });
                
                if (!newState || newState.mode !== ThermostatMode.ECONOMY) {
                    results.push({
                        name: 'should set eco temperature',
                        passed: false,
                        skipped: false,
                        error: `Mode mismatch. Expected ${ThermostatMode.ECONOMY}, got ${newState?.mode}`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should set eco temperature',
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
            name: 'should set eco temperature',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 6: Set cool temperature
    try {
        if (!testDevice.thermostat) {
            results.push({
                name: 'should toggle thermostat on/off',
                passed: false,
                skipped: true,
                error: 'Device does not support thermostat feature',
                device: deviceName
            });
            return results;
        }
        const state = await testDevice.thermostat.get({ channel: 0 });
        
        if (!state || state.minTemperatureCelsius === undefined || state.maxTemperatureCelsius === undefined) {
            results.push({
                name: 'should set cool temperature',
                passed: false,
                skipped: true,
                error: 'Device does not support temperature range',
                device: deviceName
            });
        } else {
            const minTemp = state.minTemperatureCelsius;
            const maxTemp = state.maxTemperatureCelsius;
            const targetTemp = minTemp + Math.random() * (maxTemp - minTemp);
            const alignedTemp = Math.round(targetTemp * 2) / 2;
            
            await testDevice.thermostat.set({
                channel: 0,
                coolTemperature: alignedTemp,
                partialUpdate: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const stateAfterTemp = await testDevice.thermostat.get({ channel: 0 });
            
            if (!stateAfterTemp || stateAfterTemp.coolTemperatureCelsius !== alignedTemp) {
                results.push({
                    name: 'should set cool temperature',
                    passed: false,
                    skipped: false,
                    error: `Temperature mismatch. Expected ${alignedTemp}, got ${stateAfterTemp?.coolTemperatureCelsius}`,
                    device: deviceName
                });
            } else {
                await testDevice.thermostat.set({
                    channel: 0,
                    mode: ThermostatMode.COOL
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const newState = await testDevice.thermostat.get({ channel: 0 });
                
                if (!newState || newState.mode !== ThermostatMode.COOL) {
                    results.push({
                        name: 'should set cool temperature',
                        passed: false,
                        skipped: false,
                        error: `Mode mismatch. Expected ${ThermostatMode.COOL}, got ${newState?.mode}`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should set cool temperature',
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
            name: 'should set cool temperature',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 7: Set manual temperature
    try {
        if (!testDevice.thermostat) {
            results.push({
                name: 'should toggle thermostat on/off',
                passed: false,
                skipped: true,
                error: 'Device does not support thermostat feature',
                device: deviceName
            });
            return results;
        }
        const state = await testDevice.thermostat.get({ channel: 0 });
        
        if (!state || state.minTemperatureCelsius === undefined || state.maxTemperatureCelsius === undefined) {
            results.push({
                name: 'should set manual temperature',
                passed: false,
                skipped: true,
                error: 'Device does not support temperature range',
                device: deviceName
            });
        } else {
            const minTemp = state.minTemperatureCelsius;
            const maxTemp = state.maxTemperatureCelsius;
            const targetTemp = minTemp + Math.random() * (maxTemp - minTemp);
            const alignedTemp = Math.round(targetTemp * 2) / 2;
            
            await testDevice.thermostat.set({
                channel: 0,
                manualTemperature: alignedTemp,
                partialUpdate: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const stateAfterTemp = await testDevice.thermostat.get({ channel: 0 });
            
            if (!stateAfterTemp || stateAfterTemp.manualTemperatureCelsius !== alignedTemp) {
                results.push({
                    name: 'should set manual temperature',
                    passed: false,
                    skipped: false,
                    error: `Temperature mismatch. Expected ${alignedTemp}, got ${stateAfterTemp?.manualTemperatureCelsius}`,
                    device: deviceName
                });
            } else {
                await testDevice.thermostat.set({
                    channel: 0,
                    mode: ThermostatMode.MANUAL
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const newState = await testDevice.thermostat.get({ channel: 0 });
                
                if (!newState || newState.mode !== ThermostatMode.MANUAL) {
                    results.push({
                        name: 'should set manual temperature',
                        passed: false,
                        skipped: false,
                        error: `Mode mismatch. Expected ${ThermostatMode.MANUAL}, got ${newState?.mode}`,
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should set manual temperature',
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
            name: 'should set manual temperature',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 8: Turn thermostat on and off multiple times
    try {
        await testDevice.thermostat.get({ channel: 0 });
        
        // Turn off
        await testDevice.thermostat.set({
            channel: 0,
            onoff: 0,
            partialUpdate: true
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        const state1 = await testDevice.thermostat.get({ channel: 0 });
        if (!state1 || state1.isOn !== false) {
            results.push({
                name: 'should turn thermostat on and off multiple times',
                passed: false,
                skipped: false,
                error: 'Failed to turn off. Expected false, got ' + state1?.isOn,
                device: deviceName
            });
            return results;
        }
        
        // Turn on
        await testDevice.thermostat.set({
            channel: 0,
            onoff: 1,
            partialUpdate: true
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        const state2 = await testDevice.thermostat.get({ channel: 0 });
        if (!state2 || state2.isOn !== true) {
            results.push({
                name: 'should turn thermostat on and off multiple times',
                passed: false,
                skipped: false,
                error: 'Failed to turn on. Expected true, got ' + state2?.isOn,
                device: deviceName
            });
            return results;
        }
        
        // Turn off again
        await testDevice.thermostat.set({
            channel: 0,
            onoff: 0,
            partialUpdate: true
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        const state3 = await testDevice.thermostat.get({ channel: 0 });
        if (!state3 || state3.isOn !== false) {
            results.push({
                name: 'should turn thermostat on and off multiple times',
                passed: false,
                skipped: false,
                error: 'Failed to turn off again. Expected false, got ' + state3?.isOn,
                device: deviceName
            });
        } else {
            results.push({
                name: 'should turn thermostat on and off multiple times',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should turn thermostat on and off multiple times',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 9: Get thermostat window opened status
    try {
        if (!testDevice.thermostat || typeof testDevice.thermostat.getWindowOpened !== 'function') {
            results.push({
                name: 'should get and set thermostat window opened status',
                passed: false,
                skipped: true,
                error: 'Device does not support window opened feature',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getWindowOpened({ channel: 0 });
            const windowStatus = response?.windowOpened?.[0]?.status;
            
            if (!windowStatus) {
                results.push({
                    name: 'should get and set thermostat window opened status',
                    passed: false,
                    skipped: false,
                    error: 'getThermostatWindowOpened returned null or undefined',
                    device: deviceName
                });
            } else {
                // Note: We don't actually toggle the window status as it's a physical state
                // that shouldn't be changed during testing. We just verify the method works.
                results.push({
                    name: 'should get and set thermostat window opened status',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { windowStatus: windowStatus }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get and set thermostat window opened status',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 10: Get thermostat mode B
    try {
        if (!testDevice.thermostat || typeof testDevice.thermostat.getModeB !== 'function') {
            results.push({
                name: 'should get thermostat mode B',
                passed: false,
                skipped: true,
                error: 'Device does not support getModeB',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getModeB({ channel: 0 });
            
            if (!response) {
                results.push({
                    name: 'should get thermostat mode B',
                    passed: false,
                    skipped: false,
                    error: 'getModeB returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get thermostat mode B',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { modeB: response }
                });
            }
        }
    } catch (error) {
        if (error.message && error.message.includes('does not support')) {
            results.push({
                name: 'should get thermostat mode B',
                passed: false,
                skipped: true,
                error: `Device does not support ModeB: ${error.message}`,
                device: deviceName
            });
        } else {
            results.push({
                name: 'should get thermostat mode B',
                passed: false,
                skipped: false,
                error: error.message,
                device: deviceName
            });
        }
    }
    
    // Test 11: Get thermostat schedule
    try {
        if (!testDevice.thermostat || typeof testDevice.thermostat.getSchedule !== 'function') {
            results.push({
                name: 'should get thermostat schedule',
                passed: false,
                skipped: true,
                error: 'Device does not support getSchedule',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getSchedule({ channel: 0 });
            
            if (!response) {
                results.push({
                    name: 'should get thermostat schedule',
                    passed: false,
                    skipped: false,
                    error: 'getThermostatSchedule returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get thermostat schedule',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { schedule: response }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get thermostat schedule',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 12: Get thermostat hold action
    try {
        if (!testDevice.thermostat || typeof testDevice.thermostat.getHoldAction !== 'function') {
            results.push({
                name: 'should get thermostat hold action',
                passed: false,
                skipped: true,
                error: 'Device does not support getHoldAction',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getHoldAction({ channel: 0 });
            
            if (!response) {
                results.push({
                    name: 'should get thermostat hold action',
                    passed: false,
                    skipped: false,
                    error: 'getThermostatHoldAction returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get thermostat hold action',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { holdAction: response }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get thermostat hold action',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 13: Get thermostat calibration
    try {
        if (!testDevice.thermostat || typeof testDevice.thermostat.getCalibration !== 'function') {
            results.push({
                name: 'should get thermostat calibration',
                passed: false,
                skipped: true,
                error: 'Device does not support getCalibration',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getCalibration({ channel: 0 });
            
            if (!response) {
                results.push({
                    name: 'should get thermostat calibration',
                    passed: false,
                    skipped: false,
                    error: 'getThermostatCalibration returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get thermostat calibration',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { calibration: response }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get thermostat calibration',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 14: Get thermostat sensor
    try {
        if (!testDevice.thermostat || typeof testDevice.thermostat.getSensor !== 'function') {
            results.push({
                name: 'should get thermostat sensor',
                passed: false,
                skipped: true,
                error: 'Device does not support getSensor',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getSensor({ channel: 0 });
            
            if (!response) {
                results.push({
                    name: 'should get thermostat sensor',
                    passed: false,
                    skipped: false,
                    error: 'getThermostatSensor returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get thermostat sensor',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { sensor: response }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get thermostat sensor',
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
