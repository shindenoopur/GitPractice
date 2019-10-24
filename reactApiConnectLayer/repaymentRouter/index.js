/**
 * Created by Balaji on 05/11/18.
 */

const contract = require('truffle-contract')
const web3APIs = require('../utils/web3Apis')
const config = require('../../truffle')
const isMined = require('../utils/isMined')
const prettyJson = require('../utils/prettyJsonOutput')
const customFunctions = require('../../test/utils/debtRegistry/customFunctions')

const debtRegistryJson = require('../../build/contracts/DebtRegistry')
const DebtRegistry = contract(debtRegistryJson)

const BCTokenJson = require('../../build/contracts/BCToken')
const BCToken = contract(BCTokenJson)

const repaymentRouterJson = require('../../build/contracts/RepaymentRouter')
const RepaymentRouter = contract(repaymentRouterJson)

const tokenTransferProxyJson = require('../../build/contracts/TokenTransferProxy')
const TokenTransferProxy = contract(tokenTransferProxyJson)

const collateralizedSimpleInterestTermsContractJson = require('../../build/contracts/CollateralizedSimpleInterestTermsContract')
const CollateralizedSimpleInterestTermsContract = contract(collateralizedSimpleInterestTermsContractJson)

const tokenRegistryJson = require('../../build/contracts/TokenRegistry')
const TokenRegistry = contract(tokenRegistryJson)

let debtRegistryInstance, bcTokenInstance, repaymentRouterInstance, tokenTransferProxyInstance, tokenRegistryInstance, collateralizedSimpleInterestTermsContractInstance
let block, accounts, owner, txHash, agreementId, fromAccount
let debtor, version, beneficiary, underwriter, underwriterRiskRating, termsContract, salt, termsContractParameters
let principalAmount, underwriterFee, relayerFee, creditorFee, debtorFee, expirationTimestampInSec
let tokenSymbol, tokenAddress, tokenName, numberOfDecimals, tokenIndex
let principalTokenIndex, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays

const ENVIRONMENT = config.networks.development.name

async function preRequisites() {
    try{
        DebtRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        debtRegistryInstance = web3APIs.getContractInstance(DebtRegistry)

        //Get the TokenTransferProxy instance
        TokenTransferProxy.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        tokenTransferProxyInstance = web3APIs.getContractInstance(TokenTransferProxy)

        BCToken.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        bcTokenInstance = web3APIs.getContractInstance(BCToken)

        CollateralizedSimpleInterestTermsContract.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        collateralizedSimpleInterestTermsContractInstance = web3APIs.getContractInstance(CollateralizedSimpleInterestTermsContract)

        RepaymentRouter.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        repaymentRouterInstance = web3APIs.getContractInstance(RepaymentRouter)

        TokenRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        tokenRegistryInstance= web3APIs.getContractInstance(TokenRegistry)

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

        debtor = accounts[1]
        version = accounts[2]
        beneficiary = accounts[3]
        underwriter = accounts[4]
        underwriterRiskRating = 1000

        salt = 10

        underwriterFee = 10
        relayerFee = 10
        creditorFee = 10
        debtorFee = 10
        expirationTimestampInSec =  Date.now() + (60 * 60 * 24 * 1000 * 3)

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


        //Pre-requisites
        termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
        termsContract = collateralizedSimpleInterestTermsContractInstance.address // This has to be the address of the MyTermsContrat.sol file
        await debtRegistryInstance.addAuthorizedInsertAgent(owner, {from: owner, gas: 3000000})
        txHash = await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner, gas: 3000000})
        block = await isMined.checkMining(txHash)
        return 0
    }catch(e){
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }


}

async function transferTokens() {
    try{
        await preRequisites()
        accounts = await web3APIs.getAccounts()
        owner = accounts[0]
        fromAccount = accounts[7]
        txHash = await bcTokenInstance.transfer(fromAccount, 1000, {from: owner})
        block = await isMined.checkMining(txHash)
        return prettyJson.getResponseObject(block, 'success', 'Transferred tokens successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})

    }catch(e){
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }


}

//Approve token allowance form fromAccount to TokenTransferProxy contract address
async function approveTokens() {
    try{
        await  preRequisites()
        accounts = await  web3APIs.getAccounts()
        fromAccount = accounts[7]
        let tokenTransferProxyAdd = tokenTransferProxyInstance.address
        txHash = await bcTokenInstance.approve(tokenTransferProxyAdd, 500, {from: fromAccount})
        block = await  isMined.checkMining(txHash)
        return prettyJson.getResponseObject(block, 'success', 'Token Approval successful', {blockNumber: block.number, transactionHash: block.transactions[0]})
    }catch(e){
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }
}


async function addAuthTransferAgent() {
    try{
        await preRequisites()
        accounts = await web3APIs.getAccounts()
        owner = accounts[0]
        let repaymentRouterAdd = repaymentRouterInstance.address
        txHash = await tokenTransferProxyInstance.addAuthorizedTransferAgent(repaymentRouterAdd, {from: owner, gas: 3000000}) //repaymentRouterAdd will be the msg.sender in TokenTransferProxy.transferFrom
        block = await isMined.checkMining(txHash)
        return prettyJson.getResponseObject(block, 'success', 'Authorization added successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
    }catch(e){
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }
}


async function getAuthTransferAgents() {
    await preRequisites()
    let authorizedAgent = await tokenTransferProxyInstance.getAuthorizedTransferAgents.call()
    prettyJson.getResponseObject({number: ''}, 'success', 'Authorized agents are', authorizedAgent)
    return authorizedAgent
}

async function repay(){
    try{
        await preRequisites()
        await  initialSetup()
        let allEvents
        let filterOptions = {
            fromBlock: 0,
            toBlock: 'latest'
        };
        allEvents = await debtRegistryInstance.allEvents(filterOptions)
        let amount = 100
        allEvents.get((error, logs) => {
            if (error) {
                return prettyJson.getResponseObject(txObject, 'failure', 'Failed while getting event details', [])
            } else {
                logs.forEach(async (element) => {
                    if (element.event === 'LogInsertEntry')  {
                        agreementId = element.args.agreementId //Get agreementId from the emitted event
                        txHash =  await repaymentRouterInstance.repay(agreementId, amount, bcTokenInstance.address, {from: fromAccount, gas: 3000000})
                        block = await  isMined.checkMining(txHash)
                        prettyJson.getResponseObject(block, 'success', 'Repayment done successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
                    }
                })

                getBalances()
            }
        })
    }catch(e){
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }

}

async function getBalances(){
    accounts = await web3APIs.getAccounts()
    return await web3APIs.getBalances(accounts)
}

module.exports = {
    transferTokens,
    approveTokens,
    addAuthTransferAgent,
    getAuthTransferAgents,
    // insertDebtAgreement,
    repay,
    getBalances
}
