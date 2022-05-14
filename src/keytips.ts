import * as vscode from "vscode";
import { IHash } from './util';
import { Keyhelp, KeyState } from "./actions";
import { Keymodes } from "./actions"

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
                keys.push(userToNode(tipIndex, keydoc, mode, keyModes))
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
                entries: []
            })
        }
        return { 
            title: e.title,
            icon: e.icon ? new vscode.ThemeIcon(e.icon) : undefined,
            description: e.comment || "",
            type: NodeType.Group,
            entries: entries
        }
    }else if((<UserTipItem>element).title){
        let e = <UserTipItem>element;
        return {
            title: e.title,
            icon: e.icon ? new vscode.ThemeIcon(e.icon) : undefined,
            description: e.comment,
            type: NodeType.Item,
            entries: findKeys(tipIndex, e.id, keyModes.help && keyModes.help[mode], mode, keyModes),
        }
    }else if((<Keyhelp>element).kind){
        let e = <Keyhelp>element;
        return {
            title: e.label,
            icon: {light: vscode.Uri.joinPath(extensionUri, "icons", "lightkey.svg"), 
                   dark: vscode.Uri.joinPath(extensionUri, "icons", 'darkkey.svg')},
            description: e.detail || "",
            type: NodeType.Key,
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
            entries: []
        }
    }
}

type Keyhelps = IHash<IHash<Keyhelp[]>>
let keyDocs: Keyhelps = {};
let docTips: UserTipGroup[] = []

export function register(context: vscode.ExtensionContext) {
    const treeProvider = new KeytipProvider()
    vscode.window.registerTreeDataProvider('modalkeys.tipView', treeProvider)
    extensionUri = context.extensionUri;

    return treeProvider;
}

// TODO: stopped here; need to figure out how 
// to use new data types above in the below setup
export function updateFromConfig(): void {
    const config = vscode.workspace.getConfiguration("modalkeys")
    let allTips = config.get<UserTipGroup[]>("docTips", []);
    addTips(allTips, keyDocs)
}

// TODO: filter all items for a given mode and map them to the docTips IHash
export function filterTips(tips: TipEntry[], keyDocs: Keyhelps){
    for(let tip of tips){
        let filtered = 
        if((<TipGroup>tip)?.entries){
            addTips((<TipGroup>tip)?.entries, keyDocs)
        }
        for(let node of (tip?.entries || [])){
            if((<TipGroup>node).entries){
                addTips((<TipGroup>node).entries, keyDocs)
            }
            for(let mode of Object.keys(keyDocs)){
            }
        }
    }
}

function setKeytip(help: IHash<Keyhelp>, mode: string, prefix: string = ""){
    for(let key of Object.keys(help)){
        let keyhelp: Keyhelp = help[key]
        if(keyhelp.tip){
            if(!keyDocs[mode][keyhelp.tip]){
                keyDocs[mode][keyhelp.tip] = []
            }
            keyDocs[mode][keyhelp.tip].push({
                key: prefix+key,
                label: keyhelp.label, 
                kind: keyhelp.kind, 
                detail: keyhelp.detail
            })
        }
        if(keyhelp.keys){
            setKeytip(keyhelp.keys, mode, prefix+key)
        }
    }
}

// TODO: probably need someway to indicate there's an update to the tree
// TODO: filter tips by keystate (after we get the tree displaying)
export class KeytipProvider implements vscode.TreeDataProvider <TipEntry> {
    private mode: string = ""
    update(state: KeyState, mode: string){
        this.mode = mode
    }
    setKeymodes(modes: Keymodes){
        keyDocs = {}
        for(let mode of Object.keys(modes)){
            if(modes.help){
                setKeytip(modes.help[mode], mode)
            }
        }
    }
    getChildren(element?: TipEntry) {
        if(!element){
            return docTips[this.mode];
        }else{
            nodeCases<TipEntry[]>(element, {
                group: group => group.entries, 
                item: item => keyDocs[this.mode][item.id],
            })
        }
    }
    getTreeItem(element: TipEntry) {
        return (nodeCases<vscode.TreeItem>(element, { 
            group: x => new TreeGroupItem(x),
            item: x => new TreeTipItem(x),
            doc: x => new TreeKeyItem(x),
            note: x => new TreeNoteItem(x)
        })!
    }
}