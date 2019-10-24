const userInterface = require('./userInterface')

function signUp(params) {
    return new Promise(async (resolve, reject) => {
        try {
            userInterface.setNetworkAndInstances()
            await userInterface.getEOAccounts()
            await userInterface.openDB()
            // await userInterface.deployBorrower('ganache') //TODO @balaji Work on Tuesday to do deploy Borrower either from Web3 or Migrations, it has to be elegant
            let response = await userInterface.setBorrowerInBorrowerRegistry(params)
            await userInterface.closeDB()
            resolve(response)
        } catch (error) {
            console.log('error in signUp: ', error)
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
            let response
            //For signUp
            response = await signUp({
                userDetails: {
                    firstName: 'John',
                    lastName: 'Doe',
                    dob: '12/08/1960',
                    email: 'john30.doe@gmail.com',
                    address: 'Houston'
                },
                debtor: "0x285AcB6D8efa9C3d96c1EfDA736074775531Ae4f"
            })
            console.log('output of signUp: ', response)

            //For addCard
            response = await addCard({
                principalAmount: 600,
                email: 'john30.doe@gmail.com',
            })
            console.log('output of addCard: ', response)

            // For makeLoan
            response = await makeLoan({
                principalAmount: 550,
                interestRate: 10,
                collateralAmount: 551,
                numberOfDays: 30,
                email: 'john30.doe@gmail.com',
            })
            console.log('makeLoan details: ', response)

            // response = await getDebtDetails({
            //     email: 'john5.doe@gmail.com',
            //     whichDetails: 'debtEndTimestamp',
            //     debtAgreementId: debtAgreementId
            // })
            // console.log('debtEndTimestamp: ', response)
            //
            // response = await getDebtDetails({
            //     email: 'john5.doe@gmail.com',
            //     whichDetails: 'debtStartTimestamp',
            //     debtAgreementId: debtAgreementId
            // })
            // console.log('debtStartTimestamp: ', response)

            // console.log('Value repaid till now before repayment: ')
            //
            // response = await getDebtDetails({
            //     email: 'john5.doe@gmail.com',
            //     whichDetails: 'valueRepaidTillNow',
            //     debtAgreementId: debtAgreementId
            // })
            // console.log('valueRepaidTillNow before: ', response)

            //
            // console.log('Expected repayment value: ')
            //
            // response = await getDebtDetails({
            //     email: 'john5.doe@gmail.com',
            //     whichDetails: 'expectedRepaymentValue',
            //     debtAgreementId: debtAgreementId
            // })
            // console.log('expectedRepaymentValue: ', response)
            //
            // console.log('repaying loan: ')
            //
            // response = await repayLoan({
            //     email: 'john5.doe@gmail.com',
            //     debtAgreement: debtAgreementId,
            //     amount: 300,
            //     tokenAddress: ''
            // })
            //
            // console.log('after repayments: ', response)
            //
            //
            // console.log('Value repaid till now after repayment: ')
            //
            // response = await getDebtDetails({
            //     email: 'john2.doe@gmail.com',
            //     whichDetails: 'valueRepaidTillNow',
            //     debtAgreementId: debtAgreementId
            // })
            // console.log('valueRepaidTillNow after: ', response)

            //"can be either of emi, expectedRepaymentValue, valueRepaidTillNow, debtStartTimestamp, debtEndTimestamp, myLoans, repaymentDetails"
        } catch(error) {
            console.log('error in test function: ', error)
            reject(error.message)
        }
    })
}

// test()

function addCard(params) {
    return new Promise(async (resolve, reject) => {
        try {
            userInterface.setNetworkAndInstances()
            let accounts = (await userInterface.getEOAccounts()).data[0]
            await userInterface.openDB()
            let regulator = accounts.acc5
            let response =
                await userInterface.setBorrowingLimitForBorrower(
                    {
                        regulator: regulator,
                        principalAmount: params.principalAmount,
                        email: params.email
                    })
            await userInterface.closeDB()
            resolve(response)
        } catch(error) {
            console.log('error in addCard: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}


//params same as that of getDebtOrderParameters
function makeLoan(params) {
    return new Promise(async (resolve, reject) => {
        try {
            userInterface.setNetworkAndInstances()
            await userInterface.getEOAccounts()
            await userInterface.openDB()
            let debtOrderParameters = (await userInterface.getDebtOrderParameters(params)).data[0]
            let response = await userInterface.fillDebtOrder(debtOrderParameters)
            await userInterface.closeDB()
            resolve(response)
        } catch(error) {
            console.log('error in makeLoan: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

/**
 * params = {
 *     whichDetails: can be either of emi, expectedRepaymentValue, valueRepaidTillNow, debtStartTimestamp, debtEndTimestamp, myLoans, repaymentDetails
 *     debtAgreementId: AgreementID for which above details has to be fetched
 *     email: user@gmail.com
 * }
 * */
function getDebtDetails(params) {
    return new Promise(async (resolve, reject) => {
        try {
            let debtor, result
            userInterface.setNetworkAndInstances()
            await userInterface.getEOAccounts()
            await userInterface.openDB()
            let contractAddresses = (userInterface.getContractAddresses()).data[0]
            params.creditor = contractAddresses.escrowAddress

            switch (params.whichDetails) {
                case 'emi':
                    debtor = (await userInterface.getBorrowerFromBorrowerRegistry(params)).data[0]
                    result = await userInterface.getEMIsFor(params.debtAgreementId, 30, debtor)
                    await userInterface.closeDB()
                    resolve(result)
                    break

                case 'repaymentDetails':
                    debtor = (await userInterface.getBorrowerFromBorrowerRegistry(params)).data[0]
                    //here params.escrowAddress will be the Karma Escrow Contract
                    params.debtor = debtor
                    result = await userInterface.getDebtRepaymentDetails(params)
                    await userInterface.closeDB()
                    resolve(result)
                    break

                case 'myLoans':
                    debtor = (await userInterface.getBorrowerFromBorrowerRegistry(params)).data[0]
                    result = await userInterface.getMyDebtAgreements(debtor, params.creditor)
                    await userInterface.closeDB()
                    resolve(result)
                    break

                case 'debtEndTimestamp':
                    result = await userInterface.getDebtEndTimestamp(params.debtAgreementId)
                    await userInterface.closeDB()
                    resolve(result)
                    break

                case 'debtStartTimestamp':
                    result = await userInterface.getDebtStartTimestamp(params.debtAgreementId)
                    await userInterface.closeDB()
                    resolve(result)
                    break

                case 'valueRepaidTillNow':
                    result = await userInterface.getDebtValueRepaidToDateFor(params.debtAgreementId)
                    await userInterface.closeDB()
                    resolve(result)
                    break

                case 'expectedRepaymentValue':
                    let timestamp = (await userInterface.getDebtEndTimestamp(params.debtAgreementId)).data[0]
                    result = await userInterface.getDebtExpectedRepaymentValueFor(params.debtAgreementId, timestamp)
                    await userInterface.closeDB()
                    resolve(result)
                    break

                default: throw new Error('No cae matched in getDebtDetails')
            }
        } catch(error) {
            console.log('error in getDebtDetails: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}


function repayLoan(params) {
    return new Promise(async(resolve, reject) => {
        try {
            userInterface.setNetworkAndInstances()
            await userInterface.getEOAccounts()
            await userInterface.openDB()
            let debtor = (await userInterface.getBorrowerFromBorrowerRegistry(params)).data[0]
            let contractAddresses = (userInterface.getContractAddresses()).data[0]
            params.tokenAddress = contractAddresses.erc20TokenAddress
            let result = await userInterface.startRepayment(debtor, params.debtAgreement, params.amount, params.tokenAddress)
            await userInterface.closeDB()
            resolve(result)
        } catch(error) {
            console.log('error in repayLoan: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}



module.exports = {
    signUp,
    addCard,
    makeLoan,
    getDebtDetails,
    repayLoan,
    test
}
