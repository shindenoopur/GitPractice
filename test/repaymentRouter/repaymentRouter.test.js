/**
 * Created by Balaji on 2/11/18.
 */

const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')
const customEvent = require('../utils/assertEvent')
const customFunctions = require('../../test/utils/debtRegistry/customFunctions')
const DebtRegistry = artifacts.require('DebtRegistry')
const TokenTransferProxy = artifacts.require('TokenTransferProxy')
const RepaymentRouter = artifacts.require('RepaymentRouter')
const BCToken = artifacts.require('BCToken')
const TokenRegistry = artifacts.require('TokenRegistry')
const DebtToken = artifacts.require('DebtToken')
const DebtKernel = artifacts.require('DebtKernel')
const Collateralizer = artifacts.require('Collateralizer')
const ContractRegistry = artifacts.require('ContractRegistry')
const CollateralizedSimpleInterestTermsContract = artifacts.require('CollateralizedSimpleInterestTermsContract')

contract('RepaymentRouter Test Suite', async (accounts) => {
    let debtRegistryInstance, tokenTransferProxyInstance, repaymentRouterInstance, bcTokenInstance, tokenRegistryInstance, collateralizedSimpleInterestTermsContractInstance,
        collateralizerInstance, contractRegistryInstance, debtKernelInstance, debtTokenInstance
    let owner, agreementId, txObject, fromAccount
    let debtRegistryAddress, tokenTransferProxyAddress
    let debtor, version, beneficiary, underwriter, underwriterRiskRating, termsContract, amount, salt, termsContractParameters
    let zeroAdd = '0x0000000000000000000000000000000000000000'

    debtor = accounts[1]
    version = accounts[2]
    beneficiary = accounts[3]
    underwriter = accounts[4]
    underwriterRiskRating = 1000

    salt = 10

    fromAccount = accounts[9]

    before(async () => {
        //Setup
        owner = accounts[0]
        debtRegistryInstance = await  DebtRegistry.new({from: owner})
        debtTokenInstance = await DebtToken.new(debtRegistryInstance.address, {from: owner})
        tokenTransferProxyInstance = await TokenTransferProxy.new({from: owner})
        debtKernelInstance = await DebtKernel.new(tokenTransferProxyInstance.address, {from: owner})
        bcTokenInstance = await BCToken.new({from: owner})
        debtRegistryAddress = debtRegistryInstance.address //address of DebtRegistry
        tokenTransferProxyAddress = tokenTransferProxyInstance.address // address of TokenTransferProxy
        repaymentRouterInstance = await RepaymentRouter.new(debtRegistryAddress, tokenTransferProxyAddress, {from: owner})
        tokenRegistryInstance = await TokenRegistry.new({from: owner})
        collateralizerInstance = await Collateralizer.new(debtKernelInstance.address, debtRegistryInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address)
        contractRegistryInstance = await ContractRegistry.new(collateralizerInstance.address, debtKernelInstance.address, debtRegistryInstance.address, debtTokenInstance.address,                                                          repaymentRouterInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
        collateralizedSimpleInterestTermsContractInstance = await CollateralizedSimpleInterestTermsContract.new(contractRegistryInstance.address, {from: owner})
        //copied from debtRegistry.test.js
        //Pre-requisites
        let principalTokenIndex , interestRate = 10, amortizationUnit = 1,termLength = 100, collateralTokenIndex, collateralAmount = 500, gracePeriodInDays = 2, principalAmount = 1000
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
        await debtRegistryInstance.addAuthorizedInsertAgent(owner)
        txObject = await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
        agreementId = txObject.logs[0].args.agreementId
    })

    describe('function repay(bytes32 agreementId, uint256 amount,address tokenAddress) public whenNotPaused returns (uint _amountRepaid)', async () => {
        describe('Check for negative scenario', async () => {

            describe('Should revert repay() whenNotPaused', async () => {
                amount = 1000
                it('Reverts whenNotPaused()', async() => {
                    txObject = await repaymentRouterInstance.repay(agreementId, amount, bcTokenInstance.address)
                    emittedEventArray = [{
                        event: "LogError",
                        args: {
                            0: 1,
                            1: agreementId,
                            __length__: 2,
                            _errorId: 1,
                            _agreementId: agreementId
                        }
                    }]
                    await  customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                })
            })

            describe('Should revert repay() when tokenAddress is address(0)', async () => {
                it('Reverts tokenAddress = address(0)', async() => {
                    amount = 5000
                    await customAssert.assertRevert(repaymentRouterInstance.repay(agreementId, amount, zeroAdd))
                })
            })

            describe('Revert repay() when amount <= 0', async () => {
                it('Should revert repay() when amount <= 0', async () => {
                    let zeroAmount = 0
                    await customAssert.assertRevert(repaymentRouterInstance.repay(agreementId, zeroAmount, bcTokenInstance.address, {from: debtor}))
                })
            })

            describe('Revert repay() for non-existing agreementId', async () => {
                it('Should revert repay() for non-existing agreementId', async () => {
                    let agId = '0x0000000000000000000000000000000000000000000000000000000000000001'
                    let status = await debtRegistryInstance.doesEntryExist.call(agId)
                    assert.equal(status, false, 'Agreement Id does exists')
                })
            })

            describe('Emit LogError event', async () => {
                it('Should emit LogError event when agreementId does not exist', async () => {
                    let nonExistingAgrId = '0x1234567890000000000000000000000000000000000000000000000000000000'
                    txObject = await  repaymentRouterInstance.repay(nonExistingAgrId, amount, bcTokenInstance.address, {from: debtor})
                    let emittedEventArray = [{
                        event: "LogError",
                        args: {
                            0: 0,
                            1: nonExistingAgrId,
                            __length__: 2,
                            _errorId: 0,
                            _agreementId: nonExistingAgrId
                        }
                    }]
                    await  customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                })

                it('Should emit LogError event when payer has insufficient balance', async () => {
                    txObject = await  repaymentRouterInstance.repay(agreementId, amount, bcTokenInstance.address, {from: debtor})
                    // console.log(JSON.stringify(txObject))
                    let emittedEventArray = [{
                        event: "LogError",
                        args: {
                            0: 1,
                            1: agreementId,
                            __length__: 2,
                            _errorId: 1,
                            _agreementId: agreementId
                        }
                    }]
                    await  customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                })
            })
        })

        describe('Check for positive scenario', async () => {
            describe('Check for successful execution of repay()', async () => {

                describe('Submit repay() successfully', async() => {
                    describe('Submit repay()', async () => {
                        it('Should submit repay() successfully', async () => {
                            let balance
                            let repaymentRouterAdd = repaymentRouterInstance.address
                            let tokenTransferProxyAdd = tokenTransferProxyInstance.address

                            balance = await bcTokenInstance.balanceOf.call(beneficiary)
                            console.log('\n\t\tBalance of beneficiary before repay(): ', balance.toNumber())

                            await bcTokenInstance.transfer(fromAccount, 1000, {from: owner})

                            //transferFrom fromAccount via TokenTransferProxy
                            await bcTokenInstance.approve(tokenTransferProxyAdd, 100, {from: fromAccount})

                            await tokenTransferProxyInstance.addAuthorizedTransferAgent(repaymentRouterAdd, {from: owner, gas: 3000000}) //repaymentRouterAdd will be the msg.sender in TokenTransferProxy.transferFrom

                            txObject =  await repaymentRouterInstance.repay(agreementId, 10, bcTokenInstance.address, {from: fromAccount})

                            balance = await bcTokenInstance.balanceOf.call(beneficiary)
                            console.log('\n\t\tBalance of beneficiary after repay(): ', balance.toNumber())

                            assert.equal(txObject.receipt.status, true, 'Failed successful execution f repay()')
                        })
                    })
                })

            })
        })
    })
})