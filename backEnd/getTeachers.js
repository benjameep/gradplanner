var qs = require('qs')
var fs = require('fs')
var req = require('request')
var cheerio = require('cheerio')
var async = require('async')

var baseURL = `http://search.mtvnservices.com/typeahead/suggest/?`

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
	cleanUp(JSON.parse(res.body).response.docs)
})

function cleanUp(teachers){
	// Shorten keys
	teachers = teachers.map(n => ({
		accounts:[{
			numRatings:n.total_number_of_ratings_i,
			id:n.pk_id
		}],
		avgRating:n.averageratingscore_rf,
		first:n.teacherfirstname_t,
		last:n.teacherlastname_t
	}))
	
	// Convert to map
	var tmap = teachers.reduce((obj,n) => {
		// If it already exists, then we have a duplicate
		if(obj[n.first+" "+n.last]){
			var twins = [n,obj[n.first+" "+n.last]]
			// Naively combine duplicates
			var addRatings = (a) => a.reduce((a,t) => a+t.numRatings,0) // helper function
			var combinedAccounts = twins[0].accounts.concat(twins[1].accounts)
			var combined = {
				// Add up all the ratings, biased by how many ratings
				// divide by total number of ratings
				avgRating: 
					twins.reduce((a,t) => a + ((t.avgRating||0) * addRatings(t.accounts)),0) / 
					addRatings(combinedAccounts),
				accounts: combinedAccounts
			}
			obj[n.first+" "+n.last] = combined
			
		} else {
			obj[n.first+" "+n.last] = n;
		}
		return obj
	},{})
	
	// Get rid of unnessesary data
	for(key in tmap){
		delete tmap[key].first
		delete tmap[key].last
	}
	
	fs.writeFileSync('teachers.json',JSON.stringify(tmap))
}