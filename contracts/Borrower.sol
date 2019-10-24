/*
Created by Balaji Pachai on 12/26/2018
Smart Contract that is used to get all the details of the Debt Agreement pertained to a Borrower
*/
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed

import "./Debt/DebtKernel.sol";
import "./Debt/DebtRegistry.sol";
import "./collaterize/SimpleInterestTermsContractCollateralized.sol";
import "./EscrowRegistry.sol";
import "./LoanData.sol";
//import "../../../LoanData.sol";

//TODO @balaji Add 1:1 correspondence (unique id) for identifying Borrower.sol of different users
contract Borrower is Ownable, LoanData {
    address public ERC20_TOKEN; //solhint-disable-line var-name-mixedcase
    DebtRegistry public debtRegistry;
    CollateralizedSimpleInterestTermsContract public termsContract;
    EscrowRegistry public escrowRegistry;
    RepaymentRouter public repaymentRouter;

    uint public constant DAYS_IN_MONTH = 30;
    uint public constant FRACTIONAL_SCALING_FACTOR = 10 ** 4;
    uint public constant MONTHS_IN_YEAR = 12;
    uint public constant FRACTIONAL_SCALING_FACTOR_MULTIPLIER = 10 ** 6;

    // Set borrower limit, it has to be dynamic
    // Implement an interface wherein we check whether the borrower has crossed the borrowing limit?
    //Sets the debtRegistry and termsContract addresses
    constructor(
        address bcTokenAddress,
        address debtRegistryAddress,
        address termsContractAddress,
        address escrowRegistryAddress,
        address repaymentRouterAddress
    ) public {
        ERC20_TOKEN = bcTokenAddress;
        debtRegistry = DebtRegistry(debtRegistryAddress);
        termsContract = CollateralizedSimpleInterestTermsContract(termsContractAddress);
        escrowRegistry = EscrowRegistry(escrowRegistryAddress);
        repaymentRouter = RepaymentRouter(repaymentRouterAddress);
        setBorrowerState(BorrowerStates.NOK);
    }

    /// @dev Function that sets the borrow state
    function setBorrowState() public {
        setBorrowerState(BorrowerStates.OK);
    }

    /// @dev Function that checks whether borrower can borrow
    /// @return Returns whether the borrower can  borrow or not?
    function canBorrow() public view returns (bool) {
        BorrowerStates state = getBorrowerState();
        if (state == BorrowerStates.OK) {
            return true;
        }
        return false;
    }

    /// @dev Function that sets the loanAmount for the borrower
    /// @param _loanAmount The loan amount
    function setLoanAmountThroughBorrower(uint256 _loanAmount) public {
        setLoanAmount(address(this), _loanAmount);
    }

    /// @dev Function that gets the loanAmount
    /// @param _borrower Borrower contract address
    /// @return Returns the loan amount of the borrower
    function getLoanAmountThroughBorrower(address _borrower) public view returns (uint256) {
        return getLoanAmount(_borrower);
    }

    /// @dev Function that updates the debtRegistry address
    /// @param newDebtRegAddress Updated address of debtRegistry
    function updateDebtRegistry(
        address newDebtRegAddress
    )
    public
    onlyOwner
    {
        address oldDebtRegAddress = address(debtRegistry);
        require(newDebtRegAddress != address(0), "in Borrower: updateDebtRegistry(). New address cannot be address(0)");
        require(newDebtRegAddress != oldDebtRegAddress, "in Borrower: updateDebtRegistry(). New address cannot be existing address.");//solhint-disable-line max-line-length
        debtRegistry = DebtRegistry(newDebtRegAddress);
    }

    /// @dev Function that updates the TermsContract
    /// @param newTermsContractAddress Updated address of TermsContract
    function updateTermsContract(
        address newTermsContractAddress
    )
    public
    onlyOwner
    {
        address oldTermsContract = address(termsContract);
        require(newTermsContractAddress != address(0), "in Borrower: updateTermsContract(). New address cannot be address(0)");//solhint-disable-line max-line-length
        require(newTermsContractAddress != oldTermsContract, "in Borrower: updateTermsContract. New address cannot be existing address.");//solhint-disable-line max-line-length
        termsContract = CollateralizedSimpleInterestTermsContract(newTermsContractAddress);
    }

    /// @dev Function that updates the EscrowRegistry
    /// @param newEscrowRegAddress Updated address of EscrowRegistry
    function updateEscrowRegistry(
        address newEscrowRegAddress
    )
    public
    onlyOwner
    {
        address oldEscrowRegAddress = address(escrowRegistry);
        require(
            newEscrowRegAddress != address(0),
            "in Borrower: updateEscrowRegistry(). New address cannot be address(0)"
        );
        require(newEscrowRegAddress != oldEscrowRegAddress, "in Borrower: updateEscrowRegistry. New address cannot be existing address.");//solhint-disable-line max-line-length
        escrowRegistry = EscrowRegistry(newEscrowRegAddress);
    }


    /// @dev Function that calls the approve of ERC20
    /// @param _spender Spender account address
    /// @param _value Amount of tokens that can be spent
    /// @return Returns status of approve
    function approve(address _spender, uint256 _value) public returns (bool) {
        return ERC20(ERC20_TOKEN).approve(_spender, _value);
    }

    /// @dev Should call repay() of RepaymentRouter.sol s.t. the msg.sender becomes borrower
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains
    /// @param amount Repayment amount
    /// @param tokenAddress ERC20 token contract address
    /// @return Returns the amount repaid
    function repay(
        bytes32 agreementId,
        uint256 amount,
        address tokenAddress
    ) public
    returns (uint _amountRepaid)
    {
        uint amountRepaid = repaymentRouter.repay(agreementId, amount, tokenAddress);
        address beneficiary = getBeneficiary(agreementId);

        //Add the amountRepaid in Escrow's repaidValue
        //true indicates that amount has to be added in repaidValue
        escrowRegistry.updateRepaidValue(beneficiary, amount, true);

        //Get the actual expected repayment value
        uint termEndTimestamp = getTermEndTimestamp(agreementId);
        uint expectedRepaymentValue = getExpectedRepaymentValue(agreementId, termEndTimestamp);

        //Gets the amount paid till date
        uint amountPaidToDate = getValueRepaidToDate(agreementId);

        if (amountPaidToDate >= expectedRepaymentValue) {
            /*
            changeEscrowState's third parameter decides
            whether Withdraw state will be set or PartPaymentCanWithdraw state will be set
            false will set Withdraw
            true will set PartPaymentCanWithdraw
            */
            escrowRegistry.changeEscrowState(beneficiary, false);
        } else {
            escrowRegistry.changeEscrowState(beneficiary, true);
        }
        return amountRepaid;
    }

    /// @dev Function that gets the EMI details
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains
    /// @return Returns installmentAmount, noOfInstallments, monthlyInterest
    function getEmiDetails(
        bytes32 agreementId,
        uint256 noOfDays
    )
    public
    returns (uint, uint, uint)
    {

        uint256 principalAmount;
        uint256 interestRate;

        (principalAmount, interestRate) = getPrincipalAndInterestRate(agreementId);

        uint noOfInstallments = (noOfDays.div(DAYS_IN_MONTH)); //noOfDays should be in multiple of 30 pre-reqs

        uint interest =
                        principalAmount
                        .mul(noOfInstallments.mul(FRACTIONAL_SCALING_FACTOR).div(MONTHS_IN_YEAR))
                        .mul(interestRate)
                        .div(FRACTIONAL_SCALING_FACTOR_MULTIPLIER);

        uint monthlyInterest = (principalAmount.add(interest)).sub(principalAmount).div(noOfInstallments);
        uint installmentAmount = (principalAmount.add(interest)).div(noOfInstallments);

        return (installmentAmount, noOfInstallments, monthlyInterest);

    }

    ////////////////////////////////////////
    // Get Debt Details from DebtRegistry //
    ////////////////////////////////////////

    /// @dev Function that gets all the debt agreements of the borrower
    /// @return Returns all the debt agreements of the borrower
    function getMyDebts(
        address borrower
    )
    public
    view
    returns (bytes32[] memory)
    {
        return debtRegistry.getDebtorsDebts(borrower);
    }

    /// @dev Function that gets the total number of debts a borrower has
    /// @return Returns total number of debts a borrower has
    function getNoOfDebts(
        address borrower
    )
    public
    view
    returns (uint256)
    {
        bytes32[]  memory totalDebts = getMyDebts(borrower);
        return totalDebts.length;
    }

    /// @dev Function that gets debt details based on the debtAgreement
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return Returns debt details based on the debtAgreement
    function getDebtDetails(
        bytes32 agreementId
    )
    public
    view
    returns (address, address, address, uint, address, bytes32, uint)
    {
        return debtRegistry.get(agreementId);
    }

    /// @dev Function that returns the beneficiary of a given debt
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return Returns the beneficiary of a given debt
    function getBeneficiary(
        bytes32 agreementId
    )
    public
    view
    returns (address)
    {
        return debtRegistry.getBeneficiary(agreementId);
    }

    // @dev Function that returns the terms contract address of a given debt
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return Returns the terms contract address of a given debt
    function getTermsContract(bytes32 agreementId)
    public
    view
    returns (address)
    {
        return debtRegistry.getTermsContract(agreementId);
    }

    /// @dev Function that returns the terms contract parameters of a given debt
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return Returns the terms contract parameters of a given debt
    function getTermsContractParameters(bytes32 agreementId)
    public
    view
    returns (bytes32)
    {
        return debtRegistry.getTermsContractParameters(agreementId);
    }

    /// @dev Function that returns a tuple of the terms contract and its associated parameters for a given issuance
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return Returns a tuple of the terms contract and its associated parameters for a given issuance
    /// @return Returns a tuple of the terms contract and its associated parameters for a given issuance
    function getTerms(bytes32 agreementId)
    public
    view
    returns (address, bytes32)
    {
        return debtRegistry.getTerms(agreementId);
    }

    /// @dev Returns the timestamp of the block at which a debt agreement was issued.
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return Returns the issuance block timestamp
    function getIssuanceBlockTimestamp(bytes32 agreementId)
    public
    view
    returns (uint timestamp)
    {
        return debtRegistry.getIssuanceBlockTimestamp(agreementId);
    }

    ////////////////////////////////////////
    // Get Debt Details from TermsContract //
    ////////////////////////////////////////

    /// @dev Returns the cumulative units-of-value expected to be repaid given a block's timestamp.
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @param  timestamp uint. The timestamp for which repayment expectation is being queried.
    /// @return uint256 The cumulative units-of-value expected to be repaid given a block's timestamp.
    function getExpectedRepaymentValue(
        bytes32 agreementId,
        uint256 timestamp
    )
    public
    returns (uint _expectedRepaymentValue)
    {
        return termsContract.getExpectedRepaymentValue(agreementId, timestamp);
    }

    /// @dev Returns the cumulative units-of-value repaid to date.
    /// @param agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return uint256 The cumulative units-of-value repaid by the specified block timestamp.
    function getValueRepaidToDate(bytes32 agreementId)
    public
    view
    returns (uint _valueRepaid)
    {
        return termsContract.getValueRepaidToDate(agreementId);
    }

    /// @dev Function that returns the term end timestamp
    /// @param _agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return Returns the term end timestamp
    function getTermEndTimestamp(
        bytes32 _agreementId
    ) public returns (uint)
    {
        return termsContract.getTermEndTimestamp(_agreementId);
    }


    /// @dev Function that gets the principalAmount and interestRate
    /// @param agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return Returns principal amount and the interest rate
    function getPrincipalAndInterestRate(
        bytes32 agreementId
    )
    internal
    view
    returns (uint, uint) {
        uint principalTokenIndex;
        uint principalAmount;
        uint interestRate;
        uint amortizationUnitType;
        uint termLengthInAmortizationUnits;

        (principalTokenIndex, principalAmount, interestRate, amortizationUnitType, termLengthInAmortizationUnits) =
            CollateralizedSimpleInterestTermsContract(termsContract)
            .unpackParametersFromBytes(getTermsContractParameters(agreementId));
        return (principalAmount, interestRate);
    }
}
