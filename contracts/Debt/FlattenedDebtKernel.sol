// File: contracts/openZeppelinDebug/contracts/ownership/Ownable.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
    address public owner;


    event Test(string text);
    event OwnershipRenounced(address indexed previousOwner);
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );


    /**
     * @dev The Ownable constructor sets the original `owner` of the contract to the sender
     * account.
     */
    constructor() public {
        owner = msg.sender;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        emit Test('3 from onlyOwner');
        require(msg.sender == owner, "in Ownable:onlyOwner(). Account is not owner.");
        _;
    }

    /**
     * @dev Allows the current owner to relinquish control of the contract.
     * @notice Renouncing to ownership will leave the contract without an owner.
     * It will not be possible to call the functions with the `onlyOwner`
     * modifier anymore.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipRenounced(owner);
        owner = address(0);
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param _newOwner The address to transfer ownership to.
     */
    function transferOwnership(address _newOwner) public onlyOwner {
        _transferOwnership(_newOwner);
    }

    /**
     * @dev Transfers control of the contract to a newOwner.
     * @param _newOwner The address to transfer ownership to.
     */
    function _transferOwnership(address _newOwner) internal {
        require(_newOwner != address(0), "in Ownable:_transferOwnership(). New owner address cannot be address(0)");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}

// File: contracts/openZeppelinDebug/contracts/lifecycle/Pausable.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title Pausable
 * @dev Base contract which allows children to implement an emergency stop mechanism.
 */
contract Pausable is Ownable {
    event Pause();
    event Unpause();
    event Test(string text);

    bool public paused = false;


    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     */
    modifier whenNotPaused() {
        emit Test('1 from whenNotPaused');
        require(!paused, "in Pausable:whenNotPaused(). Paused value is true.");
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     */
    modifier whenPaused() {
        emit Test('2 from whenPaused');
        require(paused, "in Pausable:whenPaused(). Paused value is false.");
        _;
    }

    /**
     * @dev called by the owner to pause, triggers stopped state
     */
    function pause() public onlyOwner whenNotPaused {
        paused = true;
        emit Pause();
    }

    /**
     * @dev called by the owner to unpause, returns to normal state
     */
    function unpause() public onlyOwner whenPaused {
        paused = false;
        emit Unpause();
    }
}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract RepaymentRouter is Pausable {
    DebtRegistry public debtRegistry;
    TokenTransferProxy public tokenTransferProxy;

    enum Errors {
        DEBT_AGREEMENT_NONEXISTENT,
        PAYER_BALANCE_OR_ALLOWANCE_INSUFFICIENT,
        REPAYMENT_REJECTED_BY_TERMS_CONTRACT
    }

    event LogRepayment(
        bytes32 indexed _agreementId,
        address indexed _payer,
        address indexed _beneficiary,
        uint _amount,
        address _token,
        uint _timestamp
    );

    event LogError(uint8 indexed _errorId, bytes32 indexed _agreementId);
    /**
     * Constructor points the repayment router at the deployed registry contract.
     */
    constructor (address _debtRegistry, address _tokenTransferProxy) public {
        debtRegistry = DebtRegistry(_debtRegistry);
        tokenTransferProxy = TokenTransferProxy(_tokenTransferProxy);
    }

    //TODO @balaji reminder below function is added to test registerRepayment() of SimpleInterestTermsContract.sol
    function invokeRegisterRepayment(bytes32 agreementId, address payer, address beneficiary, uint amount, address erc20TokenAddress, address termsContract) public returns (bool) {//solhint-disable-line max-line-length
        return TermsContract(termsContract).registerRepayment(agreementId, payer, beneficiary, amount, erc20TokenAddress);//solhint-disable-line max-line-length
    }

    /**
     * Given an agreement id, routes a repayment
     * of a given ERC20 token to the debt's current beneficiary, and reports the repayment
     * to the debt's associated terms contract.
     */
    function repay(
        bytes32 agreementId,
        uint256 amount,
        address tokenAddress
    )
    public
    whenNotPaused
    returns (uint _amountRepaid)
    {
        require(tokenAddress != address(0), "in RepaymentRouter:repay(). Token address is address(0).");
        require(amount > 0, "in RepaymentRouter:repay(). Amount to repay is <= 0.");

        // Ensure agreement exists.
        if (!debtRegistry.doesEntryExist(agreementId)) {
            emit LogError(uint8(Errors.DEBT_AGREEMENT_NONEXISTENT), agreementId);
            return 0;
        }

        // Check payer has sufficient balance and has granted router sufficient allowance.
        if (ERC20(tokenAddress).balanceOf(msg.sender) < amount || ERC20(tokenAddress).allowance(msg.sender, address(tokenTransferProxy)) < amount) { //solhint-disable-line max-line-length
            emit LogError(uint8(Errors.PAYER_BALANCE_OR_ALLOWANCE_INSUFFICIENT), agreementId);
            return 0;
        }

        // Notify terms contract
        address termsContract = debtRegistry.getTermsContract(agreementId);
        address beneficiary = debtRegistry.getBeneficiary(agreementId);
        if (!TermsContract(termsContract).registerRepayment(
            agreementId,
            msg.sender,
            beneficiary,
            amount,
            tokenAddress
        )) {
            emit LogError(uint8(Errors.REPAYMENT_REJECTED_BY_TERMS_CONTRACT), agreementId);
            return 0;
        }

        // Transfer amount to creditor
        require(tokenTransferProxy.transferFrom(
                tokenAddress,
                msg.sender,
                beneficiary,
                amount
            ), "in RepaymentRouter:repay(). Token transfer from failed");

        // Log event for repayment
        emit LogRepayment(agreementId, msg.sender, beneficiary, amount, tokenAddress, block.timestamp);

        return amount;
    }
}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract ContractRegistry is Ownable {

    event ContractAddressUpdated(
        ContractType indexed contractType,
        address indexed oldAddress,
        address indexed newAddress
    );

    enum ContractType {
        Collateralizer,
        DebtKernel,
        DebtRegistry,
        DebtToken,
        RepaymentRouter,
        TokenRegistry,
        TokenTransferProxy
    }

    Collateralizer public collateralizer;
    DebtKernel public debtKernel;
    DebtRegistry public  debtRegistry;
    DebtToken public debtToken;
    RepaymentRouter public repaymentRouter;
    TokenRegistry public tokenRegistry;
    TokenTransferProxy public tokenTransferProxy;

    constructor (
        address _collateralizer,
        address _debtKernel,
        address _debtRegistry,
        address _debtToken,
        address _repaymentRouter,
        address _tokenRegistry,
        address _tokenTransferProxy
    )
    public
    { //solhint-disable-line bracket-align
        collateralizer = Collateralizer(_collateralizer);
        debtKernel = DebtKernel(_debtKernel);
        debtRegistry = DebtRegistry(_debtRegistry);
        debtToken = DebtToken(_debtToken);
        repaymentRouter = RepaymentRouter(_repaymentRouter);
        tokenRegistry = TokenRegistry(_tokenRegistry);
        tokenTransferProxy = TokenTransferProxy(_tokenTransferProxy);
    }

    function updateAddress(
        ContractType contractType,
        address newAddress
    )
    public
    onlyOwner
    {
        address oldAddress;

        if (contractType == ContractType.Collateralizer) {
            oldAddress = address(collateralizer);
            validateNewAddress(newAddress, oldAddress);
            collateralizer = Collateralizer(newAddress);
        } else if (contractType == ContractType.DebtKernel) {
            oldAddress = address(debtKernel);
            validateNewAddress(newAddress, oldAddress);
            debtKernel = DebtKernel(newAddress);
        } else if (contractType == ContractType.DebtRegistry) {
            oldAddress = address(debtRegistry);
            validateNewAddress(newAddress, oldAddress);
            debtRegistry = DebtRegistry(newAddress);
        } else if (contractType == ContractType.DebtToken) {
            oldAddress = address(debtToken);
            validateNewAddress(newAddress, oldAddress);
            debtToken = DebtToken(newAddress);
        } else if (contractType == ContractType.RepaymentRouter) {
            oldAddress = address(repaymentRouter);
            validateNewAddress(newAddress, oldAddress);
            repaymentRouter = RepaymentRouter(newAddress);
        } else if (contractType == ContractType.TokenRegistry) {
            oldAddress = address(tokenRegistry);
            validateNewAddress(newAddress, oldAddress);
            tokenRegistry = TokenRegistry(newAddress);
        } else if (contractType == ContractType.TokenTransferProxy) {
            oldAddress = address(tokenTransferProxy);
            validateNewAddress(newAddress, oldAddress);
            tokenTransferProxy = TokenTransferProxy(newAddress);
        } else {
            revert();
        }

        emit ContractAddressUpdated(contractType, oldAddress, newAddress);
    }

    function validateNewAddress(
        address newAddress,
        address oldAddress
    )
    internal
    pure
    {
        require(newAddress != address(0), "in ContractRegistry: validateNewAddress(). New address cannot be null address");//solhint-disable-line max-line-length
        require(newAddress != oldAddress, "in ContractRegistry: validateNewAddress(). New address cannot be existing address.");//solhint-disable-line max-line-length
    }
}


// File: contracts/TokenRepayment/TermsContract.sol
pragma solidity ^0.5.0;  //solhint-disable-line compiler-fixed
interface TermsContract {
    /// When called, the registerTermStart function registers the fact that
    ///    the debt agreement has begun.  This method is called as a hook by the
    ///    DebtKernel when a debt order associated with `agreementId` is filled.
    ///    Method is not required to make any sort of internal state change
    ///    upon the debt agreement's start, but MUST return `true` in order to
    ///    acknowledge receipt of the transaction.  If, for any reason, the
    ///    debt agreement stored at `agreementId` is incompatible with this contract,
    ///    MUST return `false`, which will cause the pertinent order fill to fail.
    ///    If this method is called for a debt agreement whose term has already begun,
    ///    must THROW.  Similarly, if this method is called by any contract other
    ///    than the current DebtKernel, must THROW.
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @param  debtor address. The debtor in this particular issuance.
    /// @return _success bool. Acknowledgment of whether
    function registerTermStart(
        bytes32 agreementId,
        address debtor
    ) external returns (bool _success);

    /// When called, the registerRepayment function records the debtor's
    ///  repayment, as well as any auxiliary metadata needed by the contract
    ///  to determine ex post facto the value repaid (e.g. current USD
    ///  exchange rate)
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @param  payer address. The address of the payer.
    /// @param  beneficiary address. The address of the payment's beneficiary.
    /// @param  unitsOfRepayment uint. The units-of-value repaid in the transaction.
    /// @param  tokenAddress address. The address of the token with which the repayment transaction was executed.
    function registerRepayment(
        bytes32 agreementId,
        address payer,
        address beneficiary,
        uint256 unitsOfRepayment,
        address tokenAddress
    ) external returns (bool _success);

    /// Returns the cumulative units-of-value expected to be repaid by a given block timestamp.
    ///  Note this is not a constant function -- this value can vary on basis of any number of
    ///  conditions (e.g. interest rates can be renegotiated if repayments are delinquent).
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @param  timestamp uint. The timestamp of the block for which repayment expectation is being queried.
    /// @return uint256 The cumulative units-of-value expected to be repaid by the time the given timestamp lapses.
    function getExpectedRepaymentValue(
        bytes32 agreementId,
        uint256 timestamp
    ) external returns (uint256);

    /// Returns the cumulative units-of-value repaid by the point at which this method is called.
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return uint256 The cumulative units-of-value repaid up until now.
    function getValueRepaidToDate(
        bytes32 agreementId
    ) external view returns (uint256);

    /**
     * A method that returns a Unix timestamp representing the end of the debt agreement's term.
     * contract.
     */
    function getTermEndTimestamp(
        bytes32 _agreementId
    ) external returns (uint);
}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract SimpleInterestTermsContract is TermsContract {
    using SafeMath for uint;

    enum AmortizationUnitType { HOURS, DAYS, WEEKS, MONTHS, YEARS }
    uint public constant NUM_AMORTIZATION_UNIT_TYPES = 5;

    struct SimpleInterestParams {
        address principalTokenAddress;
        uint principalAmount;
        uint termStartUnixTimestamp;
        uint termEndUnixTimestamp;
        AmortizationUnitType amortizationUnitType;
        uint termLengthInAmortizationUnits;

        // Given that Solidity does not support floating points, we encode
        // interest rates as percentages scaled up by a factor of 10,000
        // As such, interest rates can, at a maximum, have 4 decimal places
        // of precision.
        uint interestRate;
    }

    uint public constant HOUR_LENGTH_IN_SECONDS = 60 * 60;
    uint public constant DAY_LENGTH_IN_SECONDS = HOUR_LENGTH_IN_SECONDS * 24;
    uint public constant WEEK_LENGTH_IN_SECONDS = DAY_LENGTH_IN_SECONDS * 7;
    uint public constant MONTH_LENGTH_IN_SECONDS = DAY_LENGTH_IN_SECONDS * 30;
    uint public constant YEAR_LENGTH_IN_SECONDS = DAY_LENGTH_IN_SECONDS * 365;

    // To convert an encoded interest rate into its equivalent in percents,
    // divide it by INTEREST_RATE_SCALING_FACTOR_PERCENT -- e.g.
    //     10,000 => 1% interest rate
    uint public constant INTEREST_RATE_SCALING_FACTOR_PERCENT = 10 ** 4;
    // To convert an encoded interest rate into its equivalent multiplier
    // (for purposes of calculating total interest), divide it by INTEREST_RATE_SCALING_FACTOR_PERCENT -- e.g.
    //     10,000 => 0.01 interest multiplier
    uint public constant INTEREST_RATE_SCALING_FACTOR_MULTIPLIER = INTEREST_RATE_SCALING_FACTOR_PERCENT * 100;

    mapping (bytes32 => uint) public valueRepaid;

    ContractRegistry public contractRegistry;

    event LogSimpleInterestTermStart(
        bytes32 indexed agreementId,
        address indexed principalToken,
        uint principalAmount,
        uint interestRate,
        uint indexed amortizationUnitType,
        uint termLengthInAmortizationUnits
    );

    event LogRegisterRepayment(
        bytes32 agreementId,
        address payer,
        address beneficiary,
        uint256 unitsOfRepayment,
        address tokenAddress,
        uint timestamp
    );

    modifier onlyRouter() {
        require(msg.sender == address(contractRegistry.repaymentRouter()), "in onlyRouter() modifier. msg.sender is not RepaymentRouter address");// solhint-disable-line max-line-length
        _;
    }

    modifier onlyMappedToThisContract(bytes32 agreementId) {
        require(address(this) == contractRegistry.debtRegistry().getTermsContract(agreementId), "in onlyMappedToThisContract() modifier. TermsContract is different");// solhint-disable-line max-line-length
        _;
    }

    modifier onlyDebtKernel() {
        require(msg.sender == address(contractRegistry.debtKernel()), "in onlyDebtKernel() modifier. msg.sender is not DebtKernel address");// solhint-disable-line max-line-length
        _;
    }

    constructor (
        address _contractRegistry
    )
    public
    { //solhint-disable-line bracket-align

        contractRegistry = ContractRegistry(_contractRegistry);
    }

    /// When called, the registerTermStart function registers the fact that
    ///    the debt agreement has begun.  Given that the SimpleInterestTermsContract
    ///    doesn't rely on taking any sorts of actions when the loan term begins,
    ///    we simply validate DebtKernel is the transaction sender, and return
    ///    `true` if the debt agreement is associated with this terms contract.
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @param  debtor address. The debtor in this particular issuance.
    /// @return _success bool. Acknowledgment of whether
    function registerTermStart(
        bytes32 agreementId,
        address debtor
    )
    public
    onlyDebtKernel
    returns (bool _success)
    {
        address termsContract;
        bytes32 termsContractParameters;

        (termsContract, termsContractParameters) = contractRegistry.debtRegistry().getTerms(agreementId);

        uint principalTokenIndex;
        uint principalAmount;
        uint interestRate;
        uint amortizationUnitType;
        uint termLengthInAmortizationUnits;

        (principalTokenIndex, principalAmount, interestRate, amortizationUnitType, termLengthInAmortizationUnits) =
        unpackParametersFromBytes(termsContractParameters);

        address principalTokenAddress =
        contractRegistry.tokenRegistry().getTokenAddressByIndex(principalTokenIndex);

        // Returns true (i.e. valid) if the specified principal token is valid,
        // the specified amortization unit type is valid, and the terms contract
        // associated with the agreement is this one.  We need not check
        // if any of the other simple interest parameters are valid, because
        // it is impossible to encode invalid values for them.
        if (principalTokenAddress != address(0) &&
        amortizationUnitType < NUM_AMORTIZATION_UNIT_TYPES &&
        termsContract == address(this)) {
            emit LogSimpleInterestTermStart(
                agreementId,
                principalTokenAddress,
                principalAmount,
                interestRate,
                amortizationUnitType,
                termLengthInAmortizationUnits
            );

            return true;
        }

        return false;
    }

    /// When called, the registerRepayment function records the debtor's
    ///  repayment, as well as any auxiliary metadata needed by the contract
    ///  to determine ex post facto the value repaid (e.g. current USD
    ///  exchange rate)
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @param  payer address. The address of the payer.
    /// @param  beneficiary address. The address of the payment's beneficiary.
    /// @param  unitsOfRepayment uint. The units-of-value repaid in the transaction.
    /// @param  tokenAddress address. The address of the token with which the repayment transaction was executed.
    function registerRepayment(
        bytes32 agreementId,
        address payer,
        address beneficiary,
        uint256 unitsOfRepayment,
        address tokenAddress
    )
    public
    onlyRouter
    returns (bool _success)
    {
        SimpleInterestParams memory params = unpackParamsForAgreementID(agreementId);

        if (tokenAddress == params.principalTokenAddress) {
            valueRepaid[agreementId] = valueRepaid[agreementId].add(unitsOfRepayment);

            emit LogRegisterRepayment(
                agreementId,
                payer,
                beneficiary,
                unitsOfRepayment,
                tokenAddress,
                block.timestamp
            );

            return true;
        }

        return false;
    }

    /// Returns the cumulative units-of-value expected to be repaid given a block's timestamp.
    ///  Note this is not a constant function -- this value can vary on basis of any number of
    ///  conditions (e.g. interest rates can be renegotiated if repayments are delinquent).
    /// @param  agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @param  timestamp uint. The timestamp for which repayment expectation is being queried.
    /// @return uint256 The cumulative units-of-value expected to be repaid given a block's timestamp.
    function getExpectedRepaymentValue(
        bytes32 agreementId,
        uint256 timestamp
    )
    public
    onlyMappedToThisContract(agreementId)
    returns (uint _expectedRepaymentValue)
    {
        SimpleInterestParams memory params = unpackParamsForAgreementID(agreementId);
        uint principalPlusInterest = calculateTotalPrincipalPlusInterest(params);

        if (timestamp <= params.termStartUnixTimestamp) {
            /* The query occurs before the contract was even initialized so the
            expected value of repayments is 0. */
            return 0;
        } else if (timestamp >= params.termEndUnixTimestamp) {
            /* the query occurs beyond the contract's term, so the expected
            value of repayment is the full principal plus interest. */
            return principalPlusInterest;
        } else {
            uint numUnits = numAmortizationUnitsForTimestamp(timestamp, params);
            return principalPlusInterest.mul(numUnits).div(params.termLengthInAmortizationUnits);
        }
    }

    /// Returns the cumulative units-of-value repaid to date.
    /// @param agreementId bytes32. The agreement id (issuance hash) of the debt agreement to which this pertains.
    /// @return uint256 The cumulative units-of-value repaid by the specified block timestamp.
    function getValueRepaidToDate(bytes32 agreementId)
    public
    view
    returns (uint _valueRepaid)
    {
        return valueRepaid[agreementId];
    }

    function unpackParametersFromBytes(bytes32 parameters)
    public
    pure
    returns (
        uint _principalTokenIndex,
        uint _principalAmount,
        uint _interestRate,
        uint _amortizationUnitType,
        uint _termLengthInAmortizationUnits
    )
    {
        // The first byte of the parameters encodes the principal token's index in the
        // token registry.
        bytes32 principalTokenIndexShifted =
        parameters & 0xff00000000000000000000000000000000000000000000000000000000000000;
        // The subsequent 12 bytes of the parameters encode the principal amount.
        bytes32 principalAmountShifted =
        parameters & 0x00ffffffffffffffffffffffff00000000000000000000000000000000000000;
        // The subsequent 3 bytes of the parameters encode the interest rate.
        bytes32 interestRateShifted =
        parameters & 0x00000000000000000000000000ffffff00000000000000000000000000000000;
        // The subsequent 4 bits (half byte) encode the amortization unit type code.
        bytes32 amortizationUnitTypeShifted =
        parameters & 0x00000000000000000000000000000000f0000000000000000000000000000000;
        // The subsequent 2 bytes encode the term length, as denominated in
        // the encoded amortization unit.
        bytes32 termLengthInAmortizationUnitsShifted =
        parameters & 0x000000000000000000000000000000000ffff000000000000000000000000000;

        // Note that the remaining 108 bits are reserved for any parameters relevant to a
        // collateralized terms contracts.

        /*
        We then bit shift left each of these values so that the 32-byte uint
        counterpart correctly represents the value that was originally packed
        into the 32 byte string.

        The below chart summarizes where in the 32 byte string each value
        terminates -- which indicates the extent to which each value must be bit
        shifted left.

                                        Location (bytes)	Location (bits)
                                        32                  256
        principalTokenIndex	            31	                248
        principalAmount	                19                  152
        interestRate                    16                  128
        amortizationUnitType            15.5                124
        termLengthInAmortizationUnits   13.5                108
        */
        return (
        bitShiftRight(principalTokenIndexShifted, 248),
        bitShiftRight(principalAmountShifted, 152),
        bitShiftRight(interestRateShifted, 128),
        bitShiftRight(amortizationUnitTypeShifted, 124),
        bitShiftRight(termLengthInAmortizationUnitsShifted, 108)
        );
    }

    function getTermEndTimestamp(
        bytes32 _agreementId
    ) public returns (uint)
    {
        SimpleInterestParams memory params = unpackParamsForAgreementID(_agreementId);

        return params.termEndUnixTimestamp;
    }

    function bitShiftRight(bytes32 value, uint amount)
    internal
    pure
    returns (uint)
    {
        return uint(value) / 2 ** amount;
    }

    function numAmortizationUnitsForTimestamp(
        uint timestamp,
        SimpleInterestParams memory params
    )
    internal
    returns (uint units)
    {
        uint delta = timestamp.sub(params.termStartUnixTimestamp);
        uint amortizationUnitLengthInSeconds = getAmortizationUnitLengthInSeconds(params.amortizationUnitType);
        return delta.div(amortizationUnitLengthInSeconds);
    }

    /**
     * Calculates the total repayment value expected at the end of the loan's term.
     *
     * This computation assumes that interest is paid per amortization period.
     *
     * @param params SimpleInterestParams. The parameters that define the simple interest loan.
     * @return uint The total repayment value expected at the end of the loan's term.
     */
    function calculateTotalPrincipalPlusInterest(
        SimpleInterestParams memory params
    )
    internal
    returns (uint _principalPlusInterest)
    {
        // Since we represent decimal interest rates using their
        // scaled-up, fixed point representation, we have to
        // downscale the result of the interest payment computation
        // by the multiplier scaling factor we choose for interest rates.
        uint totalInterest = params.principalAmount
        .mul(params.interestRate)
        .div(INTEREST_RATE_SCALING_FACTOR_MULTIPLIER);

        return params.principalAmount.add(totalInterest);
    }

    function unpackParamsForAgreementID(
        bytes32 agreementId
    )
    internal
    returns (SimpleInterestParams memory params)
    {
        bytes32 parameters = contractRegistry.debtRegistry().getTermsContractParameters(agreementId);

        // Index of the token used for principal payments in the Token Registry
        uint principalTokenIndex;
        // The principal amount denominated in the aforementioned token.
        uint principalAmount;
        // The interest rate accrued per amortization unit.
        uint interestRate;
        // The amortization unit in which the repayments installments schedule is defined.
        uint rawAmortizationUnitType;
        // The debt's entire term's length, denominated in the aforementioned amortization units
        uint termLengthInAmortizationUnits;

        (principalTokenIndex, principalAmount, interestRate, rawAmortizationUnitType, termLengthInAmortizationUnits) =
        unpackParametersFromBytes(parameters);

        address principalTokenAddress =
        contractRegistry.tokenRegistry().getTokenAddressByIndex(principalTokenIndex);

        // Ensure that the encoded principal token address is valid
        require(principalTokenAddress != address(0), "in SimpleInterestTermsContract: unpackParamsForAgreementID(). Principal token address is address(0)");// solhint-disable-line max-line-length

        // Before we cast to `AmortizationUnitType`, ensure that the raw value being stored is valid.
        require(rawAmortizationUnitType <= uint(AmortizationUnitType.YEARS), "in SimpleInterestTermsContract: unpackParamsForAgreementID(). Raw value stored is invalid.");// solhint-disable-line max-line-length

        AmortizationUnitType amortizationUnitType = AmortizationUnitType(rawAmortizationUnitType);

        uint amortizationUnitLengthInSeconds =
        getAmortizationUnitLengthInSeconds(amortizationUnitType);
        uint issuanceBlockTimestamp =
        contractRegistry.debtRegistry().getIssuanceBlockTimestamp(agreementId);
        uint termLengthInSeconds =
        termLengthInAmortizationUnits.mul(amortizationUnitLengthInSeconds);
        uint termEndUnixTimestamp =
        termLengthInSeconds.add(issuanceBlockTimestamp);
        return SimpleInterestParams({
            principalTokenAddress: principalTokenAddress,
            principalAmount: principalAmount,
            interestRate: interestRate,
            termStartUnixTimestamp: issuanceBlockTimestamp,
            termEndUnixTimestamp: termEndUnixTimestamp,
            amortizationUnitType: amortizationUnitType,
            termLengthInAmortizationUnits: termLengthInAmortizationUnits
        });
    }

    function getAmortizationUnitLengthInSeconds(AmortizationUnitType amortizationUnitType)
    internal
    pure
    returns (uint _amortizationUnitLengthInSeconds)
    {
        if (amortizationUnitType == AmortizationUnitType.HOURS) {
            return HOUR_LENGTH_IN_SECONDS;
        } else if (amortizationUnitType == AmortizationUnitType.DAYS) {
            return DAY_LENGTH_IN_SECONDS;
        } else if (amortizationUnitType == AmortizationUnitType.WEEKS) {
            return WEEK_LENGTH_IN_SECONDS;
        } else if (amortizationUnitType == AmortizationUnitType.MONTHS) {
            return MONTH_LENGTH_IN_SECONDS;
        } else if (amortizationUnitType == AmortizationUnitType.YEARS) {
            return YEAR_LENGTH_IN_SECONDS;
        } else {
            revert();
        }
    }
}

/**
 *  Note(kayvon): these events are emitted by our PermissionsLib, but all contracts that
 *  depend on the library must also define the events in order for web3 clients to pick them up.
 *  This topic is discussed in greater detail here (under the section "Events and Libraries"):
 *  https://blog.aragon.one/library-driven-development-in-solidity-2bebcaf88736
 */
contract PermissionEvents {
    event Authorized(address indexed agent, string callingContext);
    event AuthorizationRevoked(address indexed agent, string callingContext);
}

library PermissionsLib {

    // TODO(kayvon): remove these events and inherit from PermissionEvents when libraries are
    // capable of inheritance.
    // See relevant github issue here: https://github.com/ethereum/solidity/issues/891
    event Authorized(address indexed agent, string callingContext);
    event AuthorizationRevoked(address indexed agent, string callingContext);

    struct Permissions {
        mapping(address => bool) authorized;
        mapping(address => uint) agentToIndex; // ensures O(1) look-up
        address[] authorizedAgents;
    }

    function authorize(
        Permissions storage self,
        address agent,
        string memory callingContext
    )
    internal
    {
        require(isNotAuthorized(self, agent), "PermissionsLib:authorize(). Agent is already authorized");

        self.authorized[agent] = true;
        self.authorizedAgents.push(agent);
        self.agentToIndex[agent] = self.authorizedAgents.length - 1;
        emit Authorized(agent, callingContext);
    }

    function revokeAuthorization(
        Permissions storage self,
        address agent,
        string memory callingContext
    )
    internal
    {
        /* We only want to do work in the case where the agent whose
        authorization is being revoked had authorization permissions in the
        first place. */
        require(isAuthorized(self, agent), "in PermissionsLib:revokeAuthorization(). Agent is not authorized.");

        uint indexOfAgentToRevoke = self.agentToIndex[agent];
        uint indexOfAgentToMove = self.authorizedAgents.length - 1;
        address agentToMove = self.authorizedAgents[indexOfAgentToMove];

        // Revoke the agent's authorization.
        delete self.authorized[agent];

        // Remove the agent from our collection of authorized agents.
        self.authorizedAgents[indexOfAgentToRevoke] = agentToMove;

        // Update our indices to reflect the above changes.
        self.agentToIndex[agentToMove] = indexOfAgentToRevoke;
        delete self.agentToIndex[agent];

        // Clean up memory that's no longer being used.
        delete self.authorizedAgents[indexOfAgentToMove];
        self.authorizedAgents.length -= 1;

        emit AuthorizationRevoked(agent, callingContext);
    }

    function isAuthorized(Permissions storage self, address agent)
    internal
    view
    returns (bool)
    {
        return self.authorized[agent];
    }

    function isNotAuthorized(Permissions storage self, address agent)
    internal
    view
    returns (bool)
    {
        return !isAuthorized(self, agent);
    }

    function getAuthorizedAgents(Permissions storage self)
    internal
    view
    returns (address[] memory)
    {
        return self.authorizedAgents;
    }
}

// File: contracts/openZeppelinDebug/contracts/math/SafeMath.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

    /**
    * @dev Multiplies two numbers, throws on overflow.
    */
    function mul(uint256 _a, uint256 _b) internal pure returns (uint256 c) {
        // Gas optimization: this is cheaper than asserting 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
        if (_a == 0) {
            return 0;
        }

        c = _a * _b;
        assert(c / _a == _b);
        return c;
    }

    /**
    * @dev Integer division of two numbers, truncating the quotient.
    */
    function div(uint256 _a, uint256 _b) internal pure returns (uint256) {
        require(_b > 0, "in SafeMath: div(). Denominator cannot be 0");
        // uint256 c = _a / _b;
        // assert(_a == _b * c + _a % _b); // There is no case in which this doesn't hold
        return _a / _b;
    }

    /**
    * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
    */
    function sub(uint256 _a, uint256 _b) internal pure returns (uint256) {
        require(_b <= _a, "in SafeMath: sub(). Operand2 is greater than Operand1");
        return _a - _b;
    }

    /**
    * @dev Adds two numbers, throws on overflow.
    */
    function add(uint256 _a, uint256 _b) internal pure returns (uint256 c) {
        c = _a + _b;
        assert(c >= _a);
        return c;
    }
}

// File: contracts/Debt/DebtRegistry.sol
pragma solidity ^0.5.0;         // solhint-disable-line compiler-fixed
/**
 * The DebtRegistry stores the parameters and beneficiaries of all debt agreements in
 * Dharma protocol.  It authorizes a limited number of agents to
 * perform mutations on it -- those agents can be changed at any
 * time by the contract's owner.
 *
 * Author: Nadav Hollander -- Github: nadavhollander
 */
contract DebtRegistry is Pausable, PermissionEvents {
    using SafeMath for uint;
    using PermissionsLib for PermissionsLib.Permissions;

    struct Entry {
        address version;
        address beneficiary;
        address underwriter;
        uint underwriterRiskRating;
        address termsContract;
        bytes32 termsContractParameters;
        uint issuanceBlockTimestamp;
    }

    // Primary registry mapping agreement IDs to their corresponding entries
    mapping(bytes32 => Entry) internal registry;

    // Maps debtor addresses to a list of their debts' agreement IDs
    mapping(address => bytes32[]) internal debtorToDebts;

    PermissionsLib.Permissions internal entryInsertPermissions;
    PermissionsLib.Permissions internal entryEditPermissions;

    string public constant INSERT_CONTEXT = "debt-registry-insert";
    string public constant EDIT_CONTEXT = "debt-registry-edit";

    event LogInsertEntry(
        bytes32 indexed agreementId,
        address indexed beneficiary,
        address indexed underwriter,
        uint underwriterRiskRating,
        address termsContract,
        bytes32 termsContractParameters
    );

    event LogModifyEntryBeneficiary(
        bytes32 indexed agreementId,
        address indexed previousBeneficiary,
        address indexed newBeneficiary
    );

    modifier onlyAuthorizedToInsert() {
        require(entryInsertPermissions.isAuthorized(msg.sender), "in DebitRegistry:onlyAuthorizedToInsert(). Agent is not authorized to insert"); //solhint-disable-line max-line-length
        _;
    }

    modifier onlyAuthorizedToEdit() {
        require(entryEditPermissions.isAuthorized(msg.sender), "in DebitRegistry:onlyAuthorizedToEdit(). Agent is not authorized to edit"); //solhint-disable-line max-line-length
        _;
    }

    modifier onlyExtantEntry(bytes32 agreementId) {
        require(doesEntryExist(agreementId), "in DebitRegistry:onlyExtantEntry(). Agreement ID does not exists.");
        _;
    }

    modifier nonNullBeneficiary(address beneficiary) {
        require(beneficiary != address(0), "in DebitRegistry:nonNullBeneficiary(). Beneficiary is address(0).");
        _;
    }

    /* Ensures an entry with the specified agreement ID exists within the debt registry. */
    function doesEntryExist(bytes32 agreementId)
    public
    view
    returns (bool exists)
    {
        return registry[agreementId].beneficiary != address(0);
    }

    /**
     * Inserts a new entry into the registry, if the entry is valid and sender is
     * authorized to make 'insert' mutations to the registry.
     */
    function insert(
        address _version,
        address _beneficiary,
        address _debtor,
        address _underwriter,
        uint _underwriterRiskRating,
        address _termsContract,
        bytes32 _termsContractParameters,
        uint _salt
    )
    public
    onlyAuthorizedToInsert
    whenNotPaused
    nonNullBeneficiary(_beneficiary)
    returns (bytes32 _agreementId)
    {
        Entry memory entry = Entry(
            _version,
            _beneficiary,
            _underwriter,
            _underwriterRiskRating,
            _termsContract,
            _termsContractParameters,
            block.timestamp
        );

        bytes32 agreementId = _getAgreementId(entry, _debtor, _salt);

        require(registry[agreementId].beneficiary == address(0), "in DebtRegistry:insert(). Beneficiary should be address(0)"); // solhint-disable-line max-line-length

        registry[agreementId] = entry;
        debtorToDebts[_debtor].push(agreementId);

        emit LogInsertEntry(
            agreementId,
            entry.beneficiary,
            entry.underwriter,
            entry.underwriterRiskRating,
            entry.termsContract,
            entry.termsContractParameters
        );

        return agreementId;
    }

    /**
     * Modifies the beneficiary of a debt issuance, if the sender
     * is authorized to make 'modifyBeneficiary' mutations to
     * the registry.
     */
    function modifyBeneficiary(bytes32 agreementId, address newBeneficiary)
    public
    onlyAuthorizedToEdit
    whenNotPaused
    onlyExtantEntry(agreementId)
    nonNullBeneficiary(newBeneficiary)
    {
        address previousBeneficiary = registry[agreementId].beneficiary;

        registry[agreementId].beneficiary = newBeneficiary;

        emit LogModifyEntryBeneficiary(
            agreementId,
            previousBeneficiary,
            newBeneficiary
        );
    }

    /**
     * Adds an address to the list of agents authorized
     * to make 'insert' mutations to the registry.
     */
    function addAuthorizedInsertAgent(address agent)
    public
    onlyOwner
    {
        entryInsertPermissions.authorize(agent, INSERT_CONTEXT);
    }

    /**
     * Adds an address to the list of agents authorized
     * to make 'modifyBeneficiary' mutations to the registry.
     */
    function addAuthorizedEditAgent(address agent)
    public
    onlyOwner
    {
        entryEditPermissions.authorize(agent, EDIT_CONTEXT);
    }

    /**
     * Removes an address from the list of agents authorized
     * to make 'insert' mutations to the registry.
     */
    function revokeInsertAgentAuthorization(address agent)
    public
    onlyOwner
    {
        entryInsertPermissions.revokeAuthorization(agent, INSERT_CONTEXT);
    }

    /**
     * Removes an address from the list of agents authorized
     * to make 'modifyBeneficiary' mutations to the registry.
     */
    function revokeEditAgentAuthorization(address agent)
    public
    onlyOwner
    {
        entryEditPermissions.revokeAuthorization(agent, EDIT_CONTEXT);
    }

    /**
     * Returns the parameters of a debt issuance in the registry.
     *
     * TODO(kayvon): protect this function with our `onlyExtantEntry` modifier once the restriction
     * on the size of the call stack has been addressed.
     */
    function get(bytes32 agreementId)
    public
    view
    returns (address, address, address, uint, address, bytes32, uint)
    {
        return (
        registry[agreementId].version,
        registry[agreementId].beneficiary,
        registry[agreementId].underwriter,
        registry[agreementId].underwriterRiskRating,
        registry[agreementId].termsContract,
        registry[agreementId].termsContractParameters,
        registry[agreementId].issuanceBlockTimestamp
        );
    }

    /**
     * Returns the beneficiary of a given issuance
     */
    function getBeneficiary(bytes32 agreementId)
    public
    view
    onlyExtantEntry(agreementId)
    returns (address)
    {
        return registry[agreementId].beneficiary;
    }

    /**
     * Returns the terms contract address of a given issuance
     */
    function getTermsContract(bytes32 agreementId)
    public
    view
    onlyExtantEntry(agreementId)
    returns (address)
    {
        return registry[agreementId].termsContract;
    }

    /**
     * Returns the terms contract parameters of a given issuance
     */
    function getTermsContractParameters(bytes32 agreementId)
    public
    view
    onlyExtantEntry(agreementId)
    returns (bytes32)
    {
        return registry[agreementId].termsContractParameters;
    }

    /**
     * Returns a tuple of the terms contract and its associated parameters
     * for a given issuance
     */
    function getTerms(bytes32 agreementId)
    public
    view
    onlyExtantEntry(agreementId)
    returns (address, bytes32)
    {
        return (
        registry[agreementId].termsContract,
        registry[agreementId].termsContractParameters
        );
    }

    /**
     * Returns the timestamp of the block at which a debt agreement was issued.
     */
    function getIssuanceBlockTimestamp(bytes32 agreementId)
    public
    view
    onlyExtantEntry(agreementId)
    returns (uint timestamp)
    {
        return registry[agreementId].issuanceBlockTimestamp;
    }

    /**
     * Returns the list of agents authorized to make 'insert' mutations
     */
    function getAuthorizedInsertAgents()
    public
    view
    returns (address[] memory)
    {
        return entryInsertPermissions.getAuthorizedAgents();
    }

    /**
     * Returns the list of agents authorized to make 'modifyBeneficiary' mutations
     */
    function getAuthorizedEditAgents()
    public
    view
    returns (address[] memory)
    {
        return entryEditPermissions.getAuthorizedAgents();
    }

    /**
     * Returns the list of debt agreements a debtor is party to,
     * with each debt agreement listed by agreement ID.
     */
    function getDebtorsDebts(address debtor)
    public
    view
    returns (bytes32[] memory)
    {
        return debtorToDebts[debtor];
    }

    /**
     * Helper function for computing the hash of a given issuance,
     * and, in turn, its agreementId
     */
    function _getAgreementId(Entry memory _entry, address _debtor, uint _salt)
    internal
    pure
    returns (bytes32)
    {
        return keccak256(abi.encodePacked(
                _entry.version,
                _debtor,
                _entry.underwriter,
                _entry.underwriterRiskRating,
                _entry.termsContract,
                _entry.termsContractParameters,
                _salt
            ));
    }
}

// File: contracts/openZeppelinDebug/contracts/introspection/ERC165.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title ERC165
 * @dev https://github.com/ethereum/EIPs/blob/master/EIPS/eip-165.md
 */
interface ERC165 {

    /**
     * @notice Query if a contract implements an interface
     * @param _interfaceId The interface identifier, as specified in ERC-165
     * @dev Interface identification is specified in ERC-165. This function
     * uses less than 30,000 gas.
     */
    function supportsInterface(bytes4 _interfaceId)
    external
    view
    returns (bool);
}

// File: contracts/openZeppelinDebug/contracts/token/ERC721/ERC721Basic.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title ERC721 Non-Fungible Token Standard basic interface
 * @dev see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md
 */
contract ERC721Basic is ERC165 {

    bytes4 internal constant InterfaceId_ERC721 = 0x80ac58cd;
    /*
     * 0x80ac58cd ===
     *   bytes4(keccak256('balanceOf(address)')) ^
     *   bytes4(keccak256('ownerOf(uint256)')) ^
     *   bytes4(keccak256('approve(address,uint256)')) ^
     *   bytes4(keccak256('getApproved(uint256)')) ^
     *   bytes4(keccak256('setApprovalForAll(address,bool)')) ^
     *   bytes4(keccak256('isApprovedForAll(address,address)')) ^
     *   bytes4(keccak256('transferFrom(address,address,uint256)')) ^
     *   bytes4(keccak256('safeTransferFrom(address,address,uint256)')) ^
     *   bytes4(keccak256('safeTransferFrom(address,address,uint256,bytes)'))
     */

    bytes4 internal constant InterfaceId_ERC721Exists = 0x4f558e79;
    /*
     * 0x4f558e79 ===
     *   bytes4(keccak256('exists(uint256)'))
     */

    bytes4 internal constant InterfaceId_ERC721Enumerable = 0x780e9d63;
    /**
     * 0x780e9d63 ===
     *   bytes4(keccak256('totalSupply()')) ^
     *   bytes4(keccak256('tokenOfOwnerByIndex(address,uint256)')) ^
     *   bytes4(keccak256('tokenByIndex(uint256)'))
     */

    bytes4 internal constant InterfaceId_ERC721Metadata = 0x5b5e139f;
    /**
     * 0x5b5e139f ===
     *   bytes4(keccak256('name()')) ^
     *   bytes4(keccak256('symbol()')) ^
     *   bytes4(keccak256('tokenURI(uint256)'))
     */

    event Transfer(
        address indexed _from,
        address indexed _to,
        uint256 indexed _tokenId
    );
    event Approval(
        address indexed _owner,
        address indexed _approved,
        uint256 indexed _tokenId
    );
    event ApprovalForAll(
        address indexed _owner,
        address indexed _operator,
        bool _approved
    );

    function balanceOf(address _owner) public view returns (uint256 _balance);

    function ownerOf(uint256 _tokenId) public view returns (address _owner);

    function exists(uint256 _tokenId) public view returns (bool _exists);

    function approve(address _to, uint256 _tokenId) public;

    function getApproved(uint256 _tokenId)
    public view returns (address _operator);

    function setApprovalForAll(address _operator, bool _approved) public;

    function isApprovedForAll(address _owner, address _operator)
    public view returns (bool);

    function transferFrom(address _from, address _to, uint256 _tokenId) public;

    function safeTransferFrom(address _from, address _to, uint256 _tokenId)
    public;

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    )
    public;
}

// File: contracts/openZeppelinDebug/contracts/token/ERC721/ERC721.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title ERC-721 Non-Fungible Token Standard, optional enumeration extension
 * @dev See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md
 */
contract ERC721Enumerable is ERC721Basic {
    function totalSupply() public view returns (uint256);

    function tokenOfOwnerByIndex(
        address _owner,
        uint256 _index
    )
    public
    view
    returns (uint256 _tokenId);

    function tokenByIndex(uint256 _index) public view returns (uint256);
}

/**
 * @title ERC-721 Non-Fungible Token Standard, optional metadata extension
 * @dev See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md
 */
contract ERC721Metadata is ERC721Basic {
    function name() external view returns (string memory _name);

    function symbol() external view returns (string memory _symbol);

    function tokenURI(uint256 _tokenId) public view returns (string memory);
}
/**
 * @title ERC-721 Non-Fungible Token Standard, full implementation interface
 * @dev See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md
 */
contract ERC721 is ERC721Basic, ERC721Enumerable, ERC721Metadata {
}

// File: contracts/openZeppelinDebug/contracts/token/ERC721/ERC721Receiver.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title ERC721 token receiver interface
 * @dev Interface for any contract that wants to support safeTransfers
 * from ERC721 asset contracts.
 */
contract ERC721Receiver {
    /**
     * @dev Magic value to be returned upon successful reception of an NFT
     *  Equals to `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`,
     *  which can be also obtained as `ERC721Receiver(0).onERC721Received.selector`
     */
    bytes4 internal constant ERC721_RECEIVED = 0x150b7a02;

    /**
     * @notice Handle the receipt of an NFT
     * @dev The ERC721 smart contract calls this function on the recipient
     * after a `safetransfer`. This function MAY throw to revert and reject the
     * transfer. Return of other than the magic value MUST result in the
     * transaction being reverted.
     * Note: the contract address is always the message sender.
     * @param _operator The address which called `safeTransferFrom` function
     * @param _from The address which previously owned the token
     * @param _tokenId The NFT identifier which is being transferred
     * @param _data Additional data with no specified format
     * @return `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
     */
    function onERC721Received(
        address _operator,
        address _from,
        uint256 _tokenId,
        bytes memory _data
    )
    public
    returns (bytes4);
}

// File: contracts/openZeppelinDebug/contracts/AddressUtils.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * Utility library of inline functions on addresses
 */
library AddressUtils {

    /**
     * Returns whether the target address is a contract
     * @dev This function will return false if invoked during the constructor of a contract,
     * as the code is not actually created until after the constructor finishes.
     * @param _addr address to check
     * @return whether the target address is a contract
     */
    function isContract(address _addr) internal view returns (bool) {
        uint256 size;
        // XXX Currently there is no better way to check if there is a contract in an address
        // than to check the size of the code at that address.
        // See https://ethereum.stackexchange.com/a/14016/36603
        // for more details about how this works.
        // TODO Check this again before the Serenity release, because all addresses will be
        // contracts then.
        // solium-disable-next-line security/no-inline-assembly
        assembly {size := extcodesize(_addr)}
        return size > 0;
    }

}

// File: contracts/openZeppelinDebug/contracts/introspection/SupportsInterfaceWithLookup.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title SupportsInterfaceWithLookup
 * @author Matt Condon (@shrugs)
 * @dev Implements ERC165 using a lookup table.
 */
contract SupportsInterfaceWithLookup is ERC165 {

    bytes4 public constant InterfaceId_ERC165 = 0x01ffc9a7;
    /**
     * 0x01ffc9a7 ===
     *   bytes4(keccak256('supportsInterface(bytes4)'))
     */

    /**
     * @dev a mapping of interface id to whether or not it's supported
     */
    mapping(bytes4 => bool) internal supportedInterfaces;

    /**
     * @dev A contract implementing SupportsInterfaceWithLookup
     * implement ERC165 itself
     */
    constructor()
    public
    {
        _registerInterface(InterfaceId_ERC165);
    }

    /**
     * @dev implement supportsInterface(bytes4) using a lookup table
     */
    function supportsInterface(bytes4 _interfaceId)
    external
    view
    returns (bool)
    {
        return supportedInterfaces[_interfaceId];
    }

    /**
     * @dev private method for registering an interface
     */
    function _registerInterface(bytes4 _interfaceId)
    internal
    {
        require(
            _interfaceId != 0xffffffff,
                "in SupportsInterfaceWithLookup:_registerInterface(). Interfaced id cannot be 0xffffffff"
        );
        supportedInterfaces[_interfaceId] = true;
    }
}

// File: contracts/openZeppelinDebug/contracts/token/ERC721/ERC721BasicToken.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title ERC721 Non-Fungible Token Standard basic implementation
 * @dev see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md
 */
contract ERC721BasicToken is SupportsInterfaceWithLookup, ERC721Basic {

    using SafeMath for uint256;
    using AddressUtils for address;

    // Equals to `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
    // which can be also obtained as `ERC721Receiver(0).onERC721Received.selector`
    bytes4 private constant ERC721_RECEIVED = 0x150b7a02;

    // Mapping from token ID to owner
    mapping(uint256 => address) internal tokenOwner;

    // Mapping from token ID to approved address
    mapping(uint256 => address) internal tokenApprovals;

    // Mapping from owner to number of owned token
    mapping(address => uint256) internal ownedTokensCount;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) internal operatorApprovals;

    constructor()
    public
    {
        // register the supported interfaces to conform to ERC721 via ERC165
        _registerInterface(InterfaceId_ERC721);
        _registerInterface(InterfaceId_ERC721Exists);
    }

    /**
     * @dev Gets the balance of the specified address
     * @param _owner address to query the balance of
     * @return uint256 representing the amount owned by the passed address
     */
    function balanceOf(address _owner) public view returns (uint256) {
        require(_owner != address(0), "ERC721BasicToken:balanceOf().Owner account should not be 0th account");
        return ownedTokensCount[_owner];
    }

    /**
     * @dev Gets the owner of the specified token ID
     * @param _tokenId uint256 ID of the token to query the owner of
     * @return owner address currently marked as the owner of the given token ID
     */
    function ownerOf(uint256 _tokenId) public view returns (address) {
        address owner = tokenOwner[_tokenId];
        require(owner != address(0), "ERC721BasicToken:ownerOf().Owner account should not be 0th account");
        return owner;
    }

    /**
     * @dev Returns whether the specified token exists
     * @param _tokenId uint256 ID of the token to query the existence of
     * @return whether the token exists
     */
    function exists(uint256 _tokenId) public view returns (bool) {
        address owner = tokenOwner[_tokenId];
        return owner != address(0);
    }

    /**
     * @dev Approves another address to transfer the given token ID
     * The zero address indicates there is no approved address.
     * There can only be one approved address per token at a given time.
     * Can only be called by the token owner or an approved operator.
     * @param _to address to be approved for the given token ID
     * @param _tokenId uint256 ID of the token to be approved
     */
    function approve(address _to, uint256 _tokenId) public {
        address owner = ownerOf(_tokenId);
        require(_to != owner, "ERC721BasicToken:approve(). _to address should not be the owner's address");
        require(
            msg.sender == owner || isApprovedForAll(owner, msg.sender),
                "ERC721BasicToken:approve(). _to address is not a  token owner or an approved operator"
        );

        tokenApprovals[_tokenId] = _to;
        emit Approval(owner, _to, _tokenId);
    }

    /**
     * @dev Gets the approved address for a token ID, or zero if no address set
     * @param _tokenId uint256 ID of the token to query the approval of
     * @return address currently approved for the given token ID
     */
    function getApproved(uint256 _tokenId) public view returns (address) {
        return tokenApprovals[_tokenId];
    }

    /**
     * @dev Sets or unsets the approval of a given operator
     * An operator is allowed to transfer all tokens of the sender on their behalf
     * @param _to operator address to set the approval
     * @param _approved representing the status of the approval to be set
     */
    function setApprovalForAll(address _to, bool _approved) public {
        require(_to != msg.sender, "ERC721BasicToken:setApprovalForAll(). _to address should not be equal to owner");
        operatorApprovals[msg.sender][_to] = _approved;
        emit ApprovalForAll(msg.sender, _to, _approved);
    }

    /**
     * @dev Tells whether an operator is approved by a given owner
     * @param _owner owner address which you want to query the approval of
     * @param _operator operator address which you want to query the approval of
     * @return bool whether the given operator is approved by the given owner
     */
    function isApprovedForAll(
        address _owner,
        address _operator
    )
    public
    view
    returns (bool)
    {
        return operatorApprovals[_owner][_operator];
    }

    /**
     * @dev Transfers the ownership of a given token ID to another address
     * Usage of this method is discouraged, use `safeTransferFrom` whenever possible
     * Requires the msg sender to be the owner, approved, or operator
     * @param _from current owner of the token
     * @param _to address to receive the ownership of the given token ID
     * @param _tokenId uint256 ID of the token to be transferred
    */
    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    )
    public
    {
        require(isApprovedOrOwner(msg.sender, _tokenId), "ERC721BasicToken:transferFrom(). has failed");
        require(
            _from != address(0),
                "ERC721BasicToken:transferFrom(). _from address should not be equal to 0th address"
        );
        require(
            _to != address(0),
                "ERC721BasicToken:transferFrom(). _from address should not be equal to 0th address"
        );

        clearApproval(_from, _tokenId);
        removeTokenFrom(_from, _tokenId);
        addTokenTo(_to, _tokenId);

        emit Transfer(_from, _to, _tokenId);
    }

    /**
     * @dev Safely transfers the ownership of a given token ID to another address
     * If the target address is a contract, it must implement `onERC721Received`,
     * which is called upon a safe transfer, and return the magic value
     * `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`; otherwise,
     * the transfer is reverted.
     *
     * Requires the msg sender to be the owner, approved, or operator
     * @param _from current owner of the token
     * @param _to address to receive the ownership of the given token ID
     * @param _tokenId uint256 ID of the token to be transferred
    */
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    )
    public
    {
        // solhint-disable-next-line arg-overflow
        safeTransferFrom(_from, _to, _tokenId, "");
    }

    /**
     * @dev Safely transfers the ownership of a given token ID to another address
     * If the target address is a contract, it must implement `onERC721Received`,
     * which is called upon a safe transfer, and return the magic value
     * `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`; otherwise,
     * the transfer is reverted.
     * Requires the msg sender to be the owner, approved, or operator
     * @param _from current owner of the token
     * @param _to address to receive the ownership of the given token ID
     * @param _tokenId uint256 ID of the token to be transferred
     * @param _data bytes data to send along with a safe transfer check
     */
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    )
    public
    {
        transferFrom(_from, _to, _tokenId);
        // solium-disable-next-line arg-overflow
        require(
            checkAndCallSafeTransfer(_from, _to, _tokenId, _data),
                "ERC721BasicToken:safeTransferFrom(). has failed"
        );
    }

    /**
     * @dev Returns whether the given spender can transfer a given token ID
     * @param _spender address of the spender to query
     * @param _tokenId uint256 ID of the token to be transferred
     * @return bool whether the msg.sender is approved for the given token ID,
     *  is an operator of the owner, or is the owner of the token
     */
    function isApprovedOrOwner(
        address _spender,
        uint256 _tokenId
    )
    internal
    view
    returns (bool)
    {
        address owner = ownerOf(_tokenId);
        // Disable solium check because of
        // https://github.com/duaraghav8/Solium/issues/175
        // solium-disable-next-line operator-whitespace
        return (
        _spender == owner ||
        getApproved(_tokenId) == _spender ||
        isApprovedForAll(owner, _spender)
        );
    }

    /**
     * @dev Internal function to mint a new token
     * Reverts if the given token ID already exists
     * @param _to The address that will own the minted token
     * @param _tokenId uint256 ID of the token to be minted by the msg.sender
     */
    function _mint(address _to, uint256 _tokenId) internal {
        require(_to != address(0), "ERC721BasicToken:mint(). _to address should not be equal to address(0)");
        addTokenTo(_to, _tokenId);
        emit Transfer(address(0), _to, _tokenId);
    }

    /**
     * @dev Internal function to burn a specific token
     * Reverts if the token does not exist
     * @param _tokenId uint256 ID of the token being burned by the msg.sender
     */
    function _burn(address _owner, uint256 _tokenId) internal {
        clearApproval(_owner, _tokenId);
        removeTokenFrom(_owner, _tokenId);
        emit Transfer(_owner, address(0), _tokenId);
    }

    /**
     * @dev Internal function to clear current approval of a given token ID
     * Reverts if the given address is not indeed the owner of the token
     * @param _owner owner of the token
     * @param _tokenId uint256 ID of the token to be transferred
     */
    function clearApproval(address _owner, uint256 _tokenId) internal {
        require(ownerOf(_tokenId) == _owner, "ERC721BasicToken:clearApproval(). ownerAddress is not a owner of token");
        if (tokenApprovals[_tokenId] != address(0)) {
            tokenApprovals[_tokenId] = address(0);
        }
    }

    /**
     * @dev Internal function to add a token ID to the list of a given address
     * @param _to address representing the new owner of the given token ID
     * @param _tokenId uint256 ID of the token to be added to the tokens list of the given address
     */
    function addTokenTo(address _to, uint256 _tokenId) internal {
        require(tokenOwner[_tokenId] == address(0), "ERC721BasicToken:addTokenTo(). has failed");
        tokenOwner[_tokenId] = _to;
        ownedTokensCount[_to] = ownedTokensCount[_to].add(1);
    }

    /**
     * @dev Internal function to remove a token ID from the list of a given address
     * @param _from address representing the previous owner of the given token ID
     * @param _tokenId uint256 ID of the token to be removed from the tokens list of the given address
     */
    function removeTokenFrom(address _from, uint256 _tokenId) internal {
        require(ownerOf(_tokenId) == _from, "ERC721BasicToken:removeTokenFrom(). has failed");
        ownedTokensCount[_from] = ownedTokensCount[_from].sub(1);
        tokenOwner[_tokenId] = address(0);
    }

    /**
     * @dev Internal function to invoke `onERC721Received` on a target address
     * The call is not executed if the target address is not a contract
     * @param _from address representing the previous owner of the given token ID
     * @param _to target address that will receive the tokens
     * @param _tokenId uint256 ID of the token to be transferred
     * @param _data bytes optional data to send along with the call
     * @return whether the call correctly returned the expected magic value
     */
    function checkAndCallSafeTransfer(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    )
    internal
    returns (bool)
    {
        if (!_to.isContract()) {
            return true;
        }
        bytes4 retval = ERC721Receiver(_to).onERC721Received(
            msg.sender, _from, _tokenId, _data);
        return (retval == ERC721_RECEIVED);
    }
}

// File: contracts/openZeppelinDebug/contracts/token/ERC721/ERC721Token.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title Full ERC721 Token
 * This implementation includes all the required and some optional functionality of the ERC721 standard
 * Moreover, it includes approve all functionality using operator terminology
 * @dev see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md
 */
contract ERC721Token is SupportsInterfaceWithLookup, ERC721BasicToken, ERC721 {

    // Token name
    string internal name_;

    // Token symbol
    string internal symbol_;


    // Mapping from owner to list of owned token IDs
    mapping(address => uint256[]) internal ownedTokens;
    // Mapping from token ID to index of the owner tokens list
    mapping(uint256 => uint256) internal ownedTokensIndex;

    // Array with all token ids, used for enumeration
    uint256[] internal allTokens;

    // Mapping from token id to position in the allTokens array
    mapping(uint256 => uint256) internal allTokensIndex;

    // Optional mapping for token URIs
    mapping(uint256 => string) internal tokenURIs;

    /**
     * @dev Constructor function
     */
    constructor(string memory _name, string memory _symbol) public {
        name_ = _name;
        symbol_ = _symbol;

        // register the supported interfaces to conform to ERC721 via ERC165
        _registerInterface(InterfaceId_ERC721Enumerable);
        _registerInterface(InterfaceId_ERC721Metadata);
    }

    /**
     * @dev Gets the token name
     * @return string representing the token name
     */
    function name() external view returns (string memory) {
        return name_;
    }

    /**
     * @dev Gets the token symbol
     * @return string representing the token symbol
     */
    function symbol() external view returns (string memory) {
        return symbol_;
    }

    /**
     * @dev Returns an URI for a given token ID
     * Throws if the token ID does not exist. May return an empty string.
     * @param _tokenId uint256 ID of the token to query
     */
    function tokenURI(uint256 _tokenId) public view returns (string memory) {
        require(exists(_tokenId), "ERC721Token:tokenURI().tokenId does not exists");
        return tokenURIs[_tokenId];
    }

    /**
     * @dev Gets the token ID at a given index of the tokens list of the requested owner
     * @param _owner address owning the tokens list to be accessed
     * @param _index uint256 representing the index to be accessed of the requested tokens list
     * @return uint256 token ID at the given index of the tokens list owned by the requested address
     */
    function tokenOfOwnerByIndex(
        address _owner,
        uint256 _index
    )
    public
    view
    returns (uint256)
    {
        require(
            _index < balanceOf(_owner),
                "ERC721Token:tokenOfOwnerByIndex(). index is greater than balance of owner"
        );
        return ownedTokens[_owner][_index];
    }

    /**
     * @dev Gets the total amount of tokens stored by the contract
     * @return uint256 representing the total amount of tokens
     */
    function totalSupply() public view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @dev Gets the token ID at a given index of all the tokens in this contract
     * Reverts if the index is greater or equal to the total number of tokens
     * @param _index uint256 representing the index to be accessed of the tokens list
     * @return uint256 token ID at the given index of the tokens list
     */
    function tokenByIndex(uint256 _index) public view returns (uint256) {
        require(_index < totalSupply(), "ERC721Token:tokenByIndex(). index is greater than total supply");
        return allTokens[_index];
    }

    /**
     * @dev Internal function to set the token URI for a given token
     * Reverts if the token ID does not exist
     * @param _tokenId uint256 ID of the token to set its URI
     * @param _uri string URI to assign
     */
    function _setTokenURI(uint256 _tokenId, string memory _uri) internal {
        require(exists(_tokenId), "ERC721Token:setTokenURI().Token Id does not exists");
        tokenURIs[_tokenId] = _uri;
    }

    /**
     * @dev Internal function to add a token ID to the list of a given address
     * @param _to address representing the new owner of the given token ID
     * @param _tokenId uint256 ID of the token to be added to the tokens list of the given address
     */
    function addTokenTo(address _to, uint256 _tokenId) internal {
        super.addTokenTo(_to, _tokenId);
        uint256 length = ownedTokens[_to].length;
        ownedTokens[_to].push(_tokenId);
        ownedTokensIndex[_tokenId] = length;
    }

    /**
     * @dev Internal function to remove a token ID from the list of a given address
     * @param _from address representing the previous owner of the given token ID
     * @param _tokenId uint256 ID of the token to be removed from the tokens list of the given address
     */
    function removeTokenFrom(address _from, uint256 _tokenId) internal {
        super.removeTokenFrom(_from, _tokenId);

        // To prevent a gap in the array, we store the last token in the index of the token to delete, and
        // then delete the last slot.
        uint256 tokenIndex = ownedTokensIndex[_tokenId];
        uint256 lastTokenIndex = ownedTokens[_from].length.sub(1);
        uint256 lastToken = ownedTokens[_from][lastTokenIndex];

        ownedTokens[_from][tokenIndex] = lastToken;
        // This also deletes the contents at the last position of the array
        ownedTokens[_from].length--;

        //solhint-disable-next-line max-line-length
        // Note that this will handle single-element arrays. In that case, both tokenIndex and lastTokenIndex are going to
        //solhint-disable-next-line max-line-length
        // be zero. Then we can make sure that we will remove _tokenId from the ownedTokens list since we are first swapping
        // the lastToken to the first position, and then dropping the element placed in the last position of the list

        ownedTokensIndex[_tokenId] = 0;
        ownedTokensIndex[lastToken] = tokenIndex;
    }

    /**
     * @dev Internal function to mint a new token
     * Reverts if the given token ID already exists
     * @param _to address the beneficiary that will own the minted token
     * @param _tokenId uint256 ID of the token to be minted by the msg.sender
     */
    function _mint(address _to, uint256 _tokenId) internal {
        super._mint(_to, _tokenId);

        allTokensIndex[_tokenId] = allTokens.length;
        allTokens.push(_tokenId);
    }

    /**
     * @dev Internal function to burn a specific token
     * Reverts if the token does not exist
     * @param _owner owner of the token to burn
     * @param _tokenId uint256 ID of the token being burned by the msg.sender
     */
    function _burn(address _owner, uint256 _tokenId) internal {
        super._burn(_owner, _tokenId);

        // Clear metadata (if any)
        if (bytes(tokenURIs[_tokenId]).length != 0) {
            delete tokenURIs[_tokenId];
        }

        // Reorg all tokens array
        uint256 tokenIndex = allTokensIndex[_tokenId];
        uint256 lastTokenIndex = allTokens.length.sub(1);
        uint256 lastToken = allTokens[lastTokenIndex];

        allTokens[tokenIndex] = lastToken;
        allTokens[lastTokenIndex] = 0;

        allTokens.length--;
        allTokensIndex[_tokenId] = 0;
        allTokensIndex[lastToken] = tokenIndex;
    }

}

// File: contracts/openZeppelinDebug/contracts/token/ERC20/ERC20Basic.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * See https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
    function totalSupply() public view returns (uint256);

    function balanceOf(address _who) public view returns (uint256);

    function transfer(address _to, uint256 _value) public returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
}

// File: contracts/openZeppelinDebug/contracts/token/ERC20/ERC20.sol
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 is ERC20Basic {
    function allowance(address _owner, address _spender)
    public view returns (uint256);

    function transferFrom(address _from, address _to, uint256 _value)
    public returns (bool);

    function approve(address _spender, uint256 _value) public returns (bool);

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

// File: contracts/Debt/DebtToken.sol
pragma solidity ^0.5.0;        // solhint-disable-line compiler-fixed
contract DebtToken is ERC721Token, Pausable, PermissionEvents {
    using PermissionsLib for PermissionsLib.Permissions;

    DebtRegistry public registry;

    PermissionsLib.Permissions internal tokenCreationPermissions;
    PermissionsLib.Permissions internal tokenURIPermissions;

    string public constant CREATION_CONTEXT = "debt-token-creation";
    string public constant URI_CONTEXT = "debt-token-uri";

    /**
     * Constructor that sets the address of the debt registry.
     */
    constructor (address _registry)
    public
    ERC721Token("DebtToken", "DDT") {
        registry = DebtRegistry(_registry);
    }

    /**
     * ERC165 interface.
     * Returns true for ERC721, false otherwise
     */
    function supportsInterface(bytes4 interfaceID)
    external
    view
    returns (bool _isSupported)
    {
        return interfaceID == 0x80ac58cd;
        // ERC721
    }

    /**
     * Mints a unique debt token and inserts the associated issuance into
     * the debt registry, if the calling address is authorized to do so.
     */
    function create(
        address _version,
        address _beneficiary,
        address _debtor,
        address _underwriter,
        uint _underwriterRiskRating,
        address _termsContract,
        bytes32 _termsContractParameters,
        uint _salt
    )
    public
    whenNotPaused
    returns (uint _tokenId)
    {
        require(tokenCreationPermissions.isAuthorized(msg.sender), "in DebtToken:create(). Msg.sender is not authorized");// solhint-disable-line max-line-length

        bytes32 entryHash = registry.insert(
            _version,
            _beneficiary,
            _debtor,
            _underwriter,
            _underwriterRiskRating,
            _termsContract,
            _termsContractParameters,
            _salt
        );

        super._mint(_beneficiary, uint(entryHash));

        return uint(entryHash);
    }

    /**
     * Adds an address to the list of agents authorized to mint debt tokens.
     */
    function addAuthorizedMintAgent(address _agent)
    public
    onlyOwner
    {
        tokenCreationPermissions.authorize(_agent, CREATION_CONTEXT);
    }

    /**
     * Removes an address from the list of agents authorized to mint debt tokens
     */
    function revokeMintAgentAuthorization(address _agent)
    public
    onlyOwner
    {
        tokenCreationPermissions.revokeAuthorization(_agent, CREATION_CONTEXT);
    }

    /**
     * Returns the list of agents authorized to mint debt tokens
     */
    function getAuthorizedMintAgents()
    public
    view
    returns (address[] memory _agents)
    {
        return tokenCreationPermissions.getAuthorizedAgents();
    }

    /**
     * Adds an address to the list of agents authorized to set token URIs.
     */
    function addAuthorizedTokenURIAgent(address _agent)
    public
    onlyOwner
    {
        tokenURIPermissions.authorize(_agent, URI_CONTEXT);
    }

    /**
     * Returns the list of agents authorized to set token URIs.
     */
    function getAuthorizedTokenURIAgents()
    public
    view
    returns (address[] memory _agents)
    {
        return tokenURIPermissions.getAuthorizedAgents();
    }

    /**
     * Removes an address from the list of agents authorized to set token URIs.
     */
    function revokeTokenURIAuthorization(address _agent)
    public
    onlyOwner
    {
        tokenURIPermissions.revokeAuthorization(_agent, URI_CONTEXT);
    }

    /**
     * We override approval method of the parent ERC721Token
     * contract to allow its functionality to be frozen in the case of an emergency
     */
    function approve(address _to, uint _tokenId)
    public
    whenNotPaused
    {
        super.approve(_to, _tokenId);
    }

    /**
     * We override setApprovalForAll method of the parent ERC721Token
     * contract to allow its functionality to be frozen in the case of an emergency
     */
    function setApprovalForAll(address _to, bool _approved)
    public
    whenNotPaused
    {
        super.setApprovalForAll(_to, _approved);
    }

    /**
     * Support deprecated ERC721 method
     */
    function transfer(address _to, uint _tokenId)
    public
    {
        safeTransferFrom(msg.sender, _to, _tokenId);
    }

    /**
     * We override transferFrom methods of the parent ERC721Token
     * contract to allow its functionality to be frozen in the case of an emergency
     */
    function transferFrom(address _from, address _to, uint _tokenId)
    public
    whenNotPaused
    {
        _modifyBeneficiary(_tokenId, _to);
        super.transferFrom(_from, _to, _tokenId);
    }

    /**
     * We override safeTransferFrom methods of the parent ERC721Token
     * contract to allow its functionality to be frozen in the case of an emergency
     */
    function safeTransferFrom(address _from, address _to, uint _tokenId)
    public
    whenNotPaused
    {
        _modifyBeneficiary(_tokenId, _to);
        super.safeTransferFrom(_from, _to, _tokenId);
    }

    /**
     * We override safeTransferFrom methods of the parent ERC721Token
     * contract to allow its functionality to be frozen in the case of an emergency
     */
    function safeTransferFrom(address _from, address _to, uint _tokenId, bytes memory _data)
    public
    whenNotPaused
    {
        _modifyBeneficiary(_tokenId, _to);
        super.safeTransferFrom(_from, _to, _tokenId, _data);
    }

    /**
     * Allows senders with special permissions to set the token URI for a given debt token.
     */
    function setTokenURI(uint256 _tokenId, string memory _uri)
    public
    whenNotPaused
    {
        require(tokenURIPermissions.isAuthorized(msg.sender), "in DebtToken:setTokenURI(). Msg.sender is not authorized");// solhint-disable-line max-line-length
        super._setTokenURI(_tokenId, _uri);
    }

    /**
     * _modifyBeneficiary mutates the debt registry. This function should be
     * called every time a token is transferred or minted
     */
    function _modifyBeneficiary(uint _tokenId, address _to)
    internal
    {
        address beneficiary = registry.getBeneficiary(bytes32(_tokenId));
        if (beneficiary != _to) {
            registry.modifyBeneficiary(bytes32(_tokenId), _to);
        }
    }
}

// File: contracts/TokenTransferRegistry/TokenTransferProxy.sol
pragma solidity ^0.5.0; // solhint-disable-line compiler-fixed
contract TokenTransferProxy is Pausable, PermissionEvents {
    using PermissionsLib for PermissionsLib.Permissions;

    PermissionsLib.Permissions internal tokenTransferPermissions;

    string public constant CONTEXT = "token-transfer-proxy";

    /**
     * Add address to list of agents authorized to initiate `transferFrom` calls
     */
    function addAuthorizedTransferAgent(address _agent)
    public
    onlyOwner
    {
        tokenTransferPermissions.authorize(_agent, CONTEXT);
    }

    /**
     * Remove address from list of agents authorized to initiate `transferFrom` calls
     */
    function revokeTransferAgentAuthorization(address _agent)
    public
    onlyOwner
    {
        tokenTransferPermissions.revokeAuthorization(_agent, CONTEXT);
    }

    /**
     * Return list of agents authorized to initiate `transferFrom` calls
     */
    function getAuthorizedTransferAgents()
    public
    view
    returns (address[] memory authorizedAgents)
    {
        return tokenTransferPermissions.getAuthorizedAgents();
    }

    /**
     * Transfer specified token amount from _from address to _to address on give token
     */
    function transferFrom(
        address _token,
        address _from,
        address _to,
        uint _amount
    )
    public
    returns (bool _success)
    {
        require(tokenTransferPermissions.isAuthorized(msg.sender), "TokenTransferProxy:transferFrom(). msg.sender is not authorized."); //solhint-disable-line max-line-length
        return ERC20(_token).transferFrom(_from, _to, _amount);
    }
}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract EscrowRegistry is Ownable, PermissionEvents {
    using PermissionsLib for PermissionsLib.Permissions;

    uint16 constant public EXTERNAL_QUERY_GAS_LIMIT = 8000;
    PermissionsLib.Permissions internal entryInsertPermissions;
    string public constant INSERT_CONTEXT = "borrower-registry-insert";

    //Maps the borrower's address to the amount that can be borrowed
    mapping (address => uint256) public borrowerAttributes;

    //Maps the lender's address to the amount that can be lent
    mapping (address => uint256) public lenderAttributes;

    /// @dev Guard function to check onlyRegulators
    modifier onlyRegulators() {
        require(
            entryInsertPermissions.isAuthorized(msg.sender),
            "in EscrowRegistry:onlyRegulators(). Regulator is not authorized to insert"
        );
        _;
    }

    /// @dev Adds an address to the list of agents authorized to make 'insert' mutations to the registry.
    /// @param _regulator address to be added as a regulator
    function addRegulator(address _regulator)
    public
    onlyOwner
    {
        entryInsertPermissions.authorize(_regulator, INSERT_CONTEXT);
    }

    /// @dev Get regulator details
    function isRegulator(address _regulator) public view returns (bool) {
        return entryInsertPermissions.isAuthorized(_regulator);
    }

    /// @dev Removes an address from the list of agents authorized to make 'insert' mutations to the registry.
    /// @param _regulator address to be removed as a regulator
    function removeRegulator(address _regulator)
    public
    onlyOwner
    {
        entryInsertPermissions.revokeAuthorization(_regulator, INSERT_CONTEXT);
    }


    /// @dev Maps the given borrower to the given borrower attributes & sets the borrower state
    /// @param _borrowerAddress Borrower contract address
    /// @param _amountThatCanBeBorrowed The amount that can be borrowed by the borrower
    function setBorrowerAttributes(
        address _borrowerAddress,
        uint256 _amountThatCanBeBorrowed
    )
    public onlyRegulators
    {
        borrowerAttributes[_borrowerAddress] = _amountThatCanBeBorrowed;
        //Set the Borrower State to be OK
        Borrower(_borrowerAddress).setBorrowState();
    }

    /// @dev Function that returns the amount that can be borrowed
    /// @param _borrowerAddress Borrower contract address
    /// @return Returns the amount a borrower can borrow
    function getBorrowableAmount(
        address _borrowerAddress
    )
    public
    view
    returns (uint256)
    {
        return borrowerAttributes[_borrowerAddress];
    }

    /// @dev Maps the given lender to the given lender attributes.
    /// @param _lenderAddress Escrow contract address
    /// @param _amountThaCanBeLent The amount that can be lent by the lender
    function setLenderAttributes(
        address _lenderAddress,
        uint256 _amountThaCanBeLent
    )
    public onlyRegulators
    {
        lenderAttributes[_lenderAddress] = _amountThaCanBeLent;
    }

    /// @dev Function that returns the amount that can be lent
    /// @param _lenderAddress Escrow contract address
    /// @return Returns the amount a lender can lent
    function getLentAmount(
        address _lenderAddress
    )
    public
    view
    returns (uint256)
    {
        return lenderAttributes[_lenderAddress];
    }

    /// @dev Function that checks whether the borrower is allowed to borrow or not?
    /// @param _borrowerAddress Borrower contract address
    /// @return Returns the status of is allowed to borrow?
    function isAllowedToBorrow(address _borrowerAddress) public view returns (bool) {
        return Borrower(_borrowerAddress).canBorrow();
    }

    /// @dev Function that sets the loanAmount for the borrower
    /// @param _borrowerAddress Borrower contract address
    /// @param _loanAmount The loan amount
    function setLoanAmountThroughEscrowRegistry(address _borrowerAddress, uint256 _loanAmount) public {
        Borrower(_borrowerAddress).setLoanAmountThroughBorrower(_loanAmount);
    }

    /// @dev Function that checks whether the Creditor is allowed to grant a loan or not?
    /// @param _lenderAddress Escrow contract address
    /// @return Returns the status of can creditor grant a loan?
    function canCreditorGrantLoan(address _lenderAddress) public view returns (bool) {
        return Escrow(_lenderAddress).canGrantLoan();
    }

    /// @dev Function that invokes changeState of Escrow after successful repayment
    /// @param _lenderAddress Escrow contract address
    function changeEscrowState(address _lenderAddress, bool whichState) public {
        Escrow(_lenderAddress).changeState(whichState);
    }

    /// @dev Function that changes state from MakeLoan to WaitForRepayment
    /// @param _lenderAddress Escrow contract address
    function changeStateToWaitForRepayment(address _lenderAddress) public {
        Escrow(_lenderAddress).setStateToWaitForRepayment();
    }

    /// @dev Function that updates the repaidValue of the Escrow
    /// @param _lenderAddress Escrow contract address
    /// @param _repaymentValue Amount of tokens repaid
    /// @param _shouldAdd Should the repaymentValue be added or subtracted?
    function updateRepaidValue(address _lenderAddress, uint256 _repaymentValue, bool _shouldAdd) public {
        Escrow(_lenderAddress).updateRepayment(_repaymentValue, _shouldAdd);
    }

}


pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract DebtKernel is Pausable {
    using SafeMath for uint;
    using AddressUtils for address;

    enum Errors {
        // Debt has been already been issued
        DEBT_ISSUED,
        // Order has already expired
        ORDER_EXPIRED,
        // Debt issuance associated with order has been cancelled
        ISSUANCE_CANCELLED,
        // Order has been cancelled
        ORDER_CANCELLED,
        // Order parameters specify amount of creditor / debtor fees
        // that is not equivalent to the amount of underwriter / relayer fees
        ORDER_INVALID_INSUFFICIENT_OR_EXCESSIVE_FEES,
        // Order parameters specify insufficient principal amount for
        // debtor to at least be able to meet his fees
        ORDER_INVALID_INSUFFICIENT_PRINCIPAL,
        // Order parameters specify non zero fee for an unspecified recipient
        ORDER_INVALID_UNSPECIFIED_FEE_RECIPIENT,
        // Order signatures are mismatched / malformed
        ORDER_INVALID_NON_CONSENSUAL,
        // Insufficient balance or allowance for principal token transfer
        CREDITOR_BALANCE_OR_ALLOWANCE_INSUFFICIENT
    }

    DebtToken public debtToken;
    EscrowRegistry public escrowRegistry;

    // solhint-disable-next-line var-name-mixedcase
    address public TOKEN_TRANSFER_PROXY;
    bytes32 constant public NULL_ISSUANCE_HASH = bytes32(0);

    /* NOTE(kayvon): Currently, the `view` keyword does not actually enforce the
    static nature of the method; this will change in the future, but for now, in
    order to prevent reentrancy we'll need to arbitrarily set an upper bound on
    the gas limit allotted for certain method calls. */
    uint16 constant public EXTERNAL_QUERY_GAS_LIMIT = 8000;

    mapping(bytes32 => bool) public issuanceCancelled;
    mapping(bytes32 => bool) public debtOrderCancelled;

    event LogDebtOrderFilled(
        bytes32 indexed _agreementId,
        uint _principal,
        address _principalToken,
        address indexed _underwriter,
        uint _underwriterFee,
        address indexed _relayer,
        uint _relayerFee
    );

    event Agreement(
        bytes32 indexed _agreementId,
        address indexed _lender,
        address indexed _borrower,
        uint _timestamp
    );

    event LogIssuanceCancelled(
        bytes32 indexed _agreementId,
        address indexed _cancelledBy
    );

    event LogDebtOrderCancelled(
        bytes32 indexed _debtOrderHash,
        address indexed _cancelledBy
    );

    event LogError(
        uint8 indexed _errorId,
        bytes32 indexed _orderHash,
        string where
    );

    struct Issuance {
        address version;
        address debtor;
        address underwriter;
        uint underwriterRiskRating;
        address termsContract;
        bytes32 termsContractParameters;
        uint salt;
        bytes32 agreementId;
    }

    struct DebtOrder {
        Issuance issuance;
        uint underwriterFee;
        uint relayerFee;
        uint principalAmount;
        address principalToken;
        uint creditorFee;
        uint debtorFee;
        address relayer;
        uint expirationTimestampInSec;
        bytes32 debtOrderHash;
    }

    constructor (address tokenTransferProxyAddress) public {
        TOKEN_TRANSFER_PROXY = tokenTransferProxyAddress;
    }

    ////////////////////////
    // EXTERNAL FUNCTIONS //
    ////////////////////////

    /**
     * Allows contract owner to set the currently used debt token contract.
     * Function exists to maximize upgradeability of individual modules
     * in the entire system.
     */
    function setDebtToken(address debtTokenAddress)
    public
    onlyOwner
    {
        debtToken = DebtToken(debtTokenAddress);
    }

    /**
    * Allows contract owner to set the currently used Borrower contract.
    * Function exists to maximize upgradeability of individual modules
    * in the entire system.
    */
    function setEscrowRegistry(address _escrowRegistry)
    public
    onlyOwner
    {
        escrowRegistry = EscrowRegistry(_escrowRegistry);
    }

    //solhint-disable-next-line max-line-length
    //TODO @balaji later remove getAgreeAndDebtHash(), returnUint(), assertDebtOrderValidityInvariantsPublic(), assertDebtOrderConsensualityInvariantsPublic()
    function getAgreeAndDebtHash(address[6] memory orderAddresses, uint[8] memory orderValues, bytes32[1] memory orderBytes32) public view returns (bytes32, bytes32, uint, uint) { //solhint-disable-line max-line-length
        DebtOrder memory debtOrder = getDebtOrder(orderAddresses, orderValues, orderBytes32);
        bytes32 agreementId = getAgreementId(debtOrder.issuance.version, debtOrder.issuance.debtor, debtOrder.issuance.underwriter, debtOrder.issuance.termsContract, debtOrder.issuance.underwriterRiskRating, debtOrder.issuance.salt, debtOrder.issuance.termsContractParameters);//solhint-disable-line max-line-length
        return (debtOrder.debtOrderHash, agreementId, debtOrder.principalAmount, debtOrder.debtorFee);
    }

    //TODO @balaji reminder below function is added to test registerTermStart() of SimpleInterestTermsContract.sol
    function invokeRegisterTermStart(bytes32 agreementId, address debtor, address termsContract) public returns (bool) {
        return TermsContract(termsContract).registerTermStart(agreementId, debtor);
    }

    function invokeRegisterTermStartCollateralize(bytes32 agreementId, address debtor, address termsContract) public payable returns (bool) {//solhint-disable-line max-line-length
        return TermsContract(termsContract).registerTermStart(agreementId, debtor);
    }

    function returnUint(bytes32 param) public pure returns (uint bytes32ToUint) {
        return uint(param);
    }
    event AB(uint256 a, uint256 b);
    /**
     * Fills a given debt order if it is valid and consensual.
     */
    //TODO @balaji pass on required argument to fillDebtOrder address guarantor
    //TODO @balaji change is on regitsterTermStart(agreementId, guarantor) . DONE
    function fillDebtOrder(
        address creditor,
        address guarantor,
        address[6] memory orderAddresses,
        uint[8] memory orderValues,
        bytes32[1] memory orderBytes32,
        uint8[3]  memory signaturesV,
        bytes32[3] memory signaturesR,
        bytes32[3] memory signaturesS
    )
    public
    whenNotPaused
    returns (bytes32 _agreementId)
    {
        DebtOrder memory debtOrder = getDebtOrder(orderAddresses, orderValues, orderBytes32);
        address guarantorOrDebtor = getGuarantorOrDebtor(guarantor, debtOrder.issuance.debtor);
        // Assert order's validity & consensuality
        if (!assertDebtOrderValidityInvariants(debtOrder) ||
        !assertDebtOrderConsensualityInvariants(
            debtOrder,
            creditor,
            signaturesV,
            signaturesR,
            signaturesS) ||
        !assertExternalBalanceAndAllowanceInvariants(creditor, debtOrder)) {
            return NULL_ISSUANCE_HASH;
        }

        // Mint debt token and finalize debt agreement
        issueDebtAgreement(creditor, debtOrder.issuance);
        // Register debt agreement's start with terms contract
        // We permit terms contracts to be undefined (for debt agreements which
        // may not have terms contracts associated with them), and only
        // register a term's start if the terms contract address is defined.
        if (debtOrder.issuance.termsContract != address(0)) {
            require(
                TermsContract(debtOrder.issuance.termsContract)
                .registerTermStart(
                    debtOrder.issuance.agreementId,
                    guarantorOrDebtor
                ), "in DebtKernel: fillDebtOrder(). Revert from registerTermStart"
            );
        }
        // Transfer principal to debtor
        if (debtOrder.principalAmount > 0) {
            require(transferTokensFrom(
                    debtOrder.principalToken,
                    creditor,
                    debtOrder.issuance.debtor,
                    debtOrder.principalAmount.sub(debtOrder.debtorFee)
                ), "in DebtKernel: fillDebtOrder(). Revert from transferTokensFrom Transfer principal to debtor");
        }

        // Transfer underwriter fee to underwriter
        if (debtOrder.underwriterFee > 0) {
            require(transferTokensFrom(
                    debtOrder.principalToken,
                    creditor,
                    debtOrder.issuance.underwriter,
                    debtOrder.underwriterFee
                ), "in DebtKernel: fillDebtOrder(). Revert from transferTokensFrom Transfer underwriter fee to underwriter");//solhint-disable-line max-line-length
            //solhint-disable-line max-line-length
            //solhint-disable-line max-line-length
        }

        // Transfer relayer fee to relayer
        if (debtOrder.relayerFee > 0) {
            require(transferTokensFrom(
                    debtOrder.principalToken,
                    creditor,
                    debtOrder.relayer,
                    debtOrder.relayerFee
                ), "in DebtKernel: fillDebtOrder(). Revert from transferTokensFrom Transfer relayer fee to relayer");
        }

        emit Agreement(
            debtOrder.issuance.agreementId,
            creditor,
            debtOrder.issuance.debtor,
            block.timestamp
        );

        emit LogDebtOrderFilled(
            debtOrder.issuance.agreementId,
            debtOrder.principalAmount,
            debtOrder.principalToken,
            debtOrder.issuance.underwriter,
            debtOrder.underwriterFee,
            debtOrder.relayer,
            debtOrder.relayerFee
        );

        return debtOrder.issuance.agreementId;
    }

    /**
     * Allows both underwriters and debtors to prevent a debt
     * issuance in which they're involved from being used in
     * a future debt order.
     */
    function cancelIssuance(
        address version,
        address debtor,
        address termsContract,
        bytes32 termsContractParameters,
        address underwriter,
        uint underwriterRiskRating,
        uint salt
    )
    public
    whenNotPaused
    {
        //solhint-disable-next-line max-line-length
        require(msg.sender == debtor || msg.sender == underwriter, "in DebtKernel:cancelIssuance(). Msg.sender is neither debtor nor underwriter.");

        Issuance memory issuance = getIssuance(
            version,
            debtor,
            underwriter,
            termsContract,
            underwriterRiskRating,
            salt,
            termsContractParameters
        );

        issuanceCancelled[issuance.agreementId] = true;

        emit LogIssuanceCancelled(issuance.agreementId, msg.sender);
    }

    /**
     * Allows a debtor to cancel a debt order before it's been filled
     * -- preventing any counterparty from filling it in the future.
     */
    function cancelDebtOrder(
        address[6] memory orderAddresses,
        uint[8] memory orderValues,
        bytes32[1] memory orderBytes32
    )
    public
    whenNotPaused
    {
        DebtOrder memory debtOrder = getDebtOrder(orderAddresses, orderValues, orderBytes32);
        //solhint-disable-next-line max-line-length
        require(msg.sender == debtOrder.issuance.debtor, "in DebtKernel:cancelDebtOrder(). Msg.sender is not debtOrder.issuance.debtor");

        debtOrderCancelled[debtOrder.debtOrderHash] = true;

        emit LogDebtOrderCancelled(debtOrder.debtOrderHash, msg.sender);
    }

    ////////////////////////
    // INTERNAL FUNCTIONS //
    ////////////////////////

    /**
    * Helper function that returns either the debtor or guarantor address
    * @param  guarantor address. The guarantor in this particular issuance.
    * @param  debtor address. The debtor in this particular issuance.
    */
    function getGuarantorOrDebtor(address guarantor, address debtor)
    internal
    pure
    returns (address)
    {
        if (guarantor == debtor) {
            return debtor;
        }
        return guarantor;
    }
    /**
     * Helper function that mints debt token associated with the
     * given issuance and grants it to the beneficiary.
     */
    function issueDebtAgreement(address beneficiary, Issuance memory issuance)
    internal
    returns (bytes32 _agreementId)
    {
        // Mint debt token and finalize debt agreement
        uint tokenId = debtToken.create(
            issuance.version,
            beneficiary,
            issuance.debtor,
            issuance.underwriter,
            issuance.underwriterRiskRating,
            issuance.termsContract,
            issuance.termsContractParameters,
            issuance.salt
        );

        assert(tokenId == uint(issuance.agreementId));

        return issuance.agreementId;
    }

    /**
     * Asserts that a debt order meets all consensuality requirements
     * described in the DebtKernel specification document.
     */
    function assertDebtOrderConsensualityInvariants(
        DebtOrder memory debtOrder,
        address creditor,
        uint8[3] memory signaturesV,
        bytes32[3] memory signaturesR,
        bytes32[3] memory signaturesS
    )
    internal
    returns (bool _orderIsConsensual)
    {
        // Invariant: debtor's signature must be valid, unless debtor is submitting order
        if (msg.sender != debtOrder.issuance.debtor) {
            // Invariant: Don't check debtor's signature, if debtor is a contract
            if (!debtOrder.issuance.debtor.isContract()) {
                if (!isValidSignature(
                    debtOrder.issuance.debtor,
                    debtOrder.debtOrderHash,
                    signaturesV[0],
                    signaturesR[0],
                    signaturesS[0]
                )) {
                    emit LogError(uint8(Errors.ORDER_INVALID_NON_CONSENSUAL), debtOrder.debtOrderHash, "from assertDebtOrderConsensualityInvariants 1");//solhint-disable-line max-line-length
                    return false;
                }
            } else if (!isAllowedToBorrow(debtOrder.issuance.debtor, debtOrder.principalAmount)) {
                emit LogError(
                    uint8(Errors.ORDER_INVALID_NON_CONSENSUAL),
                    debtOrder.debtOrderHash,
                    "from assertDebtOrderConsensualityInvariants 1.1"
                );
                return false;
            }
        }

        // Invariant: creditor's signature must be valid, unless creditor is submitting order
        if (msg.sender != creditor) {
            // Invariant: Don't check creditor's signature, if creditor is a contract
            if (!creditor.isContract()) {
                if (!isValidSignature(
                    creditor,
                    debtOrder.debtOrderHash,
                    signaturesV[1],
                    signaturesR[1],
                    signaturesS[1]
                )) {
                    emit LogError(uint8(Errors.ORDER_INVALID_NON_CONSENSUAL), debtOrder.debtOrderHash, "from assertDebtOrderConsensualityInvariants 2");//solhint-disable-line max-line-length
                    //solhint-disable-line max-line-length
                    return false;
                }
            } else {
                if (!canCreditorGrantLoan(creditor, debtOrder)) {
                    emit LogError(
                        uint8(Errors.ORDER_INVALID_NON_CONSENSUAL),
                        debtOrder.debtOrderHash,
                        "from assertDebtOrderConsensualityInvariants 2.1"
                    );
                    return false;
                }
            }
        }

        // Invariant: underwriter's signature must be valid (if present)
        if (debtOrder.issuance.underwriter != address(0) &&
        msg.sender != debtOrder.issuance.underwriter) {
            if (!isValidSignature(
                debtOrder.issuance.underwriter,
                getUnderwriterMessageHash(debtOrder),
                signaturesV[2],
                signaturesR[2],
                signaturesS[2]
            )) {
                emit LogError(uint8(Errors.ORDER_INVALID_NON_CONSENSUAL), debtOrder.debtOrderHash, "from assertDebtOrderConsensualityInvariants 3");//solhint-disable-line max-line-length
                //solhint-disable-line max-line-length
                //solhint-disable-line max-line-length
                return false;
            }
        }

        return true;
    }

    /**
    * Function that checks whether a debtor can borrow or not
    */
    function isAllowedToBorrow(address _borrower, uint256 _principalAmount) internal returns (bool) {
        bool canBorrow = escrowRegistry.isAllowedToBorrow(_borrower);
        if (canBorrow) {
            escrowRegistry.setLoanAmountThroughEscrowRegistry(_borrower, _principalAmount);
        }
        return canBorrow;
    }

    /**
    * Function that checks whether a creditor can grant a loan or not
    */
    function canCreditorGrantLoan(address _creditor, DebtOrder memory debtOrder) internal returns (bool) {
        bool canGrantLoan = false;
        canGrantLoan = escrowRegistry.canCreditorGrantLoan(_creditor);
        if (canGrantLoan) {
            escrowRegistry.changeStateToWaitForRepayment(_creditor);
        }
        return canGrantLoan;
    }

    /**
     * Asserts that debt order meets all validity requirements described in
     * the DebtKernel specification document.
     */
    function assertDebtOrderValidityInvariants(DebtOrder memory debtOrder)
    internal
    returns (bool _orderIsValid) {
        uint totalFees = debtOrder.creditorFee.add(debtOrder.debtorFee);
        // Invariant: the total value of fees contributed by debtors and creditors
        //  must be equivalent to that paid out to underwriters and relayers.
        if (totalFees != debtOrder.relayerFee.add(debtOrder.underwriterFee)) {
            emit LogError(uint8(Errors.ORDER_INVALID_INSUFFICIENT_OR_EXCESSIVE_FEES), debtOrder.debtOrderHash, "from assertDebtOrderValidityInvariants 1");//solhint-disable-line max-line-length
            //solhint-disable-line max-line-length
            return false;
        }

        // require(debtOrder.principalAmount < debtOrder.debtorFee, "principal amount is greater than debtorFee");
        // Invariant: debtor is given enough principal to cover at least debtorFees
        if (debtOrder.principalAmount < debtOrder.debtorFee) {
            emit LogError(uint8(Errors.ORDER_INVALID_INSUFFICIENT_PRINCIPAL), debtOrder.debtOrderHash, "from assertDebtOrderValidityInvariants 2");//solhint-disable-line max-line-length
            //solhint-disable-line max-line-length
            return false;
        }

        // Invariant: if no underwriter is specified, underwriter fees must be 0
        // Invariant: if no relayer is specified, relayer fees must be 0.
        //      Given that relayer fees = total fees - underwriter fees,
        //      we assert that total fees = underwriter fees.
        if ((debtOrder.issuance.underwriter == address(0) && debtOrder.underwriterFee > 0) ||
            (debtOrder.relayer == address(0) && totalFees != debtOrder.underwriterFee)) {
            emit LogError(uint8(Errors.ORDER_INVALID_UNSPECIFIED_FEE_RECIPIENT), debtOrder.debtOrderHash, "from assertDebtOrderValidityInvariants 3");//solhint-disable-line max-line-length
            //solhint-disable-line max-line-length
            return false;
        }

        // Invariant: debt order must not be expired
        // solhint-disable-next-line not-rely-on-time
        if (debtOrder.expirationTimestampInSec < block.timestamp) {
            emit LogError(uint8(Errors.ORDER_EXPIRED), debtOrder.debtOrderHash, "from assertDebtOrderValidityInvariants 4");//solhint-disable-line max-line-length
            //solhint-disable-line max-line-length
            return false;
        }

        // Invariant: debt order's issuance must not already be minted as debt token
        if (debtToken.exists(uint(debtOrder.issuance.agreementId))) {
            emit LogError(uint8(Errors.DEBT_ISSUED), debtOrder.debtOrderHash, "from assertDebtOrderValidityInvariants 5");//solhint-disable-line max-line-length
            //solhint-disable-line max-line-length
            return false;
        }

        // Invariant: debt order's issuance must not have been cancelled
        if (issuanceCancelled[debtOrder.issuance.agreementId]) {
            emit LogError(uint8(Errors.ISSUANCE_CANCELLED), debtOrder.debtOrderHash, "from assertDebtOrderValidityInvariants 6");//solhint-disable-line max-line-length
            //solhint-disable-line max-line-length
            return false;
        }

        // Invariant: debt order itself must not have been cancelled
        if (debtOrderCancelled[debtOrder.debtOrderHash]) {
            emit LogError(uint8(Errors.ORDER_CANCELLED), debtOrder.debtOrderHash, "from assertDebtOrderValidityInvariants 7");//solhint-disable-line max-line-length
            //solhint-disable-line max-line-length
            return false;
        }

        return true;
    }

    /**
     * Assert that the creditor has a sufficient token balance and has
     * granted the token transfer proxy contract sufficient allowance to suffice for the principal
     * and creditor fee.
     */
    function assertExternalBalanceAndAllowanceInvariants(
        address creditor,
        DebtOrder memory debtOrder
    )
    internal
    returns (bool _isBalanceAndAllowanceSufficient)
    {
        uint totalCreditorPayment = debtOrder.principalAmount.add(debtOrder.creditorFee);

        if (getBalance(debtOrder.principalToken, creditor) < totalCreditorPayment ||
            getAllowance(debtOrder.principalToken, creditor) < totalCreditorPayment) {
            emit LogError(uint8(Errors.CREDITOR_BALANCE_OR_ALLOWANCE_INSUFFICIENT), debtOrder.debtOrderHash, "from assertExternalBalanceAndAllowanceInvariants 1");//solhint-disable-line max-line-length
            //solhint-disable-line max-line-length
            return false;
        }

        return true;
    }

    /**
     * Helper function transfers a specified amount of tokens between two parties
     * using the token transfer proxy contract.
     */
    function transferTokensFrom(
        address token,
        address from,
        address to,
        uint amount
    )
    internal
    returns (bool success)
    {
        return TokenTransferProxy(TOKEN_TRANSFER_PROXY).transferFrom(
            token,
            from,
            to,
            amount
        );
    }

    /**
     * Helper function that constructs a hashed issuance structs from the given
     * parameters.
     */
    function getIssuance(
        address version,
        address debtor,
        address underwriter,
        address termsContract,
        uint underwriterRiskRating,
        uint salt,
        bytes32 termsContractParameters
    )
    internal
    pure
    returns (Issuance memory _issuance)
    {
        Issuance memory issuance = Issuance({
            version : version,
            debtor : debtor,
            underwriter : underwriter,
            termsContract : termsContract,
            underwriterRiskRating : underwriterRiskRating,
            salt : salt,
            termsContractParameters : termsContractParameters,
            agreementId : getAgreementId(
                version,
                debtor,
                underwriter,
                termsContract,
                underwriterRiskRating,
                salt,
                termsContractParameters
            )
        });
        return issuance;
    }

    /**
     * Helper function that constructs a hashed debt order struct given the raw parameters
     * of a debt order.
     */
    function getDebtOrder(address[6] memory orderAddresses, uint[8] memory orderValues, bytes32[1] memory orderBytes32)
    internal
    view
    returns (DebtOrder memory _debtOrder)
    {
        DebtOrder memory debtOrder = DebtOrder({
            issuance : getIssuance(
            orderAddresses[0],
            orderAddresses[1],
            orderAddresses[2],
            orderAddresses[3],
            orderValues[0],
            orderValues[1],
            orderBytes32[0]
            ),
            principalToken : orderAddresses[4],
            relayer : orderAddresses[5],
            principalAmount : orderValues[2],
            underwriterFee : orderValues[3],
            relayerFee : orderValues[4],
            creditorFee : orderValues[5],
            debtorFee : orderValues[6],
            expirationTimestampInSec : orderValues[7],
            debtOrderHash : bytes32(0)
        });
        debtOrder.debtOrderHash = getDebtOrderHash(debtOrder);
        return debtOrder;
    }

    /**
     * Helper function that returns an issuance's hash
     */
    function getAgreementId(
        address version,
        address debtor,
        address underwriter,
        address termsContract,
        uint underwriterRiskRating,
        uint salt,
        bytes32 termsContractParameters
    )
    internal
    pure
    returns (bytes32 _agreementId)
    {
        return keccak256(abi.encodePacked(
                version,
                debtor,
                underwriter,
                underwriterRiskRating,
                termsContract,
                termsContractParameters,
                salt
            ));
    }

    /**
     * Returns the hash of the parameters which an underwriter is supposed to sign
     */
    function getUnderwriterMessageHash(DebtOrder memory debtOrder)
    internal
    view
    returns (bytes32 _underwriterMessageHash)
    {
        return keccak256(abi.encodePacked(
                address(this),
                debtOrder.issuance.agreementId,
                debtOrder.underwriterFee,
                debtOrder.principalAmount,
                debtOrder.principalToken,
                debtOrder.expirationTimestampInSec
            ));
    }

    /**
     * Returns the hash of the debt order.
     */
    function getDebtOrderHash(DebtOrder memory debtOrder)
    internal
    view
    returns (bytes32 _debtorMessageHash)
    {
        return keccak256(abi.encodePacked(
                address(this),
                debtOrder.issuance.agreementId,
                debtOrder.underwriterFee,
                debtOrder.principalAmount,
                debtOrder.principalToken,
                debtOrder.debtorFee,
                debtOrder.creditorFee,
                debtOrder.relayer,
                debtOrder.relayerFee,
                debtOrder.expirationTimestampInSec
            ));
    }

    /**
     * Given a hashed message, a signer's address, and a signature, returns
     * whether the signature is valid.
     */
    function isValidSignature(
        address signer,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
    internal
    pure
    returns (bool _valid)
    {
        return signer == ecrecover(
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)),
            v,
            r,
            s
        );
    }

    /**
     * Helper function for querying an address' balance on a given token.
     */
    function getBalance(
        address token,
        address owner
    )
    internal
    returns (uint _balance)
    {
        // Limit gas to prevent re-entrancy.
        return ERC20(token).balanceOf.gas(EXTERNAL_QUERY_GAS_LIMIT)(owner);
    }

    /**
     * Helper function for querying an address' allowance to the 0x transfer proxy.
     */
    function getAllowance(
        address token,
        address owner
    )
    internal
    returns (uint _allowance)
    {
        // Limit gas to prevent reentrancy.
        return ERC20(token).allowance.gas(EXTERNAL_QUERY_GAS_LIMIT)(owner, TOKEN_TRANSFER_PROXY);
    }

}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract TokenRegistry is Ownable {
    mapping (bytes32 => TokenAttributes) public symbolHashToTokenAttributes;
    string[256] public tokenSymbolList;
    uint8 public tokenSymbolListLength;

    struct TokenAttributes {
        // The ERC20 contract address.
        address tokenAddress;
        // The index in `tokenSymbolList` where the token's symbol can be found.
        uint tokenIndex;
        // The name of the given token, e.g. "Canonical Wrapped Ether"
        string name;
        // The number of digits that come after the decimal place when displaying token value.
        uint8 numDecimals;
    }

    /**
     * Maps the given symbol to the given token attributes.
     */
    function setTokenAttributes(
        string memory _symbol,
        address _tokenAddress,
        string memory _tokenName,
        uint8 _numDecimals
    )
    public onlyOwner
    {
        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));

        // Attempt to retrieve the token's attributes from the registry.
        TokenAttributes memory attributes = symbolHashToTokenAttributes[symbolHash];

        if (attributes.tokenAddress == address(0)) {
            // The token has not yet been added to the registry.
            attributes.tokenAddress = _tokenAddress;
            attributes.numDecimals = _numDecimals;
            attributes.name = _tokenName;
            attributes.tokenIndex = tokenSymbolListLength;

            tokenSymbolList[tokenSymbolListLength] = _symbol;
            tokenSymbolListLength++;
        } else {
            // The token has already been added to the registry; update attributes.
            attributes.tokenAddress = _tokenAddress;
            attributes.numDecimals = _numDecimals;
            attributes.name = _tokenName;
        }

        // Update this contract's storage.
        symbolHashToTokenAttributes[symbolHash] = attributes;
    }

    /**
     * Given a symbol, resolves the current address of the token the symbol is mapped to.
     */
    function getTokenAddressBySymbol(string memory _symbol) public view returns (address) {
        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));

        TokenAttributes storage attributes = symbolHashToTokenAttributes[symbolHash];

        return attributes.tokenAddress;
    }

    /**
     * Given the known index of a token within the registry's symbol list,
     * returns the address of the token mapped to the symbol at that index.
     *
     * This is a useful utility for compactly encoding the address of a token into a
     * TermsContractParameters string -- by encoding a token by its index in a
     * a 256 slot array, we can represent a token by a 1 byte uint instead of a 20 byte address.
     */
    function getTokenAddressByIndex(uint _index) public view returns (address) {
        string storage symbol = tokenSymbolList[_index];

        return getTokenAddressBySymbol(symbol);
    }

    /**
     * Given a symbol, resolves the index of the token the symbol is mapped to within the registry's
     * symbol list.
     */
    function getTokenIndexBySymbol(string memory _symbol) public view returns (uint) {
        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));

        TokenAttributes storage attributes = symbolHashToTokenAttributes[symbolHash];

        return attributes.tokenIndex;
    }

    /**
     * Given an index, resolves the symbol of the token at that index in the registry's
     * token symbol list.
     */
    function getTokenSymbolByIndex(uint _index) public view returns (string memory) {
        return tokenSymbolList[_index];
    }

    /**
     * Given a symbol, returns the name of the token the symbol is mapped to within the registry's
     * symbol list.
     */
    function getTokenNameBySymbol(string memory _symbol) public view returns (string memory) {
        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));

        TokenAttributes storage attributes = symbolHashToTokenAttributes[symbolHash];

        return attributes.name;
    }

    /**
     * Given the symbol for a token, returns the number of decimals as provided in
     * the associated TokensAttribute struct.
     *
     * Example:
     *   getNumDecimalsFromSymbol("REP");
     *   => 18
     */
    function getNumDecimalsFromSymbol(string memory _symbol) public view returns (uint8) {
        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));

        TokenAttributes storage attributes = symbolHashToTokenAttributes[symbolHash];

        return attributes.numDecimals;
    }

    /**
     * Given the index for a token in the registry, returns the number of decimals as provided in
     * the associated TokensAttribute struct.
     *
     * Example:
     *   getNumDecimalsByIndex(1);
     *   => 18
     */
    function getNumDecimalsByIndex(uint _index) public view returns (uint8) {
        string memory symbol = getTokenSymbolByIndex(_index);

        return getNumDecimalsFromSymbol(symbol);
    }

    /**
     * Given the index for a token in the registry, returns the name of the token as provided in
     * the associated TokensAttribute struct.
     *
     * Example:
     *   getTokenNameByIndex(1);
     *   => "Canonical Wrapped Ether"
     */
    function getTokenNameByIndex(uint _index) public view returns (string memory) {
        string memory symbol = getTokenSymbolByIndex(_index);

        string memory tokenName = getTokenNameBySymbol(symbol);

        return tokenName;
    }

    /**
     * Given the symbol for a token in the registry, returns a tuple containing the token's address,
     * the token's index in the registry, the token's name, and the number of decimals.
     *
     * Example:
     *   getTokenAttributesBySymbol("WETH");
     *   => ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", 1, "Canonical Wrapped Ether", 18]
     */
    function getTokenAttributesBySymbol(string memory _symbol)
    public
    view
    returns (
        address,
        uint,
        string memory,
        uint
    )
    {
        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));

        TokenAttributes storage attributes = symbolHashToTokenAttributes[symbolHash];

        return (
        attributes.tokenAddress,
        attributes.tokenIndex,
        attributes.name,
        attributes.numDecimals
        );
    }

    /**
     * Given the index for a token in the registry, returns a tuple containing the token's address,
     * the token's symbol, the token's name, and the number of decimals.
     *
     * Example:
     *   getTokenAttributesByIndex(1);
     *   => ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "WETH", "Canonical Wrapped Ether", 18]
     */
    function getTokenAttributesByIndex(uint _index)
    public
    view
    returns (
        address,
        string memory,
        string memory,
        uint8
    )
    {
        string memory symbol = getTokenSymbolByIndex(_index);

        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));

        TokenAttributes storage attributes = symbolHashToTokenAttributes[symbolHash];

        return (
        attributes.tokenAddress,
        symbol,
        attributes.name,
        attributes.numDecimals
        );
    }
}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract CollateralizedSimpleInterestTermsContract is SimpleInterestTermsContract {

    constructor (
        address contractRegistry
    ) public SimpleInterestTermsContract(contractRegistry) {}

    function registerTermStart(
        bytes32 agreementId,
        address guarantorOrDebtor
    )
    public
    onlyDebtKernel
    returns (bool _success)
    {
        bool registered = super.registerTermStart(agreementId, guarantorOrDebtor);
        bool collateralized = contractRegistry.collateralizer().collateralize(agreementId, guarantorOrDebtor);

        return registered && collateralized;
    }

    function getTermEndTimestamp(
        bytes32 _agreementId
    )
    public
    returns (uint)
    {
        SimpleInterestParams memory params = unpackParamsForAgreementID(_agreementId);

        return params.termEndUnixTimestamp;
    }

}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract Collateralizer is Pausable, PermissionEvents {
    using PermissionsLib for PermissionsLib.Permissions;
    using SafeMath for uint;

    address public debtKernelAddress;

    DebtRegistry public debtRegistry;
    TokenRegistry public tokenRegistry;
    TokenTransferProxy public tokenTransferProxy;

    // Collateralizer here refers to the owner of the asset that is being collateralized.
    mapping(bytes32 => address) public agreementToCollateralizer;

    mapping(bytes32 => CollateralInfo) public collateralDetails;

    enum States { LOCKED, RETURNED, SEIZED }

    struct CollateralInfo {
        address collateralizer;
        uint256 collateralAmount;
        States state;
    }

    PermissionsLib.Permissions internal collateralizationPermissions;

    uint public constant SECONDS_IN_DAY = 24*60*60;

    string public constant CONTEXT = "collateralizer";

    event CollateralLocked(
        bytes32 indexed agreementID,
        address indexed token,
        uint amount,
        uint timestamp
    );

    event CollateralReturned(
        bytes32 indexed agreementID,
        address indexed collateralizer,
        address token,
        uint amount,
        uint timestamp
    );

    event CollateralSeized(
        bytes32 indexed agreementID,
        address indexed beneficiary,
        address token,
        uint amount,
        uint timestamp
    );

    modifier onlyAuthorizedToCollateralize() {
        require(collateralizationPermissions.isAuthorized(msg.sender));
        _;
    }

    constructor (
        address _debtKernel,
        address _debtRegistry,
        address _tokenRegistry,
        address _tokenTransferProxy
    ) public {
        debtKernelAddress = _debtKernel;
        debtRegistry = DebtRegistry(_debtRegistry);
        tokenRegistry = TokenRegistry(_tokenRegistry);
        tokenTransferProxy = TokenTransferProxy(_tokenTransferProxy);
    }

    /**
     * Transfers collateral from the debtor to the current contract, as custodian.
     *
     * @param agreementId bytes32 The debt agreement's ID

     * @param collateralizer address The owner of the asset being collateralized
     */
    function collateralize(
        bytes32 agreementId,
        address collateralizer
    )
    public
    onlyAuthorizedToCollateralize
    whenNotPaused
    returns (bool _success)
    {
        // The token in which collateral is denominated
        address collateralToken;
        // The amount being put up for collateral
        uint collateralAmount;
        // The number of days a debtor has after a debt enters default
        // before their collateral is eligible for seizure.
        uint gracePeriodInDays;
        // The terms contract according to which this asset is being collateralized.
        CollateralizedSimpleInterestTermsContract termsContract;

        // Fetch all relevant collateralization parameters
        (
        collateralToken, //This is returned 0
        collateralAmount, //This is returned
        gracePeriodInDays, //This is returned
        termsContract // This is returned as the myTermsContract address
        ) = retrieveCollateralParameters(agreementId);

        require(address(termsContract) == msg.sender, 
        "in Collateralize: collaterize(). termsContract is not the msg.sender");
        require(collateralAmount > 0, "in Collateralize: collaterize(). CollateralAmount is not > 0"); //solhint-disable-line max-line-length
        require(collateralToken != address(0), "in Collateralize: collaterize(). collateralToken is address(0)");

        /*
        Ensure that the agreement has not already been collateralized.

        If the agreement has already been collateralized, this check will fail
        because any valid collateralization must have some sort of valid
        address associated with it as a collateralizer.  Given that it is impossible
        to send transactions from address 0x0, this check will only fail
        when the agreement is already collateralized.
        */
        require(agreementToCollateralizer[agreementId] == address(0), "in Collateralize: collaterize(). Agreement has already been collateralized.");//solhint-disable-line max-line-length

        ERC20 erc20token = ERC20(collateralToken);
        address custodian = address(this);

        /*
        The collateralizer must have sufficient balance equal to or greater
        than the amount being put up for collateral.
        */
        require(erc20token.balanceOf(collateralizer) >= collateralAmount, "in Collateralize: collaterize(). Insufficient collateralizer balance");//solhint-disable-line max-line-length

        /*
        The proxy must have an allowance granted by the collateralizer equal
        to or greater than the amount being put up for collateral.
        */
        require(erc20token.allowance(collateralizer, address(tokenTransferProxy)) >= collateralAmount, "in Collateralize: collaterize(). Insufficient proxy allowance.");//solhint-disable-line max-line-length

        // store collaterallizer in mapping, effectively demarcating that the
        // agreement is now collateralized.
        agreementToCollateralizer[agreementId] = collateralizer;

        // the collateral must be successfully transferred to this contract, via a proxy.
        require(tokenTransferProxy.transferFrom(
                address(erc20token),
                collateralizer,
                custodian,
                collateralAmount
            ), "in Collateralize: collaterize(). Revert from tokenTransferProxy.transferFrom()");

        CollateralInfo storage collateral = collateralDetails[agreementId];
        collateral.collateralizer = collateralizer;
        collateral.collateralAmount = collateralAmount;
        collateral.state = States.LOCKED;

        // emit event that collateral has been secured.
        emit CollateralLocked(agreementId, collateralToken, collateralAmount, block.timestamp);

        return true;
    }

    /**
     * Returns collateral to the debt agreement's original collateralizer
     * if and only if the debt agreement's term has lapsed and
     * the total expected repayment value has been repaid.
     *
     * @param agreementId bytes32 The debt agreement's ID
     */
    function returnCollateral(
        bytes32 agreementId
    )
    public
    whenNotPaused
    {
        // The token in which collateral is denominated
        address collateralToken;
        // The amount being put up for collateral
        uint collateralAmount;
        // The number of days a debtor has after a debt enters default
        // before their collateral is eligible for seizure.
        uint gracePeriodInDays;
        // The terms contract according to which this asset is being collateralized.
        CollateralizedSimpleInterestTermsContract termsContract;

        // Fetch all relevant collateralization parameters.
        (
        collateralToken,
        collateralAmount,
        gracePeriodInDays,
        termsContract
        ) = retrieveCollateralParameters(agreementId);

        // Ensure a valid form of collateral is tied to this agreement id
        require(collateralAmount > 0, "in Collateralize: returnCollateral(). CollateralAmount is less than 0");
        require(collateralToken != address(0), "in Collateralize: returnCollateral(). collateralToken is address(0)");

        // Withdrawal can only occur if the collateral has yet to be withdrawn.
        // When we withdraw collateral, we reset the collateral agreement
        // in a gas-efficient manner by resetting the address of the collateralizer to 0
        require(agreementToCollateralizer[agreementId] != address(0), "in Collateralize: returnCollateral(). Collateral has already been withdrawn"); //solhint-disable-line max-line-length

        // Ensure that the debt is not in a state of default
        require(
            termsContract.getExpectedRepaymentValue(
                agreementId,
                termsContract.getTermEndTimestamp(agreementId)
            ) <= termsContract.getValueRepaidToDate(agreementId)
        , "in Collateralize: returnCollateral(). Debt is in default state"
        );

        // determine collateralizer of the collateral.
        address collateralizer = agreementToCollateralizer[agreementId];

        // Mark agreement's collateral as withdrawn by setting the agreement's
        // collateralizer to 0x0.
        delete agreementToCollateralizer[agreementId];

        // transfer the collateral this contract was holding in escrow back to collateralizer.
        require(
            ERC20(collateralToken).transfer(
                collateralizer,
                collateralAmount
            )
        , "in Collateralize: returnCollateral(). Transfer failed."
        );

        CollateralInfo storage collateral = collateralDetails[agreementId];
        collateral.state = States.RETURNED;

        // log the return event.
        emit CollateralReturned(
            agreementId,
            collateralizer,
            collateralToken,
            collateralAmount,
            block.timestamp
        );
    }

    /**
     * Seizes the collateral from the given debt agreement and
     * transfers it to the debt agreement's current beneficiary
     * (i.e. the person who "owns" the debt).
     *
     * @param agreementId bytes32 The debt agreement's ID
     */
    function seizeCollateral(
        bytes32 agreementId
    )
    public
    whenNotPaused
    {

        // The token in which collateral is denominated
        address collateralToken;
        // The amount being put up for collateral
        uint collateralAmount;
        // The number of days a debtor has after a debt enters default
        // before their collateral is eligible for seizure.
        uint gracePeriodInDays;
        // The terms contract according to which this asset is being collateralized.
        CollateralizedSimpleInterestTermsContract termsContract;

        // Fetch all relevant collateralization parameters
        (
        collateralToken,
        collateralAmount,
        gracePeriodInDays,
        termsContract
        ) = retrieveCollateralParameters(agreementId);

        // Ensure a valid form of collateral is tied to this agreement id
        require(collateralAmount > 0, "in Collateralize: seizeCollateral(). CollateralAmount is not > 0");
        require(collateralToken != address(0), "in Collateralize: seizeCollateral(). collateralToken is address(0)");

        // Seizure can only occur if the collateral has yet to be withdrawn.
        // When we withdraw collateral, we reset the collateral agreement
        // in a gas-efficient manner by resetting the address of the collateralizer to 0
        require(agreementToCollateralizer[agreementId] != address(0), "in Collateralize: seizeCollateral(). Collateral has already been withdrawn");//solhint-disable-line max-line-length

        // Ensure debt is in a state of default when we account for the
        // specified "grace period".  We do this by checking whether the
        // *current* value repaid to-date exceeds the expected repayment value
        // at the point of time at which the grace period would begin if it ended
        // now.  This crucially relies on the assumption that both expected repayment value
        /// and value repaid to date monotonically increase over time
        require(
            termsContract.getExpectedRepaymentValue(
                agreementId,
                timestampAdjustedForGracePeriod(gracePeriodInDays)
            ) > termsContract.getValueRepaidToDate(agreementId)
        , "in Collateralize: seizeCollateral(). Debt is in default state"
        );

        // Mark agreement's collateral as withdrawn by setting the agreement's
        // collateralizer to 0x0.
        delete agreementToCollateralizer[agreementId];

        // determine beneficiary of the seized collateral.
        address beneficiary = debtRegistry.getBeneficiary(agreementId);

        // transfer the collateral this contract was holding in escrow to beneficiary.
        require(
            ERC20(collateralToken).transfer(
                beneficiary,
                collateralAmount
            )
        , "in Collateralize: seizeCollateral(). Transfer failed."
        );

        CollateralInfo storage collateral = collateralDetails[agreementId];
        collateral.state = States.SEIZED;

        // log the seizure event.
        emit CollateralSeized(
            agreementId,
            beneficiary,
            collateralToken,
            collateralAmount,
            block.timestamp
        );
    }
    /**
    * Function that gets the details about the collateral, whether collateral is in lock state or seized or returned
    */
    /*struct CollateralInfo {
        address collateralizer;
        uint256 collateralAmount;
        States state;
    }*/
    function getCollateralDetails(bytes32 agreementId)
    public
    view
    returns (address, uint256, uint8)
    {
        CollateralInfo memory collateral = collateralDetails[agreementId];
        return(
        collateral.collateralizer,
        collateral.collateralAmount,
        uint8(collateral.state)
        );
    }
    /**
     * Adds an address to the list of agents authorized
     * to invoke the `collateralize` function.
     */
    function addAuthorizedCollateralizeAgent(address agent)
    public
    onlyOwner
    {
        collateralizationPermissions.authorize(agent, CONTEXT);
    }

    /**
     * Removes an address from the list of agents authorized
     * to invoke the `collateralize` function.
     */
    function revokeCollateralizeAuthorization(address agent)
    public
    onlyOwner
    {
        collateralizationPermissions.revokeAuthorization(agent, CONTEXT);
    }

    /**
    * Returns the list of agents authorized to invoke the 'collateralize' function.
    */
    function getAuthorizedCollateralizeAgents()
    public
    view
    returns(address[] memory)
    {
        return collateralizationPermissions.getAuthorizedAgents();
    }

    /**
     * Unpacks collateralization-specific parameters from their tightly-packed
     * representation in a terms contract parameter string.
     *
     * For collateralized terms contracts, we reserve the lowest order 108 bits
     * of the terms contract parameters for parameters relevant to collateralization.
     *
     * Contracts that inherit from the Collateralized terms contract
     * can encode whichever parameter schema they please in the remaining
     * space of the terms contract parameters.
     * The 108 bits are encoded as follows (from higher order bits to lower order bits):
     *
     * 8 bits - Collateral Token (encoded by its unsigned integer index in the TokenRegistry contract)
     * 92 bits - Collateral Amount (encoded as an unsigned integer)
     * 8 bits - Grace Period* Length (encoded as an unsigned integer)
     *
     * * = The "Grace" Period is the number of days a debtor has between
     *      when they fall behind on an expected payment and when their collateral
     *      can be seized by the creditor.
     */
    function unpackCollateralParametersFromBytes(bytes32 parameters)
    public
    pure
    returns (uint, uint, uint)
    {
        // The first byte of the 108 reserved bits represents the collateral token.
        bytes32 collateralTokenIndexShifted =
        parameters & 0x0000000000000000000000000000000000000ff0000000000000000000000000;
        // The subsequent 92 bits represents the collateral amount, as denominated in the above token.
        bytes32 collateralAmountShifted =
        parameters & 0x000000000000000000000000000000000000000fffffffffffffffffffffff00;

        // We bit-shift these values, respectively, 100 bits and 8 bits right using
        // mathematical operations, so that their 32 byte integer counterparts
        // correspond to the intended values packed in the 32 byte string
        uint collateralTokenIndex = uint(collateralTokenIndexShifted) / 2 ** 100;
        uint collateralAmount = uint(collateralAmountShifted) / 2 ** 8;

        // The last byte of the parameters represents the "grace period" of the loan,
        // as defined in terms of days.
        // Since this value takes the rightmost place in the parameters string,
        // we do not need to bit-shift it.
        bytes32 gracePeriodInDays =
        parameters & 0x00000000000000000000000000000000000000000000000000000000000000ff;

        return (
        collateralTokenIndex,
        collateralAmount,
        uint(gracePeriodInDays)
        );
    }

    function timestampAdjustedForGracePeriod(uint gracePeriodInDays)
    public
    view
    returns (uint)
    {
        return block.timestamp.sub(
            SECONDS_IN_DAY.mul(gracePeriodInDays)
        );
    }

    function retrieveCollateralParameters(bytes32 agreementId)
    internal
    view
    returns (
        address _collateralToken,
        uint _collateralAmount,
        uint _gracePeriodInDays,
        CollateralizedSimpleInterestTermsContract  _termsContract
    )
    {
        address termsContractAddress;
        bytes32 termsContractParameters;

        // Pull the terms contract and associated parameters for the agreement
        (termsContractAddress, termsContractParameters) = debtRegistry.getTerms(agreementId);

        uint collateralTokenIndex;
        uint collateralAmount;
        uint gracePeriodInDays;

        // Unpack terms contract parameters in order to get collateralization-specific params
        (
        collateralTokenIndex,
        collateralAmount,
        gracePeriodInDays
        ) = unpackCollateralParametersFromBytes(termsContractParameters); //solhint-disable-line max-line-length

        // Resolve address of token associated with this agreement in token registry
        address collateralTokenAddress = tokenRegistry.getTokenAddressByIndex(collateralTokenIndex);

        return (
        collateralTokenAddress,
        collateralAmount,
        gracePeriodInDays,
        CollateralizedSimpleInterestTermsContract(termsContractAddress)
        );
    }
}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract BasicToken is ERC20Basic {
    using SafeMath for uint256;

    mapping(address => uint256) internal balances;

    uint256 internal totalSupply_;

    /**
    * @dev Total number of tokens in existence
    */
    function totalSupply() public view returns (uint256) {
        return totalSupply_;
    }

    /**
    * @dev Transfer token for a specified address
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public returns (bool) {
        require(_value <= balances[msg.sender], "in BasicToken:transfer(). Value is greater than balance.");
        require(_to != address(0), "in BasicToken:transfer(). To address is address(0)");

        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    /**
    * @dev Gets the balance of the specified address.
    * @param _owner The address to query the the balance of.
    * @return An uint256 representing the amount owned by the passed address.
    */
    function balanceOf(address _owner) public view returns (uint256) {
        return balances[_owner];
    }

}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract StandardToken is ERC20, BasicToken {

    mapping(address => mapping(address => uint256)) internal allowed;


    /**
     * @dev Transfer tokens from one address to another
     * @param _from address The address which you want to send tokens from
     * @param _to address The address which you want to transfer to
     * @param _value uint256 the amount of tokens to be transferred
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    )
    public
    returns (bool)
    {
        require(_value <= balances[_from], "in StandardToken:transferFrom(). Insufficient Balance");
        require(_value <= allowed[_from][msg.sender], "in StandardToken:transferFrom(). Insufficient Allowance");
        require(_to != address(0), "in StandardToken:transferFrom(). Destination address(0)");

        balances[_from] = balances[_from].sub(_value);
        balances[_to] = balances[_to].add(_value);
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        emit Transfer(_from, _to, _value);
        return true;
    }

    /**
     * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
     * Beware that changing an allowance with this method brings the risk that someone may use both the old
     * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
     * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     * @param _spender The address which will spend the funds.
     * @param _value The amount of tokens to be spent.
     */
    function approve(address _spender, uint256 _value) public returns (bool) {
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
     * @dev Function to check the amount of tokens that an owner allowed to a spender.
     * @param _owner address The address which owns the funds.
     * @param _spender address The address which will spend the funds.
     * @return A uint256 specifying the amount of tokens still available for the spender.
     */
    function allowance(
        address _owner,
        address _spender
    )
    public
    view
    returns (uint256)
    {
        return allowed[_owner][_spender];
    }

    /**
     * @dev Increase the amount of tokens that an owner allowed to a spender.
     * approve should be called when allowed[_spender] == 0. To increment
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * @param _spender The address which will spend the funds.
     * @param _addedValue The amount of tokens to increase the allowance by.
     */
    function increaseApproval(
        address _spender,
        uint256 _addedValue
    )
    public
    returns (bool)
    {
        allowed[msg.sender][_spender] = (
        allowed[msg.sender][_spender].add(_addedValue));
        emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
        return true;
    }

    /**
     * @dev Decrease the amount of tokens that an owner allowed to a spender.
     * approve should be called when allowed[_spender] == 0. To decrement
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * @param _spender The address which will spend the funds.
     * @param _subtractedValue The amount of tokens to decrease the allowance by.
     */
    function decreaseApproval(
        address _spender,
        uint256 _subtractedValue
    )
    public
    returns (bool)
    {
        uint256 oldValue = allowed[msg.sender][_spender];
        if (_subtractedValue >= oldValue) {
            allowed[msg.sender][_spender] = 0;
        } else {
            allowed[msg.sender][_spender] = oldValue.sub(_subtractedValue);
        }
        emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
        return true;
    }

}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract MintableToken is StandardToken, Ownable {
    event Mint(address indexed to, uint256 amount);
    event MintFinished();

    bool public mintingFinished = false;


    modifier canMint() {
        require(!mintingFinished, "in MintableToken:canMint(). Minting has not finished");
        _;
    }

    modifier hasMintPermission() {
        require(msg.sender == owner, "in MintableToken: hasMintPermission(). Account does not have minting permission");
        _;
    }

    /**
     * @dev Function to mint tokens
     * @param _to The address that will receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     * @return A boolean that indicates if the operation was successful.
     */
    function mint(
        address _to,
        uint256 _amount
    )
    public
    hasMintPermission
    canMint
    returns (bool)
    {
        totalSupply_ = totalSupply_.add(_amount);
        balances[_to] = balances[_to].add(_amount);
        emit Mint(_to, _amount);
        emit Transfer(address(0), _to, _amount);
        return true;
    }

    /**
     * @dev Function to stop minting new tokens.
     * @return True if the operation was successful.
     */
    function finishMinting() public onlyOwner canMint returns (bool) {
        mintingFinished = true;
        emit MintFinished();
        return true;
    }
}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract BCToken is MintableToken {
    string public constant name = "BCToken";   // solhint-disable-line
    string public constant symbol = "BCT";     // solhint-disable-line
    uint8 public constant decimals = 18;       // solhint-disable-line
    uint256 public constant INITIAL_SUPPLY = 10000 * (10 ** uint256(decimals));

    /**
     * @dev Constructor that gives msg.sender all of existing tokens.
     */
    constructor() public {
        // Sets totalSupply and balances[msg.sender]
        mint(msg.sender, INITIAL_SUPPLY);
    }
}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
contract ERC721Holder is ERC721Receiver {
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    )
    public
    returns (bytes4)
    {
        return ERC721_RECEIVED;
    }
}

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
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


pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
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
            msg.sender == address(escrowRegistry), "in Escrow:onlyEscrowRegistry(). msg.sender is not EscrowRegistry"
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
                amountToTransfer > 0, "in Escrow:getDepositedTokens(). All your tokens have been already withdrawn"
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
                amountToTransfer > 0, "in Escrow:getDepositedTokens(). All your tokens have been already withdrawn"
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
    //solhint-disable-next-line max-line-length
    /// @param collateralAmountPlusConBalance The collateral amount that was locked during filling of the debt order plus the contract balance left over after the withdrawal
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
            proportionOfDeposit.mul(collateralAmountPlusConBalance)
            ).div(FRACTIONAL_RATE_SCALING_FACTOR
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

            // true is used to set  theoreticalScalingFactor
            setScalingFactor(depositor, theoreticalScalingFactor, true);

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
        require(newDebtRegAddress != oldDebtRegAddress, "in Escrow: updateDebtRegistry(). New address cannot be existing address.");//solhint-disable-line max-line-length
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
        require(newEscrowRegAddress != oldEscrowRegAddress, "in Escrow: updateEscrowRegistry. New address cannot be existing address.");//solhint-disable-line max-line-length
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
            require(contractBalance >= amountToTransfer, "in Escrow:transferAll(). Insufficient escrow contract balance."); //solhint-disable-line max-line-length
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
                amountToTransfer != 0, "in Escrow:transferPartPayment(). Amount to be withdrawn is 0 or less than 0."
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

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed
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
