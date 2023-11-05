/**
 * # Converting Keybinding Definitions to Actions
 *
 * This module defines the schema of the configuration file using TypeScript
 * interfaces. We parse the configuration JSON to TypeScript objects which
 * directly define all the valid keyboard sequences and the commands that these
 * will invoke.
 * @module
 */

import { mergeWith, merge, uniq, cloneDeep } from 'lodash'
import { IHash } from './util'

import * as vscode from 'vscode'
import { KeytipProvider } from './keytips'
/**
 * ## Action Definitions
 *
 * The keybinding configuration consist of _actions_ that can take three forms:
 * an action can be a command (defined later), a keymap, or a number that refers
 * to a keymap defined earlier.
 */
export type Action = Command | Keymap | number
/**
 * Commands can be invoked in four ways: by specifying just command a name
 * (string), or using a conditional command, a command with parameters, or a
 * sequence (array) of commands. The definition is recursive, meaning that a
 * sequence can contain all four types of commands.
 */
export type Command = string | Conditional | Parameterized | Command[]
/**
 * A conditional command consist of condition (a JavaScript expression) and set
 * of branches to take depending on the result of the condition. Each branch can
 * be any type of command defined above.
 */
export interface Conditional {
    if: string
    then: Command,
    else?: Command
}
/**
 * A command that takes arguments can be specified using the `Parameterized`
 * interface. Arguments can be given either as an object or a string, which
 * is assumed to contain a valid JS expression. Additionally, you can specify
 * that the command is run multiple times by setting the `repeat` property. The
 * property must be either a number, or a JS expression that evaluates to a
 * number. If it evaluates to some other type, the expression is used as a
 * condition that is evaluated after the command is run. If the expression
 * returns a truthy value, the command is repeated.
 */
export interface Parameterized {
    command: string
    label?: string
    args?: {}
    repeat?: number | string
}
/**
 * A keymap is a dictionary of keys (characters) to actions. Keys are either
 * single characters or character ranges, denoted by sequences of `<char>,<char>`
 * and `<char>-<char>`. Values of the dictionary can be also nested keymaps.
 * This is how you can define commands that require  multiple keypresses.
 *
 * ![keymap example](../images/keymap.png)
 * When the value of a key is number, it refers to another keymap whose `id`
 * equals the number. The number can also point to the same  keymap where it
 * resides. With this mechanism, you can define _recursive_ keymaps that can
 * take (theoretically) infinitely long key sequences. The picture on the right
 * illustrates this.
 *
 * The `help` field contains help text that is shown in the status bar when the
 * keymap is active.
 */
export interface Keymap {
    id: number
    help: string
    [key: string]: Action
}

export interface Keyhelp{
    label: string,
    kind: string
    detail?: string,
    keys?: IHash<Keyhelp>
    tip?: string,
}

export interface Keymodes {
    help?: IHash<IHash<Keyhelp>>,
    command?: IHash<Keymap>,
}

export interface ActionVars {
    mode: string
}

/**
 * ## Cursor Shapes
 *
 * You can use various cursor shapes in different modes. The list of available
 * shapes is defined below.
 */
type Cursor =
    | "block"
    | "block-outline"
    | "line"
    | "line-thin"
    | "underline"
    | "underline-thin"
    | undefined
/**
 * ## Configuration State
 *
 * The variables below contain the current cursor configuration.
 */
let insertCursorStyle: vscode.TextEditorCursorStyle
let normalCursorStyle: vscode.TextEditorCursorStyle
let searchCursorStyle: vscode.TextEditorCursorStyle
let selectCursorStyle: vscode.TextEditorCursorStyle
let insertStatusText: string
let normalStatusText: string
let searchStatusText: string
let selectStatusText: string
let insertStatusColor: string | undefined
let normalStatusColor: string | undefined
let searchStatusColor: string | undefined
let selectStatusColor: string | undefined
/**
 * Another thing you can set in config, is what mode ModalKeys starts in.
 */
let startMode: string
/**
 * The root of the action configuration is keymap. This defines what key
 * sequences will be run when keys are pressed in normal mode.
 */
let rootKeymodes: Keymodes | undefined
/**
 * The current active keymap is stored here. The active keymap changes when the
 * user invokes a multi-key action sequence.
 */

interface FinalCount { count: number }

/**
 * We need a dictionary that returns a keymap for given id.
 */
let keymapsById: { [id: number]: Keymap }
/**
 * ## Configuration Accessors
 *
 * The following functions return the current configuration settings.
 */
export function getInsertStyles():
    [vscode.TextEditorCursorStyle, string, string | undefined] {
    return [ insertCursorStyle, insertStatusText, insertStatusColor ]
}

export function getNormalStyles(mode: string):
    [vscode.TextEditorCursorStyle, string, string | undefined ] {
    return [ normalCursorStyle,
            normalStatusText.replace("__MODENAME__", mode.toUpperCase()),
            normalStatusColor ]
}

export function getSearchStyles():
    [vscode.TextEditorCursorStyle, string, string  | undefined] {
    return [ searchCursorStyle, searchStatusText, searchStatusColor ]
}

export function getSelectStyles():
    [vscode.TextEditorCursorStyle, string, string | undefined] {
    return [ selectCursorStyle, selectStatusText, selectStatusColor ]
}

export function getStartMode(): string {
    return startMode
}

/**
 * ## Logging
 *
 * To enable logging and error reporting ModalKeys creates an output channel
 * that is visible in the output pane. The channel is created in the extension
 * activation hook, but it is passed to this module using the `setOutputChannel`
 * function.
 */
let outputChannel: vscode.OutputChannel

export function setOutputChannel(channel: vscode.OutputChannel) {
    outputChannel = channel
}
/**
 * Once the channel is set, we can output messages to it using the `log`
 * function.
 */
export function log(message: string) {
    outputChannel.appendLine(message)
}

let keyTipState: KeytipProvider
export function registerKeytips(provider: KeytipProvider){
    keyTipState = provider
}

/**
 * ## Updating Configuration from settings.json
 *
 * Whenever you save the user-level `settings.json` or the one located in the
 * `.vsode` directory VS Code calls this function that updates the current
 * configuration.
 */
export function updateFromConfig(): void {
    const config = vscode.workspace.getConfiguration("modalkeys")
    UpdateKeybindings(config)
    insertCursorStyle = toVSCursorStyle(
        config.get<Cursor>("insertCursorStyle", "line"))
    normalCursorStyle = toVSCursorStyle(
        config.get<Cursor>("normalCursorStyle", "block"))
    searchCursorStyle = toVSCursorStyle(
        config.get<Cursor>("searchCursorStyle", "underline"))
    selectCursorStyle = toVSCursorStyle(
        config.get<Cursor>("selectCursorStyle", "line-thin"))
    insertStatusText = config.get("insertStatusText", "-- $(edit) INSERT --")
    normalStatusText = config.get("normalStatusText", "-- $(move) __MODENAME__ --")
    searchStatusText = config.get("searchStatusText", "$(search) SEARCH")
    selectStatusText = config.get("selectStatusText", "-- $(paintcan) VISUAL --")
    insertStatusColor = config.get("insertStatusColor") || undefined
    normalStatusColor = config.get("normalStatusColor") || undefined
    searchStatusColor = config.get("searchStatusColor") || undefined
    selectStatusColor = config.get("selectStatusColor") || undefined
    startMode = config.get("startMode", "normal")
}
/**
 * The following function updates base keymap and select-mode keymap.
 */
function UpdateKeybindings(config: vscode.WorkspaceConfiguration) {
    log("Validating keybindings in 'settings.json'...")
    keymapsById = {}

    let [modes, errors] = expandBindings(config.get<any>("keybindings"))
    if(!isKeymap(modes?.command?.normal))
        log("ERROR: Missing valid normal mode keybindings. Keybindings not updated.")
    else if(modes?.command){
        for(const keymap of Object.values(modes.command)){
            if (isKeymap(keymap)) {
                errors += validateAndResolveKeymaps(keymap)
            }
        }
        rootKeymodes = modes
    }
    if (errors > 0)
        log(`Found ${errors} error${errors > 1 ? "s" : ""}. ` +
            "Keybindings might not work correctly.")
    else{
        log("Validation completed successfully.")
        keyTipState.setKeymodes(rootKeymodes!)
    }
}

/**
 * The keymap ranges are recognized with the following regular expression.
 * Examples of valid key sequences include:
 *
 * - `0-9`
 * - `a,b,c`
 * - `d,e-h,l`
 *
 * Basically you can add individual characters to the range with a comma `,` and
 * an ASCII range with dash `-`. The ASCII code of the first character must be
 * smaller than the second one's.
 */
/**
 * The function itself is recursive; it calls itself, if it finds a nested
 * keymap. It stores all the keymaps it encounters in the `keymapsById`
 * dictionary.
 */
function validateAndResolveKeymaps(keybindings: Keymap) {
    let errors = 0
    function error(message: string) {
        log("ERROR: " + message)
        errors++
    }
    if((<any>keybindings).__keymap && keybindings.__keymap !== "yes"){
        error("The key binding '__keymap' is reserved, and cannot be used.")
    }
    keybindings.__keymap = "yes"
    if (typeof keybindings.id === 'number')
        keymapsById[keybindings.id] = keybindings
    for (let key in keybindings) {
        if (key != "id" && key != "help") {
            let target = keybindings[key]
            if (isKeymap(target))
                validateAndResolveKeymaps(target)
            if (key.length > 1 && key !== '__keymap')
                error(`Invalid key binding: "${key}"`)
        }
    }

    return errors;
}
/**
 * The helper function below converts cursor styles specified in configuration
 * to enumeration members used by VS Code.
 */
function toVSCursorStyle(cursor: Cursor): vscode.TextEditorCursorStyle {
    switch (cursor) {
        case "line": return vscode.TextEditorCursorStyle.Line
        case "block": return vscode.TextEditorCursorStyle.Block
        case "underline": return vscode.TextEditorCursorStyle.Underline
        case "line-thin": return vscode.TextEditorCursorStyle.LineThin
        case "block-outline": return vscode.TextEditorCursorStyle.BlockOutline
        case "underline-thin": return vscode.TextEditorCursorStyle.UnderlineThin
        default: return vscode.TextEditorCursorStyle.Line
    }
}

/**
 * helper function to expand bindings to the full tree we need during action execution
 *
 */

const normalFirst = (x: [string, any]) =>
    x[0].match(/(^[a-z\|]*normal[a-z\|]*:)|^[^:]*$/) ? -1 : 0

function expandCommands(x: any): Command {
    try{
        return expandCommands__(x)
    }catch(e: any){
        log("ERROR: "+e.message)
    }
    return "UNKNOWN_COMMAND_FORM"
}

export function expandOneCommand(x: Command): Command | undefined {
    try{
        return expandCommands__(x)
    }catch(e: any){
        vscode.window.showErrorMessage(e.message)
    }
    return undefined
}
function expandCommands__(x: any): Command {
    if(x?.if){
        let result: any = { "if": x.if }
        if(x['else'] !== undefined)
            result['else'] = expandCommands(x['else'])
        if(x['then'] !== undefined)
            result['then'] = expandCommands(x['then'])
        return result
    }else if(typeof(x) === 'string'){
        return x
    }else if(Array.isArray(x)){
        return x.map(expandCommands)
    }else if(isObject(x)){
        let keys = Object.keys(x).filter(x => x !== 'repeat')
        if(keys.length > 1){
            throw new Error(`ERROR: command has multiple heads: ${keys.join(", ")}`)
        }
        return { command: keys[0], args: x[keys[0]], repeat: x.repeat }
    }else {
        throw new Error(`ERROR: command is of unknown form (displaying value below).`+
            JSON.stringify(x, null, 2))
    }
}

function isLabelStub(obj: any){
    return obj.label !== undefined && Object.keys(obj).length === 1
}
function expandEntryBindingsFn(state: { errors: number, sequencesFor: IHash<string[]>, withCommand?: string }): ((keymodes: Keymodes, keyval: [string, any]) => Keymodes) {
    return (keymodes: Keymodes, [key, val]: [string, any]): Keymodes => {
        if(key === '__keymap'){ return keymodes }
        if(key.startsWith('::using::')){
            if(state.withCommand){
                log(`ERROR: cannot nest '::using::' directives, ignoring child directive.`)
            }else {
                return Object.entries(val).reduce(expandEntryBindingsFn({
                    errors: state.errors,
                    sequencesFor: state.sequencesFor,
                    withCommand: key.split('::')[2]
                }), keymodes)
            }
        }
        let docBinding = false
        if(key.startsWith('::doc::')){
            docBinding = true
            key = key.slice('::doc::'.length)
        }else if(state.withCommand){
            val = { [state.withCommand]: val }
        }
        let res = key.match(/^(([a-z|]{2,})::)?((.|\s)*)$/)
        if(key.match(/[a-z|]{3,}:[^:](.*)$/)){
            log(`WARN the entry '${key}' looks like you might be trying to select a mode, did you mean to use a '::' instead of ':'?`)
        }
        if(res){
            let [ match, g1, givenMode, seq ] = res
            let obj: any = docBinding ? val : expandCommands(val)
            for(let i = seq.length-1; i>=0; i--){
                if(docBinding){
                    obj = {keys: {[seq[i]]: obj}}
                }else{
                    obj = {[seq[i]]: obj}
                }
            }
            if(docBinding && obj.keys){
                obj = obj.keys
            }
            let modes = (givenMode ? givenMode.split('|') : ['__all__'])
            let newErrors = false
            for(let mode of modes){
                if(docBinding){
                    for(const mode of modes){
                        if(!keymodes.help) keymodes.help = {}
                        keymodes.help[mode] = keymodes.help[mode] === undefined ? obj :
                            mergeWith(keymodes.help[mode], obj, overloadHelpEntries)
                    }
                }else{
                    if(state.sequencesFor[mode]?.some((oldseq: string) => {
                        if(oldseq == seq){
                            log(`WARN the sequence '${seq}' overwrites an existing binding.`)
                            return false
                        }else if(oldseq.startsWith(seq)){
                            log(`ERROR the keysequence '${seq}' is a subsequence of the already defined sequence '${oldseq}'`)
                            return true
                        }else if(seq.startsWith(oldseq)){
                            log(`ERROR the existing keysequence '${oldseq}' is a subseqeunce of the the new sequence '${seq}'.`)
                            return true
                        }
                        return false
                    })){
                        newErrors = true
                        state.errors++
                        break
                    }else{
                        if(state.sequencesFor[mode]) state.sequencesFor[mode]?.push(seq)
                        else state.sequencesFor[mode] = [seq]
                    }
                    if(!newErrors){
                        for(const mode of modes){
                            if(!keymodes?.command){
                                keymodes.command = {}
                            }
                            keymodes.command[mode] = keymodes.command[mode] === undefined ? obj :
                                mergeWith(keymodes.command[mode], obj, overloadCommands)
                        }
                    }
                }
                return keymodes
            }
        }
        log(`ERROR invalid binding entry '${key}'`)
        return keymodes
    }
}

const overloadCommands = (oldval: Action, newval: Action) => { if(isCommand(oldval)){ return newval } }
const overloadHelpEntries  = (oldval: Keyhelp, newval: Keyhelp) => { 
    if((oldval?.keys && isHelpEntry(newval)) || (newval?.keys && isHelpEntry(oldval))){
        return undefined
    }
    if(isHelpEntry(oldval)){ return newval } 
}

function expandBindings(bindings: any): [Keymodes | undefined, number] {
    let state = {sequencesFor: <IHash<string[]>>{}, errors: 0}
    let keymodes = Object.entries(bindings).reduce(
        expandEntryBindingsFn(state), {command: {}, help: {}})
    let allModes = Object.keys(keymodes?.command || {})
    allModes.push('normal', 'visual')
    allModes = uniq(allModes)
    let result: any = {}
    function resolveAll<T>(x: IHash<T> | undefined, overload: any){
        if(!x) return x
        let result = x
        if(x.__all__){
            for(let mode of allModes){
                if(mode !== '__all__')
                    result[mode] = mergeWith(cloneDeep(x.__all__), result[mode], overload)

            }
            delete result.__all__
        }
        return result
    }
    keymodes.command = resolveAll(keymodes.command, overloadCommands)
    keymodes.help = resolveAll(keymodes.help, overloadHelpEntries)
    return [keymodes, state.errors]
}

/**
 * ## Type Predicates
 *
 * Since JavaScript does not have dynamic type information we need to write
 * functions that check which type of action we get from the configuration.
 * First we define a high-level type predicate that checks if a value is
 * an action.
 */
function isAction(x: any): x is Action {
    return isCommand(x) || isKeymap(x) || isNumber(x)
}
/**
 * This one checks whether a value is a string.
 */
function isString(x: any): x is string {
    return x && typeof x === "string"
}
/**
 * This one checks whether a value is a number.
 */
function isNumber(x: any): x is number {
    return x && typeof x === "number"
}
/**
 * This one identifies an object.
 */
function isObject(x: any): boolean {
    return x && typeof x === "object"
}

function isHelpEntry(x: any){
    return x && x?.label !== undefined && x?.kind !== undefined
}
/**
 * This checks if a value is a command.
 */
function isCommand(x: any): x is Action {
    return isString(x) || isParameterized(x) || isConditional(x) ||
        isCommandSequence(x)
}
/**
 * This recognizes a conditional action.
 */
 function isConditional(x: any): x is Conditional {
    return isObject(x) && isString(x.if) &&
        Object.keys(x).every(key =>
            key === "if" || isCommand(x[key]))
 }
/**
 * This checks if a value is an array of commands.
 */
function isCommandSequence(x: any): x is Command[] {
    return Array.isArray(x) && x.every(isCommand)
}
/**
 * This asserts that a value is a parameterized command.
 */
function isParameterized(x: any): x is Parameterized {
    return isObject(x) && isString(x.command) &&
        (!x.args || isObject(x.args) || isString(x.args)) &&
        (!x.repeat || isNumber(x.repeat) || isString(x.repeat))
}
/**
 * And finally this one checks if a value is a keymap.
 */
function isKeymap(x: any): x is Keymap {
    return x && (x.__keymap || (isObject(x) && !isParameterized(x) && !isConditional(x) && !isCommandSequence(x) && Object.values(x).every(isAction)))
}

const MAX_REPEAT = 1000

export interface IKeyRecording{
    seq: string[]
    mode: string
    register: string
}

export class KeyState {
    argumentCount?: number
    countFinalized: boolean = false
    currentKeymap?: Keymap
    currentHelpmap?: IHash<Keyhelp>
    keySequence: string[] = []
    capturedKeys: string[] = []
    modeCaptures: IHash<string>
    replaying: boolean = false
    macros: IHash<IKeyRecording> = {}
    macro: IKeyRecording | undefined = undefined
    curWord: IKeyRecording | undefined = undefined
    lastWord: IKeyRecording | undefined = undefined

    constructor(modeCaptures: IHash<string>, parent?: KeyState){
        this.modeCaptures = { ...(parent?.modeCaptures || {}), ...modeCaptures }
    }

    waitingForKey() { return this.currentKeymap !== undefined || this.argumentCount !== undefined }
    reset() {
        this.currentKeymap = undefined
        this.currentHelpmap = undefined
        this.argumentCount = undefined
        this.countFinalized = false
        this.keySequence = []
        this.capturedKeys = []
        this.lastWord = this.curWord
        this.curWord = undefined
    }

    update(keymap: Keymap){
        this.currentKeymap = keymap
        if(this.argumentCount !== undefined) this.countFinalized = true
    }

    updateCount(val: number){
        if(this.countFinalized){
            this.error()
        }else{
            this.argumentCount = 10*(this.argumentCount || 0) + Number(val)
        }
    }

    error(){
        
        const define = "Fix: Import"
        const show = "Help: Visual"
        const docs = "Help: Details"
        vscode.window.showWarningMessage("ModalKeys - Undefined key binding: `"+this.keySequence.join("")+"`", define, show, docs).
        then(selection => {
            if(selection === define){
                vscode.commands.executeCommand("modalkeys.importPresets")
            }else if(selection === show){
                vscode.commands.executeCommand('modalkeys.showKeymap')
            }else if(selection === docs){
                let url = 'https://haberdashpi.github.io/vscode-modal-keys/stable/doc_index.html'
                vscode.env.openExternal(vscode.Uri.parse(url));
            }
        })
        this.reset()
    }


    /**
     * `evalString` function evaluates JavaScript expressions. Before doing so, it
     * defines some variables that can be used in the evaluated text.
     */
    evalString__(str: string, __mode: string, __captured: string | undefined): any {
        let __file
        let __line
        let __col
        let __char
        let __language
        let __count = this.argumentCount
        let __selections
        let __selection
        let __selectionstr
        let __wordstr
        let editor = vscode.window.activeTextEditor
        if (editor) {
            let cursor = editor.selection.active
            __language = editor.document.languageId
            __file = editor.document.fileName
            __line = cursor.line
            __col = cursor.character
            __char = editor.document.getText(new vscode.Range(cursor,
                cursor.translate({ characterDelta: 1 })))

            __selection = editor.selection
            __selections = editor.selections
            __selectionstr = editor.document.getText(editor.selection)
            let range = editor.document.getWordRangeAtPosition(editor.selection.start)
            __wordstr = __selectionstr || editor.document.getText(range)
        }
        return eval(`(${str})`)
    }
    evalString(str: string, __mode: string, __captured: string | undefined): any {
        try {
            return this.evalString__(str, __mode, __captured)
        }
        catch (error: any) {
            vscode.window.showErrorMessage("Evaluation error: " + error.message)
            return undefined
        }
    }

    /**
     * We need the evaluation function when executing conditional command. The
     * condition is evaluated and if a key is found that matches the result, it is
     * executed.
     */
    async executeConditional(cond: Conditional, mode: string, captured: string | undefined): Promise<void> {
        let res = this.evalString(cond.if, mode, captured)
        if (res && isAction(cond.then)){
            await this.execute(cond.then, mode, captured)
        }else if(!res && isAction(cond.else)){
            await this.execute(cond.else, mode, captured)
        }
    }
    /**
     * Parameterized commands can get their arguments in two forms: as a string
     * that is evaluated to get the actual arguments, or as an object. Before
     * executing the command, we inspect the `repeat` property. If it is string
     * we evaluate it, and check if the result is a number. If so, we update the
     * `repeat` variable that designates repetition count. If not, we treate it as
     * a continue condition. The subroutine `exec` runs the command either `repeat`
     * times or as long as the expression in the `repeat` property returns a truthy
     * value.
     */
    async executeParameterized(action: Parameterized, mode: string, captured: string | undefined) {
        let this_ = this 
        let repeat: boolean | number
        let repeatStr: string = ""
        async function exec(args?: any) {
            let cont = true
            if(typeof(repeat) === 'number'){
                for (let i = 0; i < repeat; i++)
                    await this_.executeVSCommand(action.command, args)
            }else{
                if(!action.repeat){
                    await this_.executeVSCommand(action.command, args)
                }
                else {
                    for(let i = 0; i < MAX_REPEAT; i++){
                        await this_.executeVSCommand(action.command, args)
                        repeat = this_.evalString__(repeatStr, mode, captured)
                        if(!repeat) break
                    }
                    if(repeat){
                        vscode.window.showErrorMessage(`Repeat evaluated to true for ${MAX_REPEAT} cycles. Stopping prematurely.`)
                    }
                }
            }
        }
        if (action.repeat) {
            if(typeof(action.repeat) === 'number'){
                repeat = action.repeat
            }else if (action.repeat === '__count' || /^\(\s*__count\s*\|\|\s*1\s*\)$/.test(action.repeat)){
                repeat = this.argumentCount || 1
            }else{
                try {
                    let result: any = this.evalString__(action.repeat, mode, captured)
                    if(typeof(result) === 'boolean'){
                        repeat = result
                        repeatStr = action.repeat
                    }else{
                        vscode.window.showErrorMessage(`Repeat does not evaluate to number or boolean: '${action.repeat}'.`)
                        repeat = 1
                    }
                }catch{
                    repeat = 1
                    vscode.window.showErrorMessage(`Error evaluating repeat argument: '${action.repeat}'.`)
                }
            }
        }
        if (action.args) {
            await exec(this.replaceVars(action.args, mode, captured))
        }
        else
            await exec()
    }

    replaceVars(args: object, mode: string, captured: string | undefined){
        let editor = vscode.window.activeTextEditor
        let result: any = {}
        for(const entry of Object.entries(args)){
            let [key, val] = entry
            // we evaluate the value: we special some of these, because it is likely faster
            // using a full javascript evaluation
            let eval_val = val === '__line' ? editor?.selection?.active?.line :
                val === '__count' ? this.argumentCount :
                val === '-__count' ? -(this.argumentCount || NaN) :
                val === '__mode' ? mode :
                val === '__captured' ? captured :
                /^\(\s*__count\s* \|\| 1\)$/.test(val) ? (this.argumentCount || 1) :
                /^-\s*\(\s*__count\s* \|\| 1\)$/.test(val) ? -(this.argumentCount || 1) :
                /__/.test(val) ? this.evalString__(val, mode, captured) : val
            result[key] = eval_val
        }

        return result
    }

    /**
     * ## Executing Actions
     *
     * Before running any commands, we need to identify which type of action we got.
     * Depending on the type we use different function to execute the command. If
     * the action is not a command, it has to be a keymap. Since we resolved `id`
     * referenences in `validateAndResolveKeymaps`, an action has to be a keymap
     * object at this point. We set the new keymap as the active one.
     */
    async execute(action: Action, mode: string, captured?: string) {
        if (isString(action)){
            await this.executeVSCommand(action)
            return true
        }else if (isCommandSequence(action)){
            for (const command of action) await this.execute(command, mode, captured)
            return true
        }else if (isConditional(action)){
            await this.executeConditional(action, mode, captured)
            return true
        }else if (isParameterized(action)){
            await this.executeParameterized(action, mode, captured)
            return true
        }else{
            this.update(<Keymap>action)
            return false
        }
    }

    /**
     * ## Executing Commands
     *
     * In the end all keybindings will invoke one or more VS Code commands. The
     * following function runs a command whose name and arguments are given as
     * parameters. If the command throws an exception because of invalid arguments,
     * for example, the error is shown in the popup window at the corner of the
     * screen.
     */
    async executeVSCommand(command: string, ...rest: any[]): Promise<void> {
        // ignore macro recording commands
        if(command === "modalkeys.toggleRecordingMacro" && this.replaying){
            return
        }
        try {
            await vscode.commands.executeCommand(command, ...rest)
        }
        catch (error: any) {
            vscode.window.showErrorMessage(error.message)
        }
    }

    recordMacro(register: string, mode: string){
        if(!this.replaying){
            this.macro = {seq: [], register, mode}
        }
    }

    isRecording(){ return this.macro !== undefined }

    saveMacro(){
        if(!this.replaying && this.macro){
            this.macros[this.macro.register] = this.macro;
            this.macro = undefined;
        }
    }

    cancelMacro(){
        this.macro = undefined
    }

    macroReplayState(register: string): [KeyState, string[], string]{
        let result = new KeyState({}, this)
        let macro = this.macros[register]
        result.replaying = true;

        return [result, macro.seq, macro.mode];
    }

    deleteSearchChar(){
        this.curWord?.seq.pop()
    }

    static getHelp(mode: string): IHash<Keyhelp> | undefined {
        if(rootKeymodes?.help){
            return rootKeymodes.help[mode]
        }
    }
    getCurrentHelp(mode: string): IHash<Keyhelp> | undefined {
        if(this.currentHelpmap){
            return this.currentHelpmap
        }else if(rootKeymodes?.help){
            return rootKeymodes.help[mode]
        }
    }

    /**
     * ## Key Press Handler
     *
     * Now that the plumbing of actions is implemented, it is straightforward to
     * map the pressed key to an action. The special case occurs when a command
     * captures the keyboard. Then we rerun the previous command and give the key
     * to it as an argument.
     *
     * Otherwise we just check if the current keymap contains binding for the key
     * pressed, and execute the action. If not, we present an error to the user.
     *
     * As a last step the function returns `true`, if the current keymap is `null`.
     * This indicates that the key invoked a command instead of just changing the
     * active keymap.
     */
    // TODO: handle key makes use of a lot of global state
    // we need to make it self contained, so that nested calls to handleKey can work
    // as expected. This is probably best managed by using a class
    // KeyHandler
    async handleKey(key: string, keyMode: string) {
        let newKeymap: undefined | Keymap = this.currentKeymap || (rootKeymodes?.command && rootKeymodes.command[keyMode]);
        let newHelpmap: undefined | IHash<Keyhelp> = this.currentHelpmap || (rootKeymodes?.help && rootKeymodes.help[keyMode]);

        // record this key press if there is an actively recording macro
        if(this.macro){
            // it's possible the mode has changed since the start of recording...
            if(this.macro.seq.length === 0 && this.macro.mode != keyMode){
                this.macro.mode = keyMode
            }
            this.macro.seq.push(key)
        }

        this.keySequence.push(key)
        if(!this.curWord){
            if(this.modeCaptures[keyMode]){
                // if the last sequence lead to a command that captures input
                // then that sequence + the captured keys are both required to
                // re-issue that same command (i.e. the are part of the same
                // word)
                this.curWord = this.lastWord
            }else{
                this.curWord = { seq: [], mode: keyMode, register: 'curWord' }
            }
        }
        if(this.curWord){
            this.curWord.seq.push(key)
        }

        const command = this.modeCaptures[keyMode]
        if (command){
            this.capturedKeys.push(key)
            await this.executeVSCommand(command, key)
        }
        // if a count is already starting to be entered, additional numbers will
        // contribute to this count, even if there are commands that accept that
        // include those numbers: e.g. 0 can be used as a command, unless it
        // proceedes other numbers.
        else if(this.argumentCount !== undefined && !this.countFinalized &&
            key.match('[0-9]+')){
            this.updateCount(Number(key))
        }
        else if (newKeymap && newKeymap[key]) {
            if(await this.execute(newKeymap[key], keyMode)){
                this.reset()
            }else if(newHelpmap){
                this.currentHelpmap = newHelpmap[key].keys
            }
        }
        else if (key.match('[0-9]+')) {
            this.updateCount(Number(key))
        }
        else {
            const type = "Fix: Let me type!"
            const define = "Fix: Define a keymap"
            const docs = "Help: keymap configuration"
            const ignore = "Ignore"
            if(!(rootKeymodes && rootKeymodes.command && rootKeymodes.command[keyMode])){
                vscode.window.showInformationMessage
                vscode.window.showErrorMessage(`
                    ModalKeys - no keymap defined for ${keyMode} mode.
                `,{modal: true}, type, define, docs, ignore).
                then(selection => {
                    if(selection === type){
                        vscode.commands.executeCommand("modalkeys.enterMode",
                            { mode: "insert" })
                    }else if(selection === define){
                        vscode.commands.executeCommand("modalkeys.importPresets")
                    }else if(selection === docs){
                        let url = 'https://haberdashpi.github.io/vscode-modal-keys/stable/doc_index.html'
                        vscode.env.openExternal(vscode.Uri.parse(url));
                        vscode.commands.executeCommand("modalkeys.enterMode",
                            { mode: "insert" })
                    }else{
                        return
                    }
                })
                this.reset()
            }else{
                this.error()
            }
        }
    }
}

