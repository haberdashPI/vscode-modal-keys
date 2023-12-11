import hash from 'object-hash';
import jsep from 'jsep';
import { BindingSpec, BindingTree, StrictBindingTree, BindingItem, StrictBindingItem, 
    strictBindingItem } from "./keybindingParsing";
import * as vscode from 'vscode';
import { uniq, omit, mergeWith, cloneDeep, flatMap, values, entries } from 'lodash';
import { reifyStrings, EvalContext } from './expressions';


export function processBindings(spec: BindingSpec){
    let expandedSpec = expandDefaults(spec.bind);
    let items: StrictBindingItem[] = listBindings(expandedSpec);
    items = expandBindingKeys(items, spec.define);
    items = expandBindingDocsAcrossWhenClauses(items);
    items = items.map(moveModeToWhenClause);
    let prefixItems: BindingMap = {};
    items = items.map(i => extractPrefixBindings(i, prefixItems));
    let bindings = items.map(itemToConfigBinding);
    let prefixBindings = values(prefixItems).map(itemToConfigBinding);
    return bindings.concat(prefixBindings);
}

function expandWhenClauseByConcatenation(obj_: any, src_: any, key: string){
    if(key !== 'when'){ return; }
    let obj: any[] = obj_ === undefined ? [] : !Array.isArray(obj_) ? [obj_] : obj_;
    let src: any[] = src_ === undefined ? [] : !Array.isArray(src_) ? [src_] : src_;
    return obj.concat(src);
}

function expandDefaults(bindings: BindingTree, prefix: string = "bind", default_item: BindingItem = {}): StrictBindingTree {
    if (bindings.default !== undefined) {
        default_item = { ...default_item, ...<BindingItem>bindings.default };
    }

    let items: StrictBindingItem[] | undefined = undefined;
    if (bindings.items !== undefined) {
        let validated_items = bindings.items.map((item: BindingItem, i: number) => {
            let expandedItem = mergeWith(cloneDeep(default_item), item,
                expandWhenClauseByConcatenation);
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

// TODO: check in unit tests
// invalid items (e.g. both key and keys defined) get detected

function expandBindingKey(k: string, item: StrictBindingItem, context: EvalContext, 
    definitions: any): StrictBindingItem[] {

    let match: RegExpMatchArray | null = null;
    if((match = /((.*)\+)?<all-keys>/.exec(k)) !== null){
        if(match[2] !== undefined){
            let mod = match[2];
            return flatMap(Array.from(ALL_KEYS), k => 
                expandBindingKey(`${mod}+${k}`, item, context, definitions));
        }else{
            return flatMap(Array.from(ALL_KEYS), k => 
                expandBindingKey(k, item, context, definitions));
        }
    }
    let keyEvaled = reifyStrings(omit(item, 'key'), 
        str => context.evalExpressionsInString(str, {...definitions, key: k}));
    return [{...keyEvaled, key: k}];
}

const ALL_KEYS = "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./";
function expandBindingKeys(bindings: StrictBindingItem[], definitions: any): StrictBindingItem[] {
    let context = new EvalContext();
    let result = flatMap(bindings, item => {
        if(Array.isArray(item.key)){
            return flatMap(item.key, k => expandBindingKey(k, item, context, definitions));
        }else{
            return [item];
        }
    });
    context.reportErrors();
    return result;
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
    mode?: string[],
    when?: string,
    args: { do: string | object | (string | object)[], resetTransient?: boolean } | 
        { key: string }
}

function itemToConfigBinding(item: StrictBindingItem): IConfigKeyBinding {
    return {
        key: <string>item.key,
        name: item.name,
        description: item.description,
        mode: item.mode === undefined ? item.mode : 
              Array.isArray(item.mode) ? item.mode : 
              [item.mode],
        when: Array.isArray(item.when) ? "(" + item.when.join(") && (") + ")" : item.when,
        command: "modalkeys.do",
        args: { do: item.do, resetTransient: item.resetTransient }
    };
}

function validateUniqueForBinding(vals: (string | undefined)[], name: string, item: any): string | undefined {
    let uvals = uniq(vals.filter(v => v !== undefined));
    if(uvals.length > 1){
        vscode.window.showErrorMessage(`Multiple values of \`${name}\` for idenictal 
            binding \`${item.key}\` in mode "${item.mode.join(' or ')}". Update the bindings file
            to use only one name for this binding regardless of its \`when\` clause
            You can also safely leave all but one of these bindings with a \`${name}\`
            field.`);
        return;
    }
    if(uvals.length === 0){
        vscode.window.showErrorMessage(`No \`${name}\` provided for binding \`${item.key}\`
            in mode "${item.mode.join(' or ')}".`);
        return;
    }
    return uvals[0];
}

// For any items that have duplicate bindings with distinct when clauses (before the
// transformations applied below) make sure that `name` and `description` are identical or
// blank, and use the non-blank value in all instances

// TODO: the obvious unit test is to have non-unique documentation
// and blank documentation for some when clauses

function expandBindingDocsAcrossWhenClauses(items: StrictBindingItem[]): StrictBindingItem[] {
    let sharedBindings: { [key: string]: any[] } = {};
    for (let item of items) {
        if(item.do === "modalkeys.ignore" || (<{command?: string}>item.do)?.command === "modalkeys.ignore"){ continue; }
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
    let when = binding.when ? binding.when : [];
    if(binding.mode !== undefined){
        let modes = Array.isArray(binding.mode) ? binding.mode : [binding.mode];
        let negative = false;
        let whenClause = modes.map(m => {
            if(m.startsWith("!")){
                negative = true;
                return `(modalkeys.mode != '${m.slice(1)}')`;
            }else{
                return `(modalkeys.mode == '${m}')`;
            }
        });
        // NOTE: parsing validation should ensure that only negative or only
        // positive mode specifications occur in one list
        if(negative){
            when = when.concat("("+whenClause.join(') && (')+")");
        }else{
            when = when.concat("("+whenClause.join(') || (')+")");
        }
    }

    return {...binding, when};
}

function expandAllowedPrefixes(when: string[], item: BindingItem){
    if(Array.isArray(item.allowed_prefixes)){
        let allowed = item.allowed_prefixes.map(a => `modalkeys.prefix == '${a}'`).join(' || ');
        when.push(allowed);
    }
    if(item.allowed_prefixes !== "<all-prefixes>"){
        when.push("modalkeys.prefix == ''");
    }
    return when;
}

function expandWhenPrefixes(when_: string[] | string | undefined, prefix: string, item: BindingItem){
    // TODO: this doesn't properly handle the default of just a single `[""]` allowed
    // prefix
    let when = when_ ? (Array.isArray(when_) ? when_ : [when_]) : [];
    when = cloneDeep(when);
    if(prefix === ""){ when = expandAllowedPrefixes(when, item);
    }else{ when.push(`(modalkeys.prefix == '${prefix}')`); }
    return when;
}

type BindingMap = { [key: string]: StrictBindingItem };
function extractPrefixBindings(item: StrictBindingItem, prefixItems: BindingMap = {}): StrictBindingItem{
    let prefix = "";

    if(item.key !== undefined && !Array.isArray(item.key)){
        let key_seq = item.key.trim().split(/\s+/);

        for(let key of key_seq.slice(0, -1)){
            let expandedWhen = expandWhenPrefixes(item.when, prefix, item);
            
            // track the current prefix for the next iteration of `map`
            if(prefix.length > 0){ prefix += " "; }
            prefix += key;

            let prefixItem: StrictBindingItem = {
                key, 
                do: {command: "modalkeys.prefix", args: {key}},
                when: expandedWhen, 
                resetTransient: false
            }; 
            // we parse the `when` expression so that there is a better chance
            // that equivalent conditiosn hash to the same value
            let parsedWhen = expandedWhen.map(jsep);
            let prefixKey = hash({key, mode: item.mode, when: parsedWhen});
            prefixItems[prefixKey] = prefixItem;
        }

        return {
            ...item, 
            when: expandWhenPrefixes(item.when, prefix, item), 
            key: key_seq[key_seq.length-1]
        };
    }
    return item;
}
