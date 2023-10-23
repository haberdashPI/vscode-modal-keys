# VS Code Commands

ModalKeys adds several useful commands to VS Code's repertoire. Most of them help you
create more Vim-like workflows.

## Displaying documentation

`modalkeys.toggleKeymap` and `modalkeys.showKeymap` will toggle or show the visual keymap documentation (respectively).

## Switching between Modes

Use the following commands to change the current editor mode. Unless specified below, the command takes no arguments.

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

## Incremental Search

The standard search functionality in VS Code is quite clunky for some desirable features of
a modal editor, as it opens a dialog which takes you out of the editor. To achieve more
fluid searching experience ModalKeys provides incremental search commands that mimic Vim's
corresponding operations.

### `modalkeys.search`

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
| `offset`                  | `string`  | `"inclusive"` | Where the cursor should land after searching: "inclusive" of match, "exclusive" of match string, at the "start" or at the "end" of the match.
| `executeAfter`            | `<command>` |           | The given commands are run after accepting a search
| `text`                    | `string`  | ""          | If non-empty, run a non-interactive search using the given text
| `regex`                   | `boolean` | `false`     | If true, interpret search query as a regular expression
| `register`                | `string`  | `"default"`   | Register used to store the search text, and current match of that text.

Changing the register will change what `nextMatch` and `previousMatch` consider to be the current search term and location. This allows for multiple channels of searching (e.g. so that emulation of vim's `f` and `/` commands can have independent state).

### `modalkeys.cancelSearch`

Cancels the incremental search, returns the cursor to the starting position,
and switches back to normal mode.

### `modalkeys.deleteCharFromSearch`

Deletes the last character of the search string. By default the backspace key
is bound to this command when ModalKeys is active and in search mode.

### `modalkeys.nextMatch`

Moves to the next match and selects it. Which way to search depends on the
search direction. Takes a single argument (`register`), which defaults to "default" if unspecified. (See `modalkeys.search` for details)

### `modalkeys.previousMatch`

Moves to the previous match and selectes it. Which way to search depends on the
search direction. Takes a single argument (`register`), which defaults to "default" if unspecified. (See `modalkeys.search` for details)

### `modalkeys.enterMode`

This command takes a single argument `mode` and allows you to enter any mode you desire.

## Macros

ModalKeys can record events from all modes, other than those from insert mode (support for insert mode is [planned](https://github.com/haberdashPI/vscode-modal-keys/issues/5)).

There are three commands

### `modalkeys.toggleRecordingMacro`

This starts or stops the recording of a macro. When starting a macro, this command accepts a single argument (`register`). The register determines what name (or number) the macro is stored under. For example, you could pass `__count` or use [`captureChar`](https://haberdashpi.github.io/vscode-modal-keys/stable/doc_index.html#capturing-keys).

**LIMITATION**: Macro recording currently ignores all [insert-mode events](https://github.com/haberdashPI/vscode-modal-keys/issues/5)

### `modalkeys.cancelRecordingMacro`

This stops macro recording; unlike `toggleRecordingMacro`, the new recording is forgotten, and any previous recording stored at the given register is retained.

### `modalkeys.replayMacro`

This replays a given macro, indicated by the argument `register`.

## Invoking Key Bindings

The command `modalkeys.typeKeys` invokes commands through key bindings. Calling this
command with a key sequence has the same effect as pressing the keys in given mode. This
allows you to treat key bindings as subroutines that can be called using this command.

The command has two arguments.

1. `keys`: contains the key sequence as string.
2. `mode`: defaults to 'normal', and specifies what mode the keys should be typed in

Assuming that keys <key>k</key> and <key>u</key> are bound to some commands, the following example runs them
both one after another.

```js
{ "modaledit.typeKeys": { "keys": "ku" } }
```

## Selecting Text Between Delimiters

The command `modalkeys.selectBetween` selects a range of text between two delimiters (`from` and `to`), and has several additional arguments.

- If the `regex` flag is on, `from` and `to` strings are treated as regular
  expressions in the search.
- The `inclusive` flag tells if the delimiter strings are included in the
  selection or not. By default the delimiter strings are not part of the
  selection.
- The `caseSensitive` flag makes the search case-sensitive. When this flag is
  missing or false the search is case-insensitive.

Below is an example that selects all text inside quotation marks. For more
advanced examples check the [vim presets](./presets/vim.html).

```js
{
    "command": "modalkeys.selectBetween",
    "args": {
        "from": "(",
        "to": ")"
    }
}
```

> **NOTE**: This command is purely textual in nature. It uses regular expressions to search your document. It cannot understand nested parenthesis and the like. Consider using an extension like [bracketeer](https://marketplace.visualstudio.com/items?itemName=pustelto.bracketeer) if you want behavior that handles nested syntactic expressions. VSCode's extension API provides no access to bracket matching, and extensions that want to support this behavior must re-implement bracket matching for all languages they want to support.

## Repeat Last Change

`modalkeys.repeatLastChange` command repeats the last command (sequence) that
caused text in the editor to change. It corresponds to the [dot `.` command](https://vim.fandom.com/wiki/Repeat_last_change)
in Vim. The command takes no arguments.

### Touching/Untouching a document

To register a change to the document you can call `modalkeys.touchDoucment`, and to ignore the last change you can call `modalkeys.untouchDocument`. This can be useful for changing the behavior of `repeatLastChange`. For example, you might want to treat a command that commits a range of the document to version control, or sends text to a REPL as a change (that can be repeated with `repeatLastCahnge`).

## Repeat Last Used Selection

`modalkeys.repeatLastUsedSelection` repeats the last command (sequence) that
caused the selection to change *just before* the last change occurred. This is
useful for implementing a kakaune-like workflow, where selections are applied
and then followed by actions. This is in contrast to the vim-like approach of
specifying actions followed by objects (which are kind of like selections, but
are not visually displayed). E.g. <key>w</key><key>d</key> in a kakaune-like
workflow might select a word (<key>w</key>) and then delete it (<key>d</key>),
whereas, in vim, you would type <key>d</key><key>w</key> to delete a word. By
repeating the last used selection, you could repeat <key>w</key> and repeating
the last change, you could repeat <key>d</key>. Or you could have both repeat
commands occur with a single stroke, like below.

```js
{ ".": [ "modalkeys.repeatLastUsedSelection", "modalkeys.repeatLastChange" ] }
```

## Capturing keys

`modalkeys.captureChar` is a generic command for capturing a sequence of keys that the user types. It records characters until the user hits return (or until `acceptAfter` keys are typed). One could implement a poor man's version of the search commands using `modalkeys.captureChar`. It accepts the following arguments

| Argument                  | Type      | Default     | Description
| ------------------------- | --------- | ----------- | ---------------------------------
| `acceptAfter`             | `number`  | `undefined` | Accept search automatically after _x_ characters have been entered. 
| `executeAfter`           | &lt;command&gt; | `undefined` | The commands to run after capturing keys.

For example, the following command selects all characters that fall between two instances of a given key; so, in the string "joe |bob| joe", with the cursor on the first "b", typing `uc|` would select "bob".

```js
    uc: { "modalkeys.captureChar": {
        acceptAfter: 1,
        executeAfter: { "modalkeys.selectBetween": {
            from: "__captured",
            to: "__captured",
            inclusive: false,
            caseSensitive: true,
            docScope: true
        }},
    }},
```

