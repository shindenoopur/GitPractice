const contract = require('truffle-contract')
const web3APIs = require('../../utils/web3Apis')
const config = require('../../../truffle')

const simpleStorageJson =  require('../../../build/contracts/SimpleStorage')
const SimpleStorage = contract(simpleStorageJson)

const ENVIRONMENT = config.networks.development.name

SimpleStorage.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))

let simpleStorageInstance = web3APIs.getContractInstance(SimpleStorage)

let accounts

async function getAcc() {
    accounts = await web3APIs.getAccounts()
    let params = {
        contractInstance: simpleStorageInstance,
        eventName: "EventSet"
    }
    await web3APIs.getLogsAndInsertInSQLite(params)
    await simpleStorageInstance.set(1000, {from: accounts[0], gas: 3000000})
}

getAcc()

