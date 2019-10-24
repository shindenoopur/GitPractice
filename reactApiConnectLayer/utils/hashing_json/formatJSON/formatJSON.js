/**
 * @author Balaji Pachai
 * Date Created: 03/22/2019
 * File that contains the utility for formatting JSON objects, s.t. the JSON objects are in a particular format.
 * formatJSON details:
 *     A JSON formatter module for various text/plain serialization styles
 *     Methods:
 *         terse: [Function: json],
 *         plain: [Function: plain],
 *         diffy: [Function: diffy],
 *         space: [Function: space],
 *         lines: [Function: lines]
 *
 * jsonFormat details:
 *     Parse JavaScript Object to a JSON String indented.
 * */

const jsonFormat = require('json-format')
const formatJSON = require('format-json')
// const schemaJSON = require('../demoJSONFile/schema')
/**
 * @param params JSON object that has to be formatted
 * @return Returns the formatted json object
 * */
function formatJSONObject(params) {
    // console.log(formatJSON.plain(params.jsonSchema))
    return formatJSON.terse(jsonFormat(params.jsonSchema))
}

// var output = formatJSONObject({
//     jsonSchema: schemaJSON.TestSchema
// })
//
// console.log('Formatted JSON object: ', output)
module.exports = {
    formatJSONObject
}