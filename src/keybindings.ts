import * as vscode from 'vscode';
import * as TOML from 'js-toml';
import * as semver from 'semver';
import { TextDecoder } from 'util';
import { searchMatches } from './searching';
import { builtinModules } from 'module';

let decoder = new TextDecoder("utf-8");

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
    let versionStr = <string>bindings?.header?.version
    if(!versionStr){
        vscode.window.showErrorMessage(`Preset file is missing a version specifier in its 
            header.`);
        return;
    }
    
    let validVersion = semver.valid(versionStr)
    if(validVersion === null){
        vscode.window.showErrorMessage(`Invalid version number ${versionStr} in preset header.`)
        return;
    }

    if(!semver.satisfies(validVersion, '1.x')){
        vscode.window.showErrorMessage(`Preset file version ${validVersion} is not 
            supported.`);
    }
    return bindings;
}

async function expandDefaults(bindings: any, defaults: any = {}){
    if(typeof bindings === 'string') { return bindings; }
    if(typeof bindings === 'number') { return bindings; }
    if(typeof bindings === 'boolean') { return bindings; }

    if(bindings.default !== undefined){
        defaults = {...defaults, ...bindings.default};
    }
    
    let keys: any = undefined;
    if(bindings.keys !== undefined){
        keys = bindings.keys.map(k => {
            return {...defaults, ...k};
        });
    }

    let non_keys = Object.entries(bindings).filter(([k, v]) => k !== 'keys');
    let result: any = Object.fromEntries(non_keys.map(([k, v]) => 
        [k, expandDefaults(v, defaults)]
    ));
    return {...result, keys};
}

function processBindings(bindings: any){
    return expandDefaults(bindings);
    // TODO: add more steps here, as from implementation notes in larkin.toml
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
`

const AUTOMATED_COMMENT_START_SUFFIX = `
    //
    // Leave this comment (and the one denoting the end) unmodified to ensure the automated
    // bindings are properly updated if/when you insert another preset Add any additional
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

function formatBindings(file: vscode.Uri, config: any){
    let json = JSON.stringify(config, null, 4);
    return (
        AUTOMATED_COMMENT_START_PREFIX+
        "// `"+file.toString()+"`\n"+
        AUTOMATED_COMMENT_START_SUFFIX+
        "\n" + json.replaceAll(/^/gm, "    ") + ",\n"+
        AUTOMATED_COMMENT_END
    );
}

async function requestToInsertBindings(file: vscode.Uri, config: any) {
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
            ed.document.getText(old_bindings_start)
            if (old_bindings_start && old_bindings_end) {
                let range = new vscode.Range(
                    new vscode.Position(old_bindings_start.start.line-1, 
                                        ed.document.lineAt(old_bindings_start.start.line-1).range.end.character),
                    new vscode.Position(old_bindings_end.end.line + 4, 0));
                ed.edit(builder => {
                    builder.replace(range, bindings_to_insert);
                });
                vscode.window.showInformationMessage(`Your modal key bindings have
                    been updated in \`keybindings.json\`.`);
            } else if (old_bindings_end || old_bindings_start){
                vscode.window.showErrorMessage(`You appear to have altered the comments
                    around the automated bindings. Please delete the old, automated
                    bindings manually and then re-run this command.`);
            }else {
                // ...insert new bindings
                ed.edit(builder => {
                    builder.insert(insert_at, "\n" + bindings_to_insert);
                });
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
    let config = processBindings(raw_binding_file);
    requestToInsertBindings(file, config);
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand(
        'modalkeys.importBindings',
        importBindings
    ));
}
