/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as minimist from 'minimist';
import * as assert from 'assert';
import { firstIndex } from 'vs/base/common/arrays';
import { localize } from 'vs/nls';
import { ParsedArgs } from '../common/environment';

const options: minimist.Opts = {
	string: [
		'locale',
		'user-data-dir',
		'extensions-dir',
		'extensionDevelopmentPath',
		'extensionTestsPath',
		'install-extension',
		'uninstall-extension',
		'debugId',
		'debugPluginHost',
		'debugBrkPluginHost',
		'debugSearch',
		'debugBrkSearch',
		'open-url',
		'enable-proposed-api',
		'export-default-configuration',
		'install-source'
	],
	boolean: [
		'help',
		'version',
		'wait',
		'diff',
		'add',
		'goto',
		'new-window',
		'unity-launch',
		'reuse-window',
		'performance',
		'prof-startup',
		'verbose',
		'logExtensionHostCommunication',
		'disable-extensions',
		'list-extensions',
		'show-versions',
		'nolazy',
		'skip-getting-started',
		'sticky-quickopen',
		'disable-telemetry',
		'disable-updates',
		'disable-crash-reporter',
		'skip-add-to-recently-opened',
		'ps'
	],
	alias: {
		add: 'a',
		help: 'h',
		version: 'v',
		wait: 'w',
		diff: 'd',
		goto: 'g',
		ps: 'p',
		'new-window': 'n',
		'reuse-window': 'r',
		performance: 'p',
		'disable-extensions': 'disableExtensions',
		'extensions-dir': 'extensionHomePath',
		'debugPluginHost': 'inspect-extensions',
		'debugBrkPluginHost': 'inspect-brk-extensions',
		'debugSearch': 'inspect-search',
		'debugBrkSearch': 'inspect-brk-search',
	}
};

function validate(args: ParsedArgs): ParsedArgs {
	if (args.goto) {
		args._.forEach(arg => assert(/^(\w:)?[^:]+(:\d*){0,2}$/.test(arg), localize('gotoValidation', "Arguments in `--goto` mode should be in the format of `FILE(:LINE(:CHARACTER))`.")));
	}

	return args;
}

function stripAppPath(argv: string[]): string[] {
	const index = firstIndex(argv, a => !/^-/.test(a));

	if (index > -1) {
		return [...argv.slice(0, index), ...argv.slice(index + 1)];
	}
	return undefined;
}

/**
 * Use this to parse raw code process.argv such as: `Electron . --verbose --wait`
 */
export function parseMainProcessArgv(processArgv: string[]): ParsedArgs {
	let [, ...args] = processArgv;

	// If dev, remove the first non-option argument: it's the app location
	if (process.env['VSCODE_DEV']) {
		args = stripAppPath(args);
	}

	return validate(parseArgs(args));
}

/**
 * Use this to parse raw code CLI process.argv such as: `Electron cli.js . --verbose --wait`
 */
export function parseCLIProcessArgv(processArgv: string[]): ParsedArgs {
	let [, , ...args] = processArgv;

	if (process.env['VSCODE_DEV']) {
		args = stripAppPath(args);
	}

	return validate(parseArgs(args));
}

/**
 * Use this to parse code arguments such as `--verbose --wait`
 */
export function parseArgs(args: string[]): ParsedArgs {
	return minimist(args, options) as ParsedArgs;
}

export const optionsHelp: { [name: string]: string; } = {
	'-d, --diff <file> <file>': localize('diff', "Compare two files with each other."),
	'-a, --add <dir>': localize('add', "Add folder(s) to the last active window."),
	'-g, --goto <file:line[:character]>': localize('goto', "Open a file at the path on the specified line and character position."),
	'--locale <locale>': localize('locale', "The locale to use (e.g. en-US or zh-TW)."),
	'-n, --new-window': localize('newWindow', "Force a new instance of Code."),
	'-p, --performance': localize('performance', "Start with the 'Developer: Startup Performance' command enabled."),
	'--prof-startup': localize('prof-startup', "Run CPU profiler during startup"),
	'--inspect-extensions': localize('inspect-extensions', "Allow debugging and profiling of extensions. Check the developer tools for the connection uri."),
	'--inspect-brk-extensions': localize('inspect-brk-extensions', "Allow debugging and profiling of extensions with the extension host being paused after start. Check the developer tools for the connection uri."),
	'-r, --reuse-window': localize('reuseWindow', "Force opening a file or folder in the last active window."),
	'--user-data-dir <dir>': localize('userDataDir', "Specifies the directory that user data is kept in, useful when running as root."),
	'--verbose': localize('verbose', "Print verbose output (implies --wait)."),
	'-w, --wait': localize('wait', "Wait for the files to be closed before returning."),
	'--extensions-dir <dir>': localize('extensionHomePath', "Set the root path for extensions."),
	'--list-extensions': localize('listExtensions', "List the installed extensions."),
	'--show-versions': localize('showVersions', "Show versions of installed extensions, when using --list-extension."),
	'--install-extension (<extension-id> | <extension-vsix-path>)': localize('installExtension', "Installs an extension."),
	'--uninstall-extension (<extension-id> | <extension-vsix-path>)': localize('uninstallExtension', "Uninstalls an extension."),
	'--enable-proposed-api <extension-id>': localize('experimentalApis', "Enables proposed api features for an extension."),
	'--disable-extensions': localize('disableExtensions', "Disable all installed extensions."),
	'--disable-gpu': localize('disableGPU', "Disable GPU hardware acceleration."),
	'-p, --ps': localize('ps', "Print process usage."),
	'-v, --version': localize('version', "Print version."),
	'-h, --help': localize('help', "Print usage.")
};

export function formatOptions(options: { [name: string]: string; }, columns: number): string {
	let keys = Object.keys(options);
	let argLength = Math.max.apply(null, keys.map(k => k.length)) + 2/*left padding*/ + 1/*right padding*/;
	if (columns - argLength < 25) {
		// Use a condensed version on narrow terminals
		return keys.reduce((r, key) => r.concat([`  ${key}`, `      ${options[key]}`]), []).join('\n');
	}
	let descriptionColumns = columns - argLength - 1;
	let result = '';
	keys.forEach(k => {
		let wrappedDescription = wrapText(options[k], descriptionColumns);
		let keyPadding = (<any>' ').repeat(argLength - k.length - 2/*left padding*/);
		if (result.length > 0) {
			result += '\n';
		}
		result += '  ' + k + keyPadding + wrappedDescription[0];
		for (let i = 1; i < wrappedDescription.length; i++) {
			result += '\n' + (<any>' ').repeat(argLength) + wrappedDescription[i];
		}
	});
	return result;
}

function wrapText(text: string, columns: number): string[] {
	let lines: string[] = [];
	while (text.length) {
		let index = text.length < columns ? text.length : text.lastIndexOf(' ', columns);
		let line = text.slice(0, index).trim();
		text = text.slice(index);
		lines.push(line);
	}
	return lines;
}

export function buildHelpMessage(fullName: string, name: string, version: string): string {
	const columns = (<any>process.stdout).isTTY ? (<any>process.stdout).columns : 80;
	const executable = `${name}${os.platform() === 'win32' ? '.exe' : ''}`;

	return `${fullName} ${version}

${ localize('usage', "Usage")}: ${executable} [${localize('options', "options")}] [${localize('paths', 'paths')}...]

${ localize('optionsUpperCase', "Options")}:
${formatOptions(optionsHelp, columns)}`;
}
