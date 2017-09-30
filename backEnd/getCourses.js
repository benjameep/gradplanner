var got = require('got')
var async = require('async')
var fs = require('fs')
var baseURL = 'https://byui.kuali.co/api/v1/catalog'
var catalogID

got(baseURL+'/public/catalogs/current')
	.then(res => {
		catalogID = JSON.parse(res.body)._id
		return got(baseURL+'/courses/'+catalogID)
	})
	.then(res => {
		res = JSON.parse(res.body)
		return new Promise((resolve,reject) => {
			async.mapLimit(res.slice(100,150),50,
				function(course,cb){
					got(baseURL+'/course/'+catalogID+'/'+course.pid)
						.then(res => {
							var c = JSON.parse(res.body)
							var course = {
								code: c.__catalogCourseId,
								title: c.title,
								des: c.description,
								sems: {
									S:c.semestersOffered.spring,
									W:c.semestersOffered.winter,
									F:c.semestersOffered.fall
								}
									
							}
							cb(null,course)
						})
						.catch(cb)
				},
				function(err,courses){
					if(err){return reject(err)}
					resolve(courses)
			})
		})
	})
	.then(courses => {
		// turn into a map
		courses = courses.reduce((obj,c) => {obj[c.code] = (()=>{delete c.code; return c})();return obj},{})
		fs.writeFileSync('courses.json',JSON.stringify(courses))
	})
	.catch(console.error)