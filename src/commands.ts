import * as vscode from 'vscode';
import { StrictDoArg, strictDoArgs } from './keybindingParsing';
import { reifyStrings, EvalContext } from './expressions';
import { fromZodError } from 'zod-validation-error';
import z from 'zod';
import { UnderlyingByteSource } from 'stream/web';

let modeStatusBar: vscode.StatusBarItem | undefined = undefined;
let keyStatusBar: vscode.StatusBarItem | undefined = undefined;
let countStatusBar: vscode.StatusBarItem | undefined = undefined;
let evalContext = new EvalContext();

function updateStatusBar(){
    if(modeStatusBar !== undefined && keyStatusBar !== undefined && 
       countStatusBar !== undefined){
        modeStatusBar.text = state.keyContext.mode || 'insert';
        keyStatusBar.text = state.keyContext.prefix || '';
        countStatusBar.text = state.keyContext.count ?
            state.keyContext.count + "×" : '';
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

function validateInput<T extends z.ZodRawShape>(command: string, args_: unknown, 
    using: z.ZodObject<T>) {

    let result = using.safeParse(args_);
    if(!result.success){
        vscode.window.showErrorMessage(`Unexpected arguments to '${command}': 
            ${fromZodError(result.error)}`);
        return;
    }
    return result.data;
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

const updateCountArgs = z.object({
    value: z.coerce.number()
});

function updateCount(args_: unknown){
    let args = validateInput('modalkeys.updateCount', args_, updateCountArgs);
    if(args !== undefined){
        state.setKeyContext('count', state.keyContext.count*10 + args.value);
    }
}

const prefixArgs = z.object({
    key: z.string(),
    flag: z.string().min(1).optional()
});

function prefix(args_: unknown){
    let args = validateInput('modalkeys.prefix', args_, prefixArgs);
    if(args !== undefined){
        state.setKeyContext('prefix', state.keyContext.prefix + " " + args.key);
        if(args.flag){
            state.setKeyContext(args.flag, true);
            state.transientValues.push(args.flag);
        }
    }
}

const setArgs = z.object({
    name: z.string(),
    value: z.any(),
    transient: z.boolean().default(false)
});

function set(args_: unknown){
    let args = validateInput('modalkeys.set', args_, setArgs);
    if(args){
        state.setKeyContext(args.name, args.value);
        if(args.transient){ state.transientValues.push(args.name); }
    }
}

function reset(){
    // clear any relevant state
    state.setKeyContext('count', 0);
    state.setKeyContext('prefix', '');
    for (let k in state.transientValues) {
        state.setKeyContext(k, undefined);
    }
    state.transientValues = [];
}

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

    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.do',
        runCommands
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.updateCount',
        updateCount
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.prefix',
        prefix
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.set',
        set
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.setMode',
        (x) => set({name: 'mode', value: x})
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.enterInsert',
        () => set({name: 'mode', value: 'insert'})
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.enterNormal',
        () => set({name: 'mode', value: 'normal'})
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.reset',
        reset
    ));

    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.ignore',
        () => undefined,
    ));
}

// TODO: after getting the above working, copy over search commands, and figure out how to hook into type
