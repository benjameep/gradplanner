var Handlebars = require('handlebars')
var sections = require('../SignUpScraper/sections.json').slice(100,150) // only get the first couple for now
var fs = require('fs')

Handlebars.registerHelper('var',function(varName, string){
	var vars = [].slice.call(arguments).slice(2,-1)
	var split = string.split('{}')
	var expr = split.slice(1).reduce((a,s,i) => a+JSON.stringify(vars[i]==undefined?'':vars[i])+s,split[0])
	try{
		this[varName] = eval(expr)
	} catch(e){
		this[varName] = null
	}
})

Handlebars.registerHelper('eval',function(string){
	var vars = [].slice.call(arguments).slice(1,-1)
	var split = string.split('{}')
	var expr = split.slice(1).reduce((a,s,i) => a+JSON.stringify(vars[i]==undefined?'':vars[i])+s,split[0])
	return eval(expr)
})

var template = Handlebars.compile(fs.readFileSync('template.html','utf-8'))

fs.writeFileSync('dynamic.html',template(sections))