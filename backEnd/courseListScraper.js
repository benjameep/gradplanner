$(".course").get().splice(1).map(elm => {
        elm = $(elm)
        return {
            "name": elm.find('.courseName').text(),
            "code": elm.find('.courseCode').text(),
            "credits": elm.find('.credits').text().split(' ')[0],
            "availability": elm.find('.availability').children().get().reduce((obj,img) => {obj[img.className.split(' ')[2]]=true;return obj},{}),
            "syllabus": elm.find('.syllabus a')[0].href,
            "description": elm.find('.courseDescription').text().split("Read Less")[0].trim(),
            "department": elm.find('.department').text(),
        }
    })