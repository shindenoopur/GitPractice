/**
 * @author Balaji Pachai
 * Date Created: 03/11/2019
 * File that contains functions to get the ledger details from the SQLite database
 * */

const SQLite = require('../../utils/sqlite')

/**
 * Function that gets all agreements
 * */
async function getAllAgreements() {
    return new Promise(async (resolve, reject) => {
        try {
            let query = {
                statement: 'SELECT a.id ID, a.agreement_id AgreementID, a.lender Lender, a.borrower Borrower, a.date_created DateCreated FROM agreements a',
                params: []
            }
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
 * Function that gets the amount deposited in the escrow contract
 * @param {JSON} args JSON that contains the required function arguments
 * @return Returns a Promise Object
 * */
async function getAmountDepositedInEscrow(args) {
    return new Promise(async (resolve, reject) => {
        try{
            let query = {
               statement: 'SELECT SUM(dd.amount) DepositedAmount FROM deposit_details dd WHERE dd.escrow_contract = ? COLLATE NOCASE',
                params: [
                    args.escrowAddress
                ]
            }
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
 * Function that gets the amount withdrawn from the escrow contract
 * @param {JSON} args JSON that contains the required function arguments
 * @return Returns a Promise Object
 * */
async function getAmountWithdrawnFromEscrow(args) {
    return new Promise(async (resolve, reject) => {
        try{
            let query = {
                statement: 'SELECT SUM(wd.amount) WithdrawalAmount FROM withdrawal_details wd WHERE wd.escrow_contract = ? COLLATE NOCASE',
                params: [
                    args.escrowAddress
                ]
            }
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
 * Function that gets the deposit details for a specific escrow contract
 * @param {JSON} args JSON that contains the required function arguments
 * @return Returns a Promise Object
 * */
async function getDepositDetailsForEscrow(args) {
    return new Promise(async (resolve, reject) => {
        try{
            let query = {
                statement: 'SELECT dd.depositor Depositor, dd.amount DepositedAmount, dd.date DepositedDate, eb.block_hash BlockHash, eb.block_number BlockNumber, eb.event Event, eb.log_index LogIndex, eb.transaction_index TransactionIndex, eb.transaction_hash TransactionHash FROM deposit_details dd, event_block eb WHERE dd.block_hash = eb.block_hash AND dd.escrow_contract = eb.invoked_by AND dd.escrow_contract = ? COLLATE NOCASE',
                params: [
                    args.escrowAddress
                ]
            }
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
 * Function that gets the withdrawal details from a specific escrow contract
 * @param {JSON} args JSON that contains the required function arguments
 * @return Returns a Promise Object
 * */
async function getWithdrawalDetailsOfEscrow(args) {
    return new Promise(async (resolve, reject) => {
        try{
            let query = {
                statement: 'SELECT DISTINCT wd.withdrawer Withdrawer, wd.amount WithdrawalAmount, wd.date WithdrawalDate, eb.block_hash BlockHash, eb.block_number BlockNumber, eb.event Event, eb.log_index LogIndex, eb.transaction_index TransactionIndex, eb.transaction_hash TransactionHash FROM withdrawal_details wd, event_block eb WHERE wd.block_hash = eb.block_hash AND wd.escrow_contract = eb.invoked_by AND wd.log_index = eb.log_index AND wd.escrow_contract = ? COLLATE NOCASE',
                params: [
                    args.escrowAddress
                ]
            }
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
 * Function that gets all loan details of all agreement ids
 * @return Returns a Promise Object
 * */
async function getAllLoanDetailsAllAgreementdIDs() {
    return new Promise(async (resolve, reject) => {
        try{
            let query = {
                statement: 'SELECT a.agreement_id AgreementID, a.lender Lender, a.borrower Borrower, a.date_created DateCreated, dt.principal_amount PrincipalAmount, dt.interest_rate InterestRate, do.principal_token PrincipalToken, do.underwriter Underwriter, do.underwriter_fee UnderwriterFee, do.relayer Relayer, do.relayer_fee RelayerFee FROM agreements a, debt_order do, debt_terms dt WHERE a.agreement_id = do.agreement_id AND a.agreement_id = dt.agreement_id',
                params: []
            }
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
 * Function that contains the loan details as per agreement id
 * @param {JSON} args JSON that contains the required function arguments
 * @return Returns a Promise Object
 * */
async function getLoanDetailsAsPerAgreementID(args) {
    return new Promise(async (resolve, reject) => {
        try{
            let query = {
                statement: 'SELECT a.agreement_id AgreementID, a.lender Lender, a.borrower Borrower, a.date_created DateCreated, dt.principal_amount PrincipalAmount, dt.interest_rate InterestRate, do.principal_token PrincipalToken, do.underwriter Underwriter, do.underwriter_fee UnderwriterFee, do.relayer Relayer, do.relayer_fee RelayerFee FROM agreements a, debt_order do, debt_terms dt WHERE a.agreement_id = do.agreement_id AND a.agreement_id = dt.agreement_id AND a.agreement_id = ? COLLATE NOCASE AND do.agreement_id = ? COLLATE NOCASE AND  dt.agreement_id = ? COLLATE NOCASE',
                params: [
                    args.agreementId,
                    args.agreementId,
                    args.agreementId
                ]
            }
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
 * Function that gets the ledger details
 * */
async function getLedgerDetailsByUnion(args) {
    return new Promise(async (resolve, reject) => {
        try {
            let unionAllQuery = {
                statement: getUnionAllQuery(),
                params: [
                    args.escrowAddress,
                    args.agreementId,
                    args.escrowAddress,
                    args.escrowAddress,
                    args.collateralizerAddress,
                    args.agreementId,
                    args.agreementId,
                    args.agreementId
                ]
            }
            resolve(await SQLite.selectAsPerQuery(unionAllQuery))
        } catch (error) {
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })

}

function getUnionAllQuery() {
    return 'SELECT\n' +
        '   a.agreement_id AgreementID, a.date_created DateCreated,\n' +
        '    dd.amount Amount, dd.date TransactionDate, \n' +
        '    eb.event Description, eb.block_number BlockNumber, \n' +
        '\teb.transaction_index TransactionIndex, eb.log_index LogIndex\n' +
        '    FROM\n' +
        '    agreements a, \n' +
        '    deposit_details dd,\n' +
        '    event_block eb\n' +
        '    WHERE\n' +
        '    a.lender = dd.escrow_contract\n' +
        '    AND\n' +
        '    dd.block_hash = eb.block_hash\n' +
        '    AND\n' +
        '    dd.log_index = eb.log_index\n' +
        '    AND\n' +
        '    a.lender = ? COLLATE NOCASE  \n' +
        '    \n' +
        '\t\n' +
        'UNION\n' +
        '\n' +
        'SELECT\n' +
        '   rd.agreement_id AgreementID, rd.repayment_date DateCreated, \n' +
        '    rd.repaid_value RepaidValue, rd.repayment_date DateCreated,\n' +
        '    eb.event Description, eb.block_number BlockNumber, \n' +
        '    eb.transaction_index TransactionIndex , eb.log_index\n' +
        '    FROM \n' +
        '    repayment_details rd,\n' +
        '    event_block eb\n' +
        '    WHERE \n' +
        '    rd.agreement_id = ? COLLATE NOCASE  \n' +
        '    AND\n' +
        '    beneficiary = ? COLLATE NOCASE  \n' +
        '    AND\n' +
        '    eb.block_hash = rd.block_hash\n' +
        '\t\n' +
        'UNION \n' +
        '\n' +
        'SELECT\n' +
        '    a.agreement_id AgreementID, a.date_created DateCreated,\n' +
        '    wd.amount WithdrawalAmount, wd.date WithdrawalDate,\n' +
        '    eb.event Description, eb.block_number BlockNumber,\n' +
        '    eb.transaction_index TransactionIndex , eb.log_index\n' +
        '    FROM\n' +
        '    agreements a,\n' +
        '    withdrawal_details wd,\n' +
        '    event_block eb\n' +
        '    WHERE\n' +
        '    a.lender = wd.escrow_contract\n' +
        '    AND\n' +
        '    wd.block_hash = eb.block_hash\n' +
        '    AND\n' +
        '    wd.log_index = eb.log_index\n' +
        '    AND\n' +
        '    a.lender = ? COLLATE NOCASE  \n' +
        '\t\n' +
        'UNION\n' +
        '\n' +
        'SELECT  \n' +
        '    a.agreement_id AgreementID, cd.date DateCreated,\n' +
        '    cd.amount CollateralAmount, cd.date DateCreated,  \n' +
        '    eb.event Description, eb.block_number BlockNumber, \n' +
        '\teb.transaction_index TransactionIndex , eb.log_index\n' +
        '    FROM  \n' +
        '    agreements a,  \n' +
        '    collateral_details cd,  \n' +
        '    event_block eb  \n' +
        '    WHERE  \n' +
        '    a.agreement_id = cd.agreement_id  \n' +
        '    AND  \n' +
        '    cd.log_index = eb.log_index  \n' +
        '    AND  \n' +
        '    eb.invoked_by = ? COLLATE NOCASE  \n' +
        '    AND  \n' +
        '    cd.agreement_id = ? COLLATE NOCASE\n' +
        ' UNION\n' +
        ' SELECT \n' +
        '    a.agreement_id AgreementID, a.date_created DateCreated, \n' +
        '    dt.principal_amount PrincipalAmount, a.date_created DateCreated,\n' +
        '    eb.event Description, eb.block_number BlockNumber, \n' +
        '    eb.transaction_index TransactionIndex, eb.log_index\n' +
        '    FROM \n' +
        '    agreements a,\n' +
        '    debt_terms dt,\n' +
        '    event_block eb\n' +
        '    WHERE \n' +
        '    a.agreement_id = dt.agreement_id \n' +
        '\tAND\n' +
        '\ta.block_hash = eb.block_hash\n' +
        '\tAND\n' +
        '\tdt.block_hash = eb.block_hash\n' +
        '\tAND\n' +
        '\ta.log_index = eb.log_index\n' +
        '    AND \n' +
        '    a.agreement_id = ? COLLATE NOCASE \n' +
        '    AND \n' +
        '    dt.agreement_id = ? COLLATE NOCASE\n' +
        'Order by dd.date, rd.repayment_date, wd.date, cd.date, a.date_created, eb.block_number, eb.transaction_index asc'
}

async function invokeTestFunctions() {
    await SQLite.invokeTestFunctions()

    await SQLite.openDBConnection()

    let r1 = await getAllAgreements()
    console.log("1 <==> \n", r1)

    let r2 = await getAmountDepositedInEscrow({
        escrowAddress: '0x111111111111111111111111111111111111111'
    })
    console.log("2 <==> \n", r2)

    let r3 = await getAmountWithdrawnFromEscrow({
        escrowAddress: '0x111111111111111111111111111111111111111'
    })
    console.log("3 <==> \n", r3)

    let r4 = await getDepositDetailsForEscrow({
        escrowAddress: '0x111111111111111111111111111111111111111'
    })
    console.log("4 <==> \n", r4)

    let r5 = await getWithdrawalDetailsOfEscrow({
        escrowAddress: '0x111111111111111111111111111111111111111'
    })
    console.log("5 <==> \n", r5)

    let r6 = await getLoanDetailsAsPerAgreementID({
        agreementId: '0xFe36C14742f3fF3CcBAb098B839d4c9B99922eFe'
    })
    console.log("6 <==> \n", r6)

    await SQLite.closeDBConnection()
}

// invokeTestFunctions()

module.exports = {
    getAllAgreements,
    getAllLoanDetailsAllAgreementdIDs,
    getAmountDepositedInEscrow,
    getAmountWithdrawnFromEscrow,
    getDepositDetailsForEscrow,
    getWithdrawalDetailsOfEscrow,
    getLoanDetailsAsPerAgreementID,
    getLedgerDetailsByUnion
}