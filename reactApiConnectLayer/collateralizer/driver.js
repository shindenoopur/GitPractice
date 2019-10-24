const collateralizerDriverInterface = require('./index')

async function initialSetup() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked getContractInstances() from driver class:')
    await await collateralizerDriverInterface.setNetworkAndInstances()
}

async function setupCollateralize() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked setupForCollateralize() from driver class:')
    await collateralizerDriverInterface.setupForCollateralize()
}

async function executeCollateralize() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked collateralizeDebt() from driver class:')
    await collateralizerDriverInterface.collateralizeDebt()
}

async function setupReturnCollateral() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked setupForReturnCollateral() from driver class:')
    await collateralizerDriverInterface.setupForReturnCollateral()
}

async function executeReturnCollateral() {
    console.log('\x1b[36m%s\x1b[0m', '\nInvoked returnCollateralDebt() from driver class:')
    await  collateralizerDriverInterface.returnCollateralDebt()
}

async function setupSeizeCollateral() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked setupForSeizeCollateral() from driver class:')
    await collateralizerDriverInterface.setupForSeizeCollateral()
}

async function executeSeizeCollateral() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked seizeCollateralDebt() from driver class:')
    await collateralizerDriverInterface.seizeCollateralDebt()
}

async function invokeAllFunctions(){
    await initialSetup()
    await setupCollateralize()
    await executeCollateralize()
    await setupReturnCollateral()
    await executeReturnCollateral()
    await setupSeizeCollateral()
    await executeSeizeCollateral()
}

invokeAllFunctions()