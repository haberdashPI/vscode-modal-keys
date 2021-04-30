import { IHash } from './util'
import { flatten } from 'lodash'

interface KeyDisplay {
    cmd: string,
    bg: string
}

type KeyEntry = object | string
const keyboard: KeyEntry[][] = [
    [ "~\n`", "!\n1", "@\n2", "#\n3", "$\n4", "%\n5", "^\n6", "&\n7", "*\n8", "(\n9", ")\n0", "_\n-", "+\n=", {"w": 2},"Backspace" ],
    [ {"w": 1.5 }, "Tab", "Q\nq", "W\nw", "E\ne", "R\nr", "T\nt", "Y\ny", "U\nu", "I\ni", "O\no", "P\np", "{\n[", "}\n]", {"w": 1.5 }, "|\n\\" ],
    [ {"w": 1.75 }, "Caps Lock", "A\na", "S\ns", "D\nd", "F\nf", "G\ng", "H\nh", "J\nj", "K\nk", "L\nl", ":\n;", "\"\n'", {"w": 2.25 }, "Enter" ],
    [ {"w": 2.25 }, "Shift", "Z\nz", "X\nx", "C\nc", "V\nv", "B\nb", "N\nn", "M\nm", "<\n,", ">\n.", "?\n/", {"w": 2.75 }, "Shift" ],
    [ {"w": 1.25 }, "Ctrl", {"w": 1.25 }, "Win", {"w": 1.25 }, "Alt", {"a": 7,"w": 6.25 }, "", {"a": 4,"w": 1.25 }, "Alt", {"w": 1.25 }, "Win", {"w": 1.25 }, "Menu", {"w": 1.25 }, "Ctrl" ]
]

function toLayout(keys: IHash<KeyDisplay>){
    let col = (...k: string[]): string =>
        keys[k[0]] === undefined ? keys[k[1]]?.bg || "#ccc" :
        keys[k[1]] === undefined ? keys[k[0]]?.bg || "#ccc" :
        keys[k[0]] === keys[k[1]] ? keys[k[0]]?.bg || "#ccc": "#555"
    let renderkey = (...k: string[]): [object, string]  => [
        {c: col(...k), fa: [0,0,1,1]},
        [
            k[0] || "",
            k[1] || "",
            keys[k[0]]?.cmd || "",
            keys[k[1]]?.cmd || ""
        ].join("\n")
    ]
    return keyboard.map(rows => flatten(rows.map((key: KeyEntry): KeyEntry[] =>
        typeof(key) === 'string' ? renderkey(...key.split("\n")) : [key]
    )))
}

