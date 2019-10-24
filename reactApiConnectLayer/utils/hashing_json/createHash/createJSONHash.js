/**
 * @author Balaji Pachai
 * Date Created: 03/22/2019
 * File that contains functions to create hash of the JSON object
 * */

const sha3 = require('sha3')
const format = require('../formatJSON/formatJSON')
/**
 * Function that generates KECCAK-256 hash
 * */
function generateSHA3(params) {
    let convertToKeccak256 = format.formatJSONObject({jsonSchema: params})
    let keccakHash = new sha3.Keccak(256)
    keccakHash.update(convertToKeccak256)
    return keccakHash.digest('hex')
}

module.exports = {
    generateSHA3
}
