function aroundEntry(key, bounds){
    return {
        from: typeof(bounds) === 'string' ? bounds : bounds.value || bounds.from,
        to: typeof(bounds) === 'string' ? bounds : bounds.value || bounds.to,
        regex: bounds.regex !== undefined
    }
}
function aroundObjects(mappings){
    return Object.fromEntries(Object.entries(mappings).map(([key, bounds]) => {
        return [
            ["a"+key, { "modalkeys.selectBetween": {
                ...aroundEntry(key, bounds),
                inclusive: true
            }}],
            ["i"+key,  { "modalkeys.selectBetween": {
                ...aroundEntry(key, bounds),
                inclusive: false
            }}]
        ]
    }).flat())
}

function operators(params){
    let result = {}
    for(const [opkey, opcom] of Object.entries(params.operators)){
        for(const [objkey, objcom] of Object.entries(params.objects)){
            result["normal::"+opkey + objkey] = [opcom, objcom]
            result["normal::"+opkey+opkey] =
                ["modalkeys.cancelMultipleSelections", "expandLineSelection", opcom]
            result["visual::"+opkey] = opcom
        }
    }
    return result
}

/**
# New Vimproved ModalKeys 2.0

![](../images/pooh.jpg =375x403)
Providing full Vim emulation was not originally a goal of ModalKeys. The idea of
the extension is to provide an engine that allows the user to [map any key
combination to any command provided by VS Code](../README.html#configuration).
However, most users equate modal editing with Vim and are familiar with its
default keybindings. Vim users really love the powerful key sequences that
combine editing operations with cursor motions or text ranges.

ModalKeys has also evolved by taking inspiration from Vim. Many capabilities
were added with the motive to enable some Vim feature that was previously not
possible to implement. With version 2.0 ModalKeys's functionality is now
extensive enough to build a semi-complete Vim emulation. So, here we go...

Adding Vim keybindings as optional presets serves two purposes: it lowers the
barrier to entry for Vim users who don't want to spend the time defining
bindings from ground up. Secondly, Vim presets serve as an example to show
how you can build sophisticated command sequences using the machinery provided
by ModalKeys.

![importing presets](../images/import-preset.png =553x94)
If you are not interested on how the Vim keybindings are implemented and just
want to use them, you can skip this discussion. Just import the presets by
pressing <key>Ctrl</key>+<key>Shift</key>+<key>P</key> and running command
**ModalKeys: Import preset keybindings**. You will be presented a choice to
import either Vim bindings or any presets that you have created yourself. If
you are planning to customize the bindings, or create Vim-style commands from
scratch, this document gives you pointers how to go about with that.

## Game Plan

We start with basic motion commands which are mostly straightforward to
implement. Motions have two modes of operation: normal mode (moving cursor), and
visual mode (extending selection). We make sure all motions work correctly in
both modes. This allows us to reuse these keybindings when implementing more
advanced operations. Our goal is to avoid repetition by building complex
sequences from primitive commands.

In Vim, there are multiple key sequences for a same operation. For example,
you can convert a paragraph upper case by typing
<key>g</key><key>U</key><key>i</key><key>p</key>. You can perform the same
operation using visual mode by typing <key>v</key><key>i</key><key>p</key><key>U</key>.
The trick we use is to convert key sequences that operate on character, word,
line, paragraph, etc. to analagous key sequences that use visual mode. We can
implement all the editing commands just to work on active selection and reuse
these commands with the other key combinations. Consequently, command definition
becomes a string mapping problem. Since we can use JavaScript to expressions to
do string manipulation, these mappings are easy to formulate.

![](../images/vim-uppercase.gif)

Many ways to skin a cat...

## Motions in Normal Mode

The list of available cursor motion commands is shown below.

| Keys      | Cursor Motion
| --------- | -------------------
| `Enter`   | Beginning of next line
| `Space`   | Next character on right
| `h`       | Left
| `j`       | Down
| `k`       | Up
| `l`       | Right
| `0`       | First character on line
| `$`       | Last character on line
| `^`       | First non-blank character on line
| `g_`      | Last non-blank character on line
| `gg`      | First charater in file
| `G`       | Last character in file
| `w`       | Beginning of next word
| `e`       | End of next word
| `b`       | Beginning of previous word
| `W`       | Beginning of next alphanumeric word
| `B`       | Beginning of previous alphanumeric word
| `H`       | Top of the screen
| `M`       | Middle of the screen
| `L`       | Bottom of the screen
| `%`       | Matching bracket

Now, lets implement all the keybindings listed above.
*/
module.exports = {
    "keybindings": {
        /**
Cursor can be advanced in a file with with enter and space. These are not
technically motion commands but included for compatibility.
        */
        "\n": [
            "cursorDown",
            { "cursorMove": { "to": "wrappedLineFirstNonWhitespaceCharacter" } }
        ],
        " ": "cursorRight",
        /**
Move cursor up/down/left/right.
        */
        "::using::cursorMove": {
            "h": { to: 'left', select: '__mode == "visual"', value: '__count' },
            "j": { to: 'down', select: '__mode == "visual"', value: '__count' },
            "k": { to: 'up', select: '__mode == "visual"', value: '__count' },
            "l": { to: 'right', select: '__mode == "visual"', value: '__count' },
            /**
Move to first/last character on line. These work also in visual mode.
        */
            "0": { to: 'wrappedLineStart', select: '__mode == "visual"' },
            "$": { to: 'wrappedLineEnd', select: '__mode == "visual"' },
        /**
Move to first/last non-blank character on line. Also these ones use the
`__selecting` flag to check whether we are in visual mode.
        */
            "^": { to: 'wrappedLineFirstNonWhitespaceCharacter', select: '__mode == "visual"' },
            "g_": { to: 'wrappedLineLastNonWhitespaceCharacter', select: '__mode == "visual"' },
        },

            /**
Moving to the beginning of file is defined as a conditional command to make
it work in visual mode.
            */
        "gg": "cursorTop",
        "visual::gg": "cursorTopSelect",

    /**
<key>g</key><key>t</key> and <key>g</key><key>T</key> switch to next/previous
tab.
        */
        "gt": "workbench.action.nextEditor",
        "gT": "workbench.action.previousEditor",
        /**

Now we can complete the list of basic motion commands. This one movest the
cursor at the end of the file and selects the range, if visual mode is on.
        */
        G: {
            "if": "__mode == 'visual'",
            "then": "cursorBottomSelect",
            "else": "cursorBottom"
        },
        /**
The logic of separating words is bit different in VS Code and Vim, so we will
not try to imitate Vim behavior here. These keys are mapped to the most similar
motion available. The <key>W</key> and <key>B</key> move past all non-space characters,
and are implemented using the search command, with appropriate options. To allow
motion across multiple words, we use the 'repeat' option.
        */
        "w": { "cursorWordStartRight": {}, "repeat": "__count" },
        "visual::w": { "cursorWordStartRightSelect": {}, "repeat": "__count" },
        "e": { "cursorWordEndRight": {}, "repeat": "__count" },
        "visual::e": { "cursorWordEndRightSelect": {}, "repeat": "__count" },
        "b": { "cursorWordStartLeft": {}, "repeat": "__count" },
        "visual::b": { "cursorWordStartLeftSelect": {}, "repeat": "__count" },
        "W": {
            "modalkeys.search": {
                "text": "\\W+",
                "offset": 'inclusive',
                "regex": true,
                "selectTillMatch": '__mode == "visual"',
                "highlightMatches": false,
            },
            "repeat": '__count',
        },
        "B": {
            "modalkeys.search": {
                "text": "\\W+",
                "offset": 'inclusive',
                "regex": true,
                "backwards": true,
                "selectTillMatch": '__mode == "visual"',
                "highlightMatches": false,
            },
            "repeat": '__count',
        },
        /**
Moving cursor to the top, middle, and bottom of the screen is mapped to
<key>H</key> (high), <key>M</key> (middle), and <key>L</key> (low) keys.
        */
        "H": { "cursorMove": { to: 'viewPortTop', select: '__mode == "visual"' } },
        "M": { "cursorMove": { to: 'viewPortCenter', select: '__mode == "visual"' } },
        "L": { "cursorMove": { to: 'viewPortBottom', select: '__mode == "visual"' } },
        /**
Move to matching bracket command is somewhat challenging to implement
consistently in VS Code. This is due to the problem that there are no commands
that do exactly what Vim's motions do. In normal mode we call the
`jumpToBracket` command which works if the cursor is on top of a bracket, but
does not allow for the selection to be extended. In visual mode we use the
`smartSelect.expand` command instead to extend the selection to whatever
syntactic scope is above the current selection. In many cases, it is more useful
motion than jumping to a matching bracket, but using it means that we are
diverging from Vim's functionality.
        */
        "%": "editor.action.jumpToBracket",
        "visual::%": "editor.action.smartSelect.expand",
        /**
## Jump to a Character

Advanced cursor motions in Vim include jump to character, which is especially powerful in
connection with editing commands. With this motion, we can apply edits upto or including a
specified character. The same motions work also as jump commands in normal mode. We have to
provide separate implementations for normal and visual mode, since we need to provide
different parameters to the `modalkeys.search` command we are utilizing.

| Keys          | Cursor Motion
| ------------- | ---------------------------------------------
| `f`<_char_>   | Jump to next occurrence of <_char_>
| `F`<_char_>   | Jump to previous occurrence of <_char_>
| `t`<_char_>   | Jump to character before the next occurrence of <_char_>
| `T`<_char_>   | Jump to character after the previous occurrence of <_char_>
| `;`           | Repeat previous f, t, F or T motion
| `,`           | Repeat previous f, t, F or T motion in opposite direction

All of these keybindings are implemented using the [incremental
search](../README.html#incremental-search) command, just the parameters are different for
each case. Basically we just perform either a forward or backward search and use the
"offset" option to determine where the cursor should land.
        */
        "f": {
            "modalkeys.search": {
                "acceptAfter": 1,
                "offset": "inclusive",
                "selectTillMatch": "__mode == 'visual'",
            }
        },
        "F": {
            "modalkeys.search": {
                "acceptAfter": 1,
                "backwards": true,
                "offset": "inclusive",
                "selectTillMatch": "__mode == 'visual'",
            }
        },
        "t": {
            "modalkeys.search": {
                "acceptAfter": 1,
                "offset": "exclusive",
                "selectTillMatch": "__mode == 'visual'",
            }
        },
        "T": {
            "modalkeys.search": {
                "acceptAfter": 1,
                "backwards": true,
                "offset": "exclusive",
                "selectTillMatch": "__mode == 'visual'",
            }
        },

        /**
Repeating the motions can be done simply by calling `nextMatch` or
`previousMatch`.
        */
        ";": "modalkeys.nextMatch",
        ",": "modalkeys.previousMatch",
        /**
         *
## Switching between Modes

Next, we define keybindings that switch between normal, insert, and visual mode:

| Keys      | Command
| --------- | --------------------------------
| `i`       | Switch to insert mode
| `I`       | Move to start of line and switch to insert mode
| `a`       | Move to next character and switch to insert mode
| `A`       | Move to end of line and switch to insert mode
| `o`       | Insert line below current line, move on it, and switch to insert mode
| `O`       | Insert line above current line, move on it, and switch to insert mode
| `v`       | Switch to visual mode
| `V`       | Select current line and switch to visual mode

These commands have more memorable names such as `i` = insert, `a` = append,
and `o` = open, but above we describe what the commands do exactly instead
of using these names.
        */
        "i": "modalkeys.enterInsert",
        "I": [
            "cursorHome",
            "modalkeys.enterInsert"
        ],
        /**
The `a` has to check if the cursor is at the end of line. If so, we don't move
right because that would move to next line.
        */
        "a": [
            {
                "if": "__char == ''",
                "else": "cursorRight"
            },
            "modalkeys.enterInsert"
        ],
        "A": [
            "cursorEnd",
            "modalkeys.enterInsert"
        ],
        "o": [
            "editor.action.insertLineAfter",
            "modalkeys.enterInsert"
        ],
        "O": [
            "editor.action.insertLineBefore",
            "modalkeys.enterInsert"
        ],
        /**
Note that visual mode works a little differently than in vim. We don't
seek to mimc visual mode particularly. Basically, we just toggle a switch that allows the
motion commands to extend and create selections.
        */
        "v": "modalkeys.toggleSelection",
        /**
## Editing in Normal Mode

Editing commands in normal mode typically either affect current character or
line, or expect a motion key sequence at the end which specifies the scope of
 the edit. Let's first define simple commands that do not require a motion
 annex:

| Keys  | Command
| ----- | -------------------------
| `x`   | Delete character under cursor
| `X`   | Delete character left of cursor (backspace)
| `r`   | Replace character under cursor (delete and switch to insert mode)
| `s`   | Substitute character under cursor (same as `r`)
| `S`   | Substitute current line (delete and switch to insert mode)
| `D`   | Delete rest of line
| `C`   | Change rest of line (delete and switch to insert mode)
| `Y`   | Yank (copy) rest of line
| `p`   | Paste contents of clipboard after cursor
| `P`   | Paste contents of clipboard at cursor
| `J`   | Join current and next line. Add space in between
| `u`   | Undo last change
| `.`   | Repeat last change

<key>x</key> and <key>X</key> commands do exactly what <key>Delete</key> and
<key>Backspace</key> keys do.
        */
        "x": "deleteRight",
        "X": "deleteLeft",
        "r": "modalkeys.replaceChar",
        /**
Deleting in Vim always copies the deleted text into clipboard, so we do that
as well. If you are wondering why we don't use VS Code's cut command, it has a
synchronization issue that sometimes causes the execution to advance to the
next command in the sequence before cutting is done. This leads to strange
random behavior that usually causes the whole line to disappear instead of the
rest of line.
        */
        "D": [
            "modalkeys.cancelSelection",
            "cursorEndSelect",
            "editor.action.clipboardCopyAction",
            "deleteRight",
            "modalkeys.cancelSelection"
        ],
        /**
Again, we utilize existing mappings to implement the <key>C</key> command. It
does same thing as keys <key>D</key><key>i</key> together.
        */
        "C": { "modalkeys.typeNormalKeys": { "keys": "Di" } },
        /**
Yanking or copying is always done on selected range. So, we make sure that only
rest of line is selected before copying the range to clipboard. Afterwards we
clear the selection again.
        */
        "Y": [
            "modalkeys.cancelSelection",
            "cursorEndSelect",
            "editor.action.clipboardCopyAction",
            "modalkeys.cancelSelection"
        ],
        /**
Pasting text at cursor is done with <key>P</key> key. Following Vim convention
<key>p</key> pastes text after cursor position. In both cases we clear the
selection after paste, so that we don't accidently end up in visual mode.
        */
        "p": [
            "cursorRight",
            "editor.action.clipboardPasteAction",
            "modalkeys.cancelSelection"
        ],
        "P": [
            "editor.action.clipboardPasteAction",
            "modalkeys.cancelSelection"
        ],
        /**
<key>J</key> joins current and next lines together adding a space in between.
There is a built in command that does just this.
        */
        "J": "editor.action.joinLines",
        /**
Undoing last change is also a matter of calling built-in command. We clear the
selection afterwards.
        */
        "u": [
            "undo",
            "modalkeys.cancelSelection"
        ],
        /**
The last "simple" keybinding we define is <key>`</key> that repeats the last
command that changed the text somehow. This command is provided by ModalKeys. It
checks after each key sequence is typed whether it caused a change in file.
If so, it stores the seqeuence as a change. The command just runs the stored
keysequence again.
        */
        ".": "modalkeys.repeatLastChange",
        /**
## Editing with Motions

So, far we have kept the structure of keybindings quite simple. Now we tackle
the types of keybinding that work in tandem with motion commands. Examples of
such commands include:

<key>c</key><key>i</key><key>b</key> - Change text inside curly braces `{}`

<key>></key><key>G</key> - Indent rest of the file

<key>y</key><key>\`</key><key>a</key> - Yank text from cursor position to mark `a`

We can combine any editing command with any motion, which gives us thousands
of possible combinations. First type the command key and then motion which
specifies the position or range you want to apply the command to.

| Keys          | Command
| ------------- | ---------------------------
| `d`<_motion_> | Delete range specified by <_motion_>
| `c`<_motion_> | Delete range specified by <_motion_> and switch to insert mode
| `y`<_motion_> | Yank range specified by <_motion_> to clipboard
| `>`<_motion_> | Indent range specified by <_motion_>
| `<`<_motion_> | Outdent range specified by <_motion_>
| `=`<_motion_> | Reindent (reformat) range specified by <_motion_>

We can define all commands listed above in a single keybinding block. Remember
that our strategy is just to map the key sequences of the edit commands that use
motions to equivalent commands that work in visual mode. We do the specified
motion in visual mode selecting a range of text, and then running the command
on the selection. It does not matter which editing command we run, all of them
can be mapped the same way.
        */
       ...operators({
        operators: {
            "d": "editor.action.clipboardCutAction",
            "y": [ "editor.action.clipboardCopyAction", "modalkeys.cancelMultipleSelections" ],
            "c": [
                "deleteRight",
                { if: "!__selection.isSingleLine", then: "editor.action.insertLineBefore" },
                "modalkeys.enterInsert"
            ],
            "<": ["editor.action.outdentLines", "modalkeys.cancelMultipleSelections" ],
            ">": ["editor.action.indentLines", "modalkeys.cancelMultipleSelections" ]
        },
        objects: {
            "j": [
                "modalkeys.cancelMultipleSelections",
                {
                    "cursorMove": {
                        to: 'down',
                        by: 'wrappedLine',
                        select: true,
                        value: '__count'
                    }
                },
                "expandLineSelection",
            ],
            "k": [
                "modalkeys.cancelMultipleSelections",
                {
                    "cursorMove": {
                        to: 'up',
                        by: 'wrappedLine',
                        select: true,
                        value: '__count'
                    }
                },
                "expandLineSelection",
            ],
            ...(Object.fromEntries(["f", "F", "t", "T", "w", "b", "e", "W", "B", "E", "^",
                    "$", "0", "G", "H", "M", "L", "%", "g_", "gg"].
                map(k => [k, { "typeKeys": { keys: "v"+k } } ]))),
            ...aroundObjects({
                "w": { value: "\\\\W", regex: true },
                "p": { value: "(?<=\\\\r?\\\\n)\\\\s*\\\\r?\\\\n", regex: true },
                "(": { from: "(", to: ")" },
                "{": { from: "{", to: "}" },
                "[": { from: "[", to: "]" },
                "<": { from: "<", to: ">" },
                ")": { from: "(", to: ")" },
                "}": { from: "{", to: "}" },
                "]": { from: "[", to: "]" },
                ">": { from: "<", to: ">" },
                ...(Object.fromEntries(["'", "\"", "`"].map(c => [c, c])))
            }),
        }
       }),

               /**
## Searching

Searching introduces a pseudo-mode that captures the keyboard and suspends other
commands as long as search is on. Searching commands are shown below.

| Keys      | Command
| --------- | --------------------
| `/`       | Start case-sensitive search forwards
| `?`       | Start case-sensitive search backwards
| `n`       | Select the next match
| `p`       | Select the previous match

**Note**: Searching commands work also with multiple cursors. As in Vim, search
wraps around if top or bottom of file is encountered.
        */
        "/": [
            {
                "modalkeys.search": {
                    "caseSensitive": true,
                    "wrapAround": true
                }
            }
        ],
        "?": {
            "modalkeys.search": {
                "backwards": true,
                "caseSensitive": true,
                "wrapAround": true
            }
        },
        "n": "modalkeys.nextMatch",
        "N": "modalkeys.previousMatch",
        /**
## Miscellaneous Commands

Rest of the normal mode commands are not motion or editing commands, but do
miscellaenous things.

| Keys      | Command
| --------- | ---------------------------------
| `:`       | Show command menu (same as <key>Ctrl</key><key>Shift</key><key>P</key>)
| `zz`      | Center cursor on screen
| `ZZ`      | Save file and close the current editor (tab)
| `ZQ`      | Close the current editor without saving

Note that <key>Z</key><key>Q</key> command still asks to save the file, if
it has been changed. There is no way to get around this in VS Code.
        */
        ":": "workbench.action.showCommands",
        "z": {
            "z": { "revealLine": { lineNumber: '__line', at: 'center' } }
        },
        "Z": {
            "help": "Z - Close and save, Q - Close without saving",
            "Z": [
                "workbench.action.files.save",
                "workbench.action.closeActiveEditor"
            ],
            "Q": "workbench.action.closeActiveEditor"
        }
    },
}
/**
## Conclusion

The list of commands we provided is by no means exhaustive but still contains
literally thousands of key combinations that cover the many commonly used Vim
operations. This is quite a nice achievement considering that we only wrote
about 600 lines of configuration, and most of it is pretty trivial. This
demonstrates that ModalKeys's functionality is powerful enough to build all
kinds of operations that make modal editors like Vim popular.
*/
