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
        let docmatch = opkey.match(/^::doc::(.*)/)
        if(docmatch){
            result["::doc::normal::"+docmatch[1]] = opcom;
            result["::doc::visual::"+docmatch[1]] = opcom;
        }else{
            result["::doc::normal::"+opkey+opkey] = { kind: "motion", label: 'line', detail: "repeating an operator performs the action on an entire line"}
            result["normal::"+opkey+opkey] =
                ["modalkeys.cancelMultipleSelections", "expandLineSelection", opcom]
                result["visual::"+opkey] = opcom
            
            for(const [objkey, objcom] of Object.entries(params.objects)){
                let docmatch = objkey.match(/^::doc::(.*)/)
                if(docmatch){
                    result["::doc::normal::"+opkey + docmatch[1]] = objcom
                }else{
                    result["normal::"+opkey + objkey] = 
                        ["modalkeys.cancelMultipleSelections", objcom, opcom]
                }
            }
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
            let docmatch = objkey.match(/^::doc::(.*)/)
            if(docmatch){
                result["::doc::normal::"+opkey + docmatch[1]] = objcom
            }else{
                result["normal::"+opkey+objkey] = [
                    "modalkeys.cancelMultipleSelections", 
                    executeAfter(objcom, opcom),
                ]
            }
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
    "::doc::d": { kind: "operator", label: "delete", detail: "delete text and store it in the clipboard (e.g. copy)" },
    d: "editor.action.clipboardCutAction",
    "::doc::y": { kind: "operator", label: "copy", detail: "copy the text to clipboard" },
    y: [ "editor.action.clipboardCopyAction", "modalkeys.cancelMultipleSelections" ],
    "::doc::c": { kind: "operator", label: "change", detail: "delete text and switch to insert mode" },
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
    "::doc::z.": { kind: "operator", label: "repl", detail: "send text to REPL; use language specific extension if available" },
    "z.": [
        {
            // TODO: add other languages here
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
    "::doc::z;": { kind: "operator", label: "repl", detail: "send text to REPL" },
    "z;": [
        {
            if: "!__selection.isSingleLine",
            then: "terminal-polyglot.send-block-text",
            else: "terminal-polyglot.send-text"
        },
        "modalkeys.cancelMultipleSelections",
        "modalkeys.touchDocument"
    ],
    "::doc::<": { kind: "operator", label: "dedent", detail: "deindent text by current file's indent size" },
    "<": ["editor.action.outdentLines", "modalkeys.cancelMultipleSelections" ],
    "::doc::>": { kind: "operator", label: "indent", detail: "indent text by current file's indent size" },
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
    "::doc::f": { kind: 'motion', label: 'find char →', detail: "move/operate up to and including given character" },
    f: {
        "modalkeys.search": {
            "acceptAfter": 1,
            "offset": "inclusive",
            "selectTillMatch": "__mode == 'visual'",
        }
    },
    "::doc::F": { kind: 'motion', label: 'find char ←', detail: "move/operate up to and including given character (moving backwards)" },
    F: {
        "modalkeys.search": {
            "acceptAfter": 1,
            "backwards": true,
            "offset": "inclusive",
            "selectTillMatch": "__mode == 'visual'",
        }
    },
    "::doc::t": { kind: 'motion', label: 'find char →', detail: "move/operate up to given character" },
    t: {
        "modalkeys.search": {
            "acceptAfter": 1,
            "offset": "exclusive",
            "selectTillMatch": "__mode == 'visual'",
        }
    },
    "::doc::T": { kind: 'motion', label: 'find char ←', detail: "move/operate up to given character (moving backwards)" },
    T: {
        "modalkeys.search": {
            "acceptAfter": 1,
            "backwards": true,
            "offset": "exclusive",
            "selectTillMatch": "__mode == 'visual'",
        }
    },
    "::doc::s": { kind: "motion", label: "find char pair", detail: "move/operate to next character pair"},
    s: { "modalkeys.search": {
        caseSensitive: true,
        acceptAfter: 2,
        backwards: false,
        offset: 'start',
        wrapAround: true
    }},
    "::doc::S": { kind: "motion", label: "char pair back", detail: "move/operate to previous character pair"},
    S: { "modalkeys.search": {
        casSensitive: true,
        acceptAfter: 2,
        backwards: true,
        offset: 'start',
        wrapAround: true
    }},
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

// Because we've listed these extensions below, ModalKeys will check for these
// extensions when you import this preset, and give you the option to install
// the extensions.

module.exports = {
    "extensions": [
        "dbankier.vscode-quick-select",
        "haberdashpi.vscode-select-by-indent",
        "haberdashpi.selection-utilities",
        "haberdashpi.terminal-polyglot"
    ],

// ## Command Kinds
// These document the categories of commands our bindings will defined. They
// Determine the color coding of keys in the visual documentation.
    "docKinds": [
        { name: 'motion',   description: "Select commands move the cursor and/or selections." },
        { name: 'operator', description: "Operators are actions that take motions as suffix arguments (e.g. to delete (`d`) a word (`w`) you would type `dw`). If you wish to perform the operator action over a single line, you hit the operator key twice. In visual mode, an operator performs it's action over the selected text." },
        { name: 'action',   description: "Actions do something (usually to the text of a document)."},
        { name: 'history',  description: "History commands modify or use the history of executed commands, in some way." },
        { name: 'mode',     description: "Mode commands change the key mode, possibly completely changing what all of the keys do." },
        { name: 'count',    description: "Counts serve as prefix arguments to other commands, and usually determine how many times to repeat the commnad, unless otherwise specified." },
        { name: 'window',   description: "Window commands manipulate the window in some way." },
        { name: 'leader',   description: "Leaders serve as prefixes to an entire list of key commands" }
    ],

// ## Motions in Normal Mode
// 
    "keybindings": {
// Cursor can be advanced in a file with enter and space. These are not
// technically motion commands but included for compatibility.
        "::doc::\n": { kind: 'motion', label: '↓', detail: 'move down' },
        "\n": [
            "cursorDown",
            { "cursorMove": { "to": "wrappedLineFirstNonWhitespaceCharacter" } }
        ],
        "::doc:: ": { kind: 'motion', label: '→', detail: 'move right' },
        " ": "cursorRight",
// Move cursor up/down/left/right.
    "::doc::h": { kind: "motion", label: "←", detail: "move left" },
    "::doc::j": { kind: "motion", label: '↓', detail: "cove down" },
    "::doc::k": { kind: "motion", label: '↑', detail: "move up" },
    "::doc::l": { kind: "motion", label: '→', detail: "move right" },
    "::doc::0": { kind: "motion", label: 'sol', detail: "move to start of line" },
    "::doc::$": { kind: "motion", label: 'eol', detail: "move to end of line" },
    "::doc::^": { kind: "motion", label: 'first nonwht', detail: "move to first non-whitespace character on line"},
    "::doc::g": { kind: "leader", label: 'extended', detail: "various extended commands" },
    "::doc::g_": { kind: "motion", label: 'first nonwht', detail: "move to first non-whitespace character on line"},
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
    "::doc::": { kind: 'motion', label: 'sel first nonwht', detail: 'select to first non-whitespace' },
    "_": "cursorHomeSelect",

// Moving to beginning or end of the file.
        "::doc::gg": { kind: "motion", label: 'doc start', detail: 'move to top of document'},
        gg: "cursorTop",
        "visual::gg": "cursorTopSelect",
        "::doc::G": { kind: "motion", label: 'doc end', detail: 'move to bottom of document'},
        G: "cursorBottom",
        "visual::G": "cursorBottomSelect",
// Switch to next and previous tab.
        "::doc::gt": { kind: "window", label: 'tab →', detail: 'show next editor tab'},
        gt: "workbench.action.nextEditor",
        "::doc::gT": { kind: "window", label: 'tab ←', detail: 'show previous editor tab'},
        gT: "workbench.action.previousEditor",
// The logic of separating words is bit different in VS Code and Vim, so we will
// not aim to immitate Vim exaclty. If that's something you want, you might
// consider looking at [Selection
// Utilities](https://github.com/haberdashPI/vscode-selection-utilities). 
// These keys are mapped to the most similar motion available. The <key>W</key> and
// <key>B</key> move past all non-space characters, and are implemented using the
// search command, with appropriate options. To handling of count arguments, we use
// the `repeat` option.
        "::doc::w": { kind: 'motion', label: 'word →', detail: 'move to next word start'},
        w: { "cursorWordStartRight": {}, "repeat": "__count" },
        "visual::w": { "cursorWordStartRightSelect": {}, "repeat": "__count" },
        "::doc::e": { kind: 'motion', label: 'word →', detail: 'move to next word end'},
        e: { "cursorWordEndRight": {}, "repeat": "__count" },
        "visual::e": { "cursorWordEndRightSelect": {}, "repeat": "__count" },
        "::doc::b": { kind: 'motion', label: 'word ←', detail: 'move to previous word start'},
        b: { "cursorWordStartLeft": {}, "repeat": "__count"    },
        "visual::b": { "cursorWordStartLeftSelect": {}, "repeat": "__count" },
        "::doc::W": { kind: 'motion', label: 'WORD →', detail: 'move to next WORD start; a WORD is a continguous group of non-whitespace characters'},
        W: {
            "modalkeys.search": {
                "text": "\\s+",
                "offset": 'exclusive',
                "regex": true,
                "selectTillMatch": '__mode == "visual"',
                "highlightMatches": false,
                "executeAfter": { cursorMove: { to: 'right', select: '__mode == "visual"' } }
            },
            "repeat": '__count',
        },
        "::doc::E": { kind: 'motion', label: 'WORD end →', detail: 'move to next WORD end; a WORD is a continguous group of non-whitespace characters'},
        E: {
            "modalkeys.search": {
                "text": "\\S+",
                "offset": 'inclusive',
                "regex": true,
                "selectTillMatch": '__mode == "visual"',
                "highlightMatches": false,
            },
            "repeat": '__count',
        },
        "::doc::B": { kind: 'motion', label: 'WORD →', detail: 'move to previous WORD start; a WORD is a continguous group of non-whitespace characters'},
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
        "::doc::}": { kind: 'motion', label: 'paragraph →', detail: 'move to next paragraph'},
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
        "::doc::{": { kind: 'motion', label: 'paragraph ←', detail: 'move to previous paragraph'},
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
        "::doc::H": { kind: 'motion', label: 'view top', detail: "move cursor so it is at the top of the viewport" },
        H: { "cursorMove": { to: 'viewPortTop', select: '__mode == "visual"' } },
        "::doc::M": { kind: 'motion', label: 'view center', detail: "move cursor so it is at the center of the viewport" },
        M: { "cursorMove": { to: 'viewPortCenter', select: '__mode == "visual"' } },
        "::doc::L": { kind: 'motion', label: 'view bottom', detail: "move cursor so it is at the bottom of the viewport" },
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
        "::doc::%": { kind: 'motion', label: 'to bracket', detail: 'move cursor to the match bracket' },
        "%": "editor.action.jumpToBracket",
        "::doc::visual::%": { kind: 'motion', label: 'expand', detail: 'expand selection intelligently, use VSCode smart expand' },
        "visual::%": "editor.action.smartSelect.expand",

// ## Search Operators
// Having defined the search operators above, we now insert them into the keymap
        ...search_objects,

// Repeating the motions can be done simply by calling `nextMatch` or
// `previousMatch`.
        "::doc::;": { kind: "motion", label: "repeat motion →", detail: "Repeating a searching motion (e.g. `f`)"},
        ";": "modalkeys.nextMatch",
        "::doc::,": { kind: "motion", label: "repeat motion ←", detail: "Repeating a searching motion (e.g. `f`) backwards"},
        ",": "modalkeys.previousMatch",
// ## Switching between Modes

// Next, we define keybindings that switch between normal, insert, and visual mode:
        "::doc::normal::i": { kind: "mode", label: "insert", detail: "switch to insert mode" },
        "normal::i": "modalkeys.enterInsert",
        "::doc::I": { kind: "mode", label: "insert sol", detail: "move to non-whitespace start of line and switch to insert mode" },
        I: [
            "cursorHome",
            "modalkeys.enterInsert"
        ],
// The `a` has to check if the cursor is at the end of line. If so, we don't move
// right because that would move to next line.
        "::doc::normal::a": { kind: "mode", label: "append", detail: "start insert mode after the current character" },
        "normal::a": [
            {
                "if": "__char == ''",
                "else": "cursorRight"
            },
            "modalkeys.enterInsert"
        ],
        "::doc::normal::A": { kind: "mode", label: "append eol", detail: "move to end of line and switch to insert mode" },
        A: [
            "cursorEnd",
            "modalkeys.enterInsert"
        ],
        "::doc::normal::o": { kind: "mode", label: "open below", detail: "create a line below this one and start insert mode" },
        o: [
            "editor.action.insertLineAfter",
            "modalkeys.enterInsert"
        ],
        "::doc::normal::O": { kind: "mode", label: "open above", detail: "create a line above this one and start insert mode" },
        O: [
            "editor.action.insertLineBefore",
            "modalkeys.enterInsert"
        ],
// Note that visual mode works a little differently than in vim. We don't
// seek to mimc visual mode particularly. Basically, we just toggle a switch that allows the
// motion commands to extend and create selections.
        "::doc::normal::v": { kind: "mode", label: "visual", detail: "start visual-selection mode" },
        "::doc::visual::v": { kind: 'mode', label: 'clear selection', detail: "clear selection and return to normal mode" }, 
        v: "modalkeys.toggleSelection",
// ## Editing in Normal Mode

// Editing commands in normal mode typically either affect current character or
// line, or expect a motion key sequence at the end which specifies the scope of
//  the edit. Let's first define simple commands that do not require a motion
//  suffix:

// <key>x</key> and <key>X</key> commands do exactly what <key>Delete</key> and
// <key>Backspace</key> keys do.
        "::doc::x": { kind: "action", label: "del char →", detail: "delete character to right" },
        x: { "deleteRight": {}, repeat: '__count' },
        "::doc::X": { kind: "action", label: "del char ←", detail: "delete character to left" },
        X: { "deleteLeft": {}, repeat: '__count' },
        "::doc::r": { kind: "action", label: "replace", detail: "replace a single character" },
        r: "modalkeys.replaceChar",
// Deleting in Vim always copies the deleted text into clipboard, so we do that
// as well. If you are wondering why we don't use VS Code's cut command, it has a
// synchronization issue that sometimes causes the execution to advance to the
// next command in the sequence before cutting is done. This leads to strange
// random behavior that usually causes the whole line to disappear instead of the
// rest of line.
        "::doc::D": { kind: "action", label: "delete eol", detail: "Delete from cursor to end of line" },
        D: [
            "modalkeys.cancelSelection",
            "cursorEndSelect",
            "editor.action.clipboardCopyAction",
            "deleteRight",
            "modalkeys.cancelSelection"
        ],
// We utilize existing mappings to implement the <key>C</key> command. It
// does same thing as keys <key>D</key><key>i</key> together.
        "::doc::C": { kind: "action", label: "change eol", detail: "Change from cursor to end of line" },
        C: { "modalkeys.typeKeys": { "keys": "Di" } },
// Yanking or copying is always done on a selected range. So, below, we make sure
// that only the rest of line is selected before copying the range to clipboard.
// Afterwards we clear the selection again.
        "::doc::Y": { kind: "action", label: "copy eol", detail: "Copy from cursor to end of line" },
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
        "::doc::p": { kind: "action", label: "paste →", detail: "paste after cursor" },
        p: [
            "cursorRight",
            "editor.action.clipboardPasteAction",
            "modalkeys.cancelSelection"
        ],
        "::doc::P": { kind: "action", label: "paste ←", detail: "paste before cursor" },
        P: [
            "editor.action.clipboardPasteAction",
            "modalkeys.cancelSelection"
        ],
// <key>J</key> joins current and next lines together adding a space in between.
        "::doc::J": { kind: "action", label: "join lines", detail: "remove newline char between this and next line" },
        J: "editor.action.joinLines",
// Undoing last change is also a matter of calling built-in commands. We clear the
// selection afterwards.
        "::doc::u": { kind: "action", label: "undo", detail: "Undo last action" },
        u: [
            "undo",
            "modalkeys.cancelSelection"
        ],
        "::doc::U": { kind: "action", label: "redo", detail: "Redo last action" },
        U: [
            "redo",
            "modalkeys.cancelSelection"
        ],
// The last "simple" keybinding we define is <key>`</key> that repeats the last
// command that changed the text somehow. This command is provided by ModalKeys. It
// checks after each key sequence is typed whether it caused a change in file.
// If so, it stores the seqeuence as a change. The command just runs the stored
// keysequence again.

        "::doc::.": { kind: "action", label: "repeat", detail: "repeat the last action or operator" },
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
            "::doc::j": { kind: 'motion', label: '↓', detail: 'operate over this line and `count` number of lines down' },
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
            "::doc::k": { kind: 'motion', label: '↑', detail: 'operate over this line and `count` number of lines up' },
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
            "::doc::h": { kind: 'motion', label: '←', detail: 'operate over this line and `count` number of characters to the left' },
            h: [
                {
                    "cursorMove": {
                        to: 'left',
                        select: true,
                        value: '__count'
                    }
                },
            ],
            "::doc::l": { kind: 'motion', label: '→', detail: 'operate over this line and `count` number of characters to the right' },
            l: {
                "cursorMove": {
                    to: 'right',
                    select: true,
                    value: '__count'
                }
            },
            "::doc::i": { kind: 'leader', label: 'inside pair', detail: 'motions within an area, exclusive of the area\'s boundaries'},
            "::doc::i(": { kind: 'motion', label: "parens", detail: 'operate inside parentheses' },
            "i(": "extension.selectParenthesis",
            "::doc::a": { kind: 'leader', label: 'around pair', detail: 'motions within an area, inclusive of the area\'s boundaries'},
            "::doc::a(": { kind: 'motion', label: "parens", detail: 'operate around parentheses' },
            "a(": "extension.selectParenthesisOuter",
            "::doc::i[": { kind: 'motion', label: "braces", detail: 'operate inside braces' },
            "i[": "extension.selectSquareBrackets",
            "::doc::a[": { kind: 'motion', label: "braces", detail: 'operate around braces' },
            "a[": "extension.selectSquareBracketsOuter", 
            "::doc::i{": { kind: 'motion', label: "brackets", detail: 'operate inside brackets' },
            "i{": "extension.selectCurlyBrackets",
            "::doc::a{": { kind: 'motion', label: "brackets", detail: 'operate around brackets' },
            "a{": "extension.selectCurlyBracketsOuter",
            "::doc::i<": { kind: 'motion', label: "caret", detail: 'operate inside caret' },
            "i<": "extension.selectAngleBrackets",
            "::doc::a<": { kind: 'motion', label: "caret", detail: 'operate around caret' },
            "a<": "extension.selectAngleBracketsOuter",
            "::doc::0": { kind: "motion", label: 'sol', detail: "operate up to start of line" },
            "::doc::$": { kind: "motion", label: 'eol', detail: "operate up to end of line" },
            "::doc::^": { kind: "motion", label: 'first nonwht', detail: "operate up to first non-whitespace character on line"},
            "::doc::g_": { kind: "motion", label: 'first nonwht', detail: "operate up to first non-whitespace character on line"},
            "::doc::gg": { kind: "motion", label: 'eof', detail: "operate back to start of document"},
            "::doc::G": { kind: "motion", label: 'eof', detail: "operate up to end of document"},
            "::doc::H": { kind: 'motion', label: 'view top', detail: "operate to the top of the viewport" },
            "::doc::M": { kind: 'motion', label: 'view center', detail: "operate to the center of the viewport" },
            "::doc::L": { kind: 'motion', label: 'view bottom', detail: "operate to the bottom of the viewport" },
            "::doc::%": { kind: 'motion', label: 'smart region', detail: "operate over the smallest 'smart' region, e.g. when using smart selection expansion."},
            ...(Object.fromEntries(["^", "$", "0", "G", "H", "M", "L", "%", "g_", "gg"].
                map(k => [k, { "modalkeys.typeKeys": { keys: "v"+k } } ]))),
            // TODO: add docs
            ...aroundObjects(around_objects),
            // Word motions need to be repeated here: otherwise `__count`
            // will be dropped and the motions won't accept numeric arguments
            "::doc::w": { kind: "motion", label: "word →", detail: "operate to next word start"},
            "w": { "cursorWordStartRightSelect": {}, "repeat": "__count" },
            "::doc::e": { kind: "motion", label: "word end →", detail: "operate to next word end"},
            "e": { "cursorWordEndRightSelect": {}, "repeat": "__count" },
            "::doc::b": { kind: "motion", label: "word ←", detail: "operate to previous word start"},
            "b": { "cursorWordStartLeftSelect": {}, "repeat": "__count" },
            "::doc::W": { kind: "motion", label: "WORD →", detail: "operate to next WORD start; WORD's are contiguous non-whitespace characters"},
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
            "::doc::B": { kind: "motion", label: "WORD →", detail: "operate to previous WORD start; WORD's are contiguous non-whitespace characters" },
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
            "::doc::[": { kind: 'motion', label: 'indent (exclusive)', detail: "operate within indented region (all the same indent or more indendented than current line)" },
            "::doc::{": { kind: 'motion', label: 'indent (inclusive)', detail: "operate around indented region (all the same indent or more indendented than current line, plus the line just above and below this)" },
            "[": "vscode-select-by-indent.select-inner",
            "{": "vscode-select-by-indent.select-outer",
        }
       }),

       ...searchOperators({
            operators: operator_commands,
            objects: search_objects,
       }),

       // TODO: add docs
       ...(Object.fromEntries(Object.entries(aroundObjects(around_objects)).
            map(([bind, command]) => {
           return ["visual::"+bind, command]
       }))),

       "::doc::i(": { kind: "motion", label: "parens (exclusive)", detail: "select text surrounded by parentheses (don't include parens)"},
       "visual::i(": "extension.selectParenthesis",
       "::doc::a(": { kind: "motion", label: "parens (inclusive)", detail: "select text surrounded by parentheses (include parens)"},
       "visual::a(": "extension.selectParenthesisOuter",
        "::doc::i[": { kind: "motion", label: "braces (exclusive)", detail: "select text surrounded by braces (don't include braces)"},
       "visual::i[": "extension.selectSquareBrackets",
        "::doc::a[": { kind: "motion", label: "braces (inclusive)", detail: "select text surrounded by braces (include braces)"},
       "visual::a[": "extension.selectSquareBracketsOuter",
        "::doc::i{": { kind: "motion", label: "brackets (exclusive)", detail: "select text surrounded by brackets (don't include brackets)"},
       "visual::i{": "extension.selectCurlyBrackets",
        "::doc::a{": { kind: "motion", label: "brackets (inclusive)", detail: "select text surrounded by brackets (include brackets)"},
       "visual::a{": "extension.selectCurlyBracketsOuter",
        "::doc::i<": { kind: "motion", label: "carets (exclusive)", detail: "select text surrounded by carets (don't include brackets)"},
       "visual::i<": "extension.selectAngleBrackets",
        "::doc::a<": { kind: "motion", label: "carets (inclusive)", detail: "select text surrounded by carets (include brackets)"},
       "visual::a<": "extension.selectAngleBracketsOuter",

       "::doc::gd": { kind: "action", label: "go to definition", detail: "jump to the definition under the symbol under the cursor"},
       gd: "editor.action.revealDefinition",
       "::doc::gq": { kind: "action", label: "wrap text", detail: "wrap text, keeping comment characters preserved (at startof line)"},
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
       "::doc::/": { kind: "motion", label: "search →", detail: "search forwards for text; all following characters that you type are included in the search. You must hit enter to complete entry." },
        "/": [
            {
                "modalkeys.search": {
                    "caseSensitive": true,
                    "wrapAround": true,
                    "register": "search",
                    "selectTillMatch": "mode == 'visual'"
                }
            }
        ],
        "::doc::?": { kind: "motion", label: "search ←", detail: "search backwards for text; all following characters that you type are included in the search. You must hit enter to complete entry." },
        "?": {
            "modalkeys.search": {
                "backwards": true,
                "caseSensitive": true,
                "wrapAround": true,
                "register": "search",
                "selectTillMatch": "mode == 'visual'"
            }
        },
        "::doc::n": { kind: "motion", label: "search →", detail: "go to the next search match" },
        n: { "modalkeys.nextMatch": {register: "search", selectTillMatch: "mode == 'visual'"}},
        "::doc::N": { kind: "motion", label: "search ←", detail: "go to the previous search match" },
        N: { "modalkeys.previousMatch": {register: "search", selectTillMatch: "mode == 'visual'" } },
        "::doc::*": { kind: "motion", label: "match →", detail: "go to next match of object under cursor (or current selection)"},
        "normal::*": [
            { "modalkeys.search": {
                text: "__wordstr",
                wrapAround: true,
                register: "search"
            }}
        ],
        "visual::*": [
            { "modalkeys.search": {
                text: "__selectstr",
                wrapAround: true,
                register: "search"
            }}
        ],
        "::doc::#": { kind: "motion", label: "match ←", detail: "go to previous match of object under cursor (or current selection)"},
        "normal::#": [
            { "modalkeys.search": {
                text: "__wordstr",
                wrapAround: true,
                backwards: true,
                register: "search"
            }}
        ],
        "visual::#": [
            { "modalkeys.search": {
                text: "__selectstr",
                wrapAround: true,
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
        "::doc:::": { kind: "action", label: "command", detail: "open VSCode command palette" },
        ":": "workbench.action.showCommands",
        "::doc::z": { kind: "mode", label: "window", detail: "some window related commands" },
        "::doc::Z": { kind: "mode", label: "window", detail: "some window related commands" },
        "::doc::zz": { kind: "action", label: "center window", detail: "center view on cursor" },
        zz: { "revealLine": { lineNumber: '__line', at: 'center' } },
        "::doc::zz": { kind: "action", label: "center window", detail: "center view on cursor" },
        zt: { "revealLine": { lineNumber: '__line', at: 'top' } },
        "::doc::zz": { kind: "action", label: "center window", detail: "center view on cursor" },
        zb: { "revealLine": { lineNumber: '__line', at: 'bottom' } },
        "::doc::zz": { kind: "action", label: "save and close", detail: "save and close active editor" },
        ZZ: [
            "workbench.action.files.save",
            "workbench.action.closeActiveEditor"
        ],
        "::doc::ZQ": { kind: "action", label: "close", detail: "close active editor" },
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
