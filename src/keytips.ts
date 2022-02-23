import * as vscode from "vscode";
import { IHash } from './util';
import { KeyState } from "./actions";
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
    detail: string,
    tip: string
}

type KeyDocs = IHash<KeyDoc[]>
let keyDocs: KeyDocs = {};
type TipNode = TipGroup|TipItem|TipNote
let docTips: TipGroup[] = []

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


export class KeytipProvider implements vscode.TreeDataProvider <TipNode|KeyDoc> {
    private keymodes: Keymodes;
    setKeymodes(modes: Keymodes){
        this.keymodes = modes;
        // TODO: update doctips here
    }
    getChildren(element?: TipNode|KeyDoc) {
        if(!element){
            return docTips;
        }else{
            let entries = (<TipGroup>element)?.entries
            if(entries){
                return entries
            }else if((<TipItem>element)?.title){
                return keyDocs[(<TipItem>element).id];
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