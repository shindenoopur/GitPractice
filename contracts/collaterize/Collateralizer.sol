/*
  **********************************************************************************************************************
  Copyright 2018 Chaitanya Amin.
  Private License.
  No License grated to view, modify, merge, compare or use this file without express written consent.
  Consent can be obtained on payment of consideration.
  For commercial terms please email chaitanyaamin@gmail.com
  **********************************************************************************************************************

  Copyright 2017 Dharma Labs Inc.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed

import { PermissionsLib, PermissionEvents } from "../libraries/PermissionsLib.sol";
import "../libraries/PermissionsLib.sol";
import "../Debt/DebtRegistry.sol";
import "../TokenTransferRegistry/TokenRegistry.sol";
import "../TokenTransferRegistry/TokenTransferProxy.sol";
import "./SimpleInterestTermsContractCollateralized.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
  * Contains functionality for collateralizing assets, by transferring them from
  * a debtor address to this contract as a custodian.
  *
  * Authors (in no particular order): nadavhollander, saturnial, jdkanani, graemecode
  */
contract Collateralizer is Pausable, PermissionEvents, Ownable {
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
            CollateralizedSimpleInterestTermsContract _termsContract
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
