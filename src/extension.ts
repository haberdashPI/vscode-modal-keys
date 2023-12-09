import * as vscode from 'vscode';
import * as keybindings from './keybindings';
import * as commands from './commands';
import * as searching from './searching';

export function activate(context: vscode.ExtensionContext) {
	keybindings.activate(context);
	commands.activate(context);
	searching.activate(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
