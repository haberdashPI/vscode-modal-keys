import * as vscode from 'vscode';
import { StrictDoArgs, StrictDoArg, strictDoArgs } from './keybindingParsing';
import { reifyStrings, evalStr } from './expressions';
import { fromZodError } from 'zod-validation-error';

interface EvalContext{
    [k: string]: any
}

class CommandState {
    evalContext: EvalContext = {};
    transientValues: string[] = [];
    constructor(){ 
        this.setEvalContext('prefix', '');
        this.setEvalContext('count', 0);
        this.setEvalContext('mode', 'insert');
    }
    setEvalContext(key: string, value: any){
        this.evalContext[key] = value;
        vscode.commands.executeCommand('setContext', 'modlakeys.'+key, value);
    }
}
let state = new CommandState();


function runCommand(command: StrictDoArg){
    if(typeof command === 'string'){
        vscode.commands.executeCommand(command);
    }else{
        let finalArgs: Record<string, any> = command.args || {};
        if(command.computedArgs !== undefined){
            finalArgs = {...finalArgs, 
                        ...reifyStrings(command.computedArgs, str => evalStr(str, state.evalContext))};
        }
        vscode.commands.executeCommand(command.command, finalArgs);
    }
}

function runCommands(args_: unknown){
    let args_parsing = strictDoArgs.safeParse(args_);
    if(!args_parsing.success){
        vscode.window.showErrorMessage("Unexpected arguments to `modalkeys.do`: "+
            fromZodError(args_parsing.error));
    } else {
        let args = args_parsing.data;
        // run the commands
        if (Array.isArray(args)) { for (let arg of args) { runCommand(arg); } }
        else { runCommand(args); }

        reset();
    }
}

function updateCount(args_: unknown){
    let num: number | undefined = undefined;
    if((<any>args_).value === undefined){
        vscode.window.showErrorMessage(`Unexpected arguments to 'modalkeys.updateCount': 
            ${JSON.stringify(args_, null, 4)}`);
        return;
    }
    let args = <{ value: any }>args_;
    if(typeof args.value === 'string'){
        num = Number(args.value);
    }else if(typeof args.value === 'number'){
        num = args.value;
    }else{
        vscode.window.showErrorMessage(`Unexpected value of argument 'value' to 
            'modalkeys.updateCount': ${args.value}`);
        return;
    }

    if(num !== undefined){
        state.setEvalContext('count', state.evalContext.count*10 + num);
    }
}

function prefix(args_: unknown){
    if(!(<any>args_).key !== undefined){
        vscode.window.showErrorMessage(`Expected arguments to 'modalkeys.prefix' to have 
            a 'key' argument: ${JSON.stringify(args_, null, 4)}`);
    }
    let args = <{ key: unknown, flag?: unknown }> args_;
    if(args.key === 'string'){
        state.setEvalContext('prefix', state.evalContext.prefix + " " + args.key);
    }else{
        vscode.window.showErrorMessage(`Expected 'key' to be a string in 'modalkeys.prefix' 
            but got: ${JSON.stringify(args.flag, null, 4)}`);
        return;
    }
    if(args.flag){
        if(typeof args.flag === 'string'){
            state.setEvalContext(args.flag, true);
            state.transientValues.push(args.flag);
        }else{
            vscode.window.showErrorMessage(`Expected 'flag' to be a string in 
                'modalkeys.prefix' but got: ${JSON.stringify(args.flag, null, 4)}`);
        }
    }
}

function set(args_: unknown){
    if((<any>args_).name === undefined && (<any>args_).value === undefined){
        vscode.window.showErrorMessage(`'modalkeys.set' expects a 'name' and a 'value' 
            argument, but got the following arguments instead: 
            ${JSON.stringify(args_, null, 4)}`)
        return;
    }
    let args = <{name: unknown, value: any, transient?: unknown}>args_;
    // desired type: { name: string, value: any, transient?: boolean }
    if(args.name === 'string'){
        state.setEvalContext(args.name, args.value);
    }else{
        vscode.window.showErrorMessage(`'modalkeys.set' expects 'name' to be a string. Got
            the following instead: ${JSON.stringify(args.name, null, 4)}`);
        return;
    }
    if(args.transient !== undefined){
        if(typeof args.transient === 'boolean'){
            state.transientValues.push(args.name);
        }else{
            vscode.window.showErrorMessage(`'modalkeys.set' expects 'transient' to be a
                boolean value. Go the following instead: 
                ${JSON.stringify(args.name, null, 4)}`);
        }
    }
}

function reset(){
    // clear any relevant state
    state.setEvalContext('count', 0);
    state.setEvalContext('prefix', '');
    for (let k in state.transientValues) {
        state.setEvalContext(k, undefined);
    }
    state.transientValues = [];
}

export function activate(context: vscode.ExtensionContext) {
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
}

// TODO: after getting the above working, copy over search commands, and figure out how to hook into type
