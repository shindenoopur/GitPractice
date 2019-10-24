const config = require('../../truffle')
const fs = require("fs");
const solc = require('solc')

function deployBorrower() {
    let source = fs.readFileSync('/home/node/app/contracts/Borrower.sol', 'utf8');
    let compiledContract = solc.compile(source, 1);
    console.log('compiledContract: ', compiledContract)
    let abi = compiledContract.contracts['Borrower'].interface;
    let bytecode = compiledContract.contracts['Borrower'].bytecode;
    let MyContract = web3.eth.contract(JSON.parse(abi));

    var myContractReturned = MyContract.new('0x23ea87880eE3b47feEfd1Cd5e89d7683d3423836', '0x23ea87880eE3b47feEfd1Cd5e89d7683d3423836','0x23ea87880eE3b47feEfd1Cd5e89d7683d3423836','0x23ea87880eE3b47feEfd1Cd5e89d7683d3423836', '0x23ea87880eE3b47feEfd1Cd5e89d7683d3423836', {
        from:'0xFe36C14742f3fF3CcBAb098B839d4c9B99922eFe',
        data:bytecode,
        gas:8000000}, function(err, myContract){
        if(!err) {
            // NOTE: The callback will fire twice!
            // Once the contract has the transactionHash property set and once its deployed on an address.
            // e.g. check tx hash on the first call (transaction send)
            if(!myContract.address) {
                console.log(myContract.transactionHash) // The hash of the transaction, which deploys the contract

                // check address on the second call (contract deployed)
            } else {
                console.log('contract address: ', myContract.address) // the contract address
            }
            // Note that the returned "myContractReturned" === "myContract",
            // so the returned "myContractReturned" object will also get the address set.
        }
    });
}

// deployBorrower()

// const ENVIRONMENT = config.networks.development.name //Uncomment for testing on other than Goerli network
let ENVIRONMENT = 'goerli' //default environment
if (process.env.TEST_NETWORK !== undefined) {
    ENVIRONMENT = config.networks[process.env.TEST_NETWORK].name
}

const Web3 = require('web3');

const web3  = new Web3(new Web3.providers.HttpProvider(config.networks[ENVIRONMENT].protocol + '://' + config.networks[ENVIRONMENT].host + ':' + config.networks[ENVIRONMENT].port));
const contract = require('truffle-contract')
const BCTokenJson = require('../../build/contracts/BCToken')
const BCToken = contract(BCTokenJson)

const ethJsUtil = require('ethereumjs-util')
const leftPad = require('left-pad')

const SQLite = require('./sqlite')


//jsonrpc and id necessary for moving ahead of time
const jsonrpc = '2.0'
const id = 0

//Gets the web3 accounts
// Gets a list of accounts the node controls
function getAccounts() {
    return new Promise((resolve, reject) => {
        web3.eth.getAccounts(function (error, ethAccounts) {
            if (error) {
                reject({
                    status: 'failure',
                    message: error.message,
                    data: []
                })
            } else {
                // owner = ethAccounts[0]
               resolve({
                   status: 'success',
                   message: 'Fetched ethereum accounts are: ',
                   data: ethAccounts
               })
            }
        })
    })
}

//Gets the contract instance
const getContractInstance = function (contract, flag, abi){
    // console.log('contract.address in getContractInstance: ', contract.address)
    if (flag) {
        return web3.eth.contract(JSON.parse(abi))
    }
    return (web3.eth.contract(contract.abi).at(contract.address))
}

//Gets balances
const getBalances = async function (addresses){
    let balance
    let accountsBalArray = []
    //Get the BCToken instance
    BCToken.setNetwork(getNetworkId(ENVIRONMENT))
    let tokenInstance = getContractInstance(BCToken)
    addresses.forEach((element) => {
        balance = tokenInstance.balanceOf.call(element)
        console.log('Balance of [',element,'] = ', balance.toString())
        accountsBalArray.push({
            address: element,
            balance: balance.toNumber()
        })
    })
    return accountsBalArray
}


const getNetworkId = function(environment){
    return config.networks[environment].network_id
}

const getProvider = function(environment){
    return (config.networks[environment].protocol + '://' + config.networks[environment].host + ':' + config.networks[environment].port)
}

async function getSignaturesRSV(account, message){
    let response = {
        address: '',
        r: '',
        s: '',
        v: ''
    }
    const rsvAccount = ethJsUtil.fromRpcSig(web3.eth.sign(account, message))
    response.address = account
    response.r = ethJsUtil.bufferToHex(rsvAccount.r)
    response.s = ethJsUtil.bufferToHex(rsvAccount.s)
    response.v = rsvAccount.v
    return response
}

/*
* Function that calculates the equivalent of keccak256(abi.encodePacked(...args))
* */
//TODO this function does not takes any negative number @balaji investigate how can we use negative numbers also
const getSoliditySha3 = function(...args){
    return (getSolidityHash(args))
}

function unlockAccount (account, password, seconds) {
    return new Promise(async (resolve, reject) => {
        try {
            await web3.personal.unlockAccount(account, password, seconds)
            resolve('Account unlocked successfully')
        } catch (error) {
            console.log('error in unlockAccount web3APIs: ', error)
            reject(error.message)
        }
    })

}

function lockAccount(account) {
    return new Promise(async (resolve, reject) => {
        try {
            await web3.personal.lockAccount(account)
            resolve('Account locked successfully')
        } catch (error) {
            console.log('error in unlockAccount web3APIs: ', error)
            reject(error.message)
        }
    })
}

const getSolidityHash = function(args){
    let concatenatedArgs = getConcatenatedArgs(args)
    return web3.sha3(concatenatedArgs, {encoding: "hex"})
}


const getConcatenatedArgs = function(args){
    let concatenatedArgs
    concatenatedArgs = args.map((element) => {
        if (typeof element === 'string'){
            //Then element can be an address too, in that case, remove 0x from the address
            if(element.substring(0, 2) === '0x'){
                return element.slice(2)
            }else {
                return web3.toHex(element).slice(2)
            }
        }

        if(typeof element === 'number'){
           return(leftPad((element).toString(16), 64, 0)) //64 characters, 0: Pad with 0
        }else {
            return ''
        }
    })
    concatenatedArgs = concatenatedArgs.join('')
    return concatenatedArgs
}

//Referred: https://medium.com/coinmonks/testing-time-dependent-logic-in-ethereum-smart-contracts-1b24845c7f72
const send = (method, params = []) =>
    web3.currentProvider.send({ id, jsonrpc, method, params })

async function fastForwardGanache(seconds) {
    await send('evm_increaseTime', [seconds])
    await send('evm_mine')
}

function bytes32ToUint(bytes32Data){
    return web3.toBigNumber(bytes32Data)
}

function isContract(address) {
    let code = web3.eth.getCode(address)
    return code !== '0x'
}

async function getLatestBlockTimestamp() {
    return (await web3.eth.getBlock('latest').timestamp)
}

/**
 * Function that gets the current event details and invokes inserts accordingly
 * */
async function getLogsAndInsertInSQLite(params) {
    return new Promise(async (resolve, reject) => {
        try {
            let filterOptions = {
                fromBlock: '0',
                toBlock: 'latest'
            }
            const myEvent = await params.contractInstance[params.eventName](filterOptions);
            myEvent.watch(async (err, logs) => {
                let response = await insertIntoEventBlock(logs)
                if (response.status === 'success') {
                    await insertAsPerTableDetail(logs)
                    resolve({
                        status: 'success',
                        message: 'Event Watched successfully',
                        data: []
                    })
                }
            })
        } catch (error) {
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })

}

/**
 * Function that inserts as per table
 * */
async function insertAsPerTableDetail(logs) {
    return new Promise(async (resolve, reject) => {
        let response = await SQLite.insert(getTableDetailsJson(logs))
        if (response.status === 'success') {
            resolve(response)
        } else {
            reject(response)
        }
    })
}

/**
 * Function that inserts into event_block table
 * */
async function insertIntoEventBlock(logs) {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            response = await SQLite.insert({
                event: 'EventBlock',
                params: [
                    logs.address,
                    logs.blockHash,
                    logs.blockNumber,
                    logs.event,
                    logs.logIndex,
                    logs.transactionHash,
                    logs.transactionIndex
                ]
            })
            if (response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch (error) {
            console.log('error in insertIntoEventBlock: ', error)
            reject(response)
        }

    })
}

/**
 * Function that inserts into user_details table
 * */
function insertIntoUserDetails(params) {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            response = await SQLite.insert({
                event: 'UserDetails',
                params: [
                    params.userDetails,
                    params.email
                ]
            })
            resolve(response)
        } catch (error) {
            console.log('error in insertIntoUserDetails: ', error)
            reject (response)
        }
    })
}

/**
 * Function that opens a DB Connection
 * */
function openDBConnection() {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await SQLite.openDBConnection())
        } catch (error) {
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function createAllSQLiteTables() {
    return new Promise(async (resolve, reject) => {
        let createAllTableResponse = await SQLite.createAll()
        if (createAllTableResponse.status === 'success') {
            resolve(createAllTableResponse)
        } else {
            reject(createAllTableResponse)
        }
    })
}

/**
 * Function that gets the tableDetails json object
 * */
function getTableDetailsJson(logDetails) {
    switch (logDetails.event) {
        case 'Agreement':
            return {
                event: logDetails.event,
                params: [
                    logDetails.args._agreementId,
                    logDetails.args._lender,
                    logDetails.args._borrower,
                    logDetails.args._timestamp.toNumber(),
                    logDetails.blockHash,
                    logDetails.logIndex
                ]
            }

        case 'LogDebtOrderFilled':
            return {
                event: logDetails.event,
                params: [
                    logDetails.args._principal.toNumber(),
                    logDetails.args._principalToken,
                    logDetails.args._underwriter,
                    logDetails.args._underwriterFee.toNumber(),
                    logDetails.args._relayer,
                    logDetails.args._relayerFee.toNumber(),
                    logDetails.args._agreementId,
                    logDetails.blockHash,
                    logDetails.logIndex
                ]
            }

        case 'LogSimpleInterestTermStart':
            return {
                event: logDetails.event,
                params: [
                    logDetails.args.principalToken,
                    logDetails.args.principalAmount.toNumber(),
                    logDetails.args.interestRate.toNumber(),
                    logDetails.args.amortizationUnitType.toNumber(),
                    logDetails.args.termLengthInAmortizationUnits.toNumber(),
                    logDetails.args.agreementId,
                    logDetails.blockHash,
                    logDetails.logIndex
                ]
            }

        case 'LogRegisterRepayment':
            return {
                event: logDetails.event,
                params: [
                    logDetails.args.payer,
                    logDetails.args.beneficiary,
                    logDetails.args.unitsOfRepayment.toNumber(),
                    logDetails.args.tokenAddress,
                    logDetails.args.agreementId,
                    logDetails.blockHash,
                    logDetails.logIndex,
                    logDetails.args.timestamp.toNumber()
                ]
            }

        case 'Deposited':
            return {
                event: logDetails.event,
                params: [
                    logDetails.args.payee,
                    logDetails.args.tokenAmount.toNumber(),
                    logDetails.args.timestamp.toNumber(),
                    logDetails.args.escrow,
                    logDetails.blockHash,
                    logDetails.logIndex
                ]
            }

        case 'Withdrawn':
            return {
                event: logDetails.event,
                params: [
                    logDetails.args.payee,
                    logDetails.args.tokenAmount.toNumber(),
                    logDetails.args.timestamp.toNumber(),
                    logDetails.args.escrow,
                    logDetails.blockHash,
                    logDetails.logIndex
                ]
            }

        case 'CollateralLocked':
            return {
                event: logDetails.event,
                params: [
                    logDetails.args.agreementID,
                    "N/A",
                    "N/A",
                    logDetails.args.token,
                    logDetails.args.amount.toNumber(),
                    logDetails.args.timestamp.toNumber(),
                    logDetails.logIndex
                ]
            }

        case 'CollateralReturned':
            return {
                event: logDetails.event,
                params: [
                    logDetails.args.agreementID,
                    logDetails.args.collateralizer,
                    "N/A",
                    logDetails.args.token,
                    logDetails.args.amount.toNumber(),
                    logDetails.args.timestamp.toNumber(),
                    logDetails.logIndex
                ]
            }

        case 'CollateralSeized':
            return {
                event: logDetails.event,
                params: [
                    logDetails.args.agreementID,
                    "N/A",
                    logDetails.args.beneficiary,
                    logDetails.args.token,
                    logDetails.args.amount.toNumber(),
                    logDetails.args.timestamp.toNumber(),
                    logDetails.logIndex
                ]
            }
        default: throw new Error('No Case matched in getTableDetailsJson')
    }
}

/**
 * Function that closes the database connection
 * */
function closeDBConnection() {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await SQLite.closeDBConnection())
        } catch (error) {
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/*
* Function that selects by given query
* */
async function selectByQuery(query) {
    return new Promise(async (resolve, reject) => {
        try{
            resolve(await SQLite.selectAsPerQuery(query))
        } catch (error) {
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the contract address from the transaction hash
 * */
function getContractAddressFromTransactionHash(txHash) {
    return new Promise(async (resolve, reject) => {
        try{
            let contractAddress = (await web3.eth.getTransactionReceipt(txHash)).contractAddress
            resolve({
                status: 'success',
                message: 'Contract address from transaction receipt',
                data: [contractAddress]
            })
        } catch (error) {
            console.log('error in getContractAddressFromTransactionHash: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

// getSoliditySha3()
module.exports = {
    getAccounts,
    getContractInstance,
    getBalances,
    getNetworkId,
    getProvider,
    getSignaturesRSV,
    getSoliditySha3,
    fastForwardGanache,
    bytes32ToUint,
    isContract,
    getLatestBlockTimestamp,
    createAllSQLiteTables,
    getLogsAndInsertInSQLite,
    selectByQuery,
    closeDBConnection,
    openDBConnection,
    unlockAccount,
    lockAccount,
    insertIntoUserDetails,
    getContractAddressFromTransactionHash

}
