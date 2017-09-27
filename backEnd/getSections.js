var Nightmare = require('night-map')(require('nightmare'))
var fs = require('fs')
var rmpTeachers = require('../rmp-api/teachers.json')
var auth = JSON.parse(fs.readFileSync('auth.json','utf-8'))
var req = require('request')
var cheerio = require('cheerio')

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
					var teachers = c[4].find('li').get().map(n => n.innerHTML.trim().split(/,|\s+/g))
                    return {
                        Course: code[0],
						Section: code[1],
                        Title: c[2].text().trim(),
                        Instructors: teachers.map(name => ({first:name[2],last:name[0],middle:name[1]})),
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
			// Need to add my teacher info
			getEmails(emails => {
				data.forEach(section => {
					section.Instructors = section.Instructors.map(name => {
						var full = name.first+" "+name.last
						return Object.assign({name:name,email:emails[full]},rmpTeachers[full])
					})
				})
				fs.writeFileSync('sections.json',JSON.stringify(data))
			})
		})
}

main()

