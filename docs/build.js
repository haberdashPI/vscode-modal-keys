const jdi = require('jdi')
const glob = require('glob')
const fs = require('fs')
const { Remarkable } = require('remarkable')
const hljs = require('highlight.js')
const mkdirp = require('mkdirp')
const path = require('path')
const { ConsoleLogger } = require('typedoc/dist/lib/utils')

console.log(process.cwd())

// load files to document
sourcefiles = glob.sync('src/*.ts').
    concat(glob.sync('docs/*.js', {ignore: ["docs/build.js", "docs/index.js"]})).
    concat(glob.sync('presets/*.js'))
docfiles = ['README.md']

// markdown parser
md = new Remarkable({
    html: true,
    xhtmlOut: true,
    highlight: (str, lang) => hljs.highlightAuto(str).value
})

mkdirp.sync('docs/build/src')
mkdirp.sync('docs/build/presets')

function docpath(source){
    return source.replace('docs/','docs/build/')
        .replace('src/','docs/build/src/')
        .replace('presets/','docs/build/presets/')
        .replace('README', 'docs/build/README')
        .replace(/\.(ts|js|md)$/, '.html')
}

let header = `
<!DOCTYPE html>
<html>
<head>
	<title>Modal Keys Documentation</title>
	<meta charset="utf-8"/>
    <link rel="stylesheet" href="./style.css"/>
</head>
<body>
<script src="./index.js"></script>
<div class="content">
`

let footer = `
</div>
</body>
</html>
`

// TODO: hanlde readme specially so we can manage doc links

sourcefiles.map(file => jdi.doc(path.join(process.cwd(), file))).
    map(stream => {
        let chunks = []
        stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
        stream.on('error', e => {if(e){ throw e }})
        stream.on('end', () => {
            let mark = Buffer.concat(chunks).toString('utf8')
            mark = mark.replace('------------------------', '')
            mark = mark.replace(/^Generated _.*from.*$/m,'')
            let out = md.render(mark)
            let toFile = docpath(stream.options.file)
            fs.writeFile(toFile, header+out+footer, err => {
                if(err) throw err;
                else console.log('Wrote '+toFile)
            })
        })
    })

docfiles.map(file => {
    fs.readFile(file, (err, data) => {
        if(err){
            console.log(err.message)
        }else{
            let out = md.render(data.toString('utf8'));
            let toFile = docpath(file);
            fs.writeFile(toFile, header+out+footer, err => {
                if(err) console.log(err.message)
                else console.log('Wrote '+toFile)
            })
        }
    })
});
    
fs.copyFileSync('docs/style.css', 'docs/build/style.css')
fs.copyFileSync('docs/index.js', 'docs/build/index.js')