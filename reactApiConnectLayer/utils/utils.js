const moment = require('moment')
function timeStampToDate(timestamp){
    return moment(timestamp * 1000).format('YYYY/MM/DD') //, h:mm:ss a
}

// let a = timeStampToDate(1714737228)
// console.log('Timestamp to date: ', a)
module.exports = {
    timeStampToDate
}
