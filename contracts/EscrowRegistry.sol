/**********************************************************************************************************************
Copyright 2017 Chaitanya Amin.
Private License.
No License grated to view, modify, merge, compare or use this file without express written consent.
Consent can be obtained on payment of consideration.

For commercial terms please email chaitanyaamin@gmail.com
**********************************************************************************************************************/
pragma solidity ^0.5.0; // solhint-disable-line compiler-fixed

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./libraries/PermissionsLib.sol";
import "./Borrower.sol";
import "./payment/Escrow.sol";
import "./ERC20/BCToken.sol";


/**
 * @author Balaji Pachai
 * The EscrowRegistry is a basic registry mapping debtor's/borrower's
 * & creditor's / lender's to their debt agreements.
 *
 * Note that the EscrowRegistry does *not* mediate any of the
 * core protocol's business logic, but, rather, is a helpful
 * utility for determining whether the borrower is allowed to
 * to borrow or not ?
 */
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
