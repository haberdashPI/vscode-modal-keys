// # Larkin Keybindings
//
// This set of keybindings provides a comprehensive and well tested set of
// bindings that I use in my daily work. It serves as an example of a fully
// customized set of keybindings, and demonstrates the full capabilities of
// ModalKeys.

// The basic logic of these commands follow that of Kakoune: motions generally
// cause some region of text to be selected, and then actions modify these
// selections. This is the inverse of vim's motions (`wd` instead of `dw`). This
// integrates well with many of the existing VSCode extesions which operate on
// selections. 

// These bindings are named after the middle name of my first child.

// ## Counts to select lines

// One common shortcut I use is that you can specify a range of lines for an
// action using just a number. E.g. 3d deletes three lines of text.

/**
 * Extend a command to support a count argument. The command is assumed to change or alter
 * selected text so that when you specify a count for that command it can be used to select
 * nearby lines. This allows noun-less verbs. e.g. 4d deletes the current line and the 4
 * lines below the current line.
 *
 * @param {string} to (optional) direction to select lines in (up / ddown), defaults to 'down',
 * @param {command} countnone The command to run when __count is not specified
 * @param {command} countN (topional) The command to run after selecting downwards or upwards
 * `__count` lines.
 * @returns combined command to handle all `__count` values and properly select the right
 * number of lines.
 */
 function countSelectsLines(to, countnone, countN){
    if(!countnone){
        countnone = to
        to = 'down'
    }
    return {
        if: "!__count",
        then: countnone,
        else: [
            "modalkeys.cancelMultipleSelections",
            "modalkeys.enableSelection",
            { "cursorMove": { to: to, by: 'wrappedLine', select: true, value: '__count' } },
            "expandLineSelection",
            countN || countnone
        ]
    }
}

// I use quite a few extensions in my everday use, and all of them have commands
// set up in my keybindings:

module.exports = {
extensions: [
    "dbankier.vscode-quick-select",
    "haberdashPI.vscode-select-by-indent",
    "haberdashPI.selection-utilities",
    "haberdashPI.move-cursor-by-argument",
    "pustelto.bracketeer",
    "wmaurer.change-case",
    "pranshuagrawal.toggle-case",
    "albymor.increment-selection",
    "pkief.markdown-checkbox",
    "edgardmessias.clipboard-manager",
    "stkb.rewrap",
    "haberdashPI.terminal-polyglot",
    "jack89ita.open-file-from-path",
    "koalamer.labeled-bookmarks",
],

// ## The Actual Keybindings

docKinds: [
    { name: 'select',   description: "Select commands move the cursor and/or selections." },
    { name: 'modifier', description: "Modifier commands manipulate selections in various ways" },
    { name: 'window',   description: "Window commands change window layout/focus" },
    { name: 'action',   description: "Actions do something with the selected text (e.g. delete it). Unless otherwise noted, in the absence of a selection, an action will modify an entire line, and a count argument indicates the number of lines (e.g. 3d deletes this line and the next 3 lines)." },
    { name: 'history',  description: "History commands modify or use the history of executed commands, in some way." },
    { name: 'mode',     description: "Mode commands change the key mode, possibly completely changing what all of the keys do." },
    { name: 'count',    description: "Counts serve as prefix arguments to other commands, and usually determine how many times to repeat the commnad, unless otherwise specified." },
    { name: 'leader',   description: "Leaders serve as prefixes to an entire list of key commands" }
],

keybindings: {
    // ### Motions

    // basic movement
    "::doc::h": { kind: "select", label: "←", detail: "move left" },
    "::doc::j": { kind: "select", label: '↓', detail: "move down" },
    "::doc::k": { kind: "select", label: '↑', detail: "move up" },
    "::doc::l": { kind: "select", label: '→', detail: "move right" },
    "::doc::g": { kind: "leader", label: "actions (mostly)", detail: "additional commands (mostly actions)" },
    "::doc::gj": { kind: "select", label: 'unwrp ↓', detail: "Down unwrapped line" },
    "::doc::gk": { kind: "select", label: 'unwrp ↑', detail: "Up unwrapped line"},
    "::using::cursorMove::": {
        h: { to: 'left', select: "__mode !== 'normal'", value: '__count' },
        j: { to: 'down', by: 'wrappedLine', select: "__mode !== 'normal'", value: '__count' },
        k: { to: 'up', by: 'wrappedLine', select: "__mode !== 'normal'" , value: '__count' },
        l: { to: 'right', select: "__mode !== 'normal'", value: '__count' },
        gj: { to: 'down', by: 'line', select: "__mode !== 'normal'", value: '__count' },
        gk: { to: 'up', by: 'line', select: "__mode !== 'normal'", value: '__count' },
    },

    // line related movements
    "::doc::H": { kind: "select", label: "start", detail: "start of line (alterantes between first non-whitepace, and first)" },
    H: "cursorHomeSelect",
    "::doc::L": { kind: "select", label: "end", detail: "end of line" },
    L: { "cursorMove": { to: "wrappedLineEnd", select: true } },
    "::doc::G": { kind: "select", label: "expand", detail: "expand selections to full lines" },
    G:  "expandLineSelection",
    "::doc::K": { kind: "select", label: "sel ↑", detail: "select lines upwards" },    
    K: [
        "modalkeys.cancelMultipleSelections",
        { "cursorMove": { to: 'up', by: 'wrappedLine', select: true, value: '__count' } },
        "expandLineSelection",
        "selection-utilities.activeAtStart"
    ],
    "::doc::J": { kind: "select", label: "sel ↓", detail: "select lines downwards" },    
    J: [
        "modalkeys.cancelMultipleSelections",
        { "cursorMove": { to: 'down', by: 'wrappedLine', select: true, value: '__count' } },
        "expandLineSelection",
    ],
    "::doc::gK": { kind: "select", label: 'unwrp sel ↑', detail: "select unwrapped lines upwards" },
    gK: [
        "modalkeys.cancelMultipleSelections",
        { "cursorMove": { to: 'up', by: 'line', select: true, value: '__count' } },
        "expandLineSelection",
        "selection-utilities.activeAtStart"
    ],
    "::doc::gJ": { kind: "select", label: 'unwrp sel ↓', detail: "select unwrapped lines downwards" },
    gJ: [
        "modalkeys.cancelMultipleSelections",
        { "cursorMove": { to: 'down', by: 'line', select: true, value: '__count' } },
        "expandLineSelection",
    ],


    "::doc::\\": { kind: "select", label: 'right character', detail: "select *just* the character to the right" },
    "\\": [
        "modalkeys.cancelMultipleSelections",
        { "cursorMove": { to: 'right', select: true, value: '__count' } }
    ],
    "::doc::|": { kind: "select", label: 'left character', detail: "select *just* the character to the left" },
    "|": [
        "modalkeys.cancelMultipleSelections",
        { "cursorMove": { to: 'left', select: true, value: '__count' } }
    ],

    // movements around regex units
    "::doc::'": { kind: "leader", label: "select (mostly)", detail: "additional commands (mostly selection/view related)"},
    "::doc::u": { kind: "leader", label: "around", detail: "selection commands that move start and end of a selection to surround the entire object (rather than extending to specified start/end point)" },
    "::doc::u'": { kind: "leader", label: "select", detail: "additional selections"},
    "::doc::w": { kind: "select", label: "subwrd →", detail: "next subword (camel/snake case)" },
    "::doc::W": { kind: "select", label: "word →", detail: "next word"},
    "::doc::e": { kind: "select", label: "word end →", detail: "next word end" },
    "::doc::b": { kind: "select", label: "subwrd ←", detail: "previous subword (came/snake case)" },
    "::doc::B": { kind: "select", label: "word ←", detail: "previous word" },
    "::doc::E": { kind: "select", label: "word end ←", detail: "previous word end" },
    "::doc::uw": { kind: "select", label: "subwrd →", detail: "select entire subword with and trailing whitespace (camel/snake case)" },
    "::doc::uW": { kind: "select", label: "word →", detail: "select entire word and trailing whitespace"},
    "::doc::ue": { kind: "select", label: "in word →", detail: "select entire word (no whitespace)" },
    "::doc::ub": { kind: "select", label: "subwrd ←", detail: "select previous subword and trailing whitespace (came/snake case)" },
    "::doc::uB": { kind: "select", label: "word ←", detail: "select previous word and trailing whitespace" },
    "::doc::uE": { kind: "select", label: "in word ←", detail: "select previous word (no whitespace)" },    
    "::doc::@": { kind: "select", label: "number ←", detail: "next number" },
    "::doc::#": { kind: "select", label: "number →", detail: "previous number" },
    "::doc::';": { kind: "select", label: "comment →", detail: "next commented region" },
    "::doc::':": { kind: "select", label: "comment ←", detail: "previous commented region" },
    "::doc::,;": { kind: "select", label: "blk commt →", detail: "next block commented region" },
    "::doc::,:": { kind: "select", label: "blk commt ←", detail: "previous block commented region" },
    "::doc::p": { kind: "select", label: "pargrph →", detail: "next pagaraph" },
    "::doc::P": { kind: "select", label: "pargrph ←", detail: "previous paragraph" },
    "::doc::')": { kind: "select", label: "sec →", detail: "next section" },
    "::doc::'(": { kind: "select", label: "sec ←", detail: "previous section" },
    "::doc::)": { kind: "select", label: "subsec →", detail: "next subsection" },
    "::doc::(": { kind: "select", label: "subsec ←", detail: "previous subsection" },
    "::doc::up": { kind: "select", label: "pargrph →", detail: "next pagaraph" },
    "::doc::uP": { kind: "select", label: "pargrph ←", detail: "previous paragraph" },
    "::doc::u')": { kind: "select", label: "sec →", detail: "next section" },
    "::doc::u'(": { kind: "select", label: "sec ←", detail: "previous section" },
    "::doc::u)": { kind: "select", label: "subsec →", detail: "next subsection" },
    "::doc::u(": { kind: "select", label: "subsec ←", detail: "previous subsection" },
    "::doc::'w": { kind: "select", label: "WORD →", detail: "next WORD; e.g. contiguous non-whitespace region"},
    "::doc::'b": { kind: "select", label: "WORD ←", detail: "previous WORD; e.g. contiguous non-whitespace region"},
    "::doc::'e": { kind: "select", label: "WORD end →", detail: "to end of WORD; e.g. contiguous non-whitespace region"},
    "::doc::u'w": { kind: "select", label: "WORD →", detail: "select entire WORD and trailing whitespace; a WORD is a contiguous non-whitespace region" },
    "::doc::u'e": { kind: "select", label: "WORD →", detail: "select entire WORD; a WORD is a contiguous non-whitespace region" },

    "::using::selection-utilities.moveBy": {
        // word-like
        w:     { unit: "subword", boundary: "start", select:      true, value: ' (__count || 1)' },
        uw:    { unit: "subword", boundary: "start", selectWhole: true, value: ' (__count || 1)' },
        ue:    { unit: "subword", boundary: "both",  selectWhole: true, value: ' (__count || 1)' },
        W:     { unit: "word",    boundary: "start", select:      true, value: ' (__count || 1)' },
        uW:    { unit: "word",    boundary: "start", selectWhole: true, value: ' (__count || 1)' },
        uE:    { unit: "word",    boundary: "both",  selectWhole: true, value: ' (__count || 1)' },
        e:     { unit: "word",    boundary: "end",   select:      true, value: ' (__count || 1)' },
        b:     { unit: "subword", boundary: "start", select:      true, value: '-(__count || 1)' },
        ub:    { unit: "subword", boundary: "start", selectWhole: true, value: '-(__count || 1)' },
        B:     { unit: "word",    boundary: "start", select:      true, value: '-(__count || 1)' },
        uB:    { unit: "word",    boundary: "start", selectWhole: true, value: '-(__count || 1)' },
        E:     { unit: "word",    boundary: "end",   select:      true, value: '-(__count || 1)' },
        "'w":  { unit: "WORD",    boundary: "start", select:      true, value: " (__count || 1)" },
        "'b":  { unit: "WORD",    boundary: "start", select:      true, value: "-(__count || 1)" },
        "'e":  { unit: "WORD",    boundary: "end",   select:      true, value: "-(__count || 1)" },
        "u'w": { unit: "WORD",    boundary: "start", selectWhole: true, value: " (__count || 1)" },
        "u'e": { unit: "WORD",    boundary: "both",  selectWhole: true, value: " (__count || 1)" },
        "u'b": { unit: "WORD",    boundary: "start", selectWhole: true, value: "-(__count || 1)" },

        // numbers
        "@": { value: '-(__count || 1)', unit: "integer", boundary: "both", selectWhole: true } ,
        "#": { value: '(__count || 1)', unit: "integer", boundary: "both", selectWhole: true } ,

        // comments
        "';": { unit: "comment", boundary: "both", selectWhole: true, value: '(__count || 1)'},
        "':": { unit: "comment", boundary: "both", selectWhole: true, value: '-(__count || 1)'},
        ",;": { unit: "block_comment", boundary: "both", selectWhole: true, value: '(__count || 1)'},
        ",:": { unit: "block_comment", boundary: "both", selectWhole: true, value: '-(__count || 1)'},

        // paragraphs and sections
        p:     { unit: "paragraph",  boundary: "start", select:    true, value: '(__count || 1)'  },
        P:     { unit: "paragraph",  boundary: "start", select:    true, value: '-(__count || 1)' },
        up:  { unit: "paragraph",  boundary: "start",  selectWhole: true, value: '(__count || 1)'  },
        uP:  { unit: "paragraph",  boundary: "start",  selectWhole: true, value: '-(__count || 1)' },
        "')":  { unit: "section",    boundary: "start", select:      true, value: '(__count || 1)'  },
        "'(":  { unit: "section",    boundary: "start", select:      true, value: '-(__count || 1)' },
        ")":  { unit: "subsection", boundary: "start", select:      true, value: '(__count || 1)'  },
        "(":  { unit: "subsection", boundary: "start", select:      true, value: '-(__count || 1)' },
        "u')": { unit: "section",    boundary: "start", selectWhole: true, value: '(__count || 1)'  },
        "u'(": { unit: "section",    boundary: "start", selectWhole: true, value: '-(__count || 1)' },
        "u)": { unit: "subsection", boundary: "start", selectWhole: true, value: '(__count || 1)'  },
        "u(": { unit: "subsection", boundary: "start", selectWhole: true, value: '-(__count || 1)' },
    },

    // jupyter based cell selection
    "::doc::'y": { kind: "select", label: "jupyter", detail: "jupyter related selection commands"},
    "::doc::'yc": { kind: "select", label: "cell →", detail: "next jupyter notebook cell"},
    "'yc": ["jupyter.gotoNextCellInFile", "jupyter.selectCell"],
    "::doc::'yC": { kind: "select", label: "cell ←", detail: "previous jupyter notebook cell"},
    "'yC": ["jupyter.gotoPrevCellInFile", "jupyter.selectCell"],
    "::doc::uy": { kind: "select", label: "cell", detail: "select a jyputer notebook cell"},
    uy: "jupyter.selectCell",

    // function arguments
    "::doc::,": { kind: "leader", label: "window (mostly)", detail: "additional commands, mostly related to changes to the editor/view/window" },
    "::using::move-cursor-by-argument.move-by-argument": {
        "::doc::,w": { kind: "select", label: "arg →", detail: "Next function argument"},
        ",w":  { value: "(__count || 1)",  boundary: "end", select:      true },
        "::doc::,b": { kind: "select", label: "arg ←", detail: "Previous function argument"},
        ",b":  { value: "-(__count || 1)", boundary: "start", select:      true },
        "::doc::,W": { kind: "select", label: "arg(+,) →", detail: "Next function argument (and comma)"},
        ",W":  { value: "(__count || 1)",  boundary: "start", select:      true },
        "::doc::,B": { kind: "select", label: "arg(+,) ←", detail: "Previous function argument (and comma)"},
        ",B":  { value: "-(__count || 1)", boundary: "end",   select:      true },
        "::doc::u.": { kind: 'select', label: "arg →", detail: "Around next argument"},
        "u.": { value: "(__count || 1)",  boundary: "both", selectWhole: true },
        "::doc::u,": { kind: 'select', label: "arg ←", detail: "Around previous argument"},
        "u,": { value: "-(__count || 1)", boundary: "both", selectWhole: true },
        "::doc::u>": { kind: 'select', label: "arg →", detail: "Around next argument (with comma)"},
        "u>": { value: "(__count || 1)",  boundary: "start", selectWhole: true },
        "::doc::u<": { kind: 'select', label: "arg ←", detail: "Around previous argument (with comma)"},
        "u<": { value: "-(__count || 1)", boundary: "end",   selectWhole: true },
    },

    // generic, magic selection
    "::doc::uu": { kind: 'select', label: "smart expand", detail: "Use VSCode's built-in smart expansion command"},
    "uu": "editor.action.smartSelect.expand",

    // buffer related
    "::doc::$": { kind: "select", label: "all", detail: "Select the entire document" },
    $: [ "editor.action.selectAll" ],
    "::doc::gG": { kind: 'select', label: 'doc end'},
    "gG": "cursorBottomSelect",
    "::doc::gg": { kind: 'select', label: 'doc start'},
    "gg": "cursorTopSelect",

    // search related
    "::doc::*": { kind: "select", label: "match →", detail: "Next match to object under cursor"},
    "*": [
        { "modalkeys.search": {
            text: "__wordstr",
            wrapAround: true,
            register: "search"
        }}
    ],
    "::doc::&": { kind: "select", label: "match ←", detail: "Previous match to object under cursor"},
    "&": [
        { "modalkeys.search": {
            text: "__wordstr",
            wrapAround: true,
            backwards: true,
            register: "search"
        }}
    ],

    "::doc::n": { kind: "select", label: "search →", detail: "Next match to search term"},
    "n": { "modalkeys.nextMatch": {register: "search"}, repeat: "__count" },
    "::doc::N": { kind: "select", label: "search →", detail: "Previous match to search term"},
    "N": { "modalkeys.previousMatch": {register: "search"}, repeat: "__count" },

    "::doc::/": { kind: "select", label: "search", detail: "Search forwards" },
    "/": { "modalkeys.search": {
        register: "search",
        caseSensitive: true,
        backwards: false,
        selectTillMatch: true,
        wrapAround: true
    } },
    "::doc::?": { kind: "select", label: "search back", detail: "Search backward" },
    "?": { "modalkeys.search": {
        register: "search",
        caseSensitive: true,
        backwards: true,
        selectTillMatch: true,
        wrapAround: true
    } },

    "::doc::f": { kind: "select", label: "find char", detail: "To next char (include char in selection)"},
    f: { "modalkeys.search": {
        caseSensitive: true,
        acceptAfter: 1,
        backwards: false,
        selectTillMatch: true,
        wrapAround: true
    }},
    "::doc::F": { kind: "select", label: "find char back", detail: "To previous character (include char in selection)"},
    F: { "modalkeys.search": {
        caseSensitive: true,
        acceptAfter: 1,
        backwards: true,
        selectTillMatch: true,
        wrapAround: true
    }},
    "::doc::t": { kind: "select", label: "find char", detail: "To next character (exclude char in selection)"},
    t: { "modalkeys.search": {
        caseSensitive: true,
        acceptAfter: 1,
        backwards: false,
        selectTillMatch: true,
        offset: 'start',
        wrapAround: true
    }},
    "::doc::T": { kind: "select", label: "find char back", detail: "To previous character (exclude char in selection)"},
    T: { "modalkeys.search": {
        caseSensitive: true,
        acceptAfter: 1,
        backwards: true,
        selectTillMatch: true,
        offset: 'end',
        wrapAround: true
    }},
    "::doc::s": { kind: "select", label: "find char pair", detail: "To next character pair"},
    s: { "modalkeys.search": {
        caseSensitive: true,
        acceptAfter: 2,
        backwards: false,
        selectTillMatch: true,
        offset: 'start',
        wrapAround: true
    }},
    "::doc::S": { kind: "select", label: "char pair back", detail: "To previous character pair"},
    S: { "modalkeys.search": {
        casSensitive: true,
        acceptAfter: 2,
        backwards: true,
        selectTillMatch: true,
        offset: 'start',
        wrapAround: true
    }},
    "::doc::;": {kind: "select", label: "→ match", detail: "Repeat search motion forwards (for `f`, `t`, etc...)"},
    ";": { "modalkeys.nextMatch": {}, repeat: "__count" },
    "::doc:::": {kind: "select", label: "← match", detail: "Repeat search motion backwards (for `f`, `t`, etc...)"},
    ":": { "modalkeys.previousMatch": {}, repeat: "__count" },

    // ### more complex syntactic selections

    "::doc::%": { kind: 'select', label: 'to bracket', detail: "Move to matching bracket"},
    '%': "editor.action.jumpToBracket",
    "::doc::''": {kind: 'select', label: 'in quotes', detail: "text within current quotes"},
    "''": "bracketeer.selectQuotesContent",
    "::doc::'\"": {kind: 'select', label: 'around quotes', detail: "quotes and text within current quotes"},
    "'\"": ["bracketeer.selectQuotesContent", "bracketeer.selectQuotesContent"],
    // the below is a bit hacky; I want to add these commandsto my extension
    "::doc::[": {kind: 'select', label: 'in parens', detail: 'text inside parents/brackets/braces'},
    "[": [
        {
            if: "!__selection.isEmpty",
            then: [
                "selection-utilities.activeAtStart",
                { "cursorMove": { "to": "left", "select": true, "value": 2 } },
                "selection-utilities.activeAtEnd",
                { "cursorMove": { "to": "right", "select": true, "value": 2 } }
            ],
        },
        { "editor.action.selectToBracket": {"selectBrackets": false} }
    ],
    "::doc::{": {kind: 'select', label: 'arnd parens', detail: 'parents/brackets/braces and their contents'},
    "{": [
        {
            if: "!__selection.isEmpty",
            then: [
                "selection-utilities.activeAtStart",
                { "cursorMove": { "to": "left", "select": true } },
                "selection-utilities.activeAtEnd",
                { "cursorMove": { "to": "right", "select": true } }
            ],
        },
        { "editor.action.selectToBracket": {"selectBrackets": true} }
    ],

    "::doc::'>": { kind: 'select', label: 'in <>', detail: 'text inside angle brackets'},
    "'>": "extension.selectAngleBrackets",
    "::doc::'<": { kind: 'select', label: 'in ><', detail: 'text inside tag pairs (e.g. <a>text</a>)'},
    "'<": "extension.selectInTag",

    "::doc::']": {kind: 'select', label: 'indent+top', detail: 'all text at same indent and the unindent line just above it (ala python syntax)'},
    "']": "vscode-select-by-indent.select-outer-top-only",
    "::doc::]": {kind: 'select', label: 'inside indent', detail: 'all text at same indent'},
    "]": "vscode-select-by-indent.select-inner",
    "::doc::}": {kind: 'select', label: 'around indent', detail: 'all text at same indent along with the line above and below this (ala c-like synatx)'},
    "}": "vscode-select-by-indent.select-outer",

    "::doc::u`": {kind: 'select', label: 'inside ``', detail: 'inside first character pair `` (non syntactical, useful inside comments)'},
    "u`": { "modalkeys.selectBetween": {
        from: "`", to: "`",
        inclusive: false,
        caseSensitive: true,
        docScope: true
    }},
    "::doc::u[": {kind: 'select', label: 'inside []', detail: 'inside first character pair `[]` (non syntactical, useful inside comments)'},
    "u[": { "modalkeys.selectBetween": {
        from: "[", to: "]",
        inclusive: false,
        caseSensitive: true,
        docScope: true
    }},
    "::doc::u{": {kind: 'select', label: 'inside {}', detail: 'inside first character pair `{}` (non syntactical, useful inside comments)'},
    "u{": { "modalkeys.selectBetween": {
        from: "{", to: "}",
        inclusive: false,
        caseSensitive: true,
        docScope: true
    }},

    "::doc::u]": {kind: 'select', label: 'around []', detail: 'around first character pair `[]` (non syntactical, useful inside comments)'},    
    "u]": { "modalkeys.selectBetween": {
        from: "[", to: "]",
        inclusive: true,
        caseSensitive: true,
        docScope: true
    }},
    
    "::doc::u}": {kind: 'select', label: 'around {}', detail: 'around first character pair `{}` (non syntactical, useful inside comments)'},    
    "u}": { "modalkeys.selectBetween": {
        from: "{", to: "}",
        inclusive: true,
        caseSensitive: true,
        docScope: true
    }},

    "::doc::uC": {kind: 'select', label: 'between bracket pair', detail: 'around/inside some bracket pairs' },
    "::doc::uC(": {kind: 'select', label: 'inside ()', detail: 'inside first pair of `()` (non syntactical, useful inside comments)' },  
    "uC(": { "modalkeys.selectBetween": {
        from: "(", to: ")",
        inclusive: false,
        caseSensitive: true,
        docScope: true
    }},
    "::doc::uC)": {kind: 'select', label: 'around ()', detail: 'around first pair of `()` (non syntactical, useful inside comments)' },  
    "uC)": { "modalkeys.selectBetween": {
        from: "(", to: ")",
        inclusive: false,
        caseSensitive: true,
        docScope: true
    }},
    "::doc::uC,": {kind: 'select', label: 'inside <>', detail: 'inside first character pair `<>` (non syntactical, useful inside comments)'},    
    "uC,": { "modalkeys.selectBetween": {
        from: "<", to: ">",
        inclusive: false,
        caseSensitive: true,
        docScope: true
    }},
    "::doc::uC.": {kind: 'select', label: 'inside ><', detail: 'inside first character pair `><` (non syntactical, useful inside comments)'},    
    "uC.": { "modalkeys.selectBetween": {
        from: ">", to: "<",
        inclusive: false,
        caseSensitive: true,
        docScope: true
    }},
    "::doc::uC<": {kind: 'select', label: 'around <>', detail: 'around first character pair `<>` (non syntactical, useful inside comments)'},    
    "uC<": { "modalkeys.selectBetween": {
        from: "<", to: ">",
        inclusive: true,
        caseSensitive: true,
        docScope: true
    }},
    "::doc::uC>": {kind: 'select', label: 'around ><', detail: 'around first character pair `><` (non syntactical, useful inside comments)'},    
    "uC>": { "modalkeys.selectBetween": {
        from: ">", to: "<",
        inclusive: true,
        caseSensitive: true,
        docScope: true
    }},

    "::doc::uc": {kind: 'select', label: 'between pair', detail: 'between two instances of any character, exclusive of the pair (non syntatical, useful inside comments)'},
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

    "::doc::uv": {kind: 'select', label: 'around pair', detail: 'between two instance of any character, inclusive of the pair (non syntatical, useful inside comments)'},
    uv: { "modalkeys.captureChar": {
        acceptAfter: 1,
        executeAfter: { "modalkeys.selectBetween": {
            from: "__captured",
            to: "__captured",
            inclusive: true,
            caseSensitive: true,
            docScope: true
        }},
    }},

    // ### Selection Modifiers

    "::doc::normal::R": {kind: "select", label: 'expand no wht', detail: 'select full line(s), and trim external whitespace'},
    "normal::R": [ "expandLineSelection", "selection-utilities.trimSelectionWhitespace" ],
    "::doc::R": {kind: "modifier", label: 'trim whitespace', detail: 'shrink selection to avoid external whitespace'},
    "R": "selection-utilities.trimSelectionWhitespace" ,
    "::doc::U": {kind: "modifier", label: 'narrow to subword', detail: "Narrow current selection so it starts and stops at a subword (e.g. 'snake' in snake_case)"},
    U: { "selection-utilities.narrowTo": { unit: "subident", boundary: "both", } },

    "::doc::r": {kind: "modifier", label: 'clear', detail: "Clear the current selection"},
    r: "modalkeys.cancelMultipleSelections",
    "::doc:: ": {kind: "mode", label: 'hold', detail: "Start visual mode (enabling selection)"},
    " ": "modalkeys.enableSelection",

    // ### Actions

    // #### Insert/append text
    "::doc::i": {kind: "mode", label: 'insert', detail: "Switch to insert mode" },
    i: [ "modalkeys.cancelMultipleSelections", "modalkeys.enterInsert" ],
    "::doc::a": {kind: "mode", label: 'append', detail: "Switch to insert mode, moving cursor to end of current character" },
    a: [ "modalkeys.cancelMultipleSelections", { if: "__char != ''", then: "cursorRight" }, "modalkeys.enterInsert"],

    "::doc::I": {kind: "mode", label: 'insert start', detail: "Switch to insert mode, moving cursor to start of line" },
    I: [
        { "cursorMove": { to: "wrappedLineFirstNonWhitespaceCharacter", select: false } },
        "modalkeys.enterInsert",
    ],

    "::doc::A": {kind: "mode", label: 'append eol', detail: "Switch to insert mode, moving cursor to end of line" },
    A: [ { "cursorMove": { to: "wrappedLineEnd", select: false } }, "modalkeys.enterInsert", ],

    // #### Text Changes
    "::doc::c": {kind: "mode", label: 'change', detail: "Delete all selected text and move to insert mode"},
    c: countSelectsLines('down', {
        if: "!__selection.isSingleLine && __selection.end.character == 0 && __selection.start.character == 0",
        // multi-line selection
        then: [
            "deleteRight",
            "editor.action.insertLineBefore",
            "modalkeys.enterInsert"
        ],
        // single line selection
        else: { if: "!__selection.isEmpty", then: [
            "deleteRight",
            "modalkeys.enterInsert"
        ],
        // nothing selectioned
        else: [
            "expandLineSelection",
            "deleteRight",
            "editor.action.insertLineBefore",
            "modalkeys.enterInsert"
        ]}
    }, [
        "deleteRight",
        "editor.action.insertLineBefore",
        "modalkeys.enterInsert"
    ]),

    "::doc::C": {kind: "mode", label: 'change to eol', detail: "Delete all text from here to end of line, and switch to insert mode"},
    C: countSelectsLines('up', [
        "modalkeys.cancelMultipleSelections",
        "deleteAllRight",
        "modalkeys.enterInsert",
    ],
    [
        "deleteRight",
        "editor.actions.insertLineBefore",
        "modalkeys.enterInsert"
    ]),

    "::doc::gy": {kind: "action", label: 'join', detail: "Remove newline between current and next line"},
    "gy": countSelectsLines('down', "editor.action.joinLines"),

    "::doc::`": {kind: "action", label: 'swap', detail: "Swap the style of the current selection or the identifier under the cursor (e.g. from camelCase to snake_case)"},
    "::doc::`c": {kind: "action", label: 'camel', detail: "Swap style to lower camel case (`camelCase`)"},
    "`c": "extension.changeCase.camel",
    "::doc::`U": {kind: "action", label: 'constant', detail: "Swap style to constant (`IS_CONSTANT`)"},
    "`U": "extension.changeCase.constant",
    "::doc::`.": {kind: "action", label: 'dot', detail: "Swap style to dot case (`dot.case`)"},
    "`.": "extension.changeCase.dot",
    "::doc::`-": {kind: "action", label: 'kebab', detail: "Swap style to kebab case (`kebab-case`)"},
    "`-": "extension.changeCase.kebab",
    "::doc::`L": {kind: "action", label: 'all lower', detail: "Swap all to lower case"},
    "`L": "extension.changeCase.lower",
    "::doc::`l": {kind: "action", label: 'first lower', detail: "Swap first letter to lower case"},
    "`l": "extension.changeCase.lowerFirst",
    "::doc::` ": {kind: "action", label: 'spaces', detail: "Swap to spaces (`camelCase` -> `camel case`)"},
    "` ": "extension.changeCase.no",
    "::doc::`C": {kind: "action", label: 'Camel', detail: "Swap to uper camel case (`CamelCase`)"},
    "`C": "extension.changeCase.pascal",
    "::doc::`/": {kind: "action", label: 'path', detail: "Swap to 'path' case (`path/case`)"},
    "`/": "extension.changeCase.path",
    "::doc::`_": {kind: "action", label: 'snake', detail: "Swap to snake case (`snake_case`)"},
    "`_": "extension.changeCase.snake",
    "::doc::`s": {kind: "action", label: 'swap', detail: "Swap upper and lower case letters"},
    "`s": "extension.changeCase.swap",
    "::doc::`t": {kind: "action", label: 'title', detail: "Swap to title case (all words have first upper case letter)"},
    "`t": "extension.changeCase.title",
    "::doc::`Y": {kind: "action", label: 'all upper', detail: "Swap to use all upper case letters"},
    "`Y": "extension.changeCase.upper",
    "::doc::`u": {kind: "action", label: 'first upper', detail: "Swap first character to upper case"},
    "`u": "extension.changeCase.upperFirst",
    "::doc::``": {kind: "action", label: 'toggle', detail: "Toggle through all possible cases"},
    "``": "extension.toggleCase",
    "::doc::~": {kind: "action", label: 'swap char', detail: "Swap case of character under the curser"},
    "~": [
        "modalkeys.cancelMultipleSelections",
        { "cursorMove": { to: 'right', select: true, value: '__count' } },
        {
            "if": "__selectionstr == __selectionstr.toUpperCase()",
            "then": "editor.action.transformToLowercase",
            "else": "editor.action.transformToUppercase"
        },
        "modalkeys.cancelMultipleSelections",
        "cursorLeft"
    ],

    // #### Update numerical selections
    "::doc::=": {kind: "action", label: 'inc #', detail: "Increment a number by 1 (increases increment for subsequent selections)"},
    "=": [
        {
            if: "__selections.length === 1",
            then: "editor.emmet.action.incrementNumberByOne",
            else: "extension.incrementSelection",
        },
    ],
    "::doc::+": {kind: "action", label: 'dec #', detail: "Decrement a number by 1 (increases increment for subsequent selections)"},
    "+": [
        {
            if: "__selections.length === 1",
            then: "editor.emmet.action.decrementNumberByOne",
            else: "extension.decrementSelection",
        },
    ],
    "::doc::g=": {kind: "action", label: 'inc all #', detail: "Increment all numbers by 1"},
    "g=": "editor.emmet.action.incrementNumberByOne",
    "::doc::g+": {kind: "action", label: 'dec all #', detail: "Decrement all numbers by 1"},
    "g+": "editor.emmet.action.decrementNumberByOne",

    // #### Checkmarks
    "::doc::^": {kind: "action", label: 'toggle check', detail: "Toggle a markdown checkbox"},
    "^": "markdown-checkbox.markCheckbox",

    // #### Whitespace
    "::doc::ga": {kind: "action", label: 'trim white', detail: "Delete all external whitespace (left and right edges)"},
    "ga": "selection-utilities.trimWhitespace",

    // #### Brackets
    "::doc::gx": {kind: "action", label: 'remove pair', detail: "Delete a pairing (e.g. `()`)"},
    "::doc::gx[": {kind: "action", label: 'parens/brackets', detail: "Removes pairs that start with `[`, `(` or `{`"},
    "gx[":  "bracketeer.removeBrackets",
    "::doc::gs": {kind: "action", label: 'swap pair', detail: "Change between different kinds of pairs (e.g. `(` to `{`)"},
    "::doc::gs[": {kind: "action", label: 'parens/brackets', detail: "Swap between `[`, `(` and `{`"},
    "gs[":  "bracketeer.swapBrackets",
    "::doc::gs'": {kind: "action", label: 'quotes', detail: "Change between different quotes"},
    "gs'":  "bracketeer.swapQuotes",
    "::doc::gx'": {kind: "action", label: 'quotes', detail: "Removes quotes (', \" or `)"},
    "gx'":  "bracketeer.removeQuotes",
    "::doc::gi": {kind: "action", label: 'insert pair', detail: "Insert a pairing (e.g. ()) around a selection"},
    "::doc::gi(": {kind: "action", label: 'paren', detail: "Insert parenthesis around selection"},
    "gi(": [ "modalkeys.enterInsert", { "type": { text: "(" }, }, "modalkeys.enterNormal" ],
    "::doc::gi<": {kind: "action", label: 'paren', detail: "Insert parenthesis around selection"},
    "gi<": [ "modalkeys.enterInsert", { "type": { text: "<" }, }, "modalkeys.enterNormal" ],
    "::doc::gi`": {kind: "action", label: 'ticks', detail: "Insert ticks (``) around selection"},
    "gi`": [ "modalkeys.enterInsert", { "type": { text: "`" }, }, "modalkeys.enterNormal" ],
    "::doc::gi\"": {kind: "action", label: 'dbl quotes', detail: "Insert quotes (\"\") around selection"},
    "gi\"": [ "modalkeys.enterInsert", { "type": { "text": "\"" }, }, "modalkeys.enterNormal" ],
    "::doc::gi'": {kind: "action", label: 'sgl quotes', detail: "Insert singel quotes ('') around selection"},
    "gi'": [ "modalkeys.enterInsert", { "type": { text: "'" }, }, "modalkeys.enterNormal" ],
    "::doc::gi*": {kind: "action", label: 'start', detail: "Insert stars (**) around selection"},
    "gi*": [ "modalkeys.enterInsert", { "type": { text: "*" }, }, "modalkeys.enterNormal" ],
    "::doc::gi{": {kind: "action", label: 'curly', detail: "Insert curly brackets ({}) around selection"},
    "gi{": [ "modalkeys.enterInsert", { "type": { text: "{" }, }, "modalkeys.enterNormal" ],
    "::doc::gi[": {kind: "action", label: 'square', detail: "Insert square brackets ([]) around selection"},
    "gi[": [ "modalkeys.enterInsert", { "type": { text: "[" }, }, "modalkeys.enterNormal" ],

    // #### Clipboard 

    "::doc::d": {kind: "action", label: "delete", detail: "Delete selection and save to paste buffer"},
    d: countSelectsLines('down', [
        "editor.action.clipboardCutAction",
        { "modalkeys.enterMode": { mode: "normal" } }, // modalkeys.enterNormal has async issues that cause the entire line to be deleted here
    ]),

    "::doc::D": {kind: "action", label: "delete (eol/up)", detail: "without count: Delete from cursor to end of line; with count: Delete from current line up `count` number of keys."},
    D: countSelectsLines('up', [
        "modalkeys.cancelMultipleSelections",
        { "cursorMove": { to: "wrappedLineEnd", select: true } },
        "editor.action.clipboardCutAction",
    ],
    [
        "editor.action.clipboardCutAction",
        { "modalkeys.enterMode": { mode: "normal" } }, // modalkeys.enterNormal has async issues that cause the entire line to be deleted here
    ]),

    "::doc::x": {kind: "action", label: "delete char", detail: "delete the character under the cursor"},
    x: [
        "modalkeys.cancelMultipleSelections",
        { "cursorMove": { to: "right", select: true } },
        "editor.action.clipboardCutAction",
    ],

    "::doc::,r": {kind: "action", label: "replace char", detail: "replace the character under the cursor"},
    ",r": "modalkeys.replaceChar",

    "::doc::y": {kind: "action", label: "copy", detail: "copy selected text to clipboard"},
    y: countSelectsLines('down', [
        "editor.action.clipboardCopyAction", "modalkeys.cancelMultipleSelections",
    ]),

    "::doc::Y": {kind: "action", label: "copy (eol/up)", detail: "without a count: copy to end of line; with a count: copy this and the previous N lines"},
    Y: countSelectsLines('up', [
        { "cursorMove": { to: "wrappedLineEnd", select: true } },
        "editor.action.clipboardCopyAction",
        "modalkeys.cancelMultipleSelections"
    ], [
        "editor.action.clipboardCopyAction",
        "modalkeys.cancelMultipleSelections"
    ]),

    "::doc::v": {kind: "action", label: "paste after", detail: "Paste the next after the cursor/selection"},
    v: [
        {
            if: "!__selection.isEmpty",
            then: [
                "selection-utilities.activeAtEnd",
                "modalkeys.cancelMultipleSelections",
            ],
            else: [
                "modalkeys.cancelMultipleSelections",
                "cursorRight",
            ],
        },
        "editor.action.clipboardPasteAction",
    ],

    "::doc::V": {kind: "action", label: "paste before", detail: "Paste the next before the cursor/selection"},
    V: [
        {
            if: "!__selection.isEmpty",
            then: [
                "selection-utilities.activeAtStart",
                "modalkeys.cancelMultipleSelections",
            ],
        },
        "editor.action.clipboardPasteAction",
    ],

    "::doc::gV": {kind: "action", label: "paste replace", detail: "Paste, replacing the selected text"},
    "gV": "editor.action.clipboardPasteAction",

    "::doc::gv": {kind: "action", label: "paste history", detail: "Paste from clipboard history"},
    "gv": "clipboard-manager.editor.pickAndPaste" ,


    "::doc::,v": {kind: "action", label: "paste after line", detail: "Paste text after current line"},
    ",v": [
        "expandLineSelection",
        "selection-utilities.activeAtEnd",
        "modalkeys.cancelMultipleSelections",
        "editor.action.clipboardPasteAction",
    ],

    "::doc::,V": {kind: "action", label: "paste before line", detail: "Paste text before current line"},
    ",V": [
        "expandLineSelection",
        "selection-utilities.activeAtStart",
        "modalkeys.cancelMultipleSelections",
        "editor.action.clipboardPasteAction",
    ],


    // #### begin line below
    "::doc::o": {kind: "mode", label: "open below", detail: "open a line below current line and enter insert"},
    o: ["editor.action.insertLineAfter", "modalkeys.enterInsert"],
    "::doc::go": {kind: "action", label: "open below", detail: "open a line below current line"},
    go: "editor.action.insertLineAfter",
    "::doc::visual::o": {kind: "mode", label: "open below", detail: "open a line below current selection and enter insert"},
    "visual::o": "selection-utilities.activeAtEnd",
    "::doc::O": {kind: "mode", label: "open above", detail: "open a line above current line and enter insert"},
    O: [ "editor.action.insertLineBefore", "modalkeys.enterInsert" ],
    "::doc::gO": {kind: "action", label: "open above", detail: "open a line above current line"},
    gO: "editor.action.insertLineBefore",
    "::doc::visual::O": {kind: "mode", label: "open before", detail: "open a line above current selection and enter insert"},
    "visual::O": "selection-utilities.activeAtStart",

    // #### line indent
    "::doc::>": {kind: "action", label: "indent", detail: "Indent lines"},
    ">": countSelectsLines('down', "editor.action.indentLines", [
        "editor.action.indentLines", 
        "modalkeys.cancelMultipleSelections"
    ]),
    "::doc::<": {kind: "action", label: "deindent", detail: "Deindent lines"},
    "<": countSelectsLines('down', "editor.action.outdentLines", [
        "editor.action.outdentLines", 
        "modalkeys.cancelMultipleSelections"
    ]),
    "::doc::g>": {kind: "action", label: "format", detail: "Format code"},
    "g>": countSelectsLines('down', "editor.action.formatSelection", [
        "editor.action.formatSelection",
        "modalkeys.cancelMultipleSelections"
    ]),

    // ### File/window related
    "::doc::,f": {kind: "window", label: "open file", detail: "Open file using quick open"},
    ",f": "workbench.action.quickOpen",
    "::doc::,R": {kind: "window", label: "open recent", detail: "Open recent file"},
    ",R": "workbench.action.openRecent",
    "::doc::,,": {kind: "action", label: "command", detail: "Show the VSCode command palette"},
    ",,": "workbench.action.showCommands",
    "::doc::,g": {kind: "window", label: "goto line", detail: "Use VSCode goto line command"},
    ",g": "workbench.action.gotoLine",

    // ### History

    "::doc::z": {kind: "history", label: "undo", detail: "VSCode Undo"},
    z: [ "undo", "modalkeys.cancelMultipleSelections", "modalkeys.untouchDocument", ],
    "::doc::Z": {kind: "history", label: "undo", detail: "VSCode Redo"},
    Z: [ "redo", "modalkeys.cancelMultipleSelections", "modalkeys.untouchDocument", ],
    "::doc::-": {kind: "history", label: "cursor undo", detail: "VSCode Cursor Undo"},
    "-": "cursorUndo",
    "::doc::_": {kind: "history", label: "cursor redo", detail: "VSCode Cursor Redo"},
    "_": "cursorRedo",

    "::doc::.": {kind: "history", label: "repeat", detail: "repeat last sentence (last selection and action pair)"},
    ".": [
        "modalkeys.repeatLastUsedSelection",
        "modalkeys.repeatLastChange",
    ],
    "::doc::'.": {kind: "history", label: "repeat select", detail: "repeat last used selection (last selection followed by action pair)"},
    "'.": "modalkeys.repeatLastUsedSelection",
    "::doc::g.": {kind: "history", label: "repeat action", detail: "repeat last action"},
    "g.": "modalkeys.repeatLastChange",

    "::doc::q": {kind: "history", label: "record", detail: "toggle macro recording (use count to label it), use `'q` to cancel recording"},
    "q": { "modalkeys.toggleRecordingMacro": { register: "__count" } },
    "::doc::Q": {kind: "history", label: "replay", detail: "replay the macro (specify which macro using a count)"},
    "Q": { "modalkeys.replayMacro": { register: "__count" } },
    "::doc::'q": {kind: "history", label: "cancel recording", detail: "stop recording a macro (don't save it)"},
    "'q": "modalkeys.cancelRecordingMacro",

    // ### Comments 
    "::doc::g;": {kind: "action", label: "comment →", detail: "select next comment"},
    "g;":  countSelectsLines('down', [
        "editor.action.commentLine", "modalkeys.cancelMultipleSelections",
    ]),
    "::doc::g:": {kind: "action", label: "comment ←", detail: "select previous comment"},
    "g:":  countSelectsLines('down', [
        "editor.action.blockComment", "modalkeys.cancelMultipleSelections",
    ]),
    "::doc::gq": {kind: "action", label: "wrap", detail: "wrap text, preserving commenting"},
    "gq": "rewrap.rewrapComment",

    // ### terminal actions
    "::doc::m": {kind: "action", label: "to repl", detail: "send text to a terminal (usually containing a REPL); use langauge specific extensions when available and put the pasted code into a block (when defined)."},
    m: countSelectsLines('down', [
        {
            if: "__language == 'julia'",
            then: {
                if: "__selection.isEmpty",
                then: ["expandLineSelection", "language-julia.executeCodeBlockOrSelectionAndMove"],
                else: "language-julia.executeCodeBlockOrSelectionAndMove"
            },
            else: {
                if: "!__selection.isSingleLine",
                then: "terminal-polyglot.send-block-text",
                else: "terminal-polyglot.send-text"
            },
        },
        "modalkeys.cancelMultipleSelections",
        "modalkeys.touchDocument"
    ]),
    "::doc::M": {kind: "action", label: "to repl (v2)", detail: "send text to a terminal (usually containing a REPL), placing in a block when defined."},
    M: countSelectsLines('down', [
        {
            if: "!__selection.isSingleLine",
            then: "terminal-polyglot.send-block-text",
            else: "terminal-polyglot.send-text"
        },
        "modalkeys.cancelMultipleSelections",
        "modalkeys.touchDocument"
    ]),
    "::doc::gm": {kind: "action", label: "to repl (v3)", detail: "send text to a terminal (usually containing a REPL)."},
    gm: countSelectsLines('down', [
        "terminal-polyglot.send-text",
        "modalkeys.cancelMultipleSelections",
        "modalkeys.touchDocument"
    ]),

    // ### git/version control
    "::doc::gr": {kind: "action", label: "git stage", detail: "stage changes for commit"},
    gr: countSelectsLines([ "git.stageSelectedRanges", "modalkeys.touchDocument", "modalkeys.cancelMultipleSelections" ]),
    "::doc::gR": {kind: "action", label: "git unstage", detail: "unstage changes for commit"},
    gR: countSelectsLines([ "git.unstageSelectedRanges", "modalkeys.touchDocument", "modalkeys.cancelMultipleSelections" ]),
    "::doc::gu": {kind: "action", label: "git revert", detail: "revert uncommited changes"},
    gu: countSelectsLines(["git.revertSelectedRanges", "modalkeys.cancelMultipleSelections"]),
    "::doc::gl": {kind: "action", label: "git pull", detail: "pull changes from remote"},
    gl: "git.pull",
    "::doc::gp": {kind: "action", label: "git push", detail: "push changes to remote"},
    gp: "git.push",
    "::doc::gc": {kind: "action", label: "→ conflict", detail: "move to next merge conflict"},
    gc: "merge-conflict.next",
    "::doc::gC": {kind: "action", label: "← conflict", detail: "move to previous merge conflict"},
    gC: "merge-conflict.previous",
    "::doc::g[": {kind: "action", label: "current", detail: "accept current change"},
    "g[": "merge-conflict.accept.current",
    "::doc::g]": {kind: "action", label: "incoming", detail: "accept incoming change"},
    "g]": "merge-conflict.accept.incoming",
    "::doc::g\\": {kind: "action", label: "both", detail: "accept both changes"},
    "g\\": "merge-conflict.accept.both",
    "::doc::g{": {kind: "action", label: "all current", detail: "accept all current changes"},
    "g{": "merge-conflict.accept.all-current",
    "::doc::g}": {kind: "action", label: "all incoming", detail: "accept all incoming changes"},
    "g}": "merge-conflict.accept.all-current",
    "::doc::g|": {kind: "action", label: "all both", detail: "accept all both changes"},
    "g|": "merge-conflict.accept.all-both",
    "::doc::,e": {kind: "select", label: "error →", detail: "move to next error"},
    ",e": "editor.action.marker.next",
    "::doc::,E": {kind: "select", label: "error ←", detail: "move to previous error"},
    ",E": "editor.action.marker.prev",
    "::doc::,d": {kind: "window", label: "diff →", detail: "move to and show next change"},
    ",d": "editor.action.dirtydiff.next",
    "::doc::,D": {kind: "window", label: "diff ←", detail: "move to and show previous change"},
    ",D": "editor.action.dirtydiff.previous",
    "::doc::'d": {kind: "select", label: "change →", detail: "move to next change"},
    "'d": "workbench.action.editor.nextChange",
    "::doc::'D": {kind: "select", label: "change ←", detail: "move to previous change"},
    "'D": "workbench.action.editor.previousChange",

    // ### window manipulation
    "::doc::,>": { kind: "window", label: "center", detail: "center window at primary cursor position" },
    ",>": { "revealLine": { lineNumber: '__line', at: 'center' } },
    "::doc::,K": { kind: "window", label: "top", detail: "center window so that primary cursor is at the top" },
    ",K": { "revealLine": { lineNumber: '__line', at: 'top' } },
    "::doc::,J": { kind: "window", label: "bottom", detail: "center window so that primary cursor is at the bottom" },
    ",J": { "revealLine": { lineNumber: '__line', at: 'bottom' } },
    "::doc::,M": { kind: "window", label: "max", detail: "minimize size of all other windows" },
    ",M": "workbench.action.minimizeOtherEditors",
    "::doc::,=": { kind: "window", label: "equal", detail: "equalzize size of all windows" },
    ",=": "workbench.action.evenEditorWidths",
    "::doc::,|": { kind: "window", label: "split", detail: "toggle split editor view" },
    ",|": "workbench.action.toggleSplitEditorInGroup",
    "::doc::,L": { kind: "window", label: "split →", detail: "move to other side of editor split" },
    ",L": "workbench.action.focusOtherSideEditor",
    "::doc::,l": { kind: "window", label: "→", detail: "move focus to window to the right" },
    ",l": "workbench.action.focusRightGroup",
    "::doc::,h": { kind: "window", label: "←", detail: "move focus to window to the left" },
    ",h": "workbench.action.focusLeftGroup",
    "::doc::,k": { kind: "window", label: "↑", detail: "move focus to window above" },
    ",k": "workbench.action.focusAboveGroup",
    "::doc::,j": { kind: "window", label: "↓", detail: "move focus to window below" },
    ",j": "workbench.action.focusBelowGroup",
    "::doc::,c": { kind: "window", label: "create", detail: "create new window of editor in given direction" },
    "::doc::,cl": { kind: "window", label: "→", detail: "create new window of editor to left" },
    ",cl": "workbench.action.splitEditorRight",
    "::doc::,ch": { kind: "window", label: "←", detail: "create new window of editor to left" },
    ",ch": "workbench.action.splitEditorLeft",
    "::doc::,cj": { kind: "window", label: "↓", detail: "create new window of editor below" },
    ",cj": "workbench.action.splitEditorDown",
    "::doc::,ck": { kind: "window", label: "↑", detail: "create new window of editor above" },
    ",ck": "workbench.action.splitEditorUp",
    "::doc::,m": { kind: "window", label: "move to", detail: "move editor to window in given direction" },
    "::doc::,ml": { kind: "window", label: "→", detail: "move editor to window to left" },
    ",ml": "workbench.action.moveEditorToRightGroup",
    "::doc::,mh": { kind: "window", label: "←", detail: "move editor to window to left" },
    ",mh": "workbench.action.moveEditorToLeftGroup",
    "::doc::,mj": { kind: "window", label: "↓", detail: "move editor to window below" },
    ",mj": "workbench.action.moveEditorToBelowGroup",
    "::doc::,mk": { kind: "window", label: "↑", detail: "move editor to window above" },
    ",mk": "workbench.action.moveEditorToAboveGroup",
    "::doc::,x": { kind: "window", label: "close pane", detail: "close the given group of editors"},
    ",x": "workbench.action.closeEditorsInGroup",

    "::doc::gh": { kind: "window", label: "hover", detail: "show the hover view" },
    gh: "editor.action.showHover",
    "::doc::gf": { kind: "window", label: "open", detail: "open the file name under the cursor" },
    gf: "extension.openFileFromPath",
    "::doc::gd": { kind: "window", label: "go to", detail: "go to the definition of symbol under curosr" },
    gd: "editor.action.revealDefinition",
    "::doc::gD": { kind: "window", label: "go to (aside)", detail: "go to the definition of symbol under curosr in an editor to the side" },
    gD: "editor.action.revealDefinitionAside",

    // ### Debugging
    "::doc::gH": { kind: "window", label: "debug hover", detail: "show the debug hover view" },
    gH: "editor.debug.action.showDebugHover",
    "::doc::gb": { kind: "action", label: "breakpt.", detail: "toggle debug breakpoint" },
    gb: "editor.debug.action.toggleBreakpoint",
    "::doc::ge": { kind: "leader", label: "debug", detail: "additional debug actions" },
    geb: "editor.debug.action.conditionalBreakpoint",
    "::doc::ger": { kind: "action", label: "start", detail: "start debugging" },
    ger: "workbench.action.debug.start",
    "::doc::gec": { kind: "action", label: "continue", detail: "continue debugging" },
    gec: "workbench.action.debug.continue",
    "::doc::gej": { kind: "action", label: "next", detail: "debug: step over next line" },
    gej: "workbench.action.debug.stepOver",
    "::doc::gel": { kind: "action", label: "into", detail: "debug: step into next line" },
    gel: "workbench.action.debug.stepInto",
    "::doc::gek": { kind: "action", label: "out", detail: "debug: step out" },
    gek: "workbench.action.debug.stepOut",

    // ### bookmarks
    "::doc::g ": { kind: "action", label: "mark", detail: "toggle bookmark at given line (use 'j, 'k and '# to navigate bookmarks)" },
    "g ": "vsc-labeled-bookmarks.toggleBookmark",
    "::doc::'j": { kind: "action", label: "mark ↓", detail: "move to next bookmark" },
    "normal::'j": "vsc-labeled-bookmarks.navigateToNextBookmark",
    "::doc::'k": { kind: "action", label: "mark ↑", detail: "move to previous bookmark" },
    "normal::'k": "vsc-labeled-bookmarks.navigateToPreviousBookmark",
    "visual::'j": "vsc-labeled-bookmarks.expandSelectionToNextBookmark",
    "visual::'k": ["vsc-labeled-bookmarks.expandSelectionToPreviousBookmark", "selection-utilities.activeAtStart"],
    "::doc::gx ": { kind: "action", label: "mark", detail: "remove bookmark (use quick selection)" },
    "gx ": "vsc-labeled-bookmarks.deleteBookmark",
    "::doc::'#": { kind: "select", label: "nav marks", detail: "reveal quick selection to move to a bookmark" },
    "'#": "vsc-labeled-bookmarks.navigateToBookmark",

    // ### Selection Modifiers and Selection Editing
    //
    // A varitey of the following commands use something called "select-edit" mode. This
    // mode enables a variety of handy selection manipulations that are demoed
    // in the [Selection Utilities
    // extesion](https://github.com/haberdashPI/vscode-selection-utilities). The
    // mode is normally started when you create multiple selections from a
    // matched word using `"`, much as Ctrl/Cmd-D works in VSCode.

    "::doc::\"": { kind: "mode", label: "select-edit", detail: "Enter a mode where you can edit and manipulate (possibly multiple) selections with ease. Entering the mode also adds a new cursor for the next match to the word under the curosr (or selection). You can use the count to ask multiple matches to be added. (You can use `,\"` to avoid adding any cursors)."},
    '"': [
        { if: "__selections.length <= 1",
            then: { "selection-utilities.addNext": {}, repeat: '__count' } },
        { "modalkeys.enterMode": { mode: "selectedit" } },
    ],
    "::doc::,\"": { kind: "mode", label: "select-edit", detail: "Enter a mode where you can edit and manipulate (possibly multiple) selections with ease. No additional cursors will be added when entering the mode with this command. "},
    ",\"": { "modalkeys.enterMode": { mode: "selectedit" } },
    "::doc::selectedit:: ": { kind: "modifier", label: 'mode', detail: "return to a signle selection and return to normal mode"},
    "selectedit:: ": [ "selection-utilities.cancelSelection", { "modalkeys.enterMode": { mode: "normal" }} ],
    "::doc::selectedit::i": { kind: "modifier", label: 'mode', detail: "insert mode at cursor"},
    "selectedit::i": [ "modalkeys.enterNormal", "modalkeys.cancelMultipleSelections", "modalkeys.enterInsert" ],
    "::doc::selectedit::\n": { kind: "modifier", label: 'mode', detail: "return to normal mode"},
    "selectedit::\n": [ { "modalkeys.enterMode": { mode: "normal" }} ],

    "::doc::selectedit::\"": { kind: "modifier", label: "add →", detail: "add cursor at the next match to the primary cursor's text" },
    "selectedit::\"": { "selection-utilities.addNext": {}, repeat: '__count' },
    "::doc::selectedit::J": { kind: "modifier", label: "add →", detail: "add cursor at the next match to the primary cursor's text" },
    "selectedit::J": { "selection-utilities.addNext": {}, repeat: '__count' },
    "::doc::selectedit::K": { kind: "modifier", label: "add ←", detail: "add cursor at the previous match to the primary cursor's text" },
    "selectedit::K": { "selection-utilities.addPrev": {}, repeat: '__count' },
    "::doc::selectedit::gj": { kind: "modifier", label: "skip →", detail: "move primary cursor to the next match of the primary cursor's text" },
    "selectedit::gj":  { "selection-utilities.skipNext": {}, repeat: '__count' },
    "::doc::selectedit::gk": { kind: "modifier", label: "skip →", detail: "move primary cursor to the previous match of the primary cursor's text" },
    "selectedit::gk": { "selection-utilities.skipPrev": {}, repeat: '__count' },

    "::doc::selectedit::=": { kind: "action", label: "align ←", detail: "align selections left"},
    "selectedit::=": "selection-utilities.alignSelectionsLeft",
    "::doc::selectedit::+": { kind: "action", label: "align ←", detail: "align selections right"},
    "selectedit::+": "selection-utilities.alignSelectionsRight",
    "::doc::'c": { kind: "modifier", label: "save sel", detail: "save all selections to the default register. Use a count to specify an alternate register"},
    "'c": [
        { "selection-utilities.appendToMemory": { register: "__count" } },
        "modalkeys.cancelMultipleSelections", "modalkeys.enterNormal"
    ],
    "::doc::'v": { kind: "modifier", label: "load sel", detail: "load previously saved selections in the default register. Use a count to specify an alternate register"},
    "'v": [
        { "selection-utilities.restoreAndClear": { register: "__count" } },
        { if: "__selections.length > 1", then: { "modalkeys.enterMode": { mode: "selectedit" }}}
    ],

    "::doc::'x": { kind: "modifier", label: "exchange sel", detail: "exchange selections: with no saved selection, saves the selection, with saved selections exchanges text of current selections with those of the saved selections (number of selections must match). Use a count to specify an alternate register."},
    "'x": { "selection-utilities.swapWithMemory": { register: "__count" } },
    "::doc::'n": { kind: "modifier", label: "rem saved sel", detail: "remove the most recently saved selection from the list of saved selections"},
    "'n": { "selection-utilities.deleteLastSaved": { register: "__count" } },
    "::doc::'\n": { kind: "modifier", label: "split sel", detail: "split selection into multiple selections by new line charactesr"},
    "'\n": countSelectsLines([
        "selection-utilities.splitByNewline",
        { "modalkeys.enterMode": { mode: "selectedit" } }
    ]),
    "::doc::'*": { kind: "modifier", label: "sel all", detail: "create a selection for every match of the current word (or selection)"},
    "'*": [
        "editor.action.selectHighlights",
        { "modalkeys.enterMode": { mode: "selectedit" } },
    ],
    "::doc::'-": { kind: "modifier", label: "restore sel", detail: "restore the most recently cleared selection"},
    "'-": [
        { "selection-utilities.restoreAndClear": {register: "cancel"} },
        { if: "__selections.length > 1", then: { "modalkeys.enterMode": { mode: "selectedit" }}}
    ],
    "::doc::'K": { kind: "modifier", label: "insert sel ↑", detail: "insert cursor on line above"},
    "'K": [
        { "editor.action.insertCursorAbove": {}, repeat: '__count' },
        { "modalkeys.enterMode": { mode: "selectedit" } },
    ],
    "::doc::'J": { kind: "modifier", label: "insert sel ↓", detail: "insert cursor on line below"},
    "'J": [
        { "editor.action.insertCursorBelow": {}, repeat: '__count' },
        { "modalkeys.enterMode": { mode: "selectedit" }},
    ],

    "::doc::selectedit::r": { kind: "mode", label: "reset", detail: "collapse all selections to single curosr, and return to normal mode" },
    "selectedit::r": [ "modalkeys.enterNormal", "modalkeys.cancelMultipleSelections" ],
    "::doc::selectedit::O": { kind: "modifier", label: "active ←", detail: "move active to start" },
    "selectedit::O": "selection-utilities.activeAtStart",
    "::doc::selectedit::o": { kind: "modifier", label: "active →", detail: "move active to end" },
    "selectedit::o": "selection-utilities.activeAtEnd",
    "::doc::selectedit::j": { kind: "modifier", label: "→ sel", detail: "make the next selection primary; primary selections determine from where you add cursors, what cursor you delete, and where the cursor goes when you clear or save selections" },
    "selectedit::j": { "selection-utilities.movePrimaryRight": {}, repeat: '__count' },
    "::doc::selectedit::k": { kind: "modifier", label: "← sel", detail: "make the previous selection primary; primary selections determine from where you add cursors, what cursor you delete, and where the cursor goes when you clear or save selections" },
    "selectedit::k": { "selection-utilities.movePrimaryLeft": {}, repeat: '__count' },
    "::doc::selectedit::d": { kind: "modifier", label: "del. sel", detail: "remove the primary selection" },
    "selectedit::d": { "selection-utilities.deletePrimary": {}, repeat: '__count' },
    "::doc::selectedit::s": { kind: "modifier", label: "split", detail: "split the selection by a specified marker"},
    "::doc::selectedit::s\n": { kind: "modifier", label: "newline", detail: "split by newlines"},
    "selectedit::s\n": "selection-utilities.splitByNewline",
    "::doc::selectedit::ss": { kind: "modifier", label: "string", detail: "split by a given string"},
    "selectedit::ss": "selection-utilities.splitBy",
    "::doc::selectedit::sr": { kind: "modifier", label: "regex", detail: "split by a given regular expression"},
    "selectedit::sr": "selection-utilities.splitByRegex",
    "::doc::selectedit::sc": { kind: "modifier", label: "character", detail: "split by a given character"},
    "selectedit::sc": { "modalkeys.captureChar": {
        acceptAfter: 1,
        executeAfter: [
            { "selection-utilities.splitBy": { text: "__captured" } }
        ]   
    }},
    "::doc::selectedit::/": { kind: "modifier", label: "create", detail: "create a set of selections by the specified marker that all fall within the current set of selections"},
    "::doc::selectedit::/s": { kind: "modifier", label: "string", detail: "create selections of given string scoped to the current selections"},
    "selectedit::/s": "selection-utilities.createBy",
    "::doc::selectedit::/r": { kind: "modifier", label: "regex", detail: "create selections of given regular expression scoped to the current selections"},
    "selectedit::/r": "selection-utilities.createByRegex",
    "::doc::selectedit::/c": { kind: "modifier", label: "character", detail: "create selections of given character scoped to the current selections"},
    "selectedit::/c": { "modalkeys.captureChar": {
        acceptAfter: 1,
        executeAfter: [
            { "selection-utilities.createBy": { text: "__captured" } }
        ]   
    }},
    "::doc::selectedit::[": { kind: "modifier", label: "include by", detail: "Include all selections that contain a given marker"},
    "::doc::selectedit::]": { kind: "modifier", label: "exclude by", detail: "Exclude all selections that contain a given marker"},
    "::doc::selectedit::[s": { kind: "modifier", label: "string", detail: "Include all selections that contain a given string"},
    "selectedit::[s": "selection-utilities.includeBy",
    "::doc::selectedit::]s": { kind: "modifier", label: "string", detail: "Exclude all selections that contain a given string"},
    "selectedit::]s": "selection-utilities.excludeBy",
    "::doc::selectedit::[r": { kind: "modifier", label: "regex", detail: "Include all selections that contain a given regular expression"},
    "selectedit::[r": "selection-utilities.includeByRegex",
    "::doc::selectedit::]r": { kind: "modifier", label: "regex", detail: "Exclude all selections that contain a given regular expression"},
    "selectedit::]r": "selection-utilities.excludeByRegex",

    // ### Symmetric insertion (around selection)
    // Symmetric insertion, which is defined by a series of commands in
    // [Selection Utilities](https://github.com/haberdashPI/vscode-selection-utilities)
    // allows insertion of characters on both sides of a selection.

    "::doc::, ": { kind: "action", label: "spaces around", detail: "insert spaces around current selections"},
    ", ": { "selection-utilities.insertAround": { before: " ", after: " " }},
    "::doc::g'": {kind: "mode", label: "symmetric insert", detail: "Move to symmetric insert mode: in this mode there are a variety of operations (inserts, deletions) that can be performed at both the start and end of a selection."},
    "g'": { "modalkeys.enterMode": { mode: "syminsert" } },
    "::doc::syminsert::\n": {kind: "mode", label: "normal", detail: "Return to normal mode"},
    "syminsert::\n": { "modalkeys.enterMode": { mode: "normal" } },
    "::doc::syminsert::i": {kind: "action", label: "insert char", detail: "insert the given character on both sides of selections"},
    "syminsert::i": { "modalkeys.captureChar": {
        acceptAfter: 1,
        executeAfter: [
            { "selection-utilities.insertAround": {
                before: "__captured",
                after: "__captured",
            }},
            { "selection-utilities.adjustSelections": { dir: "forward" } }
        ]
    }},
    "::doc::syminsert::r": {kind: "mode", label: "enter normal", detail: "reset selections and enter normal mode"},
    "syminsert::r": [ "modalkeys.enterNormal", "modalkeys.cancelMultipleSelections" ],
    ...(Object.fromEntries(Array.from(":;'\",./?|=+-_*&^%$#@!`~").map(c =>
        ["::doc::syminsert::"+c, {kind: "action", label: "insert "+c, detail: "insert a "+c+" on both sides of selections"}]
    ))),
    ...(Object.fromEntries(Array.from(":;'\",./?|=+-_*&^%$#@!`~").map(c =>
         ["syminsert::"+c, [
             { "selection-utilities.insertAround": { before: c, after: c }},
             { "selection-utilities.adjustSelections": { dir: "forward" } }
         ]]
    ))),
    "::doc::symisert::\\": {kind: "action", label: "escaped", detail: "surround selections with an escaped character"},
    // TODO: use capture mode
    "::doc::syminsert::\\\"": {kind: "action", label: "quote", detail: "surround by escaped double quote"},
    'syminsert::\\"': [
        { "selection-utilities.insertAround": { before: '\\"', after: '\\"' }},
    ],
    "::doc::syminsert::\\'": {kind: "action", label: "quote", detail: "surround by escaped single quote"},
    "syminsert::\\'": [
        { "selection-utilities.insertAround": { before: "\\'", after: "\\'" }},
    ],

    "::doc::syminsert::o": { kind: "modifier", label: "active →", detail: "move active to end" },
    "syminsert::o": "selection-utilities.activeAtEnd",
    "::doc::syminsert::O": { kind: "modifier", label: "active ←", detail: "move active to start" },
    "syminsert::O": "selection-utilities.activeAtStart",
    "::doc::syminsert::x": { kind: "action", label: "delete", detail: "delete the first and last character of the selection, adjusting the selection"},
    "syminsert::x": [
        { "selection-utilities.adjustSelections": { dir: "backward" } },
        { "selection-utilities.deleteAround": { count: "__count" }}
    ],
    "::doc::syminsert::d": { kind: "action", label: "delete", detail: "delete the characters just before the first and last character of the selection"},
    "syminsert::d": { "selection-utilities.deleteAround": { count: "__count" }},
    "::doc::syminsert::l": { kind: "modifier", label: "sel →", detail: "shrink/grow selections in direction that's rightwards from cursor"},
    "syminsert::l": {
        "if": "!__selection.isReversed",
        "then": { "selection-utilities.adjustSelections": 
            { dir: "forward", count: "__count" }
        },
        "else": { "selection-utilities.adjustSelections": 
            { dir: "backward", count: "__count" }
        },
    },
    "::doc::syminsert::h": { kind: "modifier", label: "sel ←", detail: "shrink/grow selections in direction that's leftwards from cursor"},
    "syminsert::h": {
        "if": "!__selection.isReversed",
        "then": { "selection-utilities.adjustSelections": 
            { dir: "backward", count: "__count" }
        },
        "else": { "selection-utilities.adjustSelections": 
            { dir: "forward", count: "__count" }
        },
    },
    "::doc::syminsert::{": { kind: "action", label: "insert {}",  detail: "Insert curly brackets around selection"},
    "syminsert::{": [
        { "selection-utilities.insertAround": { before: "{", after: "}" }},
        { "selection-utilities.adjustSelections": { dir: "forward" } }
    ],
    "::doc::syminsert::[": { kind: "action", label: "insert []",  detail: "Insert square brackets around selection"},
    "syminsert::[": [
        { "selection-utilities.insertAround": { before: "[", after: "]" }},
        { "selection-utilities.adjustSelections": { dir: "forward" } }
    ],
    "::doc::syminsert::(": { kind: "action", label: "insert ()",  detail: "Insert parentheses around selection"},
    "syminsert::(": [
        { "selection-utilities.insertAround": { before: "(", after: ")" }},
        { "selection-utilities.adjustSelections": { dir: "forward" } }
    ],
    "::doc::syminsert::<": { kind: "action", label: "insert <>",  detail: "Insert karrats around selection"},
    "syminsert::<": [
        { "selection-utilities.insertAround": { before: "<", after: ">" }},
        { "selection-utilities.adjustSelections": { dir: "forward" } }
    ],
}}