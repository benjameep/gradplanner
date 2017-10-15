var fs = require('fs')
var sections,teachers 

// Adds the id value to each instructor in sections
function nameFinder(){
	sections
		// Get all the instructors on the same level
		.reduce((arr,s) => arr.concat(s.Instructors),[])
		// Standardize the format of the name (lowercase and only letters)
		.map(t => {
			var temp = t.last.replace(/\W/g,'').toLowerCase()
			t.id = {
				first:t.first.replace(/\W/g,'').toLowerCase(),
				last:teachers[temp]?temp:t.last.split('-')[0].replace(/\W/g,'').toLowerCase(),
				middle:t.middle && t.middle.replace(/\W/g,'').toLowerCase()
			}
			return t.id
		})
		// Take out the hopeless ones (the last name dosen't match anything)
		.filter(t => teachers[t.last])
		// The first round of filtering and assigning (the easy ones)
		.filter(t => {
			var possFirsts = Object.keys(teachers[t.last])
			var good = teachers[t.last][t.first] || teachers[t.last][t.middle]
			if(good){
				// match out the ones that are already good or just use their middle name
				good.taken = true
				if(teachers[t.last][t.middle])
					t.first = t.middle
			} else if(possFirsts.length == 1){
				// Match out the ones who are the only one with that particular last name
				t.first = possFirsts[0]
				good = true
				teachers[t.last][possFirsts[0]].taken = true
			}
			return !good
		})
		// Second round of filtering and assigning (more guess work involved)
		.filter((t,i) => {
			// All the ones that are not already taken
			var possFirsts = Object.keys(teachers[t.last]).filter(first => !teachers[t.last][first].taken)
			// Returns how many of the beggining letter match
			function compare(s1,s2){
				// Can't be having the nickname longer than their actual name 
				// (except for debra to debbie, but we are just going to ignore that)
				if(s1.length >= s2.length)
					return 0
				var i = 0; 
				while(s1[i]==s2[i]){i++}; 
				return i
			}
			// create list of compares
			var compares = possFirsts.map(first => ({name:first,value:compare(first,t.first)})).concat(t.middle?possFirsts.map(first => ({name:first,value:compare(first,t.middle)})):[{value:0}]).sort((a,b) => b.value-a.value)
			// If you got a single letter to match, then take it (We already know that their last name matches)
			if(compares.length && compares[0].value > 0)
				t.first = compares[0].name
			return compares.length && compares[0].value <= 0
		})
}

// Moves the display name from sections to teachers
function moveDataAround(){
	// Move our data around for better efficency
	sections.forEach(section => {
		section.Instructors = section.Instructors.map(t => {
			if(teachers[t.id.last]&& teachers[t.id.last][t.id.first]){
				// Write the display name, to our teachers data
				var teacher = teachers[t.id.last][t.id.first]
				teacher.first = t.first
				teacher.last = t.last
				teacher.middle = t.middle
				delete teacher.taken
				// Replace the object we were working with to just a string
				return t.id.last+','+t.id.first
			} else {
				delete t.id
				return t
			}
		})
	})
}

function getTeachers(cb){
	if(fs.existsSync('./teachers.json')){
		cb(require('./teachers.json'))
	} else {
		require('./getTeachers.js').run(cb)
	}
}

function main(Sections,cb){
	getTeachers(Teachers => {
		sections = Sections
		teachers = Teachers
		nameFinder()
		moveDataAround()
		fs.writeFileSync('./teachers.json',JSON.stringify(teachers))
		cb(sections)
	})
}

module.exports.run = main