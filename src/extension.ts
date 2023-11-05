/**
 * # Extension Entry Point
 *
 * The module `vscode` contains the VS Code extensibility API. The other
 * modules are part of the extension.
 */
import * as vscode from 'vscode'
import * as actions from './actions'
import * as commands from './commands'
import * as keymap from './keymap'
import * as keytips from "./keytips"

/**
 * This method is called when the extension is activated. The activation events
 * are set in the `package.json` like this:
 * ```js
 * "activationEvents": [ "*" ],
 * ```
 * which means that the extension is activated as soon as VS Code is running.
 */
export function activate(context: vscode.ExtensionContext) {
	let keymapState = keymap.register(context);
	let keyTipState = keytips.register(context)

	/**
	 * The commands are defined in the `package.json` file. We register them
	 * with function defined in the `commands` module.
	 */
	commands.register(context, keymapState, keyTipState)
	/**
	 * We create an output channel for diagnostic messages and pass it to the
	 * `actions` module.
	 */
	let channel = vscode.window.createOutputChannel("ModalKeys")
	actions.setOutputChannel(channel)
	actions.registerKeytips(keyTipState)

	/**
	 * Then we subscribe to events we want to react to.
	 */
	context.subscriptions.push(
		channel,
		vscode.workspace.onDidChangeConfiguration(e => {
			actions.updateFromConfig()
			keymap.updateFromConfig()
			keytips.updateFromConfig()
			commands.enterMode(actions.getStartMode())
		}),
		vscode.window.onDidChangeActiveTextEditor(commands.restoreEditorMode),
		vscode.window.onDidChangeTextEditorSelection(e => {
			commands.onSelectionChanged(e)
			commands.updateCursorAndStatusBar(e.textEditor)
		}),
		vscode.workspace.onDidChangeTextDocument(commands.onTextChanged))
	/**
	 * Next we update the active settings from the config file, and at last,
	 * we enter into normal or edit mode depending on the settings.
	 */
	actions.updateFromConfig()
	keymap.updateFromConfig()
	commands.enterMode(actions.getStartMode())
}
/**
 * This method is called when your extension is deactivated
 */
export function deactivate() {
    commands.enterMode('insert')
}