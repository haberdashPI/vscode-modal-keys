/**
 * # Commands and State
 *
 * This module implements the new commands provided by ModalKeys. It also stores
 * the extension state; which mode we are in, search parameters, bookmarks,
 * quick snippets, etc.
 */
//#region -c commands.ts imports
import * as vscode from 'vscode'
import { KeyState, getSearchStyles, getInsertStyles, getNormalStyles, getSelectStyles, Command } from './actions'
import { TextDecoder } from 'util'
import { IHash } from './util'
import { markAsUntransferable } from 'node:worker_threads'
import { executionAsyncResource } from 'node:async_hooks'
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
 * This is the main mode flag that tells if we are in normal mode, insert mode,
 * select mode, searching mode or some user defined mode
 */
let keyMode = Normal
let editorModes: IHash<string> = {}
/**
 * Search state variables.
 */
let searchString: string
let searchStartSelections: vscode.Selection[]
let searchInfo: string | null = null
let searchChanged: boolean = false;
let searchLength: number = 0
/**
 * Search text decoration (to highlight the current and any other visible matches)
 */
let searchDecorator: vscode.TextEditorDecorationType;
let searchOtherDecorator: vscode.TextEditorDecorationType;

let bookMarkDecorator: vscode.TextEditorDecorationType;

/**
 * Current search parameters.
 */
let searchBackwards = false
let searchCaseSensitive = false
let searchWrapAround = false
let searchAcceptAfter = Number.POSITIVE_INFINITY
let searchSelectTillMatch = false
let searchOffset: string
let searchOldMode = Normal
let searchAtStart: boolean
let searchExecuteAfter: Command | undefined
let searchRegex: boolean
let searchHighlightMatches: boolean
let searchMatchLength: number = 0
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
const touchDocumentId = 'modalkeys.touchDocument'
const untouchDocumentId = 'modalkeys.untouchDocument'
const importPresetsId = "modalkeys.importPresets"
/**
 * ## Registering Commands
 *
 * The commands are registered when the extension is activated (main entry point
 * calls this function). We also create the status bar item and text
 * decorations.
 */
export function register(context: vscode.ExtensionContext) {
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
        vscode.commands.registerCommand(touchDocumentId, touchDocument),
        vscode.commands.registerCommand(untouchDocumentId, untouchDocument),
        vscode.commands.registerCommand(importPresetsId, importPresets)
    )
    mainStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left)
    mainStatusBar.command = toggleId
    secondaryStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left)

    updateSearchHighlights();
    vscode.workspace.onDidChangeConfiguration(updateSearchHighlights);
}

let keyState = new KeyState({[Search]: searchId})

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
let lastWord: KeyWord = { seq: [], mode: '' }
let currentWord: KeyWord = { seq: [], mode: '' }

function addKey(word: KeyWord, key: string, mode: string){
    if((<KeyCommand>word.seq).command){
        throw Error(`Expected key sequence, got a command`)
    }else{
        let seq = (<string[]>word.seq)

        if(seq.length === 0) word.mode = mode
        seq.push(key)
    }
}

function keySeq(word: KeyWord){
    if((<KeyCommand>word.seq).command){
        return ""
    }else{
        return (<string[]>word.seq).join("")
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
            lastSentence = { ...pendingSentence, verb: lastWord }
            pendingSentence = { noun: {
                seq: { command: cancelMultipleSelectionsId },
                mode: '' }
            }
            textChanged = false
        }
        if(selectionChanged && !ignoreChangedText){
            pendingSentence = {
                noun: selectionUsed ? lastWord : {
                    seq: { command: cancelMultipleSelectionsId },
                    mode: lastWord.mode
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

    addKey(currentWord, event.text, keyMode)
    if (await runActionForKey(event.text, keyMode)) {
        lastWord = currentWord
        currentWord = { seq: [], mode: '' }
    }
    updateCursorAndStatusBar(vscode.window.activeTextEditor, keyState.getHelp())
    // clear any search decorators if this key did not alter search state
    // (meaning it was not a search command)
    if(!searchChanged){
        vscode.window.activeTextEditor?.setDecorations(searchDecorator, []);
        vscode.window.activeTextEditor?.setDecorations(searchOtherDecorator, []);
    }
    searchChanged = false;
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
    await state.handleKey(key, isSelecting() && mode === Normal ? Visual : mode)
    return !state.waitingForKey()
}

function handleTypeSubscription(newmode: string){
    if(newmode !== Insert){
        if(!typeSubscription) typeSubscription = vscode.commands.registerCommand("type", onType)
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
    normal: {
        enter: async (n: string, o: string) => {
            currentWord = { seq: [], mode: '' }
            keyState.reset()
        }
    },
    search: {
        enter: async (newmode: string, oldmode: string) => {searchOldMode = oldmode}
    }
}

export async function enterNormal(){ enterMode('normal') }
export async function enterInsert(){ enterMode('insert') }

export async function enterMode(args: string | EnterModeArgs) {
    let newMode = (<string>((<EnterModeArgs>args).mode || args))
    handleTypeSubscription(newMode)
    if(newMode === Visual){
        newMode = Normal
        visualFlag = true
    }else if(newMode !== Visual){ visualFlag = false }
    const exitHook = modeHooks[keyMode]?.exit
    exitHook && await exitHook(newMode, keyMode)

    const editor = vscode.window.activeTextEditor
    let oldMode = keyMode
    keyMode = newMode
    if(editor?.document.uri) editorModes[editor?.document.uri.toString()] = visualFlag ? Visual : newMode
    const enterHook = modeHooks[keyMode]?.enter
    enterHook && newMode !== oldMode && await enterHook(keyMode, oldMode)
    if (editor) {
        updateCursorAndStatusBar(editor)
        await vscode.commands.executeCommand("setContext", "modalkeys.mode", keyMode)
    }
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
        mainStatusBar.text = keyMode === Search ?
            `${text} [${searchBackwards ? "B" : "F"
            }${searchCaseSensitive ? "S" : ""}]: ${searchString}` :
            text
        mainStatusBar.color = color
        mainStatusBar.show()
        /**
         * Update secondary status bar. If there is any keys pressed in the
         * current sequence, we show them. Also possible help string is shown.
         * The info given by search command is shown only as long there are
         * no other messages to show.
         */
        let sec = " " + keySeq(currentWord)
        if (help)
            sec = `${sec}    ${help}`
        if (searchInfo) {
            if (sec.trim() == "")
                sec = searchInfo
            else
                searchInfo = null
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
    if (keyMode === Normal && visualFlag) {
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
/**
 * Function that sets the selecting flag off. This function is called from one
 * event. The flag is resetted when the active editor changes. The function that
 * updates the status bar sets the flag on again, if there are any active
 * selections.
 */
 export function resetSelecting() {
    keyMode = Normal
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
        pos = new vscode.Position(forward ? 0 : doc.lineCount - 1, 0)
        while(forward ? line < doc.lineCount : line > doc.lineCount){
            yield [doc.lineAt(line).text, line]
            line += (forward ? 1 : -1)
        }
    }
}
function* searchMatches(doc: vscode.TextDocument, start: vscode.Position, end: vscode.Position | undefined,
    target: string, regex: boolean, matchCase: boolean, forward: boolean, wrap: boolean){

    let matchesFn: (line: string, offset: number | undefined) => Generator<[number, number]>
    if(regex){
        let matcher = RegExp(target, "g" + (!matchCase ? "i" : ""))
        matchesFn = (line, offset) => regexMatches(matcher, line, forward, offset)
    }else{
        let matcher = matchCase ? target : target.toLowerCase()
        matchesFn = (line, offset) => stringMatches(matcher, matchCase, line, forward, offset)
    }

    let offset: number | undefined = start.character
    for(const [line, i] of linesOf(doc, start, wrap, forward)){
        if(end && i > end.line){ return }

        let matchesItr = matchesFn(line, offset)
        let matches = forward ? matchesItr : Array.from(matchesItr).reverse()

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
        match = matcher.exec(line)
    }
}

function* stringMatches(matcher: string, matchCase: boolean, line: string, forward: boolean, offset: number | undefined): Generator<[number, number]>{
    let searchme = offset === undefined ? line :
        (forward ? line.substring(offset) : line.substring(0, offset - 1))
    let fromOffset = offset === undefined ? 0 : (forward ? offset : 0)
    if(!matchCase) searchme.toLowerCase()
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
        searchString = args.text || ""
        searchStartSelections = editor.selections
        searchBackwards = args.backwards || false
        searchCaseSensitive = args.caseSensitive || false
        searchWrapAround = args.wrapAround || false
        searchAcceptAfter = args.acceptAfter || Number.POSITIVE_INFINITY
        searchSelectTillMatch = args.selectTillMatch || false
        searchOffset = args.offset || 'inclusive'
        searchExecuteAfter = args.executeAfter
        searchRegex = args.regex || false
        searchHighlightMatches = args.highlightMatches === undefined ? true : args.highlightMatches

        /**
         * If we've been passed text to search as part of the command, immediately find
         * and accept the matches
         */
        if(searchString.length > 0){
            highlightMatches(editor, searchStartSelections)
            await acceptSearch(editor, searchMatchLength)
        }
    }
    else if (args == "\n")
        /**
         * If we get an enter character we accept the search.
         */
        await acceptSearch(editor, searchMatchLength)
    else {
        /**
         * Otherwise we just add the character to the search string and find
         * the next match. If `acceptAfter` argument is given, and we have a
         * sufficiently long search string, we accept the search automatically.
         */
        searchString += args
        highlightMatches(editor, searchStartSelections)
        if (searchString.length >= searchAcceptAfter)
            await acceptSearch(editor, searchMatchLength)
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
function highlightMatches(editor: vscode.TextEditor,
    selections: vscode.Selection[]) {
    searchInfo = null
    if (searchString == ""){
        /**
         * If search string is empty, we return to the start positions.
         * (cleaering the deceorators)
         */
        editor.selections = searchStartSelections
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
            let matches = searchMatches(doc, sel.active, undefined, searchString,
                searchRegex, searchCaseSensitive, !searchBackwards, searchWrapAround)
            let result = matches.next()
            if(result.done){
                searchInfo = "Pattern not found"
                return sel
            }else{
                searchRanges.push(result.value)

                let [active, anchor] = searchBackwards ?
                    [result.value.start, result.value.end] :
                    [result.value.end, result.value.start]
                if (searchSelectTillMatch)
                    anchor = sel.anchor
                searchMatchLength = result.value.end.character - result.value.start.character
                return new vscode.Selection(anchor, active)
            }
        })

        editor.revealRange(editor.selection)

        /**
         * Finally, we highlight all search matches to make them stand out in the document.
         * To accomplish this, we look for any matches that are currently visible and mark
         * them; we want to mark those that aren't a "current" match (found above)
         * differently so we make sure that they are not part of `searchRanges`
         */
         if(searchHighlightMatches){
            let searchOtherRanges: vscode.Range[] = [];
            editor.visibleRanges.forEach(range => {
                let matches = searchMatches(doc, range.start, range.end, searchString,
                    searchRegex, searchCaseSensitive, true, searchWrapAround)
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
        searchChanged = true;
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

async function unpositionSearch(editor: vscode.TextEditor, forward: boolean){
    let offset = searchAtStart === forward ? (forward ? searchLength : -searchLength) : 0

    if(offset !== 0){
        editor.selections = editor.selections.map(x => {
            let newpos = x.active.translate(0, offset)
            return new vscode.Selection(searchSelectTillMatch ? x.anchor : newpos, newpos)
        })
    }
}

async function positionSearch(editor: vscode.TextEditor, len: number, forward: boolean){
    let offset = 0;
    if(searchOffset === 'exclusive'){
        offset = forward ? -len : len
        searchAtStart = forward
    }else if(searchOffset === 'start'){
        if(forward){ offset = -len }
        searchAtStart = true
    }else if(searchOffset === 'end'){
        if(!forward){ offset = len }
        searchAtStart = false
    }else if(searchOffset !== 'inclusive'){
        vscode.window.showErrorMessage(`Unexpected search offset "${searchOffset}"`)
    }else{
        searchAtStart = !forward
    }

    if(offset !== 0){
        editor.selections = editor.selections.map(x => {
            let newpos = x.active.translate(0, offset)
            return new vscode.Selection(searchSelectTillMatch ? x.anchor : newpos, newpos)
        })
    }
}

/**
 * ### Accepting Search
 *
 * Accepting the search resets the mode variables. Additionally, if
 * `typeAfterAccept` argument is set we run the given normal mode commands.
 */
async function acceptSearch(editor: vscode.TextEditor, len: number) {
    let mode = searchOldMode
    await enterMode(mode)
    searchLength = len
    positionSearch(editor, len, !searchBackwards)
    if(searchExecuteAfter){
        keyState.execute(searchExecuteAfter, Normal)
    }
}

/**
 * ### Canceling Search
 *
 * Canceling search just resets state, and moves the cursor back to the starting
 * position.
 */
async function cancelSearch(): Promise<void> {
    if (keyMode == Search) {
        await enterMode(searchOldMode)
        let editor = vscode.window.activeTextEditor
        if (editor) {
            editor.selections = searchStartSelections
            editor.revealRange(editor.selection)
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
    if (editor && keyMode === Search && searchString.length > 0) {
        searchString = searchString.slice(0, searchString.length - 1)
        highlightMatches(editor, searchStartSelections)
        updateCursorAndStatusBar(editor)
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
async function nextMatch(): Promise<void> {
    let editor = vscode.window.activeTextEditor
    if (editor && searchString) {
        unpositionSearch(editor, !searchBackwards)
        highlightMatches(editor, editor.selections)
        positionSearch(editor, searchLength, !searchBackwards)
        editor.revealRange(editor.selection)
    }
}
/**
 * When finding the previous match we flip the search direction but otherwise do
 * the same routine as in the previous function.
 */
async function previousMatch(): Promise<void> {
    let editor = vscode.window.activeTextEditor
    if (editor && searchString) {
        searchBackwards = !searchBackwards
        unpositionSearch(editor, !searchBackwards)
        highlightMatches(editor, editor.selections)
        positionSearch(editor, searchLength, !searchBackwards)
        editor.revealRange(editor.selection)
        searchBackwards = !searchBackwards
    }
}

/**
 * This helper function changes the selection range in the active editor. It
 * also makes sure that the selection is visible.
 */
function changeSelection(editor: vscode.TextEditor, anchor: vscode.Position,
    active: vscode.Position) {
    editor.selection = new vscode.Selection(anchor, active)
    editor.revealRange(editor.selection)
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
    let startMode = keyMode
    let newMode = args.mode || Normal
    if(keyMode !== newMode) enterMode(newMode)
    for (let i = 0; i < args.keys.length; i++){
        await runActionForKey(args.keys[i], newMode, typeKeyState)
    }
    if(keyMode !== startMode) enterMode(startMode)
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
        for (let i = 0; i < seq.length; i++)
            await runActionForKey(seq[i], lastSentence.verb.mode, nestedState)
        currentWord = lastWord
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
        for (let i = 0; i < seq.length; i++)
            await runActionForKey(seq[i], lastSentence.noun.mode, nestedState)
        currentWord = lastWord
        if(keyMode !== startMode) enterMode(startMode)
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
async function importPresets() {
    const browse = "Browse..."
    let presetsPath = vscode.extensions.getExtension("haberdashpi.vscode-modal-keys")!
        .extensionPath + "/presets"
    let fs = vscode.workspace.fs
    let presets = (await fs.readDirectory(vscode.Uri.file(presetsPath)))
        .map(t => t[0])
    presets.push(browse)
    let choice = await vscode.window.showQuickPick(presets, {
        placeHolder: "Warning: Selecting a preset will override current " +
            "keybindings in global 'settings.json'"
    })
    if (choice) {
        let uri = vscode.Uri.file(presetsPath + "/" + choice)
        if (choice == browse) {
            let userPreset = await vscode.window.showOpenDialog({
                openLabel: "Import presets",
                filters: {
                    JavaScript: ["js"],
                    JSON: ["json", "jsonc"],
                },
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
            let preset = eval(js)
            let config = vscode.workspace.getConfiguration("modalkeys")
            if (!preset.keybindings)
                throw new Error(
                    `Could not find "keybindings" or "selectbindings" in ${uri}`)
            if (preset.keybindings)
                config.update("keybindings", preset.keybindings, true)
            vscode.window.showInformationMessage(
                "ModalKeys: Keybindings imported.")
        }
        catch (e) {
            vscode.window.showWarningMessage("ModalKeys: Bindings not imported.",
                `${e}`)
        }
    }
}