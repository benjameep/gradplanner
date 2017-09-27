var fs = require('fs')
var cheerio = require('cheerio')
var file = fs.readFileSync('./CS.html')
var $ = cheerio.load(`<body>${file}</body>`)
var $_ = $n => ({find: s => $n.find(s).get().map(n => $(n))})
function createTree($n){
    return {
		text:$_($n).find('> span:not(:has(*)) , > div:not(:has(*)), > h3 strong, > header h2 , > header span')
			.map($n => $n.text().trim().replace(/\s+/g, ' '))
			.concat($n.contents().filter(n => n.nodeType == 3).text().trim().replace(/\s+/g, ' '))
			.filter(text => text),
		sub: $_($n).find('> section,> div:has(*),> ul,> li,> main')
			.map($n => createTree($n))
			.concat($_($n).find('> span > a').map($a => ({
				id:$a.attr('href').match(/[\w-]+$/)[0],
				course:$a.text().trim(),
				credits:$a.parent().find('span').text().trim().slice(1,-1)
			})))
    }
}
function trim(tree){
	console.log(tree)
	while(tree.sub.length==1)
		tree = tree.sub[0]
	if(tree.sub){
		console.log(tree.sub.length)
		tree.sub[0] = trim(tree.sub[0])
//		tree.sub.forEach(branch => {
//			console.log(Array.isArray(branch))
//			if(branch.sub)
//				branch.sub = trim(branch.sub)
//		})
	}
	return tree
}


var tree = createTree($('body'))
var trimmed = trim(tree)


fs.writeFileSync('tree.json',JSON.stringify(tree))