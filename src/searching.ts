import * as vscode from 'vscode';
import z from 'zod';
import { validateInput } from './utils';

export const searchArgs = z.object({
    backwards: z.boolean().optional(),
    caseSensitive: z.boolean().optional(),
    wrapAround: z.boolean().optional(),
    acceptAfter: z.number().optional(),
    selectTillMatch: z.number().optional(),
    highlightMatches: z.boolean().optional(),
    offset: z.enum(["inclusive", "exclusive"]).default("exclusive"),
    text: z.string().min(1),
    regex: z.boolean().optional(),
    register: z.string().default("default")
});
export type SearchArgs = z.infer<typeof searchArgs>;

export function* searchMatches(doc: vscode.TextDocument, start: vscode.Position, 
    end: vscode.Position | undefined, target: string, args_: unknown) {
    let parsedArgs = validateInput('modalkeys.search', args_, searchArgs);
    if(!parsedArgs){ return; }
    let args = parsedArgs!;

    let matchesFn: (line: string, offset: number | undefined) => Generator<[number, number]>;
    if (args.regex) {
        let matcher = RegExp(target, "g" + (!args.caseSensitive ? "" : "i"));
        matchesFn = (line, offset) => regexMatches(matcher, line, !args.backwards, offset);
    } else {
        let matcher = !args.caseSensitive ? target : target.toLowerCase();
        matchesFn = (line, offset) => stringMatches(matcher, !args.caseSensitive, line,
            !args.backwards, offset);
    }

    let offset: number | undefined = start.character;
    for (const [line, i] of linesOf(doc, start, args.wrapAround || false, !args.backwards)) {
        if (end && i > end.line) { return; }

        let matchesItr = matchesFn(line, offset);
        let matches = !args.backwards ? matchesItr : Array.from(matchesItr).reverse();

        yield* mapIter(matches, ([start, len]) => new vscode.Range(
            new vscode.Position(i, start),
            new vscode.Position(i, start + len)
        ));
        offset = undefined;
    }
}

function* mapIter<T, R>(iter: Iterable<T>, fn: (x: T) => R){
    for(const x of iter){
        yield fn(x);
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
            yield [doc.lineAt(line).text, line];
            line += (forward ? 1 : -1);
        }
    }
}

function* regexMatches(matcher: RegExp, line: string, forward: boolean, 
    offset: number | undefined): Generator<[number, number]>{
    matcher.lastIndex = 0;
    let match = matcher.exec(line);
    while(match){
        if(offset && !forward && match.index > offset){ return; }
        if(offset === undefined || !forward || match.index > offset){
            yield [match.index, match[0].length];
        }
        let newmatch = matcher.exec(line);
        if(newmatch && newmatch.index > match.index){
            match = newmatch;
        }else{
            match = null;
        }
    }
}

function* stringMatches(matcher: string, matchCase: boolean, line: string, forward: boolean, 
    offset: number | undefined): Generator<[number, number]>{

    let search_me = offset === undefined ? line :
        (forward ? line.substring(offset) : line.substring(0, offset - 1));
    let fromOffset = offset === undefined ? 0 : (forward ? offset : 0);
    if(!matchCase){ search_me = search_me.toLowerCase(); }
    let from = search_me.indexOf(matcher, 0);
    while(from >= 0){
        yield [from + fromOffset, matcher.length];
        from = search_me.indexOf(matcher, from+1);
    }
}

// TODO: setup search state
// searchState
function search(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, args: any[]){

}

export function activate(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('modalkeys.search', search));
}

/**
 * This is the main command that not only initiates the search, but also handles
 * the key presses when search is active. That is why its argument is defined
 * as an union type. 
 */
async function oldsearch(args: unknown): Promise<void> {
    let editor_ = vscode.window.activeTextEditor;
    if (!editor_) { return; }
    let editor = editor_!;

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
    selections: readonly vscode.Selection[], state: SearchState) {
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
                newsel = positionSearch(new vscode.Selection(anchor, active), doc,
                    result.value.end.character - result.value.start.character, 
                    state.args)
                if (state.args.selectTillMatch){
                    newsel = new vscode.Selection(sel.anchor, newsel.active)
                } 

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
