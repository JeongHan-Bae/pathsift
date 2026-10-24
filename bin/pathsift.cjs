#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const major = Number(process.versions.node.split('.')[0]);
const source = major >= 24;
const target = source
  ? path.join(root, 'src', 'boot', 'cli-main.ts')
  : path.join(root, 'dist', 'boot', 'cli-main.js');
if (process.env.PATHSIFT_LAUNCH_TRACE === '1') {
  console.error(`pathsift launch: ${source ? 'source-ts' : 'compiled-js'}`);
}
const nodeArguments = source ? ['--disable-warning=ExperimentalWarning', target] : [target];
const result = spawnSync(process.execPath, [...nodeArguments, ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) {
  console.error(`pathsift: ${result.error.message}`);
  process.exitCode = 1;
} else if (result.status !== null) {
  process.exitCode = result.status;
} else if (result.signal) {
  process.kill(process.pid, result.signal);
}
