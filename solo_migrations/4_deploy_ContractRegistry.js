const ContractRegistry = artifacts.require('ContractRegistry')

const TokenRegistryJSON = require('../build/contracts/TokenRegistry')
const TokenTransferProxyJSON = require('../build/contracts/TokenTransferProxy')
const DebtRegistryJSON = require('../build/contracts/DebtRegistry')
const RepaymentRouterJSON = require('../build/contracts/RepaymentRouter')
const DebtKernelJSON = require('../build/contracts/DebtKernel')
const DebtTokenJSON = require('../build/contracts/DebtToken')
const CollateralizerJSON = require('../build/contracts/Collateralizer')

function getNetworkId(networkName) {
    switch (networkName) {
        case 'goerli': return '5'
        case 'ganache': return '5777'
        case 'development': return '8777'
        case 'localPoA': return '7777'
    }
}

module.exports = function (deployer, network, accounts) {
    const owner = accounts[0]
    const networkId  = getNetworkId(network)
    deployer.deploy(ContractRegistry, CollateralizerJSON.networks[networkId].address, DebtKernelJSON.networks[networkId].address, DebtRegistryJSON.networks[networkId].address, DebtTokenJSON.networks[networkId].address, RepaymentRouterJSON.networks[networkId].address, TokenRegistryJSON.networks[networkId].address, TokenTransferProxyJSON.networks[networkId].address, { from: owner}).then(function (result) {
        console.log('Contract deployed successfully TransactionHash: ', result.transactionHash)
        console.log('Contract address: ', result.address)
    })
}
