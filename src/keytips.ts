import * as vscode from "vscode";
import { IHash } from './util';
import { Keyhelp, KeyState } from "./actions";
import { Keymodes } from "./actions"
import { union } from "lodash";

let extensionUri: vscode.Uri;

// how tips are represented in the configuration file by the user
type UserTipNode = UserTipGroup|UserTipItem|UserTipNote|Keyhelp

interface UserTipGroup {
    title: string
    comment?: string
    icon?: string
    id: string
    more: string[],
    entries: UserTipNode[];
}

interface UserTipItem {
    title: string,
    comment: string,
    icon?: string,
    id: string
}

interface UserTipNote {
    note: string,
    id: string
}

// the internal representation of the doc tips
type Icon = vscode.Uri | {dark: string | vscode.Uri, light: string | vscode.Uri} | vscode.ThemeIcon

enum NodeType { Item, Group, Note, Key, SeeAlso }
interface TipNode {
    title: string,
    icon?:  Icon,
    description: string,
    prefixes: string[],
    tooltip?: string,
    type: NodeType,
    entries: TipNode[],
}

function findKeys(tipIndex: IHash<UserTipGroup>, id: string, doc: IHash<Keyhelp> | undefined, 
                  mode: string, keyModes: Keymodes, prefix: string = ""): TipNode[] {
    let keys: TipNode[] = []
    if(doc){
        for(let key of Object.keys(doc)){
            let keydoc = doc[key]
            if(keydoc.tip === id){
                let keyel = userToNode(tipIndex, keydoc, mode, keyModes)
                keyel.prefixes = [prefix]
                keys.push(keyel)
            }
            if(keydoc.keys){
                keys = keys.concat(findKeys(tipIndex, id, keydoc.keys, mode, keyModes, 
                                            prefix + key))
            }
        }
    }
    return keys
}

function indexTips(docTips: UserTipGroup[]){
    let result: IHash<UserTipGroup> = {}
    for(let node of docTips){
        result[node.id] = node
    }
    return result
}

function userToNode(tipIndex: IHash<UserTipGroup>, element: UserTipNode, mode: string, 
                    keyModes: Keymodes): TipNode {
    if((<UserTipGroup>element)?.entries){
        let e = <UserTipGroup>element;
        let entries = e.entries.map(x => userToNode(tipIndex, x, mode, keyModes))
        if(e.more){
            entries.push({
                title: "See also",
                description: e.more.map(id => tipIndex[id].title).join(", "),
                type: NodeType.SeeAlso,
                prefixes: [],
                entries: []
            })
        }
        return { 
            title: e.title,
            icon: e.icon ? new vscode.ThemeIcon(e.icon) : undefined,
            description: e.comment || "",
            type: NodeType.Group,
            prefixes: union(...entries.map(x => x.prefixes)),
            entries: entries
        }
    }else if((<UserTipItem>element).title){
        let e = <UserTipItem>element;
        let keys = findKeys(tipIndex, e.id, keyModes.help && keyModes.help[mode], 
                            mode, keyModes)
        return {
            title: e.title,
            icon: e.icon ? new vscode.ThemeIcon(e.icon) : undefined,
            description: e.comment,
            type: NodeType.Item,
            prefixes: union(...keys.map(x => x.prefixes)),
            entries: keys
        }
    }else if((<Keyhelp>element).kind){
        let e = <Keyhelp>element;
        return {
            title: e.label,
            icon: {light: vscode.Uri.joinPath(extensionUri, "icons", "lightkey.svg"), 
                   dark: vscode.Uri.joinPath(extensionUri, "icons", 'darkkey.svg')},
            description: e.detail || "",
            type: NodeType.Key,
            prefixes: [],
            entries: []
        }
    }else{ // if((<UserTipNote>element).note){
        let e = <UserTipNote>element;
        return {
            title: "Note",
            icon: {light: vscode.Uri.joinPath(extensionUri, "icons", "lightkey.svg"), 
                    dark: vscode.Uri.joinPath(extensionUri, "icons", 'darkkey.svg')},
            description: e.note,
            type: NodeType.Note,
            prefixes: [],
            entries: []
        }
    }
}

let userDocTips: UserTipGroup[] = []
let keyModes: Keymodes
let docTips: IHash<TipNode[]> = {}

export function register(context: vscode.ExtensionContext) {
    const treeProvider = new KeytipProvider()
    vscode.window.registerTreeDataProvider('modalkeys.tipView', treeProvider)
    extensionUri = context.extensionUri;

    return treeProvider;
}

function organizeTips(){
    let index = indexTips(userDocTips)
    if(keyModes.command){
        for(let mode of Object.keys(keyModes.command)){
            docTips[mode] = userDocTips.map(tip => userToNode(index, tip, mode, keyModes))
        }
    }
}

// TODO: stopped here; need to figure out how 
// to use new data types above in the below setup
export function updateFromConfig(): void {
    const config = vscode.workspace.getConfiguration("modalkeys")
    userDocTips = config.get<UserTipGroup[]>("docTips", []);
    organizeTips()
}

function prefixMatches(prefix: string){
    return function(node: TipNode){
        if(node.prefixes.length === 0){
            return true
        }else{
            return node.prefixes.some(x => x == prefix)
        }
    }
}

export class KeytipProvider implements vscode.TreeDataProvider <TipNode> {
    private mode: string = ""
    private prefix: string = ""
    update(state: KeyState, mode: string){
        this.mode = mode
        this.prefix = state.keySequence.reduce((x,y) => x+y)
    }
    setKeymodes(modes: Keymodes){
        keyModes = modes
        organizeTips()
    }
    getChildren(element?: TipNode) {
        if(!element){
            return docTips[this.mode].filter(prefixMatches(this.prefix));
        }else{
            return element.entries.filter(prefixMatches(this.prefix));
        }
    }
    getTreeItem(element: TipNode) {
        return element
    }
}