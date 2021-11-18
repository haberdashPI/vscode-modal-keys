const names = [
    "~", "`",
    "!", "1",
    "@", "2",
    "#", "3",
    "$", "4",
    "%", "5",
    "^", "6",
    "&", "7",
    "*", "8",
    "(", "9",
    ")", "0",
    "_", "-",
    "+", "=",
    "delete",
    "tab", 
    "Q", "q",
    "W", "w",
    "E", "e",
    "R", "r",
    "T", "t",
    "Y", "y",
    "U", "u",
    "I", "i",
    "O", "o",
    "P", "p",
    "{", "[", 
    "}", "]", 
    "|", "\\", 
    "caps lock",
    "A", "a",
    "S", "s",
    "D", "d",
    "F", "f",
    "G", "g",
    "H", "h",
    "J", "j",
    "K", "k",
    "L", "l",
    ":", ";",
    '"', "'",
    "return",
    "shift", 
    "Z", "z",
    "X", "x",
    "C", "c",
    "V", "v",
    "B", "b",
    "N", "n",
    "M", "m",
    "<", ",",
    ">", ".",
    "?", "/",
    "shift", 
    " "
]
const allKeys = [
    "tilde", "tick",
    "bang", "1",
    "at", "2",
    "hash", "3",
    "dollar", "4",
    "percent", "5",
    "karat", "6",
    "amper", "7",
    "star", "8",
    "paren-left", "9",
    "paren-right", "0",
    "underscore", "-",
    "plus", "equals",
    "delete",
    'tab', 
    "Q", "q",
    "W", "w",
    "E", "e",
    "R", "r",
    "T", "t",
    "Y", "y",
    "U", "u",
    "I", "i",
    "O", "o",
    "P", "p",
    "bracket-left", "brace-left", 
    "bracket-right", "brace-right", 
    "pipe", "back_slash", 
    "caps-lock",
    "A", "a",
    "S", "s",
    "D", "d",
    "F", "f",
    "G", "g",
    "H", "h",
    "J", "j",
    "K", "k",
    "L", "l",
    "colon", "semicolon",
    'quote', "'",
    "return",
    "shift-left", 
    "Z", "z",
    "X", "x",
    "C", "c",
    "V", "v",
    "B", "b",
    "N", "n",
    "M", "m",
    "karet-left", "comma",
    "karet-right", "period",
    "question", "slash",
    "shift-right", 
    "space"
]

function setColor(element, color){
    let oldcolor = undefined
    for(let className of element.classList.values()){
        if(className.match(/batlow/)){
            oldcolor = className
            break
        }
    }
    if(oldcolor){ element.classList.remove(oldcolor) }
    element.classList.add(`batlow-${color || 'none'}`)
}
window.addEventListener('message', event => {
    const message = event.data;
    console.dir(message) // TODO: remove me!!!
    let keymap = message.keymap;
    let colormap = message.colors;

    // update keys
    for(i in allKeys){
        let name = document.getElementById('key-name-'+allKeys[i])
        let label = document.getElementById('key-label-'+allKeys[i])
        if(keymap && keymap[names[i]]){
            name.innerHTML = keymap[names[i]].label
            if(colormap){
                setColor(name, colormap[keymap[names[i]].kind])
                setColor(label, colormap[keymap[names[i]].kind])
            }
        }else{
            if(name){ 
                name.innerHTML = "" 
                setColor(name)
            }
            if(label){ setColor(label) }
        }
    }
})
