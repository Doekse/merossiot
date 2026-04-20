'use strict';

/**
 * Roller Shutter Device Tests
 *
 * Uses {@link MerossDevice#rollerShutter} for motion, timers, and config. State-change
 * listeners compare `event.channel` to {@link getPrimaryChannel} so multi-channel devices match.
 */

const {
    findDevicesByAbility,
    waitForDeviceConnection,
    getDeviceName,
    getPrimaryChannel,
    assertFeatureOrSkip,
    OnlineStatus
} = require('./test-helper');

const DEFAULT_OPEN_TIMER = 15;
const DEFAULT_CLOSE_TIMER = 15;

const metadata = {
    name: 'shutter',
    description: 'Tests open/close control and position setting for roller shutters',
    requiredAbilities: ['Appliance.RollerShutter.State'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 120000; // Roller shutters take time
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        testDevices = await findDevicesByAbility(manager, 'Appliance.RollerShutter.State', OnlineStatus.ONLINE);
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should open roller shutter',
            passed: false,
            skipped: true,
            error: 'No RollerShutter device has been found to run this test on',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    const channel = getPrimaryChannel(testDevice);

    await waitForDeviceConnection(testDevice, timeout);
    if (!assertFeatureOrSkip(results, testDevice, 'rollerShutter', deviceName, 'rollerShutter feature')) {
        return results;
    }

    await testDevice.rollerShutter.get({ channel });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 1: Open roller shutter
    try {
        await testDevice.rollerShutter.get({ channel });
        
        // Set timers (if method exists)
        if (testDevice.rollerShutter && typeof testDevice.rollerShutter.setConfig === 'function') {
            await testDevice.rollerShutter.setConfig({
                config: [{
                    channel,
                    open_timer_duration_millis: DEFAULT_OPEN_TIMER * 1000,
                    close_timer_duration_millis: DEFAULT_CLOSE_TIMER * 1000
                }]
            });
        }
        
        // Set up event listeners for state changes
        let stateOpening = false;
        let stateIdle = false;
        let positionOpened = false;
        
        const onStateChange = (event) => {
            if (event.type === 'rollerShutter' && event.channel === channel) {
                if (event.value.state !== undefined) {
                    if (event.value.state === 1) { // OPENING
                        stateOpening = true;
                    } else if (event.value.state === 0) { // IDLE
                        stateIdle = true;
                    }
                }
                if (event.value.position !== undefined && event.value.position === 100) {
                    positionOpened = true;
                }
            }
        };
        
        testDevice.on('stateChange', onStateChange);
        
        // Trigger the opening
        if (testDevice.rollerShutter && typeof testDevice.rollerShutter.open === 'function') {
            await testDevice.rollerShutter.open({ channel });
        } else {
            await testDevice.rollerShutter.set({ position: 100, channel });
        }
        
        // Wait for state changes
        const startTime = Date.now();
        while (!stateOpening && Date.now() - startTime < 30000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!stateOpening) {
            testDevice.removeListener('stateChange', onStateChange);
            results.push({
                name: 'should open roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive OPENING state within 30 seconds',
                device: deviceName
            });
            return results;
        }
        
        while (!stateIdle && Date.now() - startTime < 90000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!stateIdle) {
            testDevice.removeListener('stateChange', onStateChange);
            results.push({
                name: 'should open roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive IDLE state within 90 seconds',
                device: deviceName
            });
            return results;
        }
        
        while (!positionOpened && Date.now() - startTime < 120000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        testDevice.removeListener('stateChange', onStateChange);
        
        if (!positionOpened) {
            results.push({
                name: 'should open roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive position 100 within 120 seconds',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should open roller shutter',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should open roller shutter',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Close roller shutter
    try {
        // Set timers (if method exists)
        if (testDevice.rollerShutter && typeof testDevice.rollerShutter.setConfig === 'function') {
            await testDevice.rollerShutter.setConfig({
                config: [{
                    channel,
                    open_timer_duration_millis: DEFAULT_OPEN_TIMER * 1000,
                    close_timer_duration_millis: DEFAULT_CLOSE_TIMER * 1000
                }]
            });
        }
        
        // Update its status
        await testDevice.rollerShutter.get({ channel });
        
        // Set up event listeners for state changes
        let stateClosing = false;
        let stateIdle = false;
        let positionClosed = false;
        
        const onStateChange = (event) => {
            if (event.type === 'rollerShutter' && event.channel === channel) {
                if (event.value.state !== undefined) {
                    if (event.value.state === 2) { // CLOSING
                        stateClosing = true;
                    } else if (event.value.state === 0) { // IDLE
                        stateIdle = true;
                    }
                }
                if (event.value.position !== undefined && event.value.position === 0) {
                    positionClosed = true;
                }
            }
        };
        
        testDevice.on('stateChange', onStateChange);
        
        // Trigger the closing
        if (testDevice.rollerShutter && typeof testDevice.rollerShutter.close === 'function') {
            await testDevice.rollerShutter.close({ channel });
        } else {
            await testDevice.rollerShutter.set({ position: 0, channel });
        }
        
        // Wait for state changes
        const startTime = Date.now();
        while (!stateClosing && Date.now() - startTime < 30000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!stateClosing) {
            testDevice.removeListener('stateChange', onStateChange);
            results.push({
                name: 'should close roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive CLOSING state within 30 seconds',
                device: deviceName
            });
            return results;
        }
        
        while (!stateIdle && Date.now() - startTime < 90000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!stateIdle) {
            testDevice.removeListener('stateChange', onStateChange);
            results.push({
                name: 'should close roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive IDLE state within 90 seconds',
                device: deviceName
            });
            return results;
        }
        
        while (!positionClosed && Date.now() - startTime < 120000) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        testDevice.removeListener('stateChange', onStateChange);
        
        if (!positionClosed) {
            results.push({
                name: 'should close roller shutter',
                passed: false,
                skipped: false,
                error: 'Did not receive position 0 within 120 seconds',
                device: deviceName
            });
        } else {
            results.push({
                name: 'should close roller shutter',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName
            });
        }
    } catch (error) {
        results.push({
            name: 'should close roller shutter',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Get opening timer duration
    try {
        const state = await testDevice.rollerShutter.get({ channel });
        
        if (!state) {
            results.push({
                name: 'should get opening timer duration',
                passed: false,
                skipped: false,
                error: 'Could not get cached roller shutter state',
                device: deviceName
            });
        } else {
            const openingTimer = state.open_timer_duration_millis;
            
            if (!openingTimer || openingTimer <= 0) {
                results.push({
                    name: 'should get opening timer duration',
                    passed: false,
                    skipped: false,
                    error: `Invalid opening timer: ${openingTimer}`,
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get opening timer duration',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { openingTimer: openingTimer }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get opening timer duration',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 4: Get closing timer duration
    try {
        const state = await testDevice.rollerShutter.get({ channel });
        
        if (!state) {
            results.push({
                name: 'should get closing timer duration',
                passed: false,
                skipped: false,
                error: 'Could not get cached roller shutter state',
                device: deviceName
            });
        } else {
            const closingTimer = state.close_timer_duration_millis;
            
            if (!closingTimer || closingTimer <= 0) {
                results.push({
                    name: 'should get closing timer duration',
                    passed: false,
                    skipped: false,
                    error: `Invalid closing timer: ${closingTimer}`,
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get closing timer duration',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { closingTimer: closingTimer }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get closing timer duration',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 5: Set roller shutter config timers
    try {
        // Retrieve original values
        const originalState = await testDevice.rollerShutter.get({ channel });
        
        if (!originalState) {
            results.push({
                name: 'should set roller shutter config timers',
                passed: false,
                skipped: true,
                error: 'Could not get original state',
                device: deviceName
            });
        } else if (!testDevice.rollerShutter || typeof testDevice.rollerShutter.setConfig !== 'function') {
            results.push({
                name: 'should set roller shutter config timers',
                passed: false,
                skipped: true,
                error: 'Device does not support setConfig',
                device: deviceName
            });
        } else {
            const originalOpenTimer = originalState.open_timer_duration_millis;
            const originalCloseTimer = originalState.close_timer_duration_millis;
            
            // Set new random values
            const openTimer = Math.floor(Math.random() * (120 - 10 + 1)) + 10; // 10-120 seconds
            const closeTimer = Math.floor(Math.random() * (120 - 10 + 1)) + 10; // 10-120 seconds
            
            await testDevice.rollerShutter.setConfig({
                config: [{
                    channel,
                    open_timer_duration_millis: openTimer * 1000,
                    close_timer_duration_millis: closeTimer * 1000
                }]
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const newState = await testDevice.rollerShutter.get({ channel });
            
            if (!newState) {
                results.push({
                    name: 'should set roller shutter config timers',
                    passed: false,
                    skipped: false,
                    error: 'Could not get new state after setting config',
                    device: deviceName
                });
            } else if (newState.open_timer_duration_millis !== openTimer * 1000 || 
                       newState.close_timer_duration_millis !== closeTimer * 1000) {
                results.push({
                    name: 'should set roller shutter config timers',
                    passed: false,
                    skipped: false,
                    error: `Timer mismatch. Expected open=${openTimer * 1000}, close=${closeTimer * 1000}, got open=${newState.open_timer_duration_millis}, close=${newState.close_timer_duration_millis}`,
                    device: deviceName
                });
            } else {
                // Restore original values
                await testDevice.rollerShutter.setConfig({
                    config: [{
                        channel,
                        open_timer_duration_millis: originalOpenTimer,
                        close_timer_duration_millis: originalCloseTimer
                    }]
                });
                
                results.push({
                    name: 'should set roller shutter config timers',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should set roller shutter config timers',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 6: Get roller shutter config
    try {
        if (!testDevice.rollerShutter || typeof testDevice.rollerShutter.getConfig !== 'function') {
            results.push({
                name: 'should get roller shutter config',
                passed: false,
                skipped: true,
                error: 'Device does not support getConfig',
                device: deviceName
            });
        } else {
            const response = await testDevice.rollerShutter.getConfig();
            const config = response?.config;
            
            if (!config) {
                results.push({
                    name: 'should get roller shutter config',
                    passed: false,
                    skipped: false,
                    error: 'getRollerShutterConfig returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get roller shutter config',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { config: config.config || config }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get roller shutter config',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 7: Get roller shutter position
    try {
        if (!testDevice.rollerShutter || typeof testDevice.rollerShutter.getPosition !== 'function') {
            results.push({
                name: 'should get roller shutter position',
                passed: false,
                skipped: true,
                error: 'Device does not support getPosition',
                device: deviceName
            });
        } else {
            const response = await testDevice.rollerShutter.getPosition({ channel });
            
            if (!response) {
                results.push({
                    name: 'should get roller shutter position',
                    passed: false,
                    skipped: false,
                    error: 'getRollerShutterPosition returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get roller shutter position',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { position: response }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get roller shutter position',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 8: Position control surface (set is the public API for position per RollerShutterFeature)
    try {
        if (typeof testDevice.rollerShutter.set !== 'function') {
            results.push({
                name: 'should expose roller shutter position control (set)',
                passed: false,
                skipped: true,
                error: 'rollerShutter.set is not available',
                device: deviceName
            });
        } else {
            if (typeof testDevice.rollerShutter.getPosition === 'function') {
                await testDevice.rollerShutter.getPosition({ channel });
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            results.push({
                name: 'should expose roller shutter position control (set)',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { note: 'Open/close tests exercise set; no extra move here to avoid disruption' }
            });
        }
    } catch (error) {
        results.push({
            name: 'should control roller shutter position',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 9: Get roller shutter adjust
    try {
        if (!testDevice.rollerShutter || typeof testDevice.rollerShutter.getAdjust !== 'function') {
            results.push({
                name: 'should get roller shutter adjust',
                passed: false,
                skipped: true,
                error: 'Device does not support getAdjust',
                device: deviceName
            });
        } else {
            const response = await testDevice.rollerShutter.getAdjust({ channel });
            
            if (!response) {
                results.push({
                    name: 'should get roller shutter adjust',
                    passed: false,
                    skipped: false,
                    error: 'getRollerShutterAdjust returned null or undefined',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should get roller shutter adjust',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { adjust: response }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should get roller shutter adjust',
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
