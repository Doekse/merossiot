'use strict';

/**
 * Encryption Device Tests
 * Tests encryption support, key management, and message encryption/decryption
 */

const { findDevicesByAbility, waitForDeviceConnection, getDeviceName, OnlineStatus } = require('./test-helper');

const metadata = {
    name: 'encryption',
    description: 'Tests encryption support, key management, and message encryption/decryption',
    requiredAbilities: ['Appliance.Encrypt.ECDHE', 'Appliance.Encrypt.Suite'],
    minDevices: 1
};

async function runTests(context) {
    const { manager, devices, options = {} } = context;
    const timeout = options.timeout || 30000;
    const results = [];
    
    // If no devices provided, discover them
    let testDevices = devices || [];
    if (testDevices.length === 0) {
        // Find devices with encryption support
        const encryptionDevices = await findDevicesByAbility(manager, 'Appliance.Encrypt.ECDHE', OnlineStatus.ONLINE);
        
        // Also check for Appliance.Encrypt.Suite
        const suiteDevices = await findDevicesByAbility(manager, 'Appliance.Encrypt.Suite', OnlineStatus.ONLINE);
        
        // Combine and deduplicate
        const allDevices = [...encryptionDevices];
        for (const device of suiteDevices) {
            if (!allDevices.find(d => d.dev.uuid === device.dev.uuid)) {
                allDevices.push(device);
            }
        }
        
        testDevices = allDevices.slice(0, 3); // Test up to 3 devices
    }
    
    // Wait for devices to be connected
    for (const device of testDevices) {
        await waitForDeviceConnection(device, timeout);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (testDevices.length === 0) {
        results.push({
            name: 'should detect encryption support',
            passed: false,
            skipped: true,
            error: 'No device with encryption support has been found to run this test',
            device: null
        });
        return results;
    }
    
    const testDevice = testDevices[0];
    const deviceName = getDeviceName(testDevice);
    
    // Test 1: Detect encryption support
    try {
        if (typeof testDevice.supportEncryption !== 'function') {
            results.push({
                name: 'should detect encryption support',
                passed: false,
                skipped: true,
                error: 'Device does not have encryption feature methods',
                device: deviceName
            });
        } else {
            const supportsEncryption = testDevice.supportEncryption();
            
            // Check if encryption key is set
            let isKeySet = false;
            if (supportsEncryption) {
                isKeySet = testDevice.isEncryptionKeySet();
            }
            
            results.push({
                name: 'should detect encryption support',
                passed: true,
                skipped: false,
                error: null,
                device: deviceName,
                details: { 
                    supportsEncryption: supportsEncryption,
                    isKeySet: isKeySet
                }
            });
        }
    } catch (error) {
        results.push({
            name: 'should detect encryption support',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 2: Set encryption key if supported
    try {
        if (typeof testDevice.supportEncryption !== 'function' || !testDevice.supportEncryption()) {
            results.push({
                name: 'should set encryption key if supported',
                passed: false,
                skipped: true,
                error: 'Device does not support encryption',
                device: deviceName
            });
        } else {
            // Check if key is already set
            const isKeySet = testDevice.isEncryptionKeySet();
            
            // If key is not set and we have the required info, set it
            if (!isKeySet && testDevice.dev && testDevice.dev.uuid && manager.key && testDevice._macAddress) {
                testDevice.setEncryptionKey(testDevice.dev.uuid, manager.key, testDevice._macAddress);
                
                const keySetAfter = testDevice.isEncryptionKeySet();
                
                if (!keySetAfter) {
                    results.push({
                        name: 'should set encryption key if supported',
                        passed: false,
                        skipped: false,
                        error: 'Encryption key was not set successfully',
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should set encryption key if supported',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName,
                        details: { keySet: true }
                    });
                }
            } else if (!isKeySet) {
                results.push({
                    name: 'should set encryption key if supported',
                    passed: false,
                    skipped: true,
                    error: 'Cannot set encryption key - missing required information (UUID, key, or MAC address)',
                    device: deviceName
                });
            } else {
                results.push({
                    name: 'should set encryption key if supported',
                    passed: true,
                    skipped: false,
                    error: null,
                    device: deviceName,
                    details: { keySet: true, note: 'Key was already set' }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should set encryption key if supported',
            passed: false,
            skipped: false,
            error: error.message,
            device: deviceName
        });
    }
    
    // Test 3: Encrypt and decrypt messages if encryption key is set
    try {
        if (typeof testDevice.supportEncryption !== 'function' || !testDevice.supportEncryption()) {
            results.push({
                name: 'should encrypt and decrypt messages if encryption key is set',
                passed: false,
                skipped: true,
                error: 'Device does not support encryption',
                device: deviceName
            });
        } else {
            // Ensure encryption key is set
            if (!testDevice.isEncryptionKeySet()) {
                if (testDevice.dev && testDevice.dev.uuid && manager.key && testDevice._macAddress) {
                    testDevice.setEncryptionKey(testDevice.dev.uuid, manager.key, testDevice._macAddress);
                } else {
                    results.push({
                        name: 'should encrypt and decrypt messages if encryption key is set',
                        passed: false,
                        skipped: true,
                        error: 'Cannot set encryption key - missing required information',
                        device: deviceName
                    });
                    return results;
                }
            }
            
            // Test encryption/decryption
            const testMessage = { test: 'data', value: 123 };
            
            try {
                const encrypted = testDevice.encryptMessage(testMessage);
                
                if (!encrypted) {
                    results.push({
                        name: 'should encrypt and decrypt messages if encryption key is set',
                        passed: false,
                        skipped: false,
                        error: 'encryptMessage returned null or undefined',
                        device: deviceName
                    });
                    return results;
                }
                
                // Encrypted message should be different from original
                if (JSON.stringify(encrypted) === JSON.stringify(testMessage)) {
                    results.push({
                        name: 'should encrypt and decrypt messages if encryption key is set',
                        passed: false,
                        skipped: false,
                        error: 'Encrypted message is identical to original message',
                        device: deviceName
                    });
                    return results;
                }
                
                const decrypted = testDevice.decryptMessage(encrypted);
                
                if (!decrypted) {
                    results.push({
                        name: 'should encrypt and decrypt messages if encryption key is set',
                        passed: false,
                        skipped: false,
                        error: 'decryptMessage returned null or undefined',
                        device: deviceName
                    });
                } else if (JSON.stringify(decrypted) !== JSON.stringify(testMessage)) {
                    results.push({
                        name: 'should encrypt and decrypt messages if encryption key is set',
                        passed: false,
                        skipped: false,
                        error: 'Decrypted message does not match original',
                        device: deviceName
                    });
                } else {
                    results.push({
                        name: 'should encrypt and decrypt messages if encryption key is set',
                        passed: true,
                        skipped: false,
                        error: null,
                        device: deviceName
                    });
                }
            } catch (error) {
                // This is okay - encryption might not be fully implemented or might require specific conditions
                results.push({
                    name: 'should encrypt and decrypt messages if encryption key is set',
                    passed: false,
                    skipped: false,
                    error: `Encryption/decryption test failed: ${error.message}`,
                    device: deviceName,
                    details: { note: 'Encryption might not be fully implemented or might require specific conditions' }
                });
            }
        }
    } catch (error) {
        results.push({
            name: 'should encrypt and decrypt messages if encryption key is set',
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
