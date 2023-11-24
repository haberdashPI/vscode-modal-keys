import * as vscode from 'vscode';
import * as keybindings from './keybindings';

export function activate(context: vscode.ExtensionContext) {
	keybindings.activate(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
