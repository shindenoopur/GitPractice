/**
 * Created by Balaji on 02/11/2019
 * */
const debtLifecycleInterface = require('../../baseLogic')
const demoValues = require('../../../demoValues/demoValues')
const async = require('async')
const lodash = require('lodash')

let accounts = {}
let contractAddresses = {}
let amountThatCanBeDeposited = 0
let args = {}
let collateralDetails
let depositorsArray = []
/**
 * Initial Setup
 * */
function initialSetup() {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked setNetwork() & setInstances() from driver class:')
    debtLifecycleInterface.setNetwork()
    debtLifecycleInterface.setInstances()
}

function getEthAccounts() {
    return new Promise(async(resolve, reject) => {
        console.log('\x1b[36m%s\x1b[0m','\nInvoked getAllEthAccounts() from driver class:')
        try {
            let response = await debtLifecycleInterface.getAllEthAccounts()
            if (response.status === 'success') {
                console.log('response.data: ', response)
                accounts = response.data[0]
                resolve({
                    status: response.status,
                    message: response.message,
                    data: response.data
                })
            } else {
                reject(response)
            }
        } catch (error) {
            console.log('error in getEthAccounts driver: ', error)
            reject(response)
        }
    })

}

function getContractAddrsAndInitialArgs(invocator) {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked getContractAddresses() from driver class:')
    contractAddresses = (debtLifecycleInterface.getContractAddresses()).data[0]
    args.version = accounts.acc1
    args.debtor = contractAddresses.borrowerAddress
    args.underwriter = accounts.acc2
    args.collateralizeTermsContractAddress = contractAddresses.collateralizeTermsContractAddress
    args.escrowAddress = contractAddresses.escrowAddress
    args.relayer = accounts.acc3
    args.underwriterFee = demoValues[invocator].underwriterFee
    args.relayerFee = demoValues[invocator].relayerFee
    args.creditorFee = demoValues[invocator].creditorFee
    args.debtorFee = demoValues[invocator].debtorFee
    args.underwriterRiskRating = demoValues[invocator].underwriterRiskRating
    args.salt = Date.now()
    args.principalAmount = demoValues[invocator].principalAmount
    args.interestRate = demoValues[invocator].interestRate
    args.amortizationUnit = demoValues[invocator].amortizationUnit
    args.termLength = demoValues[invocator].termLength
    args.collateralAmount = demoValues[invocator].collateralAmount
    args.gracePeriodInDays = demoValues[invocator].gracePeriodInDays
    args.regulator = accounts.acc7

    depositorsArray = [
        {
            address: accounts.acc9,
            initialBalance: demoValues[invocator].transferToCreditor
        },
        {
            address: accounts.acc8,
            initialBalance: demoValues[invocator].transferToCreditor
        },
        {
            address: accounts.acc7,
            initialBalance: demoValues[invocator].transferToCreditor
        },
        {
            address: accounts.acc6,
            initialBalance: demoValues[invocator].transferToCreditor
        }
    ]
}

function setSystemWideSettings() {
    return new Promise(async (resolve, reject) => {
        let systemWideResponse
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked systemWideSettings() from driver class:')
            systemWideResponse = await debtLifecycleInterface.systemWideSettings()
            if (systemWideResponse.status === 'success') {
                resolve(systemWideResponse)
            } else {
                reject(systemWideResponse)
            }
        } catch(error) {
            console.log('error in setSystemWideSettings driver: ', error)
            reject(systemWideResponse)
        }

    })
}

/**
 * End of Initial Setup
 * */
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Escrow Deposit
 * */
function setupDepositPreReq(depositors, noOfTokens) {
    return new Promise(async (resolve, reject) => {
        let depoPreReqResponse
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked depositInEscrowPreRequisites() from driver class:')
            depoPreReqResponse = await debtLifecycleInterface.depositInEscrowPreRequisites(depositors, noOfTokens)
            if (depoPreReqResponse.status === 'success') {
                resolve(depoPreReqResponse)
            } else {
                reject(depoPreReqResponse)
            }
        } catch(error) {
            console.log('error in setupDepositPreReq driver: ', error)
            reject(depoPreReqResponse)
        }

    })
}

function getAmountThatDeposited() {
    return new Promise (async (resolve, reject) => {
        let amountDepoResponse
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked getFixedDepositAmount() from driver class:')
            amountDepoResponse = await debtLifecycleInterface.getFixedDepositAmount()
            if (amountDepoResponse.status === 'success') {
                amountThatCanBeDeposited = amountDepoResponse.data[0]
                // console.log('amount that can be deposited: ', amountThatCanBeDeposited)
                resolve(amountDepoResponse)
            } else {
                reject(amountDepoResponse)
            }
        } catch(error) {
            console.log('error in getAmountThatDeposited driver: ', error)
            reject(amountDepoResponse)
        }
    })
}

function startDepositInEscrow(depositors, amount) {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            console.log('\x1b[36m%s\x1b[0m', '\nInvoked depositInEscrow() from driver class:')
            response = await  debtLifecycleInterface.depositInEscrow(depositors, amount)
            if (response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch(error) {
            console.log('error in startDepositInEscrow driver: ', error)
            reject(response)
        }

    })

}
/**
 * End of Escrow Deposit
 * */
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
* Borrower Attributes
* */
function setupBorrower(params) {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked setBorrowAttrPreRequisites() from driver class:')
            response = await debtLifecycleInterface.setBorrowAttrPreRequisites(params)
            if (response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch(error) {
            console.log('error in setupBorrower driver: ', error)
            reject(response)
        }
    })
}

function executeSetBorrowerAttr(params) {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked setBorrowerAttr() from driver class:')
            // console.log('Params: ', debtor, principalAmount, regulator)
            response = await debtLifecycleInterface.setBorrowerAttr(params)
            if (response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch(error) {
            console.log('error in executeSetBorrowerAttr driver: ', error)
            reject(response)
        }
    })
}
/**
 * End of Borrower Attributes
 * */
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * FillDebtOrder Pre-reqs
 * */
function setupFillDebtOrder(params) {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked fillDebtOrderPreRequisites() from driver class:')
            // console.log('args : ', args)
            response = await debtLifecycleInterface.fillDebtOrderPreRequisites(params)
            if (response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch (error) {
            console.log('error in setupFillDebtOrder: ', error)
            reject(response)
        }

    })

}

function fillDebtOrder(params) {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked executeFillDebtOrder() from driver class:')
            response = await debtLifecycleInterface.executeFillDebtOrder(params)
            if (response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch (error) {
            console.log('error in fillDebtOrder: ', error)
            reject(response)
        }

    })
}
/**
 * End of FillDebtOrder Pre-reqs
 * */
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/**
 * Repayment Pre-reqs
 * */
function repayPreReqs(dependingOnDebtStory) {
    return new Promise (async (resolve, reject) => {
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked repaymentOfDebtPreRequisites() from driver class:')
            let result = (await getDebtAgreeTermEndTimestampAndRepaymentValue()).data
            let repaymentValue
            let response = await getRepaymentValue(dependingOnDebtStory, result)
            console.log('dependingOnDebtStory in repayPreReqs: ', dependingOnDebtStory)
            if (dependingOnDebtStory !== 'karmaDebt') {
                repaymentValue = response.data[0]
            } else {
                console.log('response in repayPreReqs', JSON.stringify(response))
                repaymentValue = lodash.sumBy(response.data[0], 'value')
                console.log('repaymentValue in repayPreReqs:', repaymentValue)
            }
            await debtLifecycleInterface.repaymentOfDebtPreRequisites(args.debtor, repaymentValue)
            resolve({
                status: 'success',
                message: 'Pre requisites for repayment successful',
                data: []
            })
        } catch(error) {
            console.log('error in repayPreReqs driver: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })

}
/**
 * End of Repayment Pre-reqs
 * */
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//Below function may be useful thus commented it instead of removing
// function getRepaymentTimestamps(debtIssuedTimestamp, noOfDays) {
//     let response = { }
//     let noOfEmis = noOfDays / 30
//     let key
//     for (let i = 1; i <= noOfEmis; i++) {
//         key = "before"+i+"MonthTimestamp"
//         response[key] = debtIssuedTimestamp + (demoValues.SECONDS_IN_DAY * (30 * i))
//     }
//     return response
// }

function getRepaymentValueInFIFOManner(emiAmount, debtAgreement) {
    return new Promise(async(resolve, reject) => {

        try {
            let response = {}
            let totalAmountToRepay = 0, allowance, numberOfUnpaidEMIs
            // let debtIssuedTimestamp = (await debtLifecycleInterface.getDebtAgreementTermStartTimestamp(debtAgreement)).data[0]
            // let repaymentTimestamps = getRepaymentTimestamps(debtIssuedTimestamp, demoValues.NO_OF_DAYS)
            let registerRepaymentTimestamp = (await debtLifecycleInterface.getRepaymentTimestampsFromDB(debtAgreement)).data
            let currentTimestamp = (await debtLifecycleInterface.getLatestBlockTimestamp()).data[0]
            // console.log('repaymentTimestamps EMIS', repaymentTimestamps)

            if(registerRepaymentTimestamp.data[0] !== undefined) {
                console.log('response in FIFO manner: ', response)
                console.log('registerRepaymentTimestamps: ', registerRepaymentTimestamp.data[0].repaymentTimestamp)
                console.log('currentTimestamp: ', currentTimestamp)
                console.log(((currentTimestamp - registerRepaymentTimestamp.data[0].repaymentTimestamp) * 1.0) / (demoValues.SECONDS_IN_DAY * 30))
                numberOfUnpaidEMIs = Math.round(((currentTimestamp - registerRepaymentTimestamp.data[0].repaymentTimestamp) * 1.0) / (demoValues.SECONDS_IN_DAY * 30))
                console.log('Number of unpaid EMIS: ', numberOfUnpaidEMIs)
                console.log('emiAmount: ', emiAmount)
                totalAmountToRepay = numberOfUnpaidEMIs * emiAmount
                //Get Allowance of Borrower to TokenTransferProxy
                allowance = (await debtLifecycleInterface.getTokenAllowanceFromBorrowerToTokenTransferProxy()).data[0]
                console.log('allowance: ', allowance)
                response.repaymentValue = (totalAmountToRepay > emiAmount && totalAmountToRepay > allowance) ?  allowance : emiAmount
                response.invokeRepaymentOfNextDebt = !(response.repaymentValue <= allowance || totalAmountToRepay === 0)
                console.log(!(response.repaymentValue === allowance || totalAmountToRepay === 0))
            } else {
                response.repaymentValue = emiAmount
                response.invokeRepaymentOfNextDebt = false
            }
            //return a JSON object containing repayment value and a flag indicating whether to invoke repayment for current debt or next debt
            resolve({
                status: 'success',
                message: 'Repayment value',
                data: [response]
            })
        } catch (error) {
            console.log('error in getRepaymentValueInFIFOManner: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}
/**
 * Executes Repayment
 * */
function executeRepay(dependingOnDebtStory) {
    return new Promise(async (resolve, reject) => {
        let resultFIFO
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked repaymentOfDebt() from driver class:')
            let result = (await getDebtAgreeTermEndTimestampAndRepaymentValue()).data
            // console.log('result in executeRepay: ', result)
            let repaymentValue
            let response = await getRepaymentValue(dependingOnDebtStory, result)
            // console.log('response in executeRepay: ', response)
            if (dependingOnDebtStory !== 'karmaDebt') {
                repaymentValue = response.data[0]
                await debtLifecycleInterface.repaymentOfDebt(result.myDebtAgreements[0], repaymentValue, contractAddresses.erc20TokenAddress, args.debtor)
                resolve({
                    status: 'success',
                    message: 'Repayment successful',
                    data: []
                })
            } else {
                let matchedObj
                async.eachSeries(result.myDebtAgreements, async (debtAgreement, cb) => {
                    matchedObj = lodash.find(response.data[0], {agreementId: debtAgreement})
                    // console.log('matched object in executeRepay: ', matchedObj)
                    if (matchedObj !== undefined) {
                        repaymentValue = matchedObj.value
                    }
                    resultFIFO = (await getRepaymentValueInFIFOManner(repaymentValue, debtAgreement)).data[0]
                    console.log('resultFIFO: ', resultFIFO)
                    if (resultFIFO.invokeRepaymentOfNextDebt) {
                        cb()
                    } else {
                        await debtLifecycleInterface.repaymentOfDebt(debtAgreement, resultFIFO.repaymentValue, contractAddresses.erc20TokenAddress, args.debtor)
                        cb()
                    }
                }, () => {
                    resolve({
                        status: 'success',
                        message: 'Repayment successful',
                        data: []
                    })
                })
            }
        } catch(error) {
            console.log('error in executeRepay driver: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * Function that gets the repaymentValue depending on the DebtStory
 * */
async function getRepaymentValue(dependingOnDebtStory, result) {
    return new Promise(async (resolve, reject) => {
        try {
            let emiDetails, repaymentAmount
            switch (dependingOnDebtStory) {
                case 'seizeAndThenReturnCollateral':
                    repaymentAmount = result.expectedRepaymentValue[0] - 800
                    resolve({
                        status: 'success',
                        message: 'Repayment value is',
                        data: [repaymentAmount]
                    })
                    break

                case 'returnCollateral':
                    repaymentAmount = result.expectedRepaymentValue[0]
                    resolve({
                        status: 'success',
                        message: 'Repayment value is',
                        data: [repaymentAmount]
                    })
                    break

                case 'seizeCollateral':
                    repaymentAmount = result.expectedRepaymentValue[0] - 800
                    resolve({
                        status: 'success',
                        message: 'Repayment value is',
                        data: [repaymentAmount]
                    })
                    break

                case 'paidPrincipalAndInterest':
                    emiDetails = await debtLifecycleInterface.getEmiDetails(result.myDebtAgreements[0], demoValues.NO_OF_DAYS)
                    // console.log('EMI Details in paidPrincipalAndInterest: ', emiDetails)
                    repaymentAmount = (emiDetails.data[0].installmentAmount * emiDetails.data[0].noOfInstallments)
                    resolve({
                        status: 'success',
                        message: 'Repayment value is',
                        data: [repaymentAmount]
                    })
                    break

                case 'paidInterestNotPrincipal':
                    emiDetails = await debtLifecycleInterface.getEmiDetails(result.myDebtAgreements[0], demoValues.NO_OF_DAYS)
                    // console.log('EMI Details in paidPrincipalAndInterest: ', emiDetails)
                    repaymentAmount = (emiDetails.data[0].monthlyInterest * emiDetails.data[0].noOfInstallments)
                    resolve({
                        status: 'success',
                        message: 'Repayment value is',
                        data: [repaymentAmount]
                    })
                    break

                case 'paidPrincipalNotInterest':
                    emiDetails = await debtLifecycleInterface.getEmiDetails(result.myDebtAgreements[0], demoValues.NO_OF_DAYS)
                    // console.log('EMI Details in paidPrincipalAndInterest: ', emiDetails)
                    repaymentAmount = ((emiDetails.data[0].installmentAmount - emiDetails.data[0].monthlyInterest) * emiDetails.data[0].noOfInstallments) + 10 //To avoid debt in default state
                    resolve({
                        status: 'success',
                        message: 'Repayment value is',
                        data: [repaymentAmount]
                    })
                    break

                case 'karmaDebt':
                    // console.log('debtAgreements for karmaDebt: ', result)
                    let emiOfDebtAgreement, response = []
                    async.eachSeries(result.myDebtAgreements, async (debtAgreementId, cb) => {
                        emiOfDebtAgreement = await debtLifecycleInterface.getEmiDetails(debtAgreementId, demoValues.NO_OF_DAYS)
                        response.push({
                            agreementId: debtAgreementId,
                            value: emiOfDebtAgreement.data[0].installmentAmount
                        })
                        // response[index].value -= 500 //s.t. the first debt agreements collateral will be seized
                        cb()
                    }, () => {
                        // console.log('response in final callback: ', response)
                        // repaymentAmount = response
                        resolve({
                            status: 'success',
                            message: 'Repayment value is',
                            data: [response]
                        })
                    })
                    break
                default: throw new Error('No case matched in getRepaymentValue')
            }
            // resolve({
            //     status: 'success',
            //     message: 'Repayment value is',
            //     data: [repaymentAmount]
            // })
        } catch (error) {
            console.log('error in getRepaymentValue: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Executes Withdraw
 * */
function executeWithdraw(depositors, principalAmount) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked withdraw() from driver class:')
            // console.log('depositor in driver: ', )
            let response = await debtLifecycleInterface.withdrawFromEscrow(depositors, principalAmount)
            if (response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch (error) {
            console.log('error in executeWithdraw driver: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }

    })
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * getScalingFactors
 * */
function getScalingFactors(creditor) {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked getScalingFactors() from driver class:')
            // console.log('depositor in driver: ', )
            response = await debtLifecycleInterface.getScalingFactors(creditor)
            if(response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch(error) {
            console.log('error in getScalingFactors driver: ', error)
            reject(response)
        }
    })
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * invokeSeizeOrReturnCollateral
 * */
function invokeSeizeOrReturnCollateral(invokedBy) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked executeSeizeOrReturnCollateral() from driver class:')
            let result = (await getDebtAgreeTermEndTimestampAndRepaymentValue()).data
            if (invokedBy !== 'karmaDebt') {
                await debtLifecycleInterface.executeSeizeOrReturnCollateral(result.myDebtAgreements[0], args)

            } else {
                //for each series will be used since for KarmaDebt story multiple debt agreements will be rapid back
                async.eachSeries(result.myDebtAgreements, async (debtAgreement, index, cb) => {
                    await debtLifecycleInterface.executeSeizeOrReturnCollateral(debtAgreement, args.debtor)
                    cb()
                }, () => {
                    resolve({
                        status: 'success',
                        message: 'Repayment successful',
                        data: []
                    })
                })
            }
            resolve({
                status: 'success',
                message: 'Invoked seize or return collateral successful',
                data: []
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


function getDebtAgreeTermEndTimestampAndRepaymentValue() {
    return new Promise(async (resolve, reject) => {
        try {
            let response = {
                myDebtAgreements: '',
                termEndTimestamp: '',
                expectedRepaymentValue: ''
            }
            let termEndTimestampArr = [], expectedRepaymentValueArr = []
            // console.log('Debtors debt agreements are: ',(await debtLifecycleInterface.getDebtAgreements(args.debtor)).data)
            response.myDebtAgreements = (await debtLifecycleInterface.getDebtAgreements(args.debtor, args.escrowAddress)).data[0]
            async.eachOfSeries(response.myDebtAgreements, async (debtAgreementId, index, cb) => {
                termEndTimestampArr.push((await debtLifecycleInterface.getDebtAgreementTermEndTimestamp(debtAgreementId)).data[0])
                expectedRepaymentValueArr.push((await debtLifecycleInterface.getExpectedDebtRepaymentValue(debtAgreementId, termEndTimestampArr[index])).data[0])
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
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function checkReturnCollateral(invokedBy) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked repaymentOfDebt() depending on whether to return the seized collateral from driver class:')
            let result = (await getDebtAgreeTermEndTimestampAndRepaymentValue()).data
            let valueRepaidToDate, pendingDebtAmount, response
            if (invokedBy !== 'karmaDebt') {
                valueRepaidToDate = (await debtLifecycleInterface.getDebtValueRepaidToDate(result.myDebtAgreements[0])).data[0]
                pendingDebtAmount = result.expectedRepaymentValue[0] - valueRepaidToDate
                response = await debtLifecycleInterface.repaymentOfDebt(result.myDebtAgreements[0], pendingDebtAmount, contractAddresses.erc20TokenAddress, args.debtor) //Pay the remaining amount
                if(response.status === 'success') {
                    resolve(response)
                } else {
                    reject(response)
                }
            } else {
                async.eachOfSeries(result.myDebtAgreements, async (debtAgreementId, index, cb) => {
                    valueRepaidToDate = (await debtLifecycleInterface.getDebtValueRepaidToDate(debtAgreementId)).data[0]
                    pendingDebtAmount = result.expectedRepaymentValue[index] - valueRepaidToDate
                    response = await debtLifecycleInterface.repaymentOfDebt(debtAgreementId, pendingDebtAmount, contractAddresses.erc20TokenAddress, args.debtor) //Pay the remaining amount
                    cb()
                }, () => {
                    resolve(response)
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

function getCollateralDetails(invokedBy) {
    return new Promise (async (resolve, reject) => {
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked fetchCollateralDetails() from driver class:')
            let result = (await getDebtAgreeTermEndTimestampAndRepaymentValue()).data
            let valueRepaidToDate
            if (invokedBy !== 'karmaDebt') {
                collateralDetails = (await debtLifecycleInterface.fetchCollateralDetails(result.myDebtAgreements[0])).data[0]
                valueRepaidToDate = (await debtLifecycleInterface.getDebtValueRepaidToDate(result.myDebtAgreements[0])).data[0]
                // 2 indicates that the collateral has been seized
                if(collateralDetails.collateralState === 2 && (valueRepaidToDate >= result.expectedRepaymentValue[0])) {
                    console.log('*********************************Initiate transfer of collateralAmount to the debtor*********************************')
                    await debtLifecycleInterface.transferCollateralAmount(collateralDetails.collateralizer, collateralDetails.collateralAmount)
                }
                resolve({
                    status: 'success',
                    message: 'Collateral returned successfully',
                    data: []
                })
            } else {
                    async.eachOfSeries(result.myDebtAgreements, async (debtAgreementId, index, cb) => {
                        collateralDetails = (await debtLifecycleInterface.fetchCollateralDetails(debtAgreementId)).data[0]
                        valueRepaidToDate = (await debtLifecycleInterface.getDebtValueRepaidToDate(debtAgreementId)).data[0]
                        if(collateralDetails.collateralState === 2 && (valueRepaidToDate >= result.expectedRepaymentValue[index])) {
                            console.log('*********************************Initiate transfer of collateralAmount to the debtor*********************************')
                            await debtLifecycleInterface.transferCollateralAmount(collateralDetails.collateralizer, collateralDetails.collateralAmount)
                        }
                        cb()
                    }, () => {
                        resolve({
                            status: 'success',
                            message: 'Collateral returned successfully',
                            data: []
                        })
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

function orderOfFunExeForRestDebtStories(invocator) {
    return new Promise(async (resolve, reject) => {
        try {
            await executeWithdraw(depositorsArray, demoValues[invocator].principalAmount)  //account.acc7 is the depositor
            await getScalingFactors(contractAddresses.escrowAddress)
            //Decide whether to return or seize collateral
            await invokeSeizeOrReturnCollateral(invocator)
            resolve({
                status: 'success',
                message: 'Order of function invocation for rest debt stories successful',
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

function dependentFunctionInvocations(invocator) {
    return new Promise(async (resolve, reject) => {
        try {
            switch(invocator) {
                case 'seizeAndThenReturnCollateral':
                    await invokeSeizeOrReturnCollateral(invocator)
                    await checkReturnCollateral(invocator)
                    await getCollateralDetails(invocator)
                    await executeWithdraw(depositorsArray, demoValues[invocator].principalAmount)  //account.acc7 is the depositor
                    await getScalingFactors(contractAddresses.escrowAddress)
                    break

                case 'returnCollateral':
                    await orderOfFunExeForRestDebtStories(invocator)
                    break

                case 'seizeCollateral':
                    await orderOfFunExeForRestDebtStories(invocator)
                    break

                case 'paidPrincipalAndInterest':
                    await  orderOfFunExeForRestDebtStories(invocator)
                    break

                case 'paidInterestNotPrincipal':
                    await orderOfFunExeForRestDebtStories(invocator)
                    break

                case 'paidPrincipalNotInterest':
                    await orderOfFunExeForRestDebtStories(invocator)
                    break

                case 'karmaDebt':
                    await executeWithdraw(depositorsArray, demoValues[invocator].principalAmount)  //account.acc7 is the depositor
                    await getScalingFactors(contractAddresses.escrowAddress)
                    break

                default:
                    reject({
                        status: 'failure',
                        message: 'No case matched in dependentFunctionInvocations',
                        data: []
                    })
            }
            resolve({
                status: 'success',
                message: 'Dependent function invocation successful',
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

function invokePrintActors(actors) {
    console.log('\x1b[36m%s\x1b[0m','\nInvoked printActors() from driver class:')
    debtLifecycleInterface.printActors(actors)
}

// async function invokePrintTheLedger(params) {
//     return new Promise(async(resolve, reject) => {
//         try {
//             console.log('\x1b[36m%s\x1b[0m','\nInvoked printTheLedger() from driver class:')
//             resolve(await debtLifecycleInterface.printTheLedger(params))
//         } catch (error) {
//             reject({
//                 status: 'failure',
//                 message: error.message,
//                 data: []
//             })
//         }
//
//     })
// }

/**
 * Function that prints the lender ledger
 * */
function invokePrintLenderLedger(params) {
    return new Promise(async (resolve, reject) => {
        try{
            console.log('\x1b[36m%s\x1b[0m','\nInvoked printLenderLedger() from driver class:')
            resolve(await debtLifecycleInterface.printLenderLedger(params))
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
 * Function that prints the borrower ledger
 * */
function invokePrintBorrowerLedger(params) {
    return new Promise(async (resolve, reject) => {
        try{
            console.log('\x1b[36m%s\x1b[0m','\nInvoked printBorrowerLedger() from driver class:')
            resolve(await debtLifecycleInterface.printBorrowerLedger(params))
        } catch (error) {
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function invokeCreateSQLiteTables() {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked createSQLiteTables() from driver class:')
            response = await debtLifecycleInterface.createSQLiteTables()
            if(response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch(error) {
            console.log('error in invokeCreateSQLiteTables driver: ', error)
            reject(response)
        }
    })
}

function invokeCloseDBConnection() {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked closeDBConnection() from driver class:')
            response = await debtLifecycleInterface.closeDBConnection()
            if(response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch (error) {
            console.log('error in invokeCloseDBConnection driver: ', error)
            reject(response)
        }
    })
}


function invokeOpenDBConnection() {
    return new Promise(async (resolve, reject) => {
        let response
        try {
            console.log('\x1b[36m%s\x1b[0m','\nInvoked openDBConnection() from driver class:')
            response = await debtLifecycleInterface.openDBConnection()
            if(response.status === 'success') {
                resolve(response)
            } else {
                reject(response)
            }
        } catch (error) {
            console.log('error in invokeOpenDBConnection driver: ', error)
            reject(response)
        }
    })
}


/**
 * Function that prints the depositors ledger
 * */
function invokePrintDepositorsLedger(params) {
    return new Promise(async (resolve, reject) => {
        try{
            console.log('\x1b[36m%s\x1b[0m', params.message)
            resolve(await debtLifecycleInterface.printDepositorsLedger(params))
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
 * Function that gets the remaining tokens from the Escrow
 * */
function invokeGetDepositedTokens(params) {
    return new Promise(async (resolve, reject) => {
        try{
            console.log('\x1b[36m%s\x1b[0m', 'Invoked getDepositedTokens() from driver class')
            resolve(await debtLifecycleInterface.getDepositedTokensFromEscrow(params))
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
 * Function that gets the remaining tokens from the Escrow in case of seize collateral
 * * */
function invokeGetDepositedTokensForSeizeCollateral() {
    return new Promise(async (resolve, reject) => {
        try{
            console.log('\x1b[36m%s\x1b[0m', 'Invoked getDepositedTokensForSeizeCollateral() from driver class')
            resolve(await debtLifecycleInterface.getDepositedTokensForSeizeCollateral())
        } catch (error) {
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}


// function invokeGetLoanInvolverBal() {
//     return new Promise(async (resolve, reject) => {
//         try{
//             console.log('\x1b[36m%s\x1b[0m', 'Invoked getLoanInvolverBal() from driver class')
//             resolve(await debtLifecycleInterface.getLoanInvolverBal())
//         } catch (error) {
//             reject({
//                 status: 'failure',
//                 message: error.message,
//                 data: []
//             })
//         }
//     })
// }

/**
 * Function that sets the borrower contract address in the borrower registry
 * */
function executeSetBorrowerContractAddrInBorrRegistry(params) {
    return new Promise(async (resolve, reject) => {
        try{
            console.log('\x1b[36m%s\x1b[0m', 'Invoked setBorrowerContractAddrInBorrowerRegistry() from driver class')
            resolve(await debtLifecycleInterface.setBorrowerContractAddrInBorrowerRegistry(params))
        } catch (error) {
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function invokeRestFunctionsForKarmaDebt(invokedBy) {
    return new Promise(async(resolve, reject) => {
        try {
            await dependentFunctionInvocations(invokedBy)



            // await invokePrintTheLedger({
            //     escrowAddress: contractAddresses.escrowAddress,
            //     borrowerAddress: contractAddresses.borrowerAddress
            // })

            // let response = await invokeGetLoanInvolverBal()
            //
            // if (response.LenderEscrowBalance > 0) {
            //     await invokeGetDepositedTokens({
            //         depositors: depositorsArray
            //     })
            // }

            if (invokedBy === 'returnCollateral' ) {
                await invokeGetDepositedTokens({
                    depositors: depositorsArray
                })
            }


            let result = (await getDebtAgreeTermEndTimestampAndRepaymentValue()).data
            let collateralDetails
            if (invokedBy !== 'karmaDebt') {
                collateralDetails = (await debtLifecycleInterface.fetchCollateralDetails(result.myDebtAgreements[0])).data[0]
                if (collateralDetails.collateralState === 2) {
                    await invokeGetDepositedTokensForSeizeCollateral({})
                }
            } else {
                async.eachOfSeries(result.myDebtAgreements, async (debtAgreementId, index, cb) => {
                    collateralDetails = (await debtLifecycleInterface.fetchCollateralDetails(debtAgreementId)).data[0]
                    if (collateralDetails.collateralState === 2) {
                        await invokeGetDepositedTokensForSeizeCollateral({})
                    }
                    cb()
                })
            }

            // if (invokedBy !== 'karmaDebt') {
            setTimeout(async() => {
                await invokePrintLenderLedger({
                    escrowAddress: contractAddresses.escrowAddress,
                    borrowerAddress: contractAddresses.borrowerAddress,
                    collateralizerAddress: contractAddresses.collateralizeAddress,
                    lenderInitialBalance: 0,
                    borrowerInitialBalance: 2 * demoValues[invokedBy].collateralAmount,
                    debtStory: invokedBy
                })

                await invokePrintBorrowerLedger({
                    escrowAddress: contractAddresses.escrowAddress,
                    borrowerAddress: contractAddresses.borrowerAddress,
                    collateralizerAddress: contractAddresses.collateralizeAddress,
                    lenderInitialBalance: 0,
                    borrowerInitialBalance: 2 * demoValues[invokedBy].collateralAmount,
                    debtStory: invokedBy
                })


                await invokePrintDepositorsLedger({
                    message: 'Depositors ledger details',
                    depositors: depositorsArray,
                    escrowAddress: contractAddresses.escrowAddress,
                    initialBalance: demoValues[invokedBy].transferToCreditor
                })
                await invokeCloseDBConnection()
            }, 10000)
            // }
        } catch (error) {
            console.log('error in restAll functions: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })

}

async function invokeAllFunctions(invokedBy){
    initialSetup()
    await getEthAccounts()
    await setSystemWideSettings() //This will be done prior to the building of the docker image, s.t. the APIs can be tested successfully

    getContractAddrsAndInitialArgs(invokedBy)
    console.log('Depositors array: ', depositorsArray)
    console.log('arguments : ', args)
    invokePrintActors({
        LenderEscrow: args.escrowAddress,
        Borrower: args.debtor,
        Depositors: depositorsArray,
        Regulator: args.regulator,
        TermsContract: args.collateralizeTermsContractAddress,
        Collateralizer: contractAddresses.collateralizeTermsContractAddress,
        Version: args.version,
        Underwriter: args.underwriter,
        Relayer: args.relayer
    })
    await invokeOpenDBConnection()

    await invokeCreateSQLiteTables()
    await getAmountThatDeposited()

    await setupDepositPreReq(depositorsArray, demoValues[invokedBy].transferToCreditor)

    await startDepositInEscrow(depositorsArray, demoValues[invokedBy].eachDepositorsDeposit)

    args.invokedBy = invokedBy
    args.noOfDays = demoValues.NO_OF_DAYS
    await setupBorrower(args) //account.acc7 is the regulator
    await executeSetBorrowerAttr(args)

    // if (invokedBy === 'karmaDebt') {
    //     await executeSetBorrowerContractAddrInBorrRegistry(args)
    // }

    await setupFillDebtOrder(args)
    await fillDebtOrder(args)

    // return 0

    //In case of successful repaymentValue, return the collateralAmount
    // In case of loan defaulter, the collateralAmount should be seized
    //check for multiple EMIs payments
    if(invokedBy !== 'karmaDebt') {
        await repayPreReqs(invokedBy)
        await executeRepay(invokedBy)
        invokeRestFunctionsForKarmaDebt(invokedBy)
    } else {
        async.eachSeries([1, 2, 3], async(element, cb) => {
            await repayPreReqs(invokedBy)
            await executeRepay(invokedBy)
            cb()
        }, () => {
            //Calls the rest functions
            invokeRestFunctionsForKarmaDebt(invokedBy)
        })
    }


}

// invokeAllFunctions()

module.exports = {
    invokeAllFunctions
}
