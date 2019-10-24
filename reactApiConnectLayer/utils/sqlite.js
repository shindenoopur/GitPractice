/**
 * @author Balaji Pachai
 * This file contains utility to CREATE, READ, UPDATE & DELETE from sqlite database
 * */

const sqlite3 = require('sqlite3').verbose();
let dbObject

//persistentDB = './reactApiConnectLayer/SQLiteDB/sqlite.db'
/**
 * Function that opens database connection
 * */
function openDBConnection() {
    return new Promise((resolve, reject) => {
        dbObject = new sqlite3.Database('./reactApiConnectLayer/SQLiteDB/sqlite.db', (err) => {
            if (err) {
                reject({
                    status: 'failure',
                    message: err.message,
                    data: []
                })
            } else {
                resolve({
                    status: 'success',
                    message: 'Connection successful',
                    data: []
                })
            }
        })
    })
}

/**
 * Function that closes the database connection
 * */
function closeDBConnection() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            dbObject.close((err) => {
                if (err) {
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    resolve({
                        status: 'success',
                        message: 'Closed database connection',
                        data: []
                    })
                }
            })
        }, 5000)
    })
}


/**
 * Function that creates all tables in sqlite database
 * */
function createAll() {
    return new Promise((resolve, reject) => {
        try {
            dbObject.serialize(async function() {
                await createTable(
                    'CREATE TABLE IF NOT EXISTS event_block(id INTEGER PRIMARY KEY AUTOINCREMENT, invoked_by VARCHAR(25) NOT NULL, block_hash VARCHAR(70) NOT NULL, block_number INT NOT NULL, event VARCHAR(25) NOT NULL, log_index INT NOT NULL, transaction_hash VARCHAR(70) NOT NULL, transaction_index INT NOT NULL)'
                )

                await createTable(
                    'CREATE TABLE IF NOT EXISTS agreements(id INTEGER PRIMARY KEY AUTOINCREMENT, agreement_id VARCHAR(70), lender address VARCHAR(25), borrower address VARCHAR(25), date_created INT, block_hash VARCHAR(70), log_index INT NOT NULL)')

                await createTable(
                    'CREATE TABLE IF NOT EXISTS debt_order (id INTEGER PRIMARY KEY AUTOINCREMENT, principal_amount INT NOT NULL, principal_token VARCHAR(25) NOT NULL, underwriter VARCHAR(25) NOT NULL, underwriter_fee INT NOT NULL, relayer VARCHAR(25) NOT NULL, relayer_fee INT NOT NULL,agreement_id VARCHAR(70) NOT NULL, block_hash VARCHAR(70) NOT NULL, log_index INT NOT NULL)'
                )

                await createTable(
                    'CREATE TABLE IF NOT EXISTS debt_terms (id INTEGER PRIMARY KEY AUTOINCREMENT, principal_token VARCHAR(25) NOT NULL,  principal_amount INT NOT NULL, interest_rate NUMERIC NOT NULL, amortization_unit_type INT NOT NULL, term_length_in_amortization_units INT NOT NULL, agreement_id VARCHAR(70) NOT NULL, block_hash VARCHAR(70) NOT NULL, log_index INT NOT NULL)'
                )

                await createTable(
                    'CREATE TABLE IF NOT EXISTS repayment_details (id INTEGER PRIMARY KEY AUTOINCREMENT, payer VARCHAR(25) NOT NULL, beneficiary VARCHAR(25) NOT NULL, repaid_value INT NOT NULL, token_address VARCHAR(25) NOT NULL,agreement_id VARCHAR(70) NOT NULL, block_hash VARCHAR(70) NOT NULL, log_index INT NOT NULL, repayment_date INT NOT NULL)'
                )

                await createTable(
                    'CREATE TABLE IF NOT EXISTS deposit_details (id INTEGER PRIMARY KEY AUTOINCREMENT, depositor VARCHAR(25) NOT NULL, amount INT NOT NULL, date INT NOT NULL, escrow_contract VARCHAR(25) NOT NULL, block_hash VARCHAR(70) NOT NULL, log_index INT NOT NULL)'
                )

                await createTable(
                    'CREATE TABLE IF NOT EXISTS withdrawal_details (id INTEGER PRIMARY KEY AUTOINCREMENT, withdrawer VARCHAR(25) NOT NULL, amount INT NOT NULL, date INT NOT NULL, escrow_contract VARCHAR(25) NOT NULL, block_hash VARCHAR(70) NOT NULL, log_index INT NOT NULL)'
                )

                await createTable(
                    'CREATE TABLE IF NOT EXISTS collateral_details (id INTEGER PRIMARY KEY AUTOINCREMENT, agreement_id VARCHAR(70) NOT NULL, guarantor VARCHAR(25) NOT NULL, beneficiary VARCHAR(25) NOT NULL, token VARCHAR(25) NOT NULL, amount INT NOT NULL, date INT NOT NULL, log_index INT NOT NULL)'
                )

                await createTable(
                    'CREATE TABLE IF NOT EXISTS user_details (id INTEGER PRIMARY KEY AUTOINCREMENT, stringified_user_details TEXT NOT NULL, email VARCHAR(50) UNIQUE NOT NULL)'
                )
                resolve({
                    status: 'success',
                    message: 'All tables created successfully',
                    data: []
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

/**
 * Function that inserts into the table
 * */
function insert(tableDetails) {
    return new Promise((resolve, reject) => {
        dbObject.run(getInsertStatement(tableDetails), tableDetails.params, (err) => {
            if (err) {
                reject({
                    status: 'failure',
                    message: err.message,
                    data: []
                })
            } else {
                resolve({
                    status: 'success',
                    message: 'Row inserted successfully in ' + tableDetails.event,
                    data: []
                })
            }
        })
    })
}

/**
 * Function that updates the table
 * */
function update(tableDetails) {
    return new Promise((resolve, reject) => {
            dbObject.run(getUpdateStatement(tableDetails), tableDetails.queryParams, (err) => {
                if (err) {
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    resolve({
                        status: 'success',
                        message: 'Updated row successfully of ' + tableDetails.tableName,
                        data: []
                    })
                }
            })
    })
}

/**
 * Function that selects from the table
 * */
function select(tableName) {
    return new Promise((resolve, reject) => {
        dbObject.all("SELECT * FROM " + tableName , function(err) {
            if(err){
                reject({
                    status: 'failure',
                    message: err.message,
                    data: []
                })
            } else {
                resolve({
                    status: 'success',
                    message: 'Select query results from '+ tableName + ' are: ',
                    data: []
                })

            }
        });
    })
}

/**
 * Function that selects from the table
 * */
function selectAsPerQuery(query) {
    return new Promise((resolve, reject) => {
        dbObject.all(query.statement , query.params, function(err, row) {
            if(err){
                reject({
                    status: 'failure',
                    message: err.message,
                    data: []
                })
            } else {
                resolve({
                    status: 'success',
                    message: 'Selected as per query results are: ',
                    data: row
                })
            }
        });
    })
}

/**
 * Function that drops all the tables
 * */
function remove(tableName) {
    return new Promise((resolve, reject) => {
        dbObject.run("DROP TABLE " + tableName, (err) => {
            if (err) {
                reject({
                    status: 'failure',
                    message: err.message,
                    data: []
                })
            } else {
                resolve({
                    status: 'success',
                    message: 'Dropped table ' + tableName,
                    data: []
                })
            }
        })
    })
}


/*
* Function that returns the update statement
* */
function getUpdateStatement(tableDetails) {
    let updateStatement = ''
    switch(tableDetails.tableName) {
        case 'agreements':
            updateStatement = ''
            break

        case 'debt_order':
            updateStatement = ''
            break

        case 'debt_terms':
            updateStatement = ''
            break

        case 'repayment_details':
            updateStatement = ''
            break

        case 'deposit_details':
            updateStatement = ''
            break

        case 'withdrawal_details':
            updateStatement = ''
            break

        default: throw new Error('No Case matched in getUpdateStatement')
    }
    return updateStatement
}


/*
* Function that returns the insert statement
* */
function getInsertStatement(tableDetails) {
    switch(tableDetails.event) {
        case 'EventBlock':
            return 'INSERT INTO event_block(invoked_by, block_hash, block_number, event, log_index, transaction_hash, transaction_index) VALUES (?, ?, ?, ?, ?, ?, ?)'

        case 'Agreement':
            return 'INSERT INTO agreements(agreement_id, lender, borrower, date_created, block_hash, log_index) VALUES (?, ?, ?, ?, ?, ?)'

        case 'LogDebtOrderFilled':
            return 'INSERT INTO debt_order (principal_amount, principal_token, underwriter , underwriter_fee , relayer , relayer_fee, agreement_id, block_hash, log_index) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)'

        case 'LogSimpleInterestTermStart':
            return 'INSERT INTO debt_terms (principal_token ,  principal_amount , interest_rate , amortization_unit_type , term_length_in_amortization_units, agreement_id, block_hash, log_index) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?)'

        case 'LogRegisterRepayment':
            return 'INSERT INTO repayment_details (payer , beneficiary , repaid_value , token_address, agreement_id, block_hash, log_index, repayment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'

        case 'Deposited':
            return 'INSERT INTO deposit_details (depositor, amount, date, escrow_contract, block_hash, log_index) VALUES (?, ?, ?, ?, ?, ?)'

        case 'Withdrawn':
            return 'INSERT INTO withdrawal_details (withdrawer, amount , date, escrow_contract, block_hash, log_index) VALUES (?, ?, ?, ?, ?, ?)'

        case 'CollateralLocked':
            return getCollateralInsertStatement()

        case 'CollateralReturned':
            return getCollateralInsertStatement()

        case 'CollateralSeized':
            return getCollateralInsertStatement()

        case 'UserDetails':
            return 'INSERT INTO user_details (stringified_user_details, email) VALUES (?, ?)'

        default: throw new Error('No Case matched in getInsertStatement')
    }
}

function getCollateralInsertStatement() {
    return 'INSERT INTO collateral_details (agreement_id, guarantor, beneficiary, token, amount, date, log_index) VALUES (?, ?, ?, ?, ?, ?, ?)'
}

/**
 * sqlite3 create table
 * */
function createTable(createStatement) {
    return new Promise((resolve, reject) => {
        dbObject.run(createStatement, (err) => {
            if(err) {
                reject({
                    status: 'failure',
                    message: err.message,
                    data: []
                })
            } else {
                resolve({
                    status: 'success',
                    message: 'Table created successfully',
                    data: [createStatement]
                })
            }
        })
    })
}

/**
 * Test Function to test all the insert & select of sqlite
 * */
async function invokeTestFunctions() {
    let ro = await openDBConnection()
    // prettyJson.prettyPrint([ro])
    console.log("0", ro)

    //First Create all tables
    let r1 = await createAll()
    console.log("1", r1)

    let r2 = await insert({
        event: 'EventBlock',
        params: [
            '0x111111111111111111111111111111111111111',
            '0x3333333333333333333333333333333333333333',
            1,
            'Deposited',
            0,
            '0x123456789321654987',
            0
        ]
    })
    console.log("2",r2)

    let r3 = await insert ({
        event: 'Deposited',
        params: [
            '0xB6D6fb90edB24CDCd45d22f62baa5C12a962AfEA',
            1500,
            Math.floor(((Date.now() + (86400 * 30 * 1000)) / 1000)),
            '0x111111111111111111111111111111111111111',
            '0x3333333333333333333333333333333333333333',
            0
        ]
    })
    console.log("3",r3)

    let r4 = await insert({
        event: 'Agreement',
        _agreementId: '0xFe36C14742f3fF3CcBAb098B839d4c9B99922eFe',
        params: [
            '0xFe36C14742f3fF3CcBAb098B839d4c9B99922eFe',
            '0x111111111111111111111111111111111111111',
            '0x22222222222222222222222222222222222222',
            Math.floor(((Date.now() + (86400 * 30 * 1000)) / 1000)),
            '0x3333333333333333333333333333333333333333',
            0
        ]
    })
    console.log("4.0",r4)

    let r5 = await insert({
        event: 'EventBlock',
        params: [
            '0x111111111111111111111111111111111111111',
            '0x444444444444444444444444444444444444444',
            2,
            'LogDebtOrderFilled',
            0,
            '0x1234567893216549871',
            0
        ]
    })
    console.log("5",r5)

    let r6 = await insert ({
        event: 'LogDebtOrderFilled',
        params: [
            1500,
            '0xB6D6fb90edB24CDCd45d22f62baa5C12a962AfEA',
            '0x50a74Ce1Ac6d2C7316598F35B19d771B015e387c',
            500,
            '0xf048d78DD924Be8D4B26A77904d0cd7d84B136D4',
            1250,
            '0xFe36C14742f3fF3CcBAb098B839d4c9B99922eFe',
            '0x444444444444444444444444444444444444444',
            0
        ]
    })
    console.log("6",r6)

    let r7 = await insert({
        event: 'EventBlock',
        params: [
            '0x111111111111111111111111111111111111111',
            '0x444444444444444444444444444444444444445',
            3,
            'LogSimpleInterestTermStart',
            0,
            '0x12345678932165498712',
            0
        ]
    })
    console.log("7",r7)

    let r8 = await insert ({
        event: 'LogSimpleInterestTermStart',
        params: [
            '0xB6D6fb90edB24CDCd45d22f62baa5C12a962AfEA',
            1500,
            20,
            1,
            100,
            '0xFe36C14742f3fF3CcBAb098B839d4c9B99922eFe',
            '0x444444444444444444444444444444444444445',
            0
        ]
    })
    console.log("8",r8)

    let r9 = await insert({
        event: 'EventBlock',
        params: [
            '0x111111111111111111111111111111111111111',
            '0x444444444444444444444444444444444444446',
            4,
            'LogRegisterRepayment',
            0,
            '0x123456789321654987123',
            0
        ]
    })
    console.log("9",r9)

    let r10 = await insert ({
        event: 'LogRegisterRepayment',
        params: [
            '0x22222222222222222222222222222222222222',
            '0x111111111111111111111111111111111111111',
            1500,
            '0x50a74Ce1Ac6d2C7316598F35B19d771B015e387c',
            '0xFe36C14742f3fF3CcBAb098B839d4c9B99922eFe',
            '0x444444444444444444444444444444444444446',
            0,
            123456789
        ]
    })
    console.log("10",r10)

    let r11 = await insert({
        event: 'EventBlock',
        params: [
            '0x111111111111111111111111111111111111111',
            '0x444444444444444444444444444444444444447',
            5,
            'Withdrawn',
            0,
            '0x1234567893216549871234',
            0
        ]
    })





    console.log("11",r11)

    let r12= await insert ({
        event: 'Withdrawn',
        params: [
            '0xB6D6fb90edB24CDCd45d22f62baa5C12a962AfEA',
            1500,
            Math.floor(((Date.now() + (86400 * 30 * 1000)) / 1000)),
            '0x111111111111111111111111111111111111111',
            '0x444444444444444444444444444444444444447',
            0
        ]
    })
    console.log("12",r12)

    let s1 = await select('event_block')
    console.log("13",s1)
    let s2 = await select('agreements')
    console.log("14",s2)
    let s3 = await select('deposit_details')
    console.log("15",s3)
    let s4 = await select('debt_order')
    console.log("16",s4)
    let s5 = await select('debt_terms')
    console.log("17",s5)
    let s6 = await select('repayment_details')
    console.log("18",s6)
    let s7 = await select('withdrawal_details')
    console.log("19",s7)


    // s1 = await remove('event_block')
    // console.log("20",s1)
    // s2 = await remove('agreements')
    // console.log("21",s2)
    // s3 = await remove('debt_order')
    // console.log("22",s3)
    // s4 = await remove('debt_terms')
    // console.log("23",s4)
    // s5 = await remove('repayment_details')
    // console.log("24",s5)
    // s6 = await remove('deposit_details')
    // console.log("25",s6)
    // s7 = await remove('withdrawal_details')
    // console.log("26",s7)


    let r13 = await closeDBConnection()
    console.log("27",r13)
}

// invokeTestFunctions()

module.exports = {
    openDBConnection,
    createAll,
    insert,
    update,
    select,
    remove,
    selectAsPerQuery,
    closeDBConnection,
    invokeTestFunctions
}
