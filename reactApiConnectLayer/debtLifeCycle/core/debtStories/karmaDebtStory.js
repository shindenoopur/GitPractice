/**
 * Created by Balaji on 05/03/2019
 * */

const driver = require('./driverClass/driver')

async function invokeDriverClass() {
    driver.invokeAllFunctions('karmaDebt')
}

invokeDriverClass()
