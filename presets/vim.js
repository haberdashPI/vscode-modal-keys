// # Advanced vim presets

// This document provides a more advanced set of vim keybindings than provided in
// the [tutorial](../tutorial.html). The goal of these bindings is to lower the barrier to
// entry for Vim users who don't want to spend the time defining bindings from
// ground up. A secondary goal is to show off some of the more advanced features of
// ModalKeys that were not discussed in the tutorial.

// If you want to modify these presets you can export and modify them using the
// "ModalKeys: Export a preset for keybindings" command. After making any
// desired changes you can import them with the "ModalKeys: Import preset
// keybindings" command.

// If you are not interested in how the Vim keybindings are implemented and just
// want to use them, you can skip this discussion. Just import the presets by
// pressing <key>Ctrl/Cmd</key>+<key>Shift</key>+<key>P</key> and running command
// `ModalKeys: Import preset keybindings`. You will be presented a choice to
// import either Vim bindings or any presets that you have created yourself. If
// you are planning to customize the bindings, or create Vim-style commands from
// scratch, this document gives you pointers on how to go about doing that.

// Unlike the tutorial, the assumption throughout this documentation is that you
// are familiar with vim. All concepts discussed here are introduced, at least
// briefly, in the tutorial.

// ## Operator Definitions

// We start with the most important feature of a vim-like keymap: the verb-noun
// format allowing a combinatorial set of commands. The verbs are called
// operators and they do things to some portion of text. The nouns are called
// objects and they define some region of text the operators modify. For
// example delete a word you type <key>d</key> (for delete) and <key>w</key>
// (for word). 

// ### Functions

// To begin with, we'll define some function to make creating the operators
// easier. Since imported keybindings can be defined using javascript, this can
// help generalize our bindings, allowing us to create many keybindings at once.
// 

/**
 * Creates a series of key mappings which select a region of text around
 * or within a given boundary (e.g. {from: "(", to: ")"})
 * 
 * @param mappings: a map of key: bounds pairings. Each key is a 
 * single-character string (the key to map), and each bound specifies
 * the region of text around which we can select. 
 * @returns a map of key: command pairings. Two per entry in `mappings`
 * (one for within `i` and one for around `a` the given bounds)
 */
 function aroundObjects(mappings){
    return Object.fromEntries(Object.entries(mappings).map(([key, bounds]) => {
        return [
            ["a"+key, { "modalkeys.selectBetween": {
                ...aroundEntry(bounds),
                inclusive: true
            }}],
            ["i"+key,  { "modalkeys.selectBetween": {
                ...aroundEntry(bounds),
                inclusive: false
            }}]
        ]
    }).flat())
}

/**
 * Helper function. Expands a simpler `bounds` argument to the arguments required for
 * `selectBetween`
 * @param {string | {value: string} | {from: string, to: string}} bounds - 
 *    the characters around which a region should be selected. Can also include
 *    a `regex: true` field to indicate that the bounds are regular expressions to
 *    match, not strings.
 */
 function aroundEntry(bounds){
    return {
        from: typeof(bounds) === 'string' ? bounds : bounds.value || bounds.from,
        to: typeof(bounds) === 'string' ? bounds : bounds.value || bounds.to,
        regex: bounds.regex !== undefined,
        docScope: true
    }
}

/**
 * Defines a series of operators using `params`
 * 
 * @param params: an object with the following entires
 *    - operators: an object defining the operators,
 *      each entry should map a key to a command that acts on a selected 
 *      region of text (e.g. `d` to delete).
 *    - objects: an object defining the objects,
 *      each entry should map a key to a command that selects a region of text 
 *      (e.g. `w` selects a word)
 * @returns An object containing all the mappings implied by the operator
 *   object pairsing: e.g. ~n^2 entries. It also defines visual mode
 *   actions for each operator and repeated action commands (e.g. `dd`).
 */
function operators(params){
    let result = {}
    for(const [opkey, opcom] of Object.entries(params.operators)){
        for(const [objkey, objcom] of Object.entries(params.objects)){
            result["normal::"+opkey + objkey] = 
                ["modalkeys.cancelMultipleSelections", objcom, opcom]
            result["normal::"+opkey+opkey] =
                ["modalkeys.cancelMultipleSelections", "expandLineSelection", opcom]
            result["visual::"+opkey] = opcom
        }
    }
    return result
}

/**
 * Operator like behavior, but for objects that require the input of some number
 * of characters before the operator can be executed. If we just used the format
 * for `operators` above, the operator would execute before accepting input from
 * the user. To capture user input first, we insert the operator in the
 * `executeAfter` close of the search-like command (see docs for
 * [`modalkeys.search`](../commands.html#incremental-search)).
 */
function searchOperators(params){
    let result = {}
    for(const [opkey, opcom] of Object.entries(params.operators)){
        for(const [objkey, objcom] of Object.entries(params.objects)){
            result["normal::"+opkey+objkey] = [
                "modalkeys.cancelMultipleSelections", 
                executeAfter(objcom, opcom),
            ]
        }
    }
    return result
}

function executeAfter(command, after){
    let command_name = Object.keys(command).filter(str => str !== "repeat")[0]
    return {
        ...command,
        [command_name]: {
            ...command[command_name],
            executeAfter: after,
            selectTillMatch: true
        }
    }
}

// Now that we've defined the functions that generator the operator, object
// combinations, we need to define the individual operators and objects
// themselves. We define some of these as variables because they need to be
// re-used in several places 

// ### Operators

const operator_commands = {
    d: "editor.action.clipboardCutAction",
    y: [ "editor.action.clipboardCopyAction", "modalkeys.cancelMultipleSelections" ],
    c: {
        if: "!__selection.isSingleLine && __selection.end.character == 0 && __selection.start.character == 0",
        // multi-line selection
        then: [
            "deleteRight",
            "editor.action.insertLineBefore",
            "modalkeys.enterInsert"
        ],
        // single line selection
        else: [ 
            "deleteRight",
            "modalkeys.enterInsert"
        ]
    },
    ",.": [
        {
            if: "__language == 'julia'",
            then: "language-julia.executeCodeBlockOrSelectionAndMove",
            else: {
                if: "!__selection.isSingleLine",
                then: "terminal-polyglot.send-block-text",
                else: "terminal-polyglot.send-text"
            },
        },
        "modalkeys.cancelMultipleSelections",
        "modalkeys.touchDocument"
    ],
    ",;": [
        {
            if: "!__selection.isSingleLine",
            then: "terminal-polyglot.send-block-text",
            else: "terminal-polyglot.send-text"
        },
        "modalkeys.cancelMultipleSelections",
        "modalkeys.touchDocument"
    ],
    "<": ["editor.action.outdentLines", "modalkeys.cancelMultipleSelections" ],
    ">": ["editor.action.indentLines", "modalkeys.cancelMultipleSelections" ]
}

// ### Objects

// #### Objects around delimeters

// These objects are defined by the delimeters that surround them. Note
// that these are purely textual, and do not handle nesting.

const around_objects = {
    w: { value: "\\W", regex: true },
    p: { value: "^\\s*$", regex: true },
    ...(Object.fromEntries(["'", "\"", "`"].map(c => [c, c])))
}

// #### Jump to a Character 

// Advanced cursor motions in Vim include jump to character, which is especially powerful in
// connection with editing commands. With this motion, we can apply edits up to or including a
// specified character. The same motions work also as jump commands in normal mode. 

// All of these keybindings are implemented using the [incremental
// search](../doc_index.html#incremental-search) command, just the parameters are different for
// each case. Basically we just perform either a forward or backward search and use the
// "offset" option to determine where the cursor should land.

const search_objects = {
    f: {
        "modalkeys.search": {
            "acceptAfter": 1,
            "offset": "inclusive",
            "selectTillMatch": "__mode == 'visual'",
        }
    },
    F: {
        "modalkeys.search": {
            "acceptAfter": 1,
            "backwards": true,
            "offset": "inclusive",
            "selectTillMatch": "__mode == 'visual'",
        }
    },
    t: {
        "modalkeys.search": {
            "acceptAfter": 1,
            "offset": "exclusive",
            "selectTillMatch": "__mode == 'visual'",
        }
    },
    T: {
        "modalkeys.search": {
            "acceptAfter": 1,
            "backwards": true,
            "offset": "exclusive",
            "selectTillMatch": "__mode == 'visual'",
        }
    },
}

// 
// ## Game Plan

// We've defined everything we need to define before-hand. Now we move to
// actually creating the keymap.

// We start with basic motion commands which are mostly straightforward to
// implement. 

// A few notes:

// - Where useful, `__count` is used to provide the number argument
// (e.g. the `3` in 3l) to a given command.
// - When in visual model, most of the commands are built to extend the selection

// ### Required extensions

// Unlike the tutorial, these settings are not self-contained and make use of a
// variety of extensions to allow for a better set of features. You wil need the
// following extensions for all bindings to work properly:

// - [Quick and Simple Text Selection](https://marketplace.visualstudio.com/items?itemName=dbankier.vscode-quick-select)
// - [Selection Utilities](https://marketplace.visualstudio.com/items?itemName=haberdashPI.selection-utilities)
// - [Select by Indent](https://marketplace.visualstudio.com/items?itemName=haberdashPI.vscode-select-by-indent)

module.exports = {
    "extensions": [
        "dbankier.vscode-quick-select",
        "haberdashpi.vscode-select-by-indent",
        "haberdashpi.selection-utilities"
    ],

// ## Motions in Normal Mode
// 
    "keybindings": {
// Cursor can be advanced in a file with enter and space. These are not
// technically motion commands but included for compatibility.
        "\n": [
            "cursorDown",
            { "cursorMove": { "to": "wrappedLineFirstNonWhitespaceCharacter" } }
        ],
        " ": "cursorRight",
// Move cursor up/down/left/right.
        "::using::cursorMove": {
            "h": { to: 'left', select: '__mode == "visual"', value: '__count' },
            "j": { to: 'down', select: '__mode == "visual"', value: '__count' },
            "k": { to: 'up', select: '__mode == "visual"', value: '__count' },
            "l": { to: 'right', select: '__mode == "visual"', value: '__count' },
// Move to first/last character on line.
            "0": { to: 'wrappedLineStart', select: '__mode == "visual"' },
            "$": { to: 'wrappedLineEnd', select: '__mode == "visual"' },
// Move to first/last non-blank character on line. Also these ones use the
// `__selecting` flag to check whether we are in visual mode.
            "^": { to: 'wrappedLineFirstNonWhitespaceCharacter', select: '__mode == "visual"' },
            "g_": { to: 'wrappedLineLastNonWhitespaceCharacter', select: '__mode == "visual"' },
        },
        "_": "cursorHomeSelect",

// Moving to beginning or end of the file.
        gg: "cursorTop",
        "visual::gg": "cursorTopSelect",
        G: "cursorBottom",
        "visual::G": "cursorBottomSelect",
// Switch to next and previous tab.
        gt: "workbench.action.nextEditor",
        gT: "workbench.action.previousEditor",
// The logic of separating words is bit different in VS Code and Vim, so we will
// not aim to immitate Vim exaclty. If that's something you want, you might
// consider looking at [Selection
// Utilities](https://github.com/haberdashPI/vscode-selection-utilities). 
// These keys are mapped to the most similar motion available. The <key>W</key> and
// <key>B</key> move past all non-space characters, and are implemented using the
// search command, with appropriate options. To handling of count arguments, we use
// the `repeat` option.
        w: { "cursorWordStartRight": {}, "repeat": "__count" },
        "visual::w": { "cursorWordStartRightSelect": {}, "repeat": "__count" },
        e: { "cursorWordEndRight": {}, "repeat": "__count" },
        "visual::e": { "cursorWordEndRightSelect": {}, "repeat": "__count" },
        b: { "cursorWordStartLeft": {}, "repeat": "__count" },
        "visual::b": { "cursorWordStartLeftSelect": {}, "repeat": "__count" },
        W: {
            "modalkeys.search": {
                "text": "\\S+",
                "offset": 'inclusive',
                "regex": true,
                "selectTillMatch": '__mode == "visual"',
                "highlightMatches": false,
            },
            "repeat": '__count',
        },
        B: {
            "modalkeys.search": {
                "text": "\\S+",
                "offset": 'inclusive',
                "regex": true,
                "backwards": true,
                "selectTillMatch": '__mode == "visual"',
                "highlightMatches": false,
            },
            "repeat": '__count',
        },

// To jump paragraphs we just search for the first blank line. When moving
// forward, we need to use `executeAfter` (which runs a command after search is
// accepterd). We use this to move one extra character forward to get to the
// actual empty line because of the way search works with newlines.
        "}": {
            "modalkeys.search": {
                "text": "^\\s*$",
                "offset": 'inclusive',
                "regex": true,
                "backwards": false,
                "selectTillMatch": '__mode == "visual"',
                "highlightMatches": false,
                "executeAfter": { "cursorMove": 
                    { to: 'right', select: '__mode == "visual"' } }
            },
            "repeat": '__count',
        },
        "{": {
            "modalkeys.search": {
                "text": "^\\s*$",
                "offset": 'inclusive',
                "regex": true,
                "backwards": true,
                "selectTillMatch": '__mode == "visual"',
                "highlightMatches": false,
            },
            "repeat": '__count',
        },
// Moving cursor to the top, middle, and bottom of the screen is mapped to
// <key>H</key> (high), <key>M</key> (middle), and <key>L</key> (low) keys.
        H: { "cursorMove": { to: 'viewPortTop', select: '__mode == "visual"' } },
        M: { "cursorMove": { to: 'viewPortCenter', select: '__mode == "visual"' } },
        L: { "cursorMove": { to: 'viewPortBottom', select: '__mode == "visual"' } },
// Move to matching bracket command is somewhat challenging to implement
// consistently in VS Code. This is due to the problem that there are no commands
// that do exactly what Vim's motions do, and because VSCode extensions are not
// allowed to access VS Code's parsing of brackets 😞, and so have to re-implement
// parsing (see, for example,
// [bracketeer](https://marketplace.visualstudio.com/items?itemName=pustelto.bracketeer)).
// In normal mode we call the `jumpToBracket` command which works if the cursor is
// on top of a bracket, but does not allow for the selection to be extended. In
// visual mode we use the `smartSelect.expand` command, which is *roughly*
// equivlaent. In many cases, it is more useful motion than jumping to a matching
// bracket, but using it means that we are diverging from Vim's functionality.
        "%": "editor.action.jumpToBracket",
        "visual::%": "editor.action.smartSelect.expand",

// ## Search Operators
// Having defined the search operators above, we now insert them into the keymap
        ...search_objects,

// Repeating the motions can be done simply by calling `nextMatch` or
// `previousMatch`.
        ";": "modalkeys.nextMatch",
        ",,": "modalkeys.previousMatch",
// ## Switching between Modes

// Next, we define keybindings that switch between normal, insert, and visual mode:
        "normal::i": "modalkeys.enterInsert",
        I: [
            "cursorHome",
            "modalkeys.enterInsert"
        ],
// The `a` has to check if the cursor is at the end of line. If so, we don't move
// right because that would move to next line.
        "normal::a": [
            {
                "if": "__char == ''",
                "else": "cursorRight"
            },
            "modalkeys.enterInsert"
        ],
        A: [
            "cursorEnd",
            "modalkeys.enterInsert"
        ],
        o: [
            "editor.action.insertLineAfter",
            "modalkeys.enterInsert"
        ],
        O: [
            "editor.action.insertLineBefore",
            "modalkeys.enterInsert"
        ],
// Note that visual mode works a little differently than in vim. We don't
// seek to mimc visual mode particularly. Basically, we just toggle a switch that allows the
// motion commands to extend and create selections.
        v: "modalkeys.toggleSelection",
// ## Editing in Normal Mode

// Editing commands in normal mode typically either affect current character or
// line, or expect a motion key sequence at the end which specifies the scope of
//  the edit. Let's first define simple commands that do not require a motion
//  suffix:

// <key>x</key> and <key>X</key> commands do exactly what <key>Delete</key> and
// <key>Backspace</key> keys do.
        x: "deleteRight",
        X: "deleteLeft",
        r: "modalkeys.replaceChar",
// Deleting in Vim always copies the deleted text into clipboard, so we do that
// as well. If you are wondering why we don't use VS Code's cut command, it has a
// synchronization issue that sometimes causes the execution to advance to the
// next command in the sequence before cutting is done. This leads to strange
// random behavior that usually causes the whole line to disappear instead of the
// rest of line.
        D: [
            "modalkeys.cancelSelection",
            "cursorEndSelect",
            "editor.action.clipboardCopyAction",
            "deleteRight",
            "modalkeys.cancelSelection"
        ],
// We utilize existing mappings to implement the <key>C</key> command. It
// does same thing as keys <key>D</key><key>i</key> together.
        C: { "modalkeys.typeKeys": { "keys": "Di" } },
// Yanking or copying is always done on a selected range. So, below, we make sure
// that only the rest of line is selected before copying the range to clipboard.
// Afterwards we clear the selection again.
        Y: [
            "modalkeys.cancelSelection",
            "cursorEndSelect",
            "editor.action.clipboardCopyAction",
            "modalkeys.cancelSelection"
        ],
// Pasting text at cursor is done with <key>P</key> key. Following Vim convention
// <key>p</key> pastes text after cursor position. In both cases we clear the
// selection after paste, so that we don't accidently end up in visual mode. Note
// that these do not work exactly the same as the VIM commands. In vim paste
// behaviors differently depending on whether you have a single line or multiple
// lines in the clipboard. You would need to write a VSCode extension that inspects
// the contents of the clipboard before pasting to get this same behavior. 
        p: [
            "cursorRight",
            "editor.action.clipboardPasteAction",
            "modalkeys.cancelSelection"
        ],
        P: [
            "editor.action.clipboardPasteAction",
            "modalkeys.cancelSelection"
        ],
// <key>J</key> joins current and next lines together adding a space in between.
        J: "editor.action.joinLines",
// Undoing last change is also a matter of calling built-in commands. We clear the
// selection afterwards.
        u: [
            "undo",
            "modalkeys.cancelSelection"
        ],
// The last "simple" keybinding we define is <key>`</key> that repeats the last
// command that changed the text somehow. This command is provided by ModalKeys. It
// checks after each key sequence is typed whether it caused a change in file.
// If so, it stores the seqeuence as a change. The command just runs the stored
// keysequence again.

        ".": "modalkeys.repeatLastChange",
// ## Editing with Motions

// So, far we have kept the structure of keybindings quite simple. Now we tackle
// the types of keybinding that work in tandem with motion commands. Examples of
// such commands include:

// <key>c</key><key>i</key><key>b</key> - Change text inside curly braces `{}`

// <key>></key><key>G</key> - Indent rest of the file

// <key>y</key><key>\`</key><key>a</key> - Yank text from cursor position to mark `a`

// We can combine any editing command with any motion, which gives us thousands
// of possible combinations. First type the command key and then motion which
// specifies the position or range you want to apply the command to.

// | Keys          | Command
// | ------------- | ---------------------------
// | `d`<_motion_> | Delete range specified by <_motion_>
// | `c`<_motion_> | Delete range specified by <_motion_> and switch to insert mode
// | `y`<_motion_> | Yank range specified by <_motion_> to clipboard
// | `>`<_motion_> | Indent range specified by <_motion_>
// | `<`<_motion_> | Outdent range specified by <_motion_>
// | `=`<_motion_> | Reindent (reformat) range specified by <_motion_>

// We can define all commands listed above in a single keybinding block. Remember
// that our strategy is just to map the key sequences of the edit commands that use
// motions to equivalent commands that work in visual mode. We do the specified
// motion in visual mode selecting a range of text, and then running the command
// on the selection. It does not matter which editing command we run, all of them
// can be mapped the same way.
       ...operators({
        operators: operator_commands,
        objects: {
            j: [
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
            k: [
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
            h: [
                {
                    "cursorMove": {
                        to: 'left',
                        select: true,
                        value: '__count'
                    }
                },
            ],
            l: {
                "cursorMove": {
                    to: 'right',
                    select: true,
                    value: '__count'
                }
            },
            "i(": "extension.selectParenthesis",
            "a(": "extension.selectParenthesisOuter",
            "i[": "extension.selectSquareBrackets",
            "a[": "extension.selectSquareBracketsOuter", 
            "i{": "extension.selectCurlyBrackets",
            "a{": "extensiondselectCurlyBracketsOuter",
            "i<": "extension.selectAngleBrackets",
            "a<": "extension.selectAngleBracketsOuter",
            ...(Object.fromEntries(["^",
                    "$", "0", "G", "H", "M", "L", "%", "g_", "gg"].
                map(k => [k, { "modalkeys.typeKeys": { keys: "v"+k } } ]))),
            ...aroundObjects(around_objects),
            // Word motions need to be repeated here: otherwise `__count`
            // will be dropped and the motions won't accept numeric arguments
            "w": { "cursorWordStartRightSelect": {}, "repeat": "__count" },
            "e": { "cursorWordEndRightSelect": {}, "repeat": "__count" },
            "b": { "cursorWordStartLeftSelect": {}, "repeat": "__count" },
            W: {
                "modalkeys.search": {
                    "text": "\\S+",
                    "offset": 'inclusive',
                    "regex": true,
                    "selectTillMatch": true,
                    "highlightMatches": false,
                },
                "repeat": '__count',
            },
            B: {
                "modalkeys.search": {
                    "text": "\\S+",
                    "offset": 'inclusive',
                    "regex": true,
                    "backwards": true,
                    "selectTillMatch": true,
                    "highlightMatches": false,
                },
                "repeat": '__count',
            },
            "[": "vscode-select-by-indent.select-inner",
            "{": "vscode-select-by-indent.select-outer",
        }
       }),

       ...searchOperators({
            operators: operator_commands,
            objects: search_objects,
       }),

       ...(Object.fromEntries(Object.entries(aroundObjects(around_objects)).
            map(([bind, command]) => {
           return ["visual::"+bind, command]
       }))),

       "visual::i(": "extension.selectParenthesis",
       "visual::a(": "extension.selectParenthesisOuter",
       "visual::i[": "extension.selectSquareBrackets",
       "visual::a[": "extension.selectSquareBracketsOuter",
       "visual::i{": "extension.selectCurlyBrackets",
       "visual::a{": "extension.selectCurlyBracketsOuter",
       "visual::i<": "extension.selectAngleBrackets",
       "visual::a<": "extension.selectAngleBracketsOuter",

       gd: "editor.action.revealDefinition",
       gq: "rewrap.rewrapComment",

// ## Searching

// Searching introduces a pseudo-mode that captures the keyboard and suspends other
// commands as long as search is on. Searching commands are shown below.

// | Keys      | Command
// | --------- | --------------------
// | `/`       | Start case-sensitive search forwards
// | `?`       | Start case-sensitive search backwards
// | `n`       | Select the next match
// | `p`       | Select the previous match

// **Note**: Searching commands work also with multiple cursors. As in Vim,
// search wraps around if top or bottom of file is encountered. Note that we use
// a separate register ("search") so that the state of the last search (for next
// and previous matches) are different from the `modalkeys.search` commands that
// are called to implement <key>f</key> and friends.
        "/": [
            {
                "modalkeys.search": {
                    "caseSensitive": true,
                    "wrapAround": true,
                    "register": "search"
                }
            }
        ],
        "?": {
            "modalkeys.search": {
                "backwards": true,
                "caseSensitive": true,
                "wrapAround": true,
                "register": "search"
            }
        },
        n: { "modalkeys.nextMatch": {register: "search"}},
        N: { "modalkeys.previousMatch": {register: "search"}},
        "*": [
            { "modalkeys.search": {
                text: "__wordstr",
                wrapAround: true,
                register: "search"
            }}
        ],
        "#": [
            { "modalkeys.search": {
                text: "__wordstr",
                wrapAround: true,
                backwards: true,
                register: "search"
            }}
        ],
// ## Miscellaneous Commands

// Rest of the normal mode commands are not motion or editing commands, but do
// miscellaenous things.

// | Keys      | Command
// | --------- | ---------------------------------
// | `:`       | Show command menu (same as <key>Ctrl/Cmd</key><key>Shift</key><key>P</key>)
// | `zz`      | Center cursor on screen
// | `ZZ`      | Save file and close the current editor (tab)
// | `ZQ`      | Close the current editor without saving

// Note that <key>Z</key><key>Q</key> command still asks to save the file, if
// it has been changed. There is no way to get around this in VS Code.
        ":": "workbench.action.showCommands",
        zz: { "revealLine": { lineNumber: '__line', at: 'center' } },
        ZZ: [
            "workbench.action.files.save",
            "workbench.action.closeActiveEditor"
        ],
        ZQ: "workbench.action.closeActiveEditor"
    },
}
// ## Conclusion

// The list of commands we provided is by no means exhaustive but still contains
// about a thousand key combinations that cover many commonly used Vim
// operations. This is quite a nice achievement considering that we only wrote
// about 400 lines of configuration, and most of it is pretty trivial. This
// demonstrates that ModalKeys's functionality is powerful enough to build all
// kinds of operations that make modal editors like Vim popular.
//
// For a full least of features available in ModalKeys, please refer to the
// [documentation](../doc_index.html)
