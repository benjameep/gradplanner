var fs = require('fs')
var data = require('./temp.json')
var currentCourse = '' 
countCredits(data,0)

function countCredits(data,indent){
	var space = n => Array(n).fill(' ').join('')
	function howCount(obj){
		function getNum(str){
			if(isNaN(str))
				return +str.split(' - ')[0] // Take the smaller number
			return +str
		}
		if(obj.credits){
			var numCredits = getNum(obj.credits)
			if(isNaN(numCredits))
				console.error(currentCourse,': Credits was not in the form (0 - 0) or 0')
			return {
				type:'credits',
				val: numCredits
			}
		} else if (obj.span && isNaN(getNum(obj.span))){
			var match = obj.span.match(/Complete (.*?) of the following/)
			if(!match || (match[1]!="all" && isNaN(match[1])))
				console.error(currentCourse,': Span was not in the form \'Complete (all or 1) of the folowing\'')
			var num = getNum(match[1])
			if(!isNaN(num) && num>1)
				console.error(currentCourse,': Complete more than 1 of the following')
			return match[1]=="all"?{type:'all'}:{
				type:'some',
				val:num
			}
		} else if (obj.text){
			if(obj.span){
				if(isNaN(obj.span))
					console.error(currentCourse,': Text and Span exist but span is not a number')
				if(obj.text.match(/credit\(s\)/)){
					if(obj.as && obj.as.length>1)
						console.error(currentCourse,': Has more than one link')
					return {
						type: 'credits',
						val: getNum(obj.span)
					}
				} else if(obj.text.match(/of the following/)){
					var num = getNum(obj.span)
					if(num > 1)
						console.error(currentCourse,': Taking more than 1 of the following')
					return {
						type: 'some',
						val: num
					}
				}
			} else {
				if(obj.text != "Take the following:")
					console.error(currentCourse,': Text was not equal to \'Take the following\'')
				return {type:'all'}
			}
		} else if(obj.div){
			console.error(currentCourse, `: Awkward div [${obj.div}]`)
			return {
				type:'none',
				val:0
			}
		} else {
			console.error(currentCourse, ': Catch all error')
			return {
				type:'none',
				val:0
			}
		}
	}
	data.forEach(elm => {
		if(Array.isArray(elm))
			countCredits(elm,indent+4)
		else {
//			console.log(space(indent),howCount(elm))
			if(elm.sub){
				countCredits(elm.sub,indent+4)
			}
		}
	})
}
