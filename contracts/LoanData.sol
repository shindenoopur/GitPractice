pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


/// @author Balaji Pachai
/// Contract LoanData stores all the data related to Borrower & Escrow contract
/// Idea behind creation of LoanData is separation of data & logic of Borrower & Escrow contract
contract LoanData {
    using SafeMath for uint;
    BorrowerStates internal borrowerState;
    CreditorStates internal creditorState;

    mapping(address => uint256) private deposits;
    mapping(address => ScalingFactors) private scalingFactors;
    mapping(address => uint256) private withdrawals;
    mapping(address => uint256) private loanAmount;
    mapping(address => uint256) private maxWithdrawableAmount;

    address[] private depositors;

    uint256 private repaidValue;
    uint256 private expectedRepaymentValue;
    uint256 private timestampFromWhenWithdrawalAllowed;

    enum CreditorStates { Deposit, MakeLoan, WaitForRepayment, PartPaymentCanWithdraw, Withdraw, Closed }
    enum BorrowerStates { OK, NOK }

    event Deposited(address indexed payee, uint256 tokenAmount, uint timestamp, address escrow);
    event Withdrawn(address indexed payee, uint256 tokenAmount, uint timestamp, address escrow);

    struct ScalingFactors {
        uint256 theoreticalScalingFactor;
        uint256 actualScalingFactor;
    }

    modifier debtorState(BorrowerStates _state) {
        require(borrowerState == _state, "in LoanData:debtorState(). Borrower state do not match");
        _;
    }

    modifier lenderState(CreditorStates _state) {
        require(
            creditorState == _state || creditorState == CreditorStates.PartPaymentCanWithdraw,
                "in LoanData:lenderState(). Loan states do not match");
        _;
    }

    /// @dev Function that sets the timestamp after which withdrawal is allowed
    /// @param _timestamp withdrawal timestamp
    function setWhenToWithdrawTimestamp(uint256 _timestamp) public {
        timestampFromWhenWithdrawalAllowed = _timestamp;
    }

    /// @dev Function that gets the timestamp after which withdrawal is allowed
    /// @return withdrawal timestamp
    function getWhenToWithdrawTimestamp() public view returns (uint256) {
        return timestampFromWhenWithdrawalAllowed;
    }

    /// @dev Function that sets the borrower state
    /// @param currentState BorrowerStates that has to be set
    function setBorrowerState(BorrowerStates currentState) public {
        borrowerState = currentState;
    }

    /// @dev Function that sets the creditor state
    /// @param currentState CreditorState that has to be set
    function setLenderState(CreditorStates currentState) public {
        creditorState = currentState;
    }

    /// @dev Function that gets the borrower state
    /// @return Returns the current state of borrower
    function getBorrowerState() public view returns (BorrowerStates) {
        return borrowerState;
    }

    /// @dev Function that gets the creditor state
    /// @return Returns the current state of creditor
    function getLenderState() public view returns (CreditorStates) {
        return creditorState;
    }

    /// @dev Borrower Functions
    function updateDebtRegistry(address newDebtRegAddress) public;
    function updateTermsContract(address newTermsContractAddress) public;
    function updateEscrowRegistry( address newEscrowRegAddress) public;

    /*Escrow Functions*/

    /// @dev Function that sets the scaling factors
    /// @param depositor Address of the depositor
    /// @param scalingFactor It will be either theoreticalScalingFactor or actualScalingFactor
    /// @param whichScalingFactor It determines whether to set theoreticalScalingFactor or actualScalingFactor?
    function setScalingFactor(address depositor, uint scalingFactor, bool whichScalingFactor) public {
        if (!whichScalingFactor) {
            scalingFactors[depositor].actualScalingFactor = scalingFactor;
        } else {
            scalingFactors[depositor].theoreticalScalingFactor = scalingFactor;
        }
    }

    /// @dev Function that sets the depositor's deposits
    /// @param depositor Address of the depositor
    /// @param _amount Amount by which the deposits has to be updated
    /// @param addDepositsOrNot Should the _amount be added or subtracted to/from deposits?
    function setDeposits(address depositor, uint256 _amount, bool addDepositsOrNot) public {
        if (addDepositsOrNot) {
            deposits[depositor] = deposits[depositor].add(_amount);
        } else {
            deposits[depositor] = _amount;
        }
    }

    /// @dev Function that gets the scaling factors of the depositor
    /// @param depositor Address of the depositor
    /// @return Returns the scaling factors of the depositor
    function scalingFactorsOf(address depositor) public view returns (uint256, uint256) {
        return (scalingFactors[depositor].theoreticalScalingFactor, scalingFactors[depositor].actualScalingFactor);
    }

    /// @dev Function that gets the depositor's deposits
    /// @param depositor Address of the depositor
    /// @return Returns the depositor's deposits
    function depositsOf(address depositor) public view returns (uint256) {
        return deposits[depositor];
    }

    /// @dev Function that gets all deposited tokens
    /// @param depositorsArray Array containing depositors addresses
    /// @return Returns all deposits by depositors into the escrow
    function getAllDeposits(address[] memory depositorsArray) public view returns (uint256) {
        uint256 allDeposits = 0;
        address depositor;
        for (uint i = 0; i < depositorsArray.length; i++) {
            depositor = depositorsArray[i];
            require(depositor != address(0), "in LoanData:getAllDeposits(). Depositor cannot be address(0).");
            allDeposits = allDeposits.add(deposits[depositor]);
        }
        return allDeposits;
    }

    /// @dev Function that updates the repaidValue
    /// @param _value Amount by which the repaidValue has to be updated
    /// @param _shouldAdd Should the _value be added or subtracted to/from repaidValue?
    function updateRepaidValue(uint256 _value, bool _shouldAdd) public {
        if (_shouldAdd) {
            repaidValue = repaidValue.add(_value);
        } else {
            repaidValue = repaidValue.sub(_value);
        }

    }

    /// @dev Function that returns the repaidValue
    /// @return Returns the repaid value to the escrow contract
    function getRepaidValue() public view returns (uint256) {
        return repaidValue;
    }

    /// @dev Function that updates the withdrawals
    /// @param withdrawee address of the Withdrawer
    /// @param withdrawalAmount The amount to be withdrawn
    function updateWithdrawals(address withdrawee, uint256 withdrawalAmount) public {
        uint256 previousWithdrawalAmount = withdrawals[withdrawee];
        uint256 currentWithdrawalAmount = previousWithdrawalAmount.add(withdrawalAmount);
        withdrawals[withdrawee] = currentWithdrawalAmount;
    }

    /// @dev Function to get the withdrawal amount
    /// @param withdrawee address of the Withdrawer
    /// @return Returns the withdrawal of the withdrawee
    function getWithdrawalAmount(address withdrawee) public view returns (uint256) {
        return withdrawals[withdrawee];
    }

    /// @dev Function that gets all the withdrawals of all the withdrawees
    /// @param withdrawees Array of addresses containing Withdrawer's account address
    /// @return Returns the total withdrawals
    function getAllWithdrawals(address[] memory withdrawees) public view returns (uint256) {
        uint256 allWithdrawals = 0;
        address withdrawee;
        for (uint i = 0; i < withdrawees.length; i++) {
            withdrawee = withdrawees[i];
            require(withdrawee != address(0), "in LoanData:getAllWithdrawals(). Withdrawee cannot be address(0).");
            allWithdrawals = allWithdrawals.add(withdrawals[withdrawee]);
        }
        return allWithdrawals;
    }

    /// @dev Function that sets the loanAmount of the borrower
    /// @param _borrower borrower account/contract address
    /// @param _amount Amount that has to be set as the loan amount
    function setLoanAmount(address _borrower, uint256 _amount) public {
        loanAmount[_borrower] = _amount;
    }

    /// @dev Function that gets the loanAmount of the borrower
    /// @param _borrower borrower account/contract address
    /// @return Returns the loan amount
    function getLoanAmount(address _borrower) public view returns (uint256) {
        return loanAmount[_borrower];
    }

    /// @dev Function that gets the depositors array
    /// @return Returns an array of addresses containing depositors addresses
    function getDepositors() public view returns (address[] memory) {
        return depositors;
    }

    /// @dev Function that adds the depositors into the depositors array
    /// @param depositor Address of the depositor
    /// @return Returns status of whether depositor exists or not?
    function addDepositors(address depositor) public returns (bool) {
        //Check whether depositor exists or not
        if (deposits[depositor] > 0) {
            return true;
        }
        depositors.push(depositor);
        return false;
    }

    /// @dev Function that sets the expectedRepaymentValue
    /// @param _value Amount to be set as expected repayment value
    function setExpectedRepaymentValue(uint256 _value) public {
        expectedRepaymentValue = _value;
    }

    /// @dev Function that gets the expectedRepaymentValue
    /// @return Returns the expected repayment value
    function getExpectedRepaymentValue() public view returns (uint256) {
        return expectedRepaymentValue;
    }

    /// @dev Function that sets the maxWithdrawableAmount
    /// @param _value Amount to be set as max withdrawable amount
    /// @param _depositor Address of the depositor for whom max withdrawable amount has to be set
    function setMaxWithdrawableAmount(address _depositor, uint256 _value) public {
        maxWithdrawableAmount[_depositor] = _value;
    }

    /// @dev Function that gets the maxWithdrawableAmount
    /// @param _depositor Address of the depositor for whom max withdrawable amount has to be fetched
    /// @return Returns the max withdrawable amount
    function getMaxWithdrawableAmount(address _depositor) public view returns (uint256) {
        return maxWithdrawableAmount[_depositor];
    }
}
