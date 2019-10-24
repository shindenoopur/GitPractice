/**
 * Created by chaitanya.
 * Every describe section should have Arrange, Act and Assert
 */

const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')
const customEvent = require('../utils/assertEvent')
const bigNumber = require('bignumber.js')

const BCToken = artifacts.require('BCToken')

contract('ERC20 Token Test Suite using OpenZeppelin', async (accounts) => {
    describe('ERC20 Token', async () => {
        const expectedTokenName = 'BCToken'
        const expectedTokenSymbol = 'BCT'
        const expectedSupply = 10000 * (10 ** 18)

        let coin
        let valueToTransfer = 500
        let acc1Bal = 0
        let acc2Bal = 0
        let acc3Bal = 0
        let ret

        const owner = accounts[0]
        const acc1 = accounts[1]
        const acc2 = accounts[2]
        const acc3 = accounts[3]

        const gasEstimate = 8000000
        const noOwnerAdd = '0x0000000000000000000000000000000000000000'

        before(async () => {
            coin = await BCToken.new({from: owner})
            //BC721TokenInstance = await BCToken.new({from: platformAccount, gasLimit: gasEstimate})
        })

        describe('BCToken [ is MintableToken ]', async () => {
            it('Verify name of token', async () => {
                let coinName = await coin.name.call()
                assert.equal(coinName, expectedTokenName, 'Token name does not match')
            })

            it('Verify symbol of token', async () => {
                let coinSymbol = await coin.symbol.call()
                assert.equal(coinSymbol, expectedTokenSymbol, 'Symbol does not match')
            })

            it('Verify number of decimals', async () => {
                let coinDec = await coin.decimals.call()
                assert.equal(coinDec.toNumber(), 18, 'Number of decimals does not match')
            })

            it('Verify total supply of tokens', async () => {
                let coinSupp = new bigNumber (await coin.INITIAL_SUPPLY.call())
                assert.equal(coinSupp.toNumber(), expectedSupply, 'Total Supply does not match')
            })
        })

        describe('OpenZeppelin API Test', async () => {
            describe('MintableToken [ is StandardToken & is Ownable ]', async () => {
                before(async () => {
                    acc1Bal = await coin.balanceOf.call(acc1)
                    acc2Bal = await coin.balanceOf.call(acc2)
                    acc3Bal = await coin.balanceOf.call(acc3)
                    valueToTransfer = 100
                })

                describe('MintableToken:mint(address _to, uint256 _amount) public hasMintPermission canMint returns (bool)', async () => {

                    it('Only owner can mint tokens', async () => {
                        await customAssert.assertRevert(coin.mint(acc1, valueToTransfer, {
                            from: acc1,
                            gasLimit: gasEstimate,
                        }))
                    })

                    it('Mint more tokens', async () => {
                        ret = await coin.mint(acc1, valueToTransfer, {from: owner, gasLimit: gasEstimate})
                        assert.equal(ret.receipt.status, true, 'Token not minted')

                        ret = await coin.mint(acc2, valueToTransfer, {from: owner, gasLimit: gasEstimate})
                        assert.equal(ret.receipt.status, true, 'Token not minted')

                        ret = await coin.mint(acc3, valueToTransfer, {from: owner, gasLimit: gasEstimate})
                        assert.equal(ret.receipt.status, true, 'Token not minted')
                    })

                    describe('Check for events emitted by Mint()', async () => {
                        it('Check for Mint Event && Transfer Events', async () => {
                            let emittedEventArray = [
                                /*Mint event not emiited in updated version of openzeppelin */
                                // {
                                //     event: 'Mint',
                                //     args: {
                                //         0: acc3,
                                //         1: valueToTransfer,
                                //         __length__: 2,
                                //         to: acc3,
                                //         amount: valueToTransfer
                                //     }
                                // },
                                {
                                    event: 'Transfer',
                                    args: {
                                        0: noOwnerAdd,
                                        1: acc3,
                                        2: valueToTransfer,
                                        __length__: 3,
                                        from: noOwnerAdd,
                                        to: acc3,
                                        value: valueToTransfer
                                    }
                                },
                            ]
                            await customEvent.solAllEvents(ret, emittedEventArray, 'All expected event not emitted')
                        })
                    })

                    it('Tally balance after minting', async () => {
                        let newAcc1Bal = await coin.balanceOf.call(acc1)
                        let newAcc2Bal = await coin.balanceOf.call(acc2)
                        let newAcc3Bal = await coin.balanceOf.call(acc3)

                        let diff1Bal = newAcc1Bal - acc1Bal
                        let diff2Bal = newAcc2Bal - acc2Bal
                        let diff3Bal = newAcc3Bal - acc3Bal

                        assert.equal(diff1Bal, valueToTransfer, 'Balance does not tally')
                        assert.equal(diff2Bal, valueToTransfer, 'Balance does not tally')
                        assert.equal(diff3Bal, valueToTransfer, 'Balance does not tally')
                    })
                })

                // describe('MintableToken:finishMinting() public onlyOwner canMint returns (bool)', async () => {
                //     it('Minting has not finished', async () => {
                //         ret = await coin.mintingFinished.call()
                //         assert.equal(ret, false, 'Minting has not finished')
                //     })

                //     it('Non-owner cannot stopping minting', async () => {
                //         await customAssert.assertRevert(coin.finishMinting({from: acc1}))
                //     })

                //     it('Owner can stop minting', async () => {
                //         ret = await coin.finishMinting({from: owner})
                //         assert.equal(ret.receipt.status, true, 'Minting finished')
                //     })

                //     it('Minting has stopped', async () => {
                //         ret = await coin.mintingFinished.call()
                //         assert.equal(ret, true, 'Minting finished')
                //     })

                //     it('Owner cannot Mint after minting finished', async () => {
                //         await customAssert.assertRevert(coin.mint(acc1, valueToTransfer, {
                //             from: owner,
                //             gasLimit: gasEstimate,
                //         }))
                //     })
                // })
            })

            describe('Ownable [ * ]', async () => {
                let ownerBefore
                let tryNewOwner

                before(async () => {
                    tryNewOwner = acc1
                    ownerBefore = await coin.owner.call({from: owner})
                })

                describe('Ownable:transferOwnership(address _newOwner) public onlyOwner()', async () => {
                    it('Non-owner cannot change ownership', async () => {
                        await customAssert.assertRevert(coin.transferOwnership(tryNewOwner, {from: tryNewOwner}))
                    })

                    it('Owner cannot transfer ownership to address(0)', async () => {
                        await customAssert.assertRevert(coin.transferOwnership(noOwnerAdd, {from: owner}))
                    })

                    it('Verify ownership of token not changed', async () => {
                        let newOwner = await coin.owner.call()
                         assert.equal(newOwner, ownerBefore, 'Owner Changed')
                    })

                    it('Owner transfers ownership to new owner', async () => {
                        ret = await coin.transferOwnership(tryNewOwner, {from: owner})
                        assert.equal(ret.receipt.status, true, 'Owner Not Changed')
                    })

                    describe('Check for events emitted by transferOwnership()', async () => {
                        it('Check for OwnershipTransferred Event', async () => {
                            let emittedEventArray = [
                                {
                                    event: 'OwnershipTransferred',
                                    args: {
                                        0: owner,
                                        1: tryNewOwner,
                                        __length__: 2,
                                        newOwner: tryNewOwner,
                                        previousOwner: owner
                                    }
                                 },
                            ]
                            await customEvent.solAllEvents(ret, emittedEventArray, 'All expected event not emitted')
                        })
                    })

                    it('Verify ownership of token has been transferred to new owner', async () => {
                        let newOwner = await coin.owner.call()
                        assert.equal(newOwner, tryNewOwner, 'Owner Not Changed')
                    })
                })

                describe('Ownable:renounceOwnership() public onlyOwner', async () => {
                    it('Non-owner cannot relinquish ownership', async () => {
                        await customAssert.assertRevert(coin.renounceOwnership({from: ownerBefore}))
                    })

                    it('Verify non-owner could not change ownership', async () => {
                        let owner = await coin.owner.call()
                        assert.equal(owner, tryNewOwner, 'Non owner changed ownership')
                    })

                    // This has to be moved to  after with comments, since onlyOwner modifier loses it's essence after this test
                    it('Only owner can relinquish ownership', async () => {
                        ret = await coin.renounceOwnership({from: tryNewOwner})
                        assert.equal(ret.receipt.status, true, 'Cannot relinquish control of the contract')
                    })

                    describe('Check for events emitted by renounceOwnership()', async () => {
                        it('Check for OwnershipRenounced Event', async () => {
                            let emittedEventArray = [
                                {
                                    event: 'OwnershipTransferred',  //renounceOwnership() emits ownership transferred event in updated version
                                    args: {
                                        0: tryNewOwner,
                                        1: noOwnerAdd,
                                        newOwner: noOwnerAdd,
                                        __length__: 2,
                                        previousOwner: tryNewOwner
                                    }
                                 },
                            ]
                            await customEvent.solAllEvents(ret, emittedEventArray, 'All expected event not emitted')
                        })
                    })

                    it('Verify ownership transferred to address(0) account', async () => {
                        let owner = await coin.owner.call()
                        assert.equal(owner, noOwnerAdd, 'Control of contract has not been moved to address(0) account')
                    })
                })
            })

            describe('StandardToken [ is ^ERC20 & is BasicToken ]', async () => {
                let spender1
                let spend1Amt
                let spend2Amt
                let addApproval
                let decApproval

                before(async () => {
                    spender1 = accounts[9]
                    spend1Amt = 20
                    spend2Amt = 30
                    addApproval = 80
                    decApproval = 50
                })

                describe('StandardToken:approve(address _spender, uint256 _value) public returns (bool)', async () => {
                    it('Approve spending of other accounts', async () => {
                        ret = await coin.approve(spender1, spend1Amt, {from: acc3})
                        assert.equal(ret.receipt.status, true, 'Spending not approved')
                    })

                    it('Verify allowance of an account', async () => {
                        let balance = await coin.allowance.call(acc3, spender1, {from: acc3})
                        assert.equal(balance.toNumber(), spend1Amt, 'Allowance not verified')
                    })
                })

                describe('StandardToken:increaseAllowance(address _spender, uint256 _addedValue) public returns (bool)', async () => {
                    it('Increase approval for account', async () => {
                        let status = await coin.increaseAllowance(spender1, addApproval, {from: acc3})
                        assert.equal(status.receipt.status, true, 'Approval not increased')
                    })

                    it('Verify if allowance limit has increased', async () => {
                        let approvalLimit = await coin.allowance.call(acc3, spender1, {from: acc3})
                        let expectedLimit = spend1Amt + addApproval
                        assert.equal(approvalLimit.toNumber(), expectedLimit, 'Allowance not increased')
                    })
                })

                describe('StandardToken:decreaseAllowance(address _spender, uint256 _subtractedValue) public returns (bool)', async () => {
                    it('Decrease approval for account', async () => {
                        ret = await coin.decreaseAllowance(spender1, decApproval, {from: acc3})
                        assert.equal(ret.receipt.status, true, 'Approval not decreased')
                    })

                    it('Verify if allowance limit has decreased', async () => {
                        let approvalLimit = await coin.allowance.call(acc3, spender1, {from: acc3})
                        let expectedLimit = spend1Amt + addApproval - decApproval
                        assert.equal(approvalLimit.toNumber(), expectedLimit, 'Allowance not decreased')
                    })
                })

                describe('StandardToken:transferFrom(address _from, address _to, uint256 _value) public returns (bool)', async () => {

                    it('Transfer fails due to insufficient balance', async () => {
                        await customAssert.assertRevert(coin.transferFrom(accounts[6], spender1, spend1Amt, {from: accounts[6]}))
                    })

                    it('Transfer fails due to insufficient allowance', async () => {
                        await customAssert.assertRevert(coin.transferFrom(accounts[3], accounts[8], 99, {from: accounts[9]}))
                    })

                    it('Transfer fails to address(0)', async () => {
                        await customAssert.assertRevert(coin.transferFrom(accounts[3], noOwnerAdd, spend1Amt, {from: accounts[9]}))
                    })

                    it('Transfer approved amount by approved user', async () => {
                        ret = await coin.transferFrom(acc3, spender1, spend1Amt, {from: spender1})
                        assert.equal(ret.receipt.status, true, 'Amount not transferred')
                    })

                    it('Decrease approve for spending covers if branch', async () => {
                        let decApproval = 20
                        ret = await coin.decreaseAllowance(spender1, decApproval, {from: acc3})
                        assert.equal(ret.receipt.status, true, 'Spending approval decreased')
                    })

                    it('Checks approved amount to be 0', async () => {
                        let balance = await coin.allowance.call(owner, spender1)
                        assert.equal(balance.toNumber(), 0, 'Approved amount is not decremented')
                    })
                })
            })

            describe('BasicToken [ is ^ERC20Basic ]', async () => {
                let amtToTransfer = 25
                let spender
                let startBal_Owner = 0
                let endBal_Owner = 0
                let startBal_Spender = 0
                let endBal_Spender = 0

                before(async () => {
                    spender = accounts[8]
                    startBal_Owner = await coin.balanceOf.call(acc3)
                    startBal_Spender = await coin.balanceOf.call(spender)
                })

                describe('BasicToken:totalSupply() public view returns (uint256)', async () => {
                    it('Verify total supply', async () => {
                        let actualTotalSupply = new bigNumber (await coin.totalSupply.call())
                        assert.equal(actualTotalSupply.toNumber(), expectedSupply, 'Actual and Expected total supply do not match')
                    })
                })

                describe('BasicToken:transfer(address _to, uint256 _value) public returns (bool)', async () => {
                    it('Verify transfer fails for insufficient balance', async () => {
                        await customAssert.assertRevert(coin.transfer(acc2, amtToTransfer, {from: accounts[7]}))
                    })

                    it('Verify transfer fails when destination is address(0)', async () => {
                        await customAssert.assertRevert(coin.transfer(noOwnerAdd, amtToTransfer, {from: acc3}))
                    })

                    it('Transfer tokens from one account to another', async () => {
                        ret = await coin.transfer(spender, amtToTransfer, {from: acc3})
                        assert.equal(ret.receipt.status, true, 'Transfer completed')
                    })
                })

                describe('BasicToken:balanceOf(address _owner) public view returns (uint256)', async () => {
                    it('Verify balance of owner after transfer', async () => {
                        endBal_Owner = await coin.balanceOf.call(acc3)
                        let diff = startBal_Owner.toNumber() - endBal_Owner.toNumber()
                        assert.equal(diff, amtToTransfer, 'Owner amounts do not tally ')
                    })

                    it('Verify balance of spender after transfer', async () => {
                        endBal_Spender = await coin.balanceOf.call(spender)
                        let diff = endBal_Spender.toNumber() - startBal_Spender.toNumber()
                        assert.equal(diff, amtToTransfer, 'Spender amounts do not tally')
                    })
                })
            })
        })
    })
})