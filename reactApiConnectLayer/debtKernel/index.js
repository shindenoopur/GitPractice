/**
 * Created by Balaji on 20/11/18.
 */

const web3APIs = require('../utils/web3Apis')
const contract = require('truffle-contract')
const isMined = require('../utils/isMined')
const prettyJson = require('../utils/prettyJsonOutput')
const config = require('../../truffle')
const customFunctions = require('../../test/utils/debtRegistry/customFunctions')

const debtKernelJson =  require('../../build/contracts/DebtKernel')
const DebtKernel = contract(debtKernelJson)

const tokenTransferProxyJson = require('../../build/contracts/TokenTransferProxy')
const TokenTransferProxy = contract(tokenTransferProxyJson)

const debtTokenJson = require('../../build/contracts/DebtToken')
const DebtToken = contract(debtTokenJson)

const debtRegistryJson = require('../../build/contracts/DebtRegistry')
const DebtRegistry = contract(debtRegistryJson)

const tokenRegistryJson = require('../../build/contracts/TokenRegistry')
const TokenRegistry = contract(tokenRegistryJson)

const BCTokenJson = require('../../build/contracts/BCToken')
const BCToken = contract(BCTokenJson)

const bc721TokenJson = require('../../build/contracts/BC721Token')
const  BC721Token = contract(bc721TokenJson)

const collateralizerJson = require('../../build/contracts/Collateralizer')
const Collateralizer = contract(collateralizerJson)

const collateralizedSimpleInterestTermsContractJson = require('../../build/contracts/CollateralizedSimpleInterestTermsContract')
const CollateralizedSimpleInterestTermsContract = contract(collateralizedSimpleInterestTermsContractJson)

const escrowRegisryJson = require('../../build/contracts/EscrowRegistry')
const EscroRegistryContract = contract(escrowRegisryJson)

// const contractRegistryJson = require('../../build/contracts/ContractRegistry')
// const ContractRegistry = contract(contractRegistryJson)




const ENVIRONMENT = config.networks.development.name

let tokenRegistryInstance, debtKernelInstance, tokenTransferProxyInstance, debtTokenInstance, debtRegistryInstance, collateralizerInstance,
    collateralizedSimpleInterestTermsContractInstance, escrowRegistryInstance

let bcTokenInstance, bc721TokenInstance
let txHash, block
let orderAddresses = [], orderValues = [], orderBytes32 = [], signaturesV = [], signaturesR = [], signaturesS = []
let debtor, version, beneficiary, underwriter, underwriterRiskRating, termsContract, salt, termsContractParameters,
    relayer, creditor, owner
    let tokenSymbol, tokenAddress, tokenName, numberOfDecimals, tokenIndex
let principalAmount, underwriterFee, relayerFee, creditorFee, debtorFee, expirationTimestampInSec
let debtOrderHash, fromAccount, debtorSig, creditorSig, underwriterSig, underWriterMessageHash
let agreementId
let principalTokenIndex, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays

async function preRequisites() {
    try{
        DebtKernel.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        debtKernelInstance = web3APIs.getContractInstance(DebtKernel)

        TokenTransferProxy.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        tokenTransferProxyInstance = web3APIs.getContractInstance(TokenTransferProxy)

        DebtToken.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        debtTokenInstance = web3APIs.getContractInstance(DebtToken)

        DebtRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        debtRegistryInstance = web3APIs.getContractInstance(DebtRegistry)

        TokenRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        tokenRegistryInstance= web3APIs.getContractInstance(TokenRegistry)

        BCToken.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        bcTokenInstance = web3APIs.getContractInstance(BCToken)

        BC721Token.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        bc721TokenInstance = web3APIs.getContractInstance(BC721Token)

        EscroRegistryContract.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        escrowRegistryInstance = web3APIs.getContractInstance(EscroRegistryContract)

        CollateralizedSimpleInterestTermsContract.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        collateralizedSimpleInterestTermsContractInstance = web3APIs.getContractInstance(CollateralizedSimpleInterestTermsContract)

        Collateralizer.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        collateralizerInstance = web3APIs.getContractInstance(Collateralizer)

        return 0
    }catch(e){
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }

}

async function initialSetup() {
    try{
        await preRequisites()
        accounts = await web3APIs.getAccounts()

        owner = accounts[0]

        debtor = accounts[9]
        version = accounts[8]
        beneficiary = accounts[7]
        underwriter = accounts[6]
        relayer = accounts[5]
        creditor = accounts[4]
        underwriterRiskRating = 100

        salt = 40

        underwriterFee = 10
        relayerFee = 10
        creditorFee = 10
        debtorFee = 10
        expirationTimestampInSec = Math.floor(((Date.now() + (86400 * 90 * 1000)) / 1000)) //Setting expirationTimestampInSec to be after 90 days

        tokenSymbol = await bcTokenInstance.symbol.call()
        tokenAddress = bcTokenInstance.address
        tokenName = await bcTokenInstance.name.call()
        numberOfDecimals = await bcTokenInstance.decimals.call()

        await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, {from: owner, gas: 3000000}) //adds the token to tokenRegistry
        tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)

        principalAmount = 1000
        interestRate = 20
        amortizationUnit = 1
        termLength = 100
        collateralAmount = 600
        gracePeriodInDays = 2

        principalTokenIndex = tokenIndex.toNumber()
        collateralTokenIndex = principalTokenIndex

        termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
        termsContract = collateralizedSimpleInterestTermsContractInstance.address // This has to be the address of the MyTermsContrat.sol file

        //Arrange orderAddresses array
        orderAddresses[0] = version
        orderAddresses[1] = debtor
        orderAddresses[2] = underwriter
        orderAddresses[3] = termsContract
        orderAddresses[4] = bcTokenInstance.address
        orderAddresses[5] = relayer

        //Arrange orderValues array
        orderValues[0] = underwriterRiskRating
        orderValues[1] = salt
        orderValues[2] = principalAmount
        orderValues[3] = underwriterFee
        orderValues[4] = relayerFee
        orderValues[5] = creditorFee
        orderValues[6] = debtorFee
        orderValues[7] = expirationTimestampInSec //1542067200

        orderBytes32[0] = termsContractParameters

        //Set debtTokenAddress <This is important else Transaction reverts from the 5th if branch of assertDebtOrderValidityInvariants>
        await isMined.checkMining(await debtKernelInstance.setDebtToken(debtTokenInstance.address, {from: owner, gas: 3000000}))

        //Set the EscrowRegistry
        await isMined.checkMining(await debtKernelInstance.setEscrowRegistry(escrowRegistryInstance.address, {from: owner, gas: 3000000}))

        //Transfer to creditor
        await isMined.checkMining(await bcTokenInstance.transfer(creditor, 5000, {from: owner, gas: 3000000}))

        //Transfer to debtor
        await isMined.checkMining(await bcTokenInstance.transfer(debtor, 1000, {from: owner, gas: 3000000}))

        return 0
    }catch(e){
        console.log('error in initialSetUp: ', e)
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }


}

async function fillDebtOrderKernel() {
    try{
        await initialSetup()
        let accounts = await  web3APIs.getAccounts()
        console.log('\x1b[36m%s\x1b[0m','\nInvoked getBalances() Pre-Fill DebtOrder from driver class:')
        await getBalances()
        //Get debtOrderHash sign it using debtor, creditor and underwriter s.t. the if conditions in assertDebtOrderConsensualityInvariants are evaluated successfully
        //Get agreementId and debtOrderHash from the customized function
        agreementId = web3APIs.getSoliditySha3(orderAddresses[0], orderAddresses[1], orderAddresses[2], orderValues[0], orderAddresses[3], orderBytes32[0], orderValues[1])
        debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5], orderAddresses[5], orderValues[4], orderValues[7])

        //Sign this debtOrderHash
        //Arrange signaturesV, signaturesR and signaturesS
        //signaturesV, signaturesR and signaturesS at index 1 should be of creditor
        creditorSig = await web3APIs.getSignaturesRSV(creditor, debtOrderHash)
        // console.log('creditorSIg: ', creditorSig)
        signaturesR[1] = creditorSig.r
        signaturesS[1] = creditorSig.s
        signaturesV[1] = creditorSig.v

        //Sign this debtOrderHash
        //Arrange signaturesV, signaturesR and signaturesS
        //signaturesV, signaturesR and signaturesS at index 0 should be of debtor
        debtorSig = await web3APIs.getSignaturesRSV(debtor, debtOrderHash)
        // console.log('debtorSIg: ', debtorSig)
        signaturesR[0] = debtorSig.r
        signaturesS[0] = debtorSig.s
        signaturesV[0] = debtorSig.v

        //Get the underwriterMessageHash from the customized function
        underWriterMessageHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[7])

        //Sign this underwriterMessageHash
        //Arrange signaturesV, signaturesR and signaturesS
        //signaturesV, signaturesR and signaturesS at index 2 should be of underwriter
        underwriterSig = await web3APIs.getSignaturesRSV(underwriter, underWriterMessageHash)
        // console.log('underWriterSIg: ', underwriterSig)
        signaturesR[2] = underwriterSig.r
        signaturesS[2] = underwriterSig.s
        signaturesV[2] = underwriterSig.v


        fromAccount = accounts[3]

        //Approve the tokenTransferProxy to spend tokens greater than the principalAMount and creditorFee
        await isMined.checkMining(await bcTokenInstance.approve(tokenTransferProxyInstance.address, 1200, {from: creditor, gas: 3000000}))
        //Approve tokenTransferProxy to spend amount >= collateralAmount
        await isMined.checkMining(await bcTokenInstance.approve(tokenTransferProxyInstance.address, 700, { from: debtor, gas: 3000000 }))
        //add authorized mint agent in DebtToken.sol contract storage
        await isMined.checkMining(await debtTokenInstance.addAuthorizedMintAgent(debtKernelInstance.address, {from: owner, gas: 3000000}))
        await isMined.checkMining(await debtRegistryInstance.addAuthorizedEditAgent(debtTokenInstance.address, {from: owner, gas: 3000000}))
        // block = await isMined.checkMining(txHash)
        //add authorized insert agent in DebtRegistry.sol contract storage
        await isMined.checkMining(await debtRegistryInstance.addAuthorizedInsertAgent(debtTokenInstance.address, {from: owner, gas: 3000000}))
        // console.log('4')
        //add authorized transfer agent in TokenTransferProxy, since transferFrom is getting called from DebtKernel, thus DebtKernel will be the msg.sender in TokenTransferProxy
        await isMined.checkMining(await tokenTransferProxyInstance.addAuthorizedTransferAgent(debtKernelInstance.address, {from: owner, gas: 3000000}))

        //Adding line no 377 & 381 solved the revert issue
        await isMined.checkMining(await collateralizerInstance.addAuthorizedCollateralizeAgent(collateralizedSimpleInterestTermsContractInstance.address, {
            from: owner,
            gas: 3000000
        }))
        await isMined.checkMining(await tokenTransferProxyInstance.addAuthorizedTransferAgent(collateralizerInstance.address, {from: owner, gas: 3000000}))

        /*
        Added to debug the revert issue
        let ret = debtKernelInstance.getAgreeAndDebtHash(orderAddresses, orderValues, orderBytes32)
        let a = await debtKernelInstance.assertDebtOrderConsensualityInvariantsPublic.call(creditor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS)
        //Does the token already exists
        let tokenId = await debtKernelInstance.returnUint.call(agreementId)
        let isExist = await  debtTokenInstance.exists.call(tokenId)
        let issuanceCancelled = await debtKernelInstance.issuanceCancelled.call(agreementId)
        let cancelDebtOrder = await debtKernelInstance.debtOrderCancelled.call(debtOrderHash)
        a = await debtKernelInstance.assertDebtOrderValidityInvariantsPublic(creditor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount, gas: 3000000})
        */

        block = await isMined.checkMining(await debtKernelInstance.fillDebtOrder(creditor, orderAddresses, orderValues, orderBytes32, signaturesV, signaturesR, signaturesS, {from: fromAccount, gas: 3000000}))
        return prettyJson.getResponseObject(block, 'success', 'Debt order filled successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
    }catch(e){
        console.log('error in fillDebtOrderKernel\n', e)
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }

}

async function cancelDebtOrderIssuance() {
    try{
        // await preRequisites()
        await initialSetup()
        txHash = await debtKernelInstance.cancelIssuance(version, debtor, termsContract, termsContractParameters, underwriter, underwriterRiskRating, salt, {from: debtor, gas: 3000000})
        block = await isMined.checkMining(txHash)
        return prettyJson.getResponseObject(block, 'success', 'Debt order issuance cancelled successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
    }catch(e){
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }
}

async function debtOrderCancel() {
    try {
        await initialSetup()
        txHash = await debtKernelInstance.cancelDebtOrder(orderAddresses, orderValues, orderBytes32, {from: debtor, gas: 3000000})
        block = await isMined.checkMining(txHash)
        return prettyJson.getResponseObject(block, 'success', 'Debt order cancelled successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
    }catch(e){
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }
}

async function getBalances(){
    await preRequisites()
    let accounts = await web3APIs.getAccounts()
    let balance

    balance = await bcTokenInstance.balanceOf.call(accounts[4]) //creditor
    console.log('\t\tBalance of creditor = ', balance.toNumber())

    balance = await bcTokenInstance.balanceOf.call(accounts[9])
    console.log('\t\tBalance of debtor = ', balance.toNumber())

    balance = await bcTokenInstance.balanceOf.call(accounts[6])
    console.log('\t\tBalance of underwriter = ', balance.toNumber())

    balance = await bcTokenInstance.balanceOf.call(accounts[5])
    console.log('\t\tBalance of relayer = ', balance.toNumber())
}
module.exports = {
    fillDebtOrderKernel,
    cancelDebtOrderIssuance,
    debtOrderCancel,
    getBalances
}