import * as vscode from 'vscode';
import z from 'zod';
import { validateInput } from './utils';
import { setKeyContext, runCommands, state as keyState } from "./commands";
import { strictDoArgs } from './keybindingParsing';
import { wrappedTranslate } from './utils';

export const searchArgs = z.object({
    backwards: z.boolean().optional(),
    caseSensitive: z.boolean().optional(),
    wrapAround: z.boolean().optional(),
    acceptAfter: z.number().min(1).optional(),
    selectTillMatch: z.boolean().optional(),
    highlightMatches: z.boolean().default(true).optional(),
    offset: z.enum(["inclusive", "exclusive", "start", "end"]).default("exclusive"),
    text: z.string().min(1).optional(),
    regex: z.boolean().optional(),
    register: z.string().default("default"),
    doAfter: strictDoArgs.optional(),
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

    yield [doc.lineAt(pos).text, pos.line];
    let line = pos.line + (forward ? 1 : -1);
    while(forward ? line < doc.lineCount : line >= 0){
        yield [doc.lineAt(line).text, line];
        line += (forward ? 1 : -1);
    }
    if(wrap){
        line = forward ? 0 : doc.lineCount - 1;
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

interface SearchState{
    args: SearchArgs;
    text: string;
    searchFrom: readonly vscode.Selection[];
    oldMode: string;
}

let searchStates: Map<vscode.TextEditor, Record<string, SearchState>> = new Map();
let currentSearch: string = "default";
let searchStateUsed = false;
export function trackSearchUsage(){ searchStateUsed = false; }
export function wasSearchUsed(){ return searchStateUsed; }
function getSearchState(editor: vscode.TextEditor, register: string = currentSearch): SearchState{
    searchStateUsed = true;
    let statesForEditor = searchStates.get(editor);
    statesForEditor = statesForEditor ? statesForEditor : {};
    if(!statesForEditor[register]){
        let searchState: SearchState = {
            args: searchArgs.parse({}), 
            text: "", 
            searchFrom: [],
            oldMode: keyState.values.mode
        };
        statesForEditor[register] = searchState;
        searchStates.set(editor, statesForEditor);
        return searchState;
    }else{
        return statesForEditor[register];
    }
}

let typeSubscription: vscode.Disposable | undefined;
let onTypeFn: (text: string) => Promise<void> = async function(text: string){
    return;
};
async function onType(event: {text: string}){
    return onTypeFn(event.text);
}

async function search(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, args_: any[]){
    let args = validateInput('modalkeys.search', args_, searchArgs);
    if(!args){ return; }

    currentSearch = args.register;
    let state = getSearchState(editor);
    state.args = args;
    state.text = args.text || "";
    state.searchFrom = editor.selections;

    if(state.text.length > 0){
        navigateTo(state, editor);
        await acceptSearch(editor, edit, state);
        return;
    }

    setKeyContext({name: 'mode', value: 'search', transient: false});
    // when there are a fixed number of keys use `type` command
    if(state.args.acceptAfter){
        let acceptAfter = state.args.acceptAfter;
        if(!typeSubscription){
            try{
                typeSubscription = vscode.commands.registerCommand('type', onType);
            }catch(e){
                vscode.window.showErrorMessage(`Failed to capture keyboard input. You 
                    might have an extension that is already listing to type events 
                    installed (e.g. vscodevim).`);
            }
        }
        onTypeFn = async (text: string) => { 
            if(text === "\n") { acceptSearch(editor, edit, state); }
            state.text += text; 
            navigateTo(state, editor, false);
            if(state.text.length >= acceptAfter){ acceptSearch(editor, edit, state); }
        };
    }else{
        // if there are not a fixed number use a UX element that makes the keys visible
        let inputBox = vscode.window.createInputBox();
        inputBox.prompt = "Enter search text";
        inputBox.title = "Search";
        inputBox.onDidChangeValue((str: string) => {
            state.text = str;
            navigateTo(state, editor, false);
        });
        inputBox.onDidAccept(() => {
            acceptSearch(editor, edit, state);
            inputBox.dispose();
        });
        inputBox.onDidHide(() => {
            cancelSearch(editor, edit);
        });
        inputBox.show();
    }
}

async function acceptSearch(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, state: SearchState) {
    if(state.args.doAfter){
        await runCommands({do: state.args.doAfter, resetTransient: true});
    }
    if(typeSubscription){
        typeSubscription.dispose();
        typeSubscription = undefined;
    }
    state.searchFrom = editor.selections;
    await setKeyContext({name: 'mode', value: state.oldMode, transient: false});
}

export function activate(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('modalkeys.search', search));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('modalkeys.acceptSearch', acceptSearch));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('modalkeys.cancelSearch', cancelSearch));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('modalkeys.deleteLastSearchChar', deleteLastSearchCharacter));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('modalkeys.nextMatch', nextMatch));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('modalkeys.previousMatch', previousMatch));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('modalkeys.clearSearchDecorations', clearSearchDecorations));
    updateSearchHighlights();
    vscode.workspace.onDidChangeConfiguration(updateSearchHighlights);
}

async function cancelSearch(editor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    let state = getSearchState(editor);
    if (keyState.values.mode === 'search'){
        setKeyContext({name: 'mode', value: state.oldMode, transient: false});
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            if(state.searchFrom){ editor.selections = state.searchFrom; }
            revealActive(editor);
        }
    }
    if(typeSubscription){
        typeSubscription.dispose();
        typeSubscription = undefined;
    }
}

function deleteLastSearchCharacter(editor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    let state = getSearchState(editor);
    state.text = state.text.slice(0, -1);
    navigateTo(state, editor);
}


export function revealActive(editor: vscode.TextEditor){
    let act = new vscode.Range(editor.selection.active, editor.selection.active);
    editor.revealRange(act);
}

const matchStepArgs = z.object({register: z.string().default("default")});
async function nextMatch(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, args_: unknown){
    let args = validateInput('modalkeys.nextMatch', args_, matchStepArgs);
    if(!args) { return; }
    let state = getSearchState(editor, args!.register);
    if (state.text) {
        navigateTo(state, editor);
        revealActive(editor);
    }
}

async function previousMatch(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, args_: unknown){
    let args = validateInput('modalkeys.previousMatch', args_, matchStepArgs);
    if(!args) { return; }
    let state = getSearchState(editor, args!.register);
    if (state.text) {
        state.args.backwards = !state.args.backwards;
        navigateTo(state, editor);
        revealActive(editor);
        state.args.backwards = !state.args.backwards;
    }
}

let searchDecorator: vscode.TextEditorDecorationType;
let searchOtherDecorator: vscode.TextEditorDecorationType;

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
function navigateTo(state: SearchState, editor: vscode.TextEditor, updateSearchFrom: boolean = true) {
    if (state.text === ""){
        /**
         * If search string is empty, we return to the start positions.
         * (clearing the decorators)
         */
        editor.selections = state.searchFrom;
        editor.setDecorations(searchDecorator, []);
        editor.setDecorations(searchOtherDecorator, []);
    }else {
        let doc = editor.document;

        /**
         * searchRanges keeps track of where the searches land
         * (so we can highlight them later on)
         */
        let searchRanges: vscode.Range[] = [];

        editor.selections = state.searchFrom.map(sel => {
            let matches = searchMatches(doc, sel.active, undefined, state.text, state.args);
            let result = matches.next();
            let newSel = sel;
            while(!result.done){
                let [active, anchor] = state.args.backwards ?
                    [result.value.start, result.value.end] :
                    [result.value.end, result.value.start];
                newSel = adjustSearchPosition(new vscode.Selection(anchor, active), doc,
                    result.value.end.character - result.value.start.character, 
                    state.args);
                if (state.args.selectTillMatch){
                    newSel = new vscode.Selection(sel.anchor, newSel.active);
                } 

                if(!newSel.start.isEqual(sel.start) || !newSel.end.isEqual(sel.end)) { break; }

                result = matches.next();
            }
            if(result.done){
                // TODO: have a discreted place to say "Pattern not found"
                // this is what gets called when there is no match
                return sel;
            }else{
                searchRanges.push(result.value);

                return newSel;
            }
        });
        if(updateSearchFrom){
            state.searchFrom = editor.selections;
        }

        revealActive(editor);

        /**
         * Finally, we highlight all search matches to make them stand out in the document.
         * To accomplish this, we look for any matches that are currently visible and mark
         * them; we want to mark those that aren't a "current" match (found above)
         * differently so we make sure that they are not part of `searchRanges`
         */
         if(state.args.highlightMatches !== false){
            let searchOtherRanges: vscode.Range[] = [];
            editor.visibleRanges.forEach(range => {
                let matches = searchMatches(doc, range.start, range.end, state.text,
                    {...state.args, backwards: false});
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
    }
}

/**
 * ### Search Decorations
 *
 * We determine how searches are highlighted whenever the configuration changes by callin
 * this function; searches are highlighted by default using the same colors as used for
 * built-in search commands.
 */
function updateSearchHighlights(event?: vscode.ConfigurationChangeEvent){
    if(!event || event.affectsConfiguration('modalkeys')){
        let config = vscode.workspace.getConfiguration('modalkeys');
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

function adjustSearchPosition(sel: vscode.Selection, doc: vscode.TextDocument, len: number, args: SearchArgs){
    let offset = 0;
    let forward = !args.backwards;
    if(args.offset === 'exclusive'){
        offset = forward ? -len : len;
        if(!args.selectTillMatch) { offset += forward ? -1 : 0; }
    }else if(args.offset === 'start'){
        if(forward){ offset = -len; }
    }else if(args.offset === 'end'){
        if(!forward){ offset = len; }
    }else{ // args.offset === 'inclusive' (default)
        if(!args.selectTillMatch){
            offset += forward ? -1 : 0;
        }
    }

    if(offset !== 0){
        let newpos = wrappedTranslate(sel.active, doc, offset);
        return new vscode.Selection(args.selectTillMatch ? sel.anchor : newpos, newpos);
    }
    return sel;
}

export function clearSearchDecorations(editor: vscode.TextEditor){
    editor.setDecorations(searchDecorator, []);
    editor.setDecorations(searchOtherDecorator, []);
}
