pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed

import "../ERC20/BCToken.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Holder.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../Debt/DebtRegistry.sol";
import "../Debt/DebtToken.sol";
import "../LoanData.sol";
import "../EscrowRegistry.sol";

/**
 * @author Balaji Pachai
 * @title Escrow
 * @dev Base escrow contract, holds funds destined to a payee until they
 * withdraw them. The contract that uses the escrow as its payment method
 * should be its owner, and provide public methods redirecting to the escrow's
 * deposit and withdraw.
 */
contract Escrow is Ownable, ERC721Holder, LoanData {
    using SafeMath for uint256;
    address public ERC20_TOKEN; //solhint-disable-line variable-mixed-case
    uint256 public DEPOSIT_AMOUNT; //solhint-disable-line variable-mixed-case

    uint public constant FRACTIONAL_SCALING_FACTOR_MULTIPLIER = 10 ** 6;
    bool public isPartPaymentInvoked = false;

    DebtRegistry public debtRegistry;
    DebtToken public debtToken;
    EscrowRegistry public escrowRegistry;

    // Given that Solidity does not support floating points, we encode
    // interest rates as percentages scaled up by a factor of 10,000
    // As such, interest rates can, at a maximum, have 4 decimal places
    // of precision.
    // 1% = 10,000
    uint public constant FRACTIONAL_RATE_SCALING_FACTOR = 10 ** 4;

    uint16 constant public EXTERNAL_QUERY_GAS_LIMIT = 8000;

    modifier onlyEscrowRegistry() {
        require(
            msg.sender == address(escrowRegistry),
                "in Escrow:onlyEscrowRegistry(). msg.sender is not EscrowRegistry"
        );
        _;
    }

    /// @dev Constructor function that initializes the Escrow contract
    /// @param _bcTokenAddress ERC20 Token contract address
    /// @param _debtToken DebtToken contract address
    /// @param _debtRegistry DebtRegistry contract address
    /// @param _escrowRegistryAddress EscrowRegistry contract address
    /// @param _fixDepositAmount Number of tokens that can be deposited in the Escrow
    constructor(
        address _bcTokenAddress,
        address _debtToken,
        address _debtRegistry,
        address _escrowRegistryAddress,
        uint256 _fixDepositAmount
    ) public {
        ERC20_TOKEN = _bcTokenAddress;
        debtToken = DebtToken(_debtToken);
        debtRegistry = DebtRegistry(_debtRegistry);
        escrowRegistry = EscrowRegistry(_escrowRegistryAddress);
        DEPOSIT_AMOUNT = _fixDepositAmount;
        setLenderState(CreditorStates.Deposit);
    }

    /// @dev Function that gets the scaling factor of the depositor
    /// @param depositor Address of the depositor
    /// @return Returns the scaling factor of the depositor
    function getScalingFactorsOf(address depositor) public view returns (uint256, uint256) {
        return scalingFactorsOf(depositor);
    }

    /// @dev Function that gets the deposits of the depositor
    /// @param depositor Address of the depositor
    /// @return Returns the number of depositor's deposited tokens
    function getDepositsOf(address depositor) public view returns (uint256) {
        return depositsOf(depositor);
    }

    /// @dev Function that gets the amount of tokens paid till now to the Escrow
    /// @return Returns the value paid till now to the Escrow
    function getValueRepaidTillNow() public view returns (uint256) {
        return getRepaidValue();
    }

    /// @dev Function that deposits the tokens into the Escrow
    /// @param amount Number of tokens to be deposited
    function deposit(
        uint256 amount
    ) public
    lenderState(CreditorStates.Deposit)
    {
        require(msg.sender != address(0), "in Escrow:deposit(). Payee cannot be address(0).");
        require(amount > 0, "in Escrow:deposit(). Amount to deposit cannot be 0 or less than 0.");
        bool addDepositsOrNot = addDepositors(msg.sender);
        uint256 contractBalance = getBalance(ERC20_TOKEN, address(this));
        uint256 amountThatCanBeDeposited = DEPOSIT_AMOUNT.sub(contractBalance);
        if (amount > amountThatCanBeDeposited) {
            amount = amountThatCanBeDeposited;
        }
        ERC20(ERC20_TOKEN).transferFrom(msg.sender, address(this), amount); //Pull in the tokens into this contract
        setDeposits(msg.sender, amount, addDepositsOrNot);
        //Checks if deposits have reached DEPOSIT_AMOUNT
        contractBalance = getBalance(ERC20_TOKEN, address(this));
        if (contractBalance == DEPOSIT_AMOUNT) {
            setLenderState(CreditorStates.MakeLoan);
        }
        emit Deposited(msg.sender, amount, block.timestamp, address(this));
    }

    /// @dev Function that checks whether the escrow can make loan & sets the lender attributes in the escrowRegistry
    function makeLoan()
    public
    onlyOwner
    lenderState(CreditorStates.MakeLoan){
        escrowRegistry.setLenderAttributes(address(this), DEPOSIT_AMOUNT);
    }

    /// @dev Withdraw accumulated balance for a group of depositors.
    /// @param loanAmount Loan that was given through the Escrow
    function withdraw(
        uint256 loanAmount
    )
    public
    {
        uint256 repaymentValue;
        uint256 contractBalance = getBalance(ERC20_TOKEN, address(this));
        address[] memory depositorsArray = getDepositors();
        CreditorStates currentState = getLenderState();
        //If the currentState is Withdraw then only calculate the interestScalingFactor else just invoke transferAll
        if(currentState == CreditorStates.Withdraw || isWithdrawalAllowed()) {
            uint256 interestScalingFactor;
            if (isPartPaymentInvoked) {
                //get all withdrawals sum it up with contractBalance
                repaymentValue = contractBalance.add(getAllWithdrawals(depositorsArray));
            } else {
                repaymentValue = contractBalance;
            }

            interestScalingFactor = getInterestScalingFactor(loanAmount, repaymentValue);
            transferAll(depositorsArray, contractBalance, interestScalingFactor);
        } else {
            isPartPaymentInvoked = true;
            repaymentValue = getRepaidValue();
            transferPartPayment(depositorsArray, repaymentValue, contractBalance);
        }
    }

    /// @dev Function that transfers the remaining deposited tokens
    ///      of the depositor after withdraw
    function getDepositedTokens() public {
        require(
            addDepositors(msg.sender) == true,
            "in Escrow: getDepositedTokens(), msg.sender is not in the list of depositors"
        );
        CreditorStates currentState = getLenderState();
        uint256 contractBalance = getBalance(ERC20_TOKEN, address(this));
        uint256 amountToTransfer = 0;
        if (currentState == CreditorStates.MakeLoan) {
            amountToTransfer = depositsOf(msg.sender);
            require(
                amountToTransfer > 0,
                    "in Escrow:getDepositedTokens(). All your tokens have been already withdrawn"
            );
            setDeposits(msg.sender, (depositsOf(msg.sender).sub(amountToTransfer)), false);
            require(
                contractBalance >= amountToTransfer,
                "in Escrow:getDepositedTokens(). Insufficient escrow contract balance."
            );
            ERC20(ERC20_TOKEN).transfer(msg.sender, amountToTransfer);
            emit Withdrawn(msg.sender, amountToTransfer, block.timestamp, address(this));
        } else if (currentState == CreditorStates.Closed) {
            uint256 myWithdrawals = getWithdrawalAmount(msg.sender);
            uint256 maxThatCanBeWithdrawn = getMaxWithdrawableAmount(msg.sender);
            uint256 myDeposits = depositsOf(msg.sender);
            amountToTransfer = maxThatCanBeWithdrawn.sub(myWithdrawals);
            require(
                amountToTransfer > 0,
                    "in Escrow:getDepositedTokens(). All your tokens have been already withdrawn"
            );
            updateWithdrawals(msg.sender, amountToTransfer);
            require(
                contractBalance >= amountToTransfer,
                    "in Escrow:getDepositedTokens(). Insufficient escrow contract balance."
            );
            if (amountToTransfer >= myDeposits) {
                setDeposits(msg.sender, 0, false);
            } else {
                setDeposits(msg.sender, myDeposits.sub(amountToTransfer), false);
            }
            ERC20(ERC20_TOKEN).transfer(msg.sender, amountToTransfer);
            emit Withdrawn(msg.sender, amountToTransfer, block.timestamp, address(this));
        }
    }

    /// @dev Function that gets the deposited tokens in case of collateral is seized
    /// @param collateralAmountPlusConBalance Locked collateral amount
    function getDepositedTokensSeizeCollateral(
        uint256 collateralAmountPlusConBalance
    )
    public
    lenderState(CreditorStates.PartPaymentCanWithdraw)
    onlyOwner
    {
        uint256 contractBalance = getBalance(ERC20_TOKEN, address(this));
        uint256 proportionOfDeposit;
        uint256 amountToTransfer = 0;
        address[] memory depositors = getDepositors();
        for (uint8 i = 0; i < depositors.length; i++ ) {
            proportionOfDeposit = getProportion(depositsOf(depositors[i]), DEPOSIT_AMOUNT);
            amountToTransfer = (
                proportionOfDeposit
                .mul(collateralAmountPlusConBalance)
                )
                .div(FRACTIONAL_RATE_SCALING_FACTOR
            );
            require(
                amountToTransfer > 0,
                    "in Escrow:getDepositedTokensSeizeCollateral(). All your tokens have been already withdrawn"
            );
            require(
                contractBalance >= amountToTransfer,
                    "in Escrow:getDepositedTokensSeizeCollateral(). Insufficient escrow contract balance."
            );
            ERC20(ERC20_TOKEN).transfer(depositors[i], amountToTransfer);
            emit Withdrawn(depositors[i], amountToTransfer, block.timestamp, address(this));
        }
        setLenderState(CreditorStates.Closed);

    }

    /// @dev Function that changes the state from WaitForRepayment to Withdraw
    /// @param whichState The Escrow contract's current state
    function changeState(bool whichState) onlyEscrowRegistry external {
        CreditorStates state = getLenderState();
        if(!(whichState) && (state != CreditorStates.Withdraw)) {
            //Check if state is already set in that case don't set the state again
            setLenderState(CreditorStates.Withdraw);
        } else if(state != CreditorStates.PartPaymentCanWithdraw && state == CreditorStates.WaitForRepayment) {
            setLenderState(CreditorStates.PartPaymentCanWithdraw);
        }
    }

    /// @dev Function that sets the CreditorStates to WaitForRepayment
    function setStateToWaitForRepayment() onlyEscrowRegistry external {
        //Check if state has already been set to WaitForRepayment then don't set it again
        if (getLenderState() != CreditorStates.WaitForRepayment) {
            setLenderState(CreditorStates.WaitForRepayment);
        }
    }

    /// @dev Function that sets scaling factors
    /// @param principalAmount The Principal amount of the loan that was made
    /// @param tenure Number of years of the loan
    /// @param rateOfInterest The rate of interest
    /// @param depositor The depositor's account address
    function setScalingFactors(
        uint256 principalAmount,
        uint256 tenure,
        uint256 rateOfInterest,
        address depositor
    )
    public
    onlyOwner
    {
        //It indicates repayment has been done
        if (getLenderState() == CreditorStates.WaitForRepayment) {
            rateOfInterest = rateOfInterest.mul(FRACTIONAL_RATE_SCALING_FACTOR);

            uint256 interest =
            principalAmount
            .mul(tenure)
            .mul(rateOfInterest)
            .div(FRACTIONAL_SCALING_FACTOR_MULTIPLIER);

            uint256 actualRepaymentValue = principalAmount.add(interest.div(FRACTIONAL_RATE_SCALING_FACTOR));

            uint256 theoreticalScalingFactor =
            (actualRepaymentValue.mul(FRACTIONAL_RATE_SCALING_FACTOR))
            .div(principalAmount);

            setScalingFactor(depositor, theoreticalScalingFactor, true); // true sets  theoreticalScalingFactor

            //Set the expectedRepaymentValue
            setExpectedRepaymentValue(actualRepaymentValue);
        }
    }

    /// @dev Function that calls the approve of ERC20
    /// @param _spender Spender account address
    /// @param _value Amount of tokens that can be spent
    /// @return Returns status of approve
    function approve(address _spender, uint256 _value) public returns (bool) {
        return ERC20(ERC20_TOKEN).approve(_spender, _value);
    }

    function allowWithdraw() public returns (bool) {
        return isWithdrawalAllowed();
    }

    /// @dev Function that calls the transfer of ERC20
    /// @param _to Account to which tokens should be transferred
    /// @param _value Amount of tokens that should be transferred
    /// @return Returns status of transfer
    function transfer(address _to, uint256 _value) public returns (bool) {
        return ERC20(ERC20_TOKEN).transfer(_to, _value);
    }

    /// @dev Function that checks whether lender can grant a loan
    function canGrantLoan() public view returns (bool) {
        return (getLenderState() == CreditorStates.MakeLoan || getLenderState() == CreditorStates.WaitForRepayment);
    }

    /// @dev Function that updates the repaymentValue
    /// @param _repaymentValue Amount of tokens repaid
    /// @param _shouldAdd Should the repaymentValue be added or subtracted flag
    function updateRepayment(uint256 _repaymentValue, bool _shouldAdd) public {
        updateRepaidValue(_repaymentValue, _shouldAdd);
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
        require(newDebtRegAddress != address(0), "in Escrow: updateDebtRegistry(). New address cannot be address(0)");
        require(
            newDebtRegAddress != oldDebtRegAddress,
                "in Escrow: updateDebtRegistry(). New address cannot be existing address."
        );
        debtRegistry = DebtRegistry(newDebtRegAddress);
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
            "in Escrow: updateEscrowRegistry(). New address cannot be address(0)"
        );
        require(
            newEscrowRegAddress != oldEscrowRegAddress,
                "in Escrow: updateEscrowRegistry. New address cannot be existing address."
        );
        escrowRegistry = EscrowRegistry(newEscrowRegAddress);
    }

    /// @dev Function that updates the TermsContract
    /// @param newTermsContractAddress Updated address of TermsContract
    function updateTermsContract(
        address newTermsContractAddress
    )
    public
    onlyOwner
    {
        //Just implements and does nothing
    }

    //////////////////////////////
    //// INTERNAL FUNCTIONS /////
    ////////////////////////////

    /// @dev Function that returns whether withdrawal is allowed or not?
    /// @return bool
    function isWithdrawalAllowed() internal returns (bool) {
        if (block.timestamp > getWhenToWithdrawTimestamp()) {
            return true;
        }
        return false;
    }

    /// @dev Function that transfers all the tokens back to the depositors
    /// @param depositors Array of depositor addresses
    /// @param contractBalance Balance of Escrow contract
    /// @param interestScalingFactor The factor through which the interest has been scaled
    function transferAll(
        address[] memory depositors,
        uint256 contractBalance,
        uint256 interestScalingFactor
    )
    internal
    {
        uint256 amountToTransfer = 0;
        uint256 proportionOfDeposit;
        uint256 myWithdrawals = 0;
        uint256 maxThatCanBeWithdrawn = 0;
        uint256 expectedRepaymentValue = getExpectedRepaymentValue();
        uint256 allDeposits = getAllDeposits(depositors);

        for (uint i = 0; i < depositors.length; i++) {
            require(depositors[i] != address(0), "in Escrow:transferAll(). Depositor cannot be address(0).");
            require(
                getDepositsOf(depositors[i]) != 0,
                    "in Escrow:transferAll(). Amount to be withdrawn is 0 or less than 0."
            );

            proportionOfDeposit = getProportion(getDepositsOf(depositors[i]), allDeposits);
            myWithdrawals = getWithdrawalAmount(depositors[i]); // 0
            maxThatCanBeWithdrawn = getMaxWithdrawableAmount(proportionOfDeposit, expectedRepaymentValue);
            amountToTransfer = (
            contractBalance
            .mul(proportionOfDeposit)
            .div(FRACTIONAL_RATE_SCALING_FACTOR)
            );
            setMaxWithdrawableAmount(depositors[i], amountToTransfer);
            if ((amountToTransfer.add(myWithdrawals)) > maxThatCanBeWithdrawn) {
                amountToTransfer = maxThatCanBeWithdrawn.sub(myWithdrawals);
            }

            require(amountToTransfer > 0, "in Escrow:transferAll(). All your tokens have been already withdrawn");

            updateWithdrawals(depositors[i], amountToTransfer);
            require(
                contractBalance >= amountToTransfer,
                    "in Escrow:transferAll(). Insufficient escrow contract balance."
            );
            //            setDeposits(depositors[i], (depositsOf(depositors[i]).sub(amountToTransfer)), false);
            //Set the actual scaling factor
            setScalingFactor(address(this), interestScalingFactor, false); // 0 is used to set actualScalingFactor
            //Transfer Tokens
            ERC20(ERC20_TOKEN).transfer(depositors[i], amountToTransfer);
            // Emit withdrawn event
            emit Withdrawn(depositors[i], amountToTransfer, block.timestamp, address(this));
        }
        // At the end of transferAll set the CreditorState = Closed
        setLenderState(CreditorStates.Closed);
    }

    /// @dev Function that transfers the part payments
    /// @param depositors Array of depositor addresses
    /// @param contractBalance Balance of Escrow contract
    /// @param partPaymentValue Repayment value after part payment
    function transferPartPayment(
        address[] memory depositors,
        uint256 partPaymentValue,
        uint256 contractBalance
    )
    internal
    {
        //Transfer the partPaymentValue equally among the depositors
        uint256 amountToTransfer = 0;
        uint256 proportionOfDeposit = 0;
        uint256 allDeposits = getAllDeposits(depositors);

        for (uint8 i = 0; i < depositors.length; i++) {
            require(depositors[i] != address(0), "in Escrow:transferPartPayment(). Depositor cannot be address(0).");
            proportionOfDeposit = getProportion(getDepositsOf(depositors[i]), allDeposits);
            amountToTransfer = (
                partPaymentValue
                .mul(proportionOfDeposit)
                .div(FRACTIONAL_RATE_SCALING_FACTOR)
            );
            require(
                amountToTransfer != 0,
                    "in Escrow:transferPartPayment(). Amount to be withdrawn is 0 or less than 0."
            );
            //Update withdrawals
            updateWithdrawals(depositors[i], amountToTransfer);
            //Update the repaidValue
            updateRepaidValue(amountToTransfer, false);
            require(
                contractBalance >= amountToTransfer,
                    "in Escrow:transferPartPayment(). Insufficient escrow contract balance."
            );
            //Transfer the partPaymentValue
            ERC20(ERC20_TOKEN).transfer(depositors[i], amountToTransfer);
            emit Withdrawn(depositors[i], amountToTransfer, block.timestamp, address(this));
        }
    }

    /// @dev Helper function for querying an address' balance on a given token.
    /// @param token ERC20 token contract address
    /// @param accountAddress Account address for which balance has to be queried
    /// @return Returns the balance of accountAddress
    function getBalance(
        address token,
        address accountAddress
    )
    internal
    returns (uint _balance)
    {
        // Limit gas to prevent reentrancy.
        return ERC20(token).balanceOf.gas(EXTERNAL_QUERY_GAS_LIMIT)(accountAddress);
    }

    /// @dev Function that gets the proportion as per the deposits of the depositors
    /// @param depositorDeposits Number of tokens deposited by the depositor
    /// @param totalDeposits Deposits of all the depositors
    /// @return Returns the proportion of the depositor as per their deposits w.r.t. the totalDeposits
    function getProportion(
        uint256 depositorDeposits,
        uint256 totalDeposits
    )
    internal
    pure
    returns (uint256 _proportion) {
        return (
        depositorDeposits
        .mul(FRACTIONAL_RATE_SCALING_FACTOR)
        .div(totalDeposits)
        );
    }

    /// @dev Function that gets the maxWithdrawalAmount
    /// @param proportion The proportion of depositor as per their deposits w.r.t. the totalDeposits
    /// @param expectedRepaymentValue Expected repaymentValue
    /// @return Returns the max withdrawable amount of the depositor
    function getMaxWithdrawableAmount(
        uint256 proportion,
        uint256 expectedRepaymentValue
    )
    internal
    pure
    returns (uint256) {
        return (
        proportion
        .mul(expectedRepaymentValue)
        .div(FRACTIONAL_RATE_SCALING_FACTOR)
        );
    }

    /// @dev Function that gets the interest scaling factor
    /// @param loanAmount Amount given as loan
    /// @param repaymentValue Repayment value
    /// @return Returns the interest scaling factor
    function getInterestScalingFactor(
        uint256 loanAmount,
        uint256 repaymentValue
    )
    internal
    pure
    returns (uint256 _interestScalingFactor) {
        // Since we represent decimal interest rates using their
        // scaled-up, fixed point representation, we have to
        // downscale the result of the interest payment computation
        // by the multiplier scaling factor we choose for interest rates.
        return (
        repaymentValue
        .mul(FRACTIONAL_RATE_SCALING_FACTOR)
        .div(loanAmount)
        );
    }
}
