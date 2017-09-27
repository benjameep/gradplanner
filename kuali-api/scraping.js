var cheerio = require('cheerio'),
	$
var fs = require('fs')
var req = require('request')
var async = require('async')
var pids = require('./pids.json')

//var $ = cheerio.load(fs.readFileSync('./CS.html'))
var __ = $n => ({
	find: s => $n.find(s).get().map(n => $(n))
})
var space = n => Array(n).fill(' ').join('')

function parse($div) {
	return [
			{
				query: '> section',
				fn: $section => ({
					title: $section.find('> header h2 , > div > header h2').text().trim(),
					credits: $section.find('> header span:first-child , > div > header span:first-child').text().trim(),
					sub: __($section).find('> main > div , > div > main > div').map($div => parse($div))
				})
		},
//			{
//				query: '> ul:not([style]) , > div:has(*)',
//				fn: $div => ({
//					title: $div.find('> span').text().trim().replace(/\s+/g, ' '),
//					sub: parse($div)
//				})
//		},
			{
				query: '> li:not([data-test]) , > li > div[data-test] , > ul:not([style]) , > div:has(*)',
				fn: $li => ({
					text: $li.contents().filter(function () {
						return this.nodeType == 3
					}).text().trim().replace(/\s+/g, ' ') || undefined,
					span: $li.find('> span:not(:has(*))').text() || undefined,
					as: __($li).find('> span > a , > a').map($a => ({
						text: $a.text().trim(),
						href: $a.attr('href')
					})),
					div: $li.find('> div:not(:has(*))').text().trim().replace(/\s+/g, ' ') || undefined,
					sub: __($li).find('> ul , > div:has(*)').map($div => parse($div))
				})
		},
			{
				query: '> ul[style]',
				fn: $ul => $ul.find('li > span').get().map(li => $(li)).map($li => ({
					course: $li.find('a').text(),
					credits: $li.find('span').text().slice(1, -1)
				}))
		}
	]
		// Do the query
		.map(action => Object.assign({
			items: __($div).find(action.query)
		}, action))
		// Filter out the pretenders
		.filter(action => action.items.length)
		// Call the other functions
		//		.map((n,i,a) => {console.log(i,n.query); return n})
		.map(action => action.items.map($item => action.fn($item)))
}

function clean(raw) {
	function removeExcessArrays(array) {
		// if the one and only element is an array
		while (array.length == 1 && Array.isArray(array[0]))
			array = array[0]

		//		console.log(array)
		if (Array.isArray(array[0]))
			array = array.map(removeExcessArrays)

		array.forEach((n, i) => {
			if (n.sub) {
				n.sub = removeExcessArrays(n.sub)
				// Kill Awkward divs
				n.sub.forEach((group,i) => {
					if (group.div && Object.keys(JSON.parse(JSON.stringify(group))).length == 1){
						// give the div to the next one
						if(i+1<n.sub.length)
							n.sub[i+1].div = group.div
						else
							n.div = group.div
						n.sub.splice(i,1)
					}
				})
				// Kill excess subs (subs with one length)
				if (n.sub.length == 1 && !n.sub[0].course) {
					var temp = n.div
					n.sub[0].sub = n.sub[0].sub || undefined
					Object.assign(n, n.sub[0])
					n.div = n.div || temp
				}
				// Kill properties with empty arrays
				for (key in n) {
					if (Array.isArray(n[key]) && !n[key].length)
						delete n[key]
				}
			}
		})

		return array
	}
	return removeExcessArrays(raw)
}

function countCredits(data, indent, currentCourse) {
	indent = indent || 0
	var space = n => Array(n).fill(' ').join('')

	function howCount(obj) {
		function getNum(str) {
			if (isNaN(str))
				return +str.split(' - ')[0] // Take the smaller number
			return +str
		}
		if (obj.credits) {
			var numCredits = getNum(obj.credits)
			if (isNaN(numCredits))
				console.error(currentCourse, ': Credits was not in the form (0 - 0) or 0')
			return {
				type: 'credits',
				val: numCredits
			}
		} else if (obj.span && isNaN(getNum(obj.span))) {
			var match = obj.span.match(/Complete (.*?) of the following/)
			if (!match || (match[1] != "all" && isNaN(match[1])))
				console.error(currentCourse, ': Span was not in the form \'Complete (all or 1) of the folowing\'')
			var num = getNum(match[1])
			if (!isNaN(num) && num > 1)
				console.error(currentCourse, ': Complete more than 1 of the following')
			return match[1] == "all" ? {
				type: 'all'
			} : {
				type: 'some',
				val: num
			}
		} else if (obj.text) {
			if (obj.span) {
				if (isNaN(obj.span))
					console.error(currentCourse, ': Text and Span exist but span is not a number')
				if (obj.text.match(/credit\(s\)/)) {
					if (obj.as && obj.as.length > 1)
						console.error(currentCourse, ': Has more than one link')
					return {
						type: 'credits',
						val: getNum(obj.span)
					}
				} else if (obj.text.match(/of the following/)) {
					var num = getNum(obj.span)
					if (num > 1)
						console.error(currentCourse, ': Taking more than 1 of the following')
					return {
						type: 'some',
						val: num
					}
				}
			} else {
				if (obj.text != "Take the following:")
					console.error(currentCourse, ': Text was not equal to \'Take the following\'')
				return {
					type: 'all'
				}
			}
		} else if (obj.div) {
			console.error(currentCourse, `: Awkward div [${obj.div}]`)
			return {
				type: 'none',
				val: 0
			}
		} else {
			console.error(currentCourse, ': Catch all error')
			return {
				type: 'none',
				val: 0
			}
		}
	}
	data.forEach(elm => {
		if (Array.isArray(elm))
			countCredits(elm, indent + 4,currentCourse)
		else {
			if(debug)
				console.log(space(indent),howCount(elm))
			else
				howCount(elm)
			if (elm.sub) {
				countCredits(elm.sub, indent + 4,currentCourse)
			}
		}
	})
}

function read(pid, callback) {
	req('https://byui.kuali.co/api/v1/catalog/program/58dc843f984c63d67b7f3e4b/' + pid, (err, res, body) => {
//		console.log(pid)
		var html = `<body>${JSON.parse(body).newProgramRules1}</body>`
		$ = cheerio.load(html)
		var raw = [{
			credits: $('body > div > h3 strong').text(),
			sub: parse($('body > div'))
		}]
		var cleaner = clean(raw)
		countCredits(cleaner,0,pid)
		callback(null, cleaner)
	})
}
var debug = 'NJx3SXb2jb'
if(debug){
	read(debug, (err, data) => {
		fs.writeFileSync('temp.json', JSON.stringify(data))
	})
} else {
	async.mapLimit(pids.slice(0,100),10,read,()=>{})
}
