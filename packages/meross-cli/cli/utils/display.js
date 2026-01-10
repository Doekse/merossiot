'use strict';

const packageJson = require('../../package.json');

function getRepoUrl() {
    if (packageJson.repository && packageJson.repository.url) {
        return packageJson.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
    }
    return null;
}

const LOGO_ASCII = `


       ***********  ***********         ************           ******      ************          *********        *********
     ************** ************      ****************       ********    ****************      *************    *************
    *****      ***** *      *****    ******      *******    ******      ******      ******    ******   ******  ******   ******
    ****        *****        *****  *****      ********    *****       *****          *****   ****       **    ****       ****
    ****        *****        ***** *****    ********       ****        ****            *****  *********        *********
    ****        *****        ***** *****  ********        *****        ****            *****   ************     ************
    ****        *****        ***** ************     ***** *****        ****            *****       *********        **********
    ****        *****        *****  ********       *****  *****        *****          *****             *****     *       ****
    ****        *****        *****   ********   *******   *****         ********   *******    *****     *****  *****     *****
    ****        *****        *****     **************     *****           **************       *************    *************
    ****        *****        *****       **********        ****             **********          ***********      ***********


`;

function printLogo(showVersion = true, context = 'help') {
    console.log(LOGO_ASCII);
    const repoUrl = getRepoUrl();

    if (showVersion) {
        console.log(`Welcome to the Meross Cloud CLI Tool v${packageJson.version}`);
        if (repoUrl) {
            console.log(`${repoUrl}`);
        }
        console.log('');
    }

    if (context === 'help') {
        console.log('  Control and manage your Meross smart home devices from the command line.');
        if (repoUrl) {
            console.log(`  Documentation: ${repoUrl}`);
        }
        console.log('  Use \'meross-cli help\' to see available commands and options.\n');
    } else if (context === 'version') {
        console.log('');
    }
}

function printVersion() {
    console.log(`meross-cli v${packageJson.version}`);
    const repoUrl = getRepoUrl();
    if (repoUrl) {
        console.log(`Repository: ${repoUrl}`);
    }
    if (packageJson.license) {
        console.log(`License: ${packageJson.license}`);
    }
}

function formatDevice(device) {
    const status = device.deviceConnected ? 'connected' : 'disconnected';
    const onlineStatus = device.isOnline ? 'online' : 'offline';

    return {
        uuid: device.uuid || 'unknown',
        name: device.name || 'Unknown',
        type: device.deviceType || 'unknown',
        status,
        online: onlineStatus,
        firmware: device.firmwareVersion || 'unknown',
        hardware: device.hardwareVersion || 'unknown'
    };
}

module.exports = {
    LOGO_ASCII,
    getRepoUrl,
    printLogo,
    printVersion,
    formatDevice
};

