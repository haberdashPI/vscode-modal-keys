import hash from 'object-hash';
import jsep from 'jsep';
import { BindingSpec, BindingTree, StrictBindingTree, BindingItem, StrictBindingItem, 
    strictBindingItem } from "./keybindingParsing";
import * as vscode from 'vscode';
import { uniq, omit, mergeWith, cloneDeep, flatMap, values, mapValues, entries } from 'lodash';
import { reifyStrings, EvalContext } from './expressions';

// BUGS: 
// - ":" is being accepted as a key, even though I thought we validated against that

// TODO: we need to eliminate any ignore's that aren't needed

// top level function (this calls everything else)
// TODO: allow defaults for when classes to exapnd into a when clause
// (e.g. by using arrays that get merged), arrays imply AND
// add a default when clause to verify that we're in the text editor
export function processBindings(spec: BindingSpec){
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
    definitions: any){

    let keyEvaled = reifyStrings(omit(item, 'key'), 
        str => context.evalExpressionsInString(str, {...definitions, key: k}));
    return {...keyEvaled, key: k};
}

const ALL_KEYS = "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./";
function expandBindingKeys(bindings: StrictBindingItem[], definitions: any): StrictBindingItem[] {
    let context = new EvalContext();
    let result = flatMap(bindings, item => {
        if(Array.isArray(item.key)){
            return item.key.map(k => expandBindingKey(k, item, context, definitions));
        }else if(item.key === "<all-keys>"){
            return Array.from(ALL_KEYS).map(k => expandBindingKey(k, item, context, definitions));
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
    mode?: string,
    when?: string,
    args: { do: string | object | (string | object)[], resetTransient?: boolean } | 
        { key: string }
}

function itemToConfigBinding(item: StrictBindingItem): IConfigKeyBinding {
    return {
        key: <string>item.key,
        name: item.name,
        description: item.description,
        mode: item.mode,
        when: Array.isArray(item.when) ? "(" + item.when.join(") && (") + ")" : item.when,
        command: "modalkeys.do",
        args: { do: item.do, resetTransient: item.resetTransient }
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
        if(binding.mode.startsWith("!")){
            when = when.concat(`(modalkeys.mode != '${binding.mode.slice(1)}')`);
        }else{
            when = when.concat(`(modalkeys.mode == '${binding.mode}')`);
        }
    }

    return {...binding, when};
}

function expandAllowedPrefixes(expandedWhen: string, item: BindingItem){
    // add any optionally allowed prefixes
    if(expandedWhen.length > 0){ expandedWhen += ` && (`; }
    expandedWhen += "modalkeys.prefix == ''"; 
    if(item.allowed_prefixes !== undefined){
        for(let allowed of item.allowed_prefixes){
            expandedWhen += ` || modelkeys.prefix == '${allowed}'`;
        }
    }
    expandedWhen += " )";

    return expandedWhen;
}

function expandWhenPrefixes(when: string, prefix: string, item: BindingItem){
    if(prefix === ""){
        when = expandAllowedPrefixes(when, item);
    }else{
        if(when.length > 0) { when += " && "; }
        when += `(modalkeys.prefix == '${prefix}')`;
    }
    return when;
}

type BindingMap = { [key: string]: IConfigKeyBinding };
function extractPrefixBindings(item: IConfigKeyBinding, prefixItems: BindingMap = {}){
    let when = "";
    let prefix = "";
    if(item.when !== undefined){ when += `(${item.when})`; }

    if(item.key !== undefined){
        let key_seq = item.key.trim().split(/\s+/);

        for(let key of key_seq.slice(0, -1)){
            let expandedWhen = expandWhenPrefixes(item.when || "", prefix, item);
            
            // track the current prefix for the next iteration of `map`
            if(prefix.length > 0){ prefix += " "; }
            prefix += key;

            let prefixItem: IConfigKeyBinding = {
                key, 
                command: "modalkeys.prefix", 
                when: expandedWhen, 
                args: {key}
            }; 
            // we parse the `when` expression so that strings that are !== but yield
            // equivalent syntactic trees will hash identically
            let prefixKey = hash({key, mode: item.mode, when: jsep(item.when || "")});
            prefixItems[prefixKey] = prefixItem;
        }

        let expandedWhen = expandWhenPrefixes(item.when || "", prefix, item);
        return {...item, when: expandedWhen, key: key_seq[key_seq.length-1]};
    }
    return item;
}
