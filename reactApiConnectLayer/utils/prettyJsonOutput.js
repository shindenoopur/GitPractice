const prettyJson = require('prettyjson')
const prettyJsonOptions = {
    keys: 'green',
    number: 'blue'
}

function getResponseObject (block, status, message, data) {
    //response object that will be sent to the front-end or to the point of invocation
    let response = {
        status: '',
        message: '',
        data: []
    }

    if (block.number != null) {
        response.status = status
        response.message = message
        response.data = data
    } else {
        response.status = status
        response.message = message
        response.data = data
    }

    console.log(prettyJson.render(response, prettyJsonOptions, 4))
    return response
}

function prettyPrint(arrayOfJsonToPrettyPrint){
    for (let i = 0 ; i < arrayOfJsonToPrettyPrint.length; i++) {
        console.log(prettyJson.render(arrayOfJsonToPrettyPrint[i], prettyJsonOptions, 12))
        console.log("\n")
    }
}

module.exports = {
    getResponseObject,
    prettyPrint
}