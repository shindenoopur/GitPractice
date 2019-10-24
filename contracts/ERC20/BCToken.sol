pragma solidity ^0.5.0;

/*
**************************************************************************************************
Copyright 2017 Chaitanya Amin.
Private License.
No License grated to view, modify, merge, compare or use this file without explicit written consent.
Consent can be obtained on payment of consideration.
For commercial terms please email chaitanyaamin@gmail.com
**************************************************************************************************
*/

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";

/* import ownable contracts */
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


/**
 * @title BCToken
 * @dev Very simple ERC20 Token example, where all tokens are pre-assigned to the creator.
 * Note they can later distribute these tokens as they wish using `transfer` and other
 * `ERC20` functions.
 */
contract BCToken is ERC20Mintable, Ownable {
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

    function demoOwnable(address owner, address sender) public{
        Ownable.transferOwnership(owner);
    }
}

/*
Call it a fungibility demo
You have lent some money to say X, for 3 months or any number of months or years.
I want to get out of it.
I can sell DebtToken to someone say Y.
In this case X repays that should go to Y.

Instead of selling it to Y alone, sell it to Y and Z. (while selling the percentage should not be 50-50)
Pick a number as 10000
*/
