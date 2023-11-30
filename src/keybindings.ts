import * as vscode from 'vscode';
import * as TOML from 'js-toml';
import * as semver from 'semver';
import hash from 'object-hash';
import { uniq, pick, omit, merge, cloneDeep, flatMap, values, mapValues, entries } from 'lodash';
import { TextDecoder } from 'util';
import { searchMatches } from './searching';
import { z } from "zod";
import { fromZodIssue } from 'zod-validation-error';
import jsep, { Identifier, Literal, MemberExpression } from "jsep";
import { Expression } from "jsep";

let decoder = new TextDecoder("utf-8");

////////////////////////////////////////////////////////////////////////////////////////////
// Keybinding File Format Specification

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
        let unmod_press = mods_and_press[mods_and_press.length-1]
        if(ALLOWED_KEYS.every(a => !a.test(unmod_press))){ return false; }
    }
    return true;
}

const bindingKey = z.string().refine(isAllowedKeybinding, arg =>
    { return { message: `Invalid keybinding '${arg}'` }})

const bindingItem = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    key: z.union([bindingKey, bindingKey.array()]).optional(),
    when: z.string().optional(),
    mode: z.string().optional(),
    allowed_prefixes: z.string().array().optional(),
    do: z.union([z.string(), bindingCommand, 
        z.array(z.union([z.string(), bindingCommand]))]).optional()
}).strict();
type BindingItem = z.infer<typeof bindingItem>;

// a strictBindingItem is satisfied after expanding all default fields
const strictBindingItem = bindingItem.required({
    key: true,
    mode: true,
}).extend({
    // do now requires `command` to be present when using the object form
    do: z.union([z.string(), bindingCommand.required({command: true}),
                 z.array(z.union([z.string(), bindingCommand.required({command: true})]))])
});
type StrictBindingItem = z.infer<typeof strictBindingItem>;

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
type BindingTree = z.infer<typeof bindingTreeBase> & OtherKeys;
const bindingTree: z.ZodType<BindingTree> = bindingTreeBase.catchall(z.lazy(() => bindingTree));

const strictBindingTree = bindingTreeBase.extend({
    items: strictBindingItem.array().optional()
});
type StrictBindingTree = z.infer<typeof strictBindingTree> & OtherKeys;

// TODO: unit test - verify that zod recursively validates all 
// elements of the binding tree

const bindingSpec = z.object({
    header: bindingHeader,
    bind: bindingTree,
    define: z.object({}).passthrough()
});
type BindingSpec = z.infer<typeof bindingSpec>;

////////////////////////////////////////////////////////////////////////////////////////////
// Keybinding Interpretation

// This is the core logic that actually translates a keybinding file into vscode compatible
// keybinding json objects

// TODO: to check in unit tests:
// - all arrays and primitive types get preserved
// - defaults get expanded appropriately in deeply
//   nested situations
function expandDefaults(bindings: BindingTree, prefix: string = "bind", default_item: BindingItem = {}): StrictBindingTree {
    if (bindings.default !== undefined) {
        default_item = { ...default_item, ...<BindingItem>bindings.default };
    }

    let items: StrictBindingItem[] | undefined = undefined;
    if (bindings.items !== undefined) {
        let validated_items = bindings.items.map((item: BindingItem, i: number) => {
            let expandedItem = merge(cloneDeep(default_item), item);
            let parsing = strictBindingItem.safeParse(expandedItem);
            if(!parsing.success){
                let issue = parsing.error.issues[0];
                vscode.window.showErrorMessage(`Problem with item ${i} under ${prefix}: 
                    ${issue.message} ${issue.path}`);
                return undefined;
            }else{
                return parsing.data;
            }
        });
        items = <StrictBindingItem[]>validated_items.filter(x => x !== undefined);
    }

    let non_items = Object.entries(omit(bindings, ['name', 'description', 'kind', 'items', 'default']));
    let result: { [key: string]: BindingTree } = Object.fromEntries(non_items.map(([k, v]) => {
        let entry = (prefix === "" ? "" : prefix+".")+k;
        if(typeof v !== 'object'){
            vscode.window.showErrorMessage(`binding.${prefix} has unexpected field ${k}`);
            return [];
        }
        if(v.name !== undefined){
            // though type script can't enforce it statically, if v has a `name`
            // it is a binding tree
            return [k, expandDefaults(<BindingTree>v, entry, default_item)];
        }else{
            vscode.window.showErrorMessage(`binding.${entry} has no "name" field.`);
            return [];
        }
    }));

    let returnValue = {
        ...result,
        name: bindings.name,
        description: bindings.description,
        kind: bindings.kind,
        items
    };

    // I'm not sure exactly why this case is required, I think it is about the weirdness of
    // indexed keys in the type definition
    return <StrictBindingTree>returnValue;
}

function evalKeyExpressions(str: string, key: string, definitions: any){
    let result = ""
    let r = /\{.*?key.*?\}/g
    let match = r.exec(str);
    let start_i = 0
    while(match !== null){
        let prefix = str.slice(start_i, match.index)
        let evaled;
        try{
            // slice to remove `{` and `}`
            evaled = evalKeyStr(match[0].slice(1,-1), key, definitions);
        }catch(e){
            evaled = undefined;
        }
        if(evaled === undefined){
            vscode.window.showErrorMessage(`Don't know how to interpret the expression 
                ${match[0]} in ${str}}`)
            evaled = match[0]
        }
        result += prefix + evaled
        start_i += prefix.length + match[0].length; 
        match = r.exec(str.slice(start_i));
    }
    result += str.slice(start_i);
    return result
}

function evalKeyStr(str: string, key: string, definitions: any){
    let parsed: Expression;
    try{
        parsed = jsep(str);
    }catch(e: any){
        vscode.window.showErrorMessage(`${e.description} at offset ${e.index} in ${str}`)
        return str
    }
    return evalKeyExpression(str, parsed, key, definitions)
}

function evalKeyExpression(stre: string, exp: Expression, key: string, definitions: any): any {
    if(exp.type == "MemberExpression"){
        let mem = <MemberExpression>exp;
        let obj = evalKeyExpression(stre, mem.object, key, definitions);
        if(mem.computed){
            let prop = evalKeyExpression(stre, mem.property, key, definitions);
            let val = obj[prop]
            if(val === undefined){
                vscode.window.showErrorMessage(`Undefined property ${prop} in expression ${stre}.`)
                throw new Error();
            }
            else{ return val; }
        }else{
            if(mem.property.type == "Identifier"){
                let propertyId = <Identifier>mem.property;
                return obj[propertyId.name];
            }else{
                return undefined;
            }
        }
    }else if(exp.type == "Literal"){
        let lit = <Literal>exp;
        return lit.value;
    }else if(exp.type == "Identifier"){
        let id = <Identifier>exp;
        if(id.name === 'key'){ return key; }
        let val = definitions[id.name]
        if(val === undefined){
            vscode.window.showErrorMessage(`Undefined identifier '${id.name}'`)
            throw new Error();
        }
        else{ return val; }
    }
}

// TODO: check in unit tests
// invalid items (e.g. both key and keys defined) get detected
function reifyItemKey(obj: any, k: string, definitions: any): any {
    return mapValues(obj, (val, prop) => {
        if(prop === "keys"){ return undefined; }
        if(typeof val === 'string'){ return evalKeyExpressions(val, k, definitions); }
        if(typeof val === 'number'){ return val; }
        if(typeof val === 'boolean'){ return val; }
        if(typeof val === 'undefined'){ return val; }
        if(Array.isArray(val)){ return val.map(x => reifyItemKey(x, k, definitions)); }
        return reifyItemKey(val, k, definitions);
    });
}

function expandBindingKeys(bindings: StrictBindingItem[], definitions: any): StrictBindingItem[] {
    return flatMap(bindings, item => {
        if(Array.isArray(item.key)){
            return item.key.map(k => {return {...reifyItemKey(omit(item, 'key'), k, definitions), key: k};});
        }else{
            return [item];
        }
    });
}

function listBindings(bindings: StrictBindingTree): StrictBindingItem[] {
    return flatMap(Object.keys(bindings), key => {
        if(key === 'items' && bindings.items){ return bindings.items; }
        let val = bindings[key];
        if(typeof val === 'string'){ return []; }
        if(typeof val === 'number'){ return []; }
        if(typeof val === 'boolean'){ return []; }
        if(typeof val === 'undefined'){ return []; }
        if(typeof val === 'object'){ return listBindings(<StrictBindingTree>val); }
        return [];
    });
}

interface IConfigKeyBinding {
    key: string,
    command: "modalkeys.do" | "modalkeys.prefix"
    name?: string,
    description?: string,
    mode?: string,
    when?: string,
    args: { do: string | object } | { key: string }
}

function itemToConfigBinding(item: StrictBindingItem): IConfigKeyBinding {
    return {
        key: <string>item.key,
        name: item.name,
        description: item.description,
        mode: item.mode,
        when: item.when,
        command: "modalkeys.do",
        args: { do: item.do }
    };
}

function validateUniqueForBinding(vals: (string | undefined)[], name: string, item: any): string | undefined {
    let uvals = uniq(vals.filter(v => v !== undefined));
    if(uvals.length > 1){
        vscode.window.showErrorMessage(`Multiple values of \`${name}\` for idenictal 
            binding \`${item.key}\` in mode "${item.mode}". Update the bindings file
            to use only one name for this binding regardless of its \`when\` clause
            You can also safely leave all but one of these bindings with a \`${name}\`
            field.`);
        return;
    }
    if(uvals.length === 0){
        vscode.window.showErrorMessage(`No \`${name}\` provided for binding \`${item.key}\`
            in mode "${item.mode}".`);
        return;
    }
    return uvals[0];
}

// For any items that have duplicate bindings with distinct when clauses (before the
// transformations applied below) make sure that `name` and `description` are identical or
// blank, and use the non-blank value in all instances

// TODO: the obvious unit test is to have non-unique documentation
// and blank documentation for some when clauses

// TODO: debug this function
function expandBindingDocsAcrossWhenClauses(items: StrictBindingItem[]): StrictBindingItem[] {
    let sharedBindings: { [key: string]: any[] } = {};
    for (let item of items) {
        let k = hash({ key: item.key, mode: item.mode });
        if (sharedBindings[k] === undefined) {
            sharedBindings[k] = [item];
        } else {
            sharedBindings[k] = [...sharedBindings[k], item];
        }
    }

    let sharedDocs: {
        [key: string]: {
            name: string | undefined,
            description: string | undefined
        }
    } = {};
    for (let [key, item] of entries(sharedBindings)) {
        if (item.length <= 1) { continue; }
        let name = validateUniqueForBinding(item.map(i => (<string | undefined>i.name)),
            "name", item[0]);
        let description = validateUniqueForBinding(item.map(i => (<string | undefined>i.description)),
            "description", item[0]);

        sharedDocs[key] = { name, description };
    }

    return items.map((item: any) => {
        let k = hash({ key: item.key, mode: item.mode });
        if (sharedDocs[k] !== undefined) {
            let docs = sharedDocs[k];
            return { ...item, name: docs.name, description: docs.description };
        } else {
            return item;
        }
    });
}

function moveModeToWhenClause(binding: StrictBindingItem){
    let expandedWhen = "";
    if(binding.when !== undefined){
        expandedWhen += `(${binding.when})`;
    }

    if(binding.mode !== undefined){
        if(expandedWhen.length > 0){ expandedWhen += ` && `; }
        if(binding.mode.startsWith("!")){
            expandedWhen += `(modalkeys.mode != '${binding.mode.slice(1)}')`;
        }else{
            expandedWhen += `(modalkeys.mode == '${binding.mode}')`;
        }
    }

    return {...binding, when: expandedWhen};
}

function expandAllowedPrefixes(expandedWhen: string, item: BindingItem){
    // add any optionally allowed prefixes
    if(expandedWhen.length > 0){ expandedWhen += ` && `; }
    expandedWhen += "((modalkeys.prefix == '')";
    if(item.allowed_prefixes !== undefined){
        for(let allowed of item.allowed_prefixes){
            expandedWhen += ` || (modalkeys.prefix == '${allowed}')`;
        }
    }
    expandedWhen += ")";

    return expandedWhen;
}

type BindingMap = { [key: string]: IConfigKeyBinding };
function extractPrefixBindings(item: IConfigKeyBinding, prefixItems: BindingMap = {}){
    let when = "";
    let prefix = "";
    if(item.when !== undefined){ when += `(${item.when})`; }

    if(item.key !== undefined){
        if(typeof item.key.trim  !== 'function'){
            console.log("WhAT?!");
        }

        let key_seq = item.key.trim().split(/\s+/);

        for(let key of key_seq.slice(0, -1)){
            let expandedWhen = "";
            if(prefix === ""){
                expandedWhen = expandAllowedPrefixes(when, item);
            }else{
                if(expandedWhen.length > 0) { expandedWhen += " && "; }
                expandedWhen += `(modalkeys.prefix == '${prefix}')`;
            }
            // track the current prefix for the next iteration of `map`
            if(prefix.length > 0){ prefix += " "; }
            prefix += key;

            let prefixItem: IConfigKeyBinding = {key, command: "modalkeys.prefix", when: expandedWhen, args: {key}}; 
            let prefixKey = hash({key, mode: item.mode, when: item.when});
            prefixItems[prefixKey] = prefixItem;
        }

        let expandedWhen = when;
        if(expandedWhen.length > 0) { expandedWhen += " && "; }
        expandedWhen += `(modalkeys.prefix == '${prefix}')`;
        return {...item, when: expandedWhen, key: key_seq[key_seq.length-1]};
    }
    return item;
}

function processBindings(spec: BindingSpec){
    let expandedSpec = expandDefaults(spec.bind);
    let items = listBindings(expandedSpec);
    items = expandBindingKeys(items, spec.define);
    items = expandBindingDocsAcrossWhenClauses(items);
    let bindings = items.map(item => {
        item = moveModeToWhenClause(item);
        return itemToConfigBinding(item);
    });
    let prefixBindings: BindingMap = {};
    bindings = bindings.map(b => extractPrefixBindings(b, prefixBindings));
    return bindings.concat(values(prefixBindings));
}

async function parseBindingFile(file: vscode.Uri){
    let file_data = await vscode.workspace.fs.readFile(file);
    let file_text = decoder.decode(file_data);
    if(file.fsPath.endsWith(".json")){
        return bindingSpec.safeParse(JSON.parse(file_text));
    }else{
        return bindingSpec.safeParse(TOML.load(file_text));
    }
}

const AUTOMATED_COMMENT_START_PREFIX = `
    // AUTOMATED BINDINGS START: ModalKey Bindings 
    //
    // These bindings were automatically inserted by the ModalKeys extension from the
    // following file: 
    //
`;

const AUTOMATED_COMMENT_START_SUFFIX = `
    //
    // Leave this comment (and the one denoting the end) unmodified to ensure the automated
    // bindings are properly updated if/when you insert another preset. Add any additional
    // bindings you want *outside* of the automated bindings region as it will be modified
    // when new presets are imported.
`;

const AUTOMATED_COMMENT_END = `
    // AUTOMATED BINDINGS END: ModalKey Bindings

    // Leave this comment (and the one denoting the start) unmodified to ensure the
    // automated bindings are properly updated if/when you insert another preset
`;

function findText(doc: vscode.TextDocument, text: string) {
    let matches = searchMatches(doc, new vscode.Position(0, 0), undefined, text, {});
    let first_match_result = matches.next();
    if (first_match_result.done) { return undefined; }

    return first_match_result.value;
}

function formatBindings(file: vscode.Uri, items: BindingItem[]){
    let json = "";
    for(let item of items){
        let comment = "";
        if(item.name !== undefined && item.description !== undefined){
            comment += `${item.name}: ${item.description}`;
        }else if(item.name !== undefined){
            comment += item.name;
        }else if(item.description !== undefined){
            comment += item.description;
        }

        // TODO: fix find replace
        json += comment.replaceAll(/^\s*(?=\S+)/mg, "    // ")+"\n";
        json += JSON.stringify(pick(item, ['key', 'when', 'command', 'args']), 
            null, 4).replaceAll(/^/mg, "    ");
        json += ",\n\n";
    }
    return (
        AUTOMATED_COMMENT_START_PREFIX+
        "    // `"+file.toString()+"`"+
        AUTOMATED_COMMENT_START_SUFFIX+
        "\n" + json +
        AUTOMATED_COMMENT_END
    );
}

async function insertKeybindingsIntoConfig(file: vscode.Uri, config: any) {
    await vscode.commands.executeCommand('workbench.action.openGlobalKeybindingsFile');
    let ed = vscode.window.activeTextEditor;
    if (ed){
        let bracket = findText(ed.document, "[");
        if (!bracket) {
            vscode.window.showErrorMessage("Could not find opening `[` at top of " +
                "keybindings file. Your keybinding file does not appear to be " +
                "proplery formatted.");
            return;
        } else {
            let insert_at = bracket.end;
            let bindings_to_insert = formatBindings(file, config);

            // try and replace the old bindings
            let old_bindings_start = findText(ed.document, "AUTOMATED BINDINGS START");
            let old_bindings_end = findText(ed.document, "AUTOMATED BINDINGS END");
            ed.document.getText(old_bindings_start);
            if (old_bindings_start && old_bindings_end) {
                let range = new vscode.Range(
                    new vscode.Position(old_bindings_start.start.line-1, 
                                        ed.document.lineAt(old_bindings_start.start.line-1).range.end.character),
                    new vscode.Position(old_bindings_end.end.line + 4, 0));
                await ed.edit(builder => {
                    builder.replace(range, bindings_to_insert);
                });
                // TODO: uncomment after debugging
                // vscode.commands.executeCommand('workbench.action.files.save');
                vscode.window.showInformationMessage(`Your modal key bindings have
                    been updated in \`keybindings.json\`.`);
            } else if (old_bindings_end || old_bindings_start){
                vscode.window.showErrorMessage(`You appear to have altered the comments
                    around the automated bindings. Please delete the old, automated
                    bindings manually and then re-run this command.`);
            }else {
                // if there are no old bindings, insert new ones
                await ed.edit(builder => {
                    builder.insert(insert_at, "\n" + bindings_to_insert);
                });
                // TODO: uncomment after debugging 
                // TODO: also have the cursor moved to the start of the 
                // automated bindings
                // vscode.commands.executeCommand('workbench.action.files.save');
                vscode.window.showInformationMessage(`Your modal key bindings have
                    been inserted into \`keybindings.json\`.`);
            }
        }
    }
}


////////////////////////////////////////////////////////////////////////////////////////////
// User-facing commands and helpers

async function queryBindingFile() {
    // TODO: improve this interface; there should be some predefined set of presets and you
    // can add your own to the list (these can get saved using globalStorageUri)
    let file = await vscode.window.showOpenDialog({
        openLabel: "Import Modal-Key-Binding Spec",
        filters: { Preset: ["json", "toml"] },
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false
    });
    if(!file || file.length !== 1) { return undefined; }
    return file[0];
}

async function importBindings() {
    let file = await queryBindingFile();
    if (file === undefined) { return; }
    let parsedBindings = await parseBindingFile(file);
    if(parsedBindings.success){
        let bindings = processBindings(parsedBindings.data);
        insertKeybindingsIntoConfig(file, bindings);
    }else{
        let v = bindingHeader.shape.version;
        let d = bindingItem.shape.do;
        for (let issue of parsedBindings.error.issues.slice(0, 3)) {
            vscode.window.showErrorMessage(`Parsing of bindings failed. 
                ${fromZodIssue(issue)}`);
        }
    }
}

// TODO: we also evenutally want to have a way to customize presets
// without having to modify it (for small tweaks)
// TODO: we want to be able to export a preset to a file
// TODO: we should be able to delete user defined presets

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.importBindings',
        importBindings
    ));
}
