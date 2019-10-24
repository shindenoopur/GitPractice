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

contract Migrations {
    address public owner;
    uint public lastCompletedMigration;

    modifier restricted() {
        if (msg.sender == owner) _;
    }

    constructor () public {
        owner = msg.sender;
    }

    function setCompleted(uint completed) public restricted {
        lastCompletedMigration = completed;
    }

    function upgrade(address newAddress) public restricted {
        Migrations upgraded = Migrations(newAddress);
        upgraded.setCompleted(lastCompletedMigration);
    }
}
