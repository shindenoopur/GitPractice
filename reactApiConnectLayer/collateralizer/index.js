/**
* Created by Balaji on 27/11/18.
*/

const web3APIs = require('../utils/web3Apis')
const contract = require('truffle-contract')
const isMined = require('../utils/isMined')
const prettyJson = require('../utils/prettyJsonOutput')
const customFunctions = require('../../test/utils/debtRegistry/customFunctions')
const config = require('../../truffle')

const debtKernelJson =  require('../../build/contracts/DebtKernel')
const DebtKernel = contract(debtKernelJson)

const debtRegistryJson = require('../../build/contracts/DebtRegistry')
const DebtRegistry = contract(debtRegistryJson)

const tokenRegistryJson = require('../../build/contracts/TokenRegistry')
const TokenRegistry = contract(tokenRegistryJson)

const tokenTransferProxyJson = require('../../build/contracts/TokenTransferProxy')
const TokenTransferProxy = contract(tokenTransferProxyJson)

const debtTokenJson = require('../../build/contracts/DebtToken')
const DebtToken = contract(debtTokenJson)

const BCTokenJson = require('../../build/contracts/BCToken')
const BCToken = contract(BCTokenJson)

const collateralizedSimpleInterestTermsContractJson = require('../../build/contracts/CollateralizedSimpleInterestTermsContract')
const CollateralizedSimpleInterestTermsContract = contract(collateralizedSimpleInterestTermsContractJson)

const repaymentRouterJson = require('../../build/contracts/RepaymentRouter')
const RepaymentRouter = contract(repaymentRouterJson)

const contractRegistryJson = require('../../build/contracts/ContractRegistry')
const  ContractRegistry = contract(contractRegistryJson)

const collateralizerJson = require('../../build/contracts/Collateralizer')
const Collateralizer = contract(collateralizerJson)

const multiSigWalletJson = require('../../build/contracts/MultiSigWallet')
const MultiSigWallet = contract(multiSigWalletJson)

const escrowJson = require('../../build/contracts/Escrow')
const Escrow = contract(escrowJson)

//Required variables
const ENVIRONMENT = config.networks.development.name

let debtKernelInstance, tokenTransferProxyInstance, debtTokenInstance, debtRegistryInstance, bcTokenInstance, collateralizerInstance, tokenRegistryInstance,
    collateralizedSimpleInterestTermsContractInstance, contractRegistryInstance, repaymentRouterInstance, multiSigWalletInstance, escrowInstance

//Function related variables
let agreementId, fromAccount, txHash, termsContAdd, returnCollateralAgreementId, block
let orderAddresses = [], orderValues = [], orderBytes32 = [], signaturesV = [], signaturesR = [], signaturesS = []
let debtor, version, beneficiary, underwriter, underwriterRiskRating, termsContractParameters, salt
let principalTokenIndex, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays
let tokenSymbol, tokenAddress, tokenName, numberOfDecimals, tokenIndex
let owner, accounts, creditor, underwriterFee, relayerFee, creditorFee, debtorFee, expirationTimestampInSec, debtOrderHash, underWriterMessageHash
let debtorSig, creditorSig, underwriterSig

let walletOwner1,walletOwner2,walletOwner3

async function getBalancesFromBCToken(address) {
    return await bcTokenInstance.balanceOf.call(address)
}

async function getAllowanceFromBCToken(owner, spender) {
    return await bcTokenInstance.allowance.call(owner, spender)
}

async function printBalances(...accounts){
    let debtorBalance = await getBalancesFromBCToken(accounts[1])
    let creditorBalance = await getBalancesFromBCToken(accounts[2])
    let underwriterBalance = await getBalancesFromBCToken(accounts[3])
    let relayerBalance = await getBalancesFromBCToken(accounts[4])

    let tokenTransferProxyAllowanceFromDebtor = await getAllowanceFromBCToken(accounts[1], accounts[7])
    let tokenTransferProxyAllowanceFromCreditor = await getAllowanceFromBCToken(accounts[2], accounts[7])

    console.log(accounts[0], "\n")
    let ledgerBalance = {
        'borrowerBalance': debtorBalance.toNumber(),
        'lenderBalance': creditorBalance.toNumber(),
        'underwriterBalance': underwriterBalance.toNumber(),
        'relayerBalance': relayerBalance.toNumber()
    }

    prettyJson.prettyPrint(ledgerBalance)

    let debtDetails = {
        'principalAmount':  accounts[5],
        'interestRate': accounts[6]
    }

    prettyJson.prettyPrint(debtDetails)

    let allowanceOf = {
        'Allowance(TokenTransferProxy, Borrower)': tokenTransferProxyAllowanceFromDebtor.toNumber(),
        'Allowance(TokenTransferProxy, Creditor)': tokenTransferProxyAllowanceFromCreditor.toNumber()
    }

    prettyJson.prettyPrint(allowanceOf)

    // console.log('\x1b[36m%s\x1b[0m', '\nBorrower | Lender | Underwriter | Relayer | Principal Amount | Interest Rate | Allowance(TokenTransferProxy, Debtor) | Allowance(TokenTransferProxy, Creditor)')
    // console.log('\x1b[36m%s\x1b[0m', '\n', debtorBalance.toNumber(), '\t|', creditorBalance.toNumber(), '|', underwriterBalance.toNumber(), '|\t', relayerBalance.toNumber(), '|\t', accounts[5], '|\t', accounts[6], '|\t', tokenTransferProxyAllowanceFromDebtor.toNumber(), '|\t', tokenTransferProxyAllowanceFromCreditor.toNumber())
}

//Function that sets the network for the contracts
function setNetwork() {
    DebtKernel.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    TokenTransferProxy.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    DebtToken.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    DebtRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    CollateralizedSimpleInterestTermsContract.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    RepaymentRouter.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    BCToken.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    TokenRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    ContractRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    Collateralizer.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    MultiSigWallet.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    Escrow.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))

}

//Function that sets the contract instances
function setInstances() {
    debtKernelInstance = web3APIs.getContractInstance(DebtKernel)
    tokenTransferProxyInstance = web3APIs.getContractInstance(TokenTransferProxy)
    debtTokenInstance = web3APIs.getContractInstance(DebtToken)
    debtRegistryInstance = web3APIs.getContractInstance(DebtRegistry)
    collateralizedSimpleInterestTermsContractInstance = web3APIs.getContractInstance(CollateralizedSimpleInterestTermsContract)
    bcTokenInstance = web3APIs.getContractInstance(BCToken)
    repaymentRouterInstance = web3APIs.getContractInstance(RepaymentRouter)
    tokenRegistryInstance= web3APIs.getContractInstance(TokenRegistry)
    contractRegistryInstance= web3APIs.getContractInstance(ContractRegistry)
    collateralizerInstance= web3APIs.getContractInstance(Collateralizer)
    multiSigWalletInstance = web3APIs.getContractInstance(MultiSigWallet)
    escrowInstance = web3APIs.getContractInstance(Escrow)
}

//Function that sets the network and contract instances
async function setNetworkAndInstances() {
    try{
        setNetwork()
        setInstances()
        return 0
    }catch(e){
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }
}

//Function that gets the initial setup for collateralize()
async function setupForCollateralize() {
    accounts = await web3APIs.getAccounts()
    owner = accounts[0]

    walletOwner1 = accounts[1]
    walletOwner2 = accounts[2]
    walletOwner3 = accounts[3]


    fromAccount = accounts[9]
    debtor = accounts[3]
    version = accounts[4]
    beneficiary = accounts[2]
    underwriter = accounts[5]
    relayer = accounts[6]
    creditor = accounts[8]
    underwriterRiskRating = 1000
    salt = 10

    tokenSymbol = await bcTokenInstance.symbol.call()
    tokenAddress = bcTokenInstance.address
    tokenName = await bcTokenInstance.name.call()
    numberOfDecimals = await bcTokenInstance.decimals.call()

    await isMined.checkMining(await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, {from: owner, gas: 3000000})) //adds the token to tokenRegistry
    tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

    principalAmount = 1000
    interestRate = 10
    amortizationUnit = 1
    termLength = 100
    collateralAmount = 500
    gracePeriodInDays = 2
    principalTokenIndex = tokenIndex.toNumber()
    collateralTokenIndex = principalTokenIndex

    underwriterFee = 10
    relayerFee = 10
    creditorFee = 10
    debtorFee = 10
    const threeDays = 60 * 60 * 24 * 3 * 1000
    expirationTimestampInSec = Date.now() + threeDays //1543104000 //25th Nov Date.now()

    termsContAdd = collateralizedSimpleInterestTermsContractInstance.address

    //Arrange orderAddresses array
    orderAddresses.push(version)
    orderAddresses.push(debtor)
    orderAddresses.push(underwriter)
    orderAddresses.push(termsContAdd)
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


    //Transfer to creditor
    await isMined.checkMining(await bcTokenInstance.transfer(creditor, 10000, {from: owner, gas: 3000000}))

    //Transfer tokens
    await isMined.checkMining(await bcTokenInstance.transfer(debtor, 10000, {from: owner, gas: 3000000})) //To avoid Error: VM Exception while processing transaction: revert in Collateralize: collaterize(). Insufficient collateralizer balance

    // Approve to spend tokens
    await isMined.checkMining(await bcTokenInstance.approve(tokenTransferProxyInstance.address, 5000, { from: debtor, gas: 3000000 })) //To avoid Error: VM Exception while processing transaction: revert in Collateralize: collaterize(). Insufficient proxy allowance.

    //Approve the tokenTransferProxy to spend tokens greater than the principalAMount and creditorFee
    await isMined.checkMining(await bcTokenInstance.approve(tokenTransferProxyInstance.address, 1200, {from: creditor, gas: 3000000}))


    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)

    //Arrange orderBytes32 array
    orderBytes32.push(termsContractParameters)

    //Get agreementId
    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContAdd, termsContractParameters, salt)
    debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5], orderAddresses[5], orderValues[4], orderValues[7])

    //Execute setDebtToken() using MultiSigWallet
    let setDebtTokenData = debtKernelInstance.setDebtToken.getData(debtTokenInstance.address, {from: owner, gas: 3000000})

    //Transferring ownership of DebtKernel, as setDebtToken will be called from MultiSigWallet
    await debtKernelInstance.transferOwnership(multiSigWalletInstance.address, {from: owner, gas: 3000000})

    //submitTransaction()
    await isMined.checkMining(await multiSigWalletInstance.submitTransaction(debtKernelInstance.address, 0, setDebtTokenData, {from: walletOwner1, gas: 3000000}))
    //Get the latest transaction id
    let txIds = await multiSigWalletInstance.getTransactionIds.call(0, 1, true, false)
    let txIndex = txIds[0].c[0]
    //Grant Confiramtions, since requiredNoOfConf = 3
    await isMined.checkMining(await multiSigWalletInstance.confirmTransaction(txIndex, {from: walletOwner2, gas: 3000000}))
    await isMined.checkMining(await multiSigWalletInstance.confirmTransaction(txIndex, {from: walletOwner3, gas: 3000000}))
    /*Thus using multiSigWallet we have successfully executed the setDebtToken part*/

}
//Function that collateralizes a debt
async function collateralizeDebt() {
    try{

        let balanceOfCollateralizer = await getBalancesFromBCToken(collateralizerInstance.address)
        prettyJson.prettyPrint({'collateralizerContractBalance': balanceOfCollateralizer.toNumber()})
        await printBalances('Balance before collateralizeDebt', debtor, creditor, underwriter, relayer, principalAmount, interestRate, tokenTransferProxyInstance.address)

        //Add authorized collateralize agent
        await isMined.checkMining(await collateralizerInstance.addAuthorizedCollateralizeAgent(termsContAdd, { from: owner, gas: 3000000 }))

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


        //add authorized mint agent in DebtToken.sol contract storage
        await isMined.checkMining(await debtTokenInstance.addAuthorizedMintAgent(debtKernelInstance.address, {from: owner, gas: 3000000}))
        //add authorized insert agent in DebtRegistry.sol contract storage
        await isMined.checkMining(await debtRegistryInstance.addAuthorizedInsertAgent(debtTokenInstance.address, {from: owner, gas: 3000000}))
        //add authorized transfer agent in TokenTransferProxy, since transferFrom is getting called from DebtKernel, thus DebtKernel will be the msg.sender in TokenTransferProxy
        await isMined.checkMining(await tokenTransferProxyInstance.addAuthorizedTransferAgent(debtKernelInstance.address, {from: owner, gas: 3000000}))

        //add authorized transfer agent Collateralizer.sol
        await isMined.checkMining(await tokenTransferProxyInstance.addAuthorizedTransferAgent(collateralizerInstance.address, {from: owner, gas: 3000000}))

        txHash = await debtKernelInstance.fillDebtOrder(creditor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount, gas: 3000000})
        block = await isMined.checkMining(txHash)

        await printBalances('Balance after collateralizeDebt', debtor, creditor, underwriter, relayer, principalAmount, interestRate, tokenTransferProxyInstance.address)

        balanceOfCollateralizer = await getBalancesFromBCToken(collateralizerInstance.address)
        prettyJson.prettyPrint({'collateralizerContractBalance': balanceOfCollateralizer.toNumber()})
        return prettyJson.getResponseObject(block, 'success', 'Collateral collateralized successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
    } catch(e){
        console.log('error in collateralizeDebt()' , e)
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }
}

//Function that gets the initial setup for returnCollateral()
async function setupForReturnCollateral() {
    // await setNetworkAndInstances()
    accounts = await web3APIs.getAccounts()
    owner = accounts[0]

    fromAccount = accounts[9]
    debtor = accounts[3]
    version = accounts[4]
    beneficiary = accounts[2]
    underwriter = accounts[5]
    relayer = accounts[6]
    creditor = accounts[8]
    underwriterRiskRating = 1000
    salt = 10

    tokenSymbol = await bcTokenInstance.symbol.call()
    tokenAddress = bcTokenInstance.address
    tokenName = await bcTokenInstance.name.call()
    numberOfDecimals = await bcTokenInstance.decimals.call()

    await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, {from: owner, gas: 3000000}) //adds the token to tokenRegistry
    tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

    principalAmount = 1000
    interestRate = 10
    amortizationUnit = 1
    termLength = 100
    collateralAmount = 500
    gracePeriodInDays = 2
    principalTokenIndex = tokenIndex.toNumber()
    collateralTokenIndex = principalTokenIndex

    termsContAdd = collateralizedSimpleInterestTermsContractInstance.address
    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
    return web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContAdd, termsContractParameters, salt)

}

//Function that returns the collateralized debt
async function returnCollateralDebt() {
    try{
        accounts = await web3APIs.getAccounts()
        returnCollateralAgreementId = await setupForReturnCollateral()
        //Check if agreementId exists
        await debtRegistryInstance.doesEntryExist.call(returnCollateralAgreementId)
        await isMined.checkMining(await tokenTransferProxyInstance.addAuthorizedTransferAgent(repaymentRouterInstance.address, {
            from: owner,
            gas: 3000000
        }))

        let collateralizer = await collateralizerInstance.agreementToCollateralizer.call(agreementId);
        // console.log('collateralizer: ', collateralizer)

        console.log('Before returnCollateralDebt\n')

        let borrowerBalance = await getBalancesFromBCToken(collateralizer)
        let creditorBalance = await getBalancesFromBCToken(creditor)
        let collateralizerBalance = await getBalancesFromBCToken(collateralizerInstance.address)
        let tokenTransferProxyAllowanceFromAccount = await getAllowanceFromBCToken(debtor, tokenTransferProxyInstance.address)


        let ledgerBalance = {
            'borrowerBalance': borrowerBalance.toNumber(),
            'lenderBalance': creditorBalance.toNumber(),
            'collateralizerContractBalance': collateralizerBalance.toNumber(),
            'Allowance of TokenTransferProxy, Borrower': tokenTransferProxyAllowanceFromAccount.toNumber()
        }

        prettyJson.prettyPrint(ledgerBalance)

        //Added for debugging purpose
        /*
        let valueRepaidToDate = await collateralizedSimpleInterestTermsContractInstance.getValueRepaidToDate.call(returnCollateralAgreementId)
        console.log('ValueRepaidToDate: ', valueRepaidToDate.toNumber())

        let termEndTimestamp = await collateralizedSimpleInterestTermsContractInstance.getTermEndTimestamp.call(returnCollateralAgreementId)
        console.log('termEndTimestamp: ', termEndTimestamp.toNumber())

        let expectedRepaymentValue = await collateralizedSimpleInterestTermsContractInstance.getExpectedRepaymentValue.call(returnCollateralAgreementId, termEndTimestamp)
        console.log('expectedRepaymentValue: ', expectedRepaymentValue.toNumber())
        */


        //registerRepayment
        await isMined.checkMining(await repaymentRouterInstance.repay(returnCollateralAgreementId, 1100, bcTokenInstance.address, {from: debtor, gas: 3000000}))

        txHash = await collateralizerInstance.returnCollateral(returnCollateralAgreementId, { from: owner, gas: 3000000 })
        block = await isMined.checkMining(txHash)

        console.log('\nAfter returnCollateralDebt\n')


        borrowerBalance = await getBalancesFromBCToken(collateralizer)
        creditorBalance = await getBalancesFromBCToken(creditor)
        collateralizerBalance = await getBalancesFromBCToken(collateralizerInstance.address)
        tokenTransferProxyAllowanceFromAccount = await getAllowanceFromBCToken(debtor, tokenTransferProxyInstance.address)

        ledgerBalance = {
            'borrowerBalance': borrowerBalance.toNumber(),
            'lenderBalance': creditorBalance.toNumber(),
            'collateralizerContractBalance': collateralizerBalance.toNumber(),
            'Allowance of TokenTransferProxy, Borrower': tokenTransferProxyAllowanceFromAccount.toNumber()
        }

        prettyJson.prettyPrint(ledgerBalance)
        return prettyJson.getResponseObject(block, 'success', 'Collateral returned successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
    }catch(e){
        console.log('error in returnCollateralDebt:\n', e)
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }
}

//Function that gets the initial setup for collateralize()
async function setupForSeizeCollateral() {
    accounts = await web3APIs.getAccounts()
    fromAccount = accounts[9]
    debtor = accounts[7]
    version = accounts[5]
    beneficiary = accounts[3]
    underwriter = accounts[8]
    relayer = accounts[4]
    creditor = accounts[6]
    underwriterRiskRating = 3000
    salt = 30

    tokenSymbol = await bcTokenInstance.symbol.call()
    tokenAddress = bcTokenInstance.address
    tokenName = await bcTokenInstance.name.call()
    numberOfDecimals = await bcTokenInstance.decimals.call()

    await isMined.checkMining(await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, {from: owner, gas: 3000000}))//adds the token to tokenRegistry)
    tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

    principalAmount = 1500
    interestRate = 10
    amortizationUnit = 1
    termLength = 100
    collateralAmount = 2000
    gracePeriodInDays = 3
    principalTokenIndex = tokenIndex.toNumber()
    collateralTokenIndex = principalTokenIndex

    underwriterFee = 50
    relayerFee = 50
    creditorFee = 50
    debtorFee = 50

    const fourDays = 60 * 60 * 24 * 4 * 1000
    expirationTimestampInSec = Date.now() + fourDays

    termsContAdd = collateralizedSimpleInterestTermsContractInstance.address

    //Arrange orderAddresses array
    orderAddresses[0] = version
    orderAddresses[1] = debtor
    orderAddresses[2] = underwriter
    orderAddresses[3] = termsContAdd
    orderAddresses[4] = bcTokenInstance.address //BCToken address
    orderAddresses[5] = relayer

    //Arrange orderValues array
    orderValues[0] = underwriterRiskRating
    orderValues[1] = salt
    orderValues[2] = principalAmount
    orderValues[3] = underwriterFee
    orderValues[4] = relayerFee
    orderValues[5] = creditorFee
    orderValues[6] = debtorFee
    orderValues[7] = expirationTimestampInSec

    //Arrange orderBytes32 array
    orderBytes32[0] = termsContractParameters

    //Transfer to creditor
    await isMined.checkMining(await bcTokenInstance.transfer(creditor, 10000, {from: owner, gas: 3000000}))

    //Transfer tokens
    await isMined.checkMining(await bcTokenInstance.transfer(debtor, 10000, {from: owner, gas: 3000000}))

    // Approve to spend tokens
    await isMined.checkMining(await bcTokenInstance.approve(tokenTransferProxyInstance.address, 5000, { from: debtor, gas: 3000000 }))

    //Approve the tokenTransferProxy to spend tokens greater than the principalAmount and creditorFee
    await isMined.checkMining(await bcTokenInstance.approve(tokenTransferProxyInstance.address, 5000, {from: creditor, gas: 3000000}))


    termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)

    orderBytes32[0] = termsContractParameters

    //Get agreementId
    agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContAdd, termsContractParameters, salt)

    debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5], orderAddresses[5], orderValues[4], orderValues[7])

}

//Function that collateralizes a debt
async function seizeCollateralDebt() {
    try{
        //BorrowerBalance = OriginalBalance - collateralAMount + (principalAMount - debtorFee)
        //LenderBalance = OriginalBalance - ((prinicpalAMount - debtorFee) - underwriterFee - relayerFee)
        await printBalances('Balance before seizeCollateralDebt from seizeCollateral', debtor, creditor, underwriter, relayer, principalAmount, interestRate, tokenTransferProxyInstance.address)
        // let collaContractBalance = await getBalancesFromBCToken(collateralizerInstance.address)
        // prettyJson.prettyPrint({"collateralizerContractBalance": collaContractBalance.toNumber()})
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


        txHash = await debtKernelInstance.fillDebtOrder(creditor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount, gas: 3000000})
        block = await isMined.checkMining(txHash)

        await printBalances('Balance after filling fillDebtOrder from seizeCollateral', debtor, creditor, underwriter, relayer, principalAmount, interestRate, tokenTransferProxyInstance.address)

        // let collateralizer = await collateralizerInstance.agreementToCollateralizer.call(agreementId);
        // console.log('collateralizer: ', collateralizer)

        const SECONDS_IN_DAY = 60 * 60 * 24
        await web3APIs.fastForwardGanache(SECONDS_IN_DAY * 4) // forward time by 4 days

        txHash =  await collateralizerInstance.seizeCollateral(agreementId, { from: owner, gas: 3000000 })
        block = await isMined.checkMining(txHash)

        await printBalances('Balance after seizeCollateralDebt from seizeCollateral', debtor, creditor, underwriter, relayer, principalAmount, interestRate, tokenTransferProxyInstance.address)
        // collaContractBalance = await getBalancesFromBCToken(collateralizerInstance.address)
        // prettyJson.prettyPrint({"collateralizerContractBalance": collaContractBalance.toNumber()})
        return prettyJson.getResponseObject(block, 'success', 'Collateral seized successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
    }catch(e){
        console.log('error in seizeCollateralDebt: \n', e)
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }
}

async function checkBalanceAndTransfer(accountAddress){
    let balance = await getBalancesFromBCToken((accountAddress))
    if(balance.toNumber() > 0){
        await bcTokenInstance.transfer(owner, balance, {from: accountAddress, gas: 3000000})
    }
}

module.exports = {
    setNetworkAndInstances,
    setupForCollateralize,
    setupForReturnCollateral,
    setupForSeizeCollateral,
    collateralizeDebt,
    returnCollateralDebt,
    seizeCollateralDebt
}