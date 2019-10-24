const leftPad = require('left-pad')
const getTermsContractParameters = function (...args) {
    //The order of args is very important
    let termsContractParameters
    let principalTokenIndex , principalAmount, interestRate, amortizationUnit , termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays

    //We are suppose to create 32 bytes of data for termsContractParameters
    /*
    * The byte distribution is as follows
    * The first byte of the parameters encodes the principal token's index in the token registry. (Represent principalTokenIndex in 1 byte)
    * The subsequent 12 bytes of the parameters encode the principal amount. (Represent principalAmount in 12 bytes)
    * The subsequent 3 bytes of the parameters encode the interest rate. (Represent interestRate in 3 bytes)
    * The subsequent 4 bits (half byte) encode the amortization unit type code. (Represent amortizationUnit in 1/2 byte i.e. 4 bits)
    * The subsequent 2 bytes encode the term length, as denominated in the encoded amortization unit. (Represent termLength in 2 bytes)
    *
    * Note that the remaining 108 bits are reserved for any parameters relevant to a collateralized terms contracts.
    * ************************Remaining 108 bits distribution is as follows***********************
    *  The first byte represents the collateral token index. (Represent collateralTokenIndex in 1 byte)
    *  The subsequent 92 bits represents the collateral amount, as denominated in the above token. (Represent collateralAmount in 92 bits)
    *  The last byte of the parameters represents the "grace period" of the loan, as defined in terms of days. (Represent gracePeriodInDays in 1 byte)
    *
    *  *************************256 bits distribution completed****************************
    * */
    if (args.length > 8){
        throw new Error('Arguments in getTermsContractParameters cannot be greater than 7')
    } else {
        principalTokenIndex = leftPad(args[0].toString(16), 2, 0)   // 2 hex digits can be represented by using 1 byte, thus padded with 2, 0
        principalAmount = leftPad(args[1].toString(16), 24, 0)      // 24 hex digits can be represented by using 12 bytes, thus padded with 24, 0
        interestRate = leftPad(args[2].toString(16), 6, 0)          // 6 hex digits can be represented by using 3 bytes, thus padded with 6, 0
        amortizationUnit = leftPad(args[3].toString(16), 1, 0)      // 1 hex digit can be represented by using 1/2 byte, thus padded with 1, 0
        termLength = leftPad(args[4].toString(16), 4, 0)            // 4 hex digits can be represented by using 2 bytes, thus padded with 2, 0
        collateralTokenIndex = leftPad(args[5].toString(16), 2, 0)  // 2 hex digits can be represented by using 1 byte, thus padded with 2, 0
        collateralAmount = leftPad(args[6].toString(16), 23, 0)     // 23 hex digits can be represented by using 22 and 1/2 bytes i.e. 92 bits, thus padded with 23, 0
        gracePeriodInDays = leftPad(args[7].toString(16), 2, 0)     // 2 hex digits can be represented by using 1 byte, thus padded with 2, 0

        termsContractParameters = '0x' + principalTokenIndex + principalAmount + interestRate + amortizationUnit + termLength + collateralTokenIndex + collateralAmount + gracePeriodInDays
        // console.log('TermsContractParameters: ', termsContractParameters)
    }
    return termsContractParameters
}

// getTermsContractParameters(1, 1000, 5, 3, 5, 2, 5200, 6)
// getTermsContractParameters(1, 1000, 5, 3, 5, 2, 5200, 6, 8) //this should throw an erro as there are 9 arguments
module.exports = {
    getTermsContractParameters
}