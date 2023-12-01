import * as vscode from 'vscode';
import SafeExpression, { EvalFun } from 'safe-expression';
import { mapValues } from 'lodash';

export function evalExpressionsInString(str: string, values: Record<string, any>) {
    let result = "";
    let r = /\{.*?key.*?\}/g;
    let match = r.exec(str);
    let start_i = 0;
    while (match !== null) {
        let prefix = str.slice(start_i, match.index);
        let evaled;
        try {
            // slice to remove `{` and `}`
            evaled = evalStr(match[0].slice(1, -1), values);
        } catch (e) {
            evaled = undefined;
        }
        if (evaled === undefined) {
            vscode.window.showErrorMessage(`Don't know how to interpret the expression 
                ${match[0]} in ${str}}`);
            evaled = match[0];
        }
        result += prefix + evaled;
        start_i += prefix.length + match[0].length;
        match = r.exec(str.slice(start_i));
    }
    result += str.slice(start_i);
    return result;
}

export function reify(obj: any, ev: (str: string) => any): any {
    return mapValues(obj, (val, prop) => {
        if(prop === "keys"){ return undefined; }
        if(typeof val === 'string'){ return ev(val); }
        if(typeof val === 'number'){ return val; }
        if(typeof val === 'boolean'){ return val; }
        if(typeof val === 'undefined'){ return val; }
        if(Array.isArray(val)){ return val.map(x => reify(x, ev)); }
        return reify(val, ev);
    });
}

const evaledExpressions: Record<string, EvalFun> = {};
const buildEvaled = new SafeExpression();

export function evalStr(str: string, values: Record<string, any>) {
    let exec = evaledExpressions[str];
    if(exec === undefined){
        evaledExpressions[str] = exec = buildEvaled(str);
    }
    let result = str;
    try{
        result = exec(values);
    }catch(e: any){
        vscode.window.showErrorMessage(`Error evaluating ${str}: ${e.message}`);
        return undefined;
    }
    return result;
}
