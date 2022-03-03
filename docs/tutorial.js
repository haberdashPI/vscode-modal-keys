// # Build Your Own Vim Emulation for VS Code

// [Vim][] has probably survived among modern IDEs because of its relatively
// unique philosophy. It supports [modal editing][], where the effect of each
// key press depends on the mode you're in. In insert mode, typing keys works
// the way it would in any editor: it inserts the keys you press. In normal
// mode, the sequences of keys you press invoke various commands, with commonly
// used commands usally requiring just one or two keystrokes. 

// This might sound daunting to learn, and granted, the learning curve is steep.
// But after you are fully accustomed to this way of editing, there's no turning
// back. You can move to, select and change documents so precisely and quickly
// that going without modal editing will feel painfully slow and cumbersome. The
// proof of this is that nearly all popular text editors have some kind of
// add-in that provides Vim emulation. VS Code has several of them.

// One key advantage of modal keybindings is realized when you understand its
// noun-verb structure: many bindings define objects (regions of text you want
// to do something to, a.k.a. nouns) and others define operators (things you
// want to actually do to the objects, a.k.a. verbs). Muscle memory makes these
// combinations fast, and suddenly there is a large generative space of possible
// commands that you emmit at the speed-of-thought. 

// In particular the value added for ModalKeys's approach is is that it utilizes
// VS Code's existing features and just adds the concept of modal editing to the
// mix. This choice has two major benefits: (1) the commands can integrate
// seamlessly with the ecosystem of packages already present in VSCode, providng
// more long-term capabilities than emulating vim alone could provide and (2)
// the commands can be customized in precisely the way that works best for you.

// In ModalKeys, you define a configuration file as a javascript file, and you
// then import it using the `ModalKeys: Import preset keybindings` command.

// We don't have to use Vim's standard key bindings, if we prefer not to. You
// can map any key (sequence) to any command. However, you probably want to keep
// most of the basic commands the same, because you can then share muscle memory
// between basic vim usage and your own keybindings. Here, to keep things
// familiar, we'll follow most of Vim's conventions. 

// To start, our preset file will export a single object, containing the
// property `keybindings`.

module.exports = {
    "keybindings": {

// ## Switching Between Modes

// First things first: we need to be able to enter the normal mode somehow. The
// <key>Esc</key> key is mapped to the `modalkeys.enterNormal` command by default,
// so we dont't need to do anything for that. If you like, you can map other keys to
// this command using VS Code's standard keymappings pressing
// <key>Ctrl/Cmd</key>+<key>K</key> <key>Ctrl/Cmd</key>+<key>S</key>.

// ### Insert Text

// There are multiple ways to enter insert mode. If you want to insert text in the
// current cursor position, you press <key>i</key>.
        "i": "modalkeys.enterInsert",
// To insert text at the beginning of line, you press <key>I</key>. For this
// operation, we need a command sequence, i.e. an array of commands.
        "I": [
            "cursorHome",
            "modalkeys.enterInsert"
        ],

// ### Append Text

// _Appending_ text works analogously; <key>a</key> appends text after current
// character and <key>A</key> at the end of the line. There is a special case,
// though. If cursor is already at the last character of the line, it should not
// move. This is why we use a conditional command to move the cursor only, if the
// current character is not an empty string which marks the end of the line. 

        "a": [
            { "if": "__char == ''", "then": "cursorRight" },
            "modalkeys.enterInsert"
        ],
        "A": [ "cursorEnd", "modalkeys.enterInsert" ],

// ### Open a New Line

// The third way to enter insert mode is to _open_ a line. This means creating an
// empty line, and putting the cursor on it. There are two variants of this command
// as well: <key>o</key> opens a new line below the current line whereas
// <key>O</key> opens it on the current line.

        "o": [ "editor.action.insertLineAfter", "modalkeys.enterInsert" ],
        "O": [ "editor.action.insertLineBefore", "modalkeys.enterInsert" ],

// Now we can test the commands we just created.

// ## Cursor Movement

// The next task in hand is to add commands for moving the cursor. As all Vim users
// know, instead of arrow keys, we move the cursor with <key>h</key>, <key>j</key>,
// <key>k</key>, and <key>l</key> keys. Before implementing these, let's talk a bit
// about text selection.

// ### Selecting Text

// In Vim, there is a separate "visual" mode that you activate when you want to
// select text. Visual mode can be characterwise or linewise.

// Visual mode is on whenver an additional flag is set (by issuing a `setMode` command) and whenver you select text in the usual way from VSCode (e.g. via `modealkeys.toggleSelection`).

// The end result is that selection mode works _almost_ like visual mode in Vim,
// the main difference being that selections are not automatically turned off
// when you enter insert mode.

// So, let's add a binding to toggle selections on or off. We use the familiar
// <key>v</key> key for this.

        "v": "modalkeys.toggleSelection",


// Now we can add commands for cursor movement. These commands use the generic
// [`cursorMove` command][commands] which takes arguments.  The `__mode ==
// "visual"` ensures that the commands only select text if we're in `visual`
// mode.

        "h": { "cursorMove": { to: 'left', select: '__mode == "visual"' } },
        "j": { "cursorMove": { to: 'down', select: '__mode == "visual"' } },
        "k": { "cursorMove": { to: 'up', select: '__mode == "visual"' } },
        "l": { "cursorMove": { to: 'right', select: '__mode == "visual"' } },


// If we want to be more succinct in how we write these commands, we can also do the following.

    "::using::cursorMove": {
        "h": { to: 'left', select: '__mode == "visual"' },
        "j": { to: 'down', select: '__mode == "visual"' },
        "k": { to: 'up', select: '__mode == "visual"' },
        "l": { to: 'right', select: '__mode == "visual"' },
    },

// ModalKeys knows to re-write this, such that thet two forms are equivalent.

// We can also simulate linewise visual mode using VS Code's
// `expandLineSelection` command. Note that we don't need to call
// `modalkeys.toggleSelection` this time as selection mode is turned on
// automatically.


    "V": "expandLineSelection",

// ### Moving Inside Screen

// To move cursor quickly to the top, middle, or bottom of the screen we use keys
// <key>H</key>, <key>M</key>, and <key>L</key>. Again, we need to use the
// [`cursorMove` command][commands].


    "::using::cursorMove": {
        "H": { to: 'viewPortTop', select: '__mode == "visual"' },
        "M": { to: 'viewPortCenter', select: '__mode == "visual"' },
        "L": { to: 'viewPortBottom', select: '__mode == "visual"' },
    },


// ### Jumping to Previous/Next Word

// Other commonly used navigation commands in Vim include <key>w</key> and
// <key>b</key> which move the cursor to the start of the next and previous word.
// For these we need to use conditional commands because `cursorMove` falls short
// in this use case.

        "w": {
            "if": "__mode == 'visual'",
            "then": "cursorWordStartRightSelect",
            "else": "cursorWordStartRight"
        },
        "b": {
            "if": "__mode == 'visual'",
            "then": "cursorWordStartLeftSelect",
            "else": "cursorWordStartLeft"
        },

// <key>e</key> jumps to the end of the next word.

        "e": {
            "if": "__mode == 'visual'",
            "then": "cursorWordEndRightSelect",
            "else": "cursorWordEndRight"
        },

// > **Note**: We omit variants of these commands <key>W</key>, <key>B</key>, and
// > <key>E</key> which skip the punctuation characters. There are no built-in
// > commands in VS Code that work exactly like those in Vim. There are some extensions
// > you can make use of to implement these commands (e.g. [Selection Utilities](https://github.com/haberdashPI/vscode-selection-utilities)).
// > That's beyond the scope of this tutorial.

// ### Jumping to Start/End of Line

// In the similar vein, we'll throw in commands for jumping to the beginning
// <key>0</key>, to the first non-blank character <key>^</key>, and to the end of
// line <key>$</key>.

    "::using::curosrMove": {
        "0": { to: 'wrappedLineStart', select: '__mode == "visual"' },
        "^": { to: 'wrappedLineFirstNonWhitespaceCharacter', select: '__mode == "visual"' },
        "$": { to: 'wrappedLineEnd', select: '__mode == "visual"' },
    },

// A lesser known variant of above commands is <key>g</key><key>_</key> that jumps
// to the last non-blank character of the line.

    "g_": { "cursorMove":
        { to: 'wrappedLineLastNonWhitespaceCharacter', select: '__mode == "visual"' }
    },

// ### Jumping to Start/End of Document

// Another motion command is <key>g</key><key>g</key> which jumps to the beginning
// of the file.

            "g": {
                "if": "__mode == 'visual'",
                "then": "cursorTopSelect",
                "else": "cursorTop"
            },
        },

// The opposite of that is <key>G</key> wich jumps to the end of file.

        "G": {
            "if": "__mode == 'visual'",
            "then": "cursorBottomSelect",
            "else": "cursorBottom"
        },

// ### Jump to Character

// We have the basic movement commands covered, so let's move on to more
// sophisticated ones. Seasoned Vim users avoid hitting movement commands
// repeatedly by using <key>f</key> and <key>F</key> keys which move directly to a
// given character. VS Code provides no built-in command for this, but ModalKeys
// includes an incremental search command which can be customized to this purpose.

        "f": {
            "if": "__mode == 'visual'",
            "then": {
                "modalkeys.search": {
                    "caseSensitive": true,
                    "acceptAfter": 1,
                    "selectTillMatch": true,
                }
            },
            "else": {
                "modalkeys.search": {
                    "caseSensitive": true,
                    "acceptAfter": 1,
                    "offset": "exclusive",
                }
            },
        },

// The command is a bit involved, so let's explain what each argument does.

// - `caseSensitive` sets the search mode to case sensitive (as in Vim).
// - `acceptAfter` ends the incremental search as soon as first entered character
//   is found. Normally the user needs to press <key>Enter</key> to accept the
//   search or <key>Esc</key> to cancel it.
// - `selectTillMatch` argument controls whether selection is extended until the
//   searched character. This depends on whether we have selection mode on or not.
// - `offset` argument allows determine where the cursor should land at each match of the
//   search. By default, `modalEdit.search` uses an "inclusive" offset, meaning the cursor ends
//   after the match when moving foward and before it when moving backward. When set to
//   exclusive, the opposite is true: the cursor lands before when moving forward and after
//   the match when moving backward (the offset can also be set to "start" or "end" to
//   always end at the start or end of a match, regardless of search direction).

// Now we can implement the opposite <key>F</key> command which searches for the
// previous character. The `backwards` parameter switches the search direction.

        "F": {
            "if": "__mode == 'visual'",
            "then": {
                "modalkeys.search": {
                    "caseSensitive": true,
                    "acceptAfter": 1,
                    "selectTillMatch": true,
                    "backwards": true,
                }
            },
            "else": {
                "modalkeys.search": {
                    "caseSensitive": true,
                    "acceptAfter": 1,
                    "offset": "exclusive",
                    "backwards": true
                }
            },
        },

// With <key>;</key> and <key>,</key> keys you can repeat the previous <key>f</key>
// or <key>F</key> commands either forwards or backwards.

        ";": "modalkeys.nextMatch",
        ",": "modalkeys.previousMatch",

// > We omitted a few useful jump commands, like <key>t</key>, <key>T</key>,
// > <key>{</key>, and <key>}</key>.  The t and T commands could be implemented
// > using the "exclusive" offset. The paragraph operators, require an extension, like
// > [selection-utilities](https://github.com/haberdashPI/vscode-selection-utilities) to implement.

// ### Center Cursor on Screen

// The last movement command we add is <key>z</key><key>z</key> that scrolls the
// screen so that cursor is at the center. Again, the ability to use JS expression
// in arguments comes in handy: WE use the `__line` parameter to get the line where
// the cursor is.

        // "zz": { "revealLine": { lineNumber: '__line', at: 'center' } }

// Let's test some of the movement commands. We should be able to navigate now
// without using arrow keys or <key>Home</key> and <key>End</key> keys.

// We skipped commands that move cursor up and down on page at the time. The
// reason for this is that these commands are bound to <key>Ctrl/Cmd</key>+<key>b</key>
// and <key>Ctrl/Cmd</key>+<key>f</key> in Vim. Since these are "normal" VS Code
// shortcuts we cannot remap them in ModalKeys. If you want to use these shortcuts,
// you need to add the bindings to the VS Code's `keybindings.json` file. Below is
// an example that uses the `modalkeys.normal` context to make the shortcuts work
// only in normal mode. Most of the Vim's standard <key>Ctrl/Cmd</key>+key combinations
// are already in use, so you need to decide whether you want to remap the existing
// commands first.

/* keybindings.json should contain the following:
{
    {
        "key": "ctrl+b",
        "command": "cursorPageUp",
        "when": "editorTextFocus && modalkeys.mode == normal"
    },
    {
        "key": "ctrl+f",
        "command": "cursorPageDown",
        "when": "editorTextFocus && modalkeys.mode == normal"
    }
}
*/

// ## Commands with Counts

// In Vim, you can repeat commands by typing a number first. For example,
// <key>3</key><key>j</key> moves the cursor down three lines. When you type numbers
// as part of a key sequence, ModalKeys stores these as a number, which you can access using the `__count` variable.

// To make use of counts, we need to update some of the commands above.
// Below are shown the updated cursor movements that use the `__count` variable.

    "::using::cursorMove": {
        "h": { to: 'left', select: '__mode == "visual"', value: '__count' },
        "j": { to: 'down', select: '__mode == "visual"', value: '__count' },
        "k": { to: 'up', select: '__mode == "visual"', value: '__count' },
        "l": { to: 'right', select: '__mode == "visual"', value: '__count' },
    },
    "w": {
        "if": "__mode == 'visual'",
        "then": { "cursorWordStartRightSelect": {}, repeat: '__count' },
        "else": { "cursorWordStartRight": {}, repeat: '__count' },
    },
    "b": {
        "if": "__mode == 'visual'",
        "then": { "cursorWordStartLeftSelect": {}, repeat: '__count' },
        "else": { "cursorWordStartLeft": {}, repeat: '__count' },
    },
    "e": {
        "if": "__mode == 'visual'",
        "then": { "cursorWordEndRightSelect": {}, repeat: '__count' },
        "else": { "cursorWordEndRight": {}, repeat: '__count' },
    },

// Many command, like those shown above, can internally repeat (e.g. `value` for `cursorMove`), and this is generally better, as it execute faster. If a command does not take a parameter like this however, you can make use of the `repeat` parameter, shown above for the word motions. This will simply call the command multiple times.

// ### Jumping to a Line

// Another command that has a number prefix is _x_<key>G</key> where _x_ is the
// line number you want to jump to. Let's add that as well in the same keymap.
// While the mapping is trivial the command itself is a bit involved, because we
// need to use two commands to do the jumping. First we move the target line to the
// top of the screen, and then we move the cursor to the same line. Unfortunately
// the built-in command `workbench.action.gotoLine` does not take any arguments, so
// we have to reinvent the wheel.


    "G": [
        { "revealLine": { lineNumber: '__count', at: 'top' } },
        { "cursorMove": { "to": "viewPortTop" } }
    ],

// ## Editing

// Now we'll implement Vim's common editing commands. We only add the ones that
// have counterparts in VS Code.

// ### Joining Lines

// <key>J</key> joins current and next line together.

        "J": "editor.action.joinLines",

// ### Changing Text

// _Change_ commands delete some text and then enter insert mode.
// <key>c</key><key>c</key> changes the current line (or all selected lines),
// <key>c</key><key>\$</key> changes the text from the cursor to the end of line,
// and <key>c</key><key>w</key> changes the end of the word. Three key sequnce
// <key>c</key><key>i</key><key>w</key> changes the whole word under the cursor.

    "cc": [
        "deleteAllLeft",
        "deleteAllRight",
        "modalkeys.enterInsert"
    ],
    "c$": [
        "deleteAllRight",
        "modalkeys.enterInsert"
    ],
    "cw": [
        "deleteWordEndRight",
        "modalkeys.enterInsert"
    ],

// ### Change Until/Around/Inside

// Very useful variants of change commands are those which allow changing text
// upto a given character or between given characters. For example,
// <key>c</key><key>t</key><key>_</key> changes the text until next underscore, and
// <key>c</key><key>i</key><key>"</key> changes the text inside quotation
// marks. The cursor can be anywhere inside the quotation marks and the command
// still works.

// First, we use the `executeAfter` option of the search command to
// implement changing all characters up until the given letter.

    "ct": {
        "modalkeys.search": {
            caseSensitive: true,
            acceptAfter: 1,
            backwards: false,
            selectTillMatch: true,
            offset: 'exclusive',
            wrapAround: false,
            executeAfter: [
                "deleteLeft",
                "modalkeys.enterInsert"
            ]
        }
    },
    "cf": {
        "modalkeys.search": {
            caseSensitive: true,
            acceptAfter: 1,
            backwards: false,
            selectTillMatch: true,
            offset: 'inclusive',
            wrapAround: false,
            executeAfter: [
                "deleteLeft",
                "modalkeys.enterInsert"
            ]
        }
    },

// Next, we add commands to change the text inside or around various brackets, using an extension which [implements this behavior](https://github.com/dbankier/vscode-quick-select/).

    "ci(": [ "modalkeys.cancelMultipleSelections", "extension.selectParenthesis", "deleteLeft", "modalkeys.enterInsert" ],
    "ca(": [ "modalkeys.cancelMultipleSelections", "extension.selectParenthesis", "extension.selectParenthesis", "deleteLeft", "modalkeys.enterInsert" ],
    "ci[": [ "modalkeys.cancelMultipleSelections", "extension.selectSquareBrackets", "deleteLeft", "modalkeys.enterInsert" ],
    "ca[": [ "modalkeys.cancelMultipleSelections", "extension.selectSquareBrackets", "extension.selectSquareBrackets", "deleteLeft", "modalkeys.enterInsert" ],
    "ci{": [ "modalkeys.cancelMultipleSelections", "extension.selectCurlyBrackets", "deleteLeft", "modalkeys.enterInsert" ],
    "ca{": [ "modalkeys.cancelMultipleSelections", "extension.selectCurlyBrackets", "extension.selectCurlyBrackets", "deleteLeft", "modalkeys.enterInsert" ],

// For each of these commands we first clear the selection, while leaving multiple cursors intact, to ensure the subsequent commands behave properly. Then we use the extension to select the appropriate region of text, delete it, and enter insert mode.

// It is also useful to be able to change the current word the cursor is on. You
// can do this by typing <key>c</key><key>i</key><key>w</key>.

        "ciw": [
            "modalkeys.cancelMultipleSelections",
            "editor.action.smartSelect.expand",
            "deleteLeft",
            "modalkeys.enterInsert"
        ],

// > We could also implement delete commands <key>d</key><key>i</key><key>w</key>,
// > <key>d</key><key>t</key><key>-</key>, etc. in the similar fashion. But for the
// > sake of keeping the tutorial short, we'll leave those as an exercise.

// A shorthand for  <key>c</key><key>$</key> command is <key>C</key>.

        "C": [
            "deleteAllRight",
            "modalkeys.enterInsert"
        ],

// ### Undo & Redo

// You can undo the last change with <key>u</key>. We also clear the selection to
// copy Vim's operation.

        "u": [
            "undo",
            "modalkeys.cancelSelection"
        ],

// Since redo is mapped to <key>Ctrl/Cmd</key>+<key>r</key> by default, we leave this
// binding as an exercise to the reader.

// ## Visual (Selection) Commands

// Visual commands operate on the selected text. <key><</key> and <key>></key>
// shift selected text left or right (indent/outdent).

        "<": "editor.action.outdentLines",
        ">": "editor.action.indentLines",

// ### Clipboard Commands

// <key>y</key> yanks, i.e. copies, selected text to clipboard. Following Vim
// convention, we also clear the selection.

        "y": [
            "editor.action.clipboardCopyAction",
            "modalkeys.cancelSelection"
        ],

/* <key>d</key> deletes (cuts) the selected text and puts it to clipboard. Capital
<key>D</key> deletes the rest of the line. <key>x</key> deletes just the
character under the cursor. */

        "d": "editor.action.clipboardCutAction",
        "D": [
            "cursorEndSelect",
            "editor.action.clipboardCutAction"
        ],
        "x": [
            "cursorRightSelect",
            "editor.action.clipboardCutAction"
        ],

// > **Note**: If there is no text selected, <key>y</key> and <key>d</key> commands
// > perform exactly the same actions as <key>y</key><key>y</key> and
// > <key>d</key><key>d</key> in Vim. That is, they yank or delete the current
// > line. Again, one of the subtle differences that is futile to try to unify.

// For pasting (or _putting_ in Vim parlance) the text in clipboard you have two
// commands: <key>p</key> puts the text after the cursor, and <key>P</key> puts it
// before.

        "p": [
            "cursorRight",
            "editor.action.clipboardPasteAction"
        ],
        "P": "editor.action.clipboardPasteAction",

// ### Switching Case

// Switching selected text to upper or lower case is done with a nifty trick.
// We can examine the selection in a conditional command that calls different VS
// Code commands based on the expression. The command is bound to the tilde
// <key>~</key> character.

    "~": {
        "if": "__selectionstr == __selection.toUpperCase()",
        "then": "editor.action.transformToLowercase",
        "else": "editor.action.transformToUppercase"
    },

// ## Searching

// The last category of commands we implement is searching. We use the incremental
// search command provided by ModalKeys for this. As in Vim, typing <key>/</key>
// starts an incremental search. <key>?</key> starts a search backwards.

    "/": {
        "command": "modalkeys.search",
        "args": {
            "caseSensitive": true
        }
    },
    "?": {
        "command": "modalkeys.search",
        "args": {
            "caseSensitive": true,
            "backwards": true
        }
    },

// Jumping to next previous match is done with keys <key>n</key> and <key>N</key>.

    "n": "modalkeys.nextMatch",
    "N": "modalkeys.previousMatch"
}

// There are some subtle differences in the search functionality as well. Instead
// of just highlighting matches ModalKeys selects them. This is preferable anyway,
// as replacing needs to be done manually with selection commands. Use VS Code's
// built-in find command, if you need regex support.

// ## Conclusion

// We have built far from complete but nevertheless usable Vim emulation which
// you can tweak in various ways to make it better. The point of this exercise was
// to show that you can significantly enhance VS Code's editing experience using
// just a simple extension and built-in commands.

// The goal of ModalKeys is not to emulate Vim. My own bindings, for day-to-day
// use, do not match Vim's. I'd recommend you start with the [preset vim
// bindings](./presets/vim.html), and then adapt them to your own purposes.

// You don't need to learn all the magical Vim facilities to make efficient use of
// ModalKeys. Just keep an eye on what operations you repeat, and think how you
// could make them more efficient. Then add commands that will speed up those
// operations. Try to make the new commands as general as possible, and as easy as
// possible to use. Your text editor should adapt to your way of working, not the
// other way around.

// Happy Editing! 🚀

// [Vim]: https://www.vim.org/
// [ModalKeys]: https://github.com/haberdashPI/vscode-modal-keys
// [modal editing]: https://unix.stackexchange.com/questions/57705/modeless-vs-modal-editors
// [commands]: https://code.visualstudio.com/api/references/commands
// [Vim Cheat Sheet]: https://vim.rtorr.com/
// [extensions]: https://marketplace.visualstudio.com/
// [recursive keymaps]: https://johtela.github.io/vscode-modalkeys.docs/README.html#defining-recursive-keymaps
// [selectBetween]: https://johtela.github.io/vscode-modalkeys.docs/README.html#selecting-text-between-delimiters
