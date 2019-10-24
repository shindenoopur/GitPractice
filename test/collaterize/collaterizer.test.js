const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')
const customEvent = require('../utils/assertEvent')

const web3APIs = require('../../reactApiConnectLayer/utils/web3Apis')
const customFunctions = require('../utils/debtRegistry/customFunctions')

const Collateralizer = artifacts.require('Collateralizer')
const DebtRegistry = artifacts.require('DebtRegistry')
const TokenRegistry = artifacts.require('TokenRegistry')
const TokenTransferProxy = artifacts.require('TokenTransferProxy')
const DebtKernel = artifacts.require('DebtKernel')
const ContractRegistry = artifacts.require('ContractRegistry')
const CollateralizedSimpleInterestTermsContract = artifacts.require('CollateralizedSimpleInterestTermsContract')
const RepaymentRouter = artifacts.require('RepaymentRouter')
const DebtToken = artifacts.require('DebtToken')
const BCToken = artifacts.require('BCToken')

contract('Collateralizer Test Suite', async (accounts) => {
    const SECONDS_IN_DAY = 24 * 60 * 60
    const CONTEXT = "collateralizer"
    const owner = accounts[0]

    //Contract instance related variables
    let debtKernelInstance, tokenTransferProxyInstance, debtTokenInstance, debtRegistryInstance, bcTokenInstance, collateralizerInstance, tokenRegistryInstance,
        collateralizedSimpleInterestTermsContractInstance, contractRegistryInstance, repaymentRouterInstance

    //Function related variables
    let agreementId, fromAccount, txObject, termsContAdd, returnCollateralAgreementId
    let debtor, version, beneficiary, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt
    let principalTokenIndex, interestRate = 10, amortizationUnit = 1, termLength = 100, collateralTokenIndex,
        collateralAmount = 0, gracePeriodInDays = 2
    let tokenSymbol, tokenAddress, tokenName, numberOfDecimals, tokenIndex
    let principalAmount, underwriterFee, relayerFee, creditorFee, debtorFee, expirationTimestampInSec

    describe('Collateralizer is [ Pausable, PermissionEvents ]', async () => {
        before(async () => {
            bcTokenInstance = await BCToken.new({from: owner})
            debtRegistryInstance = await DebtRegistry.new({from: owner})
            debtTokenInstance = await DebtToken.new(debtRegistryInstance.address, {from: owner})
            tokenTransferProxyInstance = await TokenTransferProxy.new({from: owner})
            tokenRegistryInstance = await TokenRegistry.new({from: owner})
            debtKernelInstance = await DebtKernel.new(tokenTransferProxyInstance.address, {from: owner})
            repaymentRouterInstance = await RepaymentRouter.new(debtRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
            collateralizerInstance = await Collateralizer.new(debtKernelInstance.address, debtRegistryInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address)

            contractRegistryInstance = await ContractRegistry.new(collateralizerInstance.address, debtKernelInstance.address, debtRegistryInstance.address, debtTokenInstance.address, repaymentRouterInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})

            collateralizedSimpleInterestTermsContractInstance = await CollateralizedSimpleInterestTermsContract.new(contractRegistryInstance.address, {from: owner})
        });

        describe('Constructor', async () => {
            describe('Get the default public variable values', async () => {
                let contractAddress

                it('Should get the debtKernelAddress value', async () => {
                    contractAddress = await collateralizerInstance.debtKernelAddress.call()
                    assert.equal(contractAddress, debtKernelInstance.address, 'DebtKernel addresses do not match')
                })
                it('Should get the debtRegistry value', async () => {
                    contractAddress = await collateralizerInstance.debtRegistry.call()
                    assert.equal(contractAddress, debtRegistryInstance.address, 'DebtRegistry addresses do not match')
                })
                it('Should get the tokenRegistry value', async () => {
                    contractAddress = await collateralizerInstance.tokenRegistry.call()
                    assert.equal(contractAddress, tokenRegistryInstance.address, 'TokenRegistry addresses do not match')
                })
                it('Should get the tokenTransferProxy value', async () => {
                    contractAddress = await collateralizerInstance.tokenTransferProxy.call()
                    assert.equal(contractAddress, tokenTransferProxyInstance.address, 'TokenTransferProxy addresses do not match')
                })
                it('Should get the SECONDS_IN_DAY value', async () => {
                    let secondsInDay = await collateralizerInstance.SECONDS_IN_DAY.call()
                    assert.equal(secondsInDay, SECONDS_IN_DAY, 'Seconds in day do not match')
                })
                it('Should get the CONTEXT value', async () => {
                    let context = await collateralizerInstance.CONTEXT.call()
                    assert.equal(context, CONTEXT, 'Context do not match')
                })
            })
        })

        describe('Test collateralize(bytes32 agreementId, address collateralizer) public onlyAuthorizedToCollateralize whenNotPausedd returns (bool _success)', async () => {

            describe('Check for negative scenarios', async () => {
                before(async () => {
                    //Here collateralAmount = 0
                    fromAccount = accounts[9]
                    debtor = accounts[3]
                    version = accounts[4]
                    beneficiary = accounts[2]
                    underwriter = accounts[5]
                    underwriterRiskRating = 1000
                    salt = 10

                    principalAmount = 1000
                    underwriterFee = 10
                    relayerFee = 10
                    creditorFee = 10
                    debtorFee = 10

                    tokenSymbol = await bcTokenInstance.symbol.call()
                    tokenAddress = bcTokenInstance.address
                    tokenName = await bcTokenInstance.name.call()
                    numberOfDecimals = await bcTokenInstance.decimals.call()

                    await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, {from: owner}) //adds the token to tokenRegistry
                    tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

                    principalTokenIndex = tokenIndex.toNumber()
                    collateralTokenIndex = 10 // should revert at collateralToken is address(0), thus assigning an invalid index

                    termsContract = collateralizedSimpleInterestTermsContractInstance.address
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)

                    //Insert a record in DebtRegistry
                    await debtRegistryInstance.addAuthorizedInsertAgent(owner, {from: owner})
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                })

                it('Should revert for onlyAuthorizedToCollateralize modifier', async () => {
                    await customAssert.assertRevert(collateralizerInstance.collateralize(agreementId, debtor, {
                        from: owner,
                        gas: 3000000
                    }))
                })

                it('Should add authorization agent such that onlyAuthorizedToCollateralize modifier is passed', async () => {
                    txObject = await collateralizerInstance.addAuthorizedCollateralizeAgent(owner, {
                        from: owner,
                        gas: 3000000
                    })
                    assert.equal(txObject.receipt.status, true, 'Error in adding authorization agent')
                })

                it('Should revert when msg.sender is not the terms contract address', async () => {
                    await customAssert.assertRevert(collateralizerInstance.collateralize(agreementId, debtor, {
                        from: owner,
                        gas: 3000000
                    }))
                })

                it('Should revert when collateralAmount is not > 0', async () => {
                    //Adds termsContract as the addAuthorizedCollateralizeAgent  so that collateralize() does not fail at onlyAuthorizedToCollateralize() modifier and also at require(termsContract == msg.sender, "in Collateralize: collaterize(). termsContract is not the msg.sender");
                    termsContAdd = collateralizedSimpleInterestTermsContractInstance.address
                    await collateralizerInstance.addAuthorizedCollateralizeAgent(termsContAdd, {
                        from: owner,
                        gas: 3000000
                    })
                    await customAssert.assertRevert(debtKernelInstance.invokeRegisterTermStartCollateralize(agreementId, debtor, termsContAdd, {
                        from: owner,
                        gas: 3000000
                    }))
                })

                it('Should revert when collateralToken is address(0)', async () => {
                    // await customAssert.assertRevert(collateralizerInstance.collateralize(agreementId, debtor, {from: owner, gas: 3000000}))
                    // termsContAdd = collateralizedSimpleInterestTermsContractInstance.address
                    collateralAmount = 100 //s.t. it does not fail at above revert
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                    await customAssert.assertRevert(debtKernelInstance.invokeRegisterTermStartCollateralize(agreementId, debtor, termsContAdd, {
                        from: owner,
                        gas: 3000000
                    }))
                })

                it('Should revert when agreement has already been collateralized', async () => {

                    // await collateralizerInstance.collateralize(agreementId, debtor, {from: owner, gas: 3000000}) // This will collaterize the agreementId
                    // await customAssert.assertRevert(collateralizerInstance.collateralize(agreementId, debtor, {from: owner, gas: 3000000})) //Sending the above already collaterized agreement
                })

                it('Should revert in case of insufficient collateralizer balance"', async () => {
                    // termsContAdd = collateralizedSimpleInterestTermsContractInstance.address
                    collateralAmount = 100
                    collateralTokenIndex = principalTokenIndex // s.t. id does not fail at above revert
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                    await customAssert.assertRevert(debtKernelInstance.invokeRegisterTermStartCollateralize(agreementId, debtor, termsContAdd, {
                        from: owner,
                        gas: 3000000
                    }))
                })

                it('Should revert in case of insufficient proxy allowance', async () => {
                    await bcTokenInstance.transfer(debtor, 5000, {from: owner, gas: 3000000}) //such that it does not fails at above it()
                    // termsContAdd = collateralizedSimpleInterestTermsContractInstance.address
                    collateralAmount = 1000
                    collateralTokenIndex = principalTokenIndex // s.t. id does not fail at above revert
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                    await customAssert.assertRevert(debtKernelInstance.invokeRegisterTermStartCollateralize(agreementId, debtor, termsContAdd, {
                        from: owner,
                        gas: 3000000
                    }))
                })

                it('Should revert in case of tokenTransferProxy.transferFrom()', async () => {
                    // Allowance
                    await bcTokenInstance.approve(tokenTransferProxyInstance.address, 2000, {
                        from: debtor,
                        gas: 3000000
                    }) //such that it does not fail at above it
                    // termsContAdd = collateralizedSimpleInterestTermsContractInstance.address
                    collateralAmount = 1500
                    collateralTokenIndex = principalTokenIndex // s.t. id does not fail at above revert
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                    // await tokenTransferProxyInstance.addAuthorizedTransferAgent(collateralizerInstance.address, {from: owner, gas: 3000000})
                    await customAssert.assertRevert(debtKernelInstance.invokeRegisterTermStartCollateralize(agreementId, debtor, termsContAdd, {
                        from: owner,
                        gas: 3000000
                    }))
                })
            })

            describe('Check for positive scenarios', async () => {
                describe('Execute collateralize()', async () => {
                    it('Should execute collaterize() successfully', async () => {
                        // termsContAdd = collateralizedSimpleInterestTermsContractInstance.address
                        collateralAmount = 1700
                        collateralTokenIndex = principalTokenIndex // s.t. id does not fail at above revert
                        termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                        await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                        let agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                        returnCollateralAgreementId = agreementId //this will be used in returnCollateral to surpass(require(agreementToCollateralizer[agreementId] != address(0))
                        await tokenTransferProxyInstance.addAuthorizedTransferAgent(collateralizerInstance.address, {
                            from: owner,
                            gas: 3000000
                        })
                        txObject = await debtKernelInstance.invokeRegisterTermStartCollateralize(agreementId, debtor, termsContAdd, {
                            from: owner,
                            gas: 3000000
                        })
                        // let col = await collateralizerInstance.agreementToCollateralizer.call(agreementId)
                        // console.log('already coll: ', col)
                        // console.log(JSON.stringify(txObject))
                        assert.equal(txObject.receipt.status, true, 'Error while executing collateralize()')
                        // let balance = await bcTokenInstance.balanceOf.call(collateralizerInstance.address)
                        // console.log('balance: ', balance)
                    })
                    // describe('Check for events emitted by collateralize()', async () => {
                    //     it('Should check for CollateralLocked event', async() => {
                    //         let emittedEventArray = [{
                    //             event: "CollateralLocked",
                    //             args: {
                    //                 agreementID: agreementId,
                    //                 token: '',
                    //                 amount: ''
                    //             }
                    //         }]
                    //         await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                    //     })
                    // })
                })
            })
        })

        describe('Test returnCollateral(bytes32 agreementId) public whenNotPaused', async () => {
            before(async () => {
                //Here collateralAmount = 0
                fromAccount = accounts[1]
                debtor = accounts[2]
                version = accounts[3]
                beneficiary = accounts[4]
                underwriter = accounts[6]
                underwriterRiskRating = 2000
                salt = 20

                principalAmount = 500
                underwriterFee = 20
                relayerFee = 20
                creditorFee = 20
                debtorFee = 20

                tokenSymbol = await bcTokenInstance.symbol.call()
                tokenAddress = bcTokenInstance.address
                tokenName = await bcTokenInstance.name.call()
                numberOfDecimals = await bcTokenInstance.decimals.call()

                await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, {from: owner}) //adds the token to tokenRegistry
                tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

                principalTokenIndex = tokenIndex.toNumber()
                collateralTokenIndex = 10 // should revert at collateralToken is address(0), thus assigning an invalid index
                collateralAmount = 0
                termsContract = collateralizedSimpleInterestTermsContractInstance.address
                termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)

                //Insert a record in DebtRegistry
                await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
            })
            describe('Check for negative scenarios', async () => {
                it('Should revert when collateralAmount is less than 0', async () => {
                    await customAssert.assertRevert(collateralizerInstance.returnCollateral(agreementId, {
                        from: owner,
                        gas: 3000000
                    }))
                })
                it('Should revert when collateralToken is address(0)', async () => {
                    collateralAmount = 1000
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                    await customAssert.assertRevert(collateralizerInstance.returnCollateral(agreementId, {
                        from: owner,
                        gas: 3000000
                    }))
                })
                it('Should revert when collateral has already been withdrawn', async () => {
                    collateralAmount = 1000
                    collateralTokenIndex = principalTokenIndex
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                    await customAssert.assertRevert(collateralizerInstance.returnCollateral(agreementId, {
                        from: owner,
                        gas: 3000000
                    }))
                })

                it('Should revert when debt is in default state', async () => {
                    // let value
                    collateralAmount = 2000
                    collateralTokenIndex = principalTokenIndex
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)

                    await customAssert.assertRevert(collateralizerInstance.returnCollateral(returnCollateralAgreementId, {
                        from: owner,
                        gas: 3000000
                    }))
                })
                it('Should revert in case of failed transfer', async () => {
                    //TODO @balaji this should be failed check
                })
            })

            describe('Check for positive scenarios', async () => {
                describe('Execute returnCollateral()', async () => {
                    describe('Before balance', async () => {
                        it('Balances before returnCollateral', async () => {
                            let balance
                            balance = await bcTokenInstance.balanceOf.call(collateralizerInstance.address)
                            console.log('\t\tBalance of Collateralizer contract : ', balance.toNumber())

                            balance = await bcTokenInstance.balanceOf.call(accounts[3])
                            console.log('\t\tBalance of debtor: ', balance.toNumber())

                            balance = await bcTokenInstance.balanceOf.call(accounts[2])
                            console.log('\t\tBalance of beneficiary: ', balance.toNumber())
                        })
                    })

                    describe('Execute now', async () => {
                        it('Should execute returnCollateral() successfully', async () => {
                            collateralAmount = 2000
                            principalAmount = 1500
                            collateralTokenIndex = principalTokenIndex
                            termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                            await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                            agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)

                            //registerRepayment
                            let fromAccount = accounts[9]
                            await bcTokenInstance.transfer(fromAccount, 3000, {from: owner})
                            await bcTokenInstance.approve(tokenTransferProxyInstance.address, 2000, {from: fromAccount})
                            await tokenTransferProxyInstance.addAuthorizedTransferAgent(repaymentRouterInstance.address, {
                                from: owner,
                                gas: 3000000
                            })
                            await repaymentRouterInstance.repay(returnCollateralAgreementId, 2000, bcTokenInstance.address, {from: fromAccount})

                            txObject = await collateralizerInstance.returnCollateral(returnCollateralAgreementId, {
                                from: owner,
                                gas: 3000000
                            })

                            assert.equal(txObject.receipt.status, true, 'Error in executing returnCollateral()')
                        })

                        describe('Check for events emitted by returnCollateral()', async () => {
                            it('Should check for CollateralReturned event', async () => {
                                let emittedEventArray = [{
                                    event: "CollateralReturned",
                                    args: {
                                        0: returnCollateralAgreementId,
                                        1: accounts[3],
                                        2: bcTokenInstance.address,
                                        3: 1700,
                                        4:txObject.logs[0].args[4].toNumber(),
                                        __length__: 5,
                                        agreementID: returnCollateralAgreementId,
                                        collateralizer: accounts[3],
                                        token: bcTokenInstance.address,
                                        amount: 1700,
                                        timestamp: txObject.logs[0].args[4].toNumber()
                                    }
                                }]
                                await customEvent.solAllEvents(txObject, emittedEventArray, 'CollateralReturned event not emitted')
                            })
                        })
                    })


                    describe('After balance', async () => {
                        it('Balances after returnCollateral', async () => {
                            let balance
                            balance = await bcTokenInstance.balanceOf.call(collateralizerInstance.address)
                            console.log('\t\tBalance of Collateralizer contract : ', balance.toNumber())

                            balance = await bcTokenInstance.balanceOf.call(accounts[3])
                            console.log('\t\tBalance of debtor: ', balance.toNumber())

                            balance = await bcTokenInstance.balanceOf.call(accounts[2])
                            console.log('\t\tBalance of beneficiary: ', balance.toNumber())
                        })
                    })

                })
            })
        })

        describe('Test seizeCollateral(bytes32 agreementId) public whenNotPaused ', async () => {
            before(async () => {
                //Here collateralAmount = 0
                fromAccount = accounts[9]
                debtor = accounts[7]
                version = accounts[5]
                beneficiary = accounts[3]
                underwriter = accounts[1]
                underwriterRiskRating = 3000
                salt = 30

                principalAmount = 2500
                underwriterFee = 30
                relayerFee = 30
                creditorFee = 30
                debtorFee = 30

                tokenSymbol = await bcTokenInstance.symbol.call()
                tokenAddress = bcTokenInstance.address
                tokenName = await bcTokenInstance.name.call()
                numberOfDecimals = await bcTokenInstance.decimals.call()

                await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, {from: owner}) //adds the token to tokenRegistry
                tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

                principalTokenIndex = tokenIndex.toNumber()
                collateralTokenIndex = 10 // should revert at collateralToken is address(0), thus assigning an invalid index
                collateralAmount = 0
                termsContract = collateralizedSimpleInterestTermsContractInstance.address
                termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)

                //Insert a record in DebtRegistry
                await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
            })
            describe('Check for negative scenarios', async () => {
                it('Should revert when collateralAmount is less than 0', async () => {
                    await customAssert.assertRevert(collateralizerInstance.seizeCollateral(agreementId, {
                        from: owner,
                        gas: 3000000
                    }))
                })
                it('Should revert when collateralToken is address(0)', async () => {
                    collateralAmount = 1000
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                    await customAssert.assertRevert(collateralizerInstance.seizeCollateral(agreementId, {
                        from: owner,
                        gas: 3000000
                    }))
                })
                it('Should revert when collateral has already been withdrawn', async () => {
                    collateralAmount = 1000
                    collateralTokenIndex = principalTokenIndex
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
                    await customAssert.assertRevert(collateralizerInstance.seizeCollateral(agreementId, {
                        from: owner,
                        gas: 3000000
                    }))
                })
                it('Should revert when debt is in default state', async () => {
                    collateralAmount = 2000
                    principalAmount = 1200
                    collateralTokenIndex = principalTokenIndex
                    gracePeriodInDays = 3
                    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                    await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)

                    //collateralize(): collateralize the agreement
                    await bcTokenInstance.transfer(debtor, 3000, {from: owner})
                    await bcTokenInstance.approve(tokenTransferProxyInstance.address, 2500, {
                        from: debtor,
                        gas: 3000000
                    })
                    txObject = await debtKernelInstance.invokeRegisterTermStartCollateralize(agreementId, debtor, termsContAdd, {
                        from: owner,
                        gas: 3000000
                    })

                    await customAssert.assertRevert(collateralizerInstance.seizeCollateral(agreementId, {
                        from: owner,
                        gas: 3000000
                    }))
                })
                it('Should revert in case of failed transfer', async () => {
                    //TODO @balaji this should be failed check
                })
            })

            describe('Check for positive scenarios', async () => {
                describe('Execute seizeCollateral()', async () => {
                    it('Should execute seizeCollateral() successfully', async () => {
                        collateralAmount = 2000
                        principalAmount = 1500
                        collateralTokenIndex = principalTokenIndex
                        gracePeriodInDays = 3
                        termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
                        await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                        agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)

                        //collateralize(): collateralize the agreement
                        await bcTokenInstance.transfer(debtor, 3000, {from: owner})
                        await bcTokenInstance.approve(tokenTransferProxyInstance.address, 2500, {
                            from: debtor,
                            gas: 3000000
                        })
                        txObject = await debtKernelInstance.invokeRegisterTermStartCollateralize(agreementId, debtor, termsContAdd, {
                            from: owner,
                            gas: 3000000
                        })

                        //Fast-forward ganache
                        await web3APIs.fastForwardGanache(SECONDS_IN_DAY * 4) // forward time by 4 days

                        let timeAdjustedForGracePeriod = await collateralizerInstance.timestampAdjustedForGracePeriod.call(gracePeriodInDays)
                        // console.log('timeAdjustedForGracePeriod: ', timeAdjustedForGracePeriod.toNumber())
                        let expectedRepaymentValue = await collateralizedSimpleInterestTermsContractInstance.getExpectedRepaymentValue.call(agreementId, timeAdjustedForGracePeriod)
                        // console.log('expectedRepaymentValue: ', expectedRepaymentValue.toNumber())
                        //
                        let valueRepaidToDate = await collateralizedSimpleInterestTermsContractInstance.getValueRepaidToDate.call(agreementId)
                        // console.log('valueRepaidToDate: ', valueRepaidToDate.toNumber())

                        txObject = await collateralizerInstance.seizeCollateral(agreementId, {
                            from: owner,
                            gas: 3000000
                        })
                    })
                    describe('Check for events emitted by seizeCollateral()', async () => {
                        it('Should check for CollateralSeized event', async () => {
                            let beneficiary = await debtRegistryInstance.getBeneficiary.call(agreementId)
                            let emittedEventArray = [{
                                event: "CollateralSeized",
                                args: {
                                    0: agreementId,
                                    1: beneficiary,
                                    2: bcTokenInstance.address,
                                    3: collateralAmount,
                                    4: txObject.logs[0].args[4].toNumber(),
                                    __length__: 5,
                                    agreementID: agreementId,
                                    beneficiary: beneficiary,
                                    amount: collateralAmount,
                                    token: bcTokenInstance.address,
                                    timestamp: txObject.logs[0].args[4].toNumber()
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'CollateralSeized event not emitted')
                        })
                    })
                })
            })
        })

        describe('Test addAuthorizedCollateralizeAgent(address agent) public onlyOwner', async () => {
            let addAgent = accounts[9]
            let nonOwner = accounts[6]
            describe('Check for negative scenarios', async () => {
                it('Should revert when msg.sender is not onlyOwner', async () => {
                    await customAssert.assertRevert(collateralizerInstance.addAuthorizedCollateralizeAgent(addAgent, {from: nonOwner, gas: 3000000}))
                })
            })

            describe('Check for positive scenarios', async () => {
                describe('Execute addAuthorizedCollateralizeAgent()', async () => {
                    it('Should addAuthorizedCollateralizeAgent successfully ', async () => {
                        txObject = await collateralizerInstance.addAuthorizedCollateralizeAgent(addAgent, {from: owner, gas: 3000000}) //this agents authorization will be later revoked
                        await collateralizerInstance.addAuthorizedCollateralizeAgent(accounts[5], {from: owner, gas: 3000000})
                        let agents = await collateralizerInstance.getAuthorizedCollateralizeAgents.call()
                        console.log('\t\tAuthorized collateralized agents are:')
                        agents.forEach((element) => {
                            console.log('\t\t\t', element)
                        })
                        assert.equal(txObject.receipt.status, true, 'addAuthorizedCollateralizeAgent() failed')
                    })
                })
            })
        })

        describe('Test revokeCollateralizeAuthorization(address agent) public onlyOwner', async () => {
            let addAgent = accounts[9]
            let nonOwner = accounts[6]
            describe('Check for negative scenarios', async () => {
                it('Should revert when msg.sender is not onlyOwner', async () => {
                    await customAssert.assertRevert(collateralizerInstance.revokeCollateralizeAuthorization(addAgent, {from: nonOwner, gas: 3000000}))
                })
            })

            describe('Check for positive scenarios', async () => {
                describe('Execute revokeCollateralizeAuthorization()', async () => {
                    it('Should revokeCollateralizeAuthorization successfully ', async () => {
                        txObject = await collateralizerInstance.revokeCollateralizeAuthorization(addAgent, {from: owner, gas: 3000000})
                        assert.equal(txObject.receipt.status, true, 'addAuthorizedCollateralizeAgent() failed')
                    })
                })
            })
        })

        describe('Test getAuthorizedCollateralizeAgents(address agent) public view returns (address[])', async () => {
            describe('Execute getAuthorizedCollateralizeAgents()', async () => {
                it('Should getAuthorizedCollateralizeAgents successfully ', async () => {
                    let agents = await collateralizerInstance.getAuthorizedCollateralizeAgents.call()
                    console.log('\t\tAuthorized collateralized agents are:')
                    agents.forEach((element) => {
                        console.log('\t\t\t', element)
                    })

                })
            })
        })
    })
})
