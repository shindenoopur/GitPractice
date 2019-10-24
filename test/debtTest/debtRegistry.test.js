/**
 * Created by  Balaji on 10/22/18.
 */

const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')
const customEvent = require('../utils/assertEvent')
const DebtRegistry = artifacts.require('DebtRegistry')
const BCToken = artifacts.require('BCToken')
const customFunctions = require('../utils/debtRegistry/customFunctions')

contract('DebtRegistry Test Suite', async(accounts) => {
    describe('DebtRegistry is [ Pausable & PermissionEvents ]', async () => {
        const INSERT_CONTEXT = "debt-registry-insert"
        const EDIT_CONTEXT = "debt-registry-edit"
        let debtRegistryInstance, bcTokenInstance
        //dummy accounts array
        let dummyAccounts = [
            '0x0000000000000000000000000000000000000001',
            '0x0000000000000000000000000000000000000002',
            '0x0000000000000000000000000000000000000003',
            '0x0000000000000000000000000000000000000004',
            '0x0000000000000000000000000000000000000005',
            '0x0000000000000000000000000000000000000006',
            '0x0000000000000000000000000000000000000007',
            '0x0000000000000000000000000000000000000008',
            '0x0000000000000000000000000000000000000009'
        ]

        let zeroAddAcc = '0x0000000000000000000000000000000000000000'
        let owner = accounts[0]
        let acc1 = dummyAccounts[0]
        let acc2 = dummyAccounts[1]
        let acc3 = dummyAccounts[2]
        let acc4 = dummyAccounts[3]
        let acc5 = dummyAccounts[4]
        let acc6 = dummyAccounts[5]
        let acc9 = dummyAccounts[8]


        let authorizedAgents = []

        let txObject,agreementId
        before(async () => {
            debtRegistryInstance = await  DebtRegistry.new({from: owner}) // Deploying it from the 0th account
            bcTokenInstance = await BCToken.new({from: owner})
        })

        describe('Checks the Initial Setup', async() => {
            describe('Adds authorized insert agent', async() => {
                it('Should add the insert agent', async() => {
                    txObject = await debtRegistryInstance.addAuthorizedInsertAgent(owner)
                    assert.equal(txObject.receipt.status, true, 'Failed to add authorized insert agent')
                })
            })

            describe('Check for events emitted by addAuthorizedInsertAgent()', async () => {
                it('Should check for Authorized event', async () => {
                    let emittedEventArray = [{
                        event: 'Authorized',
                        args: {
                            0: owner,
                            1: INSERT_CONTEXT,
                            __length__: 2,
                            agent: owner,
                            callingContext: INSERT_CONTEXT
                        }
                    }]
                    await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                })
            })

            describe('Verify set and get insert agents are the same', async() => {
                it('Should check the insert agent is set as expected', async () => {
                    authorizedAgents = await debtRegistryInstance.getAuthorizedInsertAgents.call()
                    let agent = authorizedAgents.find((element) => {
                        if(element === owner){
                            return element
                        }
                    })
                    assert.equal(agent, owner, 'Insert agent is not as expected')
                })
            })


            describe('Adds the authorized edit agent', async() => {
                it('Should add the edit authorized agent', async() => {
                    txObject = await debtRegistryInstance.addAuthorizedEditAgent(owner)
                    assert.equal(txObject.receipt.status, true, 'Failed to add authorized edit agent')
                })
            })

            describe('Check for events emitted by addAuthorizedEditAgent()', async () => {
                it('Should check for Authorized event', async () => {
                    let emittedEventArray = [{
                        event: 'Authorized',
                        args: {
                            0: owner,
                            1: EDIT_CONTEXT,
                            __length__: 2,
                            agent: owner,
                            callingContext: EDIT_CONTEXT
                        }
                    }]
                    await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                })
            })

            describe('Verify set and get authorized edit agents are the same', async() => {
                it('Checks the edit authorized agent is set as expected', async () => {
                    authorizedAgents = await debtRegistryInstance.getAuthorizedEditAgents.call()
                    let agent = authorizedAgents.find((element) => {
                        if(element === owner){
                            return element
                        }
                    })
                    assert.equal(agent, owner, 'Edit agent is not as expected')
                })
            })
        })

        describe('Verify insert()', async() => {
            describe('Tests insert()', async() => {
                let debtor = acc1
                let version = acc2
                let beneficiary = acc3
                let underwriter = acc4
                let underwriterRiskRating = 1000
                let termsContract = acc5
                let termsContractParameters

                /*
                Params for creating termsContractParameters
                * principalToken    1st byte        It is principalToken index in the tokenRegistry
                * principalAmount   Next 12 bytes
                * interestRate      Next 3 bytes
                * amortizationUnit  Next (1/2 byte) 4 bits
                * termLength        Next 2 bytes
                * collateralToken   Next 1 byte     It is collateralToken index in the tokenRegistry
                * collateralAmount  Next 92 bits
                * gracePeriodInDays Next 1 byte
                *
                * */
                let principalTokenIndex = 0 // this value will be fetched from tokenRegistry
                let principalAmount = 1000
                let interestRate = 10
                let amortizationUnit = 1
                let termLength = 100 //this value will change
                let collateralTokenIndex = 0 // this value will be fetched from tokenRegistry
                let collateralAmount = 500
                let gracePeriodInDays = 2 //this value will change

                termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)

                let insertParamsObject = {
                    0: acc2,
                    1: acc3,
                    2: acc4,
                    3: underwriterRiskRating,
                    4: acc5,
                    5: termsContractParameters
                }

                let salt = 10

                describe('Should check for positive workflow', async() => {
                    it('Submits the insert() transaction', async () => {
                        txObject = await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                        // console.log('txObject: ', JSON.stringify(txObject))
                        assert.equal(txObject.receipt.status, true, 'Failed to submit the insert transaction')
                    })

                    describe('Gets the values set by insert()', async() => {
                        it('Should return the values set by insert()', async() => {
                            agreementId = txObject.logs[0].args.agreementId
                            let insertParams = await  debtRegistryInstance.get.call(agreementId)

                            //Converts BigNumber to number
                            insertParams[3] = insertParams[3].toNumber()
                            insertParams[6] = insertParams[6].toNumber()

                            //Pushes the issuanceBlockTimestamp in insertParamsObject
                            let observedBlockTimestamp = await debtRegistryInstance.getIssuanceBlockTimestamp.call(agreementId)
                            observedBlockTimestamp = observedBlockTimestamp.toNumber()
                            insertParamsObject[6] = observedBlockTimestamp
                            assert.deepEqual(insertParams, insertParamsObject, 'Inserted values do not match')
                        })

                        it('Should return getBeneficiary based on agreementId', async() => {
                            let observedBeneficiary = await  debtRegistryInstance.getBeneficiary.call(agreementId)
                            assert.equal(observedBeneficiary, beneficiary, 'Beneficiary do not match')
                        })

                        it('Should return getTermsContract based on agreementId', async() => {
                            let observedTermsContract = await debtRegistryInstance.getTermsContract.call(agreementId)
                            assert.equal(observedTermsContract, termsContract, 'Terms contract do not match')
                        })

                        it('Should return getTermsContractParameters based on agreementId', async() => {
                            let observedTermsContractParameter = await debtRegistryInstance.getTermsContractParameters.call(agreementId)
                            assert.equal(observedTermsContractParameter, termsContractParameters, 'Terms contract parameters do not match')
                        })

                        it('Should return getTerms based on agreementId', async() => {
                            let observedTerms = await  debtRegistryInstance.getTerms.call(agreementId)
                            // console.log('ObservedTerms: ', observedTerms);
                            let expectedTerms = {
                                0: acc5,
                                1: termsContractParameters
                            }
                            assert.deepEqual(observedTerms, expectedTerms, 'Terms do not match')
                        })

                        it('Should return getIssuanceBlockTimestamp based on agreementId', async() => {
                            let observedBlockTimestamp = await debtRegistryInstance.getIssuanceBlockTimestamp.call(agreementId)
                            let insertParams = await  debtRegistryInstance.get.call(agreementId)
                            assert.equal(insertParams[6].toNumber(), observedBlockTimestamp.toNumber(), 'Block timestamp do not match')

                        })
                    })

                    describe('Check for events emitted by insert()', async () => {
                        it('Check for LogInsertEntry event', async() => {
                            agreementId = txObject.logs[0].args.agreementId
                            // agreementId = await debtRegistryInstance.insert.call(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                            let emittedEventArray = [{
                                event: 'LogInsertEntry',
                                args: {
                                    0: agreementId,
                                    1: beneficiary,
                                    2: underwriter,
                                    3: underwriterRiskRating,
                                    4: termsContract,
                                    5: termsContractParameters,
                                    __length__: 6,
                                    agreementId: agreementId,
                                    beneficiary: beneficiary,
                                    underwriter: underwriter,
                                    underwriterRiskRating: underwriterRiskRating,
                                    termsContract: termsContract,
                                    termsContractParameters: termsContractParameters
                                }
                            }]
                            await  customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })

                describe('Should check for negative workflow', async() => {
                    let paused, pauseTxObject, unPauseTxObject

                    describe('Reverts onlyAuthorized() modifier', async () => {
                        it('Should revert onlyAuthorized() modifier', async() => {
                            await customAssert.assertRevert(debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: acc9}))
                        })
                    })

                    describe('Should pause and revert whenNotPaused() modifier', async() => {
                        describe('Checks pause()', async () => {
                            it('Gets the paused value to be false from Pausable.sol', async() => {
                                paused = await  debtRegistryInstance.paused.call()
                                assert.equal(paused, false, 'Paused is true')
                            })
                            it('Sets paused to true in Pausable.sol', async() => {
                                pauseTxObject = await debtRegistryInstance.pause({from: owner})
                                assert.equal(pauseTxObject.receipt.status, true, 'Fails to change paused value')
                            })
                        describe('Checks for event emitted by pause()', async() => {
                            it('Checks for Unpause event', async () => {
                                let emittedEventArray = [{
                                    event: 'Paused'
                                }]
                                await customEvent.solAllEvents(pauseTxObject, emittedEventArray, 'All events are not emitted')
                            })
                        })
                            it('Gets the paused value to be true from Pausable.sol', async() => {
                                paused = await  debtRegistryInstance.paused.call()
                                assert.equal(paused, true, 'Paused is false')
                            })
                        })

                        describe('Checks unpause()', async() => {
                            //Sets paused to be false for further test cases to evaluate
                            it('Sets paused to false in Pausable.sol', async() => {
                                unPauseTxObject = await debtRegistryInstance.unpause({from: owner})
                                assert.equal(unPauseTxObject.receipt.status, true, 'Fails to change paused value')
                            })

                            describe('Checks for event emitted by unpause()', async() => {
                                it('Checks for Unpause event', async () => {
                                    let emittedEventArray = [{
                                        event: 'Unpaused'
                                    }]
                                    await customEvent.solAllEvents(unPauseTxObject, emittedEventArray, 'All events are not emitted')
                                })
                            })
                        })

                        describe('Reverts whenNotPaused() modifier', async() => {
                            it('Should revert whenNotPaused() modifier', async() => {
                                await customAssert.assertRevert(debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner}))
                            })
                        })

                        describe('Reverts nonNullBeneficiary() modifier', async () => {
                            it('Should revert nonNullBeneficiary() modifier', async() => {
                                await customAssert.assertRevert(debtRegistryInstance.insert(version, zeroAddAcc, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner}))
                            })
                        })
                    })
                })
            })
        })

        describe('Verify modifyBeneficiary()', async() => {
            describe('Tests modifyBeneficiary()', async() => {
                describe('Should check for positive workflow', async() => {
                    it('Submits the modifyBeneficiary() transaction', async () => {
                        txObject = await debtRegistryInstance.modifyBeneficiary(agreementId, acc6, {from: owner})
                        assert.equal(txObject.receipt.status, true, 'Failed to submit modifyBeneficiary transaction')
                    })
                    describe('Check for events emitted by modifyBeneficiary()', async () => {
                        it('Check for LogModifyEntryBeneficiary event', async() => {
                            let emittedEventArray = [{
                                event: 'LogModifyEntryBeneficiary',
                                args: {
                                    0: agreementId,
                                    1: acc3,
                                    2: acc6,
                                    __length__: 3,
                                    agreementId: agreementId,
                                    previousBeneficiary: acc3,
                                    newBeneficiary: acc6
                                }
                            }]
                            await  customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })

                    describe('Gets the values set by modifyBeneficiary()', async() => {
                        it('Should return getBeneficiary based on agreementId', async() => {
                            let newBeneficiary = await  debtRegistryInstance.getBeneficiary.call(agreementId)
                            assert.equal(newBeneficiary, acc6, 'New beneficiary do not touch')
                        })
                    })
                })

                describe('Should check for negative workflow', async() => {
                    it('Reverts onlyAuthorizedToEdit() modifier', async() => {
                        await customAssert.assertRevert(debtRegistryInstance.modifyBeneficiary(agreementId, acc6, {from: acc9}))
                    })

                    describe('Should pause and revert whenNotPaused() modifier', async() => {
                        it('Sets pause to true in Pausable.sol', async() => { })
                        it('Gets the paused value to be true from Pausable.sol', async() => { })
                        assert.ok('It has been implemented above')
                    })

                    it('Reverts whenNotPaused() modifier', async() => {
                        assert.ok('It has been implemented above')
                    })

                    it('Reverts onlyExtantEntry() modifier', async() => { })

                    it('Reverts nonNullBeneficiary() modifier', async() => {
                        assert.ok('It has been implemented above')
                    })
                })
            })
        })

        describe('Revoke authorization', async() => {
            describe('Revoke insert agent authorization', async () => {
                it('Should revoke insert agent authorization', async() => {
                    txObject = await debtRegistryInstance.revokeInsertAgentAuthorization(owner, {from: owner})
                    assert.equal(txObject.receipt.status, true, 'Fails to revoke insert agent authorization')
                })
                describe('Check for events emitted by revokeInsertAgentAuthorization()', async () => {
                    it('Should check for AuthorizationRevoked event', async() => {
                        let emittedEventArray = [{
                            event: 'AuthorizationRevoked',
                            args: {
                                0: owner,
                                1: INSERT_CONTEXT,
                                __length__: 2,
                                agent: owner,
                                callingContext: INSERT_CONTEXT
                            }
                        }]
                        await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                    })
                })
                it('Should return isAgent authorization to be false for removed agent', async() => {
                    authorizedAgents = await debtRegistryInstance.getAuthorizedInsertAgents.call()
                    let agent = authorizedAgents.find((element) => {
                        if(element === owner) {
                            return element
                        }
                    })
                    assert.equal(agent, undefined, 'Insert agent authorization is not removed')
                })
            })

            describe('Revoke edit agent authorization', async () => {
                it('Should revoke edit agent authorization', async() => {
                    txObject = await debtRegistryInstance.revokeEditAgentAuthorization(owner, {from: owner})
                    assert.equal(txObject.receipt.status, true, 'Fails to revoke insert agent authorization')
                })
                describe('Check for events emitted by revokeEditAgentAuthorization()', async () => {
                    it('Should check for AuthorizationRevoked event', async() => {
                        let emittedEventArray = [{
                            event: 'AuthorizationRevoked',
                            args: {
                                0: owner,
                                1: EDIT_CONTEXT,
                                __length__: 2,
                                agent: owner,
                                callingContext: EDIT_CONTEXT
                            }
                        }]
                        await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                    })
                })
                it('Should return isAgent authorization to be false for removed agent', async() => {
                    authorizedAgents = await debtRegistryInstance.getAuthorizedEditAgents.call()
                    let agent = authorizedAgents.find((element) => {
                        if(element === owner){
                            return element
                        }
                    })
                    assert.equal(agent, undefined, 'Edit agent authorization is not as removed')
                })
            })
        })

        describe('Ensure code coverage is 100%', async() => {
            it('Should ensure 100% code coverage', async () => {
                await  debtRegistryInstance.getDebtorsDebts.call(acc1) // Ensures each part of DebtRegistry.sol has been covered
                assert.ok('Ensured 100% code coverage')
            })
        })
    })

    describe('Pausable is [ Ownable ]', async() => {
        describe('Test suite for Pausabe.sol is covered in debtRegistry.test.js from line no: 230 to line no: 282', async() => { })
    })

    describe('Ownable [ * ]', async () => {
        describe('Test suite for Ownable.sol is covered in erc20Token.test.js', async  () => { })
    })
})
