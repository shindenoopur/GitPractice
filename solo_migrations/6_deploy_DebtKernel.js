const TokenTransferProxyJSON = require('../build/contracts/TokenTransferProxy')
const DebtKernel = artifacts.require('DebtKernel')

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

    deployer.deploy(DebtKernel, TokenTransferProxyJSON.networks[networkId].address, {from: owner}).then(function (result) {
        console.log('Contract deployed successfully TransactionHash: ', result.transactionHash)
        console.log('Contract address: ', result.address)
    })
}
