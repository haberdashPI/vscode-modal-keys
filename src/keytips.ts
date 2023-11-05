import * as vscode from "vscode";
import { IHash } from './util';
import { Keyhelp, KeyState, log } from "./actions";
import { Keymodes } from "./actions"
import { isLength, union, clone } from "lodash";

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

enum NodeType { Item, Group, Note, Key, SeeAlso, KeyMode }
interface TipNode {
    title: string | vscode.TreeItemLabel,
    icon?: Icon,
    description: string,
    prefixes: string[],
    tooltip?: string,
    type: NodeType,
    entries: TipNode[],
}

interface IndexedTipNode extends TipNode {
    id: number,
    parent: number
    entries: IndexedTipNode[]
}

function nodeToTreeItem(x: TipNode): vscode.TreeItem {
    let collapsibleState = vscode.TreeItemCollapsibleState.Expanded
    if([NodeType.Key, NodeType.Note, NodeType.SeeAlso, NodeType.KeyMode].includes(x.type))
        collapsibleState = vscode.TreeItemCollapsibleState.None
    return {
        collapsibleState,
        description: x.description,
        tooltip: x.description,
        iconPath: x.icon,
        label: x.title,
    }
}

function findKeys(tipIndex: IHash<UserTipGroup>, id: string, doc: IHash<Keyhelp> | undefined, 
                  mode: string, keyModes: Keymodes, prefix: string = ""): TipNode[] {
    let keys: TipNode[] = []
    if(doc){
        for(let key of Object.keys(doc)){
            let keydoc = doc[key]
            if(keydoc.tip === id){
                let keyel = userToNode(tipIndex, keydoc, mode, keyModes)
                let seq = prefix+key
                keyel.title = {label: seq+"  "+keyel.title, highlights: [[0, seq.length]]},
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

// TODO: more generally this shoudl gracefully handle bad data
function userToNode(tipIndex: IHash<UserTipGroup>, element: UserTipNode, mode: string, 
                    keyModes: Keymodes): TipNode {
    if((<UserTipGroup>element)?.entries){
        // console.log("[ModalKeys] UserTipGroup start")
        let egroup = <UserTipGroup>element;
        console.dir(egroup)
        // console.log("e: "+egroup)
        let entries = egroup.entries.map(x => {
            // console.log("[ModalKeys] x: ")
            console.dir(x)
            return userToNode(tipIndex, x, mode, keyModes)
        })
        // console.log("past userToNode")
        // console.log("e: "+egroup)
        let seeAlso = egroup.more && egroup.more.filter(id => id in tipIndex)
        if(seeAlso){
            let description = seeAlso.map(id => tipIndex[id].title).join(", ")
            entries.push({
                title: "See also",
                description,
                type: NodeType.SeeAlso,
                icon: new vscode.ThemeIcon('more'),
                prefixes: [],
                entries: []
            })
        }
        // console.log("[ModalKeys] UserTipGroup return")
        // console.log("e: "+egroup)
        if(!egroup){
            // console.log("[ModalKeys] Bad E!!")
        }
        return { 
            title: egroup.title,
            icon: egroup.icon ? new vscode.ThemeIcon(egroup.icon) : undefined,
            description: egroup.comment || "",
            type: NodeType.Group,
            prefixes: union(...entries.map(x => x.prefixes)),
            entries: entries
        }
    }else if((<UserTipItem>element).title){
        // console.log("[ModalKeys] UserTipItem start")
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
        // console.log("[ModalKeys] Keyhelp start")
        let e = <Keyhelp>element;
        return {
            title: e.label,
            description: e.detail || "",
            type: NodeType.Key,
            prefixes: [],
            entries: []
        }
    }else{ // if((<UserTipNote>element).note){
        // console.log("[ModalKeys] UserTipNote start")
        let e = <UserTipNote>element;
        let keys = findKeys(tipIndex, e.id, keyModes.help && keyModes.help[mode], mode, keyModes)
        let title: string | vscode.TreeItemLabel = ""
        if(keys.length === 0){
            log("Error reading docTips: missing tip id `"+e.id+"`.")
        }else{
            title = keys[0].title
        }
        return {
            title,
            icon: new vscode.ThemeIcon('note'),
            description: e.note,
            type: NodeType.Note,
            prefixes: [],
            entries: []
        }
    }
}

let userDocTips: UserTipGroup[] = []
let keyModes: Keymodes
let docTips: IHash<IndexedTipNode[]> = {}
let tipIndex: IHash<IndexedTipNode[]> = {}
let treeView: vscode.TreeView<IndexedTipNode>
let treeProvider: KeytipProvider

export function register(context: vscode.ExtensionContext) {
    treeProvider = new KeytipProvider()
    treeView = vscode.window.createTreeView('modalkeys.tipView', {
        treeDataProvider: treeProvider
    })
    vscode.window.registerTreeDataProvider('modalkeys.tipView', treeProvider)
    extensionUri = context.extensionUri;

    
    context.subscriptions.push(vscode.commands.registerCommand('modalkeys.nextKeytip', 
                                                               nextKeytip))
    context.subscriptions.push(vscode.commands.registerCommand('modalkeys.previousKeytip', 
                                                               prevKeytip))

    return treeProvider;
}

let keytipIndex = 0
let currentTips: IndexedTipNode[] | undefined
export async function nextKeytip(){
    if(currentTips && currentTips.length > 0){
        keytipIndex += 1
        if(keytipIndex > currentTips.length){
            keytipIndex = 1
        }
    }else{
        keytipIndex = 0
    }
    showKeytip(keytipIndex-1)
}

export async function prevKeytip(){
    if(currentTips && currentTips.length > 0){
        keytipIndex -= 1
        if(keytipIndex < 1){
            keytipIndex = currentTips.length
        }
    }else{
        keytipIndex = 0
    }
    showKeytip(keytipIndex-1)
}

export async function showKeytip(index: number){
    if(currentTips){
        revealAll(currentTips[index], { select: true, focus: false, expand: true })
    }else{
        let children = treeProvider.getChildren()
        if(children.length > 1){
            revealAll(children[1], { select: true, focus: false, expand: true })
        }else if(children.length > 0){
            revealAll(children[0], { select: true, focus: false, expand: true })
        }
    }
}

function revealAll(tip: IndexedTipNode, options: {expand?: boolean | number, focus?: boolean, select?: boolean}){
    for(let entry of tip.entries){
        revealAll(entry, {expand: true, select: false, focus: false})
    }
    treeView.reveal(tip, options)
}

function addIndices(tip: TipNode, indexed: IndexedTipNode[] = [], 
                    parentIndex: number = -1, nextIndex: number = 0): [IndexedTipNode, IndexedTipNode[], number]{
    let entries: IndexedTipNode[] = []
    let currentIndex = nextIndex;
    nextIndex += 1
    if(tip.entries.length > 0){
        for(let entry of tip.entries){
            let result = addIndices(entry, indexed, currentIndex, nextIndex)
            entries.push(result[0])
            indexed = result[1]
            nextIndex = result[2]
        }
    }

    let indexedTip = {
        ...tip,
        id: currentIndex,
        parent: parentIndex,
        entries
    }
    indexed[currentIndex] = indexedTip

    return [indexedTip, indexed, nextIndex] 
}

function addParents(tips: TipNode[]):  [IndexedTipNode[], IndexedTipNode[]]{
    let parentNode = {
        entries: tips, 
        title: "", 
        description: "", 
        prefixes: [""], 
        type: NodeType.Group 
    }
    let [parent, indexed, _] = addIndices(parentNode)
    return [parent.entries, indexed]
}

export function updateFromConfig(): void {
    const config = vscode.workspace.getConfiguration("modalkeys")
    userDocTips = config.get<UserTipGroup[]>("docTips", [])
    treeProvider.organizeTips()
}

function prefixMatches(prefix: string){
    return function(node: TipNode){
        if(node.prefixes.length === 0){
            return true
        }else{
            return prefix == "" || node.prefixes.some(x => x == prefix)
        }
    }
}

function addKeyMode(tips: IndexedTipNode[], keymode: string){
    let result = clone(tips);
    result.unshift({
        title: "Mode: "+keymode,
        description: "The keymode determines which shortcuts are active",
        id: -2,
        parent: -1,
        entries: [],
        prefixes: [],
        type: NodeType.KeyMode
    })
    return result
}

export class KeytipProvider implements vscode.TreeDataProvider <IndexedTipNode> {
    mode: string = ""
    private prefix: string = ""
    update(state: KeyState, mode: string){
        this.mode = mode
        this.prefix = state.keySequence.reduce((x,y) => x+y, "")
        this._onDidChangeTreeData.fire()
    }
    private _onDidChangeTreeData =
        new vscode.EventEmitter<IndexedTipNode | undefined | null | void>()
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event
    
    setKeymodes(modes: Keymodes){
        keyModes = modes
        // this.organizeTips()
    }

    organizeTips(tips: UserTipGroup[] = userDocTips){
        console.log("[organizeTips]")
        userDocTips = tips
        let index = indexTips(userDocTips)
        if(keyModes.command){
            for(let mode of Object.keys(keyModes.command)){
                let newTips = userDocTips.map(tip => userToNode(index, tip, mode, keyModes));
                let [tips_, indexed_] = addParents(newTips)
                docTips[mode] = tips_
                tipIndex[mode] = indexed_
            }
        }
        console.log("[organized]")
        this._onDidChangeTreeData.fire()
    }
    
    getChildren(element?: IndexedTipNode) {
        if(!element){
            let modeTips = docTips[this.mode]
            if(modeTips){
                currentTips = docTips[this.mode].filter(prefixMatches(this.prefix))
                return addKeyMode(currentTips, this.mode)
            }
            return []
        }else{
            if(element.entries && element.entries.length > 0){
                return element.entries.filter(prefixMatches(this.prefix));
            }
            return []
        }
    }

    getParent(element: IndexedTipNode){
        if(!element) return undefined
        if(element.parent < 0) return undefined
        return tipIndex[this.mode][element.parent]
    }
    
    getTreeItem(element: IndexedTipNode) {
        return nodeToTreeItem(element);
    }
}