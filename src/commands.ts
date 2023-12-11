import * as vscode from 'vscode';
import { StrictDoArg, strictDoArgs } from './keybindingParsing';
import { reifyStrings, EvalContext } from './expressions';
import { validateInput } from './utils';
import z from 'zod';
import { clearSearchDecorations, trackSearchUsage, wasSearchUsed } from './searching';

let modeStatusBar: vscode.StatusBarItem | undefined = undefined;
let keyStatusBar: vscode.StatusBarItem | undefined = undefined;
let countStatusBar: vscode.StatusBarItem | undefined = undefined;
let searchStatusBar: vscode.StatusBarItem | undefined = undefined;
let evalContext = new EvalContext();

let commands: Record<string, ((x: unknown) => any) | (() => any)> = {};

function updateStatusBar(){
    if(modeStatusBar !== undefined && keyStatusBar !== undefined && 
       countStatusBar !== undefined && searchStatusBar !== undefined){
        modeStatusBar.text = state.keyContext.mode || 'insert';
        keyStatusBar.text = state.keyContext.prefix || '';
        countStatusBar.text = state.keyContext.count ?
            state.keyContext.count + "×" : '';
        searchStatusBar.text = state.keyContext.search || '';
    }
}

const keyContext = z.object({
    prefix: z.string(),
    count: z.number(),
    mode: z.string(),
    search: z.string(),
    // require 'insert' and 'normal'? (or maybe only insert)
    validModes: z.string().array()
}).passthrough();
type KeyContext = z.infer<typeof keyContext>;

const keyContextKey = z.string().regex(/[a-zA-Z_]+[0-9a-zA-Z_]*/);

class CommandState {
    values: KeyContext = {
        prefix: '',
        count: 0,
        mode: 'insert',
        search: '',
        validModes: ['insert', 'normal']
    };
    transientValues: string[] = [];
    constructor(){ 
        for(let [k, v] of Object.entries(this.values)){
            vscode.commands.executeCommand('setContext', 'modalkeys.'+k, v);
        }
        updateStatusBar();
    }
    setKeyContext(key: string, value: any){
        validateInput('modalkeys.set', key, keyContextKey);
        // TODO: stopped here
        validateInput('modalkeys.set', value, keyContext.shape[key]);
        this.values[key] = value;
        vscode.commands.executeCommand('setContext', 'modalkeys.'+key, value);
        validateInput('modalkeys.set', this.values, keyContext);
        updateStatusBar();
    }
}
export let state = new CommandState();

async function runCommand(command: StrictDoArg){
    if(typeof command === 'string'){
        vscode.commands.executeCommand(command);
    }else{
        let finalArgs: Record<string, any> = command.args || {};
        if(command.computedArgs !== undefined){
            finalArgs = {...finalArgs, 
                        ...reifyStrings(command.computedArgs, str => evalContext.evalStr(str, state.keyContext))};
        }
        await vscode.commands.executeCommand(command.command, finalArgs);
    }
}

const runCommandArgs = z.object({ 
    do: strictDoArgs, 
    resetTransient: z.boolean().default(true) 
});
type RunCommandsArgs = z.infer<typeof runCommandArgs>;

async function runCommandsCmd(args_: unknown){
    let args = validateInput('modalkeys.do', args_, runCommandArgs);
    if(args){ return await runCommands(args); }
}
export async function runCommands(args: RunCommandsArgs){
    // run the commands
    trackSearchUsage();
    if (Array.isArray(args.do)) { for (let arg of args.do) { await runCommand(arg); } }
    else { await runCommand(args.do); }

    if(args.resetTransient){ 
        reset(); 
        if(!wasSearchUsed() && vscode.window.activeTextEditor){ 
            clearSearchDecorations(vscode.window.activeTextEditor) ;
        }
    }
    evalContext.reportErrors();
}
commands['modalkeys.do'] = runCommandsCmd;

const updateCountArgs = z.object({
    value: z.coerce.number()
});

function updateCount(args_: unknown){
    let args = validateInput('modalkeys.updateCount', args_, updateCountArgs);
    if(args !== undefined){
        state.setKeyContext('count', state.keyContext.count*10 + args.value);
    }
}
commands['modalkeys.updateCount'] = updateCount;

const prefixArgs = z.object({
    key: z.string(),
    flag: z.string().min(1).optional()
});

function prefix(args_: unknown){
    let args = validateInput('modalkeys.prefix', args_, prefixArgs);
    if(args !== undefined){
        if(state.keyContext.prefix.length > 0){
            state.setKeyContext('prefix', state.keyContext.prefix + " " + args.key);
        }else{
            state.setKeyContext('prefix', args.key);
        }
        if(args.flag){
            state.setKeyContext(args.flag, true);
            state.transientValues.push(args.flag);
        }
    }
}
commands['modalkeys.prefix'] = prefix;

// TODO: there needs to be more data validation for the standard state values; only
// arbitrary values should be free to be any value
const setArgs = z.object({
    name: z.string(),
    value: z.any(),
    transient: z.boolean().default(false)
});
type SetArgs = z.infer<typeof setArgs>;

function setCmd(args_: unknown){
    let args = validateInput('modalkeys.set', args_, setArgs);
    if(args){ setKeyContext(args); }
}
export function setKeyContext(args: SetArgs){
    state.setKeyContext(args.name, args.value);
    if(args.transient){ state.transientValues.push(args.name); }
}
commands['modalkeys.set'] = setCmd;
commands['modalkeys.setMode'] = (x) => setKeyContext({name: 'mode', value: 'insert', transient: false});
commands['modalkeys.enterInsert'] = (x) => setKeyContext({name: 'mode', value: 'insert', transient: false});
commands['modalkeys.enterNormal'] = (x) => setKeyContext({name: 'mode', value: 'normal', transient: false});

function reset(){
    // clear any relevant state
    state.setKeyContext('count', 0);
    state.setKeyContext('prefix', '');
    for (let k in state.transientValues) {
        state.setKeyContext(k, undefined);
    }
    state.transientValues = [];
}
commands['modalkeys.reset'] = reset;

commands['modalkeys.ignore'] = () => undefined;

export function activate(context: vscode.ExtensionContext) {
    modeStatusBar = vscode.window.createStatusBarItem('mode', vscode.StatusBarAlignment.Left);
    modeStatusBar.accessibilityInformation = { label: "Keybinding Mode" };
    modeStatusBar.show();

    countStatusBar = vscode.window.createStatusBarItem('count', vscode.StatusBarAlignment.Left);
    countStatusBar.accessibilityInformation = { label: "Current Repeat Count" };
    countStatusBar.show();

    keyStatusBar = vscode.window.createStatusBarItem('keys', vscode.StatusBarAlignment.Left);
    keyStatusBar.accessibilityInformation = { label: "Keys Typed" };
    keyStatusBar.show();

    searchStatusBar = vscode.window.createStatusBarItem('search', vscode.StatusBarAlignment.Left);
    searchStatusBar.accessibilityInformation = { label: "Search Text" };
    searchStatusBar.show();

    for (let [name, fn] of Object.entries(commands)) {
        context.subscriptions.push(vscode.commands.registerCommand(name, fn));
    }
}
