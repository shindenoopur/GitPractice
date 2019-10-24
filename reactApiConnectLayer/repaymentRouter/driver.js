const repaymentDriverInterface = require('./index')
async function getBalances(printString){
    console.log('\x1b[36m%s\x1b[0m',printString)
    await repaymentDriverInterface.getBalances()
}

async function transferTokens() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked transferTokens() from driver class:')
    await repaymentDriverInterface.transferTokens()
}

async function approveTokenSpending(){
    console.log('\x1b[36m%s\x1b[0m','\nInvoked approve() from driver class:')
    await repaymentDriverInterface.approveTokens()
}

async function addAuthTransferAgent() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked addAuthTransferAgent() from driver class:')
    await repaymentDriverInterface.addAuthTransferAgent()
}

async function getAuthTransferAgents() {
    console.log('\x1b[36m%s\x1b[0m', '\nInvoked getAuthTransferAgents() from driver class:')
    await  repaymentDriverInterface.getAuthTransferAgents()
}

async function repay() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked repay() from driver class:')
    await repaymentDriverInterface.repay()
}


async function invokeAllFunctions(){
    await getBalances('\nInvoked getBalances() Pre-Repayment from driver class:')
    await transferTokens()
    await approveTokenSpending()
    await addAuthTransferAgent()
    await getAuthTransferAgents()
    await  repay()
}


invokeAllFunctions()

