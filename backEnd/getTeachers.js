var qs = require('qs')
var fs = require('fs')
var req = require('request')
var cheerio = require('cheerio')
var async = require('async')

var baseURL = `http://search.mtvnservices.com/typeahead/suggest/?`

function shortenKeyNames(teachers){
	// Shorten keys
	return teachers.map(n => ({
		accounts:[{
			numRatings:n.total_number_of_ratings_i,
			id:n.pk_id
		}],
		avgRating:n.averageratingscore_rf,
		first:n.teacherfirstname_t && n.teacherfirstname_t.split(' ')[0].replace(/\W/g,'').toLowerCase(),
		last:n.teacherlastname_t && n.teacherlastname_t.split(' ')[0].replace(/\W/g,'').toLowerCase()
	}))
}

function toMap(teachers){
	// Convert to map
	var tmap = teachers.reduce((obj,n) => {
		obj[n.last] = obj[n.last] || {}
		// If it already exists, then we have a duplicate
		if(obj[n.last][n.first]){
			var twins = [n,obj[n.last][n.first]]
			// Naively combine duplicates
			var addRatings = (a) => a.reduce((a,t) => a+t.numRatings,0) // helper function
			var combinedAccounts = twins[0].accounts.concat(twins[1].accounts)
			// Add up all the ratings, biased by how many ratings
			// divide by total number of ratings
			var combined = {
				avgRating: twins.reduce((a,t) => a + ((t.avgRating||0) * addRatings(t.accounts)),0) / addRatings(combinedAccounts),
				accounts: combinedAccounts
			}
			obj[n.last][n.first] = combined
			
		} else {
			obj[n.last][n.first] = n;
		}
		return obj
	},{})
	
	// Get rid of unnessesary data
	for(lastName in tmap){
		for(firstName in tmap[lastName]){
			delete tmap[lastName][firstName].first
			delete tmap[lastName][firstName].last
		}
	}
	return tmap
}

function getTeachers(cb){
	var mine = {
		solrformat: 'true',
		defType: 'edismax',
		rows: '3000',
		q: '*:*',
		qf: 'autosuggest',
		sort: 'total_number_of_ratings_i desc',
		siteName: 'rmp',
		start: '0',
		prefix: 'schoolname_t:"Brigham Young University\\-Idaho"',
		fl: 'pk_id teacherfirstname_t teacherlastname_t total_number_of_ratings_i averageratingscore_rf',
	}
	
	req(baseURL + qs.stringify(mine),(err,res,body) => {
		if(err || res.statusCode != 200)
			return console.error(err,res.statusCode,body)
		
		var teachers = JSON.parse(res.body).response.docs
		cb(teachers)
	})
}

function getEmails(callback){
	req('https://web.byui.edu/Directory/Employees/NameLastFirst/,',(err,res,body) => {
		if(err) return console.error(err)
		var $ = cheerio.load(body)            
		var emails = $('.searchResults > div').get().reduce((obj,n) => {
			n = $(n).find('.name a'); 
			var name = n.text().trim().split(', ').map(s => s.split(' ')[0].replace(/\W/g,'').toLowerCase())
			obj[name[0]] = obj[name[0]] || {}
			obj[name[0]][name[1]] = {email: n.attr('href').match(/\w+$/)[0]}
			return obj
		},{})
		callback(emails)
	})
}

function combine(emails,teachers){
	for(lastName in emails){
		for(firstName in emails[lastName]){
			var teacher = (teachers[lastName] && teachers[lastName][firstName]) || {}
			Object.assign(emails[lastName][firstName],teacher)
		}
	}
	return emails
}

function main(cb){
	getTeachers(teachers => {
		teachers = shortenKeyNames(teachers)
		teachers = toMap(teachers)
		getEmails(emails => {
			var allTeachers = combine(emails,teachers)
			if(cb)
				cb(teachers)
			else
				fs.writeFileSync('teachers.json',JSON.stringify(allTeachers))
		})
	})
}

module.exports.run = main
main()