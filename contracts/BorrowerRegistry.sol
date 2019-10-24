/*
Created by Balaji Pachai on 05/03/2019
Smart Contract that is used to get all the details of the Debt Agreement pertained to a Borrower
*/
pragma solidity ^0.5.0; //solhint-disable-line compiler-fixed

/**
* @title BorrowerRegistry
* @dev Contract that stores all users mapping with their respective Borrower smart contract.
*/
contract BorrowerRegistry {
    mapping(string => address) usersBorrowerContract;

    /**
    * @dev Function that maps user with the Borrower smart contract
    * @param _jsonHash Keccak256 hash of user details
    * @param _borrowerAddress Borrower contract address
    */
    function setBorrowerContractInRegistry(string memory _jsonHash, address _borrowerAddress) public {
        require(
            _borrowerAddress != address(0),
            "in BorrowerRegistry:setBorrowerInRegistry(). borrower contract address is address(0)"
        );
        usersBorrowerContract[_jsonHash] = _borrowerAddress;
    }

    /**
    * @dev Function that gets the user's Borrower contract address
    * @param _jsonHash Keccak256 hash of user details
    * @return address The Borrower contract address
    */
    function getBorrowerContractFromRegistry(string memory _jsonHash) public view returns (address) {
        return usersBorrowerContract[_jsonHash];
    }
}
