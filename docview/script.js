const allKeys = [
    "~", "`", "!", "1", "@", "2", "#", "3", "$", "4", "%", "5", "^", 
    "6", "&", "7", "*", "8", "(", "9", ")", "0", "_", "-", "+", "=", 
    "delete", 'tab', "Q", "q", "W", "w", "E", "e", "R", "r", "T", "t", 
    "Y", "y", "U", "u", "I", "i", "O", "o", "P", "p", "{", "[", "}", "]",
    "|", "back_slash", "caps-lock", "A", "a", "S", "s", "D", "d", "F", "f", "G", 
    "g", "H", "h", "J", "j", "K", "k", "L", "l", ":", ";", 'quote', "'", 
    "return", "shift-left", "Z", "z", "X", "x", "C", "c", "V", "v", "B", 
    "b", "N", "n", "M", "m", "<", ",", ">", ".", "?", "/", "shift-right", 
    "space"
]
window.addEventListener('message', event => {
    const message = event.data;
    console.dir(message) // TODO: remove me!!!
    for(key of allKeys){
        if(message && message[key]){
            document.getElementById('key-'+key).innerHTML = message[key].label
        }else{
            let el = document.getElementById('key-'+key)
            if(el){
                el.innerHTML = ""
            }
        }
    }
})
