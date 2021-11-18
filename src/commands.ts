/**
 * # Commands and State
 *
 * This module implements the new commands provided by ModalKeys. It also stores
 * the extension state; which mode we are in, search parameters, bookmarks,
 * quick snippets, etc.
 * @module
 */

//#region -c commands.ts imports
import * as vscode from 'vscode'
import { KeyState, getSearchStyles, getInsertStyles, getNormalStyles, getSelectStyles, Command, expandOneCommand, IKeyRecording, log as actionLog } from './actions'
import { IHash } from './util'
import { TextDecoder } from 'text-encoding'
import { DocViewProvider } from './keymap'

//#endregion
/**
 * ## Command Arguments
 *
 * Most commands provided by ModalKeys take arguments. Since command arguments
 * are stored in objects by-design, we define them as interfaces.
 *
 * ### Search Arguments
 *
 * Search arguments are documented in the
 * [README](../README.html#code-modaledit-search-code).
 */
interface SearchArgs {
    backwards?: boolean
    caseSensitive?: boolean
    wrapAround?: boolean
    acceptAfter?: number
    selectTillMatch?: boolean
    highlightMatches?: boolean
    offset?: string
    executeAfter?: Command
    text?: string
    regex?: boolean
    register?: string
}

interface CaptureCharArgs {
    acceptAfter?: number
    executeAfter: Command
}

/**
 * ### Enter Mode Arguments
 *
 * Arguments for entering specific typing modes, both standard and custom modes.
 */
interface EnterModeArgs {
    mode: string
}

/**
 * The standard modes all have constants defined to avoid typos. However, we need
 * to allow for user defined modes in a keybindings file, so there is no enum.
 */
const Normal = 'normal'
const Search = 'search'
const Replace = 'replace'
const Capture = 'capture'
const Insert = 'insert'
const Visual = 'visual'
let visualFlag = false // visual mode is a special version of normal mode
// it's treated this way because of the asyncrhonous nature of selections
// so we need to track visual mode by two conditions: a user setable flag
// *and* the current editor state; these must both be independently setable

/**
 * ### Bookmark Arguments
 *
 * [Bookmark](../README.html#bookmarks) ID is a user specified string label.
 * Actual positions are stored in an object that conforms to the `Bookmark`
 * interface in the `bookmarks` dictionary.
 */
interface BookmarkArgs {
    bookmark?: string,
    select?: boolean
}

class Bookmark implements vscode.QuickPickItem {
    public description: string

    constructor(
        public label: string,
        public document: vscode.TextDocument,
        public position: vscode.Position) {
        let ln = position.line
        let col = position.character
        let text = document.lineAt(ln).text
        this.description = `Ln ${ln}, Col ${col}: ${text}`
    }
}
/**
 * ### Quick Snippet Arguments
 *
 * [Quick snippets](../README.html#quick-snippets) are also stored in an array.
 * So their IDs are indexes as well.
 */
interface QuickSnippetArgs {
    snippet: number
}
/**
 * ### Type Normal Keys Arguments
 *
 * The [`typeKeys` command](../README.html#invoking-key-bindings) gets the
 * entered keys as a string.
 */
interface TypeKeysArgs {
    keys: string,
    mode?: string
}
/**
 * ### Visual Between Arguments
 *
 * The `selectBetween` command takes as arguments the strings/regular
 * expressions which delimit the text to be selected. Both of them are optional,
 * but in order for the command to do anything one of them needs to be defined.
 * If the `from` argument is missing, the selection goes from the cursor
 * position forwards to the `to` string. If the `to` is missing the selection
 * goes backwards till the `from` string.
 *
 * If the `regex` flag is on, `from` and `to` strings are treated as regular
 * expressions in the search.
 *
 * The `inclusive` flag tells if the delimiter strings are included in the
 * selection or not. By default the delimiter strings are not part of the
 * selection. Last, the `caseSensitive` flag makes the search case sensitive.
 * When this flag is missing or false the search is case insensitive.
 *
 * By default the search scope is the current line. If you want search inside
 * the whole document, set the `docScope` flag.
 */
interface SelectBetweenArgs {
    from: string
    to: string
    regex: boolean
    inclusive: boolean
    caseSensitive: boolean
    docScope: boolean
}
/**
 * ## State Variables
 *
 * The enabler for modal editing is the `type` event that VS Code provides. It
 * reroutes the user's key presses to our extension. We store the handler to
 * this event in the `typeSubscription` variable.
 */
let typeSubscription: vscode.Disposable | undefined
/**
 * We add two items in the status bar that show the current mode. The main
 * status bar shows the current state we are in. The secondary status bar shows
 * additional info such as keys that have been pressed so far and any help
 * strings defined in key bindings.
 */
let mainStatusBar: vscode.StatusBarItem
let secondaryStatusBar: vscode.StatusBarItem
/**
 * The macro status bar shows up read when a macro is being recorded
 */
let macroStatusBar: vscode.StatusBarItem
/**
 * Replaying key commands needs to have a small delay to avoid synchronization
 * issues. Selections do not resolve at the time of command completion;
 * executing a second command too quickly after a selection command can lead to
 * unreliable behavior (since the selection will be in an unkonwn state)
 */
const replayDelay = 50
/**
 * This is the main mode flag that tells if we are in normal mode, insert mode,
 * select mode, searching mode or some user defined mode
 */
let keyMode = Normal
let editorModes: IHash<string> = {}
/**
 * Search text decoration (to highlight the current and any other visible matches)
 */
let searchDecorator: vscode.TextEditorDecorationType;
let searchOtherDecorator: vscode.TextEditorDecorationType;

let bookMarkDecorator: vscode.TextEditorDecorationType;

/**
 * Search states
 */
interface SearchState{
    args: SearchArgs
    string?: string
    oldMode?: string
    startSelections?: vscode.Selection[]
    length?: number
}
let searchStates: IHash<SearchState> = {default: {args: {}}}
let currentSearch: string = "default"
let highlightsChanged: boolean = false
let matchStatusText: string = ""

/**
 * Bookmarks are stored here.
 */
let bookmarks = new Map<string, Map<string, Bookmark>>()
/**
 * Quick snippets are simply stored in an array of strings.
 */
let quickSnippets: string[] = []
/**
 * "Repeat last change" command needs to know when text in editor has changed.
 * It also needs to save the current and last command key sequence, as well as
 * the last sequence that caused text to change.
 */
let textChanged: boolean
let ignoreChangedText: boolean = false
let selectionChanged: boolean
let selectionUsed: boolean
let repeatedSequence = false
/**
 * ## Command Names
 *
 * Since command names are easy to misspell, we define them as constants.
 */
const toggleId = "modalkeys.toggle"
const enterModeId = "modalkeys.enterMode"
const enterInsertId = "modalkeys.enterInsert"
const enterNormalId = "modalkeys.enterNormal"
const toggleSelectionId = "modalkeys.toggleSelection"
const enableSelectionId = "modalkeys.enableSelection"
const cancelSelectionId = "modalkeys.cancelSelection"
const cancelMultipleSelectionsId = "modalkeys.cancelMultipleSelections"
const searchId = "modalkeys.search"
const cancelSearchId = "modalkeys.cancelSearch"
const deleteCharFromSearchId = "modalkeys.deleteCharFromSearch"
const nextMatchId = "modalkeys.nextMatch"
const previousMatchId = "modalkeys.previousMatch"
const typeKeysId = "modalkeys.typeKeys"
const repeatLastChangeId = "modalkeys.repeatLastChange"
const repeatLastUsedSelectionId = "modalkeys.repeatLastUsedSelection"
const selectBetweenId = "modalkeys.selectBetween"
const touchDocumentId = 'modalkeys.touchDocument'
const untouchDocumentId = 'modalkeys.untouchDocument'
const importPresetsId = "modalkeys.importPresets"
const replaceCharId = "modalkeys.replaceChar"
const captureCharId = "modalkeys.captureChar"
const toggleRecordingMacroId = "modalkeys.toggleRecordingMacro"
const cancelRecordingMacroId = "modalkeys.cancelRecordingMacro"
const replayMacroId = "modalkeys.replayMacro"
const exportPresetId = "modalkeys.exportPreset"

export function revealActive(editor: vscode.TextEditor){
    let act = new vscode.Range(editor.selection.active, editor.selection.active);
    editor.revealRange(act)
}

let docKeymap: DocViewProvider | undefined

/**
 * ## Registering Commands
 *
 * The commands are registered when the extension is activated (main entry point
 * calls this function). We also create the status bar item and text
 * decorations.
 */
export function register(context: vscode.ExtensionContext, _docKeymap: DocViewProvider) {
    context.subscriptions.push(
        vscode.commands.registerCommand(enterModeId, enterMode),
        vscode.commands.registerCommand(enterInsertId, enterInsert),
        vscode.commands.registerCommand(enterNormalId, enterNormal),
        vscode.commands.registerCommand(toggleSelectionId, toggleSelection),
        vscode.commands.registerCommand(enableSelectionId, enableSelection),
        vscode.commands.registerCommand(cancelSelectionId, cancelSelection),
        vscode.commands.registerCommand(cancelMultipleSelectionsId,
            cancelMultipleSelections),
        vscode.commands.registerCommand(searchId, search),
        vscode.commands.registerCommand(cancelSearchId, cancelSearch),
        vscode.commands.registerCommand(deleteCharFromSearchId,
            deleteCharFromSearch),
        vscode.commands.registerCommand(nextMatchId, nextMatch),
        vscode.commands.registerCommand(previousMatchId, previousMatch),
        vscode.commands.registerCommand(typeKeysId, typeKeys),
        vscode.commands.registerCommand(repeatLastChangeId, repeatLastChange),
        vscode.commands.registerCommand(repeatLastUsedSelectionId, repeatLastUsedSelection),
        vscode.commands.registerCommand(selectBetweenId, selectBetween),
        vscode.commands.registerCommand(touchDocumentId, touchDocument),
        vscode.commands.registerCommand(untouchDocumentId, untouchDocument),
        vscode.commands.registerCommand(replaceCharId, replaceChar),
        vscode.commands.registerCommand(captureCharId, captureChar),
        vscode.commands.registerCommand(importPresetsId, importPresets),
        vscode.commands.registerCommand(toggleRecordingMacroId, toggleRecordingMacro),
        vscode.commands.registerCommand(cancelRecordingMacroId, cancelRecordingMacro),
        vscode.commands.registerCommand(replayMacroId, replayMacro),
        vscode.commands.registerCommand(exportPresetId, exportPreset),
    )
    mainStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left)
    mainStatusBar.command = toggleId
    secondaryStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left)
    macroStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right)
    macroStatusBar.backgroundColor = 
        new vscode.ThemeColor('statusBarItem.errorBackground')

    docKeymap = _docKeymap;
    docKeymap?.update(keyState, realMode(keyMode))

    updateSearchHighlights();
    vscode.workspace.onDidChangeConfiguration(updateSearchHighlights);
}

let keyState = new KeyState({
    [Search]: searchId, 
    [Replace]: replaceCharId,
    [Capture]: captureCharId
})

interface KeyCommand {
    command: string
    args?: object
}
interface KeyWord {
    seq: string[] | KeyCommand
    mode: string
}
interface KeySentence {
    noun?: KeyWord
    verb?: KeyWord
}

let lastSentence: KeySentence = {}
let pendingSentence: KeySentence = {}

function keySeq(word: IKeyRecording | undefined){
    if(word){
        return (<string[]>word.seq).join("")
    }else{
        return ""
    }
}

/**
 * ## Keyboard Event Handler
 *
 * When the user types in normal mode, `onType` handler gets each typed
 * character one at a time. It calls the `runActionForKey` subroutine to invoke
 * the action bound to the typed key. In addition, it updates the state
 * variables needed by the `repeatLastChange` command and the status bar.
 */
async function onType(event: { text: string }) {
    if(!repeatedSequence){
        if (textChanged && !ignoreChangedText) {
            lastSentence = { ...pendingSentence, verb: keyState.lastWord }
            pendingSentence = { noun: {
                seq: { command: cancelMultipleSelectionsId },
                mode: '' }
            }
            textChanged = false
        }
        if(selectionChanged && !ignoreChangedText){
            pendingSentence = {
                noun: selectionUsed ? keyState.lastWord : {
                    seq: { command: cancelMultipleSelectionsId },
                    mode: keyState.lastWord?.mode || ''
                }
            }
            selectionChanged = false
        }
        ignoreChangedText = false
    }else{
        repeatedSequence = false
        selectionChanged = false
        selectionUsed = false
        textChanged = false
    }

    await runActionForKey(event.text, keyMode)
    updateCursorAndStatusBar(vscode.window.activeTextEditor, keyState.getHelp())
    // clear any search decorators if this key did not alter search state
    // (meaning it was not a search command)
    if(!highlightsChanged){
        vscode.window.activeTextEditor?.setDecorations(searchDecorator, []);
        vscode.window.activeTextEditor?.setDecorations(searchOtherDecorator, []);
    }
    highlightsChanged = false;
}
/**
 * Whenever text changes in an active editor, we set a flag. This flag is
 * examined in the `onType` handler above, and the `lastChange` variable is set
 * to indicate that the last command that changed editor text.
 */
export function onTextChanged() {
     textChanged = true
}

/**
 * Some commands should be treated as actions to repeat, even though they do not change
 * anything in the document: e.g. sending text to a REPL. You can call touchDocument to make
 * sure the command is treated as an action.
 */
function touchDocument() {
    textChanged = true
}

/**
 * Some commands should not be treated as actions to repeat (e.g. undo),
 * and we need a way to ignore these actions.
 */
function untouchDocument() {
    ignoreChangedText = true
}

let replaceModeReturn = Normal
function replaceChar(char: string = ""){
    if(char === ""){
        replaceModeReturn = keyMode
        enterMode(Replace)
    }else{
        let editor = vscode.window.activeTextEditor
        if(editor){
            let sels = editor.selections
            editor.edit((e: vscode.TextEditorEdit) => {
                sels.map(sel => {
                    let curchar = new vscode.Range(sel.active, sel.active.translate(0, 1))
                    e.replace(curchar, char)
                })
            })
        }
        enterMode(replaceModeReturn)
    }
}

let captureModeReturn = Normal
let captureModeAcceptAfter: number = Number.POSITIVE_INFINITY;
let captureCommand: Command | undefined = undefined
let capturedString = ""
async function captureChar(char: string | CaptureCharArgs){
    if(typeof(char) !== 'string'){
        captureModeReturn = keyMode;
        captureModeAcceptAfter = char.acceptAfter || Number.POSITIVE_INFINITY
        capturedString = "";
        captureCommand = char.executeAfter;
        enterMode(Capture)
    }else if(char == "\n"){
        await runCapture(capturedString)
    }else {
        capturedString += char
        if(capturedString.length >= captureModeAcceptAfter)
            await runCapture(capturedString)
    }
}

async function runCapture(str: string){
    let nestedState = new KeyState({}, keyState)
    if(captureCommand === undefined){
        vscode.window.showErrorMessage("Unexpected missing command for capture string.")
    }else{
        let command = expandOneCommand(captureCommand)
        if(command){
            nestedState.execute(command, captureModeReturn, capturedString)
        }
        enterMode(captureModeReturn)
    }
}

export function onSelectionChanged(e: vscode.TextEditorSelectionChangeEvent){
    if(!textChanged && !ignoreChangedText){
        selectionChanged = true
        selectionUsed = e.selections.some(sel => !sel.isEmpty)
    }
}
/**
 * This helper function just calls the `handleKey` function in the `actions`
 * module. It checks if we have an active selection or search mode on, and
 * passes that information to the function. `handleKey` returns `true` if the
 * key actually invoked a command, or `false` if it was a part of incomplete
 * key sequence that did not (yet) cause any commands to run. This information
 * is needed to decide whether the `lastKeySequence` variable is updated.
 */
async function runActionForKey(key: string, mode: string = keyMode, state: KeyState = keyState) {
    await state.handleKey(key, realMode(mode))
    docKeymap!.update(state, realMode(keyMode))
    return !state.waitingForKey()
}

function realMode(mode: string){
    return isSelecting() && mode === Normal ? Visual : mode
}


/**
 * Translate the position, wrapping across lines.
 * 
 * @param x position to modify
 * @param doc document the position is from
 * @param val the amount to move by (in characters)
 * @returns the newly translated position
 */
function wrappedTranslate(x: vscode.Position, doc: vscode.TextDocument, val: number){
    if(val < 0){
        let result = x
        while(result.character + val < 0){
            val += 1;
            result = result.translate(-1, 0);
            result = result.translate(0, doc.lineAt(result).range.end.character)
        }
        return result.translate(0, val);
    }else{
        let result = x;
        while(result.character + val > doc.lineAt(result).range.end.character){
            val -= 1;
            result = new vscode.Position(result.line+1, 0)
        }
        return result.translate(0, val);
    }
}


function handleTypeSubscription(newmode: string){
    if(newmode !== Insert){
        if(!typeSubscription){
            try{
                typeSubscription = vscode.commands.registerCommand("type", onType)
            }catch(e){
                vscode.window.showErrorMessage("Another extension is overwritting the 'type' command. (E.g. VSCodeVim). ModalKeys will not behave properly.")
            }
        }
        vscode.commands.executeCommand('hideSuggestWidget')
    }else if(newmode === Insert && typeSubscription){
        typeSubscription.dispose()
        typeSubscription = undefined
    }
}

let modeHooks: any = {
    // select: {
    //     exit: async (n: string, o: string) =>
    //         await vscode.commands.executeCommand("cancelSelection")
    // },
    [Normal]: {
        enter: async (m: string) => { keyState.reset() }
    },
    [Search]: {
        enter: async (oldmode: string) => {
            let state = searchState(currentSearch)
            state.oldMode = oldmode
        }
    },
    __default__: {
        enter: async (oldmode: string) => {
            if(oldmode === Replace || oldmode == Capture || oldmode == Search){
                keyState.reset()
            }
        }
    },
}

export async function enterNormal(){ enterMode('normal'); keyState.reset() }
export async function enterInsert(){ enterMode('insert') }

export async function enterMode(args: string | EnterModeArgs) {
    let newMode = (<string>((<EnterModeArgs>args).mode || args))
    handleTypeSubscription(newMode)
    if(newMode === Visual){
        newMode = Normal
        visualFlag = true
    }else if(newMode !== Visual){ visualFlag = false }
    const exitHook = modeHooks[keyMode]?.exit || modeHooks['__default__']?.exit
    exitHook && await exitHook(newMode)

    const editor = vscode.window.activeTextEditor
    let oldMode = keyMode
    keyMode = newMode
    if(editor?.document.uri) editorModes[editor?.document.uri.toString()] = visualFlag ? Visual : newMode
    const enterHook = modeHooks[keyMode]?.enter || modeHooks['__default__']?.enter
    enterHook && newMode !== oldMode && await enterHook(oldMode)
    if (editor) {
        updateCursorAndStatusBar(editor)
        await vscode.commands.executeCommand("setContext", "modalkeys.mode", keyMode)
    }
    docKeymap?.update(keyState, realMode(keyMode))
}

export async function restoreEditorMode(editor: vscode.TextEditor | undefined){
    if(editor){
        let newMode = editorModes[editor.document.uri.toString()] || Normal
        handleTypeSubscription(newMode)
        if(newMode === Visual){
            keyMode = Normal
            visualFlag = true
        }else{
            keyMode = newMode
            visualFlag = false
        }
        updateCursorAndStatusBar(editor)
        const enterHook = modeHooks[keyMode]?.modeHooks?.enter
        enterHook && await enterHook(Normal, keyMode)
        await vscode.commands.executeCommand("setContext", "modalkeys.mode", keyMode)
    }
}

/**
 * This function updates the cursor shape and status bar according to editor
 * state. It indicates when selection is active or search mode is on. If
 * so, it shows the search parameters. If no editor is active, we hide the
 * status bar items.
 */
export function updateCursorAndStatusBar(editor: vscode.TextEditor | undefined, help?: string) {
    if (editor) {
        // Get the style parameters
        let [style, text, color] =
            keyMode === Search ? getSearchStyles() :
            keyMode === Insert ? getInsertStyles() :
            (keyMode === Normal && isSelecting()) ? getSelectStyles() :
                getNormalStyles(keyMode)

        /**
         * Update the cursor style.
         */
        editor.options.cursorStyle = style
        /**
         * Update the main status bar.
         */
        let search = searchState(currentSearch)
        mainStatusBar.text = keyMode === Search ?
            `${text} [${search.args.backwards ? "B" : "F"
            }${search.args.caseSensitive ? "S" : ""}]` :
            text
        mainStatusBar.color = color
        mainStatusBar.show()
        /**
         * Update secondary status bar. If there is any keys pressed in the
         * current sequence, we show them. Also possible help string is shown.
         * The info given by search command is shown only as long there are
         * no other messages to show.
         */
        let sec = " " + keySeq(keyState.curWord)
        if (help)
            sec = `${sec}    ${help}`
        if (matchStatusText) {
            if (sec.trim() == "")
                sec = matchStatusText
            else
                matchStatusText = ""
        }
        secondaryStatusBar.text = sec
        secondaryStatusBar.show()
    }
    else {
        mainStatusBar.hide()
        secondaryStatusBar.hide()
    }
}
/**
 * ## Selection Commands
 *
 * `modalkeys.cancelSelection` command clears the selection using standard
 * `cancelSelection` command, but also sets the `selecting` flag to false, and
 * updates the status bar. It is advisable to use this command instead of the
 * standard version to keep the state in sync.
 */
async function cancelSelection(): Promise<void> {
    if (isSelecting()) {
        await vscode.commands.executeCommand("cancelSelection")
        enterMode(Normal)
    }
}
/**
 * `modalkeys.cancelMultipleSelections`, like `modalkeys.cancelSelection` sets
 * selecting to false and sets the anchor equal to active selection position.
 * Unlike `modalkeys.cancelSelection` it preserves multiple cursors.
 */
function cancelMultipleSelections() {
    if (isSelecting()) {
        let editor = vscode.window.activeTextEditor
        if (editor)
            editor.selections = editor.selections.map(sel =>
                new vscode.Selection(sel.active, sel.active))
        enterMode(Normal)
    }
}

/**
 * `modalkeys.toggleSelection` toggles the selection mode on and off. It sets
 * the selection mode flag and updates the status bar, but also clears the
 * selection.
 */
async function toggleSelection(): Promise<void> {
    if(isSelecting()){
        let editor = vscode.window.activeTextEditor
        if(editor){
            editor.selections = editor.selections.map(x => 
                new vscode.Selection(x.active, x.active))
        }
        enterMode(Normal)
    }else{
        enterMode(Visual)
    }
}
/**
 * `modalkeys.enableSelection` sets the selecting to true.
 */
function enableSelection() { enterMode(Visual) }
/**
 * The following helper function actually determines, if a selection is active.
 * It checks not only the `selecting` flag but also if there is any text
 * selected in the active editor.
 */
function isSelecting(editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor): boolean {
    return keyMode === Normal && (visualFlag ||
        (editor ? editor.selections.some(s => !s.isEmpty) : false))
}

function* mapIter<T, R>(iter: Iterable<T>, fn: (x: T) => R){
    for(const x of iter){
        yield fn(x)
    }
}

function* linesOf(doc: vscode.TextDocument, pos: vscode.Position,
    wrap: boolean, forward: boolean): Generator<[string, number]>{

    yield [doc.lineAt(pos).text, pos.line]
    let line = pos.line + (forward ? 1 : -1)
    while(forward ? line < doc.lineCount : line >= 0){
        yield [doc.lineAt(line).text, line]
        line += (forward ? 1 : -1)
    }
    if(wrap){
        line = forward ? 0 : doc.lineCount - 1
        while(forward ? line < doc.lineCount : line > 0){
            yield [doc.lineAt(line).text, line]
            line += (forward ? 1 : -1)
        }
    }
}
function* searchMatches(doc: vscode.TextDocument, start: vscode.Position, end: vscode.Position | undefined,
    target: string, args: SearchArgs){

    let matchesFn: (line: string, offset: number | undefined) => Generator<[number, number]>
    if(args.regex){
        let matcher = RegExp(target, "g" + (!args.caseSensitive ? "" : "i"))
        matchesFn = (line, offset) => regexMatches(matcher, line, !args.backwards, offset)
    }else{
        let matcher = !args.caseSensitive ? target : target.toLowerCase()
        matchesFn = (line, offset) => stringMatches(matcher, !args.caseSensitive, line, !args.backwards, offset)
    }

    let offset: number | undefined = start.character
    for(const [line, i] of linesOf(doc, start, args.wrapAround || false, !args.backwards)){
        if(end && i > end.line){ return }

        let matchesItr = matchesFn(line, offset)
        let matches = !args.backwards ? matchesItr : Array.from(matchesItr).reverse()

        yield* mapIter(matches, ([start, len]) => new vscode.Range(
            new vscode.Position(i, start),
            new vscode.Position(i, start+len)
        ))
        offset = undefined
    }
}

function* regexMatches(matcher: RegExp, line: string, forward: boolean, offset: number | undefined): Generator<[number, number]>{
    matcher.lastIndex = 0
    let match = matcher.exec(line)
    while(match){
        if(offset && !forward && match.index > offset){ return }
        if(offset === undefined || !forward || match.index > offset)
            yield [match.index, match[0].length]
        let newmatch = matcher.exec(line)
        if(newmatch && newmatch.index > match.index){
            match = newmatch
        }else{
            match = null
        }
    }
}

function* stringMatches(matcher: string, matchCase: boolean, line: string, forward: boolean, offset: number | undefined): Generator<[number, number]>{
    let searchme = offset === undefined ? line :
        (forward ? line.substring(offset) : line.substring(0, offset - 1))
    let fromOffset = offset === undefined ? 0 : (forward ? offset : 0)
    if(!matchCase) searchme = searchme.toLowerCase()
    let from = searchme.indexOf(matcher, 0)
    while(from >= 0){
        yield [from + fromOffset, matcher.length]
        from = searchme.indexOf(matcher, from+1)
    }
}

/**
 * This is the main command that not only initiates the search, but also handles
 * the key presses when search is active. That is why its argument is defined
 * as an union type. We also use the argument to detect whether we are starting
 * a new search or adding characters to the active search.
 */
async function search(args: SearchArgs | string): Promise<void> {
    let editor = vscode.window.activeTextEditor
    if (!editor)
        return
    if (!args)
        args = {}
    if (typeof args == 'object') {
        /**
         * If we get an object as argument, we start a new search. We switch
         * to normal mode, if necessary. Then we initialize the search string
         * to empty, and store the current selections in the
         * `searchStartSelections` array. We need an array as the command also
         * works with multiple cursors. Finally we store the search arguments
         * in the module level variables.
         */
        enterMode(Search)
        
        currentSearch = args?.register || "default"
        let state = searchState(currentSearch)
        let text = args.text || ""
        state.string = text
        state.startSelections = editor.selections
        state.args.backwards = args.backwards || false
        state.args.caseSensitive = args.caseSensitive || false
        state.args.wrapAround = args.wrapAround || false
        state.args.acceptAfter = args.acceptAfter || Number.POSITIVE_INFINITY
        state.args.selectTillMatch = args.selectTillMatch || false
        state.args.offset = args.offset || 'inclusive'
        state.args.executeAfter = args.executeAfter
        state.args.regex = args.regex || false
        state.args.highlightMatches = args.highlightMatches === undefined ? true : args.highlightMatches

        /**
         * If we've been passed text to search as part of the command, immediately find
         * and accept the matches
         */
        if(text.length > 0){
            highlightMatches(text, editor, state.startSelections || editor.selections, state)
            await acceptSearch(editor, state)
        }
    }
    else if (args == "\n")
        /**
         * If we get an enter character we accept the search.
         */
        await acceptSearch(editor, searchState(currentSearch))
    else {
        /**
         * Otherwise we just add the character to the search string and find
         * the next match. If `acceptAfter` argument is given, and we have a
         * sufficiently long search string, we accept the search automatically.
         */
        let state = searchState(currentSearch)
        let text = (state.string || "") + args
        state.string = text
        highlightMatches(text, editor, state.startSelections || editor.selections, state)
        if (!state.args.acceptAfter || state.string.length >= state.args.acceptAfter)
            await acceptSearch(editor, state)
    }
}

/**
 * The actual search functionality is located in this helper function. It is
 * used by the actual search command plus the commands that jump to next and
 * previous match.
 *
 * The search starts from positions specified by the `selections` argument. If
 * there are multilple selections (cursors) active, multiple searches are
 * performed. Each cursor location is considered separately, and the next match
 * from that position is selected. The function does *not* make sure that found
 * matches are unique. In case the matches overlap, the number of selections
 * will decrease.
 */
function highlightMatches(text: string, editor: vscode.TextEditor,
    selections: vscode.Selection[], state: SearchState) {
    matchStatusText = ""
    if (state.string == ""){
        /**
         * If search string is empty, we return to the start positions.
         * (cleaering the deceorators)
         */
        if(state.startSelections) editor.selections = state.startSelections
        editor.setDecorations(searchDecorator, []);
        editor.setDecorations(searchOtherDecorator, []);
    }else {
        /**
         * We get the text of the active editor as string. If we have
         * case-insensitive search, we transform the text to lower case.
         */
        let doc = editor.document

        /**
         * searchRanges keeps track of where the searches land
         * (so we can highlight them later on)
         */
        let searchRanges: vscode.Range[] = [];

        editor.selections = selections.map(sel => {
            let matches = searchMatches(doc, sel.active, undefined, text, state.args)
            let result = matches.next()
            let newsel = sel
            while(!result.done){
                let [active, anchor] = state.args.backwards ?
                    [result.value.start, result.value.end] :
                    [result.value.end, result.value.start]
                if (!state.args.selectTillMatch) anchor = active
                else anchor = sel.anchor
                newsel = positionSearch(new vscode.Selection(anchor, active), doc,
                    result.value.end.character - result.value.start.character, 
                    state.args)
                if(!newsel.start.isEqual(sel.start) || !newsel.end.isEqual(sel.end)) break

                result = matches.next()
            }
            if(result.done){
                matchStatusText = "Pattern not found"
                return sel
            }else{
                searchRanges.push(result.value)

                return newsel
            }
        })

        revealActive(editor);

        /**
         * Finally, we highlight all search matches to make them stand out in the document.
         * To accomplish this, we look for any matches that are currently visible and mark
         * them; we want to mark those that aren't a "current" match (found above)
         * differently so we make sure that they are not part of `searchRanges`
         */
         if(state.args.highlightMatches){
            let searchOtherRanges: vscode.Range[] = [];
            editor.visibleRanges.forEach(range => {
                let matches = searchMatches(doc, range.start, range.end, text,
                    {...state.args, backwards: false})
                for(const matchRange of matches){
                    if(!searchRanges.find(x =>
                        x.start.isEqual(matchRange.start) && x.end.isEqual(matchRange.end))){
                        searchOtherRanges.push(matchRange);
                    }
                }
            });

            /**
             * Now, we have the search ranges; so highlight them appropriately
             */
            editor.setDecorations(searchDecorator, searchRanges);
            editor.setDecorations(searchOtherDecorator, searchOtherRanges);
        }
        highlightsChanged = true;
    }
}

/**
 * ### Search Decorations
 *
 * We determine how searches are higlighted whenever the configuration changes by callin
 * this function; searches are highlighted by default using the same colors as used for
 * built-in search commands.
 */
function updateSearchHighlights(event?: vscode.ConfigurationChangeEvent){
    if(!event || event.affectsConfiguration('modalkeys')){
        let config = vscode.workspace.getConfiguration('modalkeys')
        let matchBackground = config.get<string>('searchMatchBackground');
        let matchBorder = config.get<string>('searchMatchBorder');
        let highlightBackground = config.get<string>('searchOtherMatchesBackground');
        let highlightBorder = config.get<string>('searchOtherMatchesBorder');
        let bookmarkColor = config.get<string>('bookmarkColor')

        searchDecorator = vscode.window.createTextEditorDecorationType({
            backgroundColor: matchBackground ||
                new vscode.ThemeColor('editor.findMatchBackground'),
            borderColor: matchBorder ||
                new vscode.ThemeColor('editor.findMatchBorder'),
            borderStyle: "solid"
        });

        searchOtherDecorator = vscode.window.createTextEditorDecorationType({
            backgroundColor: highlightBackground ||
                new vscode.ThemeColor('editor.findMatchHighlightBackground'),
            borderColor: highlightBorder ||
                new vscode.ThemeColor('editor.findMatchHighlightBorder'),
            borderStyle: "solid"
        });

        bookMarkDecorator = vscode.window.createTextEditorDecorationType({
            backgroundColor: bookmarkColor || "rgba(0,0,150,0.5)",
            isWholeLine: true
        })
    }
}

function positionSearch(sel: vscode.Selection, doc: vscode.TextDocument, len: number, args: SearchArgs){
    let offset = 0;
    let forward = !args.backwards
    if(args.offset === 'exclusive'){
        offset = forward ? -len : len
        if(!args.selectTillMatch) offset += forward ? -1 : 0
    }else if(args.offset === 'start'){
        if(forward){ offset = -len }
    }else if(args.offset === 'end'){
        if(!forward){ offset = len }
    }else{ // args.offset === 'inclusive' (default)
        if(!args.selectTillMatch){
            offset += forward ? -1 : 0
        }
    }

    if(offset !== 0){
        let newpos = wrappedTranslate(sel.active, doc, offset)
        return new vscode.Selection(args.selectTillMatch ? sel.anchor : newpos, newpos)
    }
    return sel
}

/**
 * ### Accepting Search
 *
 * Accepting the search resets the mode variables. Additionally, if
 * `typeAfterAccept` argument is set we run the given normal mode commands.
 */
async function acceptSearch(editor: vscode.TextEditor, state: SearchState) {
    if(state.args.executeAfter){
        let command = expandOneCommand(state.args.executeAfter)
        if(command){
            keyState.execute(command, state.oldMode || Normal, state.string)
        }
    }

    await enterMode(state.oldMode || Normal)
}

/**
 * ### Canceling Search
 *
 * Canceling search just resets state, and moves the cursor back to the starting
 * position.
 */
async function cancelSearch(): Promise<void> {
    let state = searchState(currentSearch)
    if (keyMode == Search) {
        await enterMode(state.oldMode || Normal)
        let editor = vscode.window.activeTextEditor
        if (editor) {
            if(state.startSelections) editor.selections = state.startSelections
            revealActive(editor);
        }
    }
}
/**
 * ### Modifying Search String
 *
 * Since we cannot capture the backspace character in normal mode, we have to
 * hook it some other way. We define a command `modalkeys.deleteCharFromSearch`
 * which deletes the last character from the search string. This command can
 * then be bound to backspace using the standard keybindings. We only run the
 * command, if the `modalkeys.searching` context is set. Below is an excerpt
 * of the default keybindings defined in `package.json`.
 * ```js
 * {
 *    "key": "Backspace",
 *    "command": "modalkeys.deleteCharFromSearch",
 *    "when": "editorTextFocus && modalkeys.searching"
 * }
 * ```
 * Note that we need to also update the status bar to show the modified search
 * string. The `onType` callback that normally handles this is not getting
 * called when this command is invoked.
 */
function deleteCharFromSearch() {
    let editor = vscode.window.activeTextEditor
    let state = searchState(currentSearch)
    let text = (state.string || "")
    if (editor && keyMode === Search && text.length > 0) {
        state.string = text.slice(0, text.length - 1)
        keyState.deleteSearchChar()
        highlightMatches(text, editor, state.startSelections || editor.selections, state)
        updateCursorAndStatusBar(editor)
    }
}

function searchState(register: string | undefined): SearchState{
    let val = register || "default"
    if(!searchStates[val]){
        let state = {args: {}}
        searchStates[val] = state
        return state
    }else{
        return searchStates[val]
    }
}

/**
 * ### Finding Previous and Next Match
 *
 * Using the `highlightMatches` function finding next and previous match is a
 * relatively simple task. We basically just restart the search from
 * the current cursor position(s).
 *
 * We also check whether the search parameters include `typeBeforeNextMatch` or
 * `typeAfterNextMatch` argument. If so, we invoke the user-specified commands
 * before and/or after we jump to the next match.
 */
async function nextMatch(args: {register?: string}): Promise<void> {
    let editor = vscode.window.activeTextEditor
    let state = searchState(args?.register)
    if (editor && state.string) {
        highlightMatches(state.string, editor, editor.selections, state)
        revealActive(editor);
    }
}
/**
 * When finding the previous match we flip the search direction but otherwise do
 * the same routine as in the previous function.
 */
async function previousMatch(args: {register?: string}): Promise<void> {
    let editor = vscode.window.activeTextEditor
    let state = searchState(args?.register)
    if (editor && state.string) {
        state.args.backwards = !state.args.backwards
        highlightMatches(state.string, editor, editor.selections, state)
        revealActive(editor);
        state.args.backwards = !state.args.backwards
    }
}

/**
 * ## Invoking Commands via Key Bindings
 *
 * The last command runs commands for the given mode through their key bindings.
 * Implementing that is as easy as calling the keyboard handler.
 */
async function typeKeys(args: TypeKeysArgs): Promise<void> {
    if (typeof args !== 'object' || typeof (args.keys) !== 'string')
        throw Error(`${typeKeysId}: Invalid args: ${JSON.stringify(args)}`)

    let typeKeyState = new KeyState({}, keyState)
    let newMode = args.mode || Normal
    if(keyMode !== newMode) enterMode(newMode)
    for (let i = 0; i < args.keys.length; i++){
        await runActionForKey(args.keys[i], keyMode, typeKeyState)
    }
}

/**
 * ## Repeat Last Change Command
 *
 * The `repeatLastChange` command runs the key sequence stored in `lastChange`
 * variable. Since the command inevitably causes text in the editor to change
 * (which causes the `textChanged` flag to go high), it has to reset the current
 * key sequence to prevent the `lastChange` variable from being overwritten next
 * time the user presses a key.
 */
async function repeatLastChange(): Promise<void> {
    repeatedSequence = true
    let nestedState = new KeyState({}, keyState)
    if((<KeyCommand>lastSentence.verb?.seq)?.command){
        let call = (<KeyCommand>lastSentence.verb?.seq)
        vscode.commands.executeCommand(call.command, call.args)
    }else if(lastSentence.verb){
        let startMode = keyMode
        let seq = (<string[]>lastSentence.verb?.seq)
        if(keyMode !== lastSentence.verb.mode) enterMode(lastSentence.verb.mode)
        for (let i = 0; i < seq.length; i++){
            await runActionForKey(seq[i], keyMode, nestedState)
            // replaying actions too fast messes up selection
            await new Promise(res => setTimeout(res, replayDelay));
        }
        if(keyMode !== startMode) enterMode(startMode)
    }
}

async function repeatLastUsedSelection(): Promise<void> {
    repeatedSequence = true
    let nestedState = new KeyState({}, keyState)
    if((<KeyCommand>lastSentence.noun?.seq).command){
        let call = (<KeyCommand>lastSentence.noun?.seq)
        vscode.commands.executeCommand(call.command, call.args)
    }else if(lastSentence.noun){
        let startMode = keyMode
        let seq = (<string[]>lastSentence.noun?.seq)
        if(keyMode !== lastSentence.noun.mode) enterMode(lastSentence.noun.mode)
        for (let i = 0; i < seq.length; i++){
            await runActionForKey(seq[i], keyMode, nestedState)
            // replaying actions too fast messes up selection
            await new Promise(res => setTimeout(res, replayDelay));
        }
        if(keyMode !== startMode) enterMode(startMode)
    }
}

// TODO: use the new searchMatch command to perform the select between
/**
 * ## Advanced Selection Command
 *
 * For selecting ranges of text between two characters (inside parenthesis, for
 * example) we add the `modalkeys.selectBetween` command. See the
 * [instructions](../README.html#selecting-text-between-delimiters) for the list
 * of parameters this command provides.
 */
 function selectBetween(args: SelectBetweenArgs) {
    let editor = vscode.window.activeTextEditor
    if (editor){
        let ed = editor
        ed.selections = ed.selections.map((sel: vscode.Selection) => {
            let start = wrappedTranslate(sel.start, ed.document, 1)
            let end = sel.end //.translate(0, -1)
            let fromMatches = searchMatches(ed.document, start, undefined,
                args.from, {...args, backwards: true, wrapAround: false})
            let toMatches = searchMatches(ed.document, end, undefined,
                args.to, {...args, backwards: false, wrapAround: false})
            let from = fromMatches.next()
            let to = toMatches.next()
            let betweenSel = sel
            while(!to.done && !from.done){
                if(args.inclusive){
                    betweenSel = new vscode.Selection(from.value.start, to.value.end)
                }else{
                    betweenSel = new vscode.Selection(from.value.end, to.value.start)
                }

                if(!betweenSel.start.isEqual(sel.start) || !betweenSel.end.isEqual(sel.end)) break

                to = toMatches.next()
                from = fromMatches.next()
            }
            if(to.done || from.done){
                matchStatusText = "Pattern not found"
                return sel
            }else{
                if(sel.isEmpty || !sel.isReversed)
                    return betweenSel
                else
                    return new vscode.Selection(betweenSel.active, betweenSel.anchor)
            }
        })
    }
}

function toggleRecordingMacro(args?: {register: string}){
    if(keyState.isRecording()){
        keyState.saveMacro()
        macroStatusBar.hide()
    }else{
        let register = args?.register || "default"
        keyState.recordMacro(register, keyMode)
        macroStatusBar.text = "$(debug-breakpoint-unverified) Macro: "+register
        macroStatusBar.show()
    }
}

function cancelRecordingMacro(){
    keyState.cancelMacro()
    macroStatusBar.hide()
}

async function replayMacro(args?: {register?: string}): Promise<void> {
    let [nestedState, seq, mode] = 
        keyState.macroReplayState(args?.register || "default")
    if(keyMode !== mode) enterMode(mode)
    for (const item of seq){
        await runActionForKey(item, keyMode, nestedState)
        // replaying actions too fast messes up selection
        await new Promise(res => setTimeout(res, replayDelay));
    }
}

/**
 * ## Use Preset Keybindings
 *
 * This command will overwrite to `keybindings` and `selectbindings` settings
 * with presets. The presets are stored under the subdirectory named `presets`.
 * Command scans the directory and shows all the files in a pick list.
 * Alternatively the user can browse for other file that he/she has anywhere
 * in the file system. If the user selects a file, its contents will replace
 * the key binding in the global `settings.json` file.
 *
 * The presets can be defined as JSON or JavaScript. The code checks the file
 * extension and surrounds JSON with parenthesis. Then it can evaluate the
 * contents of the file as JavaScript. This allows to use non-standard JSON
 * files that include comments. Or, if the user likes to define the whole
 * shebang in code, he/she just has to make sure that the code evaluates to an
 * object that has `keybindings` and/or `selectbindings` properties.
 */
async function importPresets(folder?: string) {
    const browseFolder = "Select preset folder..."
    const builtIn = "Built-in: "
    const user = "User: "
    const browse = "Browse for file..."
    let presetsPath = vscode.extensions.getExtension("haberdashpi.vscode-modal-keys")!
        .extensionPath + "/presets"
    let fs = vscode.workspace.fs
    let presets = (await fs.readDirectory(vscode.Uri.file(presetsPath)))
        .map(t => builtIn+t[0])
    let config = vscode.workspace.getConfiguration("modalkeys")

    let userPresetsPath = folder || 
        config.get<string>("userPresetsFolder")
    if(userPresetsPath){
        let userPresets = (await fs.readDirectory(vscode.Uri.file(userPresetsPath))).
            map(t => user+t[0]).
            filter(x => x.match(/\.(js$)|(jsonc?$)/))
        presets = presets.concat(userPresets)
    }
    presets.push(browseFolder)
    presets.push(browse)
    let choice = await vscode.window.showQuickPick(presets, {
        placeHolder: "Warning: Selecting a preset will override current " +
            "keybindings in global 'settings.json'"
    })
    if (choice) {
        let uri = choice.startsWith(builtIn) ?
            vscode.Uri.file(presetsPath + "/" + choice.slice(builtIn.length)) :
            vscode.Uri.file(userPresetsPath + "/" + choice.slice(user.length))
        if (choice == browseFolder) {
            let userPreset = await vscode.window.showOpenDialog({
                openLabel: "Select Folder",
                canSelectFiles: false,
                canSelectFolders: true,
            })
            if (!userPreset) return
            let dirUri = userPreset[0]
            config.update("userPresetsFolder", dirUri.path, true)
            await importPresets(dirUri.path)
            return 
        }else if(choice == browse){
            let userPreset = await vscode.window.showOpenDialog({
                openLabel: "Import presets",
                filters: { Preset: ["json", "jsonc", "js"], },
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false
            })
            if (!userPreset)
                return
            uri = userPreset[0]
        }
        try {
            let js = new TextDecoder("utf-8").decode(await fs.readFile(uri))
            if (uri.fsPath.match(/jsonc?$/))
                js = `(${js})`
            let preset = (function(): any {
                let old_log = console.log;
                console.log = function(message){
                    actionLog(`Console output: ` + message)
                }
                let preset = eval(js)
                console.log = old_log;
                return preset
            })()
            let config = vscode.workspace.getConfiguration("modalkeys")
            if(!preset.keybindings)
                throw new Error(`Could not find "keybindings" in ${uri}`)
            else
                config.update("keybindings", preset.keybindings, true)
            checkExtensions(preset.extensions)
            if(preset.docColors){
                config.update("docColors", preset.docColors, true)
            }
            vscode.window.showInformationMessage(
                "ModalKeys: Keybindings imported.")
        }
        catch (e) {
            vscode.window.showWarningMessage("ModalKeys: Bindings not imported."+
                `\n ${e}`)
        }
    }
}

function checkExtensions(extension_ids: string[] | undefined){
    if(!extension_ids) return
    for(const id of extension_ids){
        if(!vscode.extensions.getExtension(id)){
            const install = "Install Extension"
            const view = "View Extension"
            vscode.window.showErrorMessage(`The current ModalKeys keybindings
                expected to find an extension (\`${id}\`), but it is not installed.`,view, install).then(sel => {
                    if(sel === view){
                        vscode.commands.executeCommand("workbench.extensions.search", id)
                    }else if(sel === install){
                        vscode.commands.executeCommand("workbench.extensions.installExtension", id)
                    }
                })
        }

    }
}

async function exportPreset(){
    let presetsPath = vscode.extensions.getExtension("haberdashpi.vscode-modal-keys")!
        .extensionPath + "/presets"
    let fs = vscode.workspace.fs
    let presets = ((await fs.readDirectory(vscode.Uri.file(presetsPath))).
        map(t => t[0]))
    let choice = await vscode.window.showQuickPick(presets).then(item => {
        if(item){
            let storePreset = vscode.window.showSaveDialog({
                saveLabel: "Export",
                title: "Export preset keybinding"+item
            }).then(tofile => {
                if(tofile){
                    let from = vscode.Uri.joinPath(vscode.Uri.file(presetsPath), item);
                    fs.copy(from, tofile)
                }
            })
        }
    })
}