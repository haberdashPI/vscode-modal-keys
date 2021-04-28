/**
 * # Commands and State
 *
 * This module implements the new commands provided by ModalKeys. It also stores
 * the extension state; which mode we are in, search parameters, bookmarks,
 * quick snippets, etc.
 */
//#region -c commands.ts imports
import * as vscode from 'vscode'
import { KeyState, getSearchStyles, getInsertStyles, getNormalStyles, getSelectStyles } from './actions'
import { TextDecoder } from 'util'
import { IHash } from './util'
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
    typeAfterAccept?: string
    typeBeforeNextMatch?: string
    typeAfterNextMatch?: string
    typeBeforePreviousMatch?: string
    typeAfterPreviousMatch?: string
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
const Visual = 'visual'
const Normal = 'normal'
const Search = 'search'
const Insert = 'insert'

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
/**
 * Search text decoration (to highlight the current and any other visible matches)
 */
let searchDecorator: vscode.TextEditorDecorationType;
let searchOtherDecorator: vscode.TextEditorDecorationType;

/**
 * Current search parameters.
 */
let searchBackwards = false
let searchCaseSensitive = false
let searchWrapAround = false
let searchAcceptAfter = Number.POSITIVE_INFINITY
let searchSelectTillMatch = false
let searchTypeAfterAccept: string | undefined
let searchTypeBeforeNextMatch: string | undefined
let searchTypeAfterNextMatch: string | undefined
let searchTypeBeforePreviousMatch: string | undefined
let searchTypeAfterPreviousMatch: string | undefined
let searchOldMode = Normal
/**
 * Bookmarks are stored here.
 */
let bookmarks: { [label: string]: Bookmark } = {}
/**
 * Quick snippets are simply stored in an array of strings.
 */
let quickSnippets: string[] = []
/**
 * "Repeat last change" command needs to know when text in editor has changed.
 * It also needs to save the current and last command key sequence, as well as
 * the last sequence that caused text to change.
 */
let textChanged = false
let selectionChanged = true
let lastSelection: string[] = []
let lastUsedSelection: string[] = []
let repeatedSequence = false
let currentKeySequence: string[] = []
let lastKeySequence: string[] = []
let lastChange: string[] = []
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
const defineBookmarkId = "modalkeys.defineBookmark"
const goToBookmarkId = "modalkeys.goToBookmark"
const showBookmarksId = "modalkeys.showBookmarks"
const fillSnippetArgsId = "modalkeys.fillSnippetArgs"
const defineQuickSnippetId = "modalkeys.defineQuickSnippet"
const insertQuickSnippetId = "modalkeys.insertQuickSnippet"
const typeKeysId = "modalkeys.typeKeys"
const selectBetweenId = "modalkeys.selectBetween"
const repeatLastChangeId = "modalkeys.repeatLastChange"
const repeatLastUsedSelectionId = "modalkeys.repeatLastUsedSelection"
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
        vscode.commands.registerCommand(defineBookmarkId, defineBookmark),
        vscode.commands.registerCommand(goToBookmarkId, goToBookmark),
        vscode.commands.registerCommand(showBookmarksId, showBookmarks),
        vscode.commands.registerCommand(fillSnippetArgsId, fillSnippetArgs),
        vscode.commands.registerCommand(defineQuickSnippetId, defineQuickSnippet),
        vscode.commands.registerCommand(insertQuickSnippetId, insertQuickSnippet),
        vscode.commands.registerCommand(typeKeysId, typeKeys),
        vscode.commands.registerCommand(selectBetweenId, selectBetween),
        vscode.commands.registerCommand(repeatLastChangeId, repeatLastChange),
        vscode.commands.registerCommand(repeatLastUsedSelectionId, repeatLastUsedSelection),
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

let keyState = new KeyState([searchId])

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
        if (textChanged) {
            lastChange = lastKeySequence
            lastUsedSelection = lastSelection
            textChanged = false
        }
        if(selectionChanged){
            lastSelection = lastKeySequence
            selectionChanged = false
        }
    }else{
        repeatedSequence = false
        selectionChanged = false
        textChanged = false
    }

    currentKeySequence.push(event.text)
    if (await runActionForKey(event.text, keyMode)) {
        lastKeySequence = currentKeySequence
        currentKeySequence = []
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

export function onSelectionChanged(){
    if(!textChanged) selectionChanged = true;
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
    return state.waitingForKey()
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
    select: {
        exit: async (n: string, o: string) =>
            await vscode.commands.executeCommand("cancelSelection")
    },
    normal: {
        enter: async (n: string, o: string) => keyState.reset()
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
    const exitHook = modeHooks[keyMode]?.modeHooks?.exit
    exitHook && await exitHook(keyMode, newMode)

    const editor = vscode.window.activeTextEditor
    let oldMode = keyMode
    keyMode = newMode
    if(editor?.document.uri) editorModes[editor?.document.uri.toString()] = newMode
    if (editor) {
        await vscode.commands.executeCommand("setContext", "modalkeys.mode", keyMode)
        updateCursorAndStatusBar(editor)
    }
    const enterHook = modeHooks[keyMode]?.modeHooks?.enter
    enterHook && await enterHook(oldMode, keyMode)
}

function reviseSelectionMode(){
    if(isSelecting() && keyMode === Normal){
        keyMode = Visual
        const editor = vscode.window.activeTextEditor
        if(editor?.document.uri) editorModes[editor?.document.uri.toString()] = Visual
    }
}

export async function restoreEditorMode(editor: vscode.TextEditor | undefined){
    if(editor){
        let newMode = editorModes[editor.document.uri.toString()] || Normal
        handleTypeSubscription(newMode)
        keyMode = newMode
        await vscode.commands.executeCommand("setContext", "modalkeys.mode", keyMode)
        updateCursorAndStatusBar(editor)
        const enterHook = modeHooks[keyMode]?.modeHooks?.enter
        enterHook && await enterHook(Normal, keyMode)
    }
}

/**
 * This function updates the cursor shape and status bar according to editor
 * state. It indicates when selection is active or search mode is on. If
 * so, it shows the search parameters. If no editor is active, we hide the
 * status bar items.
 */
export function updateCursorAndStatusBar(editor: vscode.TextEditor | undefined,
    help?: string) {
    if (editor) {
        // Get the style parameters
        reviseSelectionMode()
        let [style, text, color] =
            keyMode === Search ? getSearchStyles() :
            keyMode === Visual ? getSelectStyles() :
            keyMode === Insert ? getInsertStyles() :
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
        let sec = "    " + currentKeySequence.join("")
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
    if (keyMode === Visual) {
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
    if(keyMode !== Visual){
        enterMode(Visual)
    }else{
        enterMode(Normal)
    }
}
/**
 * `modalkeys.enableSelection` sets the selecting to true.
 */
function enableSelection() {
    enterMode(Visual)
    updateCursorAndStatusBar(vscode.window.activeTextEditor)
}
/**
 * The following helper function actually determines, if a selection is active.
 * It checks not only the `selecting` flag but also if there is any text
 * selected in the active editor.
 */
function isSelecting(): boolean {
    return keyMode === Visual ||
        vscode.window.activeTextEditor!.selections.some(
            selection => !selection.anchor.isEqual(selection.active))
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
        keyState.captureFor(searchId)
        enterMode(Search)
        searchString = ""
        searchStartSelections = editor.selections
        searchBackwards = args.backwards || false
        searchCaseSensitive = args.caseSensitive || false
        searchWrapAround = args.wrapAround || false
        searchAcceptAfter = args.acceptAfter || Number.POSITIVE_INFINITY
        searchSelectTillMatch = args.selectTillMatch || false
        searchTypeAfterAccept = args.typeAfterAccept
        searchTypeBeforeNextMatch = args.typeBeforeNextMatch
        searchTypeAfterNextMatch = args.typeAfterNextMatch
        searchTypeBeforePreviousMatch = args.typeBeforePreviousMatch
        searchTypeAfterPreviousMatch = args.typeAfterPreviousMatch
    }
    else if (args == "\n")
        /**
         * If we get an enter character we accept the search.
         */
        await acceptSearch()
    else {
        /**
         * Otherwise we just add the character to the search string and find
         * the next match. If `acceptAfter` argument is given, and we have a
         * sufficiently long search string, we accept the search automatically.
         */
        searchString += args
        highlightMatches(editor, searchStartSelections)
        if (searchString.length >= searchAcceptAfter)
            await acceptSearch()
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
        let docText = searchCaseSensitive ?
            doc.getText() : doc.getText().toLowerCase()
        /**
         * Next we determine the search target. It is also transformed to
         * lower case, if search is case-insensitive.
         */
        let target = searchCaseSensitive ?
            searchString : searchString.toLowerCase()
        /**
         * searchRanges keeps track of where the searches land
         * (so we can highlight them later on)
         */
        let searchRanges: vscode.Range[] = [];

        editor.selections = selections.map(sel => {
            /**
             * This is the actual search that is performed for each cursor
             * position. The lambda function returns a new selection for each
             * active cursor.
             */
            let startOffs = doc.offsetAt(sel.active)
            /**
             * Depending on the search direction we find either the
             * first or the last match from the start offset.
             */
            let offs = searchBackwards ?
                docText.lastIndexOf(target, startOffs - 1) :
                docText.indexOf(target, startOffs)
            if (offs < 0) {
                if (searchWrapAround)
                    /**
                     * If search string was not found but `wrapAround` argument
                     * was set, we try to find the search string from beginning
                     * or end of the document. If that fails too, we return
                     * the original selection and the cursor will not move.
                     */
                    offs = searchBackwards ?
                        docText.lastIndexOf(target) :
                        docText.indexOf(target)
                if (offs < 0) {
                    searchInfo = "Pattern not found"
                    return sel
                }
                let limit = (bw: boolean) => bw ? "TOP" : "BOTTOM"
                searchInfo =
                    `Search hit ${limit(searchBackwards)} continuing at ${
                    limit(!searchBackwards)}`
            }
            /**
             * If search was successful, we return a new selection to highlight
             * it. First, we find the start and end position of the match.
             */
            let len = searchString.length
            let start = doc.positionAt(offs)
            let end = doc.positionAt(offs + len)

            /**
             * We save the start and end positions, so that search decorators
             * can be appropriately colored (later on)
             */
            searchRanges.push(new vscode.Range(start, end))

            /**
             * If the search direction is backwards, we flip the active and
             * anchor positions. Normally, the anchor is set to the start and
             * cursor to the end. Finally, we check if the `selectTillMatch`
             * argument is set. If so, we move only the active cursor position
             * and leave the selection start (anchor) as-is.
             */
            let [active, anchor] = searchBackwards ?
                [start, end] :
                [end, start]
            if (searchSelectTillMatch)
                anchor = sel.anchor
            return new vscode.Selection(anchor, active)
        })

        editor.revealRange(editor.selection)

        /**
         * Finally, we highlight all search matches to make them stand out
         * in the document.
         */

        let searchOtherRanges: vscode.Range[] = [];
        function selectionMatchRange(x: vscode.Selection, range: vscode.Range){
            return x.start.isEqual(range.start) && x.end.isEqual(range.end);
        }

        /**
         * To accomplish this, we look for any matches that are currently
         * visible and mark them; we want to mark those that aren't
         * a "current" match (found above) differently so we make
         * sure that they are not part of `searchRanges`
         */
        editor.visibleRanges.forEach(range => {
            let text = searchCaseSensitive ? doc.getText(range) :
                doc.getText(range).toLowerCase();
            let baseOffset = doc.offsetAt(range.start);
            let offset = text.indexOf(target);

            while(offset > 0){
                let start = doc.positionAt(offset + baseOffset);
                let range = new vscode.Range(start, start.translate(0,target.length));
                if(!searchRanges.find(x =>
                    x.start.isEqual(range.start) && x.end.isEqual(range.end))){
                    searchOtherRanges.push(range);
                }

                offset = text.indexOf(target,offset+1);
            }
        });

        /**
         * Now, we have the search ranges; so highlight them appropriately
         */
        editor.setDecorations(searchDecorator, searchRanges);
        editor.setDecorations(searchOtherDecorator, searchOtherRanges);
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
    }
}

/**
 * ### Accepting Search
 *
 * Accepting the search resets the mode variables. Additionally, if
 * `typeAfterAccept` argument is set we run the given normal mode commands.
 */
async function acceptSearch() {
    let mode = searchOldMode
    await enterMode(mode)
    if (searchTypeAfterAccept)
        await typeKeys({ keys: searchTypeAfterAccept, mode: mode })
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
        if (searchTypeBeforeNextMatch)
            await typeKeys({ keys: searchTypeBeforeNextMatch })
        highlightMatches(editor, editor.selections)
        if (searchTypeAfterNextMatch)
            await typeKeys({ keys: searchTypeAfterNextMatch })
    }
}
/**
 * When finding the previous match we flip the search direction but otherwise do
 * the same routine as in the previous function.
 */
async function previousMatch(): Promise<void> {
    let editor = vscode.window.activeTextEditor
    if (editor && searchString) {
        if (searchTypeBeforePreviousMatch)
            await typeKeys({ keys: searchTypeBeforePreviousMatch })
        searchBackwards = !searchBackwards
        highlightMatches(editor, editor.selections)
        searchBackwards = !searchBackwards
        if (searchTypeAfterPreviousMatch)
            await typeKeys({ keys: searchTypeAfterPreviousMatch })
    }
}
/**
 * ## Bookmarks
 *
 * Defining a bookmark is simple. We just store the cursor location and file in
 * a `Bookmark` object, and store it in the `bookmarks` array.
 */
function defineBookmark(args?: BookmarkArgs) {
    let editor = vscode.window.activeTextEditor
    if (editor) {
        let label = args?.bookmark?.toString() || '0'
        let document = editor.document
        let position = editor.selection.active
        bookmarks[label] = new Bookmark(label, document, position)
    }
}
/**
 * Jumping to bookmark is also easy, just call the `changeSelection` function
 * we already defined. It makes sure that selection is visible.
 */
async function goToBookmark(args?: BookmarkArgs): Promise<void> {
    let label = args?.bookmark?.toString() || '0'
    let bm = bookmarks[label]
    if (bm) {
        await vscode.window.showTextDocument(bm.document)
        let editor = vscode.window.activeTextEditor
        if (editor) {
            if (args?.select)
                changeSelection(editor, editor.selection.anchor, bm.position)
            else
                changeSelection(editor, bm.position, bm.position)
        }
    }
}
/**
 * To show the list of bookmarks in the command menu, we provide a new command.
 */
async function showBookmarks(): Promise<void> {
    let items = Object.getOwnPropertyNames(bookmarks).map(name => bookmarks[name])
    let selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Visual bookmark to jump to",
        matchOnDescription: true
    })
    if (selected)
        await goToBookmark({ bookmark: selected.label })
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
 * ## Quick Snippets
 *
 * Supporting quick snippets is also a pleasantly simple job. First we implement
 * the `modalkeys.fillSnippetArgs` command, which replaces (multi-)selection
 * ranges with `$1`, `$2`, ...
 */
async function fillSnippetArgs(): Promise<void> {
    let editor = vscode.window.activeTextEditor
    if (editor) {
        let sel = editor.selections
        await editor.edit(eb => {
            for (let i = 0; i < sel.length; i++)
                eb.replace(sel[i], "$" + (i + 1))
        })
    }
}
/**
 * Defining a snippet just puts the selection into an array.
 */
function defineQuickSnippet(args?: QuickSnippetArgs) {
    let editor = vscode.window.activeTextEditor
    if (editor)
        quickSnippets[args?.snippet || 0] =
            editor.document.getText(editor.selection)
}
/**
 * Inserting a snippet is done as easily with the built-in command. We enter
 * insert mode automatically before snippet is expanded.
 */
async function insertQuickSnippet(args?: QuickSnippetArgs): Promise<void> {
    let i = args?.snippet || 0
    let snippet = quickSnippets[i]
    if (snippet) {
        enterMode(Insert)
        await vscode.commands.executeCommand("editor.action.insertSnippet",
            { snippet })
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

    for (let i = 0; i < args.keys.length; i++)
        await runActionForKey(args.keys[i], args.mode || Normal, )
}
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
    if (!editor)
        return
    if (typeof args !== 'object')
        throw Error(`${selectBetweenId}: Invalid args: ${JSON.stringify(args)}`)
    let doc = editor.document
    /**
     * Get position of cursor and anchor. These positions might be in "reverse"
     * order (cursor lies before anchor), so we need to sort them into `lowPos`
     * and `highPos` variables and corresponding offset variables. These are
     * used to determine the search range later on.
     *
     * Since `to` or `from` parameter might be missing, we initialize the
     * `fromOffs` and `toOffs` variables to low and high offsets. They delimit
     * the range to be selected at the end.
     */
    let cursorPos = editor.selection.active
    let anchorPos = editor.selection.anchor
    let [highPos, lowPos] = cursorPos.isAfterOrEqual(anchorPos) ?
        [cursorPos, anchorPos] : [anchorPos, cursorPos]
    let highOffs = doc.offsetAt(highPos)
    let lowOffs = doc.offsetAt(lowPos)
    let fromOffs = lowOffs
    let toOffs = highOffs
    /**
     * Next we determine the search range. The `startOffs` marks the starting
     * offset and `endOffs` the end. Depending on the specified scope these
     * variables are either set to start/end of the current line or the whole
     * document.
     *
     * In the actual search, we have two main branches: one for the case when
     * regex search is used and another for the normal text search.
     */
    let startPos = new vscode.Position(args.docScope ? 0 : lowPos.line, 0)
    let endPos = doc.lineAt(args.docScope ? doc.lineCount - 1 : highPos.line)
        .range.end
    let startOffs = doc.offsetAt(startPos)
    let endOffs = doc.offsetAt(endPos)
    if (args.regex) {
        if (args.from) {
            /**
             * This branch searches for regex in the `from` parameter starting
             * from `startPos` continuing until `lowPos`. We need to find the
             * last occurrence of the regex, so we have to add a global modifier
             * `g` and iterate through all the matches. In case there are no
             * matches `fromOffs` gets the same offset as `startOffs` meaning
             * that the selection will extend to the start of the search scope.
             */
            fromOffs = startOffs
            let text = doc.getText(new vscode.Range(startPos, lowPos))
            let re = new RegExp(args.from, args.caseSensitive ? "g" : "gi")
            let match: RegExpExecArray | null = null
            while ((match = re.exec(text)) != null)
                fromOffs = startOffs + match.index +
                    (args.inclusive ? 0 : match[0].length)
        }
        if (args.to) {
            /**
             * This block finds the regex in the `to` parameter starting from
             * the range `[highPos, endPos]`. Since we want to find the first
             * occurrence, we don't need to iterate over the matches in this
             * case.
             */
            toOffs = endOffs
            let text = doc.getText(new vscode.Range(highPos, endPos))
            let re = new RegExp(args.to, args.caseSensitive ? undefined : "i")
            let match = re.exec(text)
            if (match)
                toOffs = highOffs + match.index +
                    (args.inclusive ? match[0].length : 0)
        }
    }
    else {
        /**
         * This branch does the regular text search. We retrieve the whole
         * search range as string and use `indexOf` and `lastIndexOf` methods
         * to find the strings in `to` and `from` parameters. Case insensitivity
         * is done by converting both the search range and search string to
         * lowercase.
         */
        let text = doc.getText(new vscode.Range(startPos, endPos))
        if (!args.caseSensitive)
            text = text.toLowerCase()
        if (args.from) {
            fromOffs = text.lastIndexOf(args.caseSensitive ?
                args.from : args.from.toLowerCase(), lowOffs - startOffs)
            fromOffs = fromOffs < 0 ? startOffs :
                startOffs + fromOffs + (args.inclusive ? 0 : args.from.length)
        }
        if (args.to) {
            toOffs = text.indexOf(args.caseSensitive ?
                args.to : args.to.toLowerCase(), highOffs - startOffs)
            toOffs = toOffs < 0 ? endOffs :
                startOffs + toOffs + (args.inclusive ? args.to.length : 0)
        }
    }
    if (cursorPos.isAfterOrEqual(anchorPos))
        /**
         * The last thing to do is to select the range from `fromOffs` to
         * `toOffs`. We want to preserve the direction of the selection. If
         * it was reserved when this command was called, we flip the variables.
         */
        changeSelection(editor, doc.positionAt(fromOffs), doc.positionAt(toOffs))
    else
        changeSelection(editor, doc.positionAt(toOffs), doc.positionAt(fromOffs))
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
    for (let i = 0; i < lastChange.length; i++)
        await runActionForKey(lastChange[i])
    currentKeySequence = lastChange
}

async function repeatLastUsedSelection(): Promise<void> {
    repeatedSequence = true
    for(let i = 0; i < lastUsedSelection.length; i++){
        await runActionForKey(lastUsedSelection[i])
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