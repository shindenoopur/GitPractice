/**
 * Created by Balaji on 30/10/17.
 */

const web3APIs = require('../utils/web3Apis')
const contract = require('truffle-contract')
const isMined = require('../utils/isMined')
const prettyJson = require('../utils/prettyJsonOutput')

const tokenTransferProxyJson = require('../../build/contracts/TokenTransferProxy')
const TokenTransferProxy = contract(tokenTransferProxyJson)

const BCTokenJson = require('../../build/contracts/BCToken')
const BCToken = contract(BCTokenJson)

const config = require('../../truffle')

let tokenTransferProxyInstance, erc20TokenInstance
let block, owner, txHash

const ENVIRONMENT = config.networks.development.name

async function preRequisites() {

    //Get the TokenTransferProxy instance
    TokenTransferProxy.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    tokenTransferProxyInstance = web3APIs.getContractInstance(TokenTransferProxy)

    //Get the BCToken instance
    BCToken.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    erc20TokenInstance = web3APIs.getContractInstance(BCToken)

}

async function addAuthTransferAgent(address) {
    await preRequisites()
    let accounts = await  web3APIs.getAccounts()
    owner = accounts[0]

    txHash = await tokenTransferProxyInstance.addAuthorizedTransferAgent(address, {from: owner, gas:3000000})
    block = await isMined.checkMining(txHash)
    return prettyJson.getResponseObject(block, 'success', 'Authorization added successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
}

async function getAuthTransferAgents() {
    await preRequisites()
    let authorizedAgent = await tokenTransferProxyInstance.getAuthorizedTransferAgents.call()
    prettyJson.getResponseObject({number: ''}, 'success', 'Authorized agents are', authorizedAgent)
    return authorizedAgent
}

async function revokeTransferAgentAuth(address) {
    await preRequisites()
    let accounts = await  web3APIs.getAccounts()
    owner = accounts[0]

    txHash = await tokenTransferProxyInstance.revokeTransferAgentAuthorization(address, {from: owner})
    block = await isMined.checkMining(txHash)
    return prettyJson.getResponseObject(block, 'success', 'Authorization revoked successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})

}

async function transferFromOwner(ownerAddress, transferToAddress, amountToTransfer, authorizedAgentAddress) {
    await preRequisites()
    let tokenAddress = erc20TokenInstance.address

    txHash = await tokenTransferProxyInstance.transferFrom(tokenAddress, ownerAddress, transferToAddress, amountToTransfer, {from: authorizedAgentAddress})
    block = await  isMined.checkMining(txHash)
    return prettyJson.getResponseObject(block, 'success', 'Transferring token is successful', {blockNumber: block.number, transactionHash: block.transactions[0]})
}

async function approveSpendableTokens(address, tokensApprovedToSpend, owner) {
    await  preRequisites()
    txHash = await erc20TokenInstance.approve(address, tokensApprovedToSpend, {from: owner})
    block = await isMined.checkMining(txHash)
    return prettyJson.getResponseObject(block, 'success', 'Tokens approved successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
}

async function getBalances(addresses){
    await preRequisites()
    return await web3APIs.getBalances(addresses)
}

async function tokenTransfer(to, tokens, messageSender) {
    await preRequisites()
    txHash = erc20TokenInstance.transfer(to, tokens, {from: messageSender})
    block = await isMined.checkMining(txHash)
    return prettyJson.getResponseObject(block, 'success', 'Tokens transferred successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
}

async function allowance(owner) {
    await  preRequisites()
    let allowedTokens = erc20TokenInstance.allowance.call(owner, tokenTransferProxyInstance.address)
    console.log('Allowed tokens from [',owner,'] to [',tokenTransferProxyInstance.address,'] = ', allowedTokens.toNumber())
    return allowedTokens.toNumber()
}

async function getAllEvents(){
    let allEvents
    await preRequisites()
    let filterOptions = {
        fromBlock: 0,
        toBlock: 'latest'
    };
    allEvents = await erc20TokenInstance.allEvents(filterOptions)
    return allEvents
}




module.exports = {
    addAuthTransferAgent,
    getAuthTransferAgents,
    revokeTransferAgentAuth,
    transferFromOwner,
    approveSpendableTokens,
    getBalances,
    tokenTransfer,
    allowance,
    getAllEvents
}