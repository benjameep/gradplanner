var fs = require('fs')
var cheerio = require('cheerio'),$
var req = require('request')
var async = require('async')
var $_ = $n => ({
	find: s => $n.find(s).get().map(n => $(n))
})
var baseURL = 'https://byui.kuali.co/api/v1/catalog'
var bucket = {}, missingPrograms = [], pids
var numPagesInRequest = 10

function createTree($n) {
	return {
		text: $_($n).find('> span:not(:has(*)) , > div:not(:has(*)), > h3 strong, > header h2 , > header span, > header > div:not(:has(*))')
			.reduce((arr,$n) => arr.concat($n.text().trim().replace(/ +/g, ' ').split('\n')),[])
			.concat($n.contents().filter((i, n) => n.nodeType == 3).text().trim().replace(/\s+/g,' '))
			.filter(text => text),
		sub: $_($n).find('> section,> div:has(*),> ul,> li,> main')
			.map($n => createTree($n))
			.concat($_($n).find('> span > a').map($a => ({
				id: $a.attr('href').match(/[\w-]+$/)[0], // I don't think i need the id's
				course: $a.text().trim(),
				credits: $a.parent().find('span').text().trim().slice(1, -1)
			})))
	}
}

function trim(tree) {
	// While we only have one child
	while (tree.sub && tree.sub.length == 1) {
		// If we are a grandfather
		if (tree.sub[0].sub) {
			// Append their text to ours
			tree.text.push(...tree.sub[0].text)
			// Make our grandchildren our children
			tree.sub = tree.sub[0].sub
		} else if (!tree.text.length) {
			// Make our only child part of us, if we don't have text
			Object.assign(tree, tree.sub[0])
			delete tree.sub
			delete tree.text
		} else
			break; // We will just keep the single child, but get us out of the loop
	}
	if (tree.sub) {
		// For each of our children
		tree.sub.forEach((branch, i) => {
			trim(branch)
		})
	}
}

function countCredits(tree, cap) {
	function findType(text) {
		var creds = text.split('|').filter(str => str.match(/^\d+( ?- ?\d+)?$/))[0]
		var num = creds && +creds.split(/ ?- ?/)[0]
		var isCredits = text.match(/credit\(s\)|Total Credits/)
		var isOTF = text.match(/(\w+) of the following/)
		isOTF = isOTF && isOTF[1]
		// if is credits
		if (isCredits || (num && (!isOTF || isOTF == "all"))) {
			return {
				type: 'CREDITS',
				value: creds
			}
		} else if (isOTF && isOTF != "all") {
			return {
				type: 'SOME',
				value: isNaN(isOTF) ? creds : isOTF
			}
		} else {
			// usually this is ALL but in some cases it is not
			return {
				type: 'unknown'
			}
		}
	}

	function normalizeFound(tree) {
		var found = {}
		// Combining the credits found in the text and the credits listed in classes
		if (tree.text)
			found = findType(tree.text.join('|'))
		else if (tree.credits) {
			found.type = 'CREDITS'
			found.value = tree.credits || found.value
		} else {
			found.type = 'CREDITS'
			found.value = '0 - 1'
		}
		// Converting the '0 - 0' string to [0,0]
		if (found.type == 'CREDITS') {
			var split = found.value.split(/ ?- ?/)
			found.value = [+split[0], +split[split.length - 1]]
		} else if (found.type == 'SOME') {
			// Making it's value not a string
			found.value = +found.value
		}
		return found
	}

	var found = normalizeFound(tree)
	if (found.type == 'CREDITS') {
		tree.credits = found.value
		// Even though this one had it's credits labeled, 
		// it's children still need to find themselves
		if (tree.sub)
			tree.sub.forEach(s => countCredits(s, tree.credits[1]))
	} else {
		if (!tree.sub)
			console.error('Had type SOME or ALL without any children')

		var childrenCredits = tree.sub.map(s => countCredits(s, cap))
		if (found.type == 'unknown') {
			tree.credits = childrenCredits.reduce((a, n) => a.map((t, i) => t + n[i]), [0, 0])
			if (tree.credits[1] > cap) {
				// Uhhh that is more than our grandparent has, try again
				found.type = 'SOME'
				found.value = 1
			} else {}
		}
		if (found.type == 'SOME') {
			var mins = childrenCredits.map(n => n[0]).sort()
			var maxs = childrenCredits.map(n => n[1]).sort()
			// Add the smallest (so many) mins for our min
			// Add the largest (so many) maxs for our max
			tree.credits = [mins.slice(0, found.value).reduce((a, n) => a + n, 0),
							maxs.slice(-found.value).reduce((a, n) => a + n, 0)]
		}
	}
	return tree.credits
}

function removeAwkwardDivs(tree) {
	if (tree.sub) {
		// Doing it the old fashioned way, 
		// cause manipulating array during it
		for (var i = 0; i < tree.sub.length; i++) {
			var branch = tree.sub[i]
			// If this div dosen't have any credits
			if (!branch.credits[1]) {
				// If we have sibling after us
				if(branch.text){
					if (i + 1 < tree.sub.length && tree.sub[i + 1].text)
						tree.sub[i + 1].text.push(...branch.text)
					else // just take the text our self
						tree.text.push(...branch.text)
				}
				// remove the runt, decreass i, afterwards to prevent skipping
				tree.sub.splice(i--, 1)
			}
			removeAwkwardDivs(branch)
		}
		// If afterwards we only have one child
		if (tree.sub.length == 1) {
			// probably the worst way to do this, but i'm lazy
			trim(tree)
		}
	}
}

function relabel(tree, text) {
	text = text || []
	var blackList = ['Take at least', 'Total Credits', 'credit(s) to complete one of the following programs:', 'Take the following:', 'Take', 'credit(s) from:', 'credit(s) from', 'Complete all of the following', 'of the following:', '-', 'credit(s) from the following course sets:', 'Earned credit(s) from: Courses from -', 'Take credit(s) from', 'Take credit(s) from:', 'Take at least credit(s) to complete one of the following programs:', 'Earned credit(s) from the following course sets:', 'Take of the following:', 'Complete 1 of the following', 'Complete 2 of the following', 'Complete 1, nine credit module from the list below.', 'Complete 1 option:', 'Course Not Found']

	tree.header = text[0]
	tree.detail = text.slice(1).length ? text.slice(1) : undefined

	var childTexts = tree.sub.filter(sub => sub.sub).map(branch => branch.text
		.filter(str => !str.match(/^\d+(?: ?- ?\d+)?$/) && !blackList.includes(str))
		.sort((a, b) => a.length - b.length))

	var isSome = tree.sub.reduce((a, n) => a + n.credits[0], 0) > tree.credits[0]
	var needsGroupNames = !childTexts.every(text => text.length)


	tree.sub.filter(sub => sub.sub).forEach((branch, i) => {
		var groupName = (isSome ? 'Option ' : 'Group ') + String.fromCharCode(65 + i)
		if (needsGroupNames)
			childTexts[i].unshift(groupName)
		relabel(branch, childTexts[i])
	})
}

function removeUseless(tree) {
	delete tree.text
	if(tree.credits[0] == 0 && tree.credits[1] == 1 
	   && tree.id && !pids.includes(tree.id)
	   && !missingPrograms.includes(tree.id)){
		missingPrograms.push(tree.id)
	}
	delete tree.id
	if (tree.sub)
		tree.sub.forEach(removeUseless)
}

function display(tree, indent) {
	indent = indent || 0
	var spaces = Array(indent).join(' ')
	console.log(spaces,
		tree.course ? tree.course : (tree.header),
		`(${+tree.credits[0]+(tree.credits[0]!=tree.credits[1]?' - '+tree.credits[1]:'')})`,
		tree.detail ? `[${tree.detail}]` : '')
	if (tree.sub)
		tree.sub.forEach(t => display(t, indent + 4))
}

function parseHTML(html, title) {
	html = `<body>${html}</body>`
	$ = cheerio.load(html)
	var tree = createTree($('body'))
	trim(tree)
	countCredits(tree)
	removeAwkwardDivs(tree)
	relabel(tree, [title])
	removeUseless(tree)
	return tree
}

function read(pid, catalogID, callback, debug) {
	function add(arr, n) {
		arr.push(n)
		return n
	}
	req(`${baseURL}/program/${debug?'':'byid/'}${catalogID}/${pid}`, (err, res, body) => {
		//		console.log(pid)
		if (err || res.statusCode != 200) {
			missingPrograms.push(pid)
			return console.error(err, res)
		}
		body = JSON.parse(body)
		var tree = parseHTML(body.newProgramRules1, body.title)
		if (body.specializations && body.specializations.length) {
			var branch = tree.sub.filter(sub => sub.header == "Required Emphasis")[0] || add(tree.sub, {
				credits: [0, 0],
				header: "Concentrations"
			})
			branch.sub = body.specializations.map(emp => parseHTML(emp.newProgramRules1,emp.title))
		}
		if(debug){
			display(tree)
			fs.writeFileSync('tree.json', JSON.stringify(tree))
		}
		bucket[body.code] = tree
		callback(null, null)
	})
}

function run(){
	// Get the current catalog ID
	req(`${baseURL}/public/catalogs/current`,(err,res,body) => {
		var catalogID = JSON.parse(res.body)._id
		// Get the list of programs
		req(`${baseURL}/programs/${catalogID}`,(err,res,body) => {
			pids = JSON.parse(res.body).map(program => program.id)
			// Scrape the requirements from each program
			async.mapLimit(pids, numPagesInRequest,(pid,cb) => read(pid,catalogID,cb),() => {
				// Go back and do the missing programs
				async.mapLimit(missingPrograms, numPagesInRequest,(pid,cb) => read(pid,catalogID,cb),() => {
					// Then we can finally save everything
					fs.writeFileSync('programs.json',JSON.stringify(bucket))
				})
			})
		})
	})
}

// take down after testing
//pids = require('./pids.json') 
//var hell = 'NJxXXWhjW'
//var requiredCluster = 'EJxFMQZhsb'
//var bio = 'V1ZfQQbhjb'
//var found = 'E1qykizhb'
//var notFound = 'VJ41QWhsb'
//var cs = 'NyW7f7-nsZ'
//read(cs,'58dc843f984c63d67b7f3e4b',(err, data) => {},true)
run()