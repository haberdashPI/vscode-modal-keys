import * as vscode from 'vscode';
import jsep, { Expression, Identifier, Literal, MemberExpression } from "jsep";

export function evalExpressionsInString(str: string, values: any) {
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

export function evalStr(str: string, values: any) {
    let parsed: Expression;
    try {
        parsed = jsep(str);
    } catch (e: any) {
        vscode.window.showErrorMessage(`${e.description} at offset ${e.index} in ${str}`);
        return str;
    }
    return evalExpression(str, parsed, values);
}

function evalExpression(stre: string, exp: Expression, values: any): any {
    if (exp.type === "MemberExpression") {
        let mem = <MemberExpression>exp;
        let obj = evalExpression(stre, mem.object, values);
        if (mem.computed) {
            let prop = evalExpression(stre, mem.property, values);
            let val = obj[prop];
            if (val === undefined) {
                vscode.window.showErrorMessage(`Undefined property ${prop} in expression ${stre}.`);
                throw new Error();
            }
            else { return val; }
        } else {
            if (mem.property.type === "Identifier") {
                let propertyId = <Identifier>mem.property;
                return obj[propertyId.name];
            } else {
                return undefined;
            }
        }
    } else if (exp.type === "Literal") {
        let lit = <Literal>exp;
        return lit.value;
    } else if (exp.type === "Identifier") {
        let id = <Identifier>exp;
        let val = values[id.name];
        if (val === undefined) {
            vscode.window.showErrorMessage(`Undefined identifier '${id.name}'`);
            throw new Error();
        }
        else { return val; }
    }
}
