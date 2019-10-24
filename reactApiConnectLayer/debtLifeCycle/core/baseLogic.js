/**
 * Created by Balaji on 01/23/19.
 */

const web3APIs = require('../../utils/web3Apis')
const contract = require('truffle-contract')
const lodash = require('lodash')
const isMined = require('../../utils/isMined')
const prettyJson = require('../../utils/prettyJsonOutput')
const customFunctions = require('../../../test/utils/debtRegistry/customFunctions')
const hashingJSON = require('../../utils/hashing_json/createHash/createJSONHash')
const demoJSON = require('../../utils/hashing_json/demoJSONFile/schema')
const config = require('../../../truffle')
const utils = require('../../utils/utils')
const async = require('async');
const demoValues = require('../demoValues/demoValues')
const ledger = require('../fetchLedger/ledger')
const consoleTable = require('console.table')
/*
* Contract related constants
* */
const debtKernelJson =  require('../../../build/contracts/DebtKernel')
const DebtKernel = contract(debtKernelJson)

const erc20TokenJson = require('../../../build/contracts/BCToken')
const ERC20Token = contract(erc20TokenJson)

const debtRegistryJson = require('../../../build/contracts/DebtRegistry')
const DebtRegistry = contract(debtRegistryJson)

const collateralizedSimpleInterestTermsContractJson = require('../../../build/contracts/CollateralizedSimpleInterestTermsContract')
const CollateralizedSimpleInterestTermsContract = contract(collateralizedSimpleInterestTermsContractJson)

const repaymentRouterJson = require('../../../build/contracts/RepaymentRouter')
const RepaymentRouter = contract(repaymentRouterJson)

const escrowRegistryJson = require('../../../build/contracts/EscrowRegistry')
const EscrowRegistry= contract(escrowRegistryJson)

const debtTokenJson = require('../../../build/contracts/DebtToken')
const DebtToken = contract(debtTokenJson)

const escrowJson = require('../../../build/contracts/Escrow')
const Escrow = contract(escrowJson)

const tokenRegistryJson = require('../../../build/contracts/TokenRegistry')
const TokenRegistry = contract(tokenRegistryJson)

const collateralizerJson = require('../../../build/contracts/Collateralizer')
const Collateralizer = contract(collateralizerJson)

const tokenTransferProxyJson = require('../../../build/contracts/TokenTransferProxy')
const TokenTransferProxy = contract(tokenTransferProxyJson)

const contractRegistryJson = require('../../../build/contracts/ContractRegistry')
const  ContractRegistry = contract(contractRegistryJson)

const borrowerJson = require('../../../build/contracts/Borrower')
const Borrower = contract(borrowerJson)


const borrowerRegistryJson = require('../../../build/contracts/BorrowerRegistry')
const BorrowerRegistry = contract(borrowerRegistryJson)

/*
* End of Contract related variables
* */

//Required variable
let ENVIRONMENT = 'goerli' //default environment
if (process.env.TEST_NETWORK !== undefined) {
    ENVIRONMENT = config.networks[process.env.TEST_NETWORK].name
}

//setInstance() variables
let escrowInstance, erc20TokenInstance, tokenRegistryInstance, debtKernelInstance, tokenTransferProxyInstance, debtTokenInstance, debtRegistryInstance, collateralizerInstance,
    collateralizedSimpleInterestTermsContractInstance, contractRegistryInstance, repaymentRouterInstance, escrowRegistryInstance, borrowerInstance, borrowerRegistryInstance
//

//Accounts variable
let karmaMainAccount, karmaTransactionInitiator


//fillDebtOrderPreRequisites() variables
let orderAddresses = [], orderValues = [], orderBytes32 = [], signaturesV = [], signaturesR = [], signaturesS = []

const HOUR_LENGTH_IN_SECONDS = 60 * 60;
const DAY_LENGTH_IN_SECONDS = HOUR_LENGTH_IN_SECONDS * 24
// const WEEK_LENGTH_IN_SECONDS = DAY_LENGTH_IN_SECONDS * 7;
// const MONTH_LENGTH_IN_SECONDS = DAY_LENGTH_IN_SECONDS * 30;
// const YEAR_LENGTH_IN_SECONDS = DAY_LENGTH_IN_SECONDS * 365;

/**
 * Function that sets the network for all the Contracts
 * @return {{data, message, status}}
 * */
function setNetwork() {
    try{
        DebtKernel.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        DebtToken.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        DebtRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        CollateralizedSimpleInterestTermsContract.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        RepaymentRouter.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        ERC20Token.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        EscrowRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        Escrow.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        TokenRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        Collateralizer.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        TokenTransferProxy.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        ContractRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        Borrower.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
        BorrowerRegistry.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))

        prettyJson.prettyPrint([{message: 'Network setup successful'}])
        return 0
    }catch(e){
        return prettyJson.getResponseObject({number: null}, 'failure', e.message, [])
    }
}

/**
 * Function that sets the contract instances
 * @return {number}
 * */
function setInstances() {
    debtKernelInstance = web3APIs.getContractInstance(DebtKernel)

    setWatch({
        contractInstance: debtKernelInstance,
        eventName: "LogDebtOrderFilled"
    })

    setWatch({
        contractInstance: debtKernelInstance,
        eventName: "Agreement"
    })

    debtTokenInstance = web3APIs.getContractInstance(DebtToken)
    debtRegistryInstance = web3APIs.getContractInstance(DebtRegistry)
    collateralizedSimpleInterestTermsContractInstance = web3APIs.getContractInstance(CollateralizedSimpleInterestTermsContract)

    setWatch({
        contractInstance: collateralizedSimpleInterestTermsContractInstance,
        eventName: "LogSimpleInterestTermStart"
    })

    setWatch({
        contractInstance: collateralizedSimpleInterestTermsContractInstance,
        eventName: "LogRegisterRepayment"
    })

    erc20TokenInstance= web3APIs.getContractInstance(ERC20Token)
    repaymentRouterInstance = web3APIs.getContractInstance(RepaymentRouter)
    escrowRegistryInstance = web3APIs.getContractInstance(EscrowRegistry)
    escrowInstance = web3APIs.getContractInstance(Escrow)

    setWatch({
        contractInstance: escrowInstance,
        eventName: "Deposited",
        lenderAddress: escrowInstance.address
    })

    setWatch({
        contractInstance: escrowInstance,
        eventName: "Withdrawn",
        lenderAddress: escrowInstance.address
    })

    tokenRegistryInstance = web3APIs.getContractInstance(TokenRegistry)
    collateralizerInstance = web3APIs.getContractInstance(Collateralizer)

    setWatch({
        contractInstance: collateralizerInstance,
        eventName: "CollateralLocked"
    })

    setWatch({
        contractInstance: collateralizerInstance,
        eventName: "CollateralReturned"
    })

    setWatch({
        contractInstance: collateralizerInstance,
        eventName: "CollateralSeized"
    })


    tokenTransferProxyInstance = web3APIs.getContractInstance(TokenTransferProxy)
    contractRegistryInstance = web3APIs.getContractInstance(ContractRegistry)
    borrowerInstance = web3APIs.getContractInstance(Borrower)
    borrowerRegistryInstance = web3APIs.getContractInstance(BorrowerRegistry)
    prettyJson.prettyPrint([{message: 'Instances setup successful'}])
    return 0
}

/**
 * Setup all the event watches
 * */
function setWatch(params) {
    web3APIs.getLogsAndInsertInSQLite(params)
}

/**
 * Function that gets all the ethereum account address
 * @return {JSON} JSON object containing the ethereum account addresses
 * */
function  getAllEthAccounts() {
    return new Promise(async(resolve, reject) => {
        let accountsObj = {}
        let accounts
        try {
            let response = await web3APIs.getAccounts()
            // console.log('response: ', response)
            if (response.status === 'success') {
                accounts = response.data
                karmaMainAccount = accounts[0]
                karmaTransactionInitiator = accounts[9]
                let i = 1
                accounts.forEach((acc) => {
                    accountsObj['acc' + i++ ] = acc
                })
                // console.log('accountsObj: ', accountsObj)

                // prettyJson.prettyPrint([accountsObj])
                resolve({
                    status: response.status,
                    message: response.message,
                    data: [accountsObj]
                })
            } else {
                reject(response)
            }
        } catch (error) {
            console.log('error in getAllEthAccounts baseLogic: ', error)
            reject(response)
        }

    })
}

/**
 * Function that returns all the contract addresses required for setting up the debtLifeCycle pre-requisites
 * @return {{data: {erc20TokenAddress: *, escrowAddress: *, contractRegistryAddress: *, escrowRegistryAddress: *, debtTokenAddress: *, repaymentRouterAddress: *, tokenRegistryAddress: *, debtRegistryAddress: *, collateralizeTermsContractAddress: *, borrowerAddress: *, collateralizeAddress: *, debtKernelAddress: *, tokenTransferProxyAddress: *}[], message: string, status: string}} JSON object containing all the contract addresses
 * */
function getContractAddresses() {
    let contractAddresses = {
        debtKernelAddress: debtKernelInstance.address,
        debtTokenAddress: debtTokenInstance.address,
        debtRegistryAddress: debtRegistryInstance.address,
        collateralizeTermsContractAddress: collateralizedSimpleInterestTermsContractInstance.address,
        erc20TokenAddress: erc20TokenInstance.address,
        repaymentRouterAddress: repaymentRouterInstance.address,
        escrowRegistryAddress: escrowRegistryInstance.address,
        escrowAddress: escrowInstance.address,
        tokenRegistryAddress: tokenRegistryInstance.address,
        collateralizeAddress: collateralizerInstance.address,
        tokenTransferProxyAddress: tokenTransferProxyInstance.address,
        contractRegistryAddress: contractRegistryInstance.address,
        borrowerAddress: borrowerInstance.address,
        borrowerRegistry: borrowerRegistryInstance.address
    }
    prettyJson.prettyPrint([contractAddresses])
    return ({
        status: 'success',
        message: 'Deployed contract addresses are',
        data: [contractAddresses]
    })
}

/**
 * Function that prints the actors
 * */
function printActors(actors) {
    prettyJson.prettyPrint([actors])
}

/**
 * Function that sets the DebtToken address in DebtKernel
 * */
function setDebtToken() {
    return new Promise(async(resolve, reject) => {
        let contractAddress, zeroAddress = '0x0000000000000000000000000000000000000000'
        try {
            console.log('KarmaMainAccount: ', karmaMainAccount)
            contractAddress = await debtKernelInstance.debtToken.call({from: karmaMainAccount})
            console.log('debtToken in DebtKernel 1: ', contractAddress)
            if ((contractAddress === zeroAddress || contractAddress !== zeroAddress) && contractAddress !== debtTokenInstance.address.toLowerCase()) {
               await unlockAccount(karmaMainAccount)
                await isMined.checkMining(await debtKernelInstance.setDebtToken(debtTokenInstance.address, {from:karmaMainAccount, gas:8000000}))
                await lockAccount(karmaMainAccount)
                contractAddress = await debtKernelInstance.debtToken.call({from: karmaMainAccount})
                console.log('debtToken in DebtKernel 2: ', contractAddress)
                resolve('DebtToken address set successfully')
            } else {
                resolve('DebtToken address is already set')
            }
        } catch (error) {
            console.log('error in setDebtToken baseLogic: ', error)
            reject(error.message)
        }
    })
}

/**
 * Function that sets EscrowRegistry address in DebtKernel
 * */
function setEscrowRegistry() {
    return new Promise(async (resolve, reject) => {
        let contractAddress, zeroAddress = '0x0000000000000000000000000000000000000000'
        try {
            contractAddress = await debtKernelInstance.escrowRegistry.call({from: karmaMainAccount})
            console.log('escrowRegistry in DebtKernel 1: ', contractAddress)
            if ((contractAddress === zeroAddress || contractAddress !== zeroAddress)  && contractAddress !== escrowRegistryInstance.address.toLowerCase()) {
               await unlockAccount(karmaMainAccount)
                await isMined.checkMining(await debtKernelInstance.setEscrowRegistry(escrowRegistryInstance.address, {from:karmaMainAccount, gas:8000000}))
                await lockAccount(karmaMainAccount)
                contractAddress = await debtKernelInstance.escrowRegistry.call({from: karmaMainAccount})
                console.log('escrowRegistry in DebtKernel 2: ', contractAddress)
                resolve('EscrowRegistry address set successfully')
            } else {
                resolve('EscrowRegistry address is already set')
            }
        } catch (error) {
            console.log('error in setEscrowRegistry baseLogic: ', error)
            reject(error.message)
        }
    })
}

/**
 * Function that adds authorized mint agent for DebtToken
 * */
function addDebtTokenAuthorizedMintAgent(address) {
    return new Promise(async (resolve, reject) => {
        let agents
        try {
            agents = await debtTokenInstance.getAuthorizedMintAgents.call({from: karmaMainAccount})
            console.log('agents 1', agents)
            if (!(lodash.indexOf(agents, address.toLowerCase()) !== -1)) {
               await unlockAccount(karmaMainAccount)
                await isMined.checkMining(await debtTokenInstance.addAuthorizedMintAgent(address, {from: karmaMainAccount, gas: 8000000}))
                await lockAccount(karmaMainAccount)
                agents = await debtTokenInstance.getAuthorizedMintAgents.call({from: karmaMainAccount})
                console.log('agents 2', agents)
                resolve('Provided address added as an authorized mint agent in DebtToken')
            } else {
                resolve('Provided address is already added as an authorized mint agent in DebtToken')
            }
        } catch (error) {
            console.log('error in addDebtTokenAuthorizedMintAgent baseLogic: ', error)
            reject(error.message)
        }
    })
}

/**
 * Function that adds authorized insert agent in DebtRegistry
 * */
function addDebtRegistryAuthorizedInsertAgent(address) {
    return new Promise(async (resolve, reject) => {
        let agents
        try {
            agents = await debtRegistryInstance.getAuthorizedInsertAgents.call({from: karmaMainAccount})
            console.log('agents 1', agents)
            if (!(lodash.indexOf(agents, address.toLowerCase()) !== -1)) {
               await unlockAccount(karmaMainAccount)
                await isMined.checkMining(await debtRegistryInstance.addAuthorizedInsertAgent(address, {from: karmaMainAccount, gas: 8000000}))
                await lockAccount(karmaMainAccount)
                agents = await debtRegistryInstance.getAuthorizedInsertAgents.call({from: karmaMainAccount})
                console.log('agents 2', agents)
                resolve('Provided address added as an authorized insert agent in DebtRegistry')
            } else {
                resolve('Provided address is already added as an authorized insert agent in DebtRegistry')
            }
        } catch (error) {
            console.log('error in addDebtRegistryAuthorizedInsertAgent baseLogic: ', error)
            reject(error.message)
        }
    })
}

/**
 * Function that sets authorized edit agent in DebtRegistry
 * */
function addDebtRegistryAuthorizedEditAgent(address) {
    return new Promise(async (resolve, reject) => {
        let agents
        try {
            agents = await debtRegistryInstance.getAuthorizedEditAgents.call({from: karmaMainAccount})
            console.log('agents 1', agents)
            if (!(lodash.indexOf(agents, address.toLowerCase()) !== -1)) {
               await unlockAccount(karmaMainAccount)
                await isMined.checkMining(await debtRegistryInstance.addAuthorizedEditAgent(address, {from: karmaMainAccount, gas: 8000000}))
                await lockAccount(karmaMainAccount)
                agents = await debtRegistryInstance.getAuthorizedEditAgents.call({from: karmaMainAccount})
                console.log('agents 2', agents)
                resolve('Provided address added as an authorized edit agent in DebtRegistry')
            } else {
                resolve('Provided address is already added as an authorized edit agent in DebtRegistry')
            }
        } catch (error) {
            console.log('error in addDebtRegistryAuthorizedEditAgent baseLogic: ', error)
            reject(error.message)
        }
    })
}

/**
 * Function that adds transfer agent in TokenTransferProxy
 * */
function addTokenTransferProxyTransferAgent(address) {
    return new Promise(async (resolve, reject) => {
        let agents
        try {
            agents = await tokenTransferProxyInstance.getAuthorizedTransferAgents.call({from: karmaMainAccount})
            console.log('agents 1', agents)
            if (!(lodash.indexOf(agents, address.toLowerCase()) !== -1)) {
               await unlockAccount(karmaMainAccount)
                await isMined.checkMining(await tokenTransferProxyInstance.addAuthorizedTransferAgent(address, {from: karmaMainAccount, gas: 8000000}))
                await lockAccount(karmaMainAccount)
                agents = await tokenTransferProxyInstance.getAuthorizedTransferAgents.call({from: karmaMainAccount})
                console.log('agents 2', agents)
                resolve('Provided address added as an authorized transfer agent in TokenTransferProxy')
            } else {
                resolve('Provided address is already added as an authorized transfer agent in TokenTransferProxy')
            }
        } catch (error) {
            console.log('error in addTokenTransferProxyTransferAgent baseLogic: ', error)
            reject(error.message)
        }
    })
}

/**
 * Function that adds collateralize agent in Collateralizer
 * */
function addCollateralizerAuthorizedCollateralizeAgent(address) {
    return new Promise(async (resolve, reject) => {
        let agents
        try {
            agents = collateralizerInstance.getAuthorizedCollateralizeAgents.call({from: karmaMainAccount})
            console.log('agents 1', agents)
            if (!(lodash.indexOf(agents, address.toLowerCase()) !== -1)) {
               await unlockAccount(karmaMainAccount)
                await isMined.checkMining(await collateralizerInstance.addAuthorizedCollateralizeAgent(address, { from: karmaMainAccount, gas: 8000000 }))
                await lockAccount(karmaMainAccount)
                agents = collateralizerInstance.getAuthorizedCollateralizeAgents.call({from: karmaMainAccount})
                console.log('agents 2', agents)
                resolve('Provided address added as an authorized collateralize agent in Collateralizer')
            } else {
                resolve('Provided address is already added as an authorized collateralize agent in Collateralizer')
            }
        } catch (error) {
            console.log('error in addCollateralizerAuthorizedCollateralizeAgent baseLogic: ', error)
            reject(error.message)
        }
    })
}

/**
 * Function that sets token attributes in token registry
 * */
function setTokenRegistryTokenAttributes() {
    return new Promise(async (resolve, reject) => {
        let tokenSymbol, tokenAddress, tokenName, numberOfDecimals
        try {
            tokenSymbol = await erc20TokenInstance.symbol.call({from: karmaMainAccount})
            tokenAddress = erc20TokenInstance.address
            tokenName = await erc20TokenInstance.name.call({from: karmaMainAccount})
            numberOfDecimals = await erc20TokenInstance.decimals.call({from: karmaMainAccount})

            let tokenAttributes = await tokenRegistryInstance.getTokenAttributesBySymbol.call(tokenSymbol, {from: karmaMainAccount})
            let tokenAddressFromTokenRegistry = tokenAttributes[0],
                tokenIndexFromTokenRegistry = tokenAttributes[1],
                tokenNameFromTokenRegistry = tokenAttributes[2],
                numberOfDecimalsFromTokenRegistry = tokenAttributes[3],
                tokenSymbolFromTokenRegistry = await tokenRegistryInstance.getTokenSymbolByIndex.call(tokenIndexFromTokenRegistry, {from: karmaMainAccount})

            if (tokenSymbol !== tokenSymbolFromTokenRegistry && tokenAddress !== tokenAddressFromTokenRegistry && tokenName !== tokenNameFromTokenRegistry && numberOfDecimals !== numberOfDecimalsFromTokenRegistry) {
                await unlockAccount(karmaMainAccount)
                await isMined.checkMining(await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, { from: karmaMainAccount, gas: 8000000 }))//adds the token to tokenRegistry
                await lockAccount(karmaMainAccount)
                resolve('Token attributes successfully in TokenRegistry')
            } else {
                resolve('Token attributes is already set in TokenRegistry')
            }
        } catch (error) {
            console.log('error in setTokenRegistryTokenAttributes baseLogic: ', error)
            reject(error.message)
        }
    })
}
/**
 * Function that does the system-wide setting for debtLifeCycle story
 * @return {Promise<any>} Sets the system wide settings and returns 0
 * */
function systemWideSettings() {
    return new Promise(async (resolve, reject) => {
        try {
            //Checks whether DebtToken address is already set
            await setDebtToken()
            await setEscrowRegistry()
            await addDebtTokenAuthorizedMintAgent(debtKernelInstance.address)
            await addDebtRegistryAuthorizedInsertAgent(debtTokenInstance.address)
            await addDebtRegistryAuthorizedEditAgent(debtTokenInstance.address)
            await addTokenTransferProxyTransferAgent(debtKernelInstance.address)
            await addCollateralizerAuthorizedCollateralizeAgent(collateralizedSimpleInterestTermsContractInstance.address)
            await addTokenTransferProxyTransferAgent(collateralizerInstance.address)
            await setTokenRegistryTokenAttributes()
            prettyJson.prettyPrint([{message: 'System wide settings is successful'}])
            resolve({
                status: 'success',
                message: 'System Wide settings is successful',
                data: []
            })
        } catch (error) {
            console.log('error in systemWideSettings baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that does the pre-reqs settings that are required for fillDebtOrder()
 * @param {json} params - The argument JSON object
 * @return {Promise<void>}
 * */
function fillDebtOrderPreRequisites(params) {
    return new Promise(async (resolve, reject) => {
        try{
            let tokenSymbol, tokenAddress, tokenIndex
            let agreementId, debtOrderHash, underWriterMessageHash, termsContractParameters, debtorSig, creditorSig, underwriterSig, expirationTimestampInSec, collateralTokenIndex, principalTokenIndex, termsContract
            let nullBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

            tokenSymbol = await erc20TokenInstance.symbol.call({from: karmaMainAccount})
            tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol, {from: karmaMainAccount})

            principalTokenIndex = tokenIndex.toNumber()
            collateralTokenIndex = principalTokenIndex

            tokenAddress = params.erc20TokenAddress

            let version = params.version,
                debtor  = params.debtor,
                underwriter  = params.underwriter,
                termsContractAddress = params.collateralizeTermsContractAddress,
                creditor = params.escrowAddress,
                relayer = params.relayer

            let underwriterFee = params.underwriterFee,
                relayerFee = params.relayerFee,
                creditorFee = params.creditorFee,
                debtorFee = params.debtorFee,
                underwriterRiskRating = params.underwriterRiskRating,
                salt = params.salt

            let principalAmount = params.principalAmount,
                interestRate = params.interestRate,
                amortizationUnit = params.amortizationUnit,
                termLength = params.termLength,
                collateralAmount = params.collateralAmount,
                gracePeriodInDays = params.gracePeriodInDays

            expirationTimestampInSec = ((await getLatestBlockTimestamp()).data[0] + (demoValues.SECONDS_IN_DAY * 30))
            prettyJson.prettyPrint([{expirationTimestampInSec: utils.timeStampToDate(expirationTimestampInSec)}])

            termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)

            termsContract = termsContractAddress     //termsContractAddress is already set above

            orderAddresses.push(version)
            orderAddresses.push(debtor)
            orderAddresses.push(underwriter)
            orderAddresses.push(termsContract)
            orderAddresses.push(tokenAddress)
            orderAddresses.push(relayer)

            orderValues.push(underwriterRiskRating)
            orderValues.push(salt)
            orderValues.push(principalAmount)
            orderValues.push(underwriterFee)
            orderValues.push(relayerFee)
            orderValues.push(creditorFee)
            orderValues.push(debtorFee)
            orderValues.push(expirationTimestampInSec)

            orderBytes32.push(termsContractParameters)
            agreementId = web3APIs.getSoliditySha3(version, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt)
            debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[6], orderValues[5],orderAddresses[5], orderValues[4], orderValues[7])
            underWriterMessageHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, orderValues[3], orderValues[2], orderAddresses[4], orderValues[7])

            //Checks if debtor is a contract address, then invoke approve() of BorrowerInstance else invoke approve of ERC20
            if(!web3APIs.isContract(debtor)) {
                await unlockAccount(debtor)
                await isMined.checkMining(await erc20TokenInstance.approve(tokenTransferProxyInstance.address, collateralAmount, {from: debtor, gas: 8000000}))
                await lockAccount(debtor)
            } else {
                await giveAllowance(karmaMainAccount, tokenTransferProxyInstance.address, collateralAmount)
            }

            //The creditor should approve the TokenTransferProxy to spend tokens greater than the principalAmount + debtorFee + relayerFee + underwriterFee
            //Checks if creditor is a contract address, then invoke approve() of EscrowInstance else invoke approve of ERC20
            let amountToApprove = 2 * (principalAmount + debtorFee + creditorFee + relayerFee + underwriterFee)
            if(!web3APIs.isContract(creditor)) {
                await unlockAccount(creditor)
                await isMined.checkMining(await erc20TokenInstance.approve(tokenTransferProxyInstance.address, amountToApprove, {from: creditor, gas: 8000000}))
                await lockAccount(creditor)
            } else {
                await giveAllowance(escrowInstance.address, tokenTransferProxyInstance.address, amountToApprove)
            }

            if(!web3APIs.isContract(debtor)) {
                await unlockAccount(debtor)
                debtorSig = await web3APIs.getSignaturesRSV(debtor, debtOrderHash)
                await lockAccount(debtor)
                signaturesR.push(debtorSig.r)
                signaturesS.push(debtorSig.s)
                signaturesV.push(debtorSig.v)
            } else {
                signaturesR.push(nullBytes32)
                signaturesS.push(nullBytes32)
                signaturesV.push(nullBytes32)
            }

            if(!web3APIs.isContract(creditor)){
                await unlockAccount(creditor)
                creditorSig = await web3APIs.getSignaturesRSV(creditor, debtOrderHash)
                await lockAccount(creditor)
                signaturesR.push(creditorSig.r)
                signaturesS.push(creditorSig.s)
                signaturesV.push(creditorSig.v)
            } else {
                signaturesR.push(nullBytes32)
                signaturesS.push(nullBytes32)
                signaturesV.push(nullBytes32)
            }

            await unlockAccount(underwriter)
            underwriterSig = await web3APIs.getSignaturesRSV(underwriter, underWriterMessageHash)
            await lockAccount(underwriter)
            signaturesR.push(underwriterSig.r)
            signaturesS.push(underwriterSig.s)
            signaturesV.push(underwriterSig.v)

            let args = {
                escrowAddress: creditor,
                debtor: debtor,
                relayer: relayer,
                underwriter: underwriter,
                addresses: orderAddresses,
                values: orderValues,
                bytes32: orderBytes32,
                sigV: signaturesV,
                sigR: signaturesR,
                sigS: signaturesS,
                numberOfDays: params.noOfDays,
                interestRate: interestRate
            }

            await toFillDebtOrder(args)

            let events = await debtKernelInstance.allEvents({fromBlock: '0', toBlock: 'latest'})
            events.get((err,logs) => {
                if(!err) {
                    console.log(JSON.stringify(logs))
                }
            })

            prettyJson.prettyPrint([{message: 'fillDebtOrder() pre requisites setup successful'}])
            resolve({
                status: 'success',
                message: 'fillDebtOrder() pre requisites setup successful',
                data: []
            })
        } catch (error) {
            console.log('error in setupFillDebtOrder baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gives allowance
 * */
function giveAllowance(owner, spender, amount) {
    return new Promise(async (resolve, reject) => {
        let fromAccount = web3APIs.isContract(owner)?karmaMainAccount:owner
        try {
                if(web3APIs.isContract(owner)) {
                    if (owner === escrowInstance.address) {
                        await unlockAccount(karmaMainAccount, 'password', 30)
                        await unlockAccount(fromAccount)
                        await isMined.checkMining(await escrowInstance.approve(spender, amount, {from: fromAccount, gas: 8000000}))
                        await lockAccount(fromAccount)
                        await lockAccount(karmaMainAccount)
                    }  else  {
                        await unlockAccount(karmaMainAccount, 'password', 30)
                        await unlockAccount(fromAccount)
                        //Get borrower instance as per params.debtor and not the predefined borrowerInstance
                        let borrowerInstance = getBorrowerInstance(owner)
                        await isMined.checkMining(await borrowerInstance.approve(spender, amount, {from: fromAccount, gas: 8000000}))
                        await lockAccount(fromAccount)
                        await lockAccount(karmaMainAccount)
                    }
                } else {
                    if (fromAccount !== karmaMainAccount) {
                        await unlockAccount(karmaMainAccount, 'password', 30)
                        await unlockAccount(fromAccount)
                        await isMined.checkMining(await erc20TokenInstance.approve(spender, amount, {from: fromAccount, gas: 8000000}))
                        await lockAccount(fromAccount)
                        await lockAccount(karmaMainAccount)
                    } else {
                        console.log('fromAccount and karmaMainAccount both are the same: ')
                        await unlockAccount(karmaMainAccount, 'password', 30)
                        await isMined.checkMining(await erc20TokenInstance.approve(spender, amount, {from: fromAccount, gas: 8000000}))
                        await lockAccount(karmaMainAccount)
                    }
                }
                resolve('Allowance granted')
        } catch(error) {
            console.log('error in giveAllowance baseLogic: ', error)
            reject(error.message)
        }
    })
}

function getBorrowerInstance(address) {
    const borrowerJson = require('../../../build/contracts/Borrower')
    const Borrower = contract(borrowerJson)
    Borrower.setNetwork(web3APIs.getNetworkId(ENVIRONMENT))
    Borrower.address = address
    return web3APIs.getContractInstance(Borrower)
}
/**
 * Function that executes the fillDebtOrder()
 * This will check whether the preRequisites has been set, then only it will execute the fillDebtOrder()
 * @param {json} params - The argument JSON object
 * @return {JSON}
 * */
function executeFillDebtOrder(params) {
    return new Promise(async (resolve, reject) => {
        try {
            let args = {
                escrowAddress: params.escrowAddress,
                debtor: params.debtor,
                relayer: params.relayer,
                underwriter: params.underwriter,
                addresses: orderAddresses,
                values: orderValues,
                bytes32: orderBytes32,
                sigV: signaturesV,
                sigR: signaturesR,
                sigS: signaturesS,
                numberOfDays: params.noOfDays,
                interestRate: params.interestRate
            }
            console.log('\tBalances before fillDebtOrder: \n')
            prettyJson.prettyPrint([await getLedgerBalance(params)])
            //UNCOMMENT if else when executing the command line demo for KarmaDebt
            if (params.invokedBy !== 'karmaDebt') {
                args.principalAmount = orderValues[2]
                await toFillDebtOrder(args)
                resolve({
                    status: 'success',
                    message: 'Loan made successfully',
                    data: []
                })
            }
else {
                let interestRate = params.interestRate,
                    amortizationUnit = params.amortizationUnit,
                    termLength = params.termLength,
                    collateralAmount = params.collateralAmount,
                    gracePeriodInDays = params.gracePeriodInDays

                args.values[2] = params.principalAmount
                args.principalAmount = orderValues[2]
                args.values[1] = params.salt
                let termsContractParameters = customFunctions.getTermsContractParameters(params.principalTokenIndex, args.principalAmount, interestRate, amortizationUnit, termLength, params.collateralTokenIndex, collateralAmount, gracePeriodInDays)
                orderBytes32[0] = termsContractParameters
                args.bytes32 = orderBytes32

                await unlockAccount(karmaMainAccount)
                await isMined.checkMining(await erc20TokenInstance.approve(tokenTransferProxyInstance.address, collateralAmount, {from: karmaMainAccount, gas: 8000000}))
                await lockAccount(karmaMainAccount)

                let amountToApprove = 2 * (args.principalAmount)
                await giveAllowance(escrowInstance.address, tokenTransferProxyInstance.address, amountToApprove)

                let agreementId = web3APIs.getSoliditySha3(args.addresses[0], args.addresses[1], args.addresses[2], args.values[0], params.termsContract, termsContractParameters, args.values[1])
                let debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, args.values[3], args.values[2], args.addresses[4], args.values[6], args.values[5], args.addresses[5], args.values[4], args.values[7])

                let underWriterMessageHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, args.values[3], args.values[2], args.addresses[4], args.values[7])
                await web3APIs.unlockAccount(params.underwriter, 'password', 10)
                let underwriterSig = await web3APIs.getSignaturesRSV(params.underwriter, underWriterMessageHash)
                await web3APIs.lockAccount(params.underwriter)
                signaturesR[2]=(underwriterSig.r)
                signaturesS[2]=(underwriterSig.s)
                signaturesV[2]=(underwriterSig.v)

                await toFillDebtOrder(args)
//
//                 console.log('lender state after 1st debt order: ', (await escrowInstance.getLenderState.call({from: karmaMainAccount})).toNumber())
//
//                 // Loan of 500
//                 let interestRate = demoValues[params.invokedBy].interestRate,
//                     amortizationUnit = demoValues[params.invokedBy].amortizationUnit,
//                     termLength = demoValues[params.invokedBy].termLength,
//                     collateralAmount = 500,
//                     gracePeriodInDays = demoValues[params.invokedBy].gracePeriodInDays
//
//                 args.values[2] = 500 //principalAmount
//                 args.principalAmount = args.values[2]
//                 args.values[1] = Date.now() //salt
//                 termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, args.principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
//                 orderBytes32[0] = termsContractParameters
//                 args.bytes32 = orderBytes32
//
//                await unlockAccount(karmaMainAccount)
//                 await isMined.checkMining(await erc20TokenInstance.approve(tokenTransferProxyInstance.address, collateralAmount, {from: karmaMainAccount, gas: 8000000}))
//                 await lockAccount(karmaMainAccount)
//
//                 let amountToApprove = 2 * (args.principalAmount)
//                 await giveAllowance(escrowInstance.address, tokenTransferProxyInstance.address, amountToApprove)
//
//                 agreementId = web3APIs.getSoliditySha3(args.addresses[0], args.addresses[1], args.addresses[2], args.values[0], termsContract, termsContractParameters, args.values[1])
//                 debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, args.values[3], args.values[2], args.addresses[4], args.values[6], args.values[5], args.addresses[5], args.values[4], args.values[7])
//
//                 underWriterMessageHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, args.values[3], args.values[2], args.addresses[4], args.values[7])
//                 await web3APIs.unlockAccount(params.underwriter, 'password', 10)
//                 underwriterSig = await web3APIs.getSignaturesRSV(params.underwriter, underWriterMessageHash)
//                 await web3APIs.lockAccount(params.underwriter)
//                 signaturesR[2]=(underwriterSig.r)
//                 signaturesS[2]=(underwriterSig.s)
//                 signaturesV[2]=(underwriterSig.v)
//
//                 await toFillDebtOrder(args)
//                 console.log('lender state after 2nd debt order: ', (await escrowInstance.getLenderState.call({from: karmaMainAccount})).toNumber())
//
//
//                 //Loan of 700
//                 interestRate = demoValues[params.invokedBy].interestRate
//                     amortizationUnit = demoValues[params.invokedBy].amortizationUnit
//                     termLength = demoValues[params.invokedBy].termLength
//                     collateralAmount = 700
//                     gracePeriodInDays = demoValues[params.invokedBy].gracePeriodInDays
//
//                 args.values[2] = 700 //principalAmount
//                 args.principalAmount = args.values[2]
//                 args.values[1] = Date.now() //salt
//                 termsContractParameters = customFunctions.getTermsContractParameters(principalTokenIndex, args.principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)
//                 orderBytes32[0] = termsContractParameters
//                 args.bytes32 = orderBytes32
//
//                 await unlockAccount(karmaMainAccount)
//                 await isMined.checkMining(await erc20TokenInstance.approve(tokenTransferProxyInstance.address, collateralAmount, {from: karmaMainAccount, gas: 8000000}))
//                 await lockAccount(karmaMainAccount)
//
//                 amountToApprove = 2 * (args.principalAmount)
//                 await giveAllowance(escrowInstance.address, tokenTransferProxyInstance.address, amountToApprove)
//
//                 agreementId = web3APIs.getSoliditySha3(args.addresses[0], args.addresses[1], args.addresses[2], args.values[0], termsContract, termsContractParameters, args.values[1])
//                 debtOrderHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, args.values[3], args.values[2], args.addresses[4], args.values[6], args.values[5], args.addresses[5], args.values[4], args.values[7])
//
//                 underWriterMessageHash = web3APIs.getSoliditySha3(debtKernelInstance.address, agreementId, args.values[3], args.values[2], args.addresses[4], args.values[7])
//                 await web3APIs.unlockAccount(params.underwriter, 'password', 10)
//                 underwriterSig = await web3APIs.getSignaturesRSV(params.underwriter, underWriterMessageHash)
//                 await web3APIs.lockAccount(params.underwriter)
//                 signaturesR[2]=(underwriterSig.r)
//                 signaturesS[2]=(underwriterSig.s)
//                 signaturesV[2]=(underwriterSig.v)
//
//                 await toFillDebtOrder(args)
//
//                 console.log('lender state after 3rd debt order: ', (await escrowInstance.getLenderState.call({from: karmaMainAccount})).toNumber())
//
//                 resolve({
//                     status: 'success',
//                     message: 'Loan made successfully',
//                     data: []
//                 })
            }
        }catch(error) {
            console.log('error in executeFillDebtOrder baseLogic: ', error)
            prettyJson.getResponseObject({number: null}, 'failure', error.message, [])
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })

}

function toFillDebtOrder(params) {
    return new Promise(async (resolve, reject) => {
        let block
        try {
            // let lenderState = await escrowInstance.getLenderState.call()
            // console.log('Lender state in toFillDebtOrder: ', lenderState.toNumber())
            await unlockAccount(karmaMainAccount, 'password', 30)
            await unlockAccount(karmaTransactionInitiator)
            // console.log('params in toFillDebtOrder: ', params)
            // console.log('escrow current state: ************', (await escrowInstance.getLenderState.call().toNumber()))
            block = await isMined.checkMining(
                await debtKernelInstance.fillDebtOrder(params.escrowAddress, karmaMainAccount, params.addresses, params.values, params.bytes32, params.sigV, params.sigR, params.sigS, {from: karmaTransactionInitiator, gas: 8000000})
            )
            await lockAccount(karmaTransactionInitiator)
            await lockAccount(karmaMainAccount)

            prettyJson.prettyPrint([{message: 'DebtOrder filled at', timeStampToDate: block.timestamp, humanReadableDate: utils.timeStampToDate(block.timestamp)}])
            let tenure = ((params.numberOfDays / 30 ) / 12)  * 10000

            //after successful execution of fillDebtOrder execute setScalingFactors of Escrow
           await unlockAccount(karmaMainAccount)
            await isMined.checkMining(
                await escrowInstance.setScalingFactors(2000, tenure, params.interestRate, params.escrowAddress, {from: karmaMainAccount, gas: 8000000})
            )
            await lockAccount(karmaMainAccount)
            // let events = await debtKernelInstance.allEvents({fromBlock: '0', toBlock: 'latest'})
            // events.get((err,logs) => {
            //     if(!err) {
            //         console.log(JSON.stringify(logs))
            //     }
            // })
            console.log('\tBalances after fillDebtOrder: \n')
            prettyJson.prettyPrint([await getLedgerBalance(params)])
            prettyJson.getResponseObject(block, 'success', 'Loan made successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
            resolve({
                status: 'success',
                message: 'Loan made successfully',
                data: []
            })
        } catch(error) {
            console.log('error in toFillDebtOrder: ', error)
            prettyJson.getResponseObject({number: null}, 'failure', error.message, [])
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * This functions are necessary from UI point of view
 * This function returns the debtAgreementId of the debtor.
 * This debtAgreementId is necessary for getting the TermEndTimestamp
 * And the TermEndTimestamp is necessary for getting the expectedRepaymentValue
 * And this expectedRepaymentValue is used during repay()
 * @param {string} debtor - The debtor account address
 * @param creditor - The creditor account address
 * @return {Promise<any>} Array of DebtAgreements
 * */
function getDebtAgreements(debtor, creditor) {
    return new Promise(async (resolve, reject) => {
        let debtAgreementArray = []
        let beneficiary

        try {
            let borrowerInstance = getBorrowerInstance(debtor)
            let debtAgreements = await borrowerInstance.getMyDebts.call(debtor, {from: karmaMainAccount})
            console.log('creditor in dgetDebtAgreement: ', creditor)
            if (creditor !== undefined) {
                async.eachSeries(debtAgreements, async (debtAgreeementID, cb) => {
                    beneficiary = await borrowerInstance.getBeneficiary.call(debtAgreeementID)
                    console.log('beneficiary in getDebtAgreement: ', beneficiary)
                    if ( creditor.toLowerCase() === beneficiary) {
                        debtAgreementArray.push(debtAgreeementID)
                        cb()
                    } else {
                        cb()
                    }
                }, () => {
                    console.log('1 Debt agreements w.r.t. to current escrow are: ', debtAgreementArray)
                    prettyJson.prettyPrint([{message: 'Debt agreements', debtAgreementIds: debtAgreements}])
                    resolve({
                        status: 'success',
                        message: 'Debt agreements are: ',
                        data: [debtAgreementArray]
                    })
                })
            } else {
                console.log('2 Debt agreements w.r.t. to current escrow are: ', debtAgreements)
                resolve({
                    status: 'success',
                    message: 'Debt agreements are: ',
                    data: [debtAgreements]
                })
            }

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
 * This functions are necessary from UI point of view
 * getDebtAgreements() returns an array of debtAgreements, out of which select the one for which you wish to make a repayment
 * Function that gets the TermEndTimestamp
 * This termEndTimestamp will be used to get the expectedRepaymentValue
 * @param {string} debtAgreementId - The bytes32 debtAgreementId
 * @return {Promise<any>} Returns the termEndTimestamp of a debtAgreement
 * */
function getDebtAgreementTermEndTimestamp(debtAgreementId) {
    return new Promise(async (resolve, reject) => {
        try {
            let termEndTimestamp = await collateralizedSimpleInterestTermsContractInstance.getTermEndTimestamp.call(debtAgreementId, {from: karmaMainAccount})
            prettyJson.prettyPrint([{message: 'TermEndTimestamp', timestamp: termEndTimestamp.toNumber(), timestampToDate: utils.timeStampToDate(termEndTimestamp.toNumber())}])
            resolve({
                status: 'success',
                message: 'Term end timestamp is: ',
                data: [termEndTimestamp.toNumber()]
            })
        } catch(error) {
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

async function getDebtAgreementTermStartTimestamp(debtAgreementId) {
    return new Promise(async (resolve, reject) => {
        try {
            let termStartTimestamp = await debtRegistryInstance.getIssuanceBlockTimestamp.call(debtAgreementId, {from: karmaMainAccount})
            prettyJson.prettyPrint([{message: 'TermStartTimestamp', timestamp: termStartTimestamp.toNumber(), timestampToDate: utils.timeStampToDate(termStartTimestamp.toNumber())}])
            resolve({
                status: 'success',
                message: 'Term start timestamp is: ',
                data: [termStartTimestamp.toNumber()]
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
 * Function that gets the expectedRepaymentValue
 * @param {string} debtAgreementId - The bytes32 debtAgreementId
 * @param {number} timestamp
 * @return {Promise<number | *>} Returns the repayment value of the debt
 * */
function getExpectedDebtRepaymentValue(debtAgreementId, timestamp) {
    return new Promise(async (resolve, reject) => {
        try {
            let repaymentValue = await collateralizedSimpleInterestTermsContractInstance.getExpectedRepaymentValue(debtAgreementId, timestamp)
            prettyJson.prettyPrint([{message: 'Expected Repayment Value', amount: repaymentValue.toNumber()}])
            resolve({
                status: 'success',
                message: 'Repayment value',
                data: [repaymentValue.toNumber()]
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
 * Function that gets the value repaid to date, valueRepaidToDate
 * @param {string} debtAgreementId - The bytes32 debtAgreementId
 * @return {Promise<number | *>} Returns the value repaid till date
 * */
function getDebtValueRepaidToDate(debtAgreementId) {
    return new Promise(async (resolve, reject) => {
        try {
            let valueRepaidToDate = await collateralizedSimpleInterestTermsContractInstance.getValueRepaidToDate.call(debtAgreementId, {from: karmaMainAccount})
            prettyJson.prettyPrint([{message: 'Value repaid till date', amount: valueRepaidToDate.toNumber()}])
            resolve({
                status: 'success',
                message: 'Value repaid to date is: ',
                data: [valueRepaidToDate.toNumber()]
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
 * Function that repays
 * */
/**
 * Function that sets up the repay() pre-requisites
 * @param {string} debtor - The debtor account address
 * @param {number} repaymentValue - The repaymentValue
 * @return {Promise<number>} Returns 0 on successful repayment
 * */
function repaymentOfDebtPreRequisites(debtor, repaymentValue) {
    return new Promise(async (resolve, reject) => {
        try {
            let borrowerInstance = getBorrowerInstance(debtor)
            await web3APIs.fastForwardGanache((DAY_LENGTH_IN_SECONDS * 30))
            if(!web3APIs.isContract(debtor)) {
                await unlockAccount(karmaMainAccount, 'password', 30)
                await unlockAccount(debtor)
                await isMined.checkMining(
                    await erc20TokenInstance.approve(tokenTransferProxyInstance.address, repaymentValue, {from: debtor, gas: 8000000})
                )
                await lockAccount(debtor)
                await lockAccount(karmaMainAccount)
                await addTokenTransferProxyTransferAgent(repaymentRouterInstance.address)
                prettyJson.prettyPrint([{message: 'Pre requisites for repayment successful'}])
                resolve({
                    status: 'success',
                    message: 'Pre requisites for repayment successful',
                    data: []
                })
            } else {
                //First approve TokenTransferProxy with the repaymentValue
               await unlockAccount(karmaMainAccount)
                await isMined.checkMining(
                    await borrowerInstance.approve(tokenTransferProxyInstance.address, repaymentValue, {from: karmaMainAccount, gas: 8000000})
                )
                await lockAccount(karmaMainAccount)
                await addTokenTransferProxyTransferAgent(repaymentRouterInstance.address)
                prettyJson.prettyPrint([{message: 'Pre requisites for repayment successful'}])
                resolve({
                    status: 'success',
                    message: 'Pre requisites for repayment successful',
                    data: []
                })
            }
        } catch (error) {
            console.log('error in repaymentOfDebtPreRequisites baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })

}

/**
 * Function that invokes the repayment of a debt
 * The tokenAddress can be fetched from getContractAddresses()
 * @param {string} debtAgreementId - The bytes32 debtAgreementId
 * @param {number} repaymentValue - The repaymentValue
 * @param {string} tokenAddress - The ERC20 token address
 * @param {string} debtor - The debtor account address
 * @return {Promise<{status, message, data}>} JSON object specifying the repayment details
 * */
function repaymentOfDebt(debtAgreementId, repaymentValue, tokenAddress, debtor) {
    return new Promise(async (resolve, reject) => {
        let block;
        try {
            //Set the event watch
            // let params = {
            //     contractInstance: collateralizedSimpleInterestTermsContractInstance,
            //     eventName: "LogRegisterRepayment"
            // }
            // web3APIs.getLogsAndInsertInSQLite(params)

            // console.log('\tBalances before repayment: \n')
            // prettyJson.prettyPrint([await getLedgerBalance()])

            if(!web3APIs.isContract(debtor)) {
                await unlockAccount(karmaMainAccount, 'password', 30)
                await unlockAccount(debtor)
                block = await isMined.checkMining(
                    await repaymentRouterInstance.repay(debtAgreementId, repaymentValue, tokenAddress, {from: debtor, gas: 8000000})
                )
                await lockAccount(debtor)
                await lockAccount(karmaMainAccount)

                // console.log('\tBalances after repayment: \n')

                //Print Statements
                // prettyJson.prettyPrint([await getLedgerBalance()])
                prettyJson.getResponseObject(block, 'success', 'Repayment is successful', {blockNumber: block.number, transactionHash: block.transactions[0]})
                resolve({
                    status: 'success',
                    message: 'Repayment is successful',
                    data: []
                })
            } else {
                console.log('repaymentValue in repay: ', repaymentValue)
                let borrowerInstance = getBorrowerInstance(debtor)
               await unlockAccount(karmaMainAccount)
                block = await isMined.checkMining(
                    await borrowerInstance.repay(debtAgreementId, repaymentValue, tokenAddress, {from: karmaMainAccount, gas: 8000000})
                )
                await lockAccount(karmaMainAccount)

                //Print Statements
                prettyJson.prettyPrint([{message: 'Repayment of Debt happened at', timeStampToDate: block.timestamp, humanReadableDate: utils.timeStampToDate(block.timestamp)}])
                // console.log('\tBalances after repayment: \n')
                // prettyJson.prettyPrint([await getLedgerBalance()])

                //Print Statements
                prettyJson.getResponseObject(block, 'success', 'Repayment is successful', {blockNumber: block.number, transactionHash: block.transactions[0]})
                resolve({
                    status: 'success',
                    message: 'Repayment is successful',
                    data: []
                })
            }
        } catch (error) {
            console.log('error in repaymentOfDebt baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that sets the pre-requisites for Deposit.
 * Since if deposits have reached the FIXED_DEPOSIT amount, then escroRegistry's setLenderAttributes is invoked
 * And lender attributes can be added by onlyRegulator and regulator can be set by onlyOwner
 * Thus getting the pre-requisites in place before the deposit starts
 * @param {array} depositors - Array of depositors
 * @param {number} noOfTokens - Number of tokens
 * @return {Promise<{status, message, data}>} JSON object specifying the deposit pre-reqs details
 * */
function depositInEscrowPreRequisites(depositors, noOfTokens) {
    return new Promise(async (resolve, reject) => {
        let isRegulatorAlreadyAdded, allowance
        try{
            async.eachSeries(depositors, async(depositor, cb) => {
                allowance = await erc20TokenInstance.allowance.call(depositor.address, escrowInstance.address)
                if (!(allowance.toNumber() >= 2500)) {
                    await unlockAccount(karmaMainAccount)
                    await isMined.checkMining(
                        await erc20TokenInstance.transfer(depositor.address, noOfTokens, {from: karmaMainAccount, gas: 8000000})
                    )
                    await lockAccount(karmaMainAccount)

                    await unlockAccount(karmaMainAccount, 'password', 15)
                    await unlockAccount(depositor.address, 'password', 30)
                    await erc20TokenInstance.approve(escrowInstance.address, noOfTokens, {from: depositor.address, gas: 8000000}) // To avoid Insufficient allowance error
                    await lockAccount(depositor.address)
                    await lockAccount(karmaMainAccount)
                    // await erc20TokenInstance.allowance.call(depositor.address, escrowInstance.address).toNumber() to check allowance uncomment and console.log this statement
                    cb()
                } else {
                    cb()
                }
            }, async() => {
                isRegulatorAlreadyAdded = await escrowRegistryInstance.isRegulator.call(escrowInstance.address, {from: karmaMainAccount})
                if (!isRegulatorAlreadyAdded) {
                    await unlockAccount(karmaMainAccount)
                    await isMined.checkMining(
                        await escrowRegistryInstance.addRegulator(escrowInstance.address, {from: karmaMainAccount, gas: 8000000})
                    )
                    await lockAccount(karmaMainAccount)
                }
                prettyJson.prettyPrint([{message: 'Pre requisites for deposit successful'}])
                resolve({
                    status: 'success',
                    message: 'Pre requisites for deposit successful',
                    data: []
                })
            })
        } catch (error) {
            console.log('error in depositInEscrowPreRequisites baseLogic: ', error)
            prettyJson.getResponseObject({number: null}, 'failure', error.message, [])
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })


}

/**
 * Function that lets you deposit into the escrow contract
 * For now, consider only 1 account deposits the entire amount of tokens in the escrow contract
 * @param {array} depositors - Array of depositors
 * @param {number} amount - The number of tokens to deposit
 * @return {Promise<{status, message, data}>} JSON object specifying the deposit details
 * */
function depositInEscrow(depositors, amount) {
    return new Promise(async (resolve, reject) => {
        let block, escrowCurrentState
        try {
            escrowCurrentState = await escrowInstance.getLenderState.call({from: karmaMainAccount})
            console.log('escrowCurrentState: ', escrowCurrentState.toNumber())
            console.log('escrow balance: ', (await erc20TokenInstance.balanceOf.call(escrowInstance.address, {from: karmaMainAccount})).toNumber())
            if (!(escrowCurrentState.toNumber() !== 0)) {
                async.eachSeries(depositors, async(depositor, cb)  => {
                    await unlockAccount(karmaMainAccount, 'password', 15)
                    await unlockAccount(depositor.address, 'password', 15)
                    block = await isMined.checkMining(
                        await escrowInstance.deposit(amount, {from: depositor.address, gas: 8000000})
                    )
                    await lockAccount(depositor.address)
                    await lockAccount(karmaMainAccount)
                    cb()
                }, async() => {

                    prettyJson.prettyPrint([{message: 'Deposit in Escrow', timeStampToDate: block.timestamp, humanReadableDate: utils.timeStampToDate(block.timestamp)}])
                    prettyJson.getResponseObject(block, 'success', 'Deposit is successful', {blockNumber: block.number, transactionHash: block.transactions[0]})
                    //set when to withdraw condition
                    let whenToAllowWithdrawalTimestamp = ((await getLatestBlockTimestamp()).data[0] + (demoValues.SECONDS_IN_DAY * demoValues.NO_OF_DAYS))

                    await unlockAccount(karmaMainAccount)
                    await escrowInstance.setWhenToWithdrawTimestamp(whenToAllowWithdrawalTimestamp, {from: karmaMainAccount, gas: 8000000})
                    await lockAccount(karmaMainAccount)

                    console.log('escrow balance after deposits: ', (await erc20TokenInstance.balanceOf.call(escrowInstance.address)).toNumber())

                    resolve({
                        status: 'success',
                        message: 'Pre requisites for deposit successful',
                        data: []
                    })
                })
            } else {
                resolve({
                    status: 'success',
                    message: 'Pre requisites for deposit already successful',
                    data: []
                })
            }
        } catch(error) {
            console.log('error in depositInEscrow baseLogic: ', error)
            prettyJson.getResponseObject({number: null}, 'failure', error.message, [])
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that withdraws the depositors deposit
 * @param {array} depositors - Array of depositors
 * @param {number} principalAmount
 * @return {Promise<{status, message, data}>} JSON object specifying the withdrawal details
 * */
function withdrawFromEscrow(depositors, principalAmount) {
    return new Promise (async (resolve, reject) => {
        let block
        try {
            let escrowBal = await erc20TokenInstance.balanceOf.call(escrowInstance.address, {from: karmaMainAccount})
            console.log('Escrow balance: ', escrowBal.toNumber())

            console.log('whentowithdraw timestamp', (await escrowInstance.getWhenToWithdrawTimestamp.call({from: karmaMainAccount})).toNumber())
            console.log('current block.timestamp', (await getLatestBlockTimestamp()).data[0])
            console.log('is withdrawal allowed: ', await escrowInstance.allowWithdraw.call({from: karmaMainAccount}))
            console.log('current escrow state is: ', (await escrowInstance.getLenderState.call({from: karmaMainAccount})).toNumber())
            console.log('is part payment invoked: ', await escrowInstance.isPartPaymentInvoked.call({from: karmaMainAccount}))
            console.log('value repaid till now: ', (await escrowInstance.getValueRepaidTillNow.call({from: karmaMainAccount})).toNumber())
            console.log('expected repayment value: ', (await escrowInstance.getExpectedRepaymentValue()).toNumber())
            let balanceOfDepositor
            console.log('\tBalances of Depositors before withdrawal from Escrow: \n')
            depositors.forEach(async (depositor) => {
                balanceOfDepositor = await erc20TokenInstance.balanceOf.call(depositor.address, {from: karmaMainAccount})
                prettyJson.prettyPrint([{account: depositor.address, balance: balanceOfDepositor.toNumber()}])
            })

            // console.log('\tBalances before withdrawal from Escrow: \n')
            // prettyJson.prettyPrint([await getLedgerBalance()])

            // console.log('Lender state before withdraw: ', (await escrowInstance.getLenderState.call()).toNumber())
            // console.log('isPartPaymentInvoked before withdraw: ', (await escrowInstance.isPartPaymentInvoked.call()))
           await unlockAccount(karmaMainAccount)
            block = await isMined.checkMining(
                await escrowInstance.withdraw(principalAmount, {from: karmaMainAccount, gas: 8000000})
            )
            await lockAccount(karmaMainAccount)

            // console.log('Lender state after withdraw: ', (await escrowInstance.getLenderState.call()).toNumber())
            // console.log('isPartPaymentInvoked after withdraw: ', (await escrowInstance.isPartPaymentInvoked.call()))
            // console.log('\tBalances after withdrawal from Escrow: \n')
            // prettyJson.prettyPrint([await getLedgerBalance()])

            console.log('\tBalances of Depositors after withdrawal from Escrow: \n')
            depositors.forEach(async (depositor) => {
                balanceOfDepositor = await erc20TokenInstance.balanceOf.call(depositor.address, {from: karmaMainAccount})
                prettyJson.prettyPrint([{account: depositor.address, balance: balanceOfDepositor.toNumber()}])
            })
            prettyJson.prettyPrint([{message: 'Withdrawal from escrow at', timeStampToDate: block.timestamp, humanReadableDate: utils.timeStampToDate(block.timestamp)}])
            prettyJson.getResponseObject(block, 'success', 'Withdrawal is successful', {blockNumber: block.number, transactionHash: block.transactions[0]})
            resolve({
                status: 'success',
                message: 'Withdrawal successful',
                data: []
            })
        } catch (error) {
            prettyJson.getResponseObject({number: null}, 'failure', error.message, [])
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that sets the pre-requisites for setBorrowAttributes()
 * @param {json} params - The argument JSON object
 * @return {Promise<void>} JSON object specifying the borrower pre-reqs details
 * */
function setBorrowAttrPreRequisites(params) {
    return new Promise(async (resolve, reject) => {
        try {
            isRegulatorAdded = await escrowRegistryInstance.isRegulator.call(params.regulator, {from: karmaMainAccount})
            console.log('is regulator already added: ', isRegulatorAdded)
            if (!isRegulatorAdded) {
                await unlockAccount(karmaMainAccount)
                await isMined.checkMining(
                    await escrowRegistryInstance.addRegulator(params.regulator, {from: karmaMainAccount, gas: 8000000})
                )
                await lockAccount(karmaMainAccount)
            }
            prettyJson.prettyPrint([{message: 'Pre requisites for setBorrowerAttributes successful'}])
            resolve({
                status: 'success',
                message: 'Pre requisites for setBorrowerAttributes successful',
                data: []
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
 * Function that sets the borrowerAttributes() of escroRegistry
 * @param {json} params - The argument JSON object
 * @return {Promise<{status, message, data}>} JSON object specifying the borrower attributes details
 * */
function setBorrowerAttr(params) {
    return new Promise(async (resolve, reject) => {
        let block
        let principalAmount
        let borrowerState
        try {
            // principalAmount = (await escrowRegistryInstance.borrowerAttributes.call(params.debtor, {from: karmaMainAccount})).toNumber()
            let borrowerInstance = getBorrowerInstance(params.debtor)
            borrowerState = await borrowerInstance.canBorrow.call({from: karmaMainAccount})
            console.log('borrower state before setting borrower attribute: ', borrowerState)
            // if (!((principalAmount === params.principalAmount) && (borrowerState))) {
                await unlockAccount(karmaMainAccount, 'password', 30)
                await unlockAccount(params.regulator)
                block = await isMined.checkMining(
                    await escrowRegistryInstance.setBorrowerAttributes(params.debtor, params.principalAmount, {
                        from: params.regulator,
                        gas: 8000000
                    })
                )

            borrowerState = await borrowerInstance.canBorrow.call({from: karmaMainAccount})
            console.log('borrower state after setting borrower attribute: ', borrowerState)

                await lockAccount(params.regulator)
                await lockAccount(karmaMainAccount)
                prettyJson.prettyPrint([{
                    message: 'Borrower attribute set at',
                    timeStampToDate: block.timestamp,
                    humanReadableDate: utils.timeStampToDate(block.timestamp)
                }])
                prettyJson.getResponseObject(block, 'success', 'Borrower Attributes is set successfully', {
                    blockNumber: block.number,
                    transactionHash: block.transactions[0]
                })
                resolve({
                    status: 'success',
                    message: 'Borrower Attributes is set successfully',
                    data: []
                })
            // } else {
            //     resolve({
            //         status: 'success',
            //         message: 'Borrower Attributes is set successfully',
            //         data: []
            //     })
            // }
        } catch (error) {
            prettyJson.getResponseObject({number: null}, 'failure', error.message, [])
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the fixed deposit amount that can be deposited into the Escrow
 * @return {Promise<any>} Deposited amount in the escrow contract
 * */
function getFixedDepositAmount() {
    return new Promise (async (resolve, reject) => {
        try {
            let depositAmount = await escrowInstance.DEPOSIT_AMOUNT.call({from: karmaMainAccount}).toNumber()
            prettyJson.prettyPrint([{message: 'Amount that can be deposited in the escrow: ', amount: depositAmount}])
            resolve({
                status: 'success',
                message: 'Amount that can be deposited in the escrow',
                data: [depositAmount]
            })
        } catch (error) {
            console.log('error in getFixedDepositAmount baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })

}

/**
 * Function that gets the ledger balance to be printed using the prettyPrint utility
 * @return {JSON} Object with the ledgerBalance
 * */
async function getLedgerBalance(params) {
    // console.log('params in getLedgerBalance: ', params)
    return {
        LenderEscrowBalance: await erc20TokenInstance.balanceOf.call(params.escrowAddress, {from: karmaMainAccount}).toNumber(),
        BorrowerBalance: await erc20TokenInstance.balanceOf.call(params.debtor, {from: karmaMainAccount}).toNumber(),
        Relayer: await  erc20TokenInstance.balanceOf.call(params.relayer, {from: karmaMainAccount}).toNumber(),
        Underwriter: await  erc20TokenInstance.balanceOf.call(params.underwriter, {from: karmaMainAccount}).toNumber(),
        AllowanceFromLender: await erc20TokenInstance.allowance.call(params.escrowAddress, tokenTransferProxyInstance.address, {from: karmaMainAccount}).toNumber(),
        AllowanceFromDebtor: await erc20TokenInstance.allowance.call(params.debtor, tokenTransferProxyInstance.address, {from: karmaMainAccount}).toNumber()
    }
}


/**
 * Function that gets the scaling factors
 * @param {string} creditor - Ethereum account address
 * @return {JSON} Object containing the scaling factors theoretical and actual
 * */
function getScalingFactors(creditor) {
    return new Promise(async (resolve, reject) => {
        try {
            let scalingFactors = {
                theoreticalScalingFactor: '',
                actualScalingFactor: ''
            }

            let result = await escrowInstance.getScalingFactorsOf(creditor);

            //Set the scaling factors in scalingFactors object
            scalingFactors.theoreticalScalingFactor = result[0].toNumber()
            scalingFactors.actualScalingFactor = result[1].toNumber()

            prettyJson.prettyPrint([scalingFactors])
            resolve({
                status: 'success',
                message: 'Scaling factors are: ',
                data: [scalingFactors]
            })
        } catch (error) {
            console.log('error in getScalingFactors baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}


/**
 * Execute Seize or return collateral
 * @param {string} debtAgreementId - The bytes32 debtAgreementId
 * @param params JSON
 * @return {JSON} object specifying the seize or return collateral details
 * */
function executeSeizeOrReturnCollateral(debtAgreementId, params) {
    return new Promise(async (resolve, reject) => {
        let block
        try{
            //seizeOrReturnCollateralPreRequisites() returns true or false, if true then return collateral else seize collateral
            // let borrowerInstance = getBorrowerInstance(owner) //Add borower address over here
            let creditor = await borrowerInstance.getBeneficiary.call(debtAgreementId)
            let shouldSizeOrReturn = await shouldSeizeOrReturnCollateral(debtAgreementId, params)
            if(shouldSizeOrReturn.data[0]) {
                //Print Statements
                console.log('\tBalance before returning collateral')
                prettyJson.prettyPrint([await getLoanInvolverBal(creditor, params.debtor)])

               await unlockAccount(karmaMainAccount)
                block =  await isMined.checkMining(
                    await collateralizerInstance.returnCollateral(debtAgreementId, { from: karmaMainAccount, gas: 8000000 })
                )
                await lockAccount(karmaMainAccount)

                //Print Statements
                prettyJson.prettyPrint([{message: 'Collateral returned at', timeStampToDate: block.timestamp, humanReadableDate: utils.timeStampToDate(block.timestamp)}])
                console.log('\tBalance after returning collateral')
                prettyJson.prettyPrint([await getLoanInvolverBal(creditor, params.debtor)])
                prettyJson.getResponseObject(block, 'success', 'Collateral returned successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
                resolve({
                    status: 'success',
                    message: 'Execute seize or return collateral successful',
                    data: []
                })
            } else {
                //Print Statements
                console.log('\tBalance before seizing collateral')
                prettyJson.prettyPrint([await getLoanInvolverBal(creditor, params.debtor)])

               await unlockAccount(karmaMainAccount)
                block =  await isMined.checkMining(
                    await collateralizerInstance.seizeCollateral(debtAgreementId, { from: karmaMainAccount, gas: 8000000 })
                )
                await lockAccount(karmaMainAccount)

                //Print Statements
                prettyJson.prettyPrint([{message: 'Collateral seized at', timeStampToDate: block.timestamp, humanReadableDate: utils.timeStampToDate(block.timestamp)}])
                console.log('\tBalance after seizing collateral')
                prettyJson.prettyPrint([await getLoanInvolverBal(creditor, params.debtor)])
                prettyJson.getResponseObject(block, 'success', 'Collateral seized successfully', {blockNumber: block.number, transactionHash: block.transactions[0]})
                resolve({
                    status: 'success',
                    message: 'Execute seize or return collateral successful',
                    data: []
                })
            }
        } catch(error){
            prettyJson.getResponseObject({number: null}, 'failure', error.message, [])
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the Borrower, Lender and Collateralizer balance
 * @return {Promise<{LenderEscrowBalance, BorrowerBalance, CollateralizerBalance}>}
 * */
async function getLoanInvolverBal(creditor, debtor) {
    return {
        LenderEscrowBalance: await erc20TokenInstance.balanceOf.call(creditor, {from: karmaMainAccount}).toNumber(),
        BorrowerBalance: await erc20TokenInstance.balanceOf.call(debtor, {from: karmaMainAccount}).toNumber(),
        CollateralizerBalance: await erc20TokenInstance.balanceOf.call(collateralizerInstance.address, {from: karmaMainAccount}).toNumber(),
    }
}

/**
 * Decider function whether to return or seize collateral
 * @param {string} debtAgreementId - The bytes32 debtAgreementId
 * @param params JSON
 * @return {Promise<boolean>} the flag whether the collateral has to be siezed or returned
 * */
function shouldSeizeOrReturnCollateral(debtAgreementId, params) {
    return new Promise (async (resolve, reject) => {
        try {
            let termEndTimestamp = (await getDebtAgreementTermEndTimestamp(debtAgreementId)).data[0]
            let expectedRepaymentValue = (await getExpectedDebtRepaymentValue(debtAgreementId, termEndTimestamp)).data[0]
            let valueRepaidToDate = (await getDebtValueRepaidToDate(debtAgreementId)).data[0]

            //For returnCollateral() expectedRepaymentValue <= getValueRepaidToDate
            if(expectedRepaymentValue <= valueRepaidToDate) {
                resolve({
                    status: 'success',
                    message: 'Collateral details are: ',
                    data: [true]
                })
            } else {
                //Fast-forward ganache
                prettyJson.prettyPrint([{message: 'Printing values in case of gracePeriod'}])
                await web3APIs.fastForwardGanache((DAY_LENGTH_IN_SECONDS * 20)) // forward time by 100 days
                let adjustedTimestamp = await collateralizerInstance.timestampAdjustedForGracePeriod(params.gracePeriodInDays)
                expectedRepaymentValue = (await getExpectedDebtRepaymentValue(debtAgreementId, adjustedTimestamp.toNumber())).data[0]
                valueRepaidToDate = (await getDebtValueRepaidToDate(debtAgreementId)).data[0]
                prettyJson.prettyPrint([{increasedTimestamp: adjustedTimestamp.toNumber(), timestampToDate: utils.timeStampToDate(adjustedTimestamp.toNumber())}])
                prettyJson.prettyPrint([{expectedAmount: expectedRepaymentValue, amountPaidTillDate: valueRepaidToDate}])
                // console.log('in seizeCollateral else condition expectedRepaymentValue', expectedRepaymentValue, '\nValue reapid till date: ', valueRepaidToDate)
                resolve({
                    status: 'success',
                    message: 'Collateral details are: ',
                    data: [false]
                })
            }
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
 * Function that fetches the collateral details
 * @param {string} debtAgreementId - The bytes32 debtAgreementId
 * @return {Promise<*>}
 * */
function fetchCollateralDetails(debtAgreementId) {
    return new Promise(async (resolve, reject) => {
        try {
            let collateralDetails = await collateralizerInstance.getCollateralDetails(debtAgreementId)
            resolve({
                status: 'success',
                message: 'Collateral details are: ',
                data: [{
                    collateralizer: collateralDetails[0],
                    collateralAmount: collateralDetails[1].toNumber(),
                    collateralState: collateralDetails[2].toNumber()
                }]
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
 * Function that transfers he collateral amount
 * @param {string} to - Ethereum account address
 * @param {number} collateralAmount
 * @return {Promise<void>}
 * */
async function transferCollateralAmount(to, collateralAmount) {
    // console.log('to: ', to, 'collateralAMount: ', collateralAmount)
    return new Promise(async (resolve, reject) => {
       try {
          await unlockAccount(karmaMainAccount)
           await isMined.checkMining(
               await escrowInstance.transfer(to, collateralAmount, {from: karmaMainAccount, gas: 8000000})
           )
           await lockAccount(karmaMainAccount)
           resolve({
               status: 'success',
               message: 'Transferred collateral',
               data: []
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
 * Function that gets the EMI details
 * @param {string} debtAgreementId - The bytes32 debtAgreementId
 * @param {number} noOfDays
 * @return {Promise<{installmentAmount: number, noOfInstallments: number, monthlyInterest: number}>}
 * */
async function getEmiDetails(debtAgreementId, noOfDays, debtor) {
    return new Promise(async (resolve, reject) => {
        try {
            let response = {
                installmentAmount: 0,
                noOfInstallments: 0,
                monthlyInterest: 0
            }
            let borrowerInstance = getBorrowerInstance(debtor)
            let emi = await borrowerInstance.getEmiDetails.call(debtAgreementId, noOfDays, {from: karmaMainAccount})
            response.installmentAmount = emi[0].toNumber()
            response.noOfInstallments = emi[1].toNumber()
            response.monthlyInterest = emi[2].toNumber()

            resolve({
                status: 'success',
                message: 'EMI details are: ',
                data: [response]
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

function getRepaymentTimestampsFromDB(debtAgreement) {
    return new Promise(async(resolve, reject) => {
        try {
            let query = {
                statement: "SELECT repayment_date repaymentTimestamp FROM repayment_details WHERE agreement_id = ? COLLATE NOCASE ORDER BY repayment_date DESC LIMIT 1",
                params: [
                    debtAgreement
                ]
            }
            // console.log('query in getRepaymentTimestamps: ', query)
            let result = await web3APIs.selectByQuery(query)
            // console.log('result in getRepaymentTimestamps: ', result)
            resolve({
                status: 'success',
                message: 'Repayment timestamps',
                data: result
            })
        } catch(error) {
          console.log('error in getRepaymentTimestamps: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the user details from the database
 * */
function getUserDetailsFromDB(params) {
    return new Promise(async(resolve, reject) => {
        try {
            let query = {
                statement: "SELECT  stringified_user_details UserDetails FROM user_details WHERE email = ? COLLATE NOCASE",
                params: [
                    params.email
                ]
            }
            resolve(await web3APIs.selectByQuery(query))
        } catch(error) {
            console.log('error in getUserDetailsFromDB', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the actors involved in the debtAgreement
 * @param {string} agreementId - The debt Agreement
 * */
// async function getSimpleInterestTerms(agreementId) {
//     let simpleInterestTermsEvent = await collateralizedSimpleInterestTermsContractInstance.allEvents(filterOptions)
//
// }

/**
 * Function that gets the length in seconds depending on the amortizationUnitType
 * @param {number} amortizationUnitType - can be { HOURS, DAYS, WEEKS, MONTHS, YEARS } => 0, 1, 2, 3, 4
 * @return Returns the length in seconds of the amortizationUnit
 * */
// function getAmortizationUnitLengthInSeconds(amortizationUnitType) {
//     switch (amortizationUnitType) {
//         case 0:
//             return HOUR_LENGTH_IN_SECONDS
//
//         case 1:
//             return DAY_LENGTH_IN_SECONDS
//         case 2:
//             return WEEK_LENGTH_IN_SECONDS
//
//         case 3:
//             return MONTH_LENGTH_IN_SECONDS
//
//         case 4:
//             return YEAR_LENGTH_IN_SECONDS
//     }
// }

/**
 * Function that creates all the tables in the SQLite database
 * */
function createSQLiteTables() {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            response = await web3APIs.createAllSQLiteTables()
            if(response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch(error) {
            console.log('error in createSQLiteTables baseLogic: ', error)
            reject(response)
        }
    })
}

/**
 * Function that print the ledger in the tabular format
 * */
async function getLedgerDetailsFromDB(args) {
    return new Promise(async (resolve, reject) => {
        try{
            let finalData = [], ledgerData
            let debtAgreements = (await getDebtAgreements(args.borrowerAddress)).data[0]
            async.eachSeries(debtAgreements, async (debtAgreement, cb) => {
                args.agreementId = debtAgreement
                ledgerData = await ledger.getLedgerDetailsByUnion(args)
                // console.log('ledgerData in getLedgerDetailsFromDB', ledgerData)
                formatDate(ledgerData)
                finalData.push(ledgerData.data)
                cb()
            }, () => {
                resolve({
                    status: 'success',
                    message: 'Ledger details fetched from SQLite: ',
                    data: finalData
                })
            })



        } catch (error) {
            console.log('error in finalData', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that closes the SQLite DB connection
 * */
function openDBConnection() {
    return new Promise(async(resolve, reject) => {
        try {
            await web3APIs.openDBConnection()
            resolve({
                status: 'success',
                message: 'Database connection closed successfully',
                data: []
            })
        } catch (error) {
            console.log('error in openDBConnection baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}



/**
 * Function that closes the SQLite DB connection
 * */
function closeDBConnection() {
    return new Promise(async(resolve, reject) => {
        try {
            await web3APIs.closeDBConnection()
            resolve({
                status: 'success',
                message: 'Database connection closed successfully',
                data: []
            })
        } catch (error) {
            console.log('error in closeDBConnection baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that prints the borrower ledger
 * */
function printBorrowerLedger(args) {
    return new Promise(async (resolve, reject) => {
        try{
            let borrowerLedger = []
            let finalData = (await getLedgerDetailsFromDB(args)).data
            borrowerLedger.push({
                Date: '----/--/--',
                Description: 'Initial Balance',
                Deposited: args.borrowerInitialBalance,
                Withdrawn: '----',
                Balance: args.borrowerInitialBalance
            })

            finalData.forEach((element) => {
                element.forEach((innerElement) => {
                    if (innerElement.Description === 'Agreement')  {
                        borrowerLedger.push({
                            Date: innerElement.TransactionDate,
                            Description: 'Received loan of (Principal Amount - Debtor Fee) of ' + (innerElement.Amount - demoValues[args.debtStory].debtorFee) +  demoValues.denomination,
                            Deposited: innerElement.Amount - demoValues[args.debtStory].debtorFee,
                            Withdrawn: '----',
                            Balance: args.borrowerInitialBalance += ( innerElement.Amount - demoValues[args.debtStory].debtorFee)

                        })
                    } else if (innerElement.Description === 'LogRegisterRepayment') {
                        borrowerLedger.push({
                            Date: innerElement.TransactionDate,
                            Description: 'Made repayment of ' + innerElement.Amount +  demoValues.denomination,
                            Deposited: '----',
                            Withdrawn: innerElement.Amount,
                            Balance: args.borrowerInitialBalance -= innerElement.Amount
                        })
                    } else if (innerElement.Description === 'CollateralLocked') {
                        borrowerLedger.push({
                            Date: innerElement.TransactionDate,
                            Description: 'Locked collateral amount ' + innerElement.Amount +  demoValues.denomination,
                            Deposited: '----',
                            Withdrawn: innerElement.Amount,
                            Balance: args.borrowerInitialBalance -= innerElement.Amount
                        })
                    } else if (innerElement.Description === 'CollateralReturned') {
                        borrowerLedger.push({
                            Date: innerElement.TransactionDate,
                            Description: 'Returned collateral amount ' + innerElement.Amount +  demoValues.denomination,
                            Deposited: innerElement.Amount,
                            Withdrawn: '----',
                            Balance: args.borrowerInitialBalance += innerElement.Amount
                        })
                    }
                })
            })
            // console.log('borower ledger: ', JSON.stringify(borrowerLedger))
            console.log(consoleTable.getTable(borrowerLedger))
            resolve({
                status: 'success',
                message: 'Borrower ledger printed successfully',
                data: []
            })
        } catch (error) {
            console.log('error in printBorrowerLedger baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })


}

/**
 * Function that gets the lender ledger
 * */
function printLenderLedger(args) {
    return new Promise (async (resolve, reject) => {
        try {
            let lenderLedger = []
            let finalData = (await getLedgerDetailsFromDB(args)).data
            // console.log('*****************************finalData in printLenderLedger: ', finalData)
            lenderLedger.push({
                Date: '----/--/--',
                Description: 'Initial Balance',
                Deposited: args.lenderInitialBalance,
                Withdrawn: '----',
                Balance: args.lenderInitialBalance
            })

            finalData.forEach((element) => {
                element.forEach((innerElement) => {
                        if (innerElement.Description === 'Deposited') {
                            lenderLedger.push({
                                Date: innerElement.TransactionDate,
                                Description: 'Deposited ' + innerElement.Amount + demoValues.denomination + ' in the Escrow',
                                Deposited: innerElement.Amount,
                                Withdrawn: '----',
                                Balance: args.lenderInitialBalance+=innerElement.Amount
                            })
                        } else if (innerElement.Description === 'Withdrawn') {
                            lenderLedger.push({
                                Date: innerElement.TransactionDate,
                                Description: 'Withdrawn ' + innerElement.Amount +  demoValues.denomination + ' from the Escrow',
                                Deposited: '----',
                                Withdrawn: innerElement.Amount,
                                Balance: args.lenderInitialBalance -= innerElement.Amount
                            })
                        } else if (innerElement.Description === 'LogRegisterRepayment') {
                            lenderLedger.push({
                                Date: innerElement.TransactionDate,
                                Description: 'Repayment of ' + innerElement.Amount +  demoValues.denomination,
                                Deposited: innerElement.Amount,
                                Withdrawn: '----',
                                Balance: args.lenderInitialBalance += innerElement.Amount
                            })
                        } else if (innerElement.Description === 'CollateralSeized') {
                            lenderLedger.push({
                                Date: innerElement.TransactionDate,
                                Description: 'Seized collateral amount ' + innerElement.Amount +  demoValues.denomination,
                                Deposited: innerElement.Amount,
                                Withdrawn: '----',
                                Balance: args.lenderInitialBalance += innerElement.Amount
                            })
                        } else if (innerElement.Description === 'Agreement') {
                            lenderLedger.push({
                                Date: innerElement.TransactionDate,
                                Description: 'Total creditor payment (Principal Amount + Creditor Fee) ' + (innerElement.Amount + demoValues[args.debtStory].creditorFee) +  demoValues.denomination,
                                Deposited: '----',
                                Withdrawn: innerElement.Amount + demoValues[args.debtStory].creditorFee,
                                Balance: args.lenderInitialBalance -= (innerElement.Amount + demoValues[args.debtStory].creditorFee)
                            })
                        }
                })
            })
            // console.log('lenderLedger is: ', JSON.stringify(lenderLedger))
            console.log(consoleTable.getTable(lenderLedger))
            resolve({
                status: 'success',
                message: 'Lender ledger printed successfully',
                data: []
            })
        } catch (error) {
            console.log('Error in printLenderLedger baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function formatDate(params) {
    params.data.forEach((element) => {
        element.TransactionDate = utils.timeStampToDate(element.TransactionDate)
    })
}

/**
 * Function that prints the depositors ledger
 * */
function printDepositorsLedger(params) {
    return new Promise(async (resolve, reject) => {
        try{
            let depositorsLedger = []
            async.eachSeries(params.depositors, async (depositor, cb) => {
                params.depositor = depositor.address
                let depositorsDetails = (await getDepositAndWithdrawalDetailsSorted(params))
                formatDate(depositorsDetails)
                depositorsDetails.data.forEach((depositor) => {
                    params.depositors.forEach((innerDepositor) => {
                        if (innerDepositor.address === depositor.AccountAddress) {
                            let result = depositorsLedger.find(element => element.Address === innerDepositor.address)
                            if (!result) {
                                depositorsLedger.push({
                                    Address: innerDepositor.address,
                                    Date: '----/--/--',
                                    Description: 'Initial balance',
                                    Deposited: innerDepositor.initialBalance,
                                    Withdrawn: '----',
                                    Balance: innerDepositor.initialBalance
                                })
                            }
                            if (depositor.Description === 'Deposited') {
                                depositorsLedger.push({
                                    Address: innerDepositor.address,
                                    Date: utils.timeStampToDate(depositor.DateCreated),
                                    Description: depositor.Description + ' ' + depositor.Amount + demoValues.denomination + ' in the Escrow',
                                    Deposited: depositor.Amount,
                                    Withdrawn: '----',
                                    Balance: innerDepositor.initialBalance -= depositor.Amount
                                })
                            } else if (depositor.Description === 'Withdrawn') {
                                depositorsLedger.push({
                                    Address: innerDepositor.address,
                                    Date: utils.timeStampToDate(depositor.DateCreated),
                                    Description: depositor.Description + ' ' + depositor.Amount + demoValues.denomination + ' from the Escrow',
                                    Deposited: '----',
                                    Withdrawn: depositor.Amount,
                                    Balance: innerDepositor.initialBalance += depositor.Amount
                                })
                            }
                        }
                    })
                })
                // console.log('depositorsLedger is: ', JSON.stringify(depositorsLedger))
                console.log(consoleTable.getTable(depositorsLedger))
                depositorsLedger = []
                cb()
            }, async () => {
                // prettyJson.prettyPrint([await getLedgerBalance()])
                console.log('::::::::::::::::::::::: Finished printing the ledger :::::::::::::::::::::::')
                resolve({
                    status: 'success',
                    message: params.message,
                    data: []
                })
            })
        } catch (error) {
            console.log('Error in printDepositorsLedger baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

async function getDepositAndWithdrawalDetailsSorted(args) {
    return new Promise(async (resolve, reject) => {
        try{
            let getDepositWithdrawalDetailsQuery = {
                statement:'SELECT\n' +
                    'depositor AccountAddress, amount Amount, date DateCreated, event Description\n' +
                    'FROM \n' +
                    'deposit_details dd,\n' +
                    'event_block eb\n' +
                    'WHERE\n' +
                    'escrow_contract = ? COLLATE NOCASE ' +
                    'AND\n' +
                    'dd.block_hash = eb.block_hash\n' +
                    'AND\n' +
                    'dd.log_index = eb.log_index\n' +
                    'AND \n' +
                    'dd.depositor = ? COLLATE NOCASE \n' +
                    '\n' +
                    'UNION\n' +
                    '\n' +
                    'SELECT\n' +
                    'withdrawer, amount, date, event\n' +
                    'FROM \n' +
                    'withdrawal_details wd,\n' +
                    'event_block eb\n' +
                    'WHERE\n' +
                    'escrow_contract = ? COLLATE NOCASE \n' +
                    'AND\n' +
                    'wd.block_hash = eb.block_hash\n' +
                    'AND\n' +
                    'wd.log_index = eb.log_index\n' +
                    'AND\n' +
                    'wd.withdrawer = ? COLLATE NOCASE \n' +
                    'Order by dd.date, wd.date asc\n',
                params: [
                    args.escrowAddress,
                    args.depositor,
                    args.escrowAddress,
                    args.depositor
                ]
            }
            resolve(await web3APIs.selectByQuery(getDepositWithdrawalDetailsQuery))
        } catch (error) {
            console.log('error in getDepositAndWithdrawalDetailsSorted baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the deposited tokens from the Escrow
 * */
function getDepositedTokensFromEscrow(args) {
    return new Promise(async (resolve, reject) => {
        try{
            let depositors = args.depositors
            async.eachSeries(depositors, async(depositor, cb) => {
                // let myWithdrawal = await escrowInstance.getWithdrawalAmount.call(depositor.address)
                // console.log('myWithdrawal: ', myWithdrawal.toNumber())
                // let maxWithdrawable = await escrowInstance.getMaxWithdrawableAmount.call(depositor.address)
                // console.log('maxWithdrawable: ', maxWithdrawable.toNumber())
                // let depositOf = await escrowInstance.getDepositsOf.call(depositor.address)
                // console.log('depositOf : ', depositOf.toNumber())
                await unlockAccount(karmaMainAccount, 'password', 30)
                await unlockAccount(depositor.address)
                await escrowInstance.getDepositedTokens({from: depositor.address, gas: 8000000})
                await lockAccount(depositor.address)
                await lockAccount(karmaMainAccount)
                cb()
            }, () => {
                console.log('In final callback of getDepositedTokens')
                resolve({
                    status: 'success',
                    message: 'Executed getDepositedTokens successfully',
                    data: []
                })
            })
        } catch (error) {
            console.log('error in getDepositedTokens baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the deposited tokens from the Escrow in case of seize collateral
 * */
function getDepositedTokensForSeizeCollateral() {
    return new Promise(async (resolve, reject) => {
        try{
            let balance
            balance = await erc20TokenInstance.balanceOf.call(escrowInstance.address, {from: karmaMainAccount})
            // async.eachSeries(depositors, async(depositor, cb) => {
            await unlockAccount(karmaMainAccount)
                await escrowInstance.getDepositedTokensSeizeCollateral(balance, {from: karmaMainAccount, gas: 8000000})
            await lockAccount(karmaMainAccount)
                // cb()
            // }, () => {
            //     console.log('In final callback of getDepositedTokensForSeizeCollateral')
                resolve({
                    status: 'success',
                    message: 'Executed getDepositedTokensSeizeCollateral successfully',
                    data: []
                })
            // })
        } catch (error) {
            console.log('error in getDepositedTokensForSeizeCollateral baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the hash KECCAK256 Hash
 * */
function getSHA3(params) {
    return hashingJSON.generateSHA3(params.jsonSchema)
}

/*
* Function that sets the Borrower contract address in the BorrowerRegisty
* @param {json} params - The argument JSON object
* */
function setBorrowerContractAddrInBorrowerRegistry(params) {
    return new Promise(async (resolve, reject) => {
        try{
            let debtorHash = hashingJSON.generateSHA3(params.userDetails)
            console.log('debtorHash: ', debtorHash)
            //add params.userDetails into the SQLite user_details table
            console.log('params: ', params)
            await web3APIs.insertIntoUserDetails({
                userDetails: JSON.stringify(params.userDetails),
                email: params.userDetails.email
            })
            await unlockAccount(karmaMainAccount)
            await isMined.checkMining(
                await borrowerRegistryInstance.setBorrowerContractInRegistry(debtorHash, params.debtor, {from: karmaMainAccount, gas: 8000000})
            )
            await lockAccount(karmaMainAccount)
            resolve({
                status: 'success',
                message: 'Executed setBorrowerContractAddrInBorrowerRegistry successfully',
                data: []
            })
        } catch (error) {
            console.log('error in setBorrowerContractAddrInBorrowerRegistry baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function getLatestBlockTimestamp() {
    return new Promise(async (resolve, reject) => {
        let latestBlockTimestamp
        try {
            latestBlockTimestamp = await web3APIs.getLatestBlockTimestamp()
            resolve({
                status: 'success',
                message: 'Latest block timestamp',
                data: [latestBlockTimestamp]
            })
        } catch (error) {
            console.log('error in getLatestBlockTimestamp baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function getTokenAllowanceFromBorrowerToTokenTransferProxy() {
    return new Promise(async (resolve, reject) => {
        try {
            let allowance = await erc20TokenInstance.allowance.call(borrowerInstance.address, tokenTransferProxyInstance.address, {from: karmaMainAccount}).toNumber()
            resolve({
                status: 'success',
                message: 'Allowance details',
                data: [allowance]
            })
        } catch (error) {
            console.log('error in getTokenAllowance baseLogic: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that unlocks the account
 */
function unlockAccount(account, password = 'password', seconds = 10) {
    return new Promise(async(resolve, reject) => {
        try {
            resolve(await web3APIs.unlockAccount(account, password, seconds))
        } catch(error) {
            console.log('error in unlockAccount baseLogic: ', error)
            reject(error.message)
        }
    })
}

/**
 * Function that locks the account
 */
function lockAccount(account) {
    return new Promise(async(resolve, reject) => {
        try {
            resolve(await web3APIs.lockAccount(account))
        } catch(error) {
            console.log('error in lockAccount baseLogic: ', error)
            reject(error.message)
        }
    })
}

/**
 * Function that gets the borrower contract from the borrower registry
 * */
function getBorrowerContractFromBorrowerRegistry(hash) {
    return new Promise(async(resolve, reject) => {
        try {
            let borrower = await borrowerRegistryInstance.getBorrowerContractFromRegistry.call(hash)
            console.log('Borrower in borrower registry: ', borrower)
            resolve({
                status: 'success',
                message: 'Fetched borrower contract succesfully',
                data: [borrower]
            })
        } catch(error) {
            console.log('error in getBorrowerContractFromBorrowerRegistry: ', error)
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
function getContractAddrFromTxHash(txHash) {
    return new Promise(async (resolve, reject) => {
        try{
            resolve(await web3APIs.getContractAddressFromTransactionHash(txHash))
        } catch (error) {
            console.log('error in getContractAddrFromTxHash: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that updates contract address in ContractRegisty
 * */
function updateAddressInContractRegistry(params) {
    return new Promise(async (resolve, reject) => {
        try{
            await unlockAccount(karmaMainAccount)
            await isMined.checkMining(
                await contractRegistryInstance.updateAddress(params.contractType, params.contractAddress, {from: karmaMainAccount, gas: 8000000})
            )
            await lockAccount(karmaMainAccount)
            resolve({
                status: 'success',
                message: 'Contract address updated in contract registry',
                data: []
            })
        } catch (error) {
            console.log('error in updateAddressInContractRegistry: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}
function test() {
    return new Promise(async (resolve, reject) => {
        try {
            setNetwork()
            setInstances()
            await getAllEthAccounts()
            //Will Update DebtKernel address
            await updateAddressInContractRegistry({
                contractType: 1,
                contractAddress: '0xa86a10581Af238fa502dC0243851CDddDfcBe1A8'
            })

            //Will Update Collateralizer address
            await updateAddressInContractRegistry({
                contractType: 0,
                contractAddress: '0x6fbAf41ce8eD09DA3ae1e11Dce7B97c41c1EcBd5'
            })
            console.log('Updated DebtKernel and Collateralizer in ContractRegistry')
            resolve('Updated addresses successfully')
        } catch(error) {
            console.log('error in test in baseLogic: ', error)
            reject(error.message)
        }
    })

}

// test()

module.exports = {
    setNetwork,
    setInstances,
    getAllEthAccounts,
    systemWideSettings,

    getContractAddresses,
    printActors,

    createSQLiteTables,

    getFixedDepositAmount,
    depositInEscrowPreRequisites,
    depositInEscrow,

    setBorrowAttrPreRequisites,
    setBorrowerAttr,

    fillDebtOrderPreRequisites,
    executeFillDebtOrder,

    getDebtAgreementTermStartTimestamp,
    getDebtAgreementTermEndTimestamp,
    getDebtAgreements,
    getExpectedDebtRepaymentValue,
    getDebtValueRepaidToDate,
    repaymentOfDebtPreRequisites,
    repaymentOfDebt,


    withdrawFromEscrow,
    getScalingFactors,

    executeSeizeOrReturnCollateral,
    fetchCollateralDetails,
    transferCollateralAmount,

    getEmiDetails,
    // printTheLedger,
    // tabularLedger,
    printLenderLedger,
    printBorrowerLedger,
    openDBConnection,
    closeDBConnection,
    printDepositorsLedger,
    getDepositedTokensFromEscrow,
    getDepositedTokensForSeizeCollateral,
    getLoanInvolverBal,
    setBorrowerContractAddrInBorrowerRegistry,
    getLatestBlockTimestamp,
    getRepaymentTimestampsFromDB,
    getTokenAllowanceFromBorrowerToTokenTransferProxy,

    unlockAccount,
    lockAccount,

    getUserDetailsFromDB,
    getSHA3,
    getBorrowerContractFromBorrowerRegistry,
    getContractAddrFromTxHash,
    setDebtToken,
    updateAddressInContractRegistry
}

