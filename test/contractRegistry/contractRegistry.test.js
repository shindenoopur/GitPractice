const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')
const customEvent = require('../utils/assertEvent')

const Collateralizer = artifacts.require('Collateralizer')
const DebtKernel = artifacts.require('DebtKernel')
const DebtRegistry = artifacts.require('DebtRegistry')
const DebtToken = artifacts.require('DebtToken')
const TokenRegistry = artifacts.require('TokenRegistry')
const TokenTransferProxy = artifacts.require('TokenTransferProxy')
const RepaymentRouter = artifacts.require('RepaymentRouter')
const ContractRegistry = artifacts.require('ContractRegistry')

contract('ContractRegistry Test Suite', async (accounts) => {
    describe('ContractRegistry is [ Ownable ]', async () => {
        let debtKernelInstance, tokenTransferProxyInstance, debtTokenInstance, debtRegistryInstance, collateralizerInstance, tokenRegistryInstance, contractRegistryInstance, repaymentRouterInstance
        const owner = accounts[0]
        before(async () => {
            debtRegistryInstance = await DebtRegistry.new({from: owner})
            debtTokenInstance = await DebtToken.new(debtRegistryInstance.address, {from: owner})
            tokenTransferProxyInstance = await TokenTransferProxy.new({from: owner})
            tokenRegistryInstance = await TokenRegistry.new({ from: owner })
            debtKernelInstance = await DebtKernel.new(tokenTransferProxyInstance.address, {from: owner})
            repaymentRouterInstance = await RepaymentRouter.new(debtRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})
            collateralizerInstance = await Collateralizer.new(debtKernelInstance.address, debtRegistryInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address)
            contractRegistryInstance = await ContractRegistry.new(collateralizerInstance.address, debtKernelInstance.address, debtRegistryInstance.address, debtTokenInstance.address, repaymentRouterInstance.address, tokenRegistryInstance.address, tokenTransferProxyInstance.address, {from: owner})

        });

        describe('Constructor', async () => {
            let contractAddress
            describe('Get the default public variable values', async () => {
                it('Should get the collateralizer value', async () => {
                    contractAddress = await contractRegistryInstance.collateralizer.call()
                    assert.equal(contractAddress, collateralizerInstance.address, 'Collateralizer addresses do not match')
                })
                it('Should get the debtKernel value', async () => {
                    contractAddress = await contractRegistryInstance.debtKernel.call()
                    assert.equal(contractAddress, debtKernelInstance.address, 'DebtKernel addresses do not match')
                })
                it('Should get the debtRegistry value', async () => {
                    contractAddress = await contractRegistryInstance.debtRegistry.call()
                    assert.equal(contractAddress, debtRegistryInstance.address, 'DebtRegistry addresses do not match')
                })
                it('Should get the debtToken value', async () => {
                    contractAddress = await contractRegistryInstance.debtToken.call()
                    assert.equal(contractAddress, debtTokenInstance.address, 'DebtToken addresses do not match')
                })
                it('Should get the repaymentRouter value', async () => {
                    contractAddress = await contractRegistryInstance.repaymentRouter.call()
                    assert.equal(contractAddress, repaymentRouterInstance.address, 'RepaymentRouter addresses do not match')
                })
                it('Should get the tokenRegistry value', async () => {
                    contractAddress = await contractRegistryInstance.tokenRegistry.call()
                    assert.equal(contractAddress, tokenRegistryInstance.address, 'TokenRegistry addresses do not match')
                })
                it('Should get the tokenTransferProxy value', async () => {
                    contractAddress = await contractRegistryInstance.tokenTransferProxy.call()
                    assert.equal(contractAddress, tokenTransferProxyInstance.address, 'TokenTransferProxy addresses do not match')
                })
            })
        })

        describe('Print addresses before update', async () => {
            let contractAddress
            it('Should print all addresses after update', async () => {
                contractAddress = await contractRegistryInstance.collateralizer.call()
                console.log("\tCollateralizer\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.debtKernel.call()
                console.log("\tDebtKernel\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.debtRegistry.call()
                console.log("\tDebtRegistry\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.debtToken.call()
                console.log("\tDebtToken\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.repaymentRouter.call()
                console.log("\tRepaymentRouter\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.tokenRegistry.call()
                console.log("\tTokenRegistry\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.tokenTransferProxy.call()
                console.log("\tTokenTransferProxy\t",contractAddress)
            })
        })

        describe('Test updateAddress(ContractType contractType, address newAddress) public onlyOwner', async () => {
            let contractType, newAdd
            /*
            *   enum ContractType {
                    Collateralizer,         0
                    DebtKernel,             1
                    DebtRegistry,           2
                    DebtToken,              3
                    RepaymentRouter,        4
                    TokenRegistry,          5
                    TokenTransferProxy      6
                }
            * */
            describe('Check for negative scenarios', async () => {
                    contractType = 7
                    newAdd = '0x0000000000000000000000000000000000000001'
                it('Should revert when no if branch matches', async () => {
                    await customAssert.assertRevert(contractRegistryInstance.updateAddress(contractType, newAdd, {from: owner, gas: 3000000}))
                })

                it('Should revert when newAddress is address(0)', async () => {
                    contractType = 0
                    newAdd = '0x0000000000000000000000000000000000000000'
                    await customAssert.assertRevert(contractRegistryInstance.updateAddress(contractType, newAdd, {from: owner, gas: 3000000}))
                })

                it('Should revert when newAddress is oldAddress', async () => {
                    contractType = 0
                    newAdd = collateralizerInstance.address
                    await customAssert.assertRevert(contractRegistryInstance.updateAddress(contractType, newAdd, {from: owner, gas: 3000000}))
                })
            })

            describe('Check for positive scenarios', async () => {
                let txObject
                let dummyNewAddresses = [
                    '0x0000000000000000000000000000000000000001',
                    '0x0000000000000000000000000000000000000002',
                    '0x0000000000000000000000000000000000000003',
                    '0x0000000000000000000000000000000000000004',
                    '0x0000000000000000000000000000000000000005',
                    '0x0000000000000000000000000000000000000006',
                    '0x0000000000000000000000000000000000000007'
                ]
                describe('Execute updateAddress()', async () => {
                    describe('Cover the if-else branches of updateAddress()', ()=> {
                        it('Should cover the if branch of collateralizer', async () => {
                            contractType = 0
                            newAdd = dummyNewAddresses[0]
                            txObject = await contractRegistryInstance.updateAddress(contractType, newAdd, {from: owner, gas: 3000000})
                        })
                        it('Should cover the if branch of debtKernel', async () => {
                            contractType = 1
                            newAdd = dummyNewAddresses[1]
                            txObject = await contractRegistryInstance.updateAddress(contractType, newAdd, {from: owner, gas: 3000000})
                        })
                        it('Should cover the if branch of debtRegistry', async () => {
                            contractType = 2
                            newAdd = dummyNewAddresses[2]
                            txObject = await contractRegistryInstance.updateAddress(contractType, newAdd, {from: owner, gas: 3000000})
                        })
                        it('Should cover the if branch of debtToken', async () => {
                            contractType = 3
                            newAdd = dummyNewAddresses[3]
                            txObject = await contractRegistryInstance.updateAddress(contractType, newAdd, {from: owner, gas: 3000000})
                        })
                        it('Should cover the if branch of repaymentRouter', async () => {
                            contractType = 4
                            newAdd = dummyNewAddresses[4]
                            txObject = await contractRegistryInstance.updateAddress(contractType, newAdd, {from: owner, gas: 3000000})
                        })
                        it('Should cover the if branch of tokenRegistry', async () => {
                            contractType = 5
                            newAdd = dummyNewAddresses[5]
                            txObject = await contractRegistryInstance.updateAddress(contractType, newAdd, {from: owner, gas: 3000000})
                        })
                        it('Should cover the if branch of tokenTransferProxy', async () => {
                            contractType = 6
                            newAdd = dummyNewAddresses[6]
                            txObject = await contractRegistryInstance.updateAddress(contractType, newAdd, {from: owner, gas: 3000000})
                        })

                    })

                    describe('Check for events emitted by updateAddress()', async () => {
                        it('Should check for ContractAddressUpdated event', async() => {
                            let emittedEventArray = [{
                                event: "ContractAddressUpdated",
                                args: {
                                    0: 6,
                                    1: tokenTransferProxyInstance.address,
                                    2: dummyNewAddresses[6],
                                    __length__: 3,
                                    contractType: 6,
                                    oldAddress: tokenTransferProxyInstance.address,
                                    newAddress: dummyNewAddresses[6]
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted from updateAddress()')
                        })
                    })
                })
            })
        })

        describe('Test validateNewAddress(address newAddress, address oldAddress)', async () => {
            it('Has been already covered in updateAddress()', async () => {
                assert.ok('Already covered in updateAddress()')
            })
        })

        describe('Print addresses after update', async () => {
            let contractAddress
            it('Should print all addresses after update', async () => {
                contractAddress = await contractRegistryInstance.collateralizer.call()
                console.log("\tCollateralizer\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.debtKernel.call()
                console.log("\tDebtKernel\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.debtRegistry.call()
                console.log("\tDebtRegistry\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.debtToken.call()
                console.log("\tDebtToken\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.repaymentRouter.call()
                console.log("\tRepaymentRouter\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.tokenRegistry.call()
                console.log("\tTokenRegistry\t\t",contractAddress)

                contractAddress = await contractRegistryInstance.tokenTransferProxy.call()
                console.log("\tTokenTransferProxy\t",contractAddress)
            })
        })

    })
})
