'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const readline = require('readline');
const packageJson = require('../../package.json');
const { LOGO_ASCII, getRepoUrl } = require('./display');

const LOGO_HEIGHT = 21;
const SIMPLE_HEADER_HEIGHT = 5;
const CONTENT_START_LINE = LOGO_HEIGHT + 1;
const SIMPLE_CONTENT_START_LINE = SIMPLE_HEADER_HEIGHT + 1;

function clearScreen() {
    process.stdout.write('\x1b[2J');
    process.stdout.write('\x1b[H');
}

function moveCursorToTop() {
    process.stdout.write('\x1b[H');
}

function moveCursorToLine(line) {
    process.stdout.write(`\x1b[${line};1H`);
}

function renderLogoAtTop(context = 'menu', currentUser = null, deviceCount = null) {
    moveCursorToTop();

    process.stdout.write(LOGO_ASCII);
    process.stdout.write(`Meross Cloud CLI Tool v${packageJson.version}\n`);
    const repoUrl = getRepoUrl();
    if (repoUrl) {
        process.stdout.write(`${repoUrl}\n`);
    }
    process.stdout.write('\n');

    if (context === 'menu') {
        if (currentUser) {
            process.stdout.write('  Welcome to the Meross IoT CLI tool\n');
            process.stdout.write(`  Logged in as: ${chalk.cyan(currentUser)}\n`);
            const count = deviceCount !== null ? deviceCount : 0;
            const deviceText = count === 1 ? 'device' : 'devices';
            process.stdout.write(`  Connected to ${chalk.green(count)} ${deviceText}\n`);
        } else {
            process.stdout.write('Welcome to the Meross IoT CLI tool. Please log in with your Meross account to continue.\n');
        }
    }

    moveCursorToLine(CONTENT_START_LINE);
}

function renderSimpleHeader(currentUser = null, deviceCount = null) {
    moveCursorToTop();

    const width = 80;
    const versionText = `Meross Cloud CLI Tool v${packageJson.version}`;
    const versionPadding = Math.floor((width - versionText.length) / 2);

    process.stdout.write(`╔${'═'.repeat(width - 2)}╗\n`);
    process.stdout.write(`║${' '.repeat(versionPadding - 1)}${versionText}${' '.repeat(width - versionPadding - versionText.length - 1)}║\n`);
    process.stdout.write(`╠${'═'.repeat(width - 2)}╣\n`);

    if (currentUser) {
        const count = deviceCount !== null ? deviceCount : 0;
        const deviceText = count === 1 ? 'device' : 'devices';
        const userText = `Logged in as: ${currentUser}`;
        const deviceTextPlain = `Connected: ${count} ${deviceText}`;
        const userLine = `Logged in as: ${chalk.cyan(currentUser)}`;
        const deviceLine = `Connected: ${chalk.green(count)} ${deviceText}`;

        const totalPlainLength = userText.length + deviceTextPlain.length;
        const spacing = Math.max(1, width - totalPlainLength - 6);

        process.stdout.write(`║  ${userLine}${' '.repeat(spacing)}${deviceLine}  ║\n`);
    } else {
        const notLoggedInText = 'Not logged in';
        const padding = width - notLoggedInText.length - 4;
        process.stdout.write(`║  ${chalk.yellow(notLoggedInText)}${' '.repeat(padding)}║\n`);
    }

    process.stdout.write(`╚${'═'.repeat(width - 2)}╝\n`);

    moveCursorToLine(SIMPLE_CONTENT_START_LINE);
}

function clearMenuArea(startLine = 5) {
    for (let i = startLine; i < process.stdout.rows || i < 30; i++) {
        process.stdout.write(`\x1b[${i};1H\x1b[K`);
    }
    process.stdout.write(`\x1b[${startLine};1H`);
}

function createRL() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

async function question(rl, query) {
    // For backward compatibility, use inquirer for better UX
    const result = await inquirer.prompt([{
        type: 'input',
        name: 'value',
        message: query.replace(/:\s*$/, '')
    }]);
    return result.value;
}

async function promptForPassword(rl, prompt = 'Password: ') {
    // Use inquirer for password input with better UX
    const result = await inquirer.prompt([{
        type: 'password',
        name: 'password',
        message: prompt.replace(/:\s*$/, ''),
        mask: '*'
    }]);
    return result.password;
}

module.exports = {
    LOGO_HEIGHT,
    SIMPLE_HEADER_HEIGHT,
    CONTENT_START_LINE,
    SIMPLE_CONTENT_START_LINE,
    clearScreen,
    moveCursorToTop,
    moveCursorToLine,
    renderLogoAtTop,
    renderSimpleHeader,
    clearMenuArea,
    createRL,
    question,
    promptForPassword
};

