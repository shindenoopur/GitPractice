const debtKernelDriverInterface = require('./index')

async function fillDebtOrderKernelDriver() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked fillDebtOrderKernel() from driver class:')
    await debtKernelDriverInterface.fillDebtOrderKernel()
}

async function cancelDebtOrderIssuanceDriver() {
    console.log('\x1b[36m%s\x1b[0m', '\nInvoked cancelDebtOrderIssuance() from driver class:')
    await  debtKernelDriverInterface.cancelDebtOrderIssuance()
}

async function debtOrderCancelDriver() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked debtOrderCancel() from driver class:')
    await debtKernelDriverInterface.debtOrderCancel()
}

async function getBalances(printString){
    console.log('\x1b[36m%s\x1b[0m',printString)
    await debtKernelDriverInterface.getBalances()
}

async function invokeAllFunctions(){
    await fillDebtOrderKernelDriver()
    await getBalances('\nInvoked getBalances() Post-Fill DebtOrder from driver class:')
    await cancelDebtOrderIssuanceDriver()
    await debtOrderCancelDriver()
}

invokeAllFunctions()
