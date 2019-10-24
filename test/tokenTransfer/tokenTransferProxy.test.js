/**
 * Created by Baljai on 29/10/18.
 */

const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const BCToken = artifacts.require('BCToken')
const TokenTransferProxyInstance = artifacts.require('TokenTransferProxy')

contract('Token Transfer Proxy Test Suite', async (accounts) => {
    describe('TokenTransferProxy [ is Pausable, PermissionEvents ]', async () => {

        let tokenTransferProxyInstance, BCTokenInstance
        let txObject

        const owner = accounts[0]

        //Accounts to be used in test cases
        const acc1 = accounts[1]
        const acc2 = accounts[2]

        before(async () => {
            tokenTransferProxyInstance = await TokenTransferProxyInstance.new()
            BCTokenInstance = await BCToken.new({from: owner}) // 0th account will be the owner of BCTokenInstance
        })

        describe('addAuthorizedTransferAgent(address _agent) public onlyOwner', async () => {
            it('Should add authorized transfer agent', async () => {
                txObject = await tokenTransferProxyInstance.addAuthorizedTransferAgent(acc1, {from: owner})
                assert.equal(txObject.receipt.status, true, 'Failed to add authorized transfer agent')
            })
        })

        describe('getAuthorizedTransferAgents() public view returns (address[] authorizedAgents) before revoke', async () => {
            it('Should return all the authorized transfer agents', async () => {
                let authorizedAgent = await tokenTransferProxyInstance.getAuthorizedTransferAgents.call()
                assert.equal(authorizedAgent[0], acc1, 'Authorized agent do not match')
            })
        })

        describe('revokeTransferAgentAuthorization(address _agent) public onlyOwner', async () => {
            it('Should revoke authorization of valid transfer agent', async () => {
                txObject = await tokenTransferProxyInstance.revokeTransferAgentAuthorization(acc1, {from: owner})
                assert.equal(txObject.receipt.status, true, 'Failed to revokeTransferAgentAuthorization()')
            })
        })

        describe('getAuthorizedTransferAgents() public view returns (address[] authorizedAgents) after revoke', async () => {
            it('Should return all the authorized transfer agents', async () => {
                let authorizedAgent = await tokenTransferProxyInstance.getAuthorizedTransferAgents.call()
                assert.equal(authorizedAgent.length, 0, 'Authorized agent do not match')
            })
        })

        describe('transferFrom(address _token, address _from, address _to, uint _amount) public returns (bool _success)', async () => {
            let approvedValue = 100
            let amountToTransfer = 20
            it('Should execute transferFrom successfully', async () => {
                await BCTokenInstance.approve(tokenTransferProxyInstance.address, approvedValue, {from: owner})
                let befBalance = await BCTokenInstance.allowance.call(owner, tokenTransferProxyInstance.address)
                // console.log('Before transfer allowance: ', befBalance.toNumber())
                await tokenTransferProxyInstance.addAuthorizedTransferAgent(acc1, {from: owner})
                txObject = await tokenTransferProxyInstance.transferFrom(BCTokenInstance.address, owner, acc2, amountToTransfer, {from: acc1})
                assert.equal(txObject.receipt.status, true, 'Failed to execute transferFrom')
            })

            it('Should check for acc2 balance to be equal to amountToTransfer', async () => {
                let balance = await BCTokenInstance.balanceOf.call(acc2);
                assert.equal(balance.toNumber(), amountToTransfer, 'Account 2 balance do not match')
            })

            it('Should check for allowance', async() => {
                let befBalance = await BCTokenInstance.allowance.call(owner, tokenTransferProxyInstance.address)
                // console.log('After transfer allowance: ', befBalance.toNumber())
                assert.equal(befBalance.toNumber(), 80, 'Balance do not match')
            })

        })
    })
})