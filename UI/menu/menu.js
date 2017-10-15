var Handlebars = require('handlebars')
var programs = require('../../backend/programs.json')
var fs = require('fs')

Handlebars.registerHelper({
	var: function(varName, string){
		var vars = [].slice.call(arguments).slice(2,-1)
		var split = string.split('{}')
		var expr = split.slice(1).reduce((a,s,i) => a+JSON.stringify(vars[i]==undefined?'':vars[i])+s,split[0])
		try{
			this[varName] = eval(`with(this){${expr}}`)
		} catch(e){
			this[varName] = null
		}
	},
	eval: function(string){
		var vars = [].slice.call(arguments).slice(1,-1)
		var split = string.split('{}')
		var expr = split.slice(1).reduce((a,s,i) => a+JSON.stringify(vars[i]==undefined?'':vars[i])+s,split[0])
		return eval(`with(this){${expr}}`)
	},
  credits: function(){
    return this.credits[0]+(this.credits[1]!=this.credits[0]?" - "+this.credits[1]:"")
  }
})

Handlebars.registerPartial('module',fs.readFileSync('module.hbs','utf-8'))

var template = Handlebars.compile(fs.readFileSync('menu.hbs','utf-8'))

fs.writeFileSync('menu.html',template(programs['371']))