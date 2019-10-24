/**
 * Created by Balaji on 01/23/2018
 * */

const driver = require('./driverClass/driver')

async function invokeDriverClass() {
    driver.invokeAllFunctions('paidPrincipalNotInterest')
}

invokeDriverClass()