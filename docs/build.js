jdi = require('jdi')
glob = require('glob')
fs = require('fs')
const { Remarkable } = require('remarkable')
hljs = require('highlight.js')

// load files to document
files = glob.sync('src/*.ts').
    concat(glob.sync('docs/*.js')).
    concat(glob.sync('presets/*.js'))

// write markdown files
jdi.run(process.cwd(), files)

// convert markdown to html
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

// TODO: expand this to render the html
// TODO: move intermediate markdown files to docs/build
// TODO: remove the intermediate markdown files
markfiles = glob.sync('src/*.ts.md')
file = fs.readFileSync(markfiles[3],'utf8')
fs.writeFileSync(file_name_here, md.render(file))