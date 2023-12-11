import * as vscode from 'vscode';
import * as TOML from 'js-toml';
import * as semver from 'semver';
import { TextDecoder } from 'util';
import { ZodIssue, preprocess, z } from "zod";
import { ZodError, fromZodError, fromZodIssue } from 'zod-validation-error';

let decoder = new TextDecoder("utf-8");

const bindingHeader = z.object({
    version: z.string().
        refine(x => semver.coerce(x), { message: "header.version is not a valid version number" }).
        refine(x => semver.satisfies(semver.coerce(x)!, '1'), 
               { message: "header.version is not a supported version number (must a compatible with 1.0)"}),
    required_extensions: z.string().array()
});
type BindingHeader = z.infer<typeof bindingHeader>;

const bindingCommand = z.object({
    command: z.string().optional(), // only optional before default expansion
    args: z.object({}).passthrough().optional(),
    computedArgs: z.object({}).passthrough().optional(),
}).strict();

const ALLOWED_MODIFIERS = /Ctrl|Shift|Alt|Cmd|Win|Meta/i;
const ALLOWED_KEYS = [
    /<all-keys>/, /(f[1-9])|(f1[0-9])/i, /[a-z]/, /[0-9]/,
    /`/, /-/, /=/, /\[/, /\]/, /\\/, /;/, /'/, /,/, /\./, /\//,
    /left/i, /up/i, /right/i, /down/i, /pageup/i, /pagedown/i, /end/i, /home/i,
    /tab/i, /enter/i, /escape/i, /space/i, /backspace/i, /delete/i,
    /pausebreak/i, /capslock/i, /insert/i,
    /numpad[0-9]/i, /numpad_multiply/i, /numpad_add/i, /numpad_separator/i,
    /numpad_subtract/i, /numpad_decimal/i, /numpad_divide/i,
    // layout independent versions
    /(\[f[1-9]\])|(\[f1[0-9]\])/i, /\[Key[A-Z]\]/i, /\[Digit[0-9]\]/i, /\[Numpad[0-9]\]/i,
    /\[Backquote\]/, /\[Minus\]/, /\[Equal\]/, /\[BracketLeft\]/, /\[BracketRight\]/, 
    /\[Backslash\]/, /\[Semicolon\]/, /\[Quote\]/, /\[Comma\]/, /\[Period\]/, /\[Slash\]/,
    /\[ArrowLeft\]/, /\[ArrowUp\]/, /\[ArrowRight\]/, /\[ArrowDown\]/, /\[PageUp\]/, 
    /\[PageDown\]/, /\[End\]/, /\[Home\]/, /\[Tab\]/, /\[Enter\]/, /\[Escape\]/, /\[Space\]/, 
    /\[Backspace\]/, /\[Delete\]/, /\[Pause\]/, /\[CapsLock\]/, /\[Insert\]/,
    /\[NumpadMultiply\]/, /\[NumpadAdd\]/, /\[NumpadComma\]/, /\[NumpadSubtract\]/, 
    /\[NumpadDecimal\]/, /\[NumpadDivide\]/,
];

function fullMatch(x: string, ex: RegExp){
    let m = x.match(ex);
    if(m === null){ return false; }
    return m[0].length === x.length;
}

function isAllowedKeybinding(key: string){
    for(let press of key.split(/\s+/)){
        let mods_and_press = press.split("+");
        for(let mod of mods_and_press.slice(0, -1)){
            if(!ALLOWED_MODIFIERS.test(mod)){ return false; }
        }
        let unmod_press = mods_and_press[mods_and_press.length-1];
        if(ALLOWED_KEYS.every(a => !fullMatch(unmod_press, a))){ return false; }
    }
    return true;
}

export async function showParseError(prefix: string, error: ZodError | ZodIssue){
    let suffix = "";
    if((<ZodIssue>error).code === undefined){ // code is always defined on issues and undefined on errors
        suffix = fromZodError(<ZodError>error).message;
    }else{
        suffix = fromZodIssue(<ZodIssue>error).message;
    }
    var buttonPattern = /\s+\{button:\s*"(.+)(?<!\\)",\s*link:(.+)\}/;
    let match = suffix.match(buttonPattern);
    if(match !== null && match.index !== undefined && match[1] !== undefined && 
       match[2] !== undefined){
        suffix = suffix.slice(0, match.index) + suffix.slice(match.index + match[0].length, -1);
        let button = match[1];
        let link = match[2];
        let pressed = await vscode.window.showErrorMessage(prefix + suffix, button);
        if(button === pressed){
            vscode.env.openExternal(vscode.Uri.parse(link));
        }
    }else{
        vscode.window.showErrorMessage(prefix + suffix);
    }
}

function keybindingError(arg: string){
    return { 
        message: `Invalid keybinding '${arg}'. Tip: capital letters are represented 
        using e.g. "shift+a". {button: "Keybinding Docs", 
        link:https://code.visualstudio.com/docs/getstarted/keybindings#_accepted-keys}` 
    };
}
const bindingKey = z.string().refine(isAllowedKeybinding, keybindingError).
    transform((x: string) => x.toLowerCase());

const doArg = z.union([z.string(), bindingCommand]);
const doArgs = z.union([doArg, doArg.array()]);

function prefixError(arg: string){
    return { 
        message: `Expected either an array of kebydinings or the string '<all-prefixes>', 
        but got '${arg}' instead`
    };
}

export const bindingItem = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    key: z.union([bindingKey, bindingKey.array()]).optional(),
    when: z.union([z.string(), z.string().array()]).optional(),
    mode: z.union([z.string(), z.string().array()]).optional(),
    allowed_prefixes: z.union([
        z.string().refine(x => {
            return x === "<all-prefixes>"
        }, prefixError), 
        z.union([bindingKey, z.string().max(0)]).array()
    ]).optional(),
    do: doArgs.optional(),
    resetTransient: z.boolean().default(true).optional()
}).strict();
export type BindingItem = z.infer<typeof bindingItem>;

// a strictBindingItem is satisfied after expanding all default fields
const strictBindingCommand = bindingCommand.required({command: true});

function preprocessWhen(x: unknown): string[] | undefined {
    if(x === undefined){ return x; }
    else if(Array.isArray(x)){ return x; }
    else if(typeof x === 'string'){ return [x]; }
    else{ return undefined; }
}

const strictDoArg = z.union([z.string(), strictBindingCommand]);
export const strictDoArgs = z.union([strictDoArg, strictDoArg.array()]);
export const strictBindingItem = bindingItem.required({
    key: true,
}).extend({
    // do now requires `command` to be present when using the object form
    do: strictDoArgs,
    when: z.preprocess(preprocessWhen, z.string().array().optional())
});
export type StrictBindingItem = z.infer<typeof strictBindingItem>;
export type StrictDoArg = z.infer<typeof strictDoArg>;
export type StrictDoArgs = z.infer<typeof strictDoArgs>;

const bindingTreeBase = z.object({
    name: z.string(),
    kind: z.string().optional(),
    description: z.string(),
    default: bindingItem.optional(),
    items: bindingItem.array().optional()
});
// BindingTree is a recursive type, keys that aren't defined above are
// nested BindingTree objects
type OtherKeys = {
    [key: string]: BindingTree | BindingItem | BindingItem | string | undefined
};
export type BindingTree = z.infer<typeof bindingTreeBase> & OtherKeys;
export const bindingTree: z.ZodType<BindingTree> = bindingTreeBase.catchall(z.lazy(() => bindingTree));

export const strictBindingTree = bindingTreeBase.extend({
    items: strictBindingItem.array().optional()
});
export type StrictBindingTree = z.infer<typeof strictBindingTree> & OtherKeys;

// TODO: unit test - verify that zod recursively validates all 
// elements of the binding tree

export const validModes = z.string().array().refine((ms: string[]) => ms.some(m => m === 'insert'),
    ms => {
        let modes = ms.join(', ');
        return { message: "The 'insert' mode is required, but the only modes were: " + modes };
    });

export const bindingSpec = z.object({
    header: bindingHeader,
    bind: bindingTree,
    define: z.object({ validModes: validModes }).passthrough().optional()
});
export type BindingSpec = z.infer<typeof bindingSpec>;

export async function parseBindingFile(file: vscode.Uri){
    let file_data = await vscode.workspace.fs.readFile(file);
    let file_text = decoder.decode(file_data);
    if(file.fsPath.endsWith(".json")){
        return bindingSpec.safeParse(JSON.parse(file_text));
    }else{
        return bindingSpec.safeParse(TOML.load(file_text));
    }
}
