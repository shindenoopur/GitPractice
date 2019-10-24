const async = require('async')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

const baseLogic = require('../reactApiConnectLayer/debtLifeCycle/core/baseLogic')

/**
 * Function that boot straps the entire system
 * */
function bootStrapSystem() {
    return new Promise(async (resolve, reject) => {
        try {
            setNetworkAndInstances()
            await getEOAccounts()
            await baseLogic.systemWideSettings()
            await baseLogic.openDBConnection()
            await baseLogic.createSQLiteTables()
            resolve({
                status: 'success',
                message: 'System boot strapped successfully',
                data: []
            })
        } catch (error) {
            console.log('error in bootStrapSystem: ',error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Open DB connection
 * */
function openDB() {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await baseLogic.openDBConnection())
        } catch (error) {
            console.log('error in openDB: ',error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Close DB connection
 * */
function closeDB() {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await baseLogic.closeDBConnection())
        } catch (error) {
            console.log('error in closeDB: ',error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the Ethereum accounts
 * */
function getEOAccounts() {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(
                await baseLogic.getAllEthAccounts()
            )
        } catch (error) {
            console.log('error in getEOAccounts: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the deployed contract addresses
 * */
function getContractAddresses() {
    return baseLogic.getContractAddresses()
}

/**
 * Function that gets the debt order parameters
 * @param params JSON object containing the debt order parameters
 * @return {interestRate: string, relayer: string, escrowAddress: string, salt: number, relayerFee: string, creditorFee: string, amortizationUnit: string, debtorFee: string, gracePeriodInDays: string, underwriterFee: string, version: string, principalAmount: string, collateralizeTermsContractAddress: string, debtor: string, termLength: string, collateralAmount: string, underwriterRiskRating: string, regulator: string, underwriter: string}
 * */
function getDebtOrderParameters(params) {
    return new Promise(async(resolve, reject) => {
        try {
            let accounts = (await getEOAccounts()).data[0]
            let contractAddresses = (getContractAddresses()).data[0]
            let debtor = (await getBorrowerFromBorrowerRegistry(params)).data[0]
            let debtOrderParameters = {
                version: accounts.acc1,
                debtor: debtor,
                underwriter: accounts.acc2,
                collateralizeTermsContractAddress: contractAddresses.collateralizeTermsContractAddress,
                erc20TokenAddress: contractAddresses.erc20TokenAddress,
                escrowAddress: contractAddresses.escrowAddress,
                relayer: accounts.acc3,
                underwriterFee: 0,
                relayerFee: 0,
                creditorFee: 0,
                debtorFee: 0,
                underwriterRiskRating: 1000,
                salt: Date.now(),
                principalAmount: params.principalAmount,
                interestRate: params.interestRate,
                amortizationUnit: 1,
                termLength: 100,
                collateralAmount: params.collateralAmount,
                gracePeriodInDays: 30,
                regulator: accounts.acc5,
                invokedBy: 'karmaDebt',
                noOfDays: params.numberOfDays
            }
            resolve({
                status: 'success',
                message: 'Debt order parameters are: ',
                data: [debtOrderParameters]
            })
        } catch(error) {
            console.log('error in getDebtOrderParameters: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the depositors
 * @param accounts Account address
 * @param initialTransfer Number of tokens to transfer initially
 * @return {address: *, initialBalance: *}[]
 * */
function getDepositors(accounts, initialTransfer) {
    return ([
        {
            address: accounts.acc9,
            initialBalance: initialTransfer
        },
        {
            address: accounts.acc8,
            initialBalance: initialTransfer
        },
        {
            address: accounts.acc7,
            initialBalance: initialTransfer
        },
        {
            address: accounts.acc6,
            initialBalance: initialTransfer
        }
    ])
}

/**
 * Function that gets the amount that can be deposited into the Escrow
 * */
function amountThatCanBeDepositedInEscrow() {
    return new Promise (async (resolve, reject) => {
        try {
            resolve(await baseLogic.getFixedDepositAmount())
        } catch (error) {
            console.log('error in amountThatCanBeDepositedInEscrow : ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that invokes deposits in Escrow
 * @param depositors Array of depositors
 * @param initialTransfer Number of tokens to transfer initially
 * @param eachDepositorsDeposit Number of tokens each depositor deposits in Escrow
 * */
function depositTokensInEscrow(depositors, initialTransfer, eachDepositorsDeposit) {
    return new Promise (async (resolve, reject) => {
        try {
            //Note: eachDepositorsDeposit < initialTransfer
            await baseLogic.depositInEscrowPreRequisites(depositors, initialTransfer)
            resolve(await baseLogic.depositInEscrow(depositors, eachDepositorsDeposit))
        } catch (error) {
            console.log('error in depositTokensInEscrow : ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that sets the borrowing limit for Borrower
 * @param params JSON
 * params => {
 *     regulator: '',
 *     principalAmount: '',
 *     email: ''
 * }
 * */
function setBorrowingLimitForBorrower(params) {
    return new Promise (async (resolve, reject) => {
        try {
            await baseLogic.setBorrowAttrPreRequisites(params)
            params.debtor = (await getBorrowerFromBorrowerRegistry(params)).data[0]
            resolve(await baseLogic.setBorrowerAttr(params))
        } catch (error) {
            console.log('error in setBorrowingLimitForBorrower : ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}


/**
 * Function that gets the Borrower Contract from BorrowerRegistry by calculating it's hash from it's JSON stored in DB
 * */
function getBorrowerFromBorrowerRegistry(params) {
    return new Promise(async (resolve, reject) => {
        try {
            let userDetails = (await baseLogic.getUserDetailsFromDB(params)).data[0].UserDetails
            console.log('userDetails: ', userDetails)
            let hash = baseLogic.getSHA3({jsonSchema: JSON.parse(userDetails)})
            console.log('hash : ', hash)
            resolve(await baseLogic.getBorrowerContractFromBorrowerRegistry(hash))
        } catch(error) {
            console.log('error in getBorrowerFromBorrowerRegistry: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that sets the Borrower contract address in the Borrower Registry
 * */
function setBorrowerInBorrowerRegistry(params) {
    return new Promise (async (resolve, reject) => {
        try {
            //Make an entry in the borrowerRegistry for the new Borrower
            resolve(await baseLogic.setBorrowerContractAddrInBorrowerRegistry(params)) //params should contain debtor and userDetails key value pairs
        } catch (error) {
            console.log('error in setBorrowingLimitForBorrower : ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that deploys the Borrower contract
 * @param networkName Network name can be either ganache, goerli, rinkeby etc
 * */
function deployBorrower(networkName='ganache') {
    return new Promise(async (resolve, reject) => {
        try {
            let accounts = (await getEOAccounts()).data[0]
            let borrowerAddress
            //Unlock account
            await baseLogic.unlockAccount(accounts.acc1)
            if (networkName === 'ganache') {
                borrowerAddress = await exec ('npm run migrateBorrowerGanache')
                console.log('borrower address: ', borrowerAddress)
                    resolve({
                        status: 'success',
                        message: 'Deployed borrower successfully',
                        data: [borrowerAddress]
                    })
            } else {
                const {stdout, stderr} = await exec('npm run migrateBorrowerGoerli')
                console.log(stdout)
                console.log('stderr: ', stderr)
                resolve({
                    status: 'success',
                    message: 'Deployed borrower successfully',
                    data: []
                })
            }
        } catch (error){
            console.log('error in deployEscrow')
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

// deployBorrower()
// async function test() {
//     setNetworkAndInstances()
//     await bootStrapSystem()
//     let output = (await deployBorrower('ganache')).data[0]
//     console.log('output in test: ', output.split(':'))
//     console.log('output', output.search('contract address'))
//     //TODO @balaji ask chaitanya how to get the depoyed borrower contract address from stdout
//     await setBorrowerInBorrowerRegistry( {
//         userDetails: {
//             firstName: 'Balaji',
//             lastName: 'Pachai',
//             dob: '12/08/1991',
//             email: 'balaji.pachai08@gmail.com',
//             address: 'Dehuroad'
//         }
//     })
//     await setBorrowingLimitForBorrower({
//         regulator: '0x9407010118415E9356Fc8e7d21A491311B4581E3',
//         principalAmount: 500,
//         email: 'balaji.pachai08@gmail.com'
//     })
// }

// test()

/**
 * Function that fills the debt order
 * @param params JSON
 * */
function fillDebtOrder(params) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await baseLogic.fillDebtOrderPreRequisites(params))
        } catch (error) {
            console.log('error in fillDebtOrder: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}


function invokeSetDebtToken() {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await baseLogic.setDebtToken())
        } catch (error) {
            console.log('error in invokeSetDebtToken: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the repayment details
 * @param params JSON
 * */
function getDebtRepaymentDetails(params) {
    return new Promise(async (resolve, reject) => {
        let response = {
            myDebtAgreements: '',
            termEndTimestamp: '',
            expectedRepaymentValue: ''
        }
        let termEndTimestampArr = [], expectedRepaymentValueArr = []
        try {
            response.myDebtAgreements = (await baseLogic.getDebtAgreements(params.debtor, params.creditor)).data[0]
            async.eachOfSeries(response.myDebtAgreements, async (debtAgreementId, index, cb) => {
                termEndTimestampArr.push((await baseLogic.getDebtAgreementTermEndTimestamp(debtAgreementId)).data[0])
                expectedRepaymentValueArr.push((await baseLogic.getExpectedDebtRepaymentValue(debtAgreementId, termEndTimestampArr[index])).data[0])
                cb()
            }, () => {
                response.termEndTimestamp = termEndTimestampArr
                response.expectedRepaymentValue = expectedRepaymentValueArr
                resolve({
                    status: 'success',
                    message: 'Debt agreement, TermEndTimestamp and repayment values are:',
                    data: response
                })
            })
        } catch (error) {
            console.log('error in getDebtRepaymentDetails: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that starts the repayment for a debt agreement
 * @param debtor Borrower's address
 * @param debtAgreement Debt agreement
 * @param repaymentValue Repayment value
 * @param tokenContractAddress ERC20 token contract address
 * */
function startRepayment(debtor, debtAgreement, repaymentValue, tokenContractAddress) {
    return new Promise(async (resolve, reject) => {
        try {
            await baseLogic.repaymentOfDebtPreRequisites(debtor, repaymentValue)
            resolve(baseLogic.repaymentOfDebt(debtAgreement, repaymentValue, tokenContractAddress, debtor))
        } catch (error) {
            console.log('error in startRepayment: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function to withdraw tokens from the Escrow
 * @param depositors Array of depositors
 * @param principalAmount Principal amount
 * */
function withdrawTokens(depositors, principalAmount) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await baseLogic.withdrawFromEscrow(depositors, principalAmount))
        } catch (error) {
            console.log('error in withdrawTokens: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the scaling factors
 * @param creditor Creditor's address
 * */
function getScalingFactors(creditor) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await baseLogic.getScalingFactors(creditor))
        } catch(error) {
            console.log('error in getScalingFactors driver: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the collateral details
 * @param debtAgreementId
 * */
function getCollateralDetails(debtAgreementId) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await baseLogic.fetchCollateralDetails(debtAgreementId))
        } catch(error) {
            console.log('error in getScalingFactors driver: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the deposited tokens when the collateral is seized
 * */
function getDepositedTokensWhenCollateralSeized() {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await baseLogic.getDepositedTokensForSeizeCollateral())
        } catch(error) {
            console.log('error in getDepositedTokensWhenCollateralSeized driver: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

//Note params should have the depositors array as one of the keys in the JSON object
/**
 * Function that gets the remaining tokens from the Escrow
 * @param params JSON
 * */
function getRemainingTokensFromEscrow(params) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(await baseLogic.getDepositedTokensFromEscrow(params))
        } catch(error) {
            console.log('error in getRemainingTokensFromEscrow driver: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}



/**
 * Function that gets the Debtor's debt agreements
 * @param debtor Borrower address
 * @param creditor Creditor address
 * */
function getMyDebtAgreements(debtor, creditor) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(
                await baseLogic.getDebtAgreements(debtor, creditor)
            )
        } catch (error) {
            console.log('error in getMyDebtAgreements: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the debt agreement end timestamp
 * @param debtAgreement Debt agreement Id
 * */
function getDebtEndTimestamp(debtAgreement) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(
                await baseLogic.getDebtAgreementTermEndTimestamp(debtAgreement)
            )
        } catch (error) {
            console.log('error in getMyDebtAgreements: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the debt agreement start timestamp
 * @param debtAgreement Debt agreement Id
 * */
function getDebtStartTimestamp(debtAgreement) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve (
                await baseLogic.getDebtAgreementTermStartTimestamp(debtAgreement)
            )
        } catch (error) {
            console.log('error in getMyDebtAgreements: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the value repaid to date
 * @param debtAgreement Debt agreement Id
 * */
function getDebtValueRepaidToDateFor(debtAgreement) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(
                await baseLogic.getDebtValueRepaidToDate(debtAgreement)
            )
        } catch (error) {
            console.log('error in getMyDebtAgreements: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the expected repayment value
 * @param debtAgreement Debt agreement Id
 * */
function getDebtExpectedRepaymentValueFor(debtAgreement, timestamp) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(
                await baseLogic.getExpectedDebtRepaymentValue(debtAgreement, timestamp)
            )
        } catch (error) {
            console.log('error in getMyDebtAgreements: ', error)
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
 * @param debtAgreement Debt agreement Id
 * @param numberOfDays Number of days of the Loan
 * */
function getEMIsFor(debtAgreement, numberOfDays = 30, debtor) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(
                await baseLogic.getEmiDetails(debtAgreement, numberOfDays, debtor)
            )
        } catch (error) {
            console.log('error in getMyDebtAgreements: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that shuts down the entire system
 * @param params JSON
 * */
function shutdownSystem(params) {
    return new Promise(async (resolve, reject) => {
        try {
            await baseLogic.printLenderLedger(params)
            await baseLogic.printBorrowerLedger(params)
            await baseLogic.printDepositorsLedger(params)
            resolve(await baseLogic.closeDBConnection())
        } catch(error) {
            console.log('error in shutdownSystem driver: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}


function setNetworkAndInstances() {
    baseLogic.setNetwork()
    baseLogic.setInstances()
}

module.exports = {
    setNetworkAndInstances,
    bootStrapSystem,
    getEOAccounts,
    getContractAddresses,
    getDebtOrderParameters,
    getDepositors,
    amountThatCanBeDepositedInEscrow,
    depositTokensInEscrow,
    setBorrowingLimitForBorrower,
    fillDebtOrder,
    getDebtRepaymentDetails,
    startRepayment,
    withdrawTokens,
    getScalingFactors,
    getCollateralDetails,
    getDepositedTokensWhenCollateralSeized,
    getRemainingTokensFromEscrow,
    shutdownSystem,
    deployBorrower,
    getEMIsFor,
    getDebtExpectedRepaymentValueFor,
    getDebtValueRepaidToDateFor,
    getDebtStartTimestamp,
    getDebtEndTimestamp,
    getMyDebtAgreements,
    setBorrowerInBorrowerRegistry,
    getBorrowerFromBorrowerRegistry,
    openDB,
    closeDB,
    invokeSetDebtToken
}
