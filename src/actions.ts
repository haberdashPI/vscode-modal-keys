import { sortBy, mergeWith, mapValues, flatten, uniq } from 'lodash'
import { IHash } from './util'
import { exec } from 'node:child_process'

/**
 * # Converting Keybinding Definitions to Actions
 *
 * This module defines the schema of the configuration file using TypeScript
 * interfaces. We parse the configuration JSON to TypeScript objects which
 * directly define all the valid keyboard sequences and the commands that these
 * will invoke.
 */
//#region -c action.ts imports
import * as vscode from 'vscode'
//#endregion
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
interface Keymap {
    id: number
    help: string
    [key: string]: Action
}

export interface Keymodes {
    normal: Keymap,
    [mode: string]: Keymap | undefined
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
 * Another thing you can set in config, is whether ModalKeys starts in normal
 * mode.
 */
let startInNormalMode: boolean
/**
 * The root of the action configuration is keymap. This defines what key
 * sequences will be run when keys are pressed in normal mode.
 */
let rootKeymodes: Keymodes
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

export function getStartInNormalMode(): boolean {
    return startInNormalMode
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
    startInNormalMode = config.get<boolean>("startInNormalMode", true)
}
/**
 * The following function updates base keymap and select-mode keymap.
 */
function UpdateKeybindings(config: vscode.WorkspaceConfiguration) {
    log("Validating keybindings in 'settings.json'...")
    keymapsById = {}
    let [modes, errors] = expandBindings(config.get<any>("keybindings"))
    if(!isKeymap(modes?.normal))
        log("ERROR: Missing valid normal mode keybindings. Keybindings not updated.")
    else if(modes){
        rootKeymodes = <Keymodes>(mapValues(modes, mode => {
            if (isKeymap(mode)) {
                errors += validateAndResolveKeymaps(mode)
            }
            return mode
        }))
    }
    if (errors > 0)
        log(`Found ${errors} error${errors > 1 ? "s" : ""}. ` +
            "Keybindings might not work correctly.")
    else
        log("Validation completed successfully.")
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
            else if (typeof target === 'number') {
                let id = target
                target = keymapsById[id]
                if (!target)
                    error(`Undefined keymap id: ${id}`)
                else
                    keybindings[key] = target
            }
            if (key.match(/[0-9]+/) || (key.length > 1 && key !== '__keymap'))
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
            log(`ERROR: command has multiple heads: ${keys.join(", ")}`)
        }
        return { command: keys[0], args: x[keys[0]], repeat: x.repeat }
    }else {
        log(`ERROR: command is of unknown form (displaying value below).`)
        log(JSON.stringify(x, null, 2))
        return 'UNKNOWN_COMMAND_FORM'
    }
}

function expandEntryBindingsFn(state: { errors: number, sequencesFor: IHash<string[]>, withCommand?: string }){
    return ([key, val]: [string, any]): [string, Action][] => {
        if(key === '__keymap'){ return [] }
        if(key.startsWith('::using::')){
            if(state.withCommand){
                log(`ERROR: cannot nest '::using::' directives, ignoring child directive.`)
            }else {
                return flatten(sortBy(Object.entries(val),normalFirst).map(expandEntryBindingsFn({
                    errors: state.errors,
                    sequencesFor: state.sequencesFor,
                    withCommand: key.split('::')[2]
                })))
            }
        }
        if(state.withCommand){
            val = { [state.withCommand]: val }
        }
        let res = key.match(/^(([a-z|]{2,})::)?((.|\s)*)$/)
        if(key.match(/[a-z|]{3,}:[^:](.*)$/)){
            log(`WARN the entry '${key}' looks like you might be trying to select a mode, did you mean to use a '::' instead of ':'?`)
        }
        if(res){
            let [ match, g1, givenMode, seq ] = res
            let obj: any = expandCommands(val)
            for(let i = seq.length-1; i>=0; i--){
                obj = {[seq[i]]: obj}
            }
            let modes = (givenMode ? givenMode.split('|') : ['__all__'])
            let newErrors = false
            for(let mode of modes){
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
            }
            return !newErrors ? modes.map(mode => [mode, obj]) : []
        }else {
            log(`ERROR invalid binding entry '${key}'`)
            return []
        }
    }
}

function expandBindings(bindings: any): [Keymodes | undefined, number] {
    let state = {sequencesFor: <IHash<string[]>>{}, errors: 0}
    let allEntries = flatten(sortBy(Object.entries(bindings),normalFirst).
        map(expandEntryBindingsFn(state)))
    let allModes = uniq(allEntries.map(x => x[0]))
    allModes.push('normal', 'visual')
    allModes = uniq(allModes)
    let result: any = {}
    for(let [key, value] of allEntries){
        if(key !== '__all__'){
            result = mergeWith(result, {[key]: value}, (oldval: Action, newval: Action) => {
                if(isCommand(oldval)){
                    return newval
                }
            })
        }else{
            for(let mode of allModes){
                result = mergeWith(result, {[mode]: value}, (oldval: Action, newval: Action) => {
                    if(isCommand(oldval)){ return newval }
                })
            }
        }
    }
    return [result, state.errors]
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

export class KeyState {
    argumentCount?: number
    countFinalized: boolean = false
    currentKeymap?: Keymap
    keySequence: string[] = []
    capturedKeys: string[] = []
    modeCaptures: IHash<string>
    constructor(modeCaptures: IHash<string>, parent?: KeyState){
        this.modeCaptures = { ...(parent?.modeCaptures || {}), ...modeCaptures }
    }

    waitingForKey() { return this.currentKeymap !== undefined || this.argumentCount !== undefined }
    reset() {
        this.currentKeymap = undefined
        this.argumentCount = undefined
        this.countFinalized = false
        this.keySequence = []
        this.capturedKeys = []
    }

    update(keymap: Keymap | undefined){
        if(keymap){
            this.currentKeymap = keymap
            this.countFinalized = true
        }else{
            this.reset()
        }
    }

    updateCount(val: number){
        if(this.countFinalized){
            this.error()
        }else{
            this.argumentCount = 10*(this.argumentCount || 0) + Number(val)
        }
    }

    error(){
        vscode.window.showWarningMessage("ModalKeys - Undefined key binding: " + this.keySequence.join(""))
        this.reset()
    }


    /**
     * `evalString` function evaluates JavaScript expressions. Before doing so, it
     * defines some variables that can be used in the evaluated text.
     */
    evalString__(str: string, __mode: string): any {
        let __file = undefined
        let __line = undefined
        let __col = undefined
        let __char = undefined
        let __selection = undefined
        let __count = this.argumentCount || 1
        let editor = vscode.window.activeTextEditor
        if (editor) {
            let cursor = editor.selection.active
            __file = editor.document.fileName
            __line = cursor.line
            __col = cursor.character
            __char = editor.document.getText(new vscode.Range(cursor,
                cursor.translate({ characterDelta: 1 })))
            __selection = editor.document.getText(editor.selection)
        }
        return eval(`(${str})`)
    }
    evalString(str: string, __mode: string): any {
        try {
            return this.evalString__(str, __mode)
        }
        catch (error) {
            vscode.window.showErrorMessage("Evaluation error: " + error.message)
            return undefined
        }
    }

    /**
     * We need the evaluation function when executing conditional command. The
     * condition is evaluated and if a key is found that matches the result, it is
     * executed.
     */
    async executeConditional(cond: Conditional, mode: string): Promise<void> {
        let res = this.evalString(cond.if, mode)
        if (res && isAction(cond.then)){
            await this.execute(cond.then, mode)
        }else if(!res && isAction(cond.else)){
            await this.execute(cond.else, mode)
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
    async executeParameterized(action: Parameterized, mode: string) {
        let this_ = this
        let repeat: number = 1
        async function exec(args?: any) {
            let cont = true
            for (let i = 0; i < repeat; i++)
                await this_.executeVSCommand(action.command, args)
        }
        if (action.repeat) {
            if (action.repeat == '__count'){
                repeat = this.argumentCount || 1
            }
        }
        if (action.args) {
            await exec(this.replaceVars(action.args, mode))
        }
        else
            await exec()
    }

    evalStringOrText(val: string, mode: string){
        try{
            return this.evalString__(val, mode)
        }catch {
            return val
        }
    }

    replaceVars(args: object, mode: string){
        let editor = vscode.window.activeTextEditor
        let result: any = {}
        for(const entry of Object.entries(args)){
            let [key, val] = entry
            val = val === '__line' ? editor?.selection?.active?.line :
                val === '__count' ? this.argumentCount || 1 :
                val === '-__count' ? -(this.argumentCount || 1) :
                val === '__mode' ? mode :
                isString(val) && /[+-/*]|__/.test(val) ? this.evalStringOrText(val, mode) :
                val
            result[key] = val
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
    async execute(action: Action, mode: string) {
        if (isString(action)){
            await this.executeVSCommand(action)
            this.reset()
        }else if (isCommandSequence(action)){
            for (const command of action) await this.execute(command, mode)
            this.reset()
        }else if (isConditional(action)){
            await this.executeConditional(action, mode)
        }else if (isParameterized(action)){
            await this.executeParameterized(action, mode)
            this.reset()
        }else{
            this.update(<Keymap>action)
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
        try {
            await vscode.commands.executeCommand(command, ...rest)
        }
        catch (error) {
            vscode.window.showErrorMessage(error.message)
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
        let newKeymap: undefined | Keymap = this.currentKeymap || rootKeymodes[keyMode]

        this.keySequence.push(key)
        const command = this.modeCaptures[keyMode]
        if (command){
            this.capturedKeys.push(key)
            await this.executeVSCommand(command, key)
        }else if (newKeymap && newKeymap[key]) {
            await this.execute(newKeymap[key], keyMode)
        }
        else if (key.match('[0-9]+')) {
            this.updateCount(Number(key))
        }
        else {
            this.error()
        }
    }

    getHelp() { return this.currentKeymap?.help }
}

