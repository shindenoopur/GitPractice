/**********************************************************************************************************************
 Copyright 2017-18 Chaitanya Amin.
 Private License.
 No License grated to view, modify, merge, compare or use this file without express written consent.
 Consent can be obtained on payment of consideration.
 For commercial terms please email chaitanyaamin@gmail.com
 **********************************************************************************************************************/

const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')
const customEvent = require('../utils/assertEvent')
const MultiSigWallet = artifacts.require('MultiSigWallet')
const BCToken = artifacts.require('BCToken')

contract('MultiSigWallet Test Suite', async (accounts) => {
    describe('MultiSigWallet [ * ]', async () => {
        // It has been set via constructor during contract deployment
        let defaultOwners = [
            accounts[0],
            accounts[1],
            accounts[2],
            accounts[3],
            accounts[4],
        ]
        const DEFAULT_NO_MAX_OWNER = 50
        const INITIAL_TX_COUNT = 0
        const INITIAL_NO_CONF = 3

        const owner1 = accounts[0]
        const owner2 = accounts[1]
        const owner3 = accounts[2]
        const owner4 = accounts[3]
        const owner5 = accounts[4]

        let data = null
        let accountToAddAsOwner = accounts[9]
        let accountToRemoveFromOwner = accountToAddAsOwner
        let replaceOwnerAcc = accounts[7]
        let BCTokenAdd = ''
        let noOwnerAdd = '0x0000000000000000000000000000000000000000'
        let transactionIndex = 0

        let wallet, BC721TokenInstance, txObject, returnValue, txIds

        //Get the Contract Instance
        before(async () => {
            // await customAssert.assertRevert(MultiSigWallet.new([owner1, owner2, owner3, owner4, owner5, noOwnerAdd], 3)) //noOwnerAdd covers the else part of require(!isOwner[_owners[i]] && _owners[i] != 0)
            wallet = await MultiSigWallet.new([owner1, owner2, owner3, owner4, owner5], 3)
            BC721TokenInstance = await BCToken.new({from: owner1}) // Deploying it using the 0th account
            BCTokenAdd = BC721TokenInstance.address
            console.log('\tDefault Owners\n')
            console.log('\t------------------------------------------------------')
            let owners = await wallet.getOwners.call()
            owners.forEach((element) => {
                console.log('\t',element)
            })
            console.log('\t------------------------------------------------------\n')
        })

        describe('Constructor', async () => {
            it('Verify max owner count', async () => {
                let ownerCount = await wallet.MAX_OWNER_COUNT.call()
                assert.equal(ownerCount, DEFAULT_NO_MAX_OWNER, 'Owner count do not match')
            })

            it('Verify owners', async () => {
                let owners = await wallet.getOwners.call()
                assert.deepStrictEqual(owners, defaultOwners, 'Default Owners and Owners from contract are different')
            })

            it('Verify transaction count', async () => {
                let transactionCount = await wallet.transactionCount.call()
                assert.equal(transactionCount.toNumber(), INITIAL_TX_COUNT, 'Default transaction count is not equal')
            })

            it('Verify required no of confirmations', async () => {
                let noOfConfirmations = await wallet.required.call()
                assert.equal(noOfConfirmations.toNumber(), INITIAL_NO_CONF, 'Default transaction count is not equal')
            })

            describe('Verify isOwner', async () => {
                it('Should return isOwner false', async () => {
                    let isAccountOwner = accounts[6]
                    let isOwner = await wallet.isOwner.call(isAccountOwner)
                    assert.equal(isOwner, false, 'Should have returned isOwner false')
                })

                it('Should return isOwner true', async () => {
                    let isAccountOwner = accounts[4]
                    let isOwner = await wallet.isOwner.call(isAccountOwner)
                    assert.equal(isOwner, true, 'Should have returned isOwner true')
                })
            })
        })

        describe('Checks values of getTransactionCount() & getTransactionIds()', async () => {
            it('Checks value of getTransactionCount()', async () => {
                let txCount = await wallet.getTransactionCount.call(true, true)
                assert.equal(txCount.toNumber(), 0, 'Initial transaction count is not zero')
            })

            it('Checks value of getTransactionIds()', async () => {
                txIds = await wallet.getTransactionIds.call(0, 0, true, true)
                assert.equal(txIds.length, 0, 'Transaction ids length is not zero')
            })

            it('Hits the else path of require(from <= to)', async () => {
                customAssert.assertRevert(wallet.getTransactionIds.call(5, 0, true, true))
            })
        })

        //submitTransaction() for addOwner
        describe('submitTransaction(address destination, uint value, bytes data) public returns (uint transactionId) for addOwner()', async () => {
            before(async () => {
                // console.log(wallet)
                data = wallet.contract.methods.addOwner(accountToAddAsOwner).encodeABI()
            })

            describe('Verify submitTransaction', async () => {
                it('Hit the else path of onlyWallet() modifier', async () => {
                    await customAssert.assertRevert(wallet.submitTransaction(noOwnerAdd, 0, data, {
                        from: owner1,
                        gas: 300000
                    }))
                })

                it('Submit transaction for addOwner', async () => {
                    txObject = await wallet.submitTransaction(wallet.address, 0, data, {from: owner1, gas: 300000})
                    assert.equal(txObject.receipt.status, true, 'Error in submission of addOwner')
                })

                it('Hit the else path of ownerDoesNotExist() modifier', async () => {
                    await customAssert.assertRevert(wallet.submitTransaction(wallet.address, 0, data, {
                        from: accounts[8],
                        gas: 300000,
                    }))
                })

                it('Checks submitted transaction is same as transactions[transactionIndex]', async () => {
                    let expectedTransaction = {
                        0: wallet.address,
                        1: 0,
                        2: data,
                        3: false,
                        destination: wallet.address,
                        value: 0,
                        data: data,
                        executed: false,
                    }

                    let actualTransaction = await wallet.transactions.call(transactionIndex)
                    actualTransaction[1] = actualTransaction[1].toNumber() // since value returned from the contract is a BigNumber
                    actualTransaction.value = actualTransaction.value.toNumber()
                    assert.deepStrictEqual(expectedTransaction, actualTransaction, 'Actual and expected transactions are different')
                })

                it('Should fail for destination equal to address(0)', async () => {
                    await customAssert.assertRevert(wallet.submitTransaction(noOwnerAdd, 0, data, {
                        from: owner1,
                        gas: 300000
                    }))
                })
            })

            describe('Checks for events emitted by submitTransaction:addTransaction()', async () => {
                it('Checks for Submission & Confirmation event', async () => {
                    let emittedEventArray = [
                        {
                            event: 'Submission',
                            args: {
                                0: transactionIndex,
                                __length__: 1,
                                transactionId: transactionIndex,
                            },
                        },
                        {
                            event: 'Confirmation',
                            args: {
                                0: owner1,
                                1: transactionIndex,
                                __length__: 2,
                                sender: owner1,
                                transactionId: transactionIndex,
                            },
                        },
                    ]
                    await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                })
            })

            describe('Grants confirmations', async () => {
                // mapping(uint => mapping(address => bool)) public confirmations
                describe('Checks confirmation status to be false', async () => {
                    let conf

                    it('Should return confirmation of owner2 to be false', async () => {
                        conf = await wallet.confirmations.call(transactionIndex, owner2)
                        assert.equal(conf, false, 'Owner2 confirmation is true')
                    })

                    it('Should return confirmation of owner3 to be false', async () => {
                        conf = await wallet.confirmations.call(transactionIndex, owner3)
                        assert.equal(conf, false, 'Owner3 confirmation is true')
                    })
                })

                describe('Should grant confirmation by owner2', async () => {
                    it('Checks no of confirmations to be 2', async () => {
                        txObject = await wallet.confirmTransaction(transactionIndex, {from: owner2})
                        let noOfConfirmations = await wallet.getConfirmationCount.call(transactionIndex)
                        assert.equal(noOfConfirmations, INITIAL_NO_CONF - 1, 'Required no of confirmations is different')
                    })

                    it('Checks addresses that gave confirmations', async () => {
                        let required = 0
                        let addrsThatGaveConf = await wallet.getConfirmations.call(transactionIndex)
                        for (let index = 0; index < addrsThatGaveConf.length; index++) {
                            if (addrsThatGaveConf[index] === owner1 || addrsThatGaveConf[index] === owner2) {
                                required++
                            }
                        }
                        assert.equal(required, INITIAL_NO_CONF - 1, 'Addresses that gave confirmation are different')
                    })

                    describe('Checks confirmation status of owner2 to be true', async () => {
                        let conf
                        it('Should return confirmation of owner2 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner2)
                            assert.equal(conf, true, 'Owner2 confirmation is true')
                        })
                    })

                    // is transaction confirmed
                    describe('Checks transaction confirmed to be false', async () => {
                        it('Should check for isConfirmed transaction to be false', async () => {
                            returnValue = await wallet.isConfirmed.call(transactionIndex)
                            assert.equal(returnValue, false, 'Requred number of confirmations is not given')
                        })
                    })

                    describe('Checks events emitted by confirmTransaction()', async () => {
                        it('Checks for Confirmation event by owner2', async () => {
                            let emittedEventArray = [{
                                event: 'Confirmation',
                                args: {
                                    0: owner2,
                                    1: transactionIndex,
                                    __length__: 2,
                                    sender: owner2,
                                    transactionId: transactionIndex,
                                },
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                        })
                    })

                })

                describe('Should grant confirmation by owner3', async () => {
                    it('Checks no of confirmations to be 3', async () => {
                        txObject = await wallet.confirmTransaction(transactionIndex, {from: owner3})
                        let noOfConfirmations = await wallet.getConfirmationCount.call(transactionIndex)
                        assert.equal(noOfConfirmations, INITIAL_NO_CONF, 'Required no of confirmations is different')
                    })

                    it('Checks addresses that gave confirmations', async () => {
                        let required = 0
                        let addrsThatGaveConf = await wallet.getConfirmations.call(transactionIndex)
                        for (let index = 0; index < addrsThatGaveConf.length; index++) {
                            if (addrsThatGaveConf[index] === owner1 || addrsThatGaveConf[index] === owner2 || addrsThatGaveConf[index] === owner3) {
                                required++
                            }
                        }
                        assert.equal(required, INITIAL_NO_CONF, 'Addresses that gave confirmation are different')
                    })

                    describe('Checks confirmation status of owner3 to be true', async () => {
                        let conf
                        it('Should return confirmation of owner3 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner3)
                            assert.equal(conf, true, 'Owner3 confirmation is true')
                        })
                    })

                    // is transaction confirmed
                    describe('Checks transaction confirmed to be true', async () => {
                        it('Should check for isConfirmed transaction to be true', async () => {
                            returnValue = await wallet.isConfirmed.call(transactionIndex)
                            assert.equal(returnValue, true, 'Requred number of confirmations is not given')
                        })
                    })

                    describe('Checks events emitted by confirmTransaction()', async () => {
                        it('Checks for Confirmation, OwnerAddition & Execution event by owner3', async () => {
                            let emittedEventArray = [
                                {
                                    event: 'Confirmation',
                                    args: {
                                        0: owner3,
                                        1: transactionIndex,
                                        __length__: 2,
                                        sender: owner3,
                                        transactionId: transactionIndex,
                                    },
                                },
                                {
                                    event: 'OwnerAddition',
                                    args: {
                                        0: accountToAddAsOwner,
                                        __length__: 1,
                                        owner: accountToAddAsOwner,
                                    },
                                },
                                {
                                    event: 'Execution',
                                    args: {
                                        0: transactionIndex,
                                        __length__: 1,
                                        transactionId: transactionIndex,
                                    },
                                },
                            ]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                        })
                    })
                })

                describe('Checks confirmation status of owner2 to be true', async () => {
                    let conf
                    describe('Get all confirmation status', async () => {
                        it('Should return confirmation of owner1 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner1)
                            assert.equal(conf, true, 'Owner1 confirmation is true')
                        })
                        it('Should return confirmation of owner2 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner2)
                            assert.equal(conf, true, 'Owner2 confirmation is true')
                        })
                        it('Should return confirmation of owner3 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner3)
                            assert.equal(conf, true, 'Owner3 confirmation is true')
                        })
                    })
                })
            })

            describe('After owner addition', async () => {
                it('List of Owners after addOwner()', async () => {
                    console.log('\t------------------------------------------------------')
                    let owners = await wallet.getOwners.call()
                    owners.forEach((element) => {
                        console.log('\t',element)
                    })
                    console.log('\t------------------------------------------------------\n')
                })
            })
        })


        describe('confirmTransaction(uint transactionId) public ownerExists(msg.sender) transactionExists(transactionId) notConfirmed(transactionId, msg.sender)', async () => {
            describe('Verify confirmTransaction()', async () => {
                it('Should fail invoke confirmTransaction from non-owner', async () => {
                    await customAssert.assertRevert(wallet.confirmTransaction(transactionIndex, {from: accounts[7]}))
                })

                it('Should fail for non-existing transaction', async () => {
                    let txCount = await wallet.getTransactionCount.call(true, true)
                    let nonExistingTx = txCount.toNumber() + 1
                    await customAssert.assertRevert(wallet.confirmTransaction(nonExistingTx, {from: owner1}))
                })

                it('Should fail for already confirmed transaction', async () => {
                    await customAssert.assertRevert(wallet.confirmTransaction(transactionIndex, {from: owner1}))
                })
            })
        })

        describe('executeTransaction(uint transactionId) public ownerExists(msg.sender) confirmed(transactionId, msg.sender) notExecuted(transactionId)', async () => {
            describe('Verify executeTransaction()', async () => {
                it('Should fail invoke executeTransaction from non-owner', async () => {
                    await customAssert.assertRevert(wallet.executeTransaction(transactionIndex, {from: accounts[7]}))
                })

                it('Should fail for already non-confirmed transaction', async () => {
                    await customAssert.assertRevert(wallet.executeTransaction(transactionIndex, {from: owner4})) // Since owner4 has not confirmed the tx
                })

                it('Should fail for already executed transaction', async () => {
                    await customAssert.assertRevert(wallet.executeTransaction(transactionIndex, {from: owner1}))
                })
            })
        })

        //submitTransaction() for removeOwner
        describe('submitTransaction(address destination, uint value, bytes data) public returns (uint transactionId) for removeOwner()', async () => {
            before(async () => {
                data = wallet.contract.methods.removeOwner(accountToRemoveFromOwner).encodeABI()
            })

            describe('Verify submitTransaction', async () => {
                it('Submit transaction for removeOwner', async () => {
                    txObject = await wallet.submitTransaction(wallet.address, 0, data, {from: owner1, gas: 300000})
                    assert.equal(txObject.receipt.status, true, 'Error in submission of replaceOwner')
                })

                it('Gets the latest transaction id', async () => {
                    txIds = await wallet.getTransactionIds.call(0, 1, true, false)
                    let txCount = await wallet.getTransactionCount.call(true, false)
                    transactionIndex = txIds.length //updates transactionIndex
                    assert.equal(txIds.length, txCount.toNumber(), 'Error in fetching latest transaction id')
                })

                it('Checks submitted transaction is same as transactions[transactionIndex]', async () => {
                    let expectedTransaction = {
                        0: wallet.address,
                        1: 0,
                        2: data,
                        3: false,
                        destination: wallet.address,
                        value: 0,
                        data: data,
                        executed: false
                    }
                    let actualTransaction = await wallet.transactions.call(transactionIndex)
                    actualTransaction[1] = actualTransaction[1].toNumber() // since value returned from the contract is a BigNumber
                    actualTransaction.value = actualTransaction.value.toNumber()
                    assert.deepStrictEqual(expectedTransaction, actualTransaction, 'Actual and expected transactions are different')
                })

                it('Should fail for destination equal to address(0)', async () => {
                    await customAssert.assertRevert(wallet.submitTransaction(noOwnerAdd, 0, data, {
                        from: owner1,
                        gas: 300000
                    }))
                })
            })

            describe('Checks for events emitted by submitTransaction:addTransaction()', async () => {
                it('Checks for Submission & Confirmation event', async () => {
                    let emittedEventArray = [
                        {
                            event: 'Submission',
                            args: {
                                0: transactionIndex,
                                __length__: 1,
                                transactionId: transactionIndex,
                            },
                        },
                        {
                            event: 'Confirmation',
                            args: {
                                0: owner1,
                                1: transactionIndex,
                                __length__: 2,
                                sender: owner1,
                                transactionId: transactionIndex,
                            },
                        },
                    ]
                    await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                })
            })

            describe('Grants confirmations', async () => {
                // mapping(uint => mapping(address => bool)) public confirmations
                describe('Checks confirmation status to be false', async () => {
                    let conf

                    it('Should return confirmation of owner2 to be false', async () => {
                        conf = await wallet.confirmations.call(transactionIndex, owner2)
                        assert.equal(conf, false, 'Owner2 confirmation is true')
                    })

                    it('Should return confirmation of owner3 to be false', async () => {
                        conf = await wallet.confirmations.call(transactionIndex, owner3)
                        assert.equal(conf, false, 'Owner3 confirmation is true')
                    })
                })


                describe('Should grant confirmation by owner2', async () => {
                    it('Checks no of confirmations to be 2', async () => {
                        txObject = await wallet.confirmTransaction(transactionIndex, {from: owner2})
                        let noOfConfirmations = await wallet.getConfirmationCount.call(transactionIndex)
                        assert.equal(noOfConfirmations, INITIAL_NO_CONF - 1, 'Required no of confirmations is different')
                    })

                    it('Checks addresses that gave confirmations', async () => {
                        let required = 0
                        let addrsThatGaveConf = await wallet.getConfirmations.call(transactionIndex)
                        for (let index = 0; index < addrsThatGaveConf.length; index++) {
                            if (addrsThatGaveConf[index] === owner1 || addrsThatGaveConf[index] === owner2) {
                                required++
                            }
                        }
                        assert.equal(required, INITIAL_NO_CONF - 1, 'Addresses that gave confirmation are different')
                    })

                    describe('Checks confirmation status of owner2 to be true', async () => {
                        let conf
                        it('Should return confirmation of owner2 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner2)
                            assert.equal(conf, true, 'Owner2 confirmation is false')
                        })
                    })

                    // is transaction confirmed
                    describe('Checks transaction confirmed to be false', async () => {
                        it('Should check for isConfirmed transaction to be false', async () => {
                            returnValue = await wallet.isConfirmed.call(transactionIndex)
                            assert.equal(returnValue, false, 'Requred number of confirmations is not given')
                        })
                    })

                    describe('Checks events emitted by confirmTransaction()', async () => {
                        it('Checks for Confirmation event by owner2', async () => {
                            let emittedEventArray = [{
                                event: 'Confirmation',
                                args: {
                                    0: owner2,
                                    1: transactionIndex,
                                    __length__: 2,
                                    sender: owner2,
                                    transactionId: transactionIndex,
                                },
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                        })
                    })

                })

                describe('Should grant confirmation by owner3', async () => {
                    it('Checks no of confirmations to be 3', async () => {
                        txObject = await wallet.confirmTransaction(transactionIndex, {from: owner3})
                        let noOfConfirmations = await wallet.getConfirmationCount.call(transactionIndex)
                        assert.equal(noOfConfirmations, INITIAL_NO_CONF, 'Required no of confirmations is different')
                    })

                    it('Checks addresses that gave confirmations', async () => {
                        let required = 0
                        let addrsThatGaveConf = await wallet.getConfirmations.call(transactionIndex)
                        for (let index = 0; index < addrsThatGaveConf.length; index++) {
                            if (addrsThatGaveConf[index] === owner1 || addrsThatGaveConf[index] === owner2 || addrsThatGaveConf[index] === owner3) {
                                required++
                            }
                        }
                        assert.equal(required, INITIAL_NO_CONF, 'Addresses that gave confirmation are different')
                    })

                    describe('Checks confirmation status of owner3 to be true', async () => {
                        let conf
                        it('Should return confirmation of owner3 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner3)
                            assert.equal(conf, true, 'Owner3 confirmation is true')
                        })
                    })

                    // is transaction confirmed
                    describe('Checks transaction confirmed to be true', async () => {
                        it('Should check for isConfirmed transaction to be true', async () => {
                            returnValue = await wallet.isConfirmed.call(transactionIndex)
                            assert.equal(returnValue, true, 'Requred number of confirmations is not given')
                        })
                    })

                    describe('Checks events emitted by confirmTransaction()', async () => {
                        it('Checks for Confirmation, OwnerAddition & Execution event by owner3', async () => {
                            let emittedEventArray = [
                                {
                                    event: 'Confirmation',
                                    args: {
                                        0: owner3,
                                        1: transactionIndex,
                                        __length__: 2,
                                        sender: owner3,
                                        transactionId: transactionIndex,
                                    },
                                },
                                {
                                    event: 'OwnerRemoval',
                                    args: {
                                        0: accountToRemoveFromOwner,
                                        __length__: 1,
                                        owner: accountToRemoveFromOwner,
                                    },
                                },
                                {
                                    event: 'Execution',
                                    args: {
                                        0: transactionIndex,
                                        __length__: 1,
                                        transactionId: transactionIndex,
                                    },
                                },
                            ]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                        })
                    })
                })

                describe('Checks confirmation status of all owners to be true', async () => {
                    let conf
                    describe('Get all confirmation status', async () => {
                        it('Should return confirmation of owner1 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner1)
                            assert.equal(conf, true, 'Owner1 confirmation is true')
                        })
                        it('Should return confirmation of owner2 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner2)
                            assert.equal(conf, true, 'Owner2 confirmation is true')
                        })
                        it('Should return confirmation of owner3 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner3)
                            assert.equal(conf, true, 'Owner3 confirmation is true')
                        })
                    })
                })

                describe('After owner removal', async () => {
                    it('List of owners after removeOwner()', async () => {
                        console.log('\t------------------------------------------------------')
                        let owners = await wallet.getOwners.call()
                        owners.forEach((element) => {
                            console.log('\t',element)
                        })
                        console.log('\t------------------------------------------------------\n')
                    })
                })
            })
        })

        //submitTransaction() for replaceOwner
        describe('submitTransaction(address destination, uint value, bytes data) public returns (uint transactionId) for replaceOwner()', async () => {
            before(async () => {
                data = wallet.contract.methods.replaceOwner(owner4, replaceOwnerAcc).encodeABI()
            })

            describe('Verify submitTransaction', async () => {
                it('Submit transaction for replaceOwner', async () => {
                    txObject = await wallet.submitTransaction(wallet.address, 0, data, {from: owner1, gas: 300000})
                    assert.equal(txObject.receipt.status, true, 'Error in submission of replaceOwner')
                })

                it('Gets the latest transaction id', async () => {
                    txIds = await wallet.getTransactionIds.call(0, 2, true, false)
                    let txCount = await wallet.getTransactionCount.call(true, false)
                    transactionIndex = txIds.length
                    assert(txIds.length > txCount.toNumber(), 'Error in fetching latest transaction id')
                })

                it('Checks submitted transaction is same as transactions[transactionIndex]', async () => {
                    let expectedTransaction = {
                        0 : wallet.address,
                        1 : 0,
                        2: data,
                        3: false,
                        data: data,
                        destination: wallet.address,
                        executed: false,
                        value: 0
                    }
                    let actualTransaction = await wallet.transactions.call(transactionIndex)
                    actualTransaction[1] = actualTransaction[1].toNumber() // since value returned from the contract is a BigNumber
                    actualTransaction.value = actualTransaction.value.toNumber()
                    assert.deepStrictEqual(expectedTransaction, actualTransaction, 'Actual and expected transactions are different')
                })

                it('Should fail for destination equal to address(0)', async () => {
                    await customAssert.assertRevert(wallet.submitTransaction(noOwnerAdd, 0, data, {
                        from: owner1,
                        gas: 300000,
                    }))
                })
            })

            describe('Checks for events emitted by submitTransaction:addTransaction()', async () => {
                it('Checks for Submission & Confirmation event', async () => {
                    let emittedEventArray = [
                        {
                            event: 'Submission',
                            args: {
                                0: transactionIndex,
                                __length__: 1,
                                transactionId: transactionIndex,
                            },
                        },
                        {
                            event: 'Confirmation',
                            args: {
                                0: owner1,
                                1: transactionIndex,
                                __length__: 2,
                                sender: owner1,
                                transactionId: transactionIndex,
                            },
                        },
                    ]
                    await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                })
            })

            describe('Grants confirmations', async () => {
                // mapping(uint => mapping(address => bool)) public confirmations
                describe('Checks confirmation status to be false', async () => {
                    let conf

                    it('Should return confirmation of owner2 to be false', async () => {
                        conf = await wallet.confirmations.call(transactionIndex, owner2)
                        assert.equal(conf, false, 'Owner2 confirmation is true')
                    })

                    it('Should return confirmation of owner3 to be false', async () => {
                        conf = await wallet.confirmations.call(transactionIndex, owner3)
                        assert.equal(conf, false, 'Owner3 confirmation is true')
                    })
                })


                describe('Should grant confirmation by owner2', async () => {
                    it('Checks no of confirmations to be 2', async () => {
                        txObject = await wallet.confirmTransaction(transactionIndex, {from: owner2})
                        // console.log('owner2: ', JSON.stringify(txObject))
                        let noOfConfirmations = await wallet.getConfirmationCount.call(transactionIndex)
                        assert.equal(noOfConfirmations, INITIAL_NO_CONF - 1, 'Required no of confirmations is different')
                    })

                    it('Checks addresses that gave confirmations', async () => {
                        let required = 0
                        let addrsThatGaveConf = await wallet.getConfirmations.call(transactionIndex)
                        for (let index = 0; index < addrsThatGaveConf.length; index++) {
                            if (addrsThatGaveConf[index] === owner1 || addrsThatGaveConf[index] === owner2) {
                                required++
                            }
                        }
                        assert.equal(required, INITIAL_NO_CONF - 1, 'Addresses that gave confirmation are different')
                    })

                    describe('Checks confirmation status of owner2 to be true', async () => {
                        let conf
                        it('Should return confirmation of owner2 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner2)
                            assert.equal(conf, true, 'Owner2 confirmation is false')
                        })
                    })

                    // is transaction confirmed
                    describe('Checks transaction confirmed to be false', async () => {
                        it('Should check for isConfirmed transaction to be false', async () => {
                            returnValue = await wallet.isConfirmed.call(transactionIndex)
                            assert.equal(returnValue, false, 'Requred number of confirmations is not given')
                        })
                    })

                    describe('Checks events emitted by confirmTransaction()', async () => {
                        it('Checks for Confirmation event by owner2', async () => {
                            let emittedEventArray = [{
                                event: 'Confirmation',
                                args: {
                                    0: owner2,
                                    1: transactionIndex,
                                    __length__: 2,
                                    sender: owner2,
                                    transactionId: transactionIndex,
                                },
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                        })
                    })

                })

                describe('Should grant confirmation by owner3', async () => {
                    it('Checks no of confirmations to be 3', async () => {
                        txObject = await wallet.confirmTransaction(transactionIndex, {from: owner3})
                        // console.log('owner3: ', JSON.stringify(txObject))
                        let noOfConfirmations = await wallet.getConfirmationCount.call(transactionIndex)
                        assert.equal(noOfConfirmations, INITIAL_NO_CONF, 'Required no of confirmations is different')
                    })

                    it('Checks addresses that gave confirmations', async () => {
                        let required = 0
                        let addrsThatGaveConf = await wallet.getConfirmations.call(transactionIndex)
                        for (let index = 0; index < addrsThatGaveConf.length; index++) {
                            if (addrsThatGaveConf[index] === owner1 || addrsThatGaveConf[index] === owner2 || addrsThatGaveConf[index] === owner3) {
                                required++
                            }
                        }
                        assert.equal(required, INITIAL_NO_CONF, 'Addresses that gave confirmation are different')
                    })

                    describe('Checks confirmation status of owner3 to be true', async () => {
                        let conf
                        it('Should return confirmation of owner3 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner3)
                            assert.equal(conf, true, 'Owner3 confirmation is true')
                        })
                    })

                    // is transaction confirmed
                    describe('Checks transaction confirmed to be true', async () => {
                        it('Should check for isConfirmed transaction to be true', async () => {
                            returnValue = await wallet.isConfirmed.call(transactionIndex)
                            // let confCount = await wallet.getConfirmationCount.call(transactionIndex)
                            // console.log("***********************************", confCount)
                            assert.equal(returnValue, true, 'Requred number of confirmations is not given')
                        })
                    })

                    describe('Checks events emitted by confirmTransaction()', async () => {
                        it('Checks for Confirmation, OwnerAddition & Execution event by owner3', async () => {
                            let emittedEventArray = [
                                {
                                    event: 'Confirmation',
                                    args: {
                                        0: owner3,
                                        1: transactionIndex,
                                        __length__: 2,
                                        sender: owner3,
                                        transactionId: transactionIndex,
                                    },
                                },
                                {
                                    event: 'OwnerRemoval',
                                    args: {
                                        0: owner4,
                                        __length__: 1,
                                        owner: owner4,
                                    },
                                },
                                {
                                    event: 'OwnerAddition',
                                    args: {
                                        0: replaceOwnerAcc,
                                        __length__: 1,
                                        owner: replaceOwnerAcc,
                                    },
                                },
                                {
                                    event: 'Execution',
                                    args: {
                                        0: transactionIndex,
                                        __length__: 1,
                                        transactionId: transactionIndex,
                                    },
                                },
                            ]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                        })
                    })
                })

                describe('Checks confirmation status of all owners to be true', async () => {
                    let conf
                    describe('Get all confirmation status', async () => {
                        it('Should return confirmation of owner1 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner1)
                            assert.equal(conf, true, 'Owner1 confirmation is true')
                        })
                        it('Should return confirmation of owner2 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner2)
                            assert.equal(conf, true, 'Owner2 confirmation is true')
                        })
                        it('Should return confirmation of owner3 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner3)
                            assert.equal(conf, true, 'Owner3 confirmation is true')
                        })
                    })
                })

                describe('After owner replacement', async () => {
                    it('List of owners after replaceOwner()', async () => {
                        console.log('\t------------------------------------------------------')
                        let owners = await wallet.getOwners.call()
                        owners.forEach((element) => {
                            console.log('\t',element)
                        })
                        console.log('\t------------------------------------------------------\n')
                    })
                })
            })
        })

        //submitTransaction() for changeRequirement
        describe('submitTransaction(address destination, uint value, bytes data) public returns (uint transactionId) for changeRequirement()', async () => {
            before(async () => {
                let changedConfCount = 2
                data = wallet.contract.methods.changeRequirement(changedConfCount).encodeABI()
            })

            describe('Verify submitTransaction', async () => {
                it('Submit transaction for changeRequirement', async () => {
                    txObject = await wallet.submitTransaction(wallet.address, 0, data, {from: owner1, gas: 300000})
                    assert.equal(txObject.receipt.status, true, 'Error in submission of changeRequirement')
                })

                it('Gets the latest transaction id', async () => {
                    txIds = await wallet.getTransactionIds.call(0, 3, true, false)
                    let txCount = await wallet.getTransactionCount.call(true, false)
                    transactionIndex = txIds.length
                    // console.log('TransactionIndex: **********', transactionIndex)
                    assert(txIds.length > txCount.toNumber(), 'Error in fetching latest transaction id')
                })

                it('Checks submitted transaction is same as transactions[transactionIndex]', async () => {
                    let expectedTransaction = {
                        0 : wallet.address,
                        1 : 0,
                        2: data,
                        3: false,
                        destination: wallet.address,
                        value: 0,
                        data: data,
                        executed: false,
                    }
                    let actualTransaction = await wallet.transactions.call(transactionIndex)
                    actualTransaction[1] = actualTransaction[1].toNumber() // since value returned from the contract is a BigNumber
                    actualTransaction.value = actualTransaction.value.toNumber()
                    assert.deepStrictEqual(expectedTransaction, actualTransaction, 'Actual and expected transactions are different')
                })

                it('Should fail for destination equal to address(0)', async () => {
                    await customAssert.assertRevert(wallet.submitTransaction(noOwnerAdd, 0, data, {
                        from: owner1,
                        gas: 300000,
                    }))
                })
            })

            describe('Checks for events emitted by submitTransaction:addTransaction()', async () => {
                it('Checks for Submission & Confirmation event', async () => {
                    let emittedEventArray = [
                        {
                            event: 'Submission',
                            args: {
                                0: transactionIndex,
                                __length__: 1,
                                transactionId: transactionIndex,
                            },
                        },
                        {
                            event: 'Confirmation',
                            args: {
                                0: owner1,
                                1: transactionIndex,
                                __length__: 2,
                                sender: owner1,
                                transactionId: transactionIndex,
                            },
                        },
                    ]
                    await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                })
            })

            describe('Grants confirmations', async () => {
                // mapping(uint => mapping(address => bool)) public confirmations
                describe('Checks confirmation status to be false', async () => {
                    let conf

                    it('Should return confirmation of owner2 to be false', async () => {
                        conf = await wallet.confirmations.call(transactionIndex, owner2)
                        assert.equal(conf, false, 'Owner2 confirmation is true')
                    })

                    it('Should return confirmation of owner3 to be false', async () => {
                        conf = await wallet.confirmations.call(transactionIndex, owner3)
                        assert.equal(conf, false, 'Owner3 confirmation is true')
                    })
                })


                describe('Should grant confirmation by owner2', async () => {
                    describe('Confirmation granted by owner2', async () => {
                        it('Checks no of confirmations to be 2', async () => {
                            txObject = await wallet.confirmTransaction(transactionIndex, {from: owner2})
                            // console.log('owner2: ', JSON.stringify(txObject))
                            let noOfConfirmations = await wallet.getConfirmationCount.call(transactionIndex)
                            assert.equal(noOfConfirmations, INITIAL_NO_CONF - 1, 'Required no of confirmations is different')
                        })


                        it('Checks addresses that gave confirmations', async () => {
                            let required = 0
                            let addrsThatGaveConf = await wallet.getConfirmations.call(transactionIndex)
                            for (let index = 0; index < addrsThatGaveConf.length; index++) {
                                if (addrsThatGaveConf[index] === owner1 || addrsThatGaveConf[index] === owner2) {
                                    required++
                                }
                            }
                            assert.equal(required, INITIAL_NO_CONF - 1, 'Addresses that gave confirmation are different')
                        })

                    })

                    describe('Revokes confirmation granted by owner2', async () => {

                        it('Should return confirmation of owner2 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner2)
                            assert.equal(conf, true, 'Owner2 confirmation is false')
                        })

                        it('Revoke owner2 confirmation', async () => {
                            txObject = await wallet.revokeConfirmation(transactionIndex, {from: owner2})
                            assert.equal(txObject.receipt.status, true, 'Error in revoke confirmation')
                        })

                        it('Should return confirmation of owner2 to be false', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner2)
                            assert.equal(conf, false, 'Owner2 confirmation is false')
                        })

                        describe('Checks events emitted by revokeConfirmation()', async () => {
                            it('Checks for Revocation event by owner2', async () => {
                                let emittedEventArray = [{
                                    event: 'Revocation',
                                    args: {
                                        0: owner2,
                                        1: transactionIndex,
                                        __length__: 2,
                                        sender: owner2,
                                        transactionId: transactionIndex,
                                    },
                                }]
                                await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                            })
                        })
                    })

                    describe('Owner2 again grants confirmation', async () => {
                        describe('Confirmation granted by owner2', async () => {
                            it('Checks no of confirmations to be 2', async () => {
                                txObject = await wallet.confirmTransaction(transactionIndex, {from: owner2})
                                // console.log('owner2: ', JSON.stringify(txObject))
                                let noOfConfirmations = await wallet.getConfirmationCount.call(transactionIndex)
                                assert.equal(noOfConfirmations, INITIAL_NO_CONF - 1, 'Required no of confirmations is different')
                            })


                            it('Checks addresses that gave confirmations', async () => {
                                let required = 0
                                let addrsThatGaveConf = await wallet.getConfirmations.call(transactionIndex)
                                for (let index = 0; index < addrsThatGaveConf.length; index++) {
                                    if (addrsThatGaveConf[index] === owner1 || addrsThatGaveConf[index] === owner2) {
                                        required++
                                    }
                                }
                                assert.equal(required, INITIAL_NO_CONF - 1, 'Addresses that gave confirmation are different')
                            })

                        })
                    })

                    describe('Checks confirmation status of owner2 to be true', async () => {
                        let conf
                        it('Should return confirmation of owner2 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner2)
                            assert.equal(conf, true, 'Owner2 confirmation is false')
                        })
                    })

                    // is transaction confirmed
                    describe('Checks transaction confirmed to be false', async () => {
                        it('Should check for isConfirmed transaction to be false', async () => {
                            returnValue = await wallet.isConfirmed.call(transactionIndex)
                            assert.equal(returnValue, false, 'Requred number of confirmations is not given')
                        })
                    })

                    describe('Checks events emitted by confirmTransaction()', async () => {
                        it('Checks for Confirmation event by owner2', async () => {
                            let emittedEventArray = [{
                                event: 'Confirmation',
                                args: {
                                    0: owner2,
                                    1: transactionIndex,
                                    __length__: 2,
                                    sender: owner2,
                                    transactionId: transactionIndex,
                                },
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                        })
                    })

                })

                describe('Should grant confirmation by owner3', async () => {
                    it('Checks no of confirmations to be 3', async () => {
                        txObject = await wallet.confirmTransaction(transactionIndex, {from: owner3})
                        // console.log('owner3: ', JSON.stringify(txObject))
                        let noOfConfirmations = await wallet.getConfirmationCount.call(transactionIndex)
                        assert.equal(noOfConfirmations, INITIAL_NO_CONF, 'Required no of confirmations is different')
                    })

                    it('Checks addresses that gave confirmations', async () => {
                        let required = 0
                        let addrsThatGaveConf = await wallet.getConfirmations.call(transactionIndex)
                        for (let index = 0; index < addrsThatGaveConf.length; index++) {
                            if (addrsThatGaveConf[index] === owner1 || addrsThatGaveConf[index] === owner2 || addrsThatGaveConf[index] === owner3) {
                                required++
                            }
                        }
                        assert.equal(required, INITIAL_NO_CONF, 'Addresses that gave confirmation are different')
                    })

                    describe('Checks confirmation status of owner3 to be true', async () => {
                        let conf
                        it('Should return confirmation of owner3 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner3)
                            assert.equal(conf, true, 'Owner3 confirmation is true')
                        })
                    })

                    // is transaction confirmed
                    describe('Checks transaction confirmed to be true', async () => {
                        it('Should check for isConfirmed transaction to be true', async () => {
                            returnValue = await wallet.isConfirmed.call(transactionIndex)
                            assert.equal(returnValue, true, 'Requred number of confirmations is not given')
                        })
                    })
                })

                describe('Checks confirmation status of all owners to be true', async () => {
                    let conf
                    describe('Get all confirmation status', async () => {
                        it('Should return confirmation of owner1 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner1)
                            assert.equal(conf, true, 'Owner1 confirmation is true')
                        })
                        it('Should return confirmation of owner2 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner2)
                            assert.equal(conf, true, 'Owner2 confirmation is true')
                        })
                        it('Should return confirmation of owner3 to be true', async () => {
                            conf = await wallet.confirmations.call(transactionIndex, owner3)
                            assert.equal(conf, true, 'Owner3 confirmation is true')
                        })
                    })
                })

                describe('Checks no of confirmations has been changed', async () => {
                    it('Should return new required no of confirmations', async () => {
                        let newRequired = await wallet.required.call()
                        assert(newRequired.toNumber() < INITIAL_NO_CONF, 'Error while changing required no of confirmations')
                    })
                })
            })
        })

        describe('Covers the else path for if (txn.destination.call.value(txn.value)(txn.data))', async () => {
            before(async () => {
                data = wallet.contract.methods.removeOwner(accountToRemoveFromOwner).encodeABI()
            })

            describe('Verify submitTransaction', async () => {
                it('Submit Transaction', async() => {
                    txObject = await wallet.submitTransaction(wallet.address, 0, data, {from: owner1, gas: 300000})
                    txIds = await wallet.getTransactionIds.call(0, 4, true, false)
                    transactionIndex = txIds.length
                })
            })

            describe('Should grant confirmation by owner2 and owner3', async () => {
                describe('Checks events emitted by confirmTransaction()', async () => {
                    it('Checks for Confirmation, OwnerAddition & ExecutionFailure event by owner3', async () => {
                        await wallet.confirmations.call(transactionIndex, owner2)
                        await wallet.confirmations.call(transactionIndex, owner3)
                        await wallet.confirmTransaction(transactionIndex, {from: owner2})
                        txObject = await wallet.confirmTransaction(transactionIndex, {from: owner3})
                        let emittedEventArray = [
                            {
                                event: 'Confirmation',
                                args: {
                                    0: owner3,
                                    1: transactionIndex,
                                    __length__: 2,
                                    sender: owner3,
                                    transactionId: transactionIndex,
                                }
                            },
                            {
                                event: 'ExecutionFailure',
                                args: {
                                    0: transactionIndex,
                                    __length__: 1,
                                    transactionId: transactionIndex,
                                },
                            },
                        ]
                        await customEvent.solAllEvents(txObject, emittedEventArray, 'All expected event not emitted')
                    })
                })
            })
        })


        // TODO the if path is yet not covered, not able to figure out why?
        describe('Covers the path for if (owners[i] == owner) & if (required > owners.length)', async () => {
            let data1, data2, data3, data4, data5
            before(async () => {
                data1 = wallet.contract.methods.removeOwner(owner2).encodeABI()
                data2 = wallet.contract.methods.removeOwner(owner3).encodeABI()
                data3 = wallet.contract.methods.removeOwner(owner4).encodeABI()
                data4 = wallet.contract.methods.removeOwner(owner5).encodeABI()
                data5 = wallet.contract.methods.removeOwner(owner1).encodeABI()
            })

            describe('Verify submitTransaction for removal of owner2, owner3, owner4 & owner5', async () => {
                it('Should check for removal of owner2,owner3, owner4 & owner5', async() => {
                    await wallet.submitTransaction(wallet.address, 0, data1, {from: owner1, gas: 300000})
                    txIds = await wallet.getTransactionIds.call(0, 5, true, false)
                    await wallet.confirmations.call(transactionIndex, owner2)
                    await wallet.confirmations.call(transactionIndex, owner3)
                    await wallet.submitTransaction(wallet.address, 0, data2, {from: owner1, gas: 300000})
                    txIds = await wallet.getTransactionIds.call(0, 6, true, false)
                    await wallet.confirmations.call(transactionIndex, owner3)
                    await wallet.confirmations.call(transactionIndex, owner4)
                    await wallet.submitTransaction(wallet.address, 0, data3, {from: owner1, gas: 300000})
                    txIds = await wallet.getTransactionIds.call(0, 7, true, false)
                    await wallet.confirmations.call(transactionIndex, owner4)
                    await wallet.confirmations.call(transactionIndex, owner5)
                    await wallet.submitTransaction(wallet.address, 0, data4, {from: owner1, gas: 300000})
                    txIds = await wallet.getTransactionIds.call(0, 8, true, false)
                    await wallet.submitTransaction(wallet.address, 0, data5, {from: owner1, gas: 300000})
                })
            })
        })

        describe('Checks the fallback function', async () => {
            describe('Hit the fallback function', async () => {
                it('Should hit the fallback function', async () => {
                    txObject = await wallet.send(1, {from: owner1})
                })

                describe('Check for events emitted by fallback function', async () => {
                    it('Checks for Deposit event', async () => {
                        let emiitedEventArray = [{
                            event: 'Deposit',
                            args: {
                                0: owner1,
                                1: 1,
                                __length__: 2,
                                sender: owner1,
                                value: 1
                            },
                        }]
                        customEvent.solAllEvents(txObject, emiitedEventArray, 'All expected events not emitted') //TODO make sure whether the event is emitted
                    })
                })
            })
        })
    })
})
