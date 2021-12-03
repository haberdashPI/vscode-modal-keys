# Keybinding forms

You can define the bindings in four different ways. It is also possible to
combine them freely.

## Single Command

The simplest way is to map a key to a single command. This has the format:

```js
"<binding>": "<command>"
```

The `<binding>` specifies the sequence of keys to press (and possibly the mode),
and `<command>` is any valid VS Code command. You can see the list of all
available commands by opening global settings with command **Preferences: Open
Default Keyboard Shortcuts (JSON)**.

The example in the previous section maps the `i` key to the
`modalkeys.enterInsert` command.

## Commands with Arguments

Some [commands](https://code.visualstudio.com/api/references/commands#commands) take arguments. For example `cursorMove` which allows you
to specify which direction and how much cursor moves. These commands can be
executed by defining an object with predefined properties:

```js
"<binding>":  {
    "<command>": { ... }
    "repeat": number | "<expression>"
}
```

The `<command>` is again a valid VS Code command. Any arguments you wish to pass
to this command should be placed inside the curly brackets. ModalKeys evaluates
any argument strings that contain `__` as JavaScript expressions, and replaces the argument value with the result of this evaluation. The following
variables are recognized during this evaluation.

| Variable        | Type       | Description
| --------------- | ---------- | -------------------------------------------------
| `__file`        | `string`   | The name of the current file
| `__line`        | `number`   | The line number of cursor location
| `__col`         | `number`   | The column number of cursor location
| `__char`        | `string`   | The character under the cursor
| `__language`    | `string`   | The languageId of the current file
| `__selections`  | [`Selection[]`](https://code.visualstudio.com/api/references/vscode-api#Selection) | The selection objects of the current editor
| `__selection`   | [`Selection`](https://code.visualstudio.com/api/references/vscode-api#Selection)  | The primary selection object of the current editor
| `__selectionstr` | `string`  | The text of the primary selection
| `__wordstr` .    | `string`  | Same as `__selectionstr` unless there is no selection, and then this is equal to the current word under the cursor.
| `__selecting`    | `bool`    | True if text should be selected (e.g. we're in visual mode).
| `__mode`        | `string`    | A string specifying the current mode
| `__count`       | `number`   | A number indicating the prefixed numerical values in front of a command: see below.
| `__captured`    | `string`   | The list of captured keys following [`captureChar`](./commands.html#capturing-keys)

Below is an example that leverages string evaluation. It maps the key <key>o</key> to a command that moves the cursor to the
end of the line. It also selects the jumped range, if we have a selection already active.

```js
"o": { "cursorMove": { to: 'wrappedLineEnd', select: '__selecting' } },
```

## Numeric arguments

When you type a modal command you can prefix it with numbers: these are passed using the
`__count` variable to your command.

For example, the following would bind h to move left (like vim) in all modes.

```js
    "h": { "cursorMove": { to: 'left', value: '__count' } },
```

Because `value` is specified as `__count`, if you typed `12h`, the cursor would
move 12 characters to the left.

### Repeating commands

The `repeat` property of a command allows you to run the command multiple times. If it's a number, it should indicate the number of times to repeat the command. If it's a string it is evaluated as a JavaScript expression, and should evaluate to a numeric or boolean value. If numeric, the command repeats the given number of times. If boolean, it yields while-loop behavior: the command will continue to be repeated until it evaluates to false.

### Shared command name

You can specify a series of bindings that all use the same command, each with different arguments to that same command. Use the following format.

```js
"::using::<command>": {
    "<binding1>": { ... },
    "<binding2>": { ... },
    ...
}
```

Each binding is bound to the command `<command>`, passing the arguments specified for that binding (`{...}`).

## Sequence of Commands

To construct more complex operations consisting of multiple steps, you can
define command sequences. Commands in a sequence will be run one after another.
A sequence is defined as an array.
```js
"<binding>": [ <command1>, <command2>, ... ]
```
In above, `<command>` can assume any of the four command types.

The next example maps the `f` key to a command sequence that first deletes the
selected text and then switch to insert mode. It corresponds to the `c` command
in Vim.
```js
"f": [
    "deleteRight",
    "modaledit.enterInsert"
],
```

## Conditional Commands

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

Here `<condition>` can be any valid JavaScript expression. You can use variables
listed in the "Commands with Arguments" section in the expression. If the
expression evaluates to true, `<command1>` will be executed, if false,
`<command2>` will be run. Commands can be of any kind: a single command,
sequence, or command with arguments.

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

## Debugging Keybindings

If you use a javascript file to define your bindings you can place `console.log`
statements in the file and they will show up under the ModalKeys output log.
Any errors encountered when parsing or evaluating your bindings will also show
up here.

You can find this output by opening **View - Output** and then choosing the
**ModalKeys** from the drop-down menu.

## Documenting a Keybinding

If you wish your own keybindings to leverage the visual documentation feature of ModalKeys you will also need to add a `::doc::` entries for each command.
These take the following form:

```js
"::doc::<binding>": { kind: <kind>, label: <label>, detail: <detail> }
```

The `kind` is a string defining a broad category of keys and determines the color of the key. The label is a string that will show up on the key: it should be very short: a good guideline is ≤2 words, ≤6 chars per word. Unicode can be useful in shortening the key lable (e.g. → and ←). The detail entry is a string description that will show up when you hover the mouse over the keybinding. It should explain in much more detail what the key does. The description for the `kind` will also be included, so the detail string should not be redundant with this more general information.

You also need to document the different command kinds used in your keymap. These are specified as an additional field of the main object of your keybindings file, called `docKinds` and takes the following format.

```js
module.exports = {
docKinds: [
    { name: <kind1>, description: <str> },
    // etc...
],

keybindings: {
    // all keybindings...
}
}
```

The colors for doc kinds are determined by their order in `docKinds`, and are selected from a carefully defined [color brewer](https://colorbrewer2.org/#type=sequential&scheme=BuGn&n=3) color set, to ensure colors are easily differentiable.

### Leaders

If your keybindings include a sequence of multiple keys (e.g. `gj`), you should also document the general role of a given sequence prefix. For example, the vim bindings include the following `::doc::` entry:

```js
"::doc::g": { kind: "leader", label: "more actions", detail: "additional commands (mostly actions)" },
```