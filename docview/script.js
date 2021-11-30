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
    "\n",
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

function setColor(element, kind){
    let oldcolor = undefined
    for(let className of element.classList.values()){
        if(className.match(/kind-color/)){
            oldcolor = className
            break
        }
    }
    if(oldcolor){ element.classList.remove(oldcolor) }
    element.classList.add(`kind-color-${kind ? kind.index : 'none'}`)
}
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

window.addEventListener('message', event => {
    const message = event.data;
    let keymap = message.keymap;
    let kinds = message.kinds;

    // update keys
    for(i in allKeys){
        let name = document.getElementById('key-name-'+allKeys[i])
        let label = document.getElementById('key-label-'+allKeys[i])
        let detail = document.getElementById('key-detail-'+allKeys[i])
        if(keymap && keymap[names[i]]){
            let binding = keymap[names[i]]
            name.innerHTML = binding.label
            let kind_d = (kinds && kinds[binding.kind]) || {index: 'none', description: ''}
            detail.innerHTML = `
                <div class="detail-text">
                    ${binding.kind ?
                        `${capitalizeFirstLetter(binding.kind)} command (<div class="detail-kind-color kind-color-${kind_d.index}"></div>): `
                    : ''}
                    ${binding.detail}
                </div>
                <div class="detail-kind">${kind_d.description}</div>
            `
            detail.classList.remove('empty')
            if(kinds){
                setColor(name, kinds[binding.kind])
                setColor(label, kinds[binding.kind])
            }
        }else{
            if(detail){ 
                detail.innerHTML = "" 
                detail.classList.add('empty')
            }
            if(name){ 
                name.innerHTML = "" 
                setColor(name)
            }
            if(label){ setColor(label) }
        }
    }
})
