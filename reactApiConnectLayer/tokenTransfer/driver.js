/**
 * Created by Balaji on 31/10/18.
 */
const tokenTransferInterface = require('./index')
const contract = require('truffle-contract')
const config = require('../../truffle.js')
const prettyJson = require('../utils/prettyJsonOutput')
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(config.networks.development.protocol + '://' + config.networks.development.host + ':' + config.networks.development.port));

const  web3APIs = require('../utils/web3Apis')
let txObject = {
    number: null
}

let owner, acc1, acc2, acc3

async function init() {
    return await web3APIs.getAccounts()
}

//Account 1 tries to send 50 tokens to Account 2, without approval from owner to spend tokens
async function failTransferFrom(amountToTransfer) {
    // noinspection JSAnnotator
    try {
        console.log('\x1b[36m%s\x1b[0m','\nInvoked transferFrom() from driver class:')
        let accounts = await init()
        owner = accounts[0]
        acc1 = accounts[1]
        acc2 = accounts[2]

        txObject = await tokenTransferInterface.transferFromOwner(owner, acc2, amountToTransfer, acc1)
    } catch (error) {
        return prettyJson.getResponseObject(txObject, 'failure', error.message, [])
    }
}

//Owner now approves tokenTransferProxy contract to spend 100 tokens
async function approveTokenSpending(noOfTokensToApprove) {
    try {
        console.log('\x1b[36m%s\x1b[0m','\nInvoked approveSpendableTokens() from driver class:')
        let tokenTransferProxyJson = require('../../build/contracts/TokenTransferProxy')
        let TokenTransferProxy = contract(tokenTransferProxyJson)

        //Get the TokenTransferProxy instance
        TokenTransferProxy.setNetwork('5777')
        tokenTransferProxyInstance = web3.eth.contract(TokenTransferProxy.abi).at(TokenTransferProxy.address)

        let accounts = await init()
        owner = accounts[0]

        txObject = await tokenTransferInterface.approveSpendableTokens(tokenTransferProxyInstance.address, noOfTokensToApprove, owner);
    } catch (error) {
        console.log(error)
        return prettyJson.getResponseObject(txObject, 'failure', error.message, [])
    }
}

//Adds authorized agent
async function addAgent() {
    try {
        console.log('\x1b[36m%s\x1b[0m','\nInvoked addAuthTransferAgent() from driver class:')
        let accounts = await init()
        let accToAddAutho = accounts[1]

        txObject = await tokenTransferInterface.addAuthTransferAgent(accToAddAutho)
    } catch (error) {
        return prettyJson.getResponseObject(txObject, 'failure', 'Failed to add authorizing agent', [])
    }
}

//Gets authorized agent
async function getAuthAgents() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked getAuthTransferAgents() from driver class:')
    await tokenTransferInterface.getAuthTransferAgents()
}

//Invoke transferFrom would result in successful transfer of tokens now
async function successTransferFrom(amountToTransfer) {
    // noinspection JSAnnotator
    try {
        console.log('\x1b[36m%s\x1b[0m','\nInvoked transferFrom() from driver class:')
        let accounts = await init()
        owner = accounts[0]
        acc1 = accounts[1]
        acc2 = accounts[2]

        txObject = await tokenTransferInterface.transferFromOwner(owner, acc2, amountToTransfer, acc1)
    } catch (error) {
        return prettyJson.getResponseObject(txObject, 'failure', error.message, [])
    }
}

async function transferTokens(tokens) {
    try {
        console.log('\x1b[36m%s\x1b[0m','\nInvoked transfer() from driver class:')
        let accounts = await init()
        let from = accounts[2]
        let to = accounts[1]
        txObject = await tokenTransferInterface.tokenTransfer(to, tokens, from)
    }catch (error) {
        return prettyJson.getResponseObject(txObject, 'failure', 'Token transfer failed', [])
    }
}

async function allowance(printString) {
    console.log('\x1b[36m%s\x1b[0m', printString)
    let accounts = await init()
    owner = accounts[0]
    await tokenTransferInterface.allowance(owner)
}

//Get Balances
async function getBalance(printString) {
    console.log('\x1b[36m%s\x1b[0m', printString)
    let accounts = await init()
    let addresses = [accounts[0], accounts[1], accounts[2]]
    await tokenTransferInterface.getBalances(addresses)
}

//Revokes authorization
async function revokeAuthorization() {
    try {
        console.log('\x1b[36m%s\x1b[0m','\nInvoked revokeTransferAgentAuth() from driver class:')
        let accounts = await init()
        let revokeAuthOfAcc = accounts[1]

        txObject = await  tokenTransferInterface.revokeTransferAgentAuth(revokeAuthOfAcc)
    } catch(error){
        return prettyJson.getResponseObject(txObject, 'failure', 'Failed to revoke authorization', [])
    }
}

async function invokeAllFunctions() {
    await getBalance('\nInvoked getBalances() pre transfer from driver class:')
    await failTransferFrom(50)
    await approveTokenSpending(500)
    await allowance('\nInvoked allowance() pre spending from driver class:')
    await addAgent()
    await getAuthAgents()
    await successTransferFrom(100)
    await allowance('\nInvoked allowance() post spending from driver class:')
    await transferTokens(30)
    await getBalance('\nInvoked getBalances() post transfer from driver class:')


    //  await revokeAuthorization()
}

invokeAllFunctions()

