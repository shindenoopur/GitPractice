const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')
const customEvent = require('../utils/assertEvent')

const web3APIs = require('../../reactApiConnectLayer/utils/web3Apis')
const customFunctions = require('../utils/debtRegistry/customFunctions')
const demoValues = require('../../reactApiConnectLayer/debtLifeCycle/demoValues/demoValues')

const DebtKernel = artifacts.require('DebtKernel')
const TokenTransferProxy = artifacts.require('TokenTransferProxy')
const DebtToken = artifacts.require('DebtToken')
const EscrowRegistry = artifacts.require('EscrowRegistry')
const DebtRegistry = artifacts.require('DebtRegistry')
const BCToken = artifacts.require('BCToken')
const BC721Token = artifacts.require('BC721Token')
const TokenRegistry = artifacts.require('TokenRegistry')
const Collateralizer = artifacts.require('Collateralizer')
const ContractRegistry = artifacts.require('ContractRegistry')
const RepaymentRouter = artifacts.require('RepaymentRouter')
const CollateralizedSimpleInterestTermsContract = artifacts.require('CollateralizedSimpleInterestTermsContract')

contract('DebtKernel Test Suite', async (accounts) => {
    let debtKernelInstance, tokenTransferProxyInstance, debtTokenInstance, debtRegistryInstance,
        bcTokenInstance, bc721TokenInstance, tokenRegistryInstance, collateralizedSimpleInterestTermsContractInstance,
        collateralizerInstance, contractRegistryInstance, repaymentRouterInstance, escrowRegistryInstance
    let txObject, agreementId
    let orderAddresses = [], orderValues = [], orderBytes32 = [], signaturesV = [], signaturesR = [], signaturesS = []
    let debtor, version, beneficiary, underwriter, underwriterRiskRating, termsContract, salt, termsContractParameters,
        relayer, creditor
    let principalAmount, underwriterFee, relayerFee, creditorFee, debtorFee, expirationTimestampInSec
    let debtOrderHash, debtorSig, creditorSig, underwriterSig, underWriterMessageHash
    const nullBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000'
    const owner = accounts[0]
    const zeroAdd = '0x0000000000000000000000000000000000000000'
    describe('DebtKernel [ is Pausable ]', async () => {

        before(async () => {
            tokenRegistryInstance = await TokenRegistry.new({ from: owner })
            bcTokenInstance = await BCToken.new({from: owner})
            bc721TokenInstance = await BC721Token.new('TestDebtKernelToken', 'TDKT', {from: owner})
            debtRegistryInstance = await DebtRegistry.new({from: owner})
            debtTokenInstance = await DebtToken.new(debtRegistryInstance.address, {from: owner})
            escrowRegistryInstance = await EscrowRegistry.new({from: owner})
            tokenTransferProxyInstance = await TokenTransferProxy.new({from: owner})
            debtKernelInstance = await DebtKernel.new(tokenTransferProxyInstance.address, {from: owner})
            repaymentRouterInstance = await RepaymentRouter.new(debtRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
            collateralizerInstance = await Collateralizer.new(debtKernelInstance.address, debtRegistryInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address)
            contractRegistryInstance = await ContractRegistry.new(collateralizerInstance.address, debtKernelInstance.address, debtRegistryInstance.address, debtTokenInstance.address,                                                          repaymentRouterInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
            collateralizedSimpleInterestTermsContractInstance = await CollateralizedSimpleInterestTermsContract.new(contractRegistryInstance.address, {from: owner})
            //Transfer 5000 tokens to account1 and use account1 as the creditor
            await bcTokenInstance.transfer(accounts[1], 5000, {from: owner}) //This account will be used as the creditor for verifying the balances visually
        });

        describe('Constructor', async () => {
            describe('Get the default public variable values', async () => {
                it('Should get the TOKEN_TRANSFER_PROXY value', async () => {
                    let tokenTransferProxy = await debtKernelInstance.TOKEN_TRANSFER_PROXY.call()
                    assert.equal(tokenTransferProxy, tokenTransferProxyInstance.address, 'Token transfer proxy address do not match')
                })
                it('Should get the NULL_ISSUANCE_HASH value', async () => {
                    let expectedNullIssuanceHash = '0x0000000000000000000000000000000000000000000000000000000000000000'
                    let nullIssuanceHash = await debtKernelInstance.NULL_ISSUANCE_HASH.call()
                    assert.equal(expectedNullIssuanceHash, nullIssuanceHash, 'Null issuance hash do not match')
                })
                it('Should get the EXTERNAL_QUERY_GAS_LIMIT value', async () => {
                    let expectedGasLimit = 8000
                    let actualGasLimit = await debtKernelInstance.EXTERNAL_QUERY_GAS_LIMIT.call()
                    assert.equal(expectedGasLimit, actualGasLimit.toNumber(), 'External gas limit do not match')
                })
            })
        })

        describe('Execute setDebtToken()', async () => {
            it('Should execute setDebtToken', async () => {
                txObject = await debtKernelInstance.setDebtToken(debtTokenInstance.address, {from: owner})
                assert.equal(txObject.receipt.status, true, 'Error while executing setDebtToken')
            })
            it('Should check whether setDebtToken executed as expected', async () => {
                let actualDebtToken = await debtKernelInstance.debtToken.call()
                assert.equal(actualDebtToken, debtTokenInstance.address, 'DebtToken not set as expected')
            })
        })

        describe('Execute setEscrowRegistry()', async () => {
            it('Should execute setEscrowRegistry', async () => {
                txObject = await debtKernelInstance.setEscrowRegistry(escrowRegistryInstance.address, {from: owner})
                assert.equal(txObject.receipt.status, true, 'Error while executing setEscrowRegistry')
            })
            it('Should check whether setEscrowRegistry executed as expected', async () => {
                let actualEscrowRegistry= await debtKernelInstance.escrowRegistry.call()
                assert.equal(actualEscrowRegistry, escrowRegistryInstance.address, 'EscrowRegistry not set as expected')
            })
        })


        describe('Execute fillDebtOrder()', async () => {
            before(async () => {
                //Arrange
                debtor = accounts[1]
                version = accounts[2]
                beneficiary = accounts[3]
                underwriter = accounts[4]
                relayer = accounts[5]
                creditor = owner // Since it has all the token assigned to it
                underwriterRiskRating = 1000

                salt = 10

                principalAmount = 1000
                underwriterFee = 10
                relayerFee = 10
                creditorFee = 10
                debtorFee = 10

                expirationTimestampInSec = (await web3APIs.getLatestBlockTimestamp() + (demoValues.SECONDS_IN_DAY * demoValues.NO_OF_DAYS) ) //Setting expiratonTimestampInSec to be after 90 days

                let principalTokenIndex , interestRate = 10, amortizationUnit = 1,termLength = 100, collateralTokenIndex, collateralAmount = 500, gracePeriodInDays = 2
                let tokenSymbol, tokenAddress, tokenName, numberOfDecimals, tokenIndex

                tokenSymbol = await bcTokenInstance.symbol.call()
                tokenAddress = bcTokenInstance.address
                tokenName = await bcTokenInstance.name.call()
                numberOfDecimals = await bcTokenInstance.decimals.call()

                await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, { from: owner }) //adds the token to tokenRegistry
                tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

                principalTokenIndex = tokenIndex.toNumber()
                collateralTokenIndex = tokenIndex.toNumber()

                termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                termsContract = collateralizedSimpleInterestTermsContractInstance.address // This has to be the address of the MyTermsContrat.sol file

                //Arrange orderAddresses array
                orderAddresses.push(version)
                orderAddresses.push(debtor)
                orderAddresses.push(underwriter)
                orderAddresses.push(termsContract)
                orderAddresses.push(bcTokenInstance.address) //BCToken address
                orderAddresses.push(relayer)

                //Arrange orderValues array
                orderValues.push(underwriterRiskRating)
                orderValues.push(salt)
                orderValues.push(principalAmount)
                orderValues.push(underwriterFee)
                orderValues.push(relayerFee)
                orderValues.push(creditorFee)
                orderValues.push(debtorFee)
                orderValues.push(expirationTimestampInSec)

                //Arrange orderBytes32 array
                orderBytes32.push(termsContractParameters)

                //Get agreementId
                agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)

                debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5],orderAddresses[5], orderValues[4], orderValues[7])


                if(!web3APIs.isContract(debtor)) {
                    //Arrange signaturesV, signaturesR and signaturesS
                    //signaturesV, signaturesR and signaturesS at index 0 should be of debtor
                    debtorSig = await web3APIs.getSignaturesRSV(debtor, debtOrderHash)
                    signaturesR.push(debtorSig.r)
                    signaturesS.push(debtorSig.s)
                    signaturesV.push(debtorSig.v)
                } else {
                    signaturesR.push(nullBytes32)
                    signaturesS.push(nullBytes32)
                    signaturesV.push(nullBytes32)
                }

                //Checks whether creditor is an account address or a contract address
                if(!web3APIs.isContract(creditor)){
                    //Sign this debtOrderHash
                    //Arrange signaturesV, signaturesR and signaturesS
                    //signaturesV, signaturesR and signaturesS at index 1 should be of creditor
                    creditorSig = await web3APIs.getSignaturesRSV(creditor, debtOrderHash)
                    signaturesR.push(creditorSig.r)
                    signaturesS.push(creditorSig.s)
                    signaturesV.push(creditorSig.v)
                } else {
                    signaturesR.push(nullBytes32)
                    signaturesS.push(nullBytes32)
                    signaturesV.push(nullBytes32)
                }

                //Get the underwriterMessageHash from the customized function
                underWriterMessageHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[7])

                //Sign this underwriterMessageHash
                //Arrange signaturesV, signaturesR and signaturesS

                //signaturesV, signaturesR and signaturesS at index 2 should be of underwriter
                underwriterSig = await web3APIs.getSignaturesRSV(underwriter, underWriterMessageHash)
                signaturesR.push(underwriterSig.r)
                signaturesS.push(underwriterSig.s)
                signaturesV.push(underwriterSig.v)
            })

            describe('fillDebtOrder: assertDebtOrderValidityInvariants(debtOrder)', async () => {
                // let debtOrderHash, agreementId
                describe('Cover the 1st if branch)', async () => {
                    //Arrange orderValues array                 Index
                    // orderValues.push(underwriterRiskRating)    0
                    // orderValues.push(salt)                     1
                    // orderValues.push(principalAmount)          2
                    // orderValues.push(underwriterFee)           3
                    // orderValues.push(relayerFee)               4
                    // orderValues.push(creditorFee)              5
                    // orderValues.push(debtorFee)                6
                    // orderValues.push(expirationTimestampInSec) 7
                    describe('Cover if branch of totalFees != debtOrder.relayerFee.add(debtOrder.underwriterFee', async () => {
                        it('Should cover if branch of totalFees != debtOrder.relayerFee.add(debtOrder.underwriterFee', async () => {
                            orderValues[4] = 5
                            debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5],orderAddresses[5], orderValues[4], orderValues[7])
                            txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS)
                            assert.equal(txObject.receipt.status, true, 'Error while checking totalFees != debtOrder.relayerFee.add(debtOrder.underwriterFee')
                        })
                    })
                    describe('Should check for events emitted by 1st if branch of  assertDebtOrderValidityInvariants', async () => {
                        it('Should check for LogError event', async () => {
                            let emittedEventArray = [
                                {
                                    event: 'LogError',
                                    args: {
                                        0: 4,
                                        1: debtOrderHash,
                                        2: 'from assertDebtOrderValidityInvariants 1',
                                        __length__: 3,
                                        _errorId: 4,
                                        _orderHash: debtOrderHash,
                                        where: 'from assertDebtOrderValidityInvariants 1'
                                    }
                                }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })


                describe('Cover the 2nd if branch', async () => {
                    describe('Cover if branch of debtOrder.principalAmount < debtOrder.debtorFee', async () => {
                        it('Should cover if branch of debtOrder.principalAmount < debtOrder.debtorFee', async () => {
                            orderValues[4] = 10
                            orderValues[2] = 5 // such that principalAmount < debtorFee
                            debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5],orderAddresses[5], orderValues[4], orderValues[7])
                            txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS)
                            assert.equal(txObject.receipt.status, true, 'Error while checking totalFees != debtOrder.relayerFee.add(debtOrder.underwriterFee')
                        })
                    })
                    describe('Should check for events emitted by 2nd if branch of  assertDebtOrderValidityInvariants', async () => {
                        it('Should check for LogError event', async () => {
                            let emittedEventArray = [{
                                event: 'LogError',
                                args: {
                                    0: 5,
                                    1: debtOrderHash,
                                    2: 'from assertDebtOrderValidityInvariants 2',
                                    __length__: 3,
                                    _errorId: 5,
                                    _orderHash: debtOrderHash,
                                    where: 'from assertDebtOrderValidityInvariants 2'
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })

                describe('Cover the 3rd if branch', async () => {
                    describe('Cover if branch of if underwriter or relayer is address(0)', async () => {
                        it('Should cover the if branch of (debtOrder.issuance.underwriter == address(0) && debtOrder.underwriterFee > 0) ||(debtOrder.relayer == address(0) && totalFees != debtOrder.underwriterFee)', async () => {
                            orderValues[2] = principalAmount //such that it does not fail at the 2nd if condition
                            orderAddresses[2] = zeroAdd // such that it will set the debtOrder.issuance.underwriter = address(0)
                            agreementId = web3APIs.getSoliditySha3(orderAddresses[0], orderAddresses[1], orderAddresses[2], orderValues[0], orderAddresses[3], orderBytes32[0], orderValues[1])
                            debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5],orderAddresses[5], orderValues[4], orderValues[7])
                            txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS)
                            assert.equal(txObject.receipt.status, true, 'Error while checking underwriter of relayer is address(0)')

                        })
                    })
                    describe('Should check for events emitted by 3rd if branch of assertDebtOrderValidityInvariants', async () => {
                        it('Should check for LogError event', async () => {
                            let emittedEventArray = [{
                                event: 'LogError',
                                args: {
                                    0: 6,
                                    1: debtOrderHash,
                                    2: 'from assertDebtOrderValidityInvariants 3',
                                    __length__: 3,
                                    _errorId: 6,
                                    _orderHash: debtOrderHash,
                                    where: 'from assertDebtOrderValidityInvariants 3'
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })

                describe('Cover the 4th if branch', async () => {
                    describe('Cover if branch of debtOrder.expirationTimestampInSec < block.timestamp', async () => {
                        it('Should cover the if branch of debtOrder.expirationTimestampInSec < block.timestamp', async () => {
                            orderAddresses[2] = underwriter // such that it does not fail at the 3rd if
                            orderValues[7] = 1542067200 //1542067200 this is the timestamp of 11/13/2018 @ 12:00am (UTC)
                            txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS)
                            //Arrange orderValues array                 Index
                            // orderValues.push(underwriterRiskRating)    0
                            // orderValues.push(salt)                     1
                            // orderValues.push(principalAmount)          2
                            // orderValues.push(underwriterFee)           3
                            // orderValues.push(relayerFee)               4
                            // orderValues.push(creditorFee)              5
                            // orderValues.push(debtorFee)                6
                            // orderValues.push(expirationTimestampInSec) 7

                            //Arrange orderAddresses array
                            // orderAddresses.push(version)                                     0
                            // orderAddresses.push(debtor)                                      1
                            // orderAddresses.push(underwriter)                                 2
                            // orderAddresses.push(termsContract)                               3
                            // orderAddresses.push(bcTokenInstance.address) //BCToken address   4
                            // orderAddresses.push(relayer)                                     5


                            agreementId = web3APIs.getSoliditySha3(orderAddresses[0], orderAddresses[1], orderAddresses[2], orderValues[0], orderAddresses[3], orderBytes32[0], orderValues[1])

                            debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5], orderAddresses[5], orderValues[4], orderValues[7])
                            assert.equal(txObject.receipt.status, true, 'Error while checking 4th if branch of assertDebtOrderValidityInvariants')

                        })
                    })
                    describe('Should check for events emitted by 4th if branch of assertDebtOrderValidityInvariants', async () => {
                        it('Should check for LogError event', async () => {
                            let emittedEventArray = [{
                                event: 'LogError',
                                args: {
                                    0: 1,
                                    1: debtOrderHash,
                                    2: 'from assertDebtOrderValidityInvariants 4',
                                    __length__: 3,
                                    _errorId: 1,
                                    _orderHash: debtOrderHash,
                                    where: 'from assertDebtOrderValidityInvariants 4'
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })

                describe('Cover the 5th if branch', async () => {
                        it('Has been covered after successfull execution of fillDebtOrder', async () => {
                            assert.ok('Covered at the end')
                        })
                })

                describe('Cover the 6th if branch', async () => {
                    let tempTxObject
                    describe('Cover the if branch of issuanceCancelled[debtOrder.issuance.agreementId]', async () => {
                        it('Should cover the if branch of issuanceCancelled[debtOrder.issuance.agreementId]', async () => {
                            //pre-reqs
                            tempTxObject = await debtKernelInstance.cancelIssuance(version, debtor, termsContract, termsContractParameters, underwriter, underwriterRiskRating, salt, {from: debtor})
                            orderValues[7] = expirationTimestampInSec
                            txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS)
                            agreementId = web3APIs.getSoliditySha3(orderAddresses[0], orderAddresses[1], orderAddresses[2], orderValues[0], orderAddresses[3], orderBytes32[0], orderValues[1])
                            debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5], orderAddresses[5], orderValues[4], orderValues[7])
                            assert.equal(txObject.receipt.status, true, 'Error while checking underwriter of relayer is address(0)')
                        })
                    })

                    describe('Check for events emitted by cancelIssuance', async () => {
                        it('Should check for LogError event', async () => {
                            let emittedEventArray = [{
                                event: 'LogIssuanceCancelled',
                                args: {
                                    0: agreementId,
                                    1: debtor,
                                    __length__: 2,
                                    _agreementId: agreementId,
                                    _cancelledBy: debtor
                                }
                            }]
                            await customEvent.solAllEvents(tempTxObject, emittedEventArray, 'All events are not emitted')
                        })
                    })

                    describe('Should check for events emitted by 6th if branch of assertDebtOrderValidityInvariants', async () => {
                        it('Should check for LogError event', async () => {
                            let emittedEventArray = [{
                                event: 'LogError',
                                args: {
                                    0: 2,
                                    1: debtOrderHash,
                                    2: 'from assertDebtOrderValidityInvariants 6',
                                    __length__: 3,
                                    _errorId: 2,
                                    _orderHash: debtOrderHash,
                                    where: 'from assertDebtOrderValidityInvariants 6'
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })

                describe('Cover the 7th if branch ', async () => {
                    let tempTxObject
                    describe('Cover the if branch of issuanceCancelled[debtOrder.issuance.agreementId]', async () => {
                        it('Should cover the if branch of issuanceCancelled[debtOrder.issuance.agreementId]', async () => {
                            debtor = accounts[5]
                            version = accounts[4]
                            beneficiary = accounts[3]
                            underwriter = accounts[2]
                            relayer = accounts[1]
                            creditor = owner // Since it has all the token assigned to it
                            underwriterRiskRating = 100

                            salt = 20

                            //Arrange orderAddresses array
                            orderAddresses[0] = version
                            orderAddresses[1] = debtor
                            orderAddresses[2] = underwriter
                            orderAddresses[3] = termsContract
                            orderAddresses[4] = bcTokenInstance.address
                            orderAddresses[5] = relayer

                            orderValues[7] = Date.now()
                            await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS)
                            //Get agreementId and debtOrderHash from the customized function
                            agreementId = web3APIs.getSoliditySha3(orderAddresses[0], orderAddresses[1], orderAddresses[2], orderValues[0], orderAddresses[3], orderBytes32[0], orderValues[1])
                            debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5], orderAddresses[5], orderValues[4], orderValues[7])

                            tempTxObject = await debtKernelInstance.cancelDebtOrder(orderAddresses, orderValues, orderBytes32, {from: debtor})
                            txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS)
                            assert.equal(txObject.receipt.status, true, 'Error while checking underwriter of relayer is address(0)')
                        })
                    })

                    describe('Check for events emitted by cancelDebtOrder', async () => {
                        it('Should check for LogDebtOrderCancelled event', async () => {
                            let emittedEventArray = [{
                                event: 'LogDebtOrderCancelled',
                                args: {
                                    0: debtOrderHash,
                                    1: debtor,
                                    __length__: 2,
                                    _debtOrderHash: debtOrderHash,
                                    _cancelledBy: debtor
                                }
                            }]
                            await customEvent.solAllEvents(tempTxObject, emittedEventArray, 'All events are not emitted')
                        })
                    })

                    describe('Should check for events emitted by 7th if branch of assertDebtOrderValidityInvariants', async () => {
                        it('Should check for LogError event', async () => {
                            let emittedEventArray = [{
                                event: 'LogError',
                                args: {
                                    0: 3,
                                    1: debtOrderHash,
                                    2: 'from assertDebtOrderValidityInvariants 7',
                                    __length__: 3,
                                    _errorId: 3,
                                    _orderHash: debtOrderHash,
                                    where: 'from assertDebtOrderValidityInvariants 7'
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })

            })
            describe('assertDebtOrderConsensualityInvariants(debtOrder, creditor, signaturesV, signaturesR, signaturesS)', async () => {
                let debtOrderHash, fromAccount, debtorSig, creditorSig, underwriterSig, agreementId
                describe('Cover the 1st if branch', async () => {
                    it('Should cover the else branch if msg.sender != debtor', async () => {
                        /*
                        Since for above 2 debtOrders one of them has been cancelled and the other's issuance has been cancelled
                        Thus we create a new debtOrder and proceed with the execution of other functions
                        */
                        debtor = accounts[3]
                        version = accounts[4]
                        beneficiary = accounts[2]
                        underwriter = accounts[5]
                        relayer = accounts[1]
                        creditor = owner // Since it has all the token assigned to it
                        underwriterRiskRating = 1000

                        salt = 30

                        //Arrange orderAddresses array
                        orderAddresses[0] = version
                        orderAddresses[1] = debtor
                        orderAddresses[2] = underwriter
                        orderAddresses[3] = termsContract
                        orderAddresses[4] = bcTokenInstance.address
                        orderAddresses[5] = relayer

                        fromAccount = accounts[9]
                        //Get debtOrderHash sign it using debtor, creditor and underwriter s.t. the if conditions in assertDebtOrderConsensualityInvariants are evaluated successfully
                        //Get agreementId and debtOrderHash from the customized function
                        agreementId = web3APIs.getSoliditySha3(orderAddresses[0], orderAddresses[1], orderAddresses[2], orderValues[0], orderAddresses[3], orderBytes32[0], orderValues[1])
                        debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5], orderAddresses[5], orderValues[4], orderValues[7])

                        //Sign this debtOrderHash
                        //Arrange signaturesV, signaturesR and signaturesS
                        //signaturesV, signaturesR and signaturesS at index 0 should be of debtor
                        debtorSig = await web3APIs.getSignaturesRSV(debtor, debtOrderHash)
                        signaturesR[0] = debtorSig.r
                        signaturesS[0] = debtorSig.s
                        signaturesV[0] = debtorSig.v


                        signaturesV[0] = 100 // such that the isValidSignature returns false and LogError is emitted from 1st if branch of assertDebtOrderConsensualityInvariants
                        txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount})
                    })
                    describe('Should check for events emitted by 1st if branch of assertDebtOrderConsensualityInvariants', async () => {
                        it('Should check for LogError event of 1st if branch', async () => {
                            let emittedEventArray = [{
                                event: 'LogError',
                                args: {
                                    0: 7,
                                    1: debtOrderHash,
                                    2: 'from assertDebtOrderConsensualityInvariants 1',
                                    __length__: 3,
                                    _errorId: 7,
                                    _orderHash: debtOrderHash,
                                    where: 'from assertDebtOrderConsensualityInvariants 1'
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })
                describe('Cover the 2nd if branch', async () => {
                    describe('Cover the else branch of msg.sender != creditor && !isValidSignature()', async () => {
                        it('Should cover the else branch if msg.sender != creditor', async () => {
                            //Sign this debtOrderHash
                            //Arrange signaturesV, signaturesR and signaturesS
                            //signaturesV, signaturesR and signaturesS at index 1 should be of creditor
                            creditorSig = await web3APIs.getSignaturesRSV(creditor, debtOrderHash)
                            signaturesR[1] = creditorSig.r
                            signaturesS[1] = creditorSig.s
                            signaturesV[1] = creditorSig.v

                            signaturesV[1] = 100 // such that the isValidSignature returns false and the LogError of 2nd if is emitted
                            signaturesV[0] = debtorSig.v // such that the isValidSignature returns true from 1st if branch of assertDebtOrderConsensualityInvariants
                            txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount})
                        })
                    })
                    describe('Should check for events emitted by 2nd if branch of assertDebtOrderConsensualityInvariants', async () => {
                        it('Should check for LogError event of 2nd if branch', async () => {
                            let emittedEventArray = [{
                                event: 'LogError',
                                args: {
                                    0: 7,
                                    1: debtOrderHash,
                                    2: 'from assertDebtOrderConsensualityInvariants 2',
                                    __length__: 3,
                                    _errorId: 7,
                                    _orderHash: debtOrderHash,
                                    where: 'from assertDebtOrderConsensualityInvariants 2'
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })
                describe('Cover the 3rd if branch', async () => {
                    describe('Cover the else branch of (debtOrder.issuance.underwriter != address(0) && msg.sender != debtOrder.issuance.underwriter) && !isValidSignature()', async () => {
                        it('Should cover the else branch', async () => {
                            //Sign this debtOrderHash
                            //Arrange signaturesV, signaturesR and signaturesS
                            //signaturesV, signaturesR and signaturesS at index 2 should be of underwriter
                            underwriterSig = await web3APIs.getSignaturesRSV(underwriter, debtOrderHash) //underwriter signs the underWriterHashMessage and not the debtOrdrHash
                            signaturesR[2] = underwriterSig.r
                            signaturesS[2] = underwriterSig.s
                            signaturesV[2] = underwriterSig.v

                            signaturesV[1] = creditorSig.v // such that it does not fail at the 2nd if of assertDebtOrderConsensualityInvariants
                            txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount})
                        })
                    })
                    describe('Should check for events emitted by 3rd if of assertDebtOrderConsensualityInvariants', async () => {
                        it('Should check for LogError event of 3rd if branch', async () => {
                            let emittedEventArray = [{
                                event: 'LogError',
                                args: {
                                    0: 7,
                                    1: debtOrderHash,
                                    2: 'from assertDebtOrderConsensualityInvariants 3',
                                    __length__: 3,
                                    _errorId: 7,
                                    _orderHash: debtOrderHash,
                                    where: 'from assertDebtOrderConsensualityInvariants 3'
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })
            })
            describe('assertExternalBalanceAndAllowanceInvariants(creditor, debtOrder)', async () => {
                let debtOrderHash, fromAccount, debtorSig, creditorSig, underwriterSig,
                    underWriterMessageHash
                let principalTokenIndex , interestRate = 10, amortizationUnit = 1,termLength = 100, collateralTokenIndex, collateralAmount = 500, gracePeriodInDays = 2
                let tokenSymbol, tokenAddress, tokenName, numberOfDecimals, tokenIndex
                describe('getBalance(debtOrder.principalToken, creditor) < totalCreditorPayment || getAllowance(debtOrder.principalToken, creditor) < totalCreditorPayment', async () => {
                    it('Should make the initial setup', async () => {
                        debtor = accounts[9]
                        version = accounts[8]
                        beneficiary = accounts[7]
                        underwriter = accounts[6]
                        relayer = accounts[5]
                        creditor = accounts[4]
                        underwriterRiskRating = 100

                        salt = 40

                        // console.log('termsContract: ', termsContract)

                        //Arrange orderAddresses array
                        orderAddresses[0] = version
                        orderAddresses[1] = debtor
                        orderAddresses[2] = underwriter
                        orderAddresses[3] = termsContract
                        orderAddresses[4] = bcTokenInstance.address
                        orderAddresses[5] = relayer

                        orderValues[7] = Date.now() + (24 * 60 * 60  * 1000 * 3)

                        tokenSymbol = await bcTokenInstance.symbol.call()
                        tokenAddress = bcTokenInstance.address
                        tokenName = await bcTokenInstance.name.call()
                        numberOfDecimals = await bcTokenInstance.decimals.call()
                        await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, { from: owner }) //adds the token to tokenRegistry
                        tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

                        principalTokenIndex = tokenIndex.toNumber()
                        collateralTokenIndex = tokenIndex.toNumber()

                        termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                        termsContract = collateralizedSimpleInterestTermsContractInstance.address // This has to be the address of the MyTermsContrat.sol file
                        // console.log('termsContract: ', termsContract)

                        //Get debtOrderHash sign it using debtor, creditor and underwriter s.t. the if conditions in assertDebtOrderConsensualityInvariants are evaluated successfully
                        //Get agreementId and debtOrderHash from the customized function
                        agreementId = web3APIs.getSoliditySha3(orderAddresses[0], orderAddresses[1], orderAddresses[2], orderValues[0], orderAddresses[3], orderBytes32[0], orderValues[1])
                        debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5], orderAddresses[5], orderValues[4], orderValues[7])
                        //Sign this debtOrderHash
                        //Arrange signaturesV, signaturesR and signaturesS
                        //signaturesV, signaturesR and signaturesS at index 0 should be of debtor
                        debtorSig = await web3APIs.getSignaturesRSV(debtor, debtOrderHash)
                        signaturesR[0] = debtorSig.r
                        signaturesS[0] = debtorSig.s
                        signaturesV[0] = debtorSig.v

                        //Sign this debtOrderHash
                        //Arrange signaturesV, signaturesR and signaturesS
                        //signaturesV, signaturesR and signaturesS at index 1 should be of creditor
                        creditorSig = await web3APIs.getSignaturesRSV(creditor, debtOrderHash)
                        signaturesR[1] = creditorSig.r
                        signaturesS[1] = creditorSig.s
                        signaturesV[1] = creditorSig.v

                        //Get the underwriterMessageHash from the customized function
                        underWriterMessageHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[7])

                        //Sign this underwriterMessageHash
                        //Arrange signaturesV, signaturesR and signaturesS
                        //signaturesV, signaturesR and signaturesS at index 2 should be of underwriter
                        underwriterSig = await web3APIs.getSignaturesRSV(underwriter, underWriterMessageHash)
                        signaturesR[2] = underwriterSig.r
                        signaturesS[2] = underwriterSig.s
                        signaturesV[2] = underwriterSig.v

                        fromAccount = accounts[3]
                        txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount})
                    })
                    describe('Should check for events emitted by 1st if branch of assertExternalBalanceAndAllowanceInvariants', async () => {
                        it('Should check for LogError event of 1st if branch', async () => {
                            let emittedEventArray = [{
                                event: 'LogError',
                                args: {
                                    0: 8,
                                    1: debtOrderHash,
                                    2: 'from assertExternalBalanceAndAllowanceInvariants 1',
                                    __length__: 3,
                                    _errorId: 8,
                                    _orderHash: debtOrderHash,
                                    where: 'from assertExternalBalanceAndAllowanceInvariants 1'
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })
            })

            describe('issueDebtAgreement and transfer principal, underwriterFee and relayerFee', async () => {
                let debtOrderHash, fromAccount, creditorSig, tempTxObject, agreementId
                describe('Submit fillDebtOrder successfully', async () => {
                    it('Should issueDebtAgreement and transfer principal, underwriterFee and relayerFee', async () => {
                        creditor = accounts[1]
                        // orderValues[7] = Date.now() + (24 * 60 * 60 * 1000 * 3)
                        //Get debtOrderHash sign it using debtor, creditor and underwriter s.t. the if conditions in assertDebtOrderConsensualityInvariants are evaluated successfully
                        //Get agreementId and debtOrderHash from the customized function
                        agreementId = web3APIs.getSoliditySha3(orderAddresses[0], orderAddresses[1], orderAddresses[2], orderValues[0], orderAddresses[3], orderBytes32[0], orderValues[1])
                        debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5], orderAddresses[5], orderValues[4], orderValues[7])
                        // console.log('orderValues[7]: ', orderValues[7])
                        // console.log('timestamp in human readable format: ', utils.timeStampToDate(orderValues[7]))

                        // console.log('orderValues[7]: ', orderValues[7])
                        // console.log('timestamp in human readable format: ', utils.timeStampToDate(orderValues[7]))
                        //Sign this debtOrderHash
                        //Arrange signaturesV, signaturesR and signaturesS
                        //signaturesV, signaturesR and signaturesS at index 1 should be of creditor
                        creditorSig = await web3APIs.getSignaturesRSV(creditor, debtOrderHash)
                        signaturesR[1] = creditorSig.r
                        signaturesS[1] = creditorSig.s
                        signaturesV[1] = creditorSig.v

                        //Transfer tokens
                        await bcTokenInstance.transfer(debtor, 1000, {from: owner, gas: 3000000})  // Transferring tokens to debtor greater than collateralAmount

                        // Approve to spend tokens on behalf of debtor
                        await bcTokenInstance.approve(tokenTransferProxyInstance.address, 600, { from: debtor, gas: 3000000 }) // Allowance of tokens to tokenTransferProxy from debtor greater than collateralAmount

                        fromAccount = accounts[9]
                        let balance

                        console.log('\t\tBalances before fillDebtOrder')

                        balance = await bcTokenInstance.balanceOf.call(creditor)
                        console.log('\t\tBalance of creditor = ', balance.toNumber())

                        balance = await bcTokenInstance.balanceOf.call(debtor)
                        console.log('\t\tBalance of debtor = ', balance.toNumber())

                        balance = await bcTokenInstance.balanceOf.call(underwriter)
                        console.log('\t\tBalance of underwriter = ', balance.toNumber())

                        balance = await bcTokenInstance.balanceOf.call(relayer)
                        console.log('\t\tBalance of relayer = ', balance.toNumber())

                        //Approve the tokenTransferProxy to spend tokens greater than the principalAMount and creditorFee
                        await bcTokenInstance.approve(tokenTransferProxyInstance.address, 1200, {from: creditor})

                        //Should assertRevert as the msg.sender is not authorized
                        await customAssert.assertRevert(debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount}))
                        //add authorized mint agent in DebtToken.sol contract storage
                        await debtTokenInstance.addAuthorizedMintAgent(debtKernelInstance.address, {from: owner})
                        //add authorized insert agent in DebtRegistry.sol contract storage
                        await debtRegistryInstance.addAuthorizedInsertAgent(debtTokenInstance.address, {from: owner})
                        await debtRegistryInstance.addAuthorizedEditAgent(debtTokenInstance.address, {from: owner, gas: 3000000})
                        //add authorized transfer agent in TokenTransferProxy, since transferFrom is getting called from DebtKernel, thus DebtKernel will be the msg.sender in TokenTransferProxy
                        await tokenTransferProxyInstance.addAuthorizedTransferAgent(debtKernelInstance.address, {from: owner})

                        //Adding line no 377 & 381 solved the revert issue
                        await collateralizerInstance.addAuthorizedCollateralizeAgent(collateralizedSimpleInterestTermsContractInstance.address, {
                            from: owner,
                            gas: 3000000
                        })
                        await tokenTransferProxyInstance.addAuthorizedTransferAgent(collateralizerInstance.address, {from: owner, gas: 3000000})

                        // orderValues[7] = 1543755557521
                        // console.log(creditor, orderAddresses, orderValues, orderBytes32)
                        txObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount})
                        // console.log(JSON.stringify(txObject))
                    })

                    describe('Cover the 5th if branch', async () => {
                        describe('Cover if branch of debtToken.exists(uint(debtOrder.issuance.agreementId', async () => {
                            it('Should cover the if branch of debtToken.exists(uint(debtOrder.issuance.agreementId)', async () => {
                                tempTxObject = await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS)
                                assert.equal(txObject.receipt.status, true, 'Error while checking underwriter of relayer is address(0)')

                            })
                        })
                        describe('Should check for events emitted by 5th if branch of assertDebtOrderValidityInvariants', async () => {
                            it('Should check for LogError event', async () => {
                                let emittedEventArray = [{
                                    event: 'LogError',
                                    args: {
                                        0: 0,
                                        1: debtOrderHash,
                                        2: 'from assertDebtOrderValidityInvariants 5',
                                        __length__: 3,
                                        _errorId: 0,
                                        _orderHash: debtOrderHash,
                                        where: 'from assertDebtOrderValidityInvariants 5'
                                    }
                                }]
                                await customEvent.solAllEvents(tempTxObject, emittedEventArray, 'All events are not emitted')
                            })
                        })
                    })

                })

                describe('Should check for events emitted by fillDebtOrder', async () => {
                    it('Should check for LogDebtOrderFilled event', async () => {
                        let emittedEventArray = [
                            {
                                event: 'Agreement',
                                args: {
                                    0: agreementId,
                                    1: creditor,
                                    2: orderAddresses[1],
                                    3: txObject.logs[0].args[3].toNumber(),
                                    __length__: 4,
                                    _agreementId: agreementId,
                                    _borrower: orderAddresses[1],
                                    _lender: creditor,
                                    _timestamp: txObject.logs[0].args[3].toNumber()
                                }
                            },
                            {
                                event: 'LogDebtOrderFilled',
                                args: {
                                    0: agreementId,
                                    1: orderValues[2],
                                    2: orderAddresses[4],
                                    3: orderAddresses[2],
                                    4: orderValues[3],
                                    5: orderAddresses[5],
                                    6: orderValues[4],
                                    __length__: 7,
                                    _agreementId: agreementId,
                                    _principal: orderValues[2],
                                    _principalToken: orderAddresses[4],
                                    _underwriter: orderAddresses[2],
                                    _underwriterFee: orderValues[3],
                                    _relayer: orderAddresses[5],
                                    _relayerFee: orderValues[4]
                                }
                            }
                        ]
                        await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                    })
                })

                describe('Execute cancelIssuance()', async () => {
                    it('Has already been executed from fillDebtOrder', async () => {
                        assert.ok('Executed already')
                    })
                })

                describe('Execute cancelDebtOrder()', async () => {
                    it('Has already been executed from fillDebtOrder', async () => {
                        assert.ok('Executed already')
                    })
                })

                describe('Check balances: ', async () => {
                    it('Should check balances of accounts', async () => {
                        let balance

                        console.log('\t\tBalances after fillDebtOrder')
                        balance = await bcTokenInstance.balanceOf.call(creditor)
                        console.log('\t\tBalance of creditor = ', balance.toNumber())

                        balance = await bcTokenInstance.balanceOf.call(debtor)
                        console.log('\t\tBalance of debtor = ', balance.toNumber())

                        balance = await bcTokenInstance.balanceOf.call(underwriter)
                        console.log('\t\tBalance of underwriter = ', balance.toNumber())

                        balance = await bcTokenInstance.balanceOf.call(relayer)
                        console.log('\t\tBalance of relayer = ', balance.toNumber())

                    })
                })
            })


        })
    })
})
