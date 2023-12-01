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
            vscode.window.showErrorMessage(`The expression 
                ${match[0]}, found in ${str}, could not be evaluated.`);
            evaled = match[0];
        }
        result += prefix + evaled;
        start_i += prefix.length + match[0].length;
        match = r.exec(str.slice(start_i));
    }
    result += str.slice(start_i);
    return result;
}

export function reifyStrings(obj: any, ev: (str: string) => any): any {
    if(Array.isArray(obj)){ return obj.map(x => reifyStrings(x, ev)); }
    if(typeof obj === 'object'){
        return mapValues(obj, (val, prop) => { return reifyStrings(val, ev); });
    }
    if(typeof obj === 'string'){ return ev(obj); }
    if(typeof obj === 'number'){ return obj; }
    if(typeof obj === 'boolean'){ return obj; }
    if(typeof obj === 'undefined'){ return obj; }
    if(typeof obj === 'function'){ return obj; }
    if(typeof obj === 'bigint'){ return obj; }
    if(typeof obj === 'symbol'){ return obj; }
}

const evaledExpressions: Record<string, EvalFun> = {};
const buildEvaled = new SafeExpression();

export function evalStr(str: string, values: Record<string, any>) {
    let exec = evaledExpressions[str];
    if(exec === undefined){
        if(str.match(/(?<!=)=(?!=)/)){
            vscode.window.showErrorMessage(`Found an isolated "=" in this expression.
                Your expressions are not permitted to set any values. You should
                use 'modalkeys.set' to do that.`);
            return undefined;
        }
        evaledExpressions[str] = exec = buildEvaled(str);
    }
    let result = str;
    try{
        // do not let the expression modify any of the `values`
        result = exec(values);
    }catch(e: any){
        vscode.window.showErrorMessage(`Error evaluating ${str}: ${e.message}`);
        return undefined;
    }
    return result;
}
