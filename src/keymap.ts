import * as vscode from 'vscode'
import { Keyhelp, KeyState } from './actions'
import { IHash } from './util'
import { merge, cloneDeep } from 'lodash'

// TODO: use KeyboardLayoutMap to improve behavior
// acorss non-english / non-standard layouts
// TODO: ensure all special character have alphanumeric alias for id's
const keyRows = [
    [
        {top_id: "tilde", top: "~", bottom_id: "tick", bottom: "`"},
        {top_id: "bang", top: "!", bottom: "1"},
        {top_id: "at", top: "@", bottom: "2"},
        {top_id: "hash", top: "#", bottom: "3"},
        {top_id: "dollar", top: "$", bottom: "4"},
        {top_id: "percent", top: "%", bottom: "5"},
        {top_id: "karat", top: "^", bottom: "6"},
        {top_id: "amper", top: "&", bottom: "7"},
        {top_id: "star", top: "*", bottom: "8"},
        {top_id: "paren-left", top: "(", bottom: "9"},
        {top_id: "paren-right", top: ")", bottom: "0"},
        {top_id: "underscore", top: "_", bottom: "-"},
        {top_id: "plus", top: "+", bottom_id: "equals", bottom: "="},
        {bottom: "delete", length: '1-5'}
    ],
    [
        {bottom: 'tab', length: '1-5'},
        {top: "Q", bottom: "q"},
        {top: "W", bottom: "w"},
        {top: "E", bottom: "e"},
        {top: "R", bottom: "r"},
        {top: "T", bottom: "t"},
        {top: "Y", bottom: "y"},
        {top: "U", bottom: "u"},
        {top: "I", bottom: "i"},
        {top: "O", bottom: "o"},
        {top: "P", bottom: "p"},
        {top_id: "bracket-left", top: "{", bottom_id: "brace-left", bottom: "["},
        {top_id: "bracket-right", top: "}", bottom_id: "brace-right", bottom: "]"},
        {top_id: "pipe", top: "|", bottom_id: "back_slash", bottom: "\\"}
    ],
    [    
        {bottom_id: "caps-lock", bottom: "caps lock", length: '1-75'},
        {top: "A", bottom: "a"},
        {top: "S", bottom: "s"},
        {top: "D", bottom: "d"},
        {top: "F", bottom: "f"},
        {top: "G", bottom: "g"},
        {top: "H", bottom: "h"},
        {top: "J", bottom: "j"},
        {top: "K", bottom: "k"},
        {top: "L", bottom: "l"},
        {top_id: "colon", top: ":", bottom_id: "semicolon", bottom: ";"},
        {top_id: 'quote', top: '"', bottom: "'"},
        {bottom: "return", length: '1-75'}
    ],
    [
        {bottom_id: "shift-left", bottom: "shift", length: '2-25'},
        {top: "Z", bottom: "z"},
        {top: "X", bottom: "x"},
        {top: "C", bottom: "c"},
        {top: "V", bottom: "v"},
        {top: "B", bottom: "b"},
        {top: "N", bottom: "n"},
        {top: "M", bottom: "m"},
        {top_id: "karet-left", top: "<", bottom_id: "comma", bottom: ","},
        {top_id: "karet-right", top: ">", bottom_id: "period", bottom: "."},
        {top_id: "question", top: "?", bottom_id: "slash", bottom: "/"},
        {bottom_id: "shift-right", bottom: "shift", length: '2-25'}
    ],
    [
        {}, {}, {},
        {length: '1-25'},
        {length: '5', bottom_id: "space", bottom: ""},
        {length: '1-25'},
        {}, {}, {}, {}
    ]
];

const count_help = {
    '1': {label: "arg", kind: "count", detail: "Pass 1 as an argument."},
    '2': {label: "arg", kind: "count", detail: "Pass 2 as an argument."},
    '3': {label: "arg", kind: "count", detail: "Pass 3 as an argument."},
    '4': {label: "arg", kind: "count", detail: "Pass 4 as an argument."},
    '5': {label: "arg", kind: "count", detail: "Pass 5 as an argument."},
    '6': {label: "arg", kind: "count", detail: "Pass 6 as an argument."},
    '7': {label: "arg", kind: "count", detail: "Pass 7 as an argument."},
    '8': {label: "arg", kind: "count", detail: "Pass 8 as an argument."},
    '9': {label: "arg", kind: "count", detail: "Pass 9 as an argument."},
    '0': {label: "arg", kind: "count", detail: "Pass 0 as an argument."},
}

interface KeyKind {
    name: string,
    description?: string
}
interface MappedKeyKind {
    index: number,
    description?: string
}
let docKinds: IHash<MappedKeyKind> | undefined
export function updateFromConfig(): void {
    const config = vscode.workspace.getConfiguration("modalkeys")
    let kinds = config.get<KeyKind[]>("docKinds", []);
    docKinds = {}
    for(let i=0; i<kinds.length; i++){
        docKinds[kinds[i].name] = {index: i, description: kinds[i].description}
    }
}

function get(x: any, key: string, def: any){
    if(key in x){
        return x[key]
    }else{
        return def
    }
}

export function register(context: vscode.ExtensionContext){
	const docProvider = new DocViewProvider(context.extensionUri);
    vscode.window.registerWebviewViewProvider(DocViewProvider.viewType, docProvider)

    return docProvider
}

// generates the webview for a provider
export class DocViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'modalkeys.bindingView';
    public _view?: vscode.WebviewView
    public _help_map?: IHash<Keyhelp>
    public _mode?: string

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ){}

    public refresh(){
        if(this._view?.webview){
            this._view?.webview.postMessage({keymap: this._help_map, kinds: docKinds})
        }
    }
    public updateStatic(mode: string){
        this._mode = mode;
        this._help_map = KeyState.getHelp(mode);
        if(this._help_map){ this.refresh() }
    }
    public update(state: KeyState, mode: string){
        let help_map = state.getCurrentHelp(mode)
        this._mode = mode
        this._help_map = help_map ? merge(cloneDeep(count_help), help_map) : {};
        this.refresh()
    }

    public visible(){
        return this._view && this._view.visible
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView, 
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken){
        
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [ vscode.Uri.joinPath(this._extensionUri, 'docview')]
        };
        webviewView.webview.html = this._getHtml(webviewView.webview)
        webviewView.onDidChangeVisibility(event => this.refresh())
        this.refresh()
    }

    public _getHtml(webview: vscode.Webview){
        let style = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'docview', 'style.css'))
        let script = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'docview', 'script.js'))
        let num = 0
        let keys = `
        <div class="container">
            <div class="keyboard">
                ${keyRows.map(row => `
                    <div class="keyboard-row">
                        ${row.map((key: any) => {
                            let top_id = get(key, 'top_id', get(key, 'top', "blank"+num++))
                            let bottom_id = get(key, 'bottom_id', get(key, 'bottom', "blank"+num++))
                            let top_label = get(key, 'top', '')
                            return `
                                <div class="key key-length-${get(key, 'length', 1)}">
                                    ${top_label && `
                                        <div id="key-label-${top_id}" class="top label">${top_label}</div>
                                        <div id="key-name-${top_id}" class="top name"></div>
                                        <div id="key-detail-${top_id}" class="detail"></div>
                                    `}
                                    
                                    <div id="key-label-${bottom_id}" class="bottom label ${top_label ? '' : 'no-top'}">
                                        ${get(key, 'bottom', '')}
                                    </div>
                                    <div id="key-name-${bottom_id}" class="bottom name ${top_label ? '' : 'no-top'}">
                                    </div>
                                    <div id="key-detail-${bottom_id}" class="detail"></div>
                                </div>`
                        }).join('\n')}
                    </div>
                `).join('\n')}
            </div>
        </div>`

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>

            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource}; ">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${style}" rel="stylesheet">
            <script type="text/javascript" src="${script}"></script>
            </head>
            <body>
            ${keys}
            </body>
            </html>
        `
    }
}

