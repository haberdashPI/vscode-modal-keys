# Modal Keybindings in VS Code

[![Project Status: WIP – Initial development is in progress, but there has not yet been a stable, usable release suitable for the public.](https://img.shields.io/badge/Project%20Status-WIP-yellow)](https://www.repostatus.org/#wip)

ModalKeys is a simple extension for defining modal keybindings in VSCode. The most prominent
[modal editor](https://unix.stackexchange.com/questions/57705/modeless-vs-modal-editors) is
[Vim](https://www.vim.org/) and ModalKeys includes presets that resemble Vim. While you can
emulate existing modal editors like Vim or
[Kakoune](https://kakoune.org/why-kakoune/why-kakoune.html) with this extension, you can
also build your keyboard layout from the ground up and add exactly the features you need.

As a little preview of what's possible, here are the movement commands in my configuration file:

```typescript
    "::using::cursorMove::": {
        h: { to: 'left', select: "__mode !== 'normal'", value: '__count' },
        j: { to: 'down', by: 'wrappedLine', select: "__mode !== 'normal'", value: '__count' },
        k: { to: 'up', by: 'wrappedLine', select: "__mode !== 'normal'" , value: '__count' },
        l: { to: 'right', select: "__mode !== 'normal'", value: '__count' },
        gj: { to: 'down', by: 'line', select: "__mode !== 'normal'", value: '__count' },
        gk: { to: 'up', by: 'line', select: "__mode !== 'normal'", value: '__count' },
    },
```

These basically replicate the behavior of VIM's basic cursor motions. When these keys are pressed in normal mode the built-in VSCode command `cursorMove` will be called with the given arguments. If you don't know normal mode is, refer to the more detailed descriptions below. 

Rather than attempt to reproduce all features of past editors, ModalKeys simply provides the
means to easily define new keybindings for several pre-defined modes, and as many user defined
modes as you want. If you prefer to replicate vim in VSCode, consider using
[VSCodeVim](https://github.com/VSCodeVim/Vim) or
[vscode-neovim](https://github.com/asvetliakov/vscode-neovim).

ModalKeys is a fork of [ModalEdit](https://github.com/johtela/vscode-modaledit); I am in
debt to the hard and thoughtful work put into that extension. There are some important features that
differ between the two extensions.

Features that ModalKeys has, which ModalEdit lacks.

1. Concise keymap format: I've designed a terser, simplified keymap format
2. Customized modes: You can define your own key modes, to expand the keymap more easily
3. Search term highlighting: ModalKeys highlights search terms by default (there is an open [PR](https://github.com/johtela/vscode-modaledit/pull/19))
4. Search with regex: The `search` command can optionally use regex expressions
4. Kakoune-like 'repeat-selection': ModalKeys provides a
   `repateLastUsedSelection` to make implementing kakoune noun-verb workflows repeatable (in contrast with vim's verb-noun workflows)

ModalKeys is missing a few features I did not want to maintain from ModalEdit: bookmarks and quick snippets. I find these features to be well covered by several existing extensions in VSCode.

My re-organizing of this project is also part of my plans to pave the way for
fully functional keyboard macros and

## Getting Started

When the extension is installed, text documents will open in normal mode. The
current mode is shown in the status bar. You can even switch between normal and insert modes by
clicking the pane in the status bar.

<!-- ![Status bar](images/status-bar.gif) -->

In normal mode keys don't output characters but invoke commands. You can
specify these commands in the `settings.json` file. To edit your user-level
settings file, open command palette with `Ctrl+Shift+P` and look up command
**Preferences: Open Settings (JSON)**. If you want the configuration to be
project specific, edit the `settings.json` that is located in the `.vscode`
directory under your project directory.

> You might want to skip to the [tutorial](./tutorial.html), if you prefer learning by
> example. If you want to start with Vim keybindings, you'll find the
> instructions [here](TODO). Otherwise keep reading this document.

To define the key mappings used in normal mode, add a property named
`modalkeys.keybindings`. You should define at least one binding that will switch
the editor to the *insert mode*, which is the same as VS Code's default mode.
```js
"modalkeys.keybindings": {
    "i": "modalkeys.enterInsert"
}
```
When you save the `settings.json` file, keybindings take effect immediately.

By default, any keys defined under `modalkeys.keybindings` will be available in all
modes other than insert mode (see below for how to make a binding specific to one or more
modes).

ModalKeys adds a regular VS Code keyboard shortcut for `Esc` to return back to
normal mode. If you wish, you can remap this command to another key by
pressing `Ctrl+K Ctrl+S`.

### Selections/Visual Mode

There is also a second, built-in mode. Visual mode works slighlty differently than Vim's,
because VSCode allows selections to occur in 'insert' mode. Any time we request normal model
(e.g. hit 'escape') and text is selected, visual mode starts. (Visual mode can also be
manually started).

ModalKeys defines a new command `modalkeys.toggleSelection` which allows you
to start selecting text in normal mode without holding down the shift key. This imitates
Vim's visual mode.

You can also change the text shown in status bar during visual mode using [configuration parameters](#changing-status-bar)

<!-- ![Selection active](images/selected-text.png) -->

### Mode Specific Bindings and Custom Modes

You can also define keymaps that are specific to one or more modes. These can be one of the
built-in modes (normal and visual) or your own, custom mode. Custom modes behave like normal
mode in all respects except that they have their own set of keymappings.

To enter the given mode, you call the command `modalkeys.enterMode` with the argument `mode`
set to the name of the custom mode. To define bindings specific to one or more modes, you prefix the bindings with `[modename]::`. You can specificy multiple bindings using `|` e.g. `mycustommode|visual::`.

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

## Keybindings

You can define the bindings in four different ways. It is also possible to combine them
freely.

### Single Command

The simplest way is to map a key to a single command. This has the format:
```js
"<binding>": "<command>"
```
The `<binding>` specifies the sequence of keys to press, and `<command>` is any valid VS
Code command. You can see the list of all available commands by opening global settings with
command **Preferences: Open Default Keyboard Shortcuts (JSON)**.

The example in the previous section maps the `i` key to the
`modalkeys.enterInsert` command.

### Commands with Arguments

Some [commands](https://code.visualstudio.com/api/references/commands#commands) take arguments. For example `cursorMove` which allows you
to specify which direction and how much cursor moves. These commands can be
executed by defining an object with prefined properties:
```js
"<binding>":  {
    "<command>": { ... }
    "repeat": number | "__count"
}
```
The `<command>` is again a valid VS Code command. The arguments passed to "<command>" ({ ...
}) contains whatever arguments the command takes. It is specified as a JSON object.
ModalKeys evaluates JavaScript expressions within the argument values. The following
variables can be used inside expression strings:

| Variable        | Type       | Description
| --------------- | ---------- | -------------------------------------------------
| `__line`        | `number`   | The line number where the cursor is currently on.
| `__selecting`   | `boolean`  | Flag that indicates whether selection is active.
| `__mode`        | `string    | A string specifying the current mode
| `__count`       | `number`   | A number indicating the prefixed numerical values in front of a command: see below.

When you type a modal command you can prefix it with numbers, these are passed using the
`__count` variable to your command.

As a full example of using `__count`, the following would bind h to move left (like vim) in all modes.

```js
    "h": { "cursorMove": { to: 'left', value: '__count' } },
```

Because `value` is specified as `__count`, if you typed `12h`, the cursor would move 12
characters to the left.

The `repeat` property allows you to run the command multiple times. If the value of the
property is a number, it directly determines the repetition count, and if it is `__count` it
repeats the expression based on the prefixed numbers passed to the keybinding.

Below is an example that maps key `o` to a command that moves the cursor to the
end of line. It also selects the jumped range, if we have selection active.

```js
"o": { "cursorMove": { to: 'wrappedLineEnd', select: '__selecting' } },
```

### Sequence of Commands

To construct more complex operations consisting of multiple steps, you can
define command sequences. Commands in a sequence will be run one after another.
A sequence is defined as an array.
```js
"<binding>": [ <command1>, <command2>, ... ]
```
In above, `<command>` can assume any of the supported forms: single command,
one with arguments, or conditional command (see below).

The next example maps the `f` key to a command sequence that first deletes the
selected text and then switch to insert mode. It corresponds to the `c` command
in Vim.
```js
"f": [
    "deleteRight",
    "modaledit.enterInsert"
],
```

### Conditional Commands

For even more complex scenarios, you can define commands that run different
commands depending on a specified condition. The most common use case for this
is to run a different command when selection is active. The format of a
conditional commands is:
```js
"<binding>":  {
    "if": "<condition>",
    "then": <command1>,
    "else": <command2>,
}
```
Here `<condition>` can be any valid JavaScript expression. You can use variables listed in
the "Commands with Arguments" section in the expression. If the expression evaluates to
true, `<command1>` will be executed, if false, `<command2>` will be run. Commands can be
of any kind: a single command, sequence, or command with arguments.

Below is an example that moves cursor one word forward with `w` key. We use
the `__mode` variable to determine if we're in visual mode. If so, we
extend the selection using `cursorWordStartRightSelect` command, otherwise we
just jump to next word with `cursorWordStartRight`.
```js
"w": {
    "if": "__mode == 'visual'",
    "then": "cursorWordStartRightSelect",
    "else": "cursorWordStartRight"
},
```

### Debugging Keybindings

If you are not sure that your bindings are correct, check the ModalKeys's
output log. You can find it by opening **View - Output** and then choosing the
**ModalKeys** from the drop-down menu. Errors in configuration will be reported
there. If your configuration is ok, you should see the following message.

<!-- ![output log](images/output-log.png) -->

### Advanced Keybindings

You can specify a series of shortcuts that all use the same command, each with different arguments to that same command. Use the following format.

```js
"::using::<command>": {
    "<binding1>": { ... },
    "<binding2>": { ... },
    ...
}
```

Each binding is bound to the command `<command>`, passing the arguments specified for that binding (`{...}`).

## Configuration

### Changing Cursors

You can set the cursor shape shown in each mode by changing the following
settings. Custom modes always use the cursor style of Normal mode.

| Setting               | Default       | Description
| --------------------- | ------------- | -------------------------------------
| `insertCursorStyle`   | `line`        | Cursor shown in insert mode.
| `normalCursorStyle`   | `block`       | Cursor shown in normal mode.
| `searchCursorStyle`   | `underline`   | Cursor shown when incremental search is on.
| `selectCursorStyle`   | `line-thin`   | Cursor shown when selection is active in normal mode.

The possible values are:

- `block`
- `block-outline`
- `line`
- `line-thin`
- `underline`
- `underline-thin`

### Changing Search Highlight Colors

By default, incremental search highlights matches in the same way that the built-in search
command does. You can configure it to use a different set of colors using the following
settings. Leave these blanks to use the theme colors for built-in search commands.

| Setting                        | Default | Description
| ------------------------------ | ------- | ---------------------------------------------
| `searchMatchBackground`        | ``      | Background color for current search match.
| `searchMatchBorder`            | ``      | Border color for current search match.
| `searchOtherMatchesBackground` | ``      | Background color for other visible search matches.
| `searchOtherMatchesBorder`     | ``      | Border color for other visible search matches .

### Changing Status Bar

With version 2.0, you can also change the text shown in status bar in each mode
along with the text color. Note that you can add icons in the text by using
syntax `$(icon-name)` where `icon-name` is a valid name from the gallery of
[built-in icons](https://microsoft.github.io/vscode-codicons/dist/codicon.html).

The color of the status text is specified in HTML format, such as `#ffeeff`,
`cyan`, or `rgb(50, 50, 50)`. By default these colors are not defined, and thus
they are same as the rest of text in the status bar.

| Setting            | Default                   | Description
| ------------------ | ------------------------- | -------------------------------------
| `insertStatusText` | `-- $(edit) INSERT --`    | Status text shown in insert mode
| `normalStatusText` | `-- $(move) __MODENAME__ --`    | Status text shown in normal, or custom modes
| `searchStatusText` | `$(search) SEARCH`        | Status text shown when search is active
| `selectStatusText` | `-- $(paintcan) VISUAL --`| Status text shown when selection is active in normal mode
| `insertStatusColor`| `undefined`               | Status text color in insert mode
| `normalStatusColor`| `undefined`               | Status text color in normal mode
| `searchStatusColor`| `undefined`               | Status text color when search is active
| `selectStatusColor`| `undefined`               | Status text color when selection is active in normal mode

### Start in Normal Mode

If you want VS Code to be in insert mode when it starts, set the
`startInNormalMode` setting to `false`. By default, editor is in normal mode
when you open it.

### Example Configurations

**TODO**

## Additional VS Code Commands

ModalKeys adds few useful commands to VS Code's repertoire. They help you
create more Vim-like workflow for searching and navigation.

### Switching between Modes

Use the following commands to change the current editor mode. None of the
commands require any arguments.

| Command                               | Description
| ------------------------------------- | ----------------------------------------------
| `modalkeys.toggle`                    | Toggles between modes.
| `modalkeys.enterNormal`               | Switches to normal mode.
| `modalkeys.enterInsert`               | Switches to insert mode.
| `modalkeys.toggleSelection`           | Toggles selection mode on or off. Selection mode is implicitly on whenever editor has text selected.
| `modalkeys.enableSelection`           | Turn selection mode on.
| `modalkeys.cancelSelection`           | Cancel selection mode and clear selection.
| `modalkeys.cancelMultipleSelections`  | Cancel selection mode and clear selections, but preserve multiple cursors.
| `modalkeys.enterMode`                 | Enter a given mode, specified by the argument `mode` (a string).

### Incremental Search

The standard search functionality in VS Code is quite clunky for some desirable features of
a modal editor, as it opens a dialog which takes you out of the editor. To achieve more
fluid searching experience ModalKeys provides incremental search commands that mimic Vim's
corresponding operations.

#### `modalkeys.search`

Starts incremental search. The cursor is changed to indicate that editor is in
search mode. Normal mode commands are suppressed while incremental search is
active. Just type the search string directly without leaving the editor. You
can see the searched string in the status bar as well as the search parameters.

<!-- ![Searching](images/searching.gif) -->

The command takes following arguments. All of them are optional.

| Argument                  | Type      | Default     | Description
| ------------------------- | --------- | ----------- | ---------------------------------
| `backwards`               | `boolean` | `false`     | Search backwards. Default is forwards
| `caseSensitive`           | `boolean` | `false`     | Search is case-sensitive. Default is case-insensitive
| `wrapAround`              | `boolean` | `false`     | Search wraps around to top/bottom depending on search direction. Default is off.
| `acceptAfter`             | `number`  | `undefined` | Accept search automatically after _x_ characters has been entered. This helps implementing quick one or two character search operations.
| `selectTillMatch`         | `boolean` | `false`     | Select the range from current position till the match instead of just the match. Useful with `acceptAfter` to quickly extend selection till the specified character(s).
| `highlightMatches`        | `boolean` | `true`      | If true, use the search highlight colors to highlight all matches
| `offset`                  | `string`  | `"inclusive"` | Where the cursor should lad after searching: "inclusive" of match, "exclusive" of match string, at the "start" or at the "end" of the match.
| `executeAfter`            | `<command>` |           | The given commands are run after accepting a search
| `text`                    | `string`  | ""          | If non-empty, run a non-interactive search using the given text
| `regex`                   | `boolean` | `false`     | If true, interpret search query as a regular expression

#### `modalkeys.cancelSearch`

Cancels the incremental search, returns the cursor to the starting position,
and switches back to normal mode.

#### `modalkeys.deleteCharFromSearch`

Deletes the last character of the search string. By default the backspace key
is bound to this command when ModalKeys is active and in search mode.

#### `modalkeys.nextMatch`

Moves to the next match and selectes it. Which way to search depends on the
search direction.

#### `modalkeys.previousMatch`

Moves to the previous match and selectes it. Which way to search depends on the
search direction.

#### `modalkeys.enterMode`

This command takes a single argument `mode` and allows you to enter any mode you desire.

### Invoking Key Bindings

The command `modalkeys.typeKeys` invokes commands through key bindings. Calling this
command with a key sequence has the same effect as pressing the keys in given mode. This
allows you to treat key bindings as subroutines that can be called using this command.

The command has arguments:

1. `keys`: contains the key sequence as string.
2. `mode`: defaults to 'normal', and specifies what mode the keys should be typed in

Assuming that keys `k` and `u` are bound to some commands, the following example runs them
both one after another.

```js
{ "modaledit.typeKeys": { "keys": "ku" } }
```

### Repeat Last Change

`modalkeys.repeatLastChange` command repeats the last command (sequence) that
caused text in the editor to change. It corresponds to the [dot `.` command](https://vim.fandom.com/wiki/Repeat_last_change)
in Vim. The command takes no arguments.

### Repeat Last Used Selection

`modalkeys.repeatLastUsedSelection` repeats the last command (sequence) that cased the
selection to change *just before* the last change occurred. This is useful for implementing a
kakaune-like workflow, where selections are applied and then followed by actions: this is in
contrast to the vim-like approach of specifying actions followed by objects (which are kind
of like selections, but are not visually displayed). E.g. `wd` in a kakaune-like workflow might select a word (`w`) and then delete it (`d`), whereas, in vim, you would type `dw` to delete a word. By repeating the last used selection, you could repeat `w` and repeating the last change, you could repeat `d`. Or you could have both repeat commands occur with a single stroke, like below.

```js
{ ".": [ "modalkeys.repeatLastUsedSelection", "modalkeys.repeatLastChange" ] }
```

### Importing Presets

You can use `modalkeys.importPresets` to import a set of keybindings in both JSON and
JavaScript form. It reads keybindings from a file and copies them to the global
`settings.json` file. It overrides existing keybindings, so back them up somewhere before
running the command, if you want to preserve them.

Preset keybindings for vim are available. You can learn more about Vim bindings [here](TODO).
Built-in presets are located under the `presets` folder under the extension installation
folder. The command scans and lists all the files there. It also provides an option to
browse for any other file you want to import.

As noted above, presets are stored either in a JSON or JavaScript file. In either case, the
file to be imported should evaluate to an object which should have a single property at the top level, named `keybindings`.

It is also possible to define the object in JS. In that case the object should be the
expression that the whole script evaluates to (i.e. the last value in the script)

## Acknowledgements

Much of the organization, concept and documentation for this extension owes a debt to [ModalEdit](https://github.com/johtela/vscode-modaledit). Thanks to @joetela for creating such a well documented, well organized, and useful extension. Other, past extensions, to whom I am indebted include [Simple Vim](https://marketplace.visualstudio.com/items?itemName=jpotterm.simple-vim), [Vimspired](https://marketplace.visualstudio.com/items?itemName=bmalehorn.vimspired). It is slowly being reshaped to fit my own purposes and views on how the code can best grow to allow for new features.
