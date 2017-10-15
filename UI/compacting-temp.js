let programs = require('../backend/programs.json')
let display = require('../backend/display.js')
display(programs['440'])
function addObjects(){
  return [...arguments].reduce((a,obj) => {
    for(key in obj)
      a[key] = a[key]?a[key]+obj[key]:obj[key]
    return a
  },{})
}

function countModules(sub){
  if(!sub){return {}}
  return addObjects({
    numCourses: sub.reduce((a,n) => a+!!n.course,0),
    numSubs: sub.reduce((a,n) => a+!!n.sub,0)
  },...sub.map(n => countModules(n.sub)))
}

programs['440'].sub.forEach(domain => {
  console.log(countModules(domain.sub))
})