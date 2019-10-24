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

import "./Collateralizer.sol";
import "./SimpleInterestTermsContract.sol";


/**
 * Example collateralized terms contract for usage in simple interest debt agreements
 *
 * Authors: nadavhollander, saturnial, jdkanani, graemecode
 */
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
