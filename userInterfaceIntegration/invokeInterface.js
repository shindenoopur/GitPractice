const userInterface = require('./userInterface')
const apiFunctions = require('./apiFunctions')
let accounts, contractAddresses
let args, depositors, shuttingDownParams

function invokeInterface() {
    return new Promise(async (resolve, reject) => {
        try {
            await userInterface.bootStrapSystem()
            accounts = (await userInterface.getEOAccounts()).data[0]
            contractAddresses = (await userInterface.getContractAddresses()).data[0]
            //Using accounts & contractAddresses, the params for filling debt order will be created
            // Accounts available are: accounts.acc1 ... accounts.acc10
            // Contract Addresses are represented by contractAddresses.contractNameAddress
            // Eg: debtKernelAddress, debtTokenAddress etc
            //  args = userInterface.getDebtOrderParameters( {
            //     version: accounts.acc1,
            //     debtor: contractAddresses.borrowerAddress,
            //     underwriter: accounts.acc2,
            //     collateralizeTermsContractAddress: contractAddresses.collateralizeTermsContractAddress,
            //     escrowAddress: contractAddresses.escrowAddress,
            //     relayer: accounts.acc3,
            //     underwriterFee: 0,
            //     relayerFee: 0,
            //     creditorFee: 0,
            //     debtorFee: 0,
            //     underwriterRiskRating: 1000,
            //     salt: Date.now(),
            //     principalAmount: 500,
            //     interestRate: 10,
            //     amortizationUnit: 1,
            //     termLength: 100,
            //     collateralAmount: 500,
            //     gracePeriodInDays: 30,
            //     regulator: accounts.acc7,
            //     invokedBy: 'karmaDebt',
            //     noOfDays: 90
            // })

            // console.log('Debt order parameters are: ', args)

            let initialTransferTokens = 10000
            depositors = userInterface.getDepositors(accounts, initialTransferTokens)

            //Note: eachDepositorsDeposit < initialTransfer
            await userInterface.depositTokensInEscrow(depositors, initialTransferTokens, 2500)
            // await apiFunctions.test()

            // await userInterface.setBorrowingLimitForBorrower(args)
            //
            // await userInterface.fillDebtOrder(args)
            //
            // let debtRepaymentDetails = await userInterface.getDebtRepaymentDetails(args)
            // console.log('Debt repayment details are: ', debtRepaymentDetails)
            //
            // await userInterface.startRepayment(args.debtor, debtRepaymentDetails.data.myDebtAgreements[0], debtRepaymentDetails.data.expectedRepaymentValue[0], contractAddresses.erc20TokenAddress)
            //
            // await userInterface.withdrawTokens(depositors, args.principalAmount)
            //
            // await userInterface.getScalingFactors(args.escrowAddress)
            //
            // shuttingDownParams = {
            //     escrowAddress: contractAddresses.escrowAddress,
            //     borrowerAddress: contractAddresses.borrowerAddress,
            //     depositors: depositors,
            //     initialBalance: initialTransferTokens,
            //     collateralizerAddress: contractAddresses.collateralizeAddress,
            //     lenderInitialBalance: 0,
            //     borrowerInitialBalance: 2 * args.collateralAmount,
            //     debtStory: args.invokedBy
            // }
            //
            // setTimeout(async () => {
            //     await userInterface.shutdownSystem(shuttingDownParams)
            // }, 5000)

        } catch (error) {
            console.log('error in invokeInterface: ', error)
            reject(error.message)
        }
    })
}

invokeInterface()
