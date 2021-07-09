const jdi = require('jdi')
const glob = require('glob')
const fs = require('fs')
const { Remarkable } = require('remarkable')
const hljs = require('highlight.js')
const mkdirp = require('mkdirp')

console.log(process.cwd())

// load files to document
files = glob.sync('src/*.ts').
    concat(glob.sync('docs/*.js', {ignore: "docs/build.js"})).
    concat(glob.sync('presets/*.js'))

// write markdown files
jdi.run(process.cwd(), files)

// TODO: above doesn't work when script is run all together (due to
// syncronization issues) based on
// https://github.com/alexanderGugel/jdi/blob/master/index.js write doc files to
// a reasonable location under docs/build (maybe even pipe directly to markdown
// rendere without storing files)
files.map(file => jdi.doc(path.join(process.cwd(), file))).
    map(out => out.pipe(fs.createWriteStream()))
    
// fs.rmSync('docs/build.js.md', {})

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

markfiles = files.map(x => x+".md")

mkdirp.sync('docs/build/src')
mkdirp.sync('docs/build/presets')
for(const mfile of markfiles){    
    destfile = mfile
    destfile = destfile.replace('docs/','docs/build/')
    destfile = destfile.replace('src/','docs/build/src/')
    destfile = destfile.replace('presets/','docs/build/presets/')
    destfile = destfile.replace(/\.(ts|js).md$/, '.html')
    
    str = fs.readFileSync(mfile, 'utf8')
    fs.writeFileSync(destfile, md.render(str))
}
markfiles.forEach(f => fs.rmSync(f, {}))