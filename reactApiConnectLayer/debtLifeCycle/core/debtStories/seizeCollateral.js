/**
 * Created by Balaji on 01/23/2018
 * */
//TODO @balaji ensure that part collateral is siezed and the remaining is given back to the guarantor
    // TODO above feature will be implemented when we do the TODO's mentioned in DebtKernel.sol
const driver = require('./driverClass/driver')

async function invokeDriverClass() {
    driver.invokeAllFunctions('seizeCollateral')
}

invokeDriverClass()