/**
 * Created by Balaji on 11/12/18.
 */

const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')
const customEvent = require('../utils/assertEvent')
const Escrow= artifacts.require('Escrow')
const BCToken = artifacts.require('BCToken')
const TokenRegistry = artifacts.require('TokenRegistry')
const Collateralizer = artifacts.require('Collateralizer')
const DebtRegistry = artifacts.require('DebtRegistry')
const TokenTransferProxy = artifacts.require('TokenTransferProxy')
const DebtKernel = artifacts.require('DebtKernel')
const ContractRegistry = artifacts.require('ContractRegistry')
const CollateralizedSimpleInterestTermsContract = artifacts.require('CollateralizedSimpleInterestTermsContract')
const RepaymentRouter = artifacts.require('RepaymentRouter')
const DebtToken = artifacts.require('DebtToken')
const EscrowRegistry = artifacts.require('EscrowRegistry')
const Borrower = artifacts.require('Borrower')
const customFunctions = require('../utils/debtRegistry/customFunctions')
const web3APIs = require('../../reactApiConnectLayer/utils/web3Apis')
const utils = require('../../reactApiConnectLayer/utils/utils')
const demoValues = require('../../reactApiConnectLayer/debtLifeCycle/demoValues/demoValues')


let erc20TokenAddress
let escrowInstance, erc20TokenInstance, tokenRegistryInstance, debtKernelInstance, tokenTransferProxyInstance, debtTokenInstance, debtRegistryInstance, collateralizerInstance, collateralizedSimpleInterestTermsContractInstance, contractRegistryInstance, repaymentRouterInstance, escrowRegistryInstance, borrowerInstance
let zeroAddAcc = '0x0000000000000000000000000000000000000000'
let txObject, owner, debtAgreementId
const fixedDepositAmount = demoValues.deploymentValues.escrowFixedDepositAmount
let nullBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

contract('Escrow Test Suite', (accounts) => {
    describe('Escrow [ is Ownable, ERC721Holder ]', () => {

        before(async() => {
            owner = accounts[0]
            erc20TokenInstance = await BCToken.new({from: owner})
            erc20TokenAddress = erc20TokenInstance.address
            debtRegistryInstance = await DebtRegistry.new({from: owner})
            debtTokenInstance = await DebtToken.new(debtRegistryInstance.address, {from: owner})
            escrowRegistryInstance = await EscrowRegistry.new({from: owner})
            escrowInstance = await Escrow.new(erc20TokenAddress, debtTokenInstance.address, debtRegistryInstance.address, escrowRegistryInstance.address, fixedDepositAmount, {from: owner})
            tokenTransferProxyInstance = await TokenTransferProxy.new({from: owner})
            tokenRegistryInstance = await TokenRegistry.new({ from: owner })
            debtKernelInstance = await DebtKernel.new(tokenTransferProxyInstance.address, {from: owner})
            repaymentRouterInstance = await RepaymentRouter.new(debtRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
            collateralizerInstance = await Collateralizer.new(debtKernelInstance.address, debtRegistryInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address)
            contractRegistryInstance = await ContractRegistry.new(collateralizerInstance.address, debtKernelInstance.address, debtRegistryInstance.address, debtTokenInstance.address,                                                          repaymentRouterInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
            collateralizedSimpleInterestTermsContractInstance = await CollateralizedSimpleInterestTermsContract.new(contractRegistryInstance.address, {from: owner})
            borrowerInstance = await Borrower.new(erc20TokenInstance.address, debtRegistryInstance.address, collateralizedSimpleInterestTermsContractInstance.address, escrowRegistryInstance.address, repaymentRouterInstance.address, {from: owner})

        })

        describe('Checks constructor()', () => {
            describe('Should check the value set by constructor', () => {
                let contractAddress
               it('Checks the erc20 tokenAddress', async () => {
                   contractAddress = await escrowInstance.ERC20_TOKEN.call()
                   assert.equal(contractAddress, erc20TokenAddress, 'ERC20Token addresses do not match')
               })

                it('Checks the debtToken address', async () => {
                    contractAddress = await escrowInstance.debtToken.call()
                    assert.equal(contractAddress, debtTokenInstance.address, 'DebtToken addresses do not match')
                })

                it('Checks the debtRegistry address', async () => {
                    contractAddress = await escrowInstance.debtRegistry.call()
                    assert.equal(contractAddress, debtRegistryInstance.address, 'DebtRegistry addresses do not match')
                })

                it('Checks the escrowRegistry Address', async () => {
                    contractAddress = await escrowInstance.escrowRegistry.call()
                    assert.equal(contractAddress, escrowRegistryInstance.address, 'EscrowRegistry addresses do not match')
                })

               it('Checks the fixedDepositAmount', async() => {
                    let depositAmount = await escrowInstance.DEPOSIT_AMOUNT.call()
                    assert.equal(depositAmount.toNumber(), fixedDepositAmount, 'Deposit amounts do not match')
               })

               it('Checks the loan state', async() => {
                    let state = await escrowInstance.getLenderState.call()
                   // console.log('State in constructor: ', state)
                    assert.equal(state.toNumber(), 0, 'Loan states do not match')
               })

            })
        })

        describe('\n\n\nTest case covering 4 depositors with no Part Payment Invocation and direct final withdraw', () => {
            describe('function deposit(uint256 amount) publicOwner payable', () => {
                let depositor1 = accounts[1]
                let depositor2 = accounts[2]
                let depositor3 = accounts[3]
                let depositor4 = accounts[4]
                describe('Check negative scenarios', () => {
                    it('Should revert when msg.sender is address(0)', async () => {
                        await customAssert.assertRevert(escrowInstance.deposit(100, {from: zeroAddAcc, gas: 3000000}))
                    })
                    it('Should revert when amount <= 0', async () => {
                        await customAssert.assertRevert(escrowInstance.deposit(0, {from: depositor1, gas: 3000000}))
                    })

                })

                describe('Check positive scenarios', () => {
                    let amountToDeposit = demoValues.deploymentValues.escrowFixedDepositAmount
                    let eachDepositorDeposits = demoValues.escrowTestCases.individualDeposits
                    let beforeDepositingBalDepositor1 , beforeDepositingBalDepositor2, beforeDepositingBalDepositor3, beforeDepositingBalDepositor4
                    let deposit1 = eachDepositorDeposits , deposit2 = eachDepositorDeposits, deposit3 = eachDepositorDeposits, deposit4 = eachDepositorDeposits
                    describe('Execute deposit() successfully', () => {
                        it('Should execute deposit() successfully', async () => {

                            //Pre-reqs
                            await erc20TokenInstance.transfer(depositor1, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})
                            await erc20TokenInstance.transfer(depositor2, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})
                            await erc20TokenInstance.transfer(depositor3, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})
                            await erc20TokenInstance.transfer(depositor4, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})

                            //Allowance
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor1, gas: 3000000})
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor2, gas: 3000000})
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor3, gas: 3000000})
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor4, gas: 3000000})

                            beforeDepositingBalDepositor1 = await erc20TokenInstance.balanceOf.call(depositor1)
                            beforeDepositingBalDepositor2 = await erc20TokenInstance.balanceOf.call(depositor2)
                            beforeDepositingBalDepositor3 = await erc20TokenInstance.balanceOf.call(depositor3)
                            beforeDepositingBalDepositor4 = await erc20TokenInstance.balanceOf.call(depositor4)


                            await escrowInstance.deposit(deposit1, {from: depositor1, gas: 3000000})
                            await escrowInstance.deposit(deposit2, {from: depositor2, gas: 3000000})
                            await escrowInstance.deposit(deposit3, {from: depositor3, gas: 3000000})

                            txObject =  await escrowInstance.deposit(deposit4, {from: depositor4, gas: 3000000})
                            assert.equal(txObject.receipt.status, true, 'Error while executing deposit()')
                        })
                    })

                    describe('Check deposit() executed as expected', () => {
                        it('Should check for successful execution of deposit()', async () => {
                            let deposit1, deposit2, deposit3, deposit4
                            deposit1 = await escrowInstance.getDepositsOf.call(depositor1)
                            deposit2 = await escrowInstance.getDepositsOf.call(depositor2)
                            deposit3 = await escrowInstance.getDepositsOf.call(depositor3)
                            deposit4 = await escrowInstance.getDepositsOf.call(depositor4)

                            let escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address)
                            console.log('\t\tBalance of escrow contract after deposits: ', escrowBal.toNumber())
                            let depositedAmount = deposit1.toNumber() + deposit2.toNumber() + deposit3.toNumber() + deposit4.toNumber()
                            assert.equal(depositedAmount, amountToDeposit, 'Deposited amounts do not match')
                        })

                        it('Should check the loan state to be MakeLoan', async () => {
                            let loanState = await escrowInstance.getLenderState.call()
                            assert.equal(loanState.toNumber(), 1, 'Loan states do not match')
                        })
                    })

                    describe('Check for events emitted by deposit()', () => {
                        it('Should check for Deposited event', async () => {
                            let depositOfDepositor
                            depositOfDepositor = await escrowInstance.getDepositsOf.call(depositor4)
                            let emittedEventArray = [{
                                event: 'Deposited',
                                args: {
                                    0 : depositor4,
                                    1: depositOfDepositor.toNumber(),
                                    2: txObject.logs[0].args.timestamp.toNumber(),
                                    3: escrowInstance.address,
                                    __length__: 4,
                                    payee: depositor4,
                                    tokenAmount: depositOfDepositor.toNumber(),
                                    timestamp: txObject.logs[0].args.timestamp.toNumber(),
                                    escrow: escrowInstance.address

                                }
                            }]
                            // console.log(JSON.stringify(txObject))
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events emitted by deposit() do not match')
                        })
                    })

                    describe('Check deposit() has reached the fixed deposit amount', () => {
                        it('Should check deposit has reached the fixed deposit amount', async () => {
                            let escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address)
                            assert.equal(escrowBal.toNumber(), amountToDeposit, 'Deposit has not reached the fixed deposit amount')
                        })

                        it('Should fail deposit after deposits have been freezed', async() => {
                            await customAssert.assertRevert(escrowInstance.deposit(50000, {from: depositor1, gas: 3000000}))
                        })
                    })

                    describe('Check balances of depositors after deposit()', () => {
                        let depositOfDepositor, balanceOfDepositor
                        it('Should check depositor1 balance', async () => {
                            balanceOfDepositor = await erc20TokenInstance.balanceOf.call(depositor1)
                            depositOfDepositor = await escrowInstance.getDepositsOf.call(depositor1)
                            assert.equal(balanceOfDepositor.toNumber(), (beforeDepositingBalDepositor1.toNumber() - depositOfDepositor.toNumber()), "Depositor1's deposits do not match")
                        })

                        it('Should check depositor2 balance', async () => {
                            balanceOfDepositor = await erc20TokenInstance.balanceOf.call(depositor2)
                            depositOfDepositor = await escrowInstance.depositsOf.call(depositor2)
                            assert.equal(balanceOfDepositor.toNumber(), (beforeDepositingBalDepositor2.toNumber() - depositOfDepositor.toNumber()), "Depositor2's deposits do not match")
                        })

                        it('Should check depositor3 balance', async () => {
                            balanceOfDepositor = await erc20TokenInstance.balanceOf.call(depositor3)
                            depositOfDepositor = await escrowInstance.depositsOf.call(depositor3)
                            assert.equal(balanceOfDepositor.toNumber(), (beforeDepositingBalDepositor3.toNumber() - depositOfDepositor.toNumber()), "Depositor3's deposits do not match")
                        })

                        it('Should check depositor4 balance', async () => {
                            balanceOfDepositor = await erc20TokenInstance.balanceOf.call(depositor4)
                            depositOfDepositor = await escrowInstance.depositsOf.call(depositor4)
                            assert.equal(balanceOfDepositor.toNumber(), (beforeDepositingBalDepositor4.toNumber() - depositOfDepositor.toNumber()), "Depositor4's deposits do not match")
                        })
                    })
                })
            })
            describe('function makeLoan() public loanState(States.MakeLoan)', () => {
                describe('Check negative scenarios', async () => {
                    it('Should revert in case of non-regulator', async () => {
                        await customAssert.assertRevert(escrowInstance.makeLoan({from: accounts[8], gas: 3000000}))
                    })
                })

                describe('Check positive scenarios', () => {
                    it('Should invoke makeLoan() & set the lender attributes in EscrowRegistry', async () => {
                        let regulator = accounts[7]
                        let debtor =  borrowerInstance.address
                        //pre-reqs
                        await escrowRegistryInstance.addRegulator(escrowInstance.address, {from: owner, gas: 3000000})
                        //Also borrower should be in a state of accepting the loan
                        //Add a regulator s.t. the regulator can invoke the setBorrowerAttributes
                        await escrowRegistryInstance.addRegulator(regulator, {from: owner, gas: 3000000})
                        await escrowRegistryInstance.setBorrowerAttributes(debtor, demoValues.escrowTestCases.borrowableAmount, {from: regulator, gas: 3000000})

                        //Now both the creditor and borrower are in a state of accepting and granting loan
                        txObject = await escrowInstance.makeLoan({from: owner, gas: 3000000})
                        assert.equal(txObject.receipt.status, true, "Failure while invoking makeLoan()")

                    })
                })

                describe('Execute fillDebtOrder() of debtKernel with creditor  & debtor both being contract addresses', () => {
                    let orderAddresses = [], orderValues = [], orderBytes32 = [], signaturesV = [], signaturesR = [], signaturesS = []
                    let debtor, version, beneficiary, underwriter, underwriterRiskRating, termsContract, salt, termsContractParameters,
                        relayer, creditor
                    let principalAmount, underwriterFee, relayerFee, creditorFee, debtorFee, expirationTimestampInSec
                    let agreementId
                    let debtOrderHash, debtorSig, creditorSig, underwriterSig, underWriterMessageHash
                    let principalTokenIndex , interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount , gracePeriodInDays
                    let tokenSymbol, tokenAddress, tokenName, numberOfDecimals, tokenIndex

                    it('Should setup the pre-reqs and invoke fillDebtOrder()', async () => {
                        //Arrange
                        debtor = borrowerInstance.address
                        version = accounts[8]
                        beneficiary = accounts[7]
                        underwriter = accounts[6]
                        relayer = accounts[5]
                        creditor = escrowInstance.address
                        underwriterRiskRating = demoValues.escrowTestCases.underwriterRiskRating

                        salt = demoValues.escrowTestCases.salt

                        underwriterFee = demoValues.escrowTestCases.underwriterFee
                        relayerFee = demoValues.escrowTestCases.relayerFee
                        creditorFee = demoValues.escrowTestCases.creditorFee
                        debtorFee = demoValues.escrowTestCases.debtorFee
                        expirationTimestampInSec = (await web3APIs.getLatestBlockTimestamp() + (demoValues.SECONDS_IN_DAY * demoValues.NO_OF_DAYS) ) //Setting expiratonTimestampInSec to be after 90 days
                        // console.log('Expiration timestamp in seconds: ', utils.timeStampToDate(expirationTimestampInSec))
                        await escrowInstance.setWhenToWithdrawTimestamp(expirationTimestampInSec)

                        tokenSymbol = await erc20TokenInstance.symbol.call()
                        tokenAddress = erc20TokenInstance.address
                        tokenName = await erc20TokenInstance.name.call()
                        numberOfDecimals = await erc20TokenInstance.decimals.call()

                        await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, { from: owner }) //adds the token to tokenRegistry
                        tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

                        principalAmount = demoValues.escrowTestCases.principalAmount
                        interestRate = demoValues.escrowTestCases.interestRate
                        amortizationUnit = demoValues.escrowTestCases.amortizationUnit
                        termLength = demoValues.escrowTestCases.termLength
                        collateralAmount = demoValues.escrowTestCases.collateralAmount
                        gracePeriodInDays = demoValues.escrowTestCases.gracePeriodInDays

                        principalTokenIndex = tokenIndex.toNumber()
                        collateralTokenIndex = principalTokenIndex

                        termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex,                                                                                                collateralAmount, gracePeriodInDays)
                        termsContract = collateralizedSimpleInterestTermsContractInstance.address

                        //Arrange orderAddresses array
                        orderAddresses.push(version)
                        orderAddresses.push(debtor)
                        orderAddresses.push(underwriter)
                        orderAddresses.push(termsContract)
                        orderAddresses.push(erc20TokenInstance.address) //BCToken address
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

                        //Transfer to creditor
                        // await erc20TokenInstance.transfer(creditor, 3000, {from: owner, gas: 3000000})

                        //Set the DebtToken
                        await debtKernelInstance.setDebtToken(debtTokenInstance.address, {from: owner, gas: 3000000})

                        //Set the EscrowRegistry
                        await debtKernelInstance.setEscrowRegistry(escrowRegistryInstance.address, {from: owner, gas: 3000000})

                        //Get agreementId
                        agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)

                        debtAgreementId = agreementId

                        debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5],orderAddresses[5], orderValues[4], orderValues[7])

                        //Transfer tokens
                        await erc20TokenInstance.transfer(debtor, demoValues.escrowTestCases.transferToDebtor, {from: owner, gas: 3000000})

                        // Approve to spend tokens on behalf of debtor
                        await borrowerInstance.approve(tokenTransferProxyInstance.address, demoValues.escrowTestCases.approvalFromDebtor, { from: owner, gas: 3000000 }) //Approve of Borrower.sol

                        //Checks whether debtor is an account address or a contract address
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

                        let fromAccount = accounts[3]

                        await escrowInstance.approve(tokenTransferProxyInstance.address, demoValues.escrowTestCases.approvalFromCreditor, {from: owner, gas: 3000000}) //Approve of Escrow.sol
                        await debtTokenInstance.addAuthorizedMintAgent(debtKernelInstance.address, {from: owner, gas: 3000000})
                        await debtRegistryInstance.addAuthorizedInsertAgent(debtTokenInstance.address, {from: owner, gas: 3000000})
                        await debtRegistryInstance.addAuthorizedEditAgent(debtTokenInstance.address, {from: owner, gas: 3000000})
                        await tokenTransferProxyInstance.addAuthorizedTransferAgent(debtKernelInstance.address, {from: owner, gas: 3000000})
                        //Adding line no 377 & 381 solved the revert issue
                        await collateralizerInstance.addAuthorizedCollateralizeAgent(collateralizedSimpleInterestTermsContractInstance.address, {
                            from: owner,
                            gas: 3000000
                        })
                        await tokenTransferProxyInstance.addAuthorizedTransferAgent(collateralizerInstance.address, {from: owner, gas: 3000000})

                        console.log('\tBalances before fillDebtOrder: \n')
                        let creditorBal, debtorBal, allowanceFromDebtor, allowanceFromCreditor
                        creditorBal = await erc20TokenInstance.balanceOf.call(creditor)
                        debtorBal = await erc20TokenInstance.balanceOf.call(debtor)
                        // escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address) // 2000
                        allowanceFromCreditor = await erc20TokenInstance.allowance.call(creditor, tokenTransferProxyInstance.address)
                        allowanceFromDebtor = await erc20TokenInstance.allowance.call(debtor, tokenTransferProxyInstance.address)
                        console.log('\t\tCreditor: ', creditorBal.toNumber())
                        console.log('\t\tDebtor: ', debtorBal.toNumber())
                        // console.log('\t\tEscrowContract: ', escrowBal.toNumber())
                        console.log('\t\tAllowance(creditor, tokenTransferProxy): ', allowanceFromCreditor.toNumber())
                        console.log('\t\tAllowance(debtor, tokenTransferProxy): ', allowanceFromDebtor.toNumber())


                        await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount, gas: 3000000})

                        //after successful execution of fillDebtOrder execute setScalingFactors of Escrow
                        let tenure = ((demoValues.escrowTestCases.noOfDays / 30 ) / 12)  * 10000
                        await escrowInstance.setScalingFactors(principalAmount, tenure, interestRate, creditor, {from: owner, gas: 3000000})


                        console.log('\n\tBalances after fillDebtOrder: \n')
                        creditorBal = await erc20TokenInstance.balanceOf.call(creditor) //2010
                        debtorBal = await erc20TokenInstance.balanceOf.call(debtor) // 3450
                        allowanceFromCreditor = await erc20TokenInstance.allowance.call(creditor, tokenTransferProxyInstance.address)
                        allowanceFromDebtor = await erc20TokenInstance.allowance.call(debtor, tokenTransferProxyInstance.address)
                        console.log('\t\tCreditor: ', creditorBal.toNumber())
                        console.log('\t\tDebtor: ', debtorBal.toNumber())
                        console.log('\t\tAllowance(creditor, tokenTransferProxy): ', allowanceFromCreditor.toNumber())
                        console.log('\t\tAllowance(debtor, tokenTransferProxy): ', allowanceFromDebtor.toNumber())
                        assert.equal(txObject.receipt.status, true, 'Error while invoking fillDebtOrder()')
                    })

                    it('Should check the loan state to be WaitForRepayment', async () => {
                        let loanState = await escrowInstance.getLenderState.call()
                        assert.equal(loanState.toNumber(), 2, 'Loan state do not match')
                    })

                    it('Should get the scalingFactors', async () => {
                        let scalingFactor = await escrowInstance.scalingFactorsOf.call(creditor)
                        console.log('\t\ttheoreticalScalingFactor: ', scalingFactor[0].toNumber())
                        console.log('\t\tactualScalingFactor: ', scalingFactor[1].toNumber())
                    })
                })
            })
            describe('Get EMI details and invoke repayments', () => {
                it('Should get the pre-reqs in place for repayment', async () => {
                    await erc20TokenInstance.transfer(borrowerInstance.address, 10, {from: owner, gas: 3000000})
                    await borrowerInstance.approve(tokenTransferProxyInstance.address, 2000, { from: owner, gas: 3000000 }) //Approve of Borrower.sol
                    await tokenTransferProxyInstance.addAuthorizedTransferAgent(repaymentRouterInstance.address, {from: owner, gas: 3000000}) //repaymentRouterAdd will be the msg.sender in TokenTransferProxy.transferFrom
                    // txObject =  await borrowerInstance.repay(debtAgreementId, 500, erc20TokenInstance.address, {from: owner, gas: 3000000})

                    // let debtorBal = await erc20TokenInstance.balanceOf.call(borrowerInstance.address)
                    // console.log('\t\tdebtorBal: ', debtorBal.toNumber())
                    //Get EMI Details
                    let emi = await borrowerInstance.getEmiDetails.call(debtAgreementId, demoValues.escrowTestCases.noOfDays)
                    console.log('\t\tEmi details are: ', '\n\t\tEmi Amount: ', emi[0].toNumber(), '\n\t\tNo of EMIs: ',emi[1].toNumber(),'\n\t\tEveryMonth Interest: ',emi[2].toNumber())

                    console.log('\t\tInitiating repayments: ')

                    txObject =  await borrowerInstance.repay(debtAgreementId, emi[0].toNumber(), erc20TokenInstance.address, {from: owner, gas: 3000000})

                    // debtorBal = await erc20TokenInstance.balanceOf.call(borrowerInstance.address)
                    // console.log('\t\tdebtorBal: ', debtorBal.toNumber())

                    let valueRepaidByBorrower = await borrowerInstance.getValueRepaidToDate.call(debtAgreementId)
                    console.log('\t\t\tTotal Value repaid after 1st EMI by the borrower: ', valueRepaidByBorrower.toNumber())

                    txObject =  await borrowerInstance.repay(debtAgreementId, emi[0].toNumber(), erc20TokenInstance.address, {from: owner, gas: 3000000})

                    // debtorBal = await erc20TokenInstance.balanceOf.call(borrowerInstance.address)
                    // console.log('\t\tdebtorBal: ', debtorBal.toNumber())

                    valueRepaidByBorrower = await borrowerInstance.getValueRepaidToDate.call(debtAgreementId)
                    console.log('\t\t\tTotal Value repaid after 2nd EMI by the borrower: ', valueRepaidByBorrower.toNumber())

                    txObject =  await borrowerInstance.repay(debtAgreementId, emi[0].toNumber(), erc20TokenInstance.address, {from: owner, gas: 3000000})
                    // debtorBal = await erc20TokenInstance.balanceOf.call(borrowerInstance.address)
                    // console.log('\t\tdebtorBal: ', debtorBal.toNumber())

                    // console.log(JSON.stringify(txObject))

                    valueRepaidByBorrower = await borrowerInstance.getValueRepaidToDate.call(debtAgreementId)
                    console.log('\t\t\tTotal Value repaid after 3rd EMI by the borrower: ', valueRepaidByBorrower.toNumber())

                    assert.equal(txObject.receipt.status, true, 'Failed successful execution f repay()')
                })

                it('Should check the loan state to be Withdraw', async () => {
                    let loanState = await escrowInstance.getLenderState.call()
                    assert.equal(loanState.toNumber(), 4, 'Loan state do not match')
                })
            })
            describe('function withdraw(address _payee) publicOwner', () => {
                describe('Check positive scenarios', () => {
                    let escrowBal, accBal
                    let depositor1 = accounts[1]
                    let depositor2 = accounts[2]
                    let depositor3 = accounts[3]
                    let depositor4 = accounts[4]
                    describe('Execute withdraw() successfully', () => {
                        it('Should execute withdraw() successfully', async () => {
                            txObject = await escrowInstance.withdraw(demoValues.escrowTestCases.principalAmount, {from: owner, gas: 3000000})
                            assert.equal(txObject.receipt.status, true, 'Error while executing withdraw()')
                        })
                    })

                    describe('Check withdraw() is executed as expected', () => {
                        it('Should check the escrow balance to be 1', async () => {
                            let bal
                            escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address)
                            console.log('\t\tescrowBal: ', escrowBal.toNumber())

                            bal = await erc20TokenInstance.balanceOf.call(depositor1)
                            console.log('\t\tdepositor1Bal: ', bal.toNumber())

                            bal = await erc20TokenInstance.balanceOf.call(depositor2)
                            console.log('\t\tdepositor2Bal: ', bal.toNumber())

                            bal = await erc20TokenInstance.balanceOf.call(depositor3)
                            console.log('\t\tdepositor3Bal: ', bal.toNumber())

                            bal = await erc20TokenInstance.balanceOf.call(depositor4)
                            console.log('\t\tdepositor4Bal: ', bal.toNumber())


                            escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address)
                            console.log('\t\tBalance of escrow contract after withdrawal: ', escrowBal.toNumber())
                            assert.equal(escrowBal.toNumber(), 42, 'Escrow contract balances do not match')
                        })

                        it('Should check the depositor1"s balance to be 999', async () => {
                            accBal = await erc20TokenInstance.balanceOf.call(depositor1)
                            assert.equal(accBal.toNumber(), 999, 'accounts[1] balances do not match') //since depositor1 had 1000 bal and withdrawn 2100 from escrow
                        })

                        //For depositor2, r and 4
                        it('Should check the depositor2"s balance to be 999', async () => {
                            accBal = await erc20TokenInstance.balanceOf.call(depositor2)
                            assert.equal(accBal.toNumber(), 999, 'accounts[2] balances do not match') //since depositor1 had 1000 bal and withdrawn 2100 from escrow
                        })

                        it('Should check the depositor3"s balance to be 999', async () => {
                            accBal = await erc20TokenInstance.balanceOf.call(depositor3)
                            assert.equal(accBal.toNumber(), 999, 'accounts[1] balances do not match') //since depositor1 had 1000 bal and withdrawn 2100 from escrow
                        })

                        it('Should check the depositor4"s balance to be 999', async () => {
                            accBal = await erc20TokenInstance.balanceOf.call(depositor4)
                            assert.equal(accBal.toNumber(), 999, 'accounts[1] balances do not match') //since depositor1 had 1000 bal and withdrawn 2100 from escrow
                        })

                        it('Should check the loan state to be Closed', async () => {
                            let loanState = await escrowInstance.getLenderState.call()
                            assert.equal(loanState.toNumber(), 5, 'Loan state do not match')
                        })

                        it('Should get the scalingFactors', async () => {
                            let scalingFactor = await escrowInstance.getScalingFactorsOf.call(escrowInstance.address)
                            console.log('\t\ttheoreticalScalingFactor: ', scalingFactor[0].toNumber())
                            console.log('\t\tactualScalingFactor: ', scalingFactor[1].toNumber())
                        })

                    })
                    describe('Check for events emitted by withdraw()', () => {
                        it('Should check for Withdrawn event', async () => {
                            // console.log('Stringified JSON of txObject: ', JSON.stringify(txObject))
                            let emittedEventArray = [
                                {
                                    event: 'Withdrawn',
                                    args: {
                                        0: depositor1,
                                        1: 499,
                                        2: txObject.logs[0].args[2].toNumber(),
                                        3: escrowInstance.address,
                                        __length__: 4,
                                        payee: depositor1,
                                        tokenAmount: 499,
                                        timestamp: txObject.logs[0].args[2].toNumber(),
                                        escrow: escrowInstance.address
                                    }
                                },
                                {
                                    event: 'Withdrawn',
                                    args: {
                                        0 : depositor2,
                                        1 : 499,
                                        2: txObject.logs[1].args[2].toNumber(),
                                        3: escrowInstance.address,
                                        __length__ : 4,
                                        payee : depositor2,
                                        tokenAmount : 499,
                                        timestamp: txObject.logs[1].args[2].toNumber(),
                                        escrow: escrowInstance.address
                                    }
                                },
                                {
                                    event: 'Withdrawn',
                                    args: {
                                        0 : depositor3,
                                        1 : 499,
                                        2: txObject.logs[2].args[2].toNumber(),
                                        3: escrowInstance.address,
                                        __length__ : 4,
                                        payee : depositor3,
                                        tokenAmount : 499,
                                        timestamp: txObject.logs[2].args[2].toNumber(),
                                        escrow: escrowInstance.address
                                    }
                                },
                                {
                                    event: 'Withdrawn',
                                    args: {
                                        0 : depositor4,
                                        1 : 499,
                                        2: txObject.logs[3].args[2].toNumber(),
                                        3: escrowInstance.address,
                                        __length__ : 4,
                                        payee : depositor4,
                                        tokenAmount : 499,
                                        timestamp: txObject.logs[3].args[2].toNumber(),
                                        escrow: escrowInstance.address
                                    }
                                }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events emitted by withdraw() do not match')
                        })
                    })
                })
            })
        })

        describe('\n\n\nTest case covering 4 depositors with Part Payment Invocation and then final withdraw', () => {
            //Again deploy the contract to get the clean state
            before(async() => {
                owner = accounts[0]
                erc20TokenInstance = await BCToken.new({from: owner})
                erc20TokenAddress = erc20TokenInstance.address
                debtRegistryInstance = await DebtRegistry.new({from: owner})
                debtTokenInstance = await DebtToken.new(debtRegistryInstance.address, {from: owner})
                escrowRegistryInstance = await EscrowRegistry.new({from: owner})
                escrowInstance = await Escrow.new(erc20TokenAddress, debtTokenInstance.address, debtRegistryInstance.address, escrowRegistryInstance.address, fixedDepositAmount, {from: owner})
                tokenTransferProxyInstance = await TokenTransferProxy.new({from: owner})
                tokenRegistryInstance = await TokenRegistry.new({ from: owner })
                debtKernelInstance = await DebtKernel.new(tokenTransferProxyInstance.address, {from: owner})
                repaymentRouterInstance = await RepaymentRouter.new(debtRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
                collateralizerInstance = await Collateralizer.new(debtKernelInstance.address, debtRegistryInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address)
                contractRegistryInstance = await ContractRegistry.new(collateralizerInstance.address, debtKernelInstance.address, debtRegistryInstance.address, debtTokenInstance.address,                                                          repaymentRouterInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
                collateralizedSimpleInterestTermsContractInstance = await CollateralizedSimpleInterestTermsContract.new(contractRegistryInstance.address, {from: owner})
                borrowerInstance = await Borrower.new(erc20TokenInstance.address, debtRegistryInstance.address, collateralizedSimpleInterestTermsContractInstance.address, escrowRegistryInstance.address, repaymentRouterInstance.address, {from: owner})

            })
            describe('Deposit into the escrow', () => {
                let depositor1 = accounts[1]
                let depositor2 = accounts[2]
                let depositor3 = accounts[3]
                let depositor4 = accounts[4]

                describe('Depositing starts', async () => {
                    let eachDepositorDeposits = demoValues.escrowTestCases.individualDeposits
                    let beforeDepositingBalDepositor1 , beforeDepositingBalDepositor2, beforeDepositingBalDepositor3, beforeDepositingBalDepositor4
                    let deposit1 = eachDepositorDeposits , deposit2 = eachDepositorDeposits, deposit3 = eachDepositorDeposits, deposit4 = eachDepositorDeposits
                    describe('Execute deposit() successfully', async () => {
                        it('Should execute deposit() successfully', async () => {

                            //Pre-reqs
                            await erc20TokenInstance.transfer(depositor1, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})
                            await erc20TokenInstance.transfer(depositor2, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})
                            await erc20TokenInstance.transfer(depositor3, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})
                            await erc20TokenInstance.transfer(depositor4, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})

                            //Allowance
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor1, gas: 3000000})
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor2, gas: 3000000})
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor3, gas: 3000000})
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor4, gas: 3000000})

                            beforeDepositingBalDepositor1 = await erc20TokenInstance.balanceOf.call(depositor1)
                            beforeDepositingBalDepositor2 = await erc20TokenInstance.balanceOf.call(depositor2)
                            beforeDepositingBalDepositor3 = await erc20TokenInstance.balanceOf.call(depositor3)
                            beforeDepositingBalDepositor4 = await erc20TokenInstance.balanceOf.call(depositor4)


                            await escrowInstance.deposit(deposit1, {from: depositor1, gas: 3000000})
                            await escrowInstance.deposit(deposit2, {from: depositor2, gas: 3000000})
                            await escrowInstance.deposit(deposit3, {from: depositor3, gas: 3000000})

                            txObject =  await escrowInstance.deposit(deposit4, {from: depositor4, gas: 3000000}) //However in this case only 1 token will be deposited
                            assert.equal(txObject.receipt.status, true, 'Error while executing deposit()')
                        })
                    })

                })
            })
            describe('Change escrow state to MakeLoan', () => {
                describe('Escrow state to be MakeLoan', async () => {
                    it('Should invoke makeLoan() & set the lender attributes in EscrowRegistry', async () => {
                        let regulator = accounts[7]
                        let debtor =  borrowerInstance.address
                        //pre-reqs
                        await escrowRegistryInstance.addRegulator(escrowInstance.address, {from: owner, gas: 3000000})
                        //Also borrower should be in a state of accepting the loan
                        //Add a regulator s.t. the regulator can invoke the setBorrowerAttributes
                        await escrowRegistryInstance.addRegulator(regulator, {from: owner, gas: 3000000})
                        await escrowRegistryInstance.setBorrowerAttributes(debtor, demoValues.escrowTestCases.borrowableAmount, {from: regulator, gas: 3000000})

                        txObject = await escrowInstance.makeLoan({from: owner, gas: 3000000})
                        assert.equal(txObject.receipt.status, true, "Failure while invoking makeLoan()")

                    })
                })

                describe('Execute fillDebtOrder() of debtKernel with creditor  & debtor both being contract addresses', () => {
                    let orderAddresses = [], orderValues = [], orderBytes32 = [], signaturesV = [], signaturesR = [], signaturesS = []
                    let debtor, version, beneficiary, underwriter, underwriterRiskRating, termsContract, salt, termsContractParameters,
                        relayer, creditor
                    let principalAmount, underwriterFee, relayerFee, creditorFee, debtorFee, expirationTimestampInSec
                    let agreementId
                    let debtOrderHash, debtorSig, creditorSig, underwriterSig, underWriterMessageHash
                    let principalTokenIndex , interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount , gracePeriodInDays
                    let tokenSymbol, tokenAddress, tokenName, numberOfDecimals, tokenIndex

                    it('Should setup the pre-reqs and invoke fillDebtOrder()', async () => {
                        //Arrange
                        debtor = borrowerInstance.address
                        version = accounts[8]
                        beneficiary = accounts[7]
                        underwriter = accounts[6]
                        relayer = accounts[5]
                        creditor = escrowInstance.address
                        underwriterRiskRating = demoValues.escrowTestCases.underwriterRiskRating

                        salt = demoValues.escrowTestCases.salt

                        underwriterFee = demoValues.escrowTestCases.underwriterFee
                        relayerFee = demoValues.escrowTestCases.relayerFee
                        creditorFee = demoValues.escrowTestCases.creditorFee
                        debtorFee = demoValues.escrowTestCases.debtorFee
                        expirationTimestampInSec = (await web3APIs.getLatestBlockTimestamp() + (demoValues.SECONDS_IN_DAY * demoValues.NO_OF_DAYS) ) //Setting expiratonTimestampInSec to be after 90 days
                        // console.log('Expiration timestamp in seconds: ', utils.timeStampToDate(expirationTimestampInSec))
                        await escrowInstance.setWhenToWithdrawTimestamp(expirationTimestampInSec)
                        // console.log('When withdrawal will be allowed from escrow: ',utils.timeStampToDate((await escrowInstance.getWhenToWithdrawTimestamp.call()).toNumber()))

                        tokenSymbol = await erc20TokenInstance.symbol.call()
                        tokenAddress = erc20TokenInstance.address
                        tokenName = await erc20TokenInstance.name.call()
                        numberOfDecimals = await erc20TokenInstance.decimals.call()

                        await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, { from: owner }) //adds the token to tokenRegistry
                        tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

                        principalAmount = demoValues.escrowTestCases.principalAmount
                        interestRate = demoValues.escrowTestCases.interestRate
                        amortizationUnit = demoValues.escrowTestCases.amortizationUnit
                        termLength = demoValues.escrowTestCases.termLength
                        collateralAmount = demoValues.escrowTestCases.collateralAmount
                        gracePeriodInDays = demoValues.escrowTestCases.gracePeriodInDays

                        principalTokenIndex = tokenIndex.toNumber()
                        collateralTokenIndex = principalTokenIndex

                        termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex,                                                                                                collateralAmount, gracePeriodInDays)
                        termsContract = collateralizedSimpleInterestTermsContractInstance.address

                        //Arrange orderAddresses array
                        orderAddresses.push(version)
                        orderAddresses.push(debtor)
                        orderAddresses.push(underwriter)
                        orderAddresses.push(termsContract)
                        orderAddresses.push(erc20TokenInstance.address) //BCToken address
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

                        //Transfer to creditor
                        // await erc20TokenInstance.transfer(creditor, 3000, {from: owner, gas: 3000000})

                        //Set the DebtToken
                        await debtKernelInstance.setDebtToken(debtTokenInstance.address, {from: owner, gas: 3000000})

                        //Set the EscrowRegistry
                        await debtKernelInstance.setEscrowRegistry(escrowRegistryInstance.address, {from: owner, gas: 3000000})

                        //Get agreementId
                        agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)

                        debtAgreementId = agreementId

                        debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5],orderAddresses[5], orderValues[4], orderValues[7])

                        //Transfer tokens
                        await erc20TokenInstance.transfer(debtor, demoValues.escrowTestCases.transferToDebtor, {from: owner, gas: 3000000})

                        // Approve to spend tokens on behalf of debtor
                        await borrowerInstance.approve(tokenTransferProxyInstance.address, demoValues.escrowTestCases.approvalFromDebtor, { from: owner, gas: 3000000 }) //Approve of Borrower.sol

                        //Checks whether debtor is an account address or a contract address
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

                        let fromAccount = accounts[3]

                        await escrowInstance.approve(tokenTransferProxyInstance.address, demoValues.escrowTestCases.approvalFromCreditor, {from: owner, gas: 3000000}) //Approve of Escrow.sol
                        await debtTokenInstance.addAuthorizedMintAgent(debtKernelInstance.address, {from: owner, gas: 3000000})
                        await debtRegistryInstance.addAuthorizedInsertAgent(debtTokenInstance.address, {from: owner, gas: 3000000})
                        await debtRegistryInstance.addAuthorizedEditAgent(debtTokenInstance.address, {from: owner, gas: 3000000})
                        await tokenTransferProxyInstance.addAuthorizedTransferAgent(debtKernelInstance.address, {from: owner, gas: 3000000})
                        //Adding line no 377 & 381 solved the revert issue
                        await collateralizerInstance.addAuthorizedCollateralizeAgent(collateralizedSimpleInterestTermsContractInstance.address, {
                            from: owner,
                            gas: 3000000
                        })
                        await tokenTransferProxyInstance.addAuthorizedTransferAgent(collateralizerInstance.address, {from: owner, gas: 3000000})

                        console.log('\tBalances before fillDebtOrder: \n')
                        let creditorBal, debtorBal, allowanceFromDebtor, allowanceFromCreditor
                        creditorBal = await erc20TokenInstance.balanceOf.call(creditor)
                        debtorBal = await erc20TokenInstance.balanceOf.call(debtor)
                        // escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address) // 2000
                        allowanceFromCreditor = await erc20TokenInstance.allowance.call(creditor, tokenTransferProxyInstance.address)
                        allowanceFromDebtor = await erc20TokenInstance.allowance.call(debtor, tokenTransferProxyInstance.address)
                        console.log('\t\tCreditor: ', creditorBal.toNumber())
                        console.log('\t\tDebtor: ', debtorBal.toNumber())
                        // console.log('\t\tEscrowContract: ', escrowBal.toNumber())
                        console.log('\t\tAllowance(creditor, tokenTransferProxy): ', allowanceFromCreditor.toNumber())
                        console.log('\t\tAllowance(debtor, tokenTransferProxy): ', allowanceFromDebtor.toNumber())


                        await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount, gas: 3000000})

                        //after successful execution of fillDebtOrder execute setScalingFactors of Escrow
                        let tenure = ((demoValues.escrowTestCases.noOfDays / 30) / 12) * 10000
                        await escrowInstance.setScalingFactors(principalAmount, tenure, interestRate, creditor, {from: owner, gas: 3000000})
                        // await escrowInstance.setRepaymentValue(principalAmount, tenure, interestRate, {from: owner, gas: 3000000})


                        console.log('\n\tBalances after fillDebtOrder: \n')
                        creditorBal = await erc20TokenInstance.balanceOf.call(creditor) //2010
                        debtorBal = await erc20TokenInstance.balanceOf.call(debtor) // 3450
                        // escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address) // 0
                        allowanceFromCreditor = await erc20TokenInstance.allowance.call(creditor, tokenTransferProxyInstance.address)
                        allowanceFromDebtor = await erc20TokenInstance.allowance.call(debtor, tokenTransferProxyInstance.address)
                        console.log('\t\tCreditor: ', creditorBal.toNumber())
                        console.log('\t\tDebtor: ', debtorBal.toNumber())
                        // console.log('\t\tEscrowContract: ', escrowBal.toNumber())
                        console.log('\t\tAllowance(creditor, tokenTransferProxy): ', allowanceFromCreditor.toNumber())
                        console.log('\t\tAllowance(debtor, tokenTransferProxy): ', allowanceFromDebtor.toNumber())
                        assert.equal(txObject.receipt.status, true, 'Error while invoking fillDebtOrder()')
                    })

                    it('Should get the scalingFactors', async () => {
                        let scalingFactor = await escrowInstance.scalingFactorsOf.call(creditor)
                        console.log('\t\ttheoreticalScalingFactor: ', scalingFactor[0].toNumber())
                        console.log('\t\tactualScalingFactor: ', scalingFactor[1].toNumber())
                    })
                })
            })
            describe('Get EMI details and invoke repayments and invoke withdraw', () => {
                let depositor1 = accounts[1]
                let depositor2 = accounts[2]
                let depositor3 = accounts[3]
                let depositor4 = accounts[4]

                it('Should get the pre-reqs in place for repayment', async () => {
                    await erc20TokenInstance.transfer(borrowerInstance.address, 10, {from: owner, gas: 3000000})
                    await borrowerInstance.approve(tokenTransferProxyInstance.address, 2000, { from: owner, gas: 3000000 }) //Approve of Borrower.sol
                    await tokenTransferProxyInstance.addAuthorizedTransferAgent(repaymentRouterInstance.address, {from: owner, gas: 3000000}) //repaymentRouterAdd will be the msg.sender in TokenTransferProxy.transferFrom
                    // txObject =  await borrowerInstance.repay(debtAgreementId, 500, erc20TokenInstance.address, {from: owner, gas: 3000000})

                    // let debtorBal = await erc20TokenInstance.balanceOf.call(borrowerInstance.address)
                    // console.log('\t\tdebtorBal: ', debtorBal.toNumber())
                    //Get EMI Details
                    let emi = await borrowerInstance.getEmiDetails.call(debtAgreementId, demoValues.escrowTestCases.noOfDays)
                    console.log('\t\tEmi details are: ', '\n\t\tEmi Amount: ', emi[0].toNumber(), '\n\t\tNo of EMIs: ',emi[1].toNumber(),'\n\t\tEveryMonth Interest: ',emi[2].toNumber())

                    console.log('\t\tInitiating repayments and invoking withdraw() after that: ')

                    let loanState = await escrowInstance.getLenderState.call()
                    console.log('\t\tloanState: ', loanState.toNumber())

                    let repaidValue = await escrowInstance.getValueRepaidTillNow()//.toNumber()
                    console.log('\t\tValue repaid tll now to escrow initially: ', repaidValue.toNumber())

                    txObject =  await borrowerInstance.repay(debtAgreementId, emi[0].toNumber(), erc20TokenInstance.address, {from: owner, gas: 3000000})

                    repaidValue = await escrowInstance.getValueRepaidTillNow()//.toNumber()
                    console.log('\t\tValue repaid tll now to escrow after 1st repayment: ', repaidValue.toNumber())


                    await escrowInstance.withdraw(demoValues.escrowTestCases.principalAmount, {from: owner, gas: 3000000})

                    repaidValue = await escrowInstance.getValueRepaidTillNow()//.toNumber()
                    console.log('\t\tValue repaid tll now to escrow after 1st withdrawal: ', repaidValue.toNumber())
                    // console.log(JSON.stringify(ret))

                    loanState = await escrowInstance.getLenderState.call()
                    console.log('\t\tloanState: ', loanState.toNumber())

                    let valueRepaidByBorrower = await borrowerInstance.getValueRepaidToDate.call(debtAgreementId)
                    console.log('\t\t\tTotal Value repaid after 1st EMI by the borrower: ', valueRepaidByBorrower.toNumber())

                    let bal
                    bal = await erc20TokenInstance.balanceOf.call(depositor1)
                    console.log('\t\tdepositor1Bal: ', bal.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor2)
                    console.log('\t\tdepositor2Bal: ', bal.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor3)
                    console.log('\t\tdepositor3Bal: ', bal.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor4)
                    console.log('\t\tdepositor4Bal: ', bal.toNumber())



                    txObject =  await borrowerInstance.repay(debtAgreementId, emi[0].toNumber(), erc20TokenInstance.address, {from: owner, gas: 3000000})
                    repaidValue = await escrowInstance.getValueRepaidTillNow()//.toNumber()
                    console.log('\t\tValue repaid tll now to escrow after 2nd repayment: ', repaidValue.toNumber())


                    await escrowInstance.withdraw(demoValues.escrowTestCases.principalAmount, {from: owner, gas: 3000000})

                    repaidValue = await escrowInstance.getValueRepaidTillNow()//.toNumber()
                    console.log('\t\tValue repaid tll now to escrow after 2nd withdrawal: ', repaidValue.toNumber())

                    // console.log(JSON.stringify(ret))

                    loanState = await escrowInstance.getLenderState.call()
                    console.log('\t\tloanState: ', loanState.toNumber())

                    valueRepaidByBorrower = await borrowerInstance.getValueRepaidToDate.call(debtAgreementId)
                    console.log('\t\t\tTotal Value repaid after 2nd EMI by the borrower: ', valueRepaidByBorrower.toNumber())

                    // repaidValue = await escrowInstance.getValueRepaidTillNow()//.toNumber()
                    // console.log('\t\tValue repaid tll now to escrow after 2nd repayment: ', repaidValue.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor1)
                    console.log('\t\tdepositor1Bal: ', bal.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor2)
                    console.log('\t\tdepositor2Bal: ', bal.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor3)
                    console.log('\t\tdepositor3Bal: ', bal.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor4)
                    console.log('\t\tdepositor4Bal: ', bal.toNumber())



                    txObject =  await borrowerInstance.repay(debtAgreementId, emi[0].toNumber(), erc20TokenInstance.address, {from: owner, gas: 3000000})
                    repaidValue = await escrowInstance.getValueRepaidTillNow()//.toNumber()
                    console.log('\t\tValue repaid tll now to escrow after 3rd repayment: ', repaidValue.toNumber())

                    loanState = await escrowInstance.getLenderState.call()
                    console.log('\t\tloanState: ', loanState.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(escrowInstance.address)
                    console.log('\t\tEscrowBalance: ', bal.toNumber())

                    // bal = await escrowInstance.getAllDeposits(depositors)
                    // console.log('All deposits of the depositors: ', bal.toNumber())

                    console.log('\t\tWithdrawal amounts till now: ')
                    let wAmount = await escrowInstance.getWithdrawalAmount(depositor1)
                    console.log('\t\tWithdrawal amount: ', wAmount.toNumber())

                    await escrowInstance.withdraw(demoValues.escrowTestCases.principalAmount, {from: owner, gas: 3000000})

                    repaidValue = await escrowInstance.getValueRepaidTillNow()//.toNumber()
                    console.log('\t\tValue repaid tll now to escrow after 3rd withdrawal: ', repaidValue.toNumber())
                    // console.log(JSON.stringify(ret))

                    loanState = await escrowInstance.getLenderState.call()
                    console.log('\t\tloanState: ', loanState.toNumber())

                    valueRepaidByBorrower = await borrowerInstance.getValueRepaidToDate.call(debtAgreementId)
                    console.log('\t\t\tTotal Value repaid after 3rd EMI by the borrower: ', valueRepaidByBorrower.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor1)
                    console.log('\t\tdepositor1Bal: ', bal.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor2)
                    console.log('\t\tdepositor2Bal: ', bal.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor3)
                    console.log('\t\tdepositor3Bal: ', bal.toNumber())

                    bal = await erc20TokenInstance.balanceOf.call(depositor4)
                    console.log('\t\tdepositor4Bal: ', bal.toNumber())

                    repaidValue = await escrowInstance.getValueRepaidTillNow()//.toNumber()
                    console.log('\t\tValue repaid tll now to Escrow after 3rd repayment: ', repaidValue.toNumber())

                    assert.equal(txObject.receipt.status, true, 'Failed successful execution f repay()')
                })

            })

            describe('Check withdraw() is executed as expected', () => {
                it('Should get the scalingFactors', async () => {
                    let scalingFactor = await escrowInstance.getScalingFactorsOf.call(escrowInstance.address)
                    console.log('\t\ttheoreticalScalingFactor: ', scalingFactor[0].toNumber())
                    console.log('\t\tactualScalingFactor: ', scalingFactor[1].toNumber())
                })
            })

        })

        describe('\n\n\nTest case covering 4 depositors, borrower pays only the  principal and not the interest and then final withdraw', () => {
            //Again deploy the contract to get the clean state
            before(async() => {
                owner = accounts[0]
                erc20TokenInstance = await BCToken.new({from: owner})
                erc20TokenAddress = erc20TokenInstance.address
                debtRegistryInstance = await DebtRegistry.new({from: owner})
                debtTokenInstance = await DebtToken.new(debtRegistryInstance.address, {from: owner})
                escrowRegistryInstance = await EscrowRegistry.new({from: owner})
                escrowInstance = await Escrow.new(erc20TokenAddress, debtTokenInstance.address, debtRegistryInstance.address, escrowRegistryInstance.address, fixedDepositAmount, {from: owner})
                tokenTransferProxyInstance = await TokenTransferProxy.new({from: owner})
                tokenRegistryInstance = await TokenRegistry.new({ from: owner })
                debtKernelInstance = await DebtKernel.new(tokenTransferProxyInstance.address, {from: owner})
                repaymentRouterInstance = await RepaymentRouter.new(debtRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
                collateralizerInstance = await Collateralizer.new(debtKernelInstance.address, debtRegistryInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address)
                contractRegistryInstance = await ContractRegistry.new(collateralizerInstance.address, debtKernelInstance.address, debtRegistryInstance.address, debtTokenInstance.address,                                                          repaymentRouterInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
                collateralizedSimpleInterestTermsContractInstance = await CollateralizedSimpleInterestTermsContract.new(contractRegistryInstance.address, {from: owner})
                borrowerInstance = await Borrower.new(erc20TokenInstance.address, debtRegistryInstance.address, collateralizedSimpleInterestTermsContractInstance.address, escrowRegistryInstance.address, repaymentRouterInstance.address, {from: owner})

            })
            describe('Deposit tokens in the escrow', () => {
                let depositor1 = accounts[1]
                let depositor2 = accounts[2]
                let depositor3 = accounts[3]
                let depositor4 = accounts[4]

                describe('Tokens deposited by 4 depositors', () => {
                    let eachDepositorDeposits = demoValues.escrowTestCases.individualDeposits
                    let beforeDepositingBalDepositor1 , beforeDepositingBalDepositor2, beforeDepositingBalDepositor3, beforeDepositingBalDepositor4
                    let deposit1 = eachDepositorDeposits , deposit2 = eachDepositorDeposits, deposit3 = eachDepositorDeposits, deposit4 = eachDepositorDeposits
                    describe('Execute deposit() successfully', () => {
                        it('Should execute deposit() successfully', async () => {

                            //Pre-reqs
                            await erc20TokenInstance.transfer(depositor1, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})
                            await erc20TokenInstance.transfer(depositor2, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})
                            await erc20TokenInstance.transfer(depositor3, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})
                            await erc20TokenInstance.transfer(depositor4, demoValues.escrowTestCases.transferToDepositors, {from: owner, gas: 3000000})

                            //Allowance
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor1, gas: 3000000})
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor2, gas: 3000000})
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor3, gas: 3000000})
                            await erc20TokenInstance.approve(escrowInstance.address, demoValues.escrowTestCases.approvalFromDepositors, {from: depositor4, gas: 3000000})

                            beforeDepositingBalDepositor1 = await erc20TokenInstance.balanceOf.call(depositor1)
                            beforeDepositingBalDepositor2 = await erc20TokenInstance.balanceOf.call(depositor2)
                            beforeDepositingBalDepositor3 = await erc20TokenInstance.balanceOf.call(depositor3)
                            beforeDepositingBalDepositor4 = await erc20TokenInstance.balanceOf.call(depositor4)


                            await escrowInstance.deposit(deposit1, {from: depositor1, gas: 3000000})
                            await escrowInstance.deposit(deposit2, {from: depositor2, gas: 3000000})
                            await escrowInstance.deposit(deposit3, {from: depositor3, gas: 3000000})

                            txObject =  await escrowInstance.deposit(deposit4, {from: depositor4, gas: 3000000}) //However in this case only 1 token will be deposited
                            assert.equal(txObject.receipt.status, true, 'Error while executing deposit()')
                        })
                    })

                })
            })
            describe('Set borrower & lender attributes', () => {
                describe('Setting the borrower & lender attributes...', () => {
                    it('Should invoke makeLoan() & set the lender attributes in EscrowRegistry', async () => {
                        let regulator = accounts[7]
                        let debtor =  borrowerInstance.address
                        //pre-reqs
                        await escrowRegistryInstance.addRegulator(escrowInstance.address, {from: owner, gas: 3000000})
                        //Also borrower should be in a state of accepting the loan
                        //Add a regulator s.t. the regulator can invoke the setBorrowerAttributes
                        await escrowRegistryInstance.addRegulator(regulator, {from: owner, gas: 3000000})
                        await escrowRegistryInstance.setBorrowerAttributes(debtor, demoValues.escrowTestCases.borrowableAmount, {from: regulator, gas: 3000000})

                        //Now setBorrowState will succeed
                        // await borrowerInstance.setBorrowState(debtor, demoValues.escrowTestCases.principalAmount, {from: owner, gas: 3000000})

                        //Now both the creditor and borrower are in a state of accepting and granting loan
                        txObject = await escrowInstance.makeLoan({from: owner, gas: 3000000})
                        assert.equal(txObject.receipt.status, true, "Failure while invoking makeLoan()")

                    })
                })

                describe('Execute fillDebtOrder() of debtKernel with creditor  & debtor both being contract addresses', () => {
                    let orderAddresses = [], orderValues = [], orderBytes32 = [], signaturesV = [], signaturesR = [], signaturesS = []
                    let debtor, version, beneficiary, underwriter, underwriterRiskRating, termsContract, salt, termsContractParameters,
                        relayer, creditor
                    let principalAmount, underwriterFee, relayerFee, creditorFee, debtorFee, expirationTimestampInSec
                    let agreementId
                    let debtOrderHash, debtorSig, creditorSig, underwriterSig, underWriterMessageHash
                    let principalTokenIndex , interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount , gracePeriodInDays
                    let tokenSymbol, tokenAddress, tokenName, numberOfDecimals, tokenIndex

                    it('Should setup the pre-reqs and invoke fillDebtOrder()', async () => {
                        //Arrange
                        debtor = borrowerInstance.address
                        version = accounts[8]
                        beneficiary = accounts[7]
                        underwriter = accounts[6]
                        relayer = accounts[5]
                        creditor = escrowInstance.address
                        underwriterRiskRating = demoValues.escrowTestCases.underwriterRiskRating

                        salt = demoValues.escrowTestCases.salt

                        underwriterFee = demoValues.escrowTestCases.underwriterFee
                        relayerFee = demoValues.escrowTestCases.relayerFee
                        creditorFee = demoValues.escrowTestCases.creditorFee
                        debtorFee = demoValues.escrowTestCases.debtorFee
                        expirationTimestampInSec = (await web3APIs.getLatestBlockTimestamp() + (demoValues.SECONDS_IN_DAY * demoValues.NO_OF_DAYS) ) //Setting expirationTimestampInSec to be after 90 days
                        // console.log('Expiration timestamp in seconds: ', utils.timeStampToDate(expirationTimestampInSec))
                        await escrowInstance.setWhenToWithdrawTimestamp(expirationTimestampInSec)

                        tokenSymbol = await erc20TokenInstance.symbol.call()
                        tokenAddress = erc20TokenInstance.address
                        tokenName = await erc20TokenInstance.name.call()
                        numberOfDecimals = await erc20TokenInstance.decimals.call()

                        await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, { from: owner }) //adds the token to tokenRegistry
                        tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

                        principalAmount = demoValues.escrowTestCases.principalAmount
                        interestRate = demoValues.escrowTestCases.interestRate
                        amortizationUnit = demoValues.escrowTestCases.amortizationUnit
                        termLength = demoValues.escrowTestCases.termLength
                        collateralAmount = demoValues.escrowTestCases.collateralAmount
                        gracePeriodInDays = demoValues.escrowTestCases.gracePeriodInDays

                        principalTokenIndex = tokenIndex.toNumber()
                        collateralTokenIndex = principalTokenIndex

                        termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex,                                                                                                collateralAmount, gracePeriodInDays)
                        termsContract = collateralizedSimpleInterestTermsContractInstance.address

                        //Arrange orderAddresses array
                        orderAddresses.push(version)
                        orderAddresses.push(debtor)
                        orderAddresses.push(underwriter)
                        orderAddresses.push(termsContract)
                        orderAddresses.push(erc20TokenInstance.address) //BCToken address
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

                        //Transfer to creditor
                        // await erc20TokenInstance.transfer(creditor, 3000, {from: owner, gas: 3000000})

                        //Set the DebtToken
                        await debtKernelInstance.setDebtToken(debtTokenInstance.address, {from: owner, gas: 3000000})

                        //Set the EscrowRegistry
                        await debtKernelInstance.setEscrowRegistry(escrowRegistryInstance.address, {from: owner, gas: 3000000})

                        //Get agreementId
                        agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)

                        debtAgreementId = agreementId

                        debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5],orderAddresses[5], orderValues[4], orderValues[7])

                        //Transfer tokens
                        await erc20TokenInstance.transfer(debtor, demoValues.escrowTestCases.transferToDebtor, {from: owner, gas: 3000000})

                        // Approve to spend tokens on behalf of debtor
                        await borrowerInstance.approve(tokenTransferProxyInstance.address, demoValues.escrowTestCases.approvalFromDebtor, { from: owner, gas: 3000000 }) //Approve of Borrower.sol

                        //Checks whether debtor is an account address or a contract address
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

                        let fromAccount = accounts[3]

                        await escrowInstance.approve(tokenTransferProxyInstance.address, demoValues.escrowTestCases.approvalFromCreditor, {from: owner, gas: 3000000}) //Approve of Escrow.sol
                        await debtTokenInstance.addAuthorizedMintAgent(debtKernelInstance.address, {from: owner, gas: 3000000})
                        await debtRegistryInstance.addAuthorizedInsertAgent(debtTokenInstance.address, {from: owner, gas: 3000000})
                        await debtRegistryInstance.addAuthorizedEditAgent(debtTokenInstance.address, {from: owner, gas: 3000000})
                        await tokenTransferProxyInstance.addAuthorizedTransferAgent(debtKernelInstance.address, {from: owner, gas: 3000000})
                        //Adding line no 377 & 381 solved the revert issue
                        await collateralizerInstance.addAuthorizedCollateralizeAgent(collateralizedSimpleInterestTermsContractInstance.address, {
                            from: owner,
                            gas: 3000000
                        })
                        await tokenTransferProxyInstance.addAuthorizedTransferAgent(collateralizerInstance.address, {from: owner, gas: 3000000})

                        console.log('\tBalances before fillDebtOrder: \n')
                        let creditorBal, debtorBal, allowanceFromDebtor, allowanceFromCreditor
                        creditorBal = await erc20TokenInstance.balanceOf.call(creditor)
                        debtorBal = await erc20TokenInstance.balanceOf.call(debtor)
                        // escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address) // 2000
                        allowanceFromCreditor = await erc20TokenInstance.allowance.call(creditor, tokenTransferProxyInstance.address)
                        allowanceFromDebtor = await erc20TokenInstance.allowance.call(debtor, tokenTransferProxyInstance.address)
                        console.log('\t\tCreditor: ', creditorBal.toNumber())
                        console.log('\t\tDebtor: ', debtorBal.toNumber())
                        // console.log('\t\tEscrowContract: ', escrowBal.toNumber())
                        console.log('\t\tAllowance(creditor, tokenTransferProxy): ', allowanceFromCreditor.toNumber())
                        console.log('\t\tAllowance(debtor, tokenTransferProxy): ', allowanceFromDebtor.toNumber())


                        await debtKernelInstance.fillDebtOrder(creditor, debtor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount, gas: 3000000})

                        //after successful execution of fillDebtOrder execute setScalingFactors of Escrow
                        let tenure = ((demoValues.escrowTestCases.noOfDays / 30) / 12)  * 10000
                        await escrowInstance.setScalingFactors(principalAmount, tenure, interestRate, creditor, {from: owner, gas: 3000000})
                        // await escrowInstance.setRepaymentValue(principalAmount, tenure, interestRate, {from: owner, gas: 3000000})


                        console.log('\n\tBalances after fillDebtOrder: \n')
                        creditorBal = await erc20TokenInstance.balanceOf.call(creditor) //2010
                        debtorBal = await erc20TokenInstance.balanceOf.call(debtor) // 3450
                        // escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address) // 0
                        allowanceFromCreditor = await erc20TokenInstance.allowance.call(creditor, tokenTransferProxyInstance.address)
                        allowanceFromDebtor = await erc20TokenInstance.allowance.call(debtor, tokenTransferProxyInstance.address)
                        console.log('\t\tCreditor: ', creditorBal.toNumber())
                        console.log('\t\tDebtor: ', debtorBal.toNumber())
                        // console.log('\t\tEscrowContract: ', escrowBal.toNumber())
                        console.log('\t\tAllowance(creditor, tokenTransferProxy): ', allowanceFromCreditor.toNumber())
                        console.log('\t\tAllowance(debtor, tokenTransferProxy): ', allowanceFromDebtor.toNumber())
                        assert.equal(txObject.receipt.status, true, 'Error while invoking fillDebtOrder()')
                    })

                    it('Should get the scalingFactors', async () => {
                        let scalingFactor = await escrowInstance.scalingFactorsOf.call(creditor)
                        console.log('\t\ttheoreticalScalingFactor: ', scalingFactor[0].toNumber())
                        console.log('\t\tactualScalingFactor: ', scalingFactor[1].toNumber())
                    })
                })
            })
            describe('Get EMI details and invoke repayments of Interest', () => {
                it('Should get the pre-reqs in place for repayment', async () => {
                    await borrowerInstance.approve(tokenTransferProxyInstance.address, 2000, { from: owner, gas: 3000000 }) //Approve of Borrower.sol
                    await tokenTransferProxyInstance.addAuthorizedTransferAgent(repaymentRouterInstance.address, {from: owner, gas: 3000000}) //repaymentRouterAdd will be the msg.sender in TokenTransferProxy.transferFrom
                    // txObject =  await borrowerInstance.repay(debtAgreementId, 500, erc20TokenInstance.address, {from: owner, gas: 3000000})

                    let debtorBal = await erc20TokenInstance.balanceOf.call(borrowerInstance.address)
                    console.log('\t\tdebtorBal: ', debtorBal.toNumber())

                    //Get EMI Details
                    let emi = await borrowerInstance.getEmiDetails.call(debtAgreementId, demoValues.escrowTestCases.noOfDays)
                    console.log('\t\tEmi details are: ', '\n\t\tEmi Amount: ', emi[0].toNumber(), '\n\t\tNo of EMIs: ',emi[1].toNumber(),'\n\t\tEveryMonth Interest: ',emi[2].toNumber())
                    let onlyPrincipalAmount = emi[0].toNumber() - emi[2].toNumber()
                    let amount, oneMonthTimestamp, twoMonthTimestamp, threeMonthStamp, greaterThanTimestamp
                    oneMonthTimestamp = Math.floor(((Date.now() + (60 * 60 * 24 * 30 * 1000)) / 1000))
                    console.log('\t\tRepayment expected on: ', utils.timeStampToDate(oneMonthTimestamp))
                    amount = await collateralizedSimpleInterestTermsContractInstance.getExpectedRepaymentValue(debtAgreementId, oneMonthTimestamp)
                    console.log('\t\tExpected amount: ', amount.toNumber())
                    //Fast-forward time by 30 days and pay only the interest
                    await web3APIs.fastForwardGanache(demoValues.SECONDS_IN_DAY * 30)
                    txObject =  await borrowerInstance.repay(debtAgreementId, onlyPrincipalAmount, erc20TokenInstance.address, {from: owner, gas: 3000000})
                    let valueRepaidByBorrower = await borrowerInstance.getValueRepaidToDate.call(debtAgreementId)
                    console.log('\t\t\tTotal Value repaid after 1st EMI by the borrower: ', valueRepaidByBorrower.toNumber())


                    twoMonthTimestamp = Math.floor(((Date.now() + (60 * 60 * 24 * 60 * 1000)) / 1000))
                    console.log('\t\tRepayment expected on: ', utils.timeStampToDate(twoMonthTimestamp))
                    amount = await collateralizedSimpleInterestTermsContractInstance.getExpectedRepaymentValue(debtAgreementId, twoMonthTimestamp)
                    console.log('\t\tExpected amount: ', amount.toNumber())
                    //Fast-forward time by 30 days and pay only the interest
                    await web3APIs.fastForwardGanache(demoValues.SECONDS_IN_DAY * 30)
                    txObject =  await borrowerInstance.repay(debtAgreementId, onlyPrincipalAmount, erc20TokenInstance.address, {from: owner, gas: 3000000})
                    valueRepaidByBorrower = await borrowerInstance.getValueRepaidToDate.call(debtAgreementId)
                    console.log('\t\t\tTotal Value repaid after 2nd EMI by the borrower: ', valueRepaidByBorrower.toNumber())

                    threeMonthStamp = Math.floor(((Date.now() + (60 * 60 * 24 * 90 * 1000)) / 1000))
                    console.log('\t\tRepayment is expected on: ', utils.timeStampToDate(threeMonthStamp))
                    amount = await collateralizedSimpleInterestTermsContractInstance.getExpectedRepaymentValue(debtAgreementId, threeMonthStamp)
                    console.log('\t\tExpected amount: ', amount.toNumber())
                    //Fast-forward time by 30 days and pay only the interest
                    await web3APIs.fastForwardGanache(demoValues.SECONDS_IN_DAY * 30)
                    txObject =  await borrowerInstance.repay(debtAgreementId, onlyPrincipalAmount, erc20TokenInstance.address, {from: owner, gas: 3000000})
                    valueRepaidByBorrower = await borrowerInstance.getValueRepaidToDate.call(debtAgreementId)
                    console.log('\t\t\tTotal Value repaid after 3rd EMI by the borrower: ', valueRepaidByBorrower.toNumber())

                    greaterThanTimestamp = Math.floor(((Date.now() + (60 * 60 * 24 * 120 * 1000)) / 1000))
                    console.log('\t\tRepayment expected on: ', utils.timeStampToDate(greaterThanTimestamp))
                    amount = await collateralizedSimpleInterestTermsContractInstance.getExpectedRepaymentValue(debtAgreementId, greaterThanTimestamp)
                    console.log('\t\tAmount Expected after the end of term: ', amount.toNumber())

                    assert.equal(txObject.receipt.status, true, 'Failed successful execution f repay()')
                })

                it('Should check the loan state to be Withdraw', async () => {
                    let loanState = await escrowInstance.getLenderState.call()
                    assert.equal(loanState.toNumber(), 4, 'Loan state do not match')
                })
            })
            describe('function withdraw(address _payee) publicOwner', () => {
                describe('Check positive scenarios', async () => {
                    let escrowBal
                    let depositor1 = accounts[1]
                    let depositor2 = accounts[2]
                    let depositor3 = accounts[3]
                    let depositor4 = accounts[4]
                    describe('Execute withdraw() successfully', async () => {
                        it('Should execute withdraw() successfully', async () => {

                            txObject = await escrowInstance.withdraw(demoValues.escrowTestCases.principalAmount, {from: owner, gas: 3000000})
                            assert.equal(txObject.receipt.status, true, 'Error while executing withdraw()')
                        })
                    })

                    describe('Check withdraw() is executed as expected', () => {
                        it('Should check the escrow balance to be 1', async () => {
                            let bal
                            escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address)
                            console.log('\t\tescrowBal: ', escrowBal.toNumber())

                            bal = await erc20TokenInstance.balanceOf.call(depositor1)
                            console.log('\t\tdepositor1Bal: ', bal.toNumber())

                            bal = await erc20TokenInstance.balanceOf.call(depositor2)
                            console.log('\t\tdepositor2Bal: ', bal.toNumber())

                            bal = await erc20TokenInstance.balanceOf.call(depositor3)
                            console.log('\t\tdepositor3Bal: ', bal.toNumber())

                            bal = await erc20TokenInstance.balanceOf.call(depositor4)
                            console.log('\t\tdepositor4Bal: ', bal.toNumber())


                            escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address)
                            console.log('\t\tBalance of escrow contract after withdrawal: ', escrowBal.toNumber())
                            assert.equal(escrowBal.toNumber(), 2, 'Escrow contract balances do not match')
                        })
                        it('Should get the scalingFactors', async () => {
                            let scalingFactor = await escrowInstance.getScalingFactorsOf.call(escrowInstance.address)
                            console.log('\t\ttheoreticalScalingFactor: ', scalingFactor[0].toNumber())
                            console.log('\t\tactualScalingFactor: ', scalingFactor[1].toNumber())
                        })
                    })
                })
            })
        })
    })
})
