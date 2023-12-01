import * as vscode from 'vscode';
import * as TOML from 'js-toml';
import * as semver from 'semver';
import { TextDecoder } from 'util';
import { z } from "zod";

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
    /(f[1-9])|(f1[0-9])/i, /a-z/, /0-9/,
    /`/, /-/, /=/, /\[/, /\]/, /\\/, /;/, /'/, /,/, /./, /\//,
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

function isAllowedKeybinding(key: string){
    for(let press of key.split(/\s+/)){
        let mods_and_press = press.split("+");
        for(let mod of mods_and_press.slice(0, -1)){
            if(!ALLOWED_MODIFIERS.test(mod)){ return false; }
        }
        let unmod_press = mods_and_press[mods_and_press.length-1];
        if(ALLOWED_KEYS.every(a => !a.test(unmod_press))){ return false; }
    }
    return true;
}

const bindingKey = z.string().refine(isAllowedKeybinding, arg =>
    { return { message: `Invalid keybinding '${arg}'` }; });

export const bindingItem = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    key: z.union([bindingKey, bindingKey.array()]).optional(),
    when: z.string().optional(),
    mode: z.string().optional(),
    allowed_prefixes: z.string().array().optional(),
    do: z.union([z.string(), bindingCommand, 
        z.array(z.union([z.string(), bindingCommand]))]).optional()
}).strict();
export type BindingItem = z.infer<typeof bindingItem>;

// a strictBindingItem is satisfied after expanding all default fields
export const strictBindingItem = bindingItem.required({
    key: true,
    mode: true,
}).extend({
    // do now requires `command` to be present when using the object form
    do: z.union([z.string(), bindingCommand.required({command: true}),
                 z.array(z.union([z.string(), bindingCommand.required({command: true})]))])
});
export type StrictBindingItem = z.infer<typeof strictBindingItem>;

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

export const bindingSpec = z.object({
    header: bindingHeader,
    bind: bindingTree,
    define: z.object({}).passthrough()
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
