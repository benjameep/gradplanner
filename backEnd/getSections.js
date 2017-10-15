var Nightmare = require('night-map')(require('nightmare'))
var fs = require('fs')
var auth = JSON.parse(fs.readFileSync('auth.json','utf-8'))
var req = require('request')
var cheerio = require('cheerio')
var nameMatcher = require('./nameMatcher.js')

function getEmails(callback){
	req('https://web.byui.edu/Directory/Employees/NameLastFirst/,',(err,res,body) => {
		if(err) return console.error(err)
		var $ = cheerio.load(body)            
		var emails = $('.searchResults > div').get().reduce((obj,n) => {
			n = $(n).find('.name a'); 
			obj[n.text().split(', ').reverse().join(' ')] = n.attr('href').match(/\w+$/)[0]
			return obj
		},{})
		callback(emails)
	})
}

function main() {
    var nightmare = Nightmare({show: false})
    nightmare
        .goto('https://secure.byui.edu/cas/login')
        .insert('#username',auth.username)
        .insert('#password',auth.password)
        .click('.btn-login')
        .wait(() => document.readyState=="loading")
        .wait(() => document.readyState=="complete")
        .goto('https://my.byui.edu/ICS/Class_Schedule/Public_Course_Search.jnz?portlet=Course_Schedules&screen=Advanced+Course+Search+BYUI')
        .select('[name$=CourseFrom]', '100')
        .select('[name$=CourseTo]', '499')
        .goto('javascript:(return searchClick();return validateSearchInput(document.MAINFORM);)')
        .click('[name$=btnSearch]')
        .wait('#pg0_V_lnkShowAll')
        .goto("javascript:__doPostBack('pg0$V$lnkShowAll','')")
        .wait(() => document.readyState=="loading")
        .wait(() => document.readyState=="complete")
//        .wait(() => $("#pg0_V_lnkShowAll").text() == "Show Paged Results")
        .evaluate(() =>
            $('.gbody tr').get()
                .map(row => {
                    var c = $(row).children().get().map(n => $(n))
					var seats = c[5].text().trim().split('/')
					var code = c[1].text().trim().split('-')
					var teachers = c[4].find('li').get().map(n => n.innerHTML.trim().split(/,\s|\s/))
                    return {
                        Course: code[0],
						Section: code[1],
                        Instructors: teachers.map(name => ({last:name[0],first:name[1],middle:name[2]})),
                        Seats: {
							filled:seats[1] - seats[0],
							total:+seats[1]
						},
                        Status: c[6].text().trim(),
                        Schedules: c[7].find('.schedules li').get().map((n, i) => {
                            var v = n.innerHTML.trim().match(/(M)?(T)?(W)?(R)?(F)?(S)? ?((\d{1,2}:\d\d)([APM]+)? - (\d{1,2}:\d\d) ([APM]+)),(.*?)<div/)
                            return {
                                days: v.slice(1, 7),
								time: v[7],
                                startTime: v[8] + (v[9] || v[11]),
                                endTime: v[10] + v[11],
                                location: v[12].trim(),
                                method: $(c[9].find('li').get()[i]).text().trim()
                            }
                        }),
						Session: c[7].find('.subsess').text().trim(),
                        SubProgram: c[8].text().trim(),
                    }
                })
        )
        .end()
        .then(data => {
			// This will play with our data, changing the teachers to just a string that references the teachers.json
			nameMatcher.run(data,sections => {
				// change into an object of objects of arrays
				var all = sections.reduce((obj,sec) => {
					var id = sec.Course.replace(/\s+/g,'')
					delete sec.Course // Ain't need this anymore
					obj[id] = obj[id] || {teachers:[],sections:[]}
					obj[id].sections.push(sec)
					// Add the teachers it doesn't already have
					obj[id].teachers.push(...sec.Instructors.filter(t => !obj[id].teachers.includes(t)))
					return obj
				},{})
				fs.writeFileSync('sections.json',JSON.stringify(all))
			})
		})
}

main()

