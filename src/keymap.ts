import * as vscode from 'vscode'
import { Keyhelp, KeyState } from './actions'
import { IHash } from './util'

// TODO: use KeyboardLayoutMap to improve behavior
// acorss non-english / non-standard layouts
const keyRows = [
    [
        {top: "~", bottom: "`"},
        {top: "!", bottom: "1"},
        {top: "@", bottom: "2"},
        {top: "#", bottom: "3"},
        {top: "$", bottom: "4"},
        {top: "%", bottom: "5"},
        {top: "^", bottom: "6"},
        {top: "&", bottom: "7"},
        {top: "*", bottom: "8"},
        {top: "(", bottom: "9"},
        {top: ")", bottom: "0"},
        {top: "_", bottom: "-"},
        {top: "+", bottom: "="},
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
        {top: "{", bottom: "["},
        {top: "}", bottom: "]"},
        {top: "|", bottom: "\\"}
    ],
    [    
        {bottom: "caps lock", length: '1-75'},
        {top: "A", bottom: "a"},
        {top: "S", bottom: "s"},
        {top: "D", bottom: "d"},
        {top: "F", bottom: "f"},
        {top: "G", bottom: "g"},
        {top: "H", bottom: "h"},
        {top: "J", bottom: "j"},
        {top: "K", bottom: "k"},
        {top: "L", bottom: "l"},
        {top: ":", bottom: ";"},
        {top: '"', bottom: "'"},
        {bottom: "return", length: '1-75'}
    ],
    [
        {bottom: "shift-left", bottom_name: "shift", length: '2-25'},
        {top: "Z", bottom: "z"},
        {top: "X", bottom: "x"},
        {top: "C", bottom: "c"},
        {top: "V", bottom: "v"},
        {top: "B", bottom: "b"},
        {top: "N", bottom: "n"},
        {top: "M", bottom: "m"},
        {top: "<", bottom: ","},
        {top: ">", bottom: "."},
        {top: "?", bottom: "/"},
        {bottom: "shift-right", bottom_name: "shift", length: '2-25'}
    ],
    [
        {}, {}, {},
        {length: '1-25'},
        {length: '5', bottom: "space", bottom_name: ""},
        {length: '1-25'},
        {}, {}, {}, {}
    ]
];

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
            this._view?.webview.postMessage(this._help_map)
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
        this._help_map = help_map ? help_map : {};
        this.refresh()
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
            <div class="keyboard">
                ${keyRows.map(row => `
                    <div class="keyboard-row">
                        ${row.map((key: any) => `
                            <div class="key key-length-${get(key, 'length', 1)}">
                                <div class="label">${get(key, 'top_name', get(key, 'top', ''))}</div>
                                <div id="key-${get(key, 'top', "blank"+num++)}" class="name"></div>
                                <div class="label">${get(key, 'bottom_name', get(key, 'bottom', ''))}</div>
                                <div id="key-${get(key, 'bottom', "blank"+num++)}" class="name"></div>
                            </div>
                        `).join('\n')}
                    </div>
                `).join('\n')}
            </div>
        `

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

