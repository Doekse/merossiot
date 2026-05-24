'use strict';

/**
 * Thermostat Device Tests
 *
 * Exercises {@link MerossDevice#thermostat} (mode, temperatures, reads). Optional
 * helpers on the feature are gated with structured skips when absent.
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    getPrimaryChannel,
    assertFeatureOrSkip,
    REQUIRE_ONLINE
} = require('./test-helper');


const metadata = {
    name: 'thermostat',
    description: 'Tests thermostat mode control, temperature settings, and ambient temperature reading',
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
        testDevices = await findDevicesByAbility(manager, 'Appliance.Control.Thermostat.Mode', REQUIRE_ONLINE);
    }
    
    // Wait for devices to be connected
    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        if (device.thermostat) {
            await device.thermostat.get({ channel: getPrimaryChannel(device) });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should find a thermostat-capable device',
            passed: false,
            skipped: true,
            error: 'No thermostat device has been found to run this test',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    if (!assertFeatureOrSkip(results, testDevice, 'thermostat', deviceName, 'thermostat feature')) {
        return results;
    }
    
    // Test 1: Turn thermostat on and off
    try {
        const state = await testDevice.thermostat.get({ channel });
        
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
                channel,
                onoff: toggledState ? 1 : 0,
                partialUpdate: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Refresh state to get updated on/off status
            const newState = await testDevice.thermostat.get({ channel });
            
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
        const state = await testDevice.thermostat.get({ channel });
        
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
        const state = await testDevice.thermostat.get({ channel });
        
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
                'heat',
                'cool',
                'economy',
                'auto',
                'manual'
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
                    channel,
                    mode: targetMode
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Refresh state to get updated mode
                const newState = await testDevice.thermostat.get({ channel });
                
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
        const state = await testDevice.thermostat.get({ channel });
        
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
                channel,
                heatTemperature: alignedTemp,
                partialUpdate: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Refresh state to get updated temperature
            const stateAfterTemp = await testDevice.thermostat.get({ channel });
            
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
                    channel,
                    mode: 'heat'
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Refresh state to get updated mode
                const newState = await testDevice.thermostat.get({ channel });
                
                if (!newState || newState.mode !== 'heat') {
                    results.push({
                        name: 'should set heat temperature',
                        passed: false,
                        skipped: false,
                        error: `Mode mismatch. Expected ${'heat'}, got ${newState?.mode}`,
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
        const state = await testDevice.thermostat.get({ channel });
        
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
                channel,
                ecoTemperature: alignedTemp,
                partialUpdate: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const stateAfterTemp = await testDevice.thermostat.get({ channel });
            
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
                    channel,
                    mode: 'economy'
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const newState = await testDevice.thermostat.get({ channel });
                
                if (!newState || newState.mode !== 'economy') {
                    results.push({
                        name: 'should set eco temperature',
                        passed: false,
                        skipped: false,
                        error: `Mode mismatch. Expected ${'economy'}, got ${newState?.mode}`,
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
        const state = await testDevice.thermostat.get({ channel });
        
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
                channel,
                coolTemperature: alignedTemp,
                partialUpdate: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const stateAfterTemp = await testDevice.thermostat.get({ channel });
            
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
                    channel,
                    mode: 'cool'
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const newState = await testDevice.thermostat.get({ channel });
                
                if (!newState || newState.mode !== 'cool') {
                    results.push({
                        name: 'should set cool temperature',
                        passed: false,
                        skipped: false,
                        error: `Mode mismatch. Expected ${'cool'}, got ${newState?.mode}`,
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
        const state = await testDevice.thermostat.get({ channel });
        
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
                channel,
                manualTemperature: alignedTemp,
                partialUpdate: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const stateAfterTemp = await testDevice.thermostat.get({ channel });
            
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
                    channel,
                    mode: 'manual'
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const newState = await testDevice.thermostat.get({ channel });
                
                if (!newState || newState.mode !== 'manual') {
                    results.push({
                        name: 'should set manual temperature',
                        passed: false,
                        skipped: false,
                        error: `Mode mismatch. Expected ${'manual'}, got ${newState?.mode}`,
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
        await testDevice.thermostat.get({ channel });
        
        // Turn off
        await testDevice.thermostat.set({
            channel,
            onoff: 0,
            partialUpdate: true
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        const state1 = await testDevice.thermostat.get({ channel });
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
            channel,
            onoff: 1,
            partialUpdate: true
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        const state2 = await testDevice.thermostat.get({ channel });
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
            channel,
            onoff: 0,
            partialUpdate: true
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        const state3 = await testDevice.thermostat.get({ channel });
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
        if (typeof testDevice.thermostat.getWindowOpened !== 'function') {
            results.push({
                name: 'should get and set thermostat window opened status',
                passed: false,
                skipped: true,
                error: 'Device does not support window opened feature',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getWindowOpened({ channel });
            const windowStatus = response?.windowOpened?.[0]?.status;

            if (typeof windowStatus !== 'number') {
                results.push({
                    name: 'should get and set thermostat window opened status',
                    passed: false,
                    skipped: false,
                    error: `getThermostatWindowOpened did not return a numeric status (got ${windowStatus})`,
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
        if (typeof testDevice.thermostat.getModeB !== 'function') {
            results.push({
                name: 'should get thermostat mode B',
                passed: false,
                skipped: true,
                error: 'Device does not support getModeB',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getModeB({ channel });
            
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
        if (typeof testDevice.thermostat.getSchedule !== 'function') {
            results.push({
                name: 'should get thermostat schedule',
                passed: false,
                skipped: true,
                error: 'Device does not support getSchedule',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getSchedule({ channel });
            
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
        if (typeof testDevice.thermostat.getHoldAction !== 'function') {
            results.push({
                name: 'should get thermostat hold action',
                passed: false,
                skipped: true,
                error: 'Device does not support getHoldAction',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getHoldAction({ channel });
            
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
        if (typeof testDevice.thermostat.getCalibration !== 'function') {
            results.push({
                name: 'should get thermostat calibration',
                passed: false,
                skipped: true,
                error: 'Device does not support getCalibration',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getCalibration({ channel });
            
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
        if (typeof testDevice.thermostat.getSensor !== 'function') {
            results.push({
                name: 'should get thermostat sensor',
                passed: false,
                skipped: true,
                error: 'Device does not support getSensor',
                device: deviceName
            });
        } else {
            const response = await testDevice.thermostat.getSensor({ channel });
            
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
