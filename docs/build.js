const jdi = require('jdi')
const glob = require('glob')
const fs = require('fs')
const { Remarkable } = require('remarkable')
const hljs = require('highlight.js')
const mkdirp = require('mkdirp')
const path = require('path')

console.log(process.cwd())

// load files to document
files = glob.sync('src/*.ts').
    concat(glob.sync('docs/*.js', {ignore: "docs/build.js"})).
    concat(glob.sync('presets/*.js'))

// markdown parser
md = new Remarkable('full', {
    highlight: function(str,lang){
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(lang, str).value;
            } catch (err) {}
        }
        try {
            return hljs.highlightAuto(str).value;
        } catch (err) {}
    
        return ''; // use external default escaping
    }
})

mkdirp.sync('docs/build/src')
mkdirp.sync('docs/build/presets')

function docpath(source){
    return source.replace('docs/','docs/build/')
        .replace('src/','docs/build/src/')
        .replace('presets/','docs/build/presets/')
        .replace(/\.(ts|js)$/, '.html')
}

let header = `
<!DOCTYPE html>
<html>
<head>
	<title>Modal Keys Documentation</title>
	<meta charset="utf-8"/>
</head>
<body>`

let footer = `
</body>
</html>
`

files.map(file => jdi.doc(path.join(process.cwd(), file))).
    map(stream => {
        let chunks = []
        stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
        stream.on('error', e => {if(e){ throw e }})
        stream.on('end', () => {
            let out = md.render(Buffer.concat(chunks).toString('utf8'))
            let toFile = docpath(stream.options.file)
            fs.writeFile(toFile, header+out+footer, err => {
                if(err) throw err;
                else console.log('Wrote '+toFile)
            })
        })
    })
    