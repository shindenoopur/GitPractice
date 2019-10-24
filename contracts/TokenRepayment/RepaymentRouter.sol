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
import "../Debt/DebtRegistry.sol";
import "./TermsContract.sol";
import "../TokenTransferRegistry/TokenTransferProxy.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";


/**
 * The RepaymentRouter routes allowers payers to make repayments on any
 * given debt agreement in any given token by routing the payments to
 * the debt agreement's beneficiary.  Additionally, the router acts
 * as a trusted oracle to the debt agreement's terms contract, informing
 * it of exactly what payments have been made in what quantity and in what token.
 *
 * Authors: Jaynti Kanani -- Github: jdkanani, Nadav Hollander -- Github: nadavhollander
 */
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
