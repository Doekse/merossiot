'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function getConfigPath() {
    const configDir = path.join(os.homedir(), '.meross-cli');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { mode: 0o700 });
    }
    return path.join(configDir, 'users.json');
}

function loadUsers() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return {};
    }
    try {
        const data = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading user config: ${error.message}`);
        return {};
    }
}

function saveUsers(users) {
    const configPath = getConfigPath();
    try {
        fs.writeFileSync(configPath, JSON.stringify(users, null, 2), { mode: 0o600 });
        return true;
    } catch (error) {
        console.error(`Error saving user config: ${error.message}`);
        return false;
    }
}

function addUser(name, email, password, mfaCode = null) {
    if (!name || typeof name !== 'string' || !name.trim()) {
        return { success: false, error: 'User name cannot be empty' };
    }

    const trimmedName = name.trim();

    if (!email || typeof email !== 'string' || !email.trim()) {
        return { success: false, error: 'Email cannot be empty' };
    }

    if (!password || typeof password !== 'string' || !password) {
        return { success: false, error: 'Password cannot be empty' };
    }

    const users = loadUsers();
    if (users[trimmedName]) {
        return { success: false, error: `User "${trimmedName}" already exists` };
    }

    users[trimmedName] = {
        email: email.trim(),
        password,
        mfaCode: mfaCode || null,
        createdAt: new Date().toISOString()
    };

    if (saveUsers(users)) {
        return { success: true };
    }
    return { success: false, error: 'Failed to save user' };
}

function removeUser(name) {
    const users = loadUsers();
    if (!users[name]) {
        return { success: false, error: `User "${name}" not found` };
    }
    delete users[name];
    if (saveUsers(users)) {
        return { success: true };
    }
    return { success: false, error: 'Failed to save user config' };
}

function getUser(name) {
    const users = loadUsers();
    return users[name] || null;
}

function listUsers() {
    const users = loadUsers();
    return Object.keys(users).map(name => ({
        name,
        email: users[name].email,
        createdAt: users[name].createdAt
    }));
}

module.exports = {
    getConfigPath,
    loadUsers,
    saveUsers,
    addUser,
    removeUser,
    getUser,
    listUsers
};

