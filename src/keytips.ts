import * as vscode from "vscode";
import { IHash } from './util';
import { Keyhelp, KeyState } from "./actions";
import { Keymodes } from "./actions"

let extensionUri: vscode.Uri;

interface TipItem {
    title: string,
    comment: string,
    icon?: string,
    id: string
}

class TreeTipItem extends vscode.TreeItem {
    constructor(item: TipItem){ 
        super(item.title, vscode.TreeItemCollapsibleState.Expanded); 
        this.description = item.comment;
        if(item.icon)
            this.iconPath = new vscode.ThemeIcon(item.icon);
    }
}

// TOOD: how to get key name from keyDoc
class TreeKeyItem extends vscode.TreeItem {
    constructor(item: KeyDoc){
        super(item.key)
        this.description = item.label
        this.tooltip = item.detail
        this.iconPath = vscode.Uri.joinPath(extensionUri, "icons", "key.svg");
    }
}

interface TipNote {
    note: string,
    id: string
}

class TreeNoteItem extends vscode.TreeItem {
    constructor(item: TipNote){
        super("Note")
        if(!keyDocs[item.id]){
            vscode.window.showErrorMessage(`Key tip with id \`${item.id}\` not found!` )
        }
        this.description = item.note + ": " + keyDocs[item.id].join(", ")
        this.iconPath = new vscode.ThemeIcon("note")
    }
}

interface TipGroup {
    title: string
    comment?: string
    id: string
    icon?: string
    entries: TipNode[];
}

class TreeGroupItem extends vscode.TreeItem {
    constructor(item: TipGroup){
        super(item.title, vscode.TreeItemCollapsibleState.Expanded)
        this.description = item.comment;
        if(item.icon){
            this.iconPath = new vscode.ThemeIcon(item.icon);
        }
    }
}

interface KeyDoc {
    key: string,
    kind: string,
    label: string,
    detail?: string,
}

type KeyDocs = IHash<IHash<KeyDoc[]>>
let keyDocs: KeyDocs = {};
type TipNode = TipGroup|TipItem|TipNote
let docTips: IHash<TipGroup[]> = {}

export function register(context: vscode.ExtensionContext) {
    const treeProvider = new KeytipProvider()
    vscode.window.registerTreeDataProvider('modalkeys.tipView', treeProvider)
    extensionUri = context.extensionUri;

    return treeProvider;
}

export function updateFromConfig(): void {
    const config = vscode.workspace.getConfiguration("modalkeys")
    docTips = config.get<TipGroup[]>("docTips", []);
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
export class KeytipProvider implements vscode.TreeDataProvider <TipNode|KeyDoc> {
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
    getChildren(element?: TipNode|KeyDoc) {
        if(!element){
            return docTips[this.mode];
        }else{
            let entries = (<TipGroup>element)?.entries
            if(entries){
                return entries
            }else if((<TipItem>element)?.title){
                return keyDocs[this.mode][(<TipItem>element).id];
            }
        }
    }
    getTreeItem(element: TipNode|KeyDoc) {
        if((<TipGroup>element)?.entries){
            return new TreeGroupItem(<TipGroup>element)
        }else if((<TipItem>element).title){
            return new TreeTipItem(<TipItem>element)
        }else if((<KeyDoc>element).kind){
            return new TreeKeyItem(<KeyDoc>element)
        }else{ // if((<TipNote>element).note){
            return new TreeNoteItem(<TipNote>element);
        }
    }
}