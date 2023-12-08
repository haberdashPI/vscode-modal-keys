import * as vscode from 'vscode';
import { StrictDoArg, strictDoArgs } from './keybindingParsing';
import { reifyStrings, EvalContext } from './expressions';
import { validateInput } from './utils';
import z from 'zod';
import { searchMatches } from './searching';

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

interface KeyContext{
    [k: string]: any
}

class CommandState {
    keyContext: KeyContext = {};
    transientValues: string[] = [];
    constructor(){ 
        this.setKeyContext('prefix', '');
        this.setKeyContext('count', 0);
        this.setKeyContext('mode', 'insert');
        this.setKeyContext('search', '');
    }
    setKeyContext(key: string, value: any){
        this.keyContext[key] = value;
        vscode.commands.executeCommand('setContext', 'modalkeys.'+key, value);
        updateStatusBar();
    }
}
let state = new CommandState();

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

async function runCommands(args_: unknown){
    let args = validateInput('modalkeys.do', args_, runCommandArgs);
    if(args){
        // run the commands
        if (Array.isArray(args.do)) { for (let arg of args.do) { await runCommand(arg); } }
        else { await runCommand(args.do); }

        if(args.resetTransient){ reset(); }
        evalContext.reportErrors();
    }
}
commands['modalkeys.do'] = runCommands;

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

export function set(args_: unknown){
    let args = validateInput('modalkeys.set', args_, setArgs);
    if(args){
        state.setKeyContext(args.name, args.value);
        if(args.transient){ state.transientValues.push(args.name); }
    }
}
commands['modalkeys.set'] = set;
commands['modalkeys.setMode'] = (x) => set({name: 'mode', value: 'insert'});
commands['modalkeys.enterInsert'] = (x) => set({name: 'mode', value: 'insert'});
commands['modalkeys.enterNormal'] = (x) => set({name: 'mode', value: 'normal'});

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
