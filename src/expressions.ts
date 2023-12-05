import * as vscode from 'vscode';
import SafeExpression, { EvalFun } from 'safe-expression';
import { mapValues } from 'lodash';

const buildEvaled = new SafeExpression();

export function reifyStrings(obj: any, ev: (str: string) => any): any {
    if (Array.isArray(obj)) { return obj.map(x => reifyStrings(x, ev)); }
    if (typeof obj === 'object') {
        return mapValues(obj, (val, prop) => { return reifyStrings(val, ev); });
    }
    if (typeof obj === 'string') { return ev(obj); }
    if (typeof obj === 'number') { return obj; }
    if (typeof obj === 'boolean') { return obj; }
    if (typeof obj === 'undefined') { return obj; }
    if (typeof obj === 'function') { return obj; }
    if (typeof obj === 'bigint') { return obj; }
    if (typeof obj === 'symbol') { return obj; }
}

export class EvalContext {
    private errors: string[] = [];
    private cache: Record<string, EvalFun> = {};

    reportErrors(){
        if(this.errors.length > 0){
            for(let e of this.errors.slice(0, 3)){
                vscode.window.showErrorMessage(e);
            }
            this.errors = [];
        }
    }

    evalExpressionsInString(str: string, values: Record<string, any>) {
        let result = "";
        let r = /\{.*?key.*?\}/g;
        let match = r.exec(str);
        let start_i = 0;
        while (match !== null) {
            let prefix = str.slice(start_i, match.index);
            let evaled;
            try {
                // slice to remove `{` and `}`
                evaled = this.evalStr(match[0].slice(1, -1), values);
            } catch (e) {
                evaled = undefined;
            }
            if (evaled === undefined) {
                this.errors.push(`The expression 
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

    evalStr(str: string, values: Record<string, any>) {
        let exec = this.cache[str];
        if (exec === undefined) {
            if (str.match(/(?<!=)=(?!=)/)) {
                this.errors.push(`Found an isolated "=" in this expression.
                Your expressions are not permitted to set any values. You should
                use 'modalkeys.set' to do that.`);
                return undefined;
            }
            this.cache[str] = exec = buildEvaled(str);
        }
        let result = str;
        try {
            // do not let the expression modify any of the `values`
            result = exec(values);
        } catch (e: any) {
            this.errors.push(`Error evaluating ${str}: ${e.message}`);
            return undefined;
        }
        return result;
    }
}
