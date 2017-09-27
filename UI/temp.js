var Handlebars = require('handlebars')

Handlebars.registerHelper('setVar',function(varName, string){
	for(key in this)
		string = string.replace(new RegExp(`${key}`,'g'),JSON.stringify(this[key]))
	this[varName] = eval(string)
	console.log(this)
	return
})

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
	console.log(vars)
	var split = string.split('{}')
	var expr = split.slice(1).reduce((a,s,i) => a+JSON.stringify(vars[i]==undefined?'':vars[i])+s,split[0])
	console.log(expr)
	return eval(expr)
})


var template = Handlebars.compile(`
	{{eval "'MTWRFS'[{}]" 0}}
`)

console.log(template({it:[1,2,3]}))