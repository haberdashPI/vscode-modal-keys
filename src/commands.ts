import * as vscode from 'vscode';
import { StrictDoArgs, StrictDoArg } from './keybindingParsing';
import { reify, evalStr } from './expressions';

interface EvalContext{
    [k: string]: any
}

let state = {
    evalContext: <EvalContext>{
        prefix: '',
        count: 0,
        mode: 'insert'
    },
    transientValues: <string[]>[]
};

function runCommand(command: StrictDoArg){
    if(typeof command === 'string'){
        vscode.commands.executeCommand(command);
    }else{
        let finalArgs: Record<string, any> = command.args || {};
        if(command.computedArgs !== undefined){
            finalArgs = {...finalArgs, 
                        ...reify(command.computedArgs, str => evalStr(str, state.evalContext))};
        }
        vscode.commands.executeCommand(command.command, finalArgs);
    }
}

function runCommands(doArgs: StrictDoArgs){
    if(Array.isArray(doArgs)){
        for(let doArg of doArgs){
            runCommand(doArg);
        }
    }
    // clear any relevant state
    state.evalContext.count = 0;
    state.evalContext.prefix = '';
    for(let k in state.transientValues){
        state.evalContext[k] = undefined;
    }
    state.transientValues = [];
}

function updateCount(args: { value: any }){
    let num: number | undefined = undefined;
    if(typeof args.value === 'string'){
        num = Number(args.value);
    }else if(typeof args.value === 'number'){
        num = args.value;
    }else{
        vscode.window.showErrorMessage(`Unexpected argument to 'modalkeys.updateCount': 
            ${args.value}`);
        return;
    }

    if(num !== undefined){
        state.evalContext.count = state.evalContext.count*10 + num;
    }
}

function prefix(args: { key: string, flag?: string }){
    state.evalContext.prefix += " " + args.key;
    if(args.flag){
        state.evalContext[args.flag] = true;
        state.transientValues.push(args.flag);
    }
}

function set(args: { name: string, value: any, transient?: boolean }){
    state.evalContext[args.name] = args.value;
    if(args.transient){
        state.transientValues.push(args.name);
    }
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
}

// TODO: setup the various when conditions stuff here

// TODO: after getting the above working, copy over search commands, and figure out how to hook into type
