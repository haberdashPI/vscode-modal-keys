# Config File Basics

ModalKeys has two built in modes, and as many custom modes as you want. By default, VSCode will open in normal mode. ([This can be changed](./config.html#start-in-normal-mode))

To define the key mappings for these modes, you should create a javascript file
(e.g. `mybindings.js`). When run, the file should export a single object with
the single property `keybindings`; this should define all of your bindings. If
your bindings are simple enough you can also use a `json` or `jsonc` file (but
this will limit the flexibility of your bindings).

## Minimal configuration

The following describes the minimal requirements for a keybindings file. You
don't need to start from scratch with your bindings though; you can get started
quickly be exporting one of the presets. You can do this using the command
"ModalKeys: Export a preset for keybindings".

Your keybindings should include at least one binding that will switch
the editor to the *insert mode*, which is the same as VS Code's default mode.
```js
module.exports = {keybindings: {
    i: "modalkeys.enterInsert"
}}
```
By default, a binding works for all modes except insert mode. Mode specific bindings are [documented below](#custom-modes).

Once you have defined bindings, they can be set by running the command
`"ModalKeys: Import preset keybindings"` on this file.  

The simplest type of binding maps a series of keystrokes to a given VSCode
command. You can find these commands by looking at the list of keybindings (e.g.
<key>Ctrl/Cmd</key>-<key>K</key> <key>Ctrl/Cmd</key>+<key>S</key> on windows) and copying the command ID from the right-click
menu. More advanced keybindings are [covered later](./key_forms.html).

ModalKeys adds a regular VS Code keyboard shortcut for <key>Esc</key> to return back to
normal mode. If you wish, you can remap this command to another key by
pressing <key>Ctrl/Cmd</key>+<key>K</key> <key>Ctrl/Cmd</key>+<key>S</key>.

## Visual mode

Visual mode works a bit differently than Vim's. Any time we are in normal mode
(e.g. hit 'escape') and text happens to be selected, visual mode starts. Visual
mode can also be manually started.

ModalKeys defines a new command, `modalkeys.toggleSelection`, which allows you
to start selecting text in normal mode without holding down the shift key.

You can change the text shown in status bar during visual mode using
[configuration parameters](./config.html#changing-status-bar).

To define a binding specific to visual mode just place `visual::` in front of the binding sequence.

## Custom Modes

To define custom modes, just define keybindings for that mode. Custom modes
behave like normal mode in all respects except that they have their own set of
keymappings. To define bindings specific to one or more modes, you prefix the
bindings with `[modename]::`. You can specificy multiple modes using `|` e.g.
`mycustommode|visual::`.

To enter the given mode, you will need to call the command `modalkeys.enterMode`
with the argument `mode` set to the name of the custom mode. 

For example, the following would map the typical directional keys of vim to a delete command
when you are in "evil" mode.

```js
"modalkeys.keybinding": {
    "D": { command: "modalkeys.enterMode", args: { mode: "evil" } },
    "evil::D": { command: "modalkeys.enterMode", args: { mode: "normal" } },
    "evil::j": "edit.action.clipbaordCutAction",
    "evil::k": "edit.action.clipbaordCutAction",
    "evil::h": "edit.action.clipbaordCutAction",
    "evil::l": "edit.action.clipbaordCutAction"
}
```
