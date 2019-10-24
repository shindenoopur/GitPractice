const assert = require('assert')

async function assertRevert (promise) {
    try {
        await promise
    } catch (error) {
        // console.log('error message: ', error)
        // TODO: Check jump destination to nguish between a throw
        //       and an actual invalid jump.
        const invalidOpcode = error.message.search('invalid opcode') >= 0
        // TODO: When we contract A calls contract B, and B throws, instead
        //       of an 'invalid jump', we get an 'out of gas' error. How do
        //       we distinguish this from an actual out of gas event? (The
        //       testrpc log actually show an 'invalid jump' event.)
        const outOfGas = error.message.search('out of gas') >= 0
        const revert = error.message.search('revert') >= 0
        const invalidSender = error.message.search('sender account not recognized') >= 0
        assert(
            invalidOpcode || outOfGas || revert || invalidSender,
            'Expected throw, got \'' + error + '\' instead',
        )
        return true
    }
    assert.fail('Expected throw not received')
}

module.exports = {
    assertRevert,
}