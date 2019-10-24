/**
 * Created by  Balaji on 12/29/18.
 */

const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('./utils/assertRevert')
const DebtRegistry = artifacts.require('DebtRegistry')
const CollateralizedSimpleInterestTermsContract = artifacts.require('CollateralizedSimpleInterestTermsContract')
const EscrowRegistry = artifacts.require('EscrowRegistry')
const Borrower = artifacts.require('Borrower')

const Collateralizer = artifacts.require('Collateralizer')
const TokenRegistry = artifacts.require('TokenRegistry')
const TokenTransferProxy = artifacts.require('TokenTransferProxy')
const DebtKernel = artifacts.require('DebtKernel')
const ContractRegistry = artifacts.require('ContractRegistry')
const RepaymentRouter = artifacts.require('RepaymentRouter')
const DebtToken = artifacts.require('DebtToken')
const BCToken = artifacts.require('BCToken')

contract('Borrower Test suite', async (accounts) => {
    const owner = accounts[0]
    const regulator = accounts[1]
    let borrower = accounts[2]
    const zeroAddress = '0x0000000000000000000000000000000000000000'

    let txObject
    let debtRegistryInstance, escrowRegistryInstance, borrowerInstance
    let debtKernelInstance, tokenTransferProxyInstance, debtTokenInstance, erc20TokenInstance, collateralizerInstance, tokenRegistryInstance,
        collateralizedSimpleInterestTermsContractInstance, contractRegistryInstance, repaymentRouterInstance

    before(async () => {
        //Gets all the contract instances
        erc20TokenInstance = await BCToken.new({from: owner})
        debtRegistryInstance = await DebtRegistry.new({from: owner})
        debtTokenInstance = await DebtToken.new(debtRegistryInstance.address, {from: owner})
        tokenTransferProxyInstance = await TokenTransferProxy.new({from: owner})
        tokenRegistryInstance = await TokenRegistry.new({from: owner})
        debtKernelInstance = await DebtKernel.new(tokenTransferProxyInstance.address, {from: owner})
        repaymentRouterInstance = await RepaymentRouter.new(debtRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
        collateralizerInstance = await Collateralizer.new(debtKernelInstance.address, debtRegistryInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address)

        contractRegistryInstance = await ContractRegistry.new(collateralizerInstance.address, debtKernelInstance.address, debtRegistryInstance.address, debtTokenInstance.address, repaymentRouterInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
        collateralizedSimpleInterestTermsContractInstance = await CollateralizedSimpleInterestTermsContract.new(contractRegistryInstance.address, {from: owner})

        escrowRegistryInstance = await EscrowRegistry.new({from: owner})
        borrowerInstance = await Borrower.new(erc20TokenInstance.address, debtRegistryInstance.address, collateralizedSimpleInterestTermsContractInstance.address, escrowRegistryInstance.address, repaymentRouterInstance.address, {from: owner})
    })

    describe('Borrower [ is Ownable, BorrowerInterface ]', async () => {

        describe('Check the values set by the constructor', async () => {
            let publicAddress
            it('Should check the DebtRegistry address', async () => {
                publicAddress = await borrowerInstance.debtRegistry.call()
                assert.equal(publicAddress, debtRegistryInstance.address, 'DebtRegistry addresses do not match')
            })
            it('Should check the TermsContract address', async () => {
                publicAddress = await borrowerInstance.termsContract.call()
                assert.equal(publicAddress, collateralizedSimpleInterestTermsContractInstance.address, 'TermsContract addresses do not match')
            })
            it('Should check the EscrowRegistry address', async () => {
                publicAddress = await borrowerInstance.escrowRegistry.call()
                assert.equal(publicAddress, escrowRegistryInstance.address, 'EscrowRegistry addresses do not match')
            })
            it('Should check the borrower state to be NOK', async () => {
                let borrowState = await borrowerInstance.getBorrowerState.call()
                assert.equal(borrowState.toNumber(), 1, 'Borrow states do not match')
            })
        })

        describe('function setBorrowState(address _borrower, uint256 _amountToBorrow) public borrowState(States.NOK)', async () => {
            let borrowState
            it('Should cover the else branch', async () => {
                // txObject = await borrowerInstance.setBorrowState(borrower, 1000,{from: owner, gas: 3000000})
                // assert.equal(txObject.receipt.status, true, 'Error while covering the else branch')
            })
            it('Should get the borrow state to be NOK', async () => {
                borrowState = await borrowerInstance.getBorrowerState.call()
                assert.equal(borrowState.toNumber(), 1, 'Borrow states do not match')
            })
            it('Should set the borrow state to be OK', async () => {
                //Add a regulator s.t. the regulator can invoke the setBorrowerAttributes
                await escrowRegistryInstance.addRegulator(regulator, {from: owner, gas: 3000000})
                borrower = borrowerInstance.address
                await escrowRegistryInstance.setBorrowerAttributes(borrower, 2000, {from: regulator, gas: 3000000})

                // let borrowAMount = await escrowRegistryInstance.getBorrowableAmount.call(borrower)
                // console.log(borrowAMount.toNumber())

                //Now setBorrowState will succeed
                // await borrowerInstance.setBorrowState(borrower, 1000, {from: owner, gas: 3000000})

                borrowState = await borrowerInstance.getBorrowerState.call()
                assert.equal(borrowState.toNumber(), 0, 'Borrow states do not match')
            })
        })

        describe('function getBorrowState() public view returns (bool)', async () => {
            it('Should get the borrow state to be OK', async () => {
                let borrowState = await borrowerInstance.getBorrowerState.call()
                assert.equal(borrowState.toNumber(), 0, 'Borrow states do not match')
            })
        })

        describe('function updateDebtRegistry(address newDebtRegAddress) publicOwner', async () => {
            let newAddress = '0x0000000000000000000000000000000000000001'
            describe('Negative scenarios', async () => {
                it('Should revert when invoked by non-owner account', async () => {
                    await customAssert.assertRevert(borrowerInstance.updateDebtRegistry(newAddress, {from: regulator, gas: 3000000}))
                })
                it('Should revert when newDebtRegAddress is address(0)', async () => {
                    await customAssert.assertRevert(borrowerInstance.updateDebtRegistry(zeroAddress, {from: owner, gas: 3000000}))
                })
                it('Should revert when oldDebtRegAddress = newDebtRegAddress', async () => {
                    await customAssert.assertRevert(borrowerInstance.updateDebtRegistry(debtRegistryInstance.address, {from: owner, gas: 3000000}))
                })
            })

            describe('Positive scenarios', async () => {
                it('Should update the debtRegAddress successfully', async () => {
                    txObject = await borrowerInstance.updateDebtRegistry(newAddress, {from: owner, gas: 3000000})
                    assert.equal(txObject.receipt.status, true, 'Error while updating the debtRegAddress')
                })
                it('Should check that the debtRegAddress is updated successfully', async () => {
                    let publicAddress = await borrowerInstance.debtRegistry.call()
                    assert.equal(publicAddress, newAddress, 'DebtRegistry addresses do not match')
                })
            })
        })

        describe('function updateTermsContract(address newDebtRegAddress) public onlyOwner', async () => {
            let newAddress = '0x0000000000000000000000000000000000000002'
            describe('Negative scenarios', async () => {
                it('Should revert when invoked by non-owner account', async () => {
                    await customAssert.assertRevert(borrowerInstance.updateTermsContract(newAddress, {from: regulator, gas: 3000000}))
                })
                it('Should revert when newTermsContractAddress is address(0)', async () => {
                    await customAssert.assertRevert(borrowerInstance.updateTermsContract(zeroAddress, {from: owner, gas: 3000000}))
                })
                it('Should revert when oldTermsContract = newTermsContractAddress', async () => {
                    await customAssert.assertRevert(borrowerInstance.updateTermsContract(collateralizedSimpleInterestTermsContractInstance.address, {from: owner, gas: 3000000}))
                })
            })

            describe('Positive scenarios', async () => {
                it('Should update the termsContractAddress successfully', async () => {
                    txObject = await borrowerInstance.updateTermsContract(newAddress, {from: owner, gas: 3000000})
                    assert.equal(txObject.receipt.status, true, 'Error while updating the termsContractAddress')
                })
                it('Should check that the termsContractAddress is updated successfully', async () => {
                    let publicAddress = await borrowerInstance.termsContract.call()
                    assert.equal(publicAddress, newAddress, 'TermsContract addresses do not match')
                })
            })
        })

        describe('function updateEscrowRegistry(address newDebtRegAddress) publicOwner', async () => {
            let newAddress = '0x0000000000000000000000000000000000000003'
            describe('Negative scenarios', async () => {
                it('Should revert when invoked by non-owner account', async () => {
                    await customAssert.assertRevert(borrowerInstance.updateEscrowRegistry(newAddress, {from: regulator, gas: 3000000}))
                })
                it('Should revert when newEscrowRegAddress is address(0)', async () => {
                    await customAssert.assertRevert(borrowerInstance.updateEscrowRegistry(zeroAddress, {from: owner, gas: 3000000}))
                })
                it('Should revert when oldEscrowRegAddress = newEscrowRegAddress', async () => {
                    await customAssert.assertRevert(borrowerInstance.updateEscrowRegistry(escrowRegistryInstance.address, {from: owner, gas: 3000000}))
                })
            })

            describe('Positive scenarios', async () => {
                it('Should update the escrowRegAddress successfully', async () => {
                    txObject = await borrowerInstance.updateEscrowRegistry(newAddress, {from: owner, gas: 3000000})
                    assert.equal(txObject.receipt.status, true, 'Error while updating the escrowRegAddress')
                })
                it('Should check that the escrowRegAddress is updated successfully', async () => {
                    let publicAddress = await borrowerInstance.escrowRegistry.call()
                    assert.equal(publicAddress, newAddress, 'EscrowRegistry addresses do not match')
                })
            })
        })

        describe('Get Debt Details from DebtRegistry', async () => {
            it('All this functions have been covered in DebtRegistry.sol', async() => { })
        })

        describe('Get Debt Details from TermsContract', async () => {
            it('All this functions have been covered in SimpleInterestTermsContractInstanceCollateralized.sol', async() => { })
        })
    })

})