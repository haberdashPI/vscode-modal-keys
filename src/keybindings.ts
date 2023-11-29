import * as vscode from 'vscode';
import * as TOML from 'js-toml';
import * as semver from 'semver';
import hash from 'object-hash';
import { uniq, pick, omit, merge, cloneDeep, flatMap, values, mapValues, entries } from 'lodash';
import { TextDecoder } from 'util';
import { searchMatches } from './searching';
import zod from "zod";

let decoder = new TextDecoder("utf-8");

const bindingHeader = zod.object({
    version: zod.string().regex(/[0-9]+((\.[0-9]+)?\.[0-9]+)?/),
    required_extensions: zod.string().array()
});
type BindingHeader = zod.infer<typeof bindingHeader>;

const bindingItem = zod.object({
    // additional runtime constraint to verify: name and description must be defined
    // after expanding defaults
    namespace: zod.string().optional(),
    description: zod.string().optional(),
    // additional runtime constraint to verify: keys or key must be defined
    // after expanding defaults
    key: zod.string().optional(),
    keys: zod.string().array().optional(),
    when: zod.string().optional(),
    // additional runtime constraint to verify: mode must be defined after
    // expanding defaults
    mode: zod.string().optional(),
    allowed_prefixes: zod.string().array().optional(),
    // additional runtime constraint to verify: command or commands must be defined
    // after expanding defaults
    command: zod.string().optional(),
    args: zod.object({}).passthrough().optional(),
    computedArgs: zod.object({}).passthrough().optional(),
    commands: zod.union([zod.string(), zod.object({
        command: zod.string(),
        args: zod.object({}).passthrough().optional(),
        computedArgs: zod.object({}).passthrough().optional(),
    }).array()]).optional()
});
type BindingItem = zod.infer<typeof bindingItem>;

const bindingTreeElement = zod.object({
    name: zod.string(),
    kind: zod.string().optional(),
    description: zod.string(),
    default: bindingItem.optional(),
    items: bindingItem.array().optional()
});
// BindingTree is a recursive type, keys that aren't defined above are
// nested BindingTree objects
type BindingTree = zod.infer<typeof bindingTreeElement> & {
    [key: string]: BindingTree | BindingItem | BindingItem | string | undefined
};
const bindingTree: zod.ZodType<BindingTree> = bindingTreeElement.catchall(zod.lazy(() => bindingTree));

const bindingSpec = zod.object({
    header: bindingHeader,
    bind: bindingTree
});
type BindingSpec = zod.infer<typeof bindingSpec>;

async function queryBindingFile() {
    // TODO: improve this interface; there should be some predefined set of presets and you
    // can add your own to the list (these might all get added to some config in the user's
    // settings??)
    // Idea: there could be two commands; add preset and apply preset
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

async function validateHeader(bindings: any){
    let versionStr = <string>bindings?.header?.version;
    if(!versionStr){
        vscode.window.showErrorMessage(`Preset file is missing a version specifier in its 
            header.`);
        return;
    }
    
    let validVersion = semver.valid(versionStr);
    if(validVersion === null){
        vscode.window.showErrorMessage(`Invalid version number ${versionStr} in preset 
            header.`);
        return;
    }

    if(!semver.satisfies(validVersion, '1.x')){
        vscode.window.showErrorMessage(`Preset file version ${validVersion} is not 
            supported.`);
    }
    return bindings;
}

// TODO: to check in unit tests:
// - all arrays and primitive types get preserved
// - defaults get expanded appropriately in deeply
//   nested situations
function expandDefaults(bindings: BindingTree, prefix: string = "", default_item: BindingItem = {}): BindingTree {
    if (bindings.default !== undefined) {
        default_item = <BindingItem>{ ...default_item, ...<BindingItem>bindings.default };
    }

    let items: BindingItem[] | undefined = undefined;
    if (bindings.items !== undefined) {
        items = bindings.items.map((i: BindingItem) => {
            return merge(cloneDeep(default_item), i);
        });
    }

    let non_items = Object.entries(omit(bindings, ['name', 'description', 'kind', 'items', 'default']));
    let result: { [key: string]: BindingTree } = Object.fromEntries(non_items.map(([k, v]) => {
        let entry = (prefix === "" ? "" : prefix+".")
        if(typeof v !== 'object'){
            vscode.window.showErrorMessage(`binding.${prefix} has unexpected field ${k}`)
            return [];
        }
        if((<BindingTree>v).name !== undefined){
            return [k, expandDefaults(<BindingTree>v, entry, default_item)];
        }else{
            vscode.window.showErrorMessage(`binding.${entry} has no "name" field.`)
            return [];
        }
    }));

    return {
        ...result,
        name: bindings.name,
        description: bindings.description,
        kind: bindings.kind,
        items
    };
}

// TODO: check in unit tests
// invalid items (e.g. both key and keys defined) get detected
function reifyItemKey(item: any, key: string): any {
    return mapValues(item, (val, prop) => {
        if(val === "{key}"){ return key; }
        if(prop === "keys"){ return undefined; }
        if(typeof val === 'string'){ return val; }
        if(typeof val === 'number'){ return val; }
        if(typeof val === 'boolean'){ return val; }
        if(typeof val === 'undefined'){ return val; }
        if(Array.isArray(val)){ return val.map(x => reifyItemKey(x, key)); }
        return reifyItemKey(val, key);
    });
}

function expandBindingKeys(bindings: BindingItem[]): BindingItem[] {
    return flatMap(bindings, item => {
        if(item.keys !== undefined){
            return item.keys.map((key: any) => {return {key, ...reifyItemKey(item, key)};});
        }else{
            return [item];
        }
    });
}

function listBindings(bindings: BindingTree): BindingItem[] {
    return flatMap(Object.keys(bindings), key => {
        if(key === 'items' && bindings.items){ return bindings.items; }
        let val = bindings[key];
        if(typeof val === 'string'){ return []; }
        if(typeof val === 'number'){ return []; }
        if(typeof val === 'boolean'){ return []; }
        if(typeof val === 'undefined'){ return []; }
        if(typeof val === 'object'){ return listBindings(<BindingTree>val); }
        return [];
    });
}

function wrapBindingInDoCommand(item: BindingItem): BindingItem{
    return {
        key: item.key,
        name: item.name,
        description: item.description,
        mode: item.mode,
        when: item.when,
        command: "modalkeys.do",
        args: pick(item, ['command', 'commands', 'args', 'computedArgs'])
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
function expandBindingDocsAcrossWhenClauses(items: BindingItem[]): BindingItem[] {
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

function moveModeToWhenClause(binding: BindingItem){
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

type BindingMap = { [key: string]: BindingItem };
function extractPrefixBindings(item: BindingItem, prefixItems: BindingMap = {}){
    let when = "";
    let prefix = "";
    if(item.when !== undefined){ when += `(${item.when})`; }

    if(item.key !== undefined){
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

            let prefixItem = {key, command: "modalkeys.prefix", when: expandedWhen, args: {key}}; 
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
    let bindingTree = expandDefaults((spec).bind);
    let items = listBindings(bindingTree);
    items = expandBindingKeys(items);
    items = expandBindingDocsAcrossWhenClauses(items);
    items = items.map((item: BindingItem) => {
        item = moveModeToWhenClause(item);
        item = wrapBindingInDoCommand(item);
        return item;
    });
    let prefixBindings: BindingMap = {};
    items = items.map((b: any) => extractPrefixBindings(b, prefixBindings));
    return items.concat(values(prefixBindings));
}

async function parseBindingFile(file: vscode.Uri){
    let file_data = await vscode.workspace.fs.readFile(file);
    let file_text = decoder.decode(file_data);
    if(file.fsPath.endsWith(".json")){
        return <any>JSON.parse(file_text);
    }else{
        return <any>TOML.load(file_text);
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

            // replace old bindings OR...
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
                // ...insert new bindings
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

async function importBindings() {
    let file = await queryBindingFile();
    if (file === undefined) { return; }
    let raw_binding_file = await parseBindingFile(file);
    let ajv = Ajv();
    ajv.addSchema()
    let bindings = processBindings(raw_binding_file);
    insertKeybindingsIntoConfig(file, bindings);
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.importBindings',
        importBindings
    ));
}
