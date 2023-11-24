import * as vscode from 'vscode';

export interface SearchArgs {
    backwards?: boolean
    caseSensitive?: boolean
    wrapAround?: boolean
    acceptAfter?: number
    selectTillMatch?: boolean
    highlightMatches?: boolean
    offset?: string
    text?: string
    regex?: boolean
    register?: string
}

export function* searchMatches(doc: vscode.TextDocument, start: vscode.Position, 
    end: vscode.Position | undefined, target: string, args: SearchArgs) {

    let matchesFn: (line: string, offset: number | undefined) => Generator<[number, number]>;
    if (args.regex) {
        let matcher = RegExp(target, "g" + (!args.caseSensitive ? "" : "i"));
        matchesFn = (line, offset) => regexMatches(matcher, line, !args.backwards, offset);
    } else {
        let matcher = !args.caseSensitive ? target : target.toLowerCase();
        matchesFn = (line, offset) => stringMatches(matcher, !args.caseSensitive, line,
            !args.backwards, offset);
    }

    let offset: number | undefined = start.character;
    for (const [line, i] of linesOf(doc, start, args.wrapAround || false, !args.backwards)) {
        if (end && i > end.line) { return; }

        let matchesItr = matchesFn(line, offset);
        let matches = !args.backwards ? matchesItr : Array.from(matchesItr).reverse();

        yield* mapIter(matches, ([start, len]) => new vscode.Range(
            new vscode.Position(i, start),
            new vscode.Position(i, start + len)
        ));
        offset = undefined;
    }
}

function* mapIter<T, R>(iter: Iterable<T>, fn: (x: T) => R){
    for(const x of iter){
        yield fn(x);
    }
}

function* linesOf(doc: vscode.TextDocument, pos: vscode.Position,
    wrap: boolean, forward: boolean): Generator<[string, number]>{

    yield [doc.lineAt(pos).text, pos.line]
    let line = pos.line + (forward ? 1 : -1)
    while(forward ? line < doc.lineCount : line >= 0){
        yield [doc.lineAt(line).text, line]
        line += (forward ? 1 : -1)
    }
    if(wrap){
        line = forward ? 0 : doc.lineCount - 1
        while(forward ? line < doc.lineCount : line > 0){
            yield [doc.lineAt(line).text, line];
            line += (forward ? 1 : -1);
        }
    }
}

function* regexMatches(matcher: RegExp, line: string, forward: boolean, 
    offset: number | undefined): Generator<[number, number]>{
    matcher.lastIndex = 0;
    let match = matcher.exec(line);
    while(match){
        if(offset && !forward && match.index > offset){ return; }
        if(offset === undefined || !forward || match.index > offset){
            yield [match.index, match[0].length];
        }
        let newmatch = matcher.exec(line);
        if(newmatch && newmatch.index > match.index){
            match = newmatch;
        }else{
            match = null;
        }
    }
}

function* stringMatches(matcher: string, matchCase: boolean, line: string, forward: boolean, 
    offset: number | undefined): Generator<[number, number]>{

    let search_me = offset === undefined ? line :
        (forward ? line.substring(offset) : line.substring(0, offset - 1));
    let fromOffset = offset === undefined ? 0 : (forward ? offset : 0);
    if(!matchCase){ search_me = search_me.toLowerCase(); }
    let from = search_me.indexOf(matcher, 0);
    while(from >= 0){
        yield [from + fromOffset, matcher.length];
        from = search_me.indexOf(matcher, from+1);
    }
}
