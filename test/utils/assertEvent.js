/*
**************************************************************************************************
Copyright 2017-18 Chaitanya Amin.
Private License.
No License grated to view, modify, merge, compare or use this file without explicit written consent.
Consent can be obtained on payment of consideration.
For commercial terms please email chaitanyaamin@gmail.com
**************************************************************************************************
*/

const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert

async function buildEventsArray(transactionResult, expectedEvents, filterByName) {
    let observedEvents = new Array()

    transactionResult.logs.forEach(function (logEntry) {
        let expectedEntry = expectedEvents.find(function (evt) {
            return (evt.event === logEntry.event)
        })

        // When filtering, ignore events that are not expected
        if ((!filterByName) || expectedEntry) {
            // Event name
            let event = {
                event: logEntry.event,
            }

            // Event arguments
            // Ignore the arguments when they are not tested
            // (ie. expectedEntry.args is undefined)
            if ((!expectedEntry) || (expectedEntry && expectedEntry.args)) {
                event.args = Object.keys(logEntry.args).reduce(function (previous, current) {
                    previous[current] =
                        (typeof logEntry.args[current].toNumber === 'function')
                            ? logEntry.args[current].toNumber()
                            : logEntry.args[current]
                    return previous
                }, {})
            }

            observedEvents.push(event)
        }
    })

    return observedEvents
}

/*
 * Usage: Get transaction related data from Truffle
 *     let ret = await smartContractInstance.funcThatEmitsEvent()
 * Check For
 *     let eventArray = [
 *          { event: 'E1', args: {param_1: 'Some value', param_2: 0x123456 } }, // testedFunction must emit E1
 *          { event: 'E2', args: {param_1: 'Some value', param_2: 0x123456 } }  // testedFunction must emit E2
 *           // What if testedFunction emits E3 too? It's okay
 *     ]
 *     await solAllEvents(ret, eventArray, 'The event is emitted')             // Custom message passed
 */
async function solAllEvents(observedTransactionResult, expectedEvents, message) {
    let entries = await buildEventsArray(observedTransactionResult, expectedEvents, false)
    assert.deepEqual(entries, expectedEvents, message)
}

/*
 * Usage: Get transaction related data from Truffle
 *     let ret = await smartContractInstance.funcThatEmitsEvent()
 * Check For
 *     let eventArray = [
 *          { event: 'E1', args: {param_1: 'Some value', param_2: 0x123456 } }, // testedFunction must emit E1
 *          { event: 'E2', args: {param_1: 'Some value', param_2: 0x123456 } }  // testedFunction must emit E2
 *           // What if testedFunction emits E3 too? It's okay
 *     ]
 *     await solSomeEvents(ret, eventArray, 'The event is emitted')             // Custom message passed
 */

async function solSomeEvents(observedTransactionResult, expectedEvents, message) {
    let entries = await buildEventsArray(observedTransactionResult, expectedEvents, true)
    assert.deepEqual(entries, expectedEvents, message)
}

/*
 * Usage: Get transaction related data from Truffle
 *     let ret = await smartContractInstance.funcThatEmitsEvent()
 * Check For
 *     solEvents(ret,
 *     {
 *        event: 'TestedEvent',  // Name of Event has to match
 *        args: {
 *                 param_1: 'Some value',     // param_1 has to match param name in event
 *                 param_2: 0x123456          // automatically calls toNumber()
 *               }
 *     }, 'The event is emitted')             // Custom message passed
 */
async function solEvents(observedTransactionResult, expectedEvent, message) {
    await solSomeEvents(observedTransactionResult, [expectedEvent], message)
}

module.exports = {
    solEvents,
    solAllEvents,
    solSomeEvents,
}