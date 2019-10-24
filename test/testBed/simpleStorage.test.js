/**
 * Created by chaitanya on 5/11/17.
 * Every describe section should have Arrange, Act and Assert
 */
const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')

const SimpleStorage = artifacts.require('SimpleStorage')

contract('SimpleStorage', function (accounts) {
    /* Initialization code here */
    let owner = accounts[0]
    let simpleStorageContractInstance = null

    before (async () => {
        /* Before Test here */
        simpleStorageContractInstance = await SimpleStorage.new(0, {from: owner})
    })

    describe('Checks functions', async () => {
        describe('SimpleStorage:set()', async () => {
            it('Check Stored Variable', async () => {
                //Arrange
                let expected = 0
                //Act
                let actual = await simpleStorageContractInstance.get.call()
                //Assert
                assert.equal(expected, actual, 'First Set to Zero')
            })

            it('Set Variable to Initial Value', async () => {
                //Arrange
                let expected = 100
                //Act
                await simpleStorageContractInstance.set(expected)
                let actual = await simpleStorageContractInstance.get.call()
                //Assert
                assert.equal(expected, actual, 'Number Set and Retrieved')
            })
        })

        describe('SimpleStorage:update()', async () => {
            it('Update Success for Positive Values', async () => {
                let expected = 200
                await simpleStorageContractInstance.update(expected)
                let actual = await simpleStorageContractInstance.get.call()
                assert.equal(actual.toNumber(), expected, 'Updation Success For Positive Values')
            })

            it('Update Success for Values <99 ', async () => {
                let expected = 200
                await simpleStorageContractInstance.set(1)
                await simpleStorageContractInstance.update(expected)
                let actual = await simpleStorageContractInstance.get.call()
                assert.equal(actual.toNumber(), 11, 'Updation Success For Positive Values')
            })

            it('Update Fails for Negative Values', async () => {
                let valueToSet = -200
                await customAssert.assertRevert(simpleStorageContractInstance.update(valueToSet, {from: owner, gas: 3000000}))
            })
        })

        describe('SimpleStorage:incrementVar()', async () => {
            it('Increment Success for Positive Values', async () => {
                let incrementValue = 5
                await simpleStorageContractInstance.set(0)
                let balanceBeforeIncrement = await simpleStorageContractInstance.get.call()
                await simpleStorageContractInstance.incrementVar(incrementValue)
                let balanceAfterIncrement = await simpleStorageContractInstance.get.call()
                let diff = balanceAfterIncrement.toNumber() - balanceBeforeIncrement.toNumber()
                assert.equal(diff, incrementValue, 'Balance before increment is greater than balance after increment')
            })

            it('Increment Fails for Negative Values', async () => {
                let incrementValue = -100
                await customAssert.assertRevert(simpleStorageContractInstance.incrementVar(incrementValue), {from: owner, gas: 3000000})
                // await simpleStorageContractInstance.incrementVar(incrementValue)
            })
        })

        describe('decrement()', async () => {
            it('Decrement Success for Positive Values', async () => {
                let decrementValue = 5
                await simpleStorageContractInstance.set(30)
                let balanceBeforeDecrement = await simpleStorageContractInstance.get.call()
                await simpleStorageContractInstance.decrement(decrementValue)
                let balanceAfterDecrement = await simpleStorageContractInstance.get.call()
                assert(balanceBeforeDecrement.toNumber() > balanceAfterDecrement.toNumber(), 'Balance before decrement is less than balance after decrement')
            })

            it('Decrement Fails for Values Greater than Original Value', async () => {
                let decrementValue = 500
                await customAssert.assertRevert(simpleStorageContractInstance.decrement(decrementValue))
            })
        })

        describe('getOwner()', async () => {
            it('Gets owner', async () => {
                //Arrange
                let expected = owner
                //Act
                let actual = await simpleStorageContractInstance.getOwner.call()
                //Assert
                assert.equal(expected, actual, 'Owner address does not match')
            })
        })
    })
})