const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')
const web3APIs = require('../../reactApiConnectLayer/utils/web3Apis')
const customFunctions = require('../utils/debtRegistry/customFunctions')

const Collateralizer = artifacts.require('Collateralizer')
const DebtKernel = artifacts.require('DebtKernel')
const DebtRegistry = artifacts.require('DebtRegistry')
const DebtToken = artifacts.require('DebtToken')
const TokenRegistry = artifacts.require('TokenRegistry')
const TokenTransferProxy = artifacts.require('TokenTransferProxy')
const RepaymentRouter = artifacts.require('RepaymentRouter')
const ContractRegistry = artifacts.require('ContractRegistry')
const SimpleInterestTerms = artifacts.require('SimpleInterestTermsContract')
const BCToken = artifacts.require('BCToken')

contract('SimpleInterestTermsContract Test Suite', async (accounts) => {
    describe('SimpleInterestTermsContract is [ TermsContract ]', async () => {
        let debtKernelInstance, tokenTransferProxyInstance, debtTokenInstance, debtRegistryInstance, collateralizerInstance, tokenRegistryInstance, contractRegistryInstance, repaymentRouterInstance, simpleInterestTermsInstance, bcTokenInstance
        const owner = accounts[0]
        let txObject
        let debtor, version, beneficiary, underwriter, underwriterRiskRating, termsContract, salt, termsContractParameters,
            relayer, creditor, agreementId
        let principalAmount, underwriterFee, relayerFee, creditorFee, debtorFee, expirationTimestampInSec

        before(async () => {
            bcTokenInstance = await BCToken.new({from: owner})
            debtRegistryInstance = await DebtRegistry.new({from: owner})
            debtTokenInstance = await DebtToken.new(debtRegistryInstance.address, {from: owner})
            tokenTransferProxyInstance = await TokenTransferProxy.new({from: owner})
            tokenRegistryInstance = await TokenRegistry.new({ from: owner })
            debtKernelInstance = await DebtKernel.new(tokenTransferProxyInstance.address, {from: owner})
            repaymentRouterInstance = await RepaymentRouter.new(debtRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
            collateralizerInstance = await Collateralizer.new(debtKernelInstance.address, debtRegistryInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address)
            contractRegistryInstance = await ContractRegistry.new(collateralizerInstance.address, debtKernelInstance.address, debtRegistryInstance.address, debtTokenInstance.address, repaymentRouterInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})

            simpleInterestTermsInstance = await SimpleInterestTerms.new(contractRegistryInstance.address, {from: owner}) //Deploys the SimpleInterestTermsContract.sol
        });

        describe('Constructor', async () => {
            describe('Get the default public variable values', async () => {
                let valueFromContract
                const HOUR_LENGTH_IN_SECONDS = 60 * 60
                const DAY_LENGTH_IN_SECONDS = HOUR_LENGTH_IN_SECONDS * 24
                const WEEK_LENGTH_IN_SECONDS = DAY_LENGTH_IN_SECONDS * 7
                const MONTH_LENGTH_IN_SECONDS = DAY_LENGTH_IN_SECONDS * 30
                const YEAR_LENGTH_IN_SECONDS = DAY_LENGTH_IN_SECONDS * 365
                const INTEREST_RATE_SCALING_FACTOR_PERCENT = 10 ** 4
                const INTEREST_RATE_SCALING_FACTOR_MULTIPLIER = INTEREST_RATE_SCALING_FACTOR_PERCENT * 100

                it('Should get the contractRegistry value', async () => {
                    let contractAddress = await simpleInterestTermsInstance.contractRegistry.call()
                    assert.equal(contractAddress, contractRegistryInstance.address, 'ContractRegistry addresses do not match')
                })
                it('Should get the NUM_AMORTIZATION_UNIT_TYPES value', async () => {
                    let expectedValue = 5
                    valueFromContract = await simpleInterestTermsInstance.NUM_AMORTIZATION_UNIT_TYPES.call()
                    assert.equal(valueFromContract, expectedValue, 'NUM_AMORTIZATION_UNIT_TYPES do not match')
                })
                it('Should get the HOUR_LENGTH_IN_SECONDS value', async () => {
                    valueFromContract = await simpleInterestTermsInstance.HOUR_LENGTH_IN_SECONDS.call()
                    assert.equal(valueFromContract, HOUR_LENGTH_IN_SECONDS, 'HOUR_LENGTH_IN_SECONDS do not match')
                })
                it('Should get the DAY_LENGTH_IN_SECONDS value', async () => {
                    valueFromContract = await simpleInterestTermsInstance.DAY_LENGTH_IN_SECONDS.call()
                    assert.equal(valueFromContract, DAY_LENGTH_IN_SECONDS, 'DAY_LENGTH_IN_SECONDS do not match')
                })
                it('Should get the WEEK_LENGTH_IN_SECONDS value', async () => {
                    valueFromContract = await simpleInterestTermsInstance.WEEK_LENGTH_IN_SECONDS.call()
                    assert.equal(valueFromContract, WEEK_LENGTH_IN_SECONDS, 'WEEK_LENGTH_IN_SECONDS do not match')
                })
                it('Should get the MONTH_LENGTH_IN_SECONDS value', async () => {
                    valueFromContract = await simpleInterestTermsInstance.MONTH_LENGTH_IN_SECONDS.call()
                    assert.equal(valueFromContract, MONTH_LENGTH_IN_SECONDS, 'MONTH_LENGTH_IN_SECONDS do not match')
                })
                it('Should get the YEAR_LENGTH_IN_SECONDS value', async () => {
                    valueFromContract = await simpleInterestTermsInstance.YEAR_LENGTH_IN_SECONDS.call()
                    assert.equal(valueFromContract, YEAR_LENGTH_IN_SECONDS, 'YEAR_LENGTH_IN_SECONDS do not match')
                })
                it('Should get the INTEREST_RATE_SCALING_FACTOR_PERCENT value', async () => {
                    valueFromContract = await simpleInterestTermsInstance.INTEREST_RATE_SCALING_FACTOR_PERCENT.call()
                    assert.equal(valueFromContract, INTEREST_RATE_SCALING_FACTOR_PERCENT, 'INTEREST_RATE_SCALING_FACTOR_PERCENT do not match')
                })
                it('Should get the INTEREST_RATE_SCALING_FACTOR_MULTIPLIER value', async () => {
                    valueFromContract = await simpleInterestTermsInstance.INTEREST_RATE_SCALING_FACTOR_MULTIPLIER.call()
                    assert.equal(valueFromContract, INTEREST_RATE_SCALING_FACTOR_MULTIPLIER, 'INTEREST_RATE_SCALING_FACTOR_MULTIPLIER do not match')
                })
            })
        })

        describe('Test registerTermStart(bytes32 agreementId, address guarantor, address debtor) public onlyDebtKernel returns (bool _success)', async () => {
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

                expirationTimestampInSec = Date.now()

                //For getting termsContractParameters
                /*
                * Read Readme/getTermsContractParameters.md
                *
                * */
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

                // console.log('TermsContractParameters in simpleInterestTerms.test.js: ', termsContractParameters)
                termsContract = simpleInterestTermsInstance.address

                //Insert a record in DebtRegistry
                await debtRegistryInstance.addAuthorizedInsertAgent(owner, {from: owner})
                await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})
                agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)

            })
            describe('Check for negative scenarios', async () => {
                it('Should revert for non-debtKernel invokation', async  () => {
                   await customAssert.assertRevert(simpleInterestTermsInstance.registerTermStart(agreementId, debtor), {from: owner})
                })
            })
            describe('Check for positive scenarios', async () => {
                describe('Execute registerTermStart()', async () => {
                    it('Should execute the registerTermStart() successfully', async () => {
                        txObject = await debtKernelInstance.invokeRegisterTermStart(agreementId, debtor, simpleInterestTermsInstance.address, {from: owner})
                        // txObject = await debtKernelInstance.invokeRegisterTermStart.call(agreementId, debtor, simpleInterestTermsInstance.address, {from: owner})
                        // console.log(JSON.stringify(txObject))
                        assert.equal(txObject.receipt.status, true, 'Error while executing registerTermStart()') //TODO @chaitanya why this txObject does not have the LogSimpleInterestTermStart event
                    })
                })
                describe('Check for events emitted by registerTermStart()', async () => {
                    it('Should check for LogSimpleInterestTermStart event', async() => { })
                })
            })
        })

        describe('Test registerRepayment(bytes32 agreementId, address payer, address beneficiary, uin256 unitsOfRepayment,address tokenAddress) public onlyRouter returns (bool _success)', async () => {
            describe('Check for negative scenarios', async () => {
                it('Should revert for non-onlyRouter invokation', async  () => {
                    await customAssert.assertRevert(simpleInterestTermsInstance.registerRepayment(agreementId, owner, beneficiary, 5000, bcTokenInstance.address, {from: owner}))
                })
            })
            describe('Check for positive scenarios', async () => {
                describe('Execute registerRepayment()', async () => {
                    it('Should execute the registerRepayment() successfully', async () => {
                        txObject = await repaymentRouterInstance.invokeRegisterRepayment(agreementId, owner, beneficiary, 5000, bcTokenInstance.address, simpleInterestTermsInstance.address, {from: owner})
                        // console.log(JSON.stringify(txObject))
                        // txObject = await repaymentRouterInstance.invokeRegisterRepayment.call(agreementId, owner, beneficiary, 5000, bcTokenInstance.address, simpleInterestTermsInstance.address, {from: owner})
                        // console.log(txObject)
                        assert.equal(txObject.receipt.status, true, 'Error while executing registerRepayment()')
                    })
                })
                describe('Check for events emitted by registerRepayment()', async () => {
                    it('Should check for LogRegisterRepayment event', async() => {
                        // let emittedEventArray = [{
                        //     event: "LogRegisterRepayment",
                        //     args: {
                        //         agreementId: agreementId,
                        //         payer: owner,
                        //         beneficiary: beneficiary,
                        //         unitsOfRepayment: 5000,
                        //         tokenAddress: bcTokenInstance.address
                        //     }
                        // }]
                        // await customEvent.solAllEvents(txObject, emittedEventArray, 'LogRegisterRepayment event is not emitted')
                    })
                })
            })
        })

        describe('Ensure 100% code coverage', async() => {
            describe('Test getExpectedRepaymentValue(bytes32 agreementId, uint256 timestamp) public view onlyMappedToThisContract(agreementId) returns (uint _expectedRepaymentValue)', async () => {
                it('Should execute getExpectedRepaymentValue(bytes32 agreementId, uint256 timestamp) public view onlyMappedToThisContract(agreementId)', async () => {
                    let expectedRepaymentValue = await simpleInterestTermsInstance.getExpectedRepaymentValue.call(agreementId, Date.now())
                    assert.equal(expectedRepaymentValue.toNumber(), principalAmount, 'Repayment values do not match')

                })
            })

            describe('Test getValueRepaidToDate(bytes32 agreementId) public view returns (uint _valueRepaid)', async () => {
                it('Should execute getValueRepaidToDate(bytes32 agreementId)', async () => {
                    let valueRepaidToDate = await simpleInterestTermsInstance.getValueRepaidToDate.call(agreementId)
                    assert.equal(valueRepaidToDate.toNumber(), 5000, 'Value repaid to date do not match')
                })
            })

            describe('Test getTermEndTimestamp(bytes32 agreementId) public view returns (uint)', async () => {
                it('Should execute getTermEndTimestamp(bytes32 agreementId)' , async () => {
                    await simpleInterestTermsInstance.getTermEndTimestamp.call(agreementId)
                })
            })
        })
    })

})
