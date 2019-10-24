const Borrower= artifacts.require('Borrower')
const BCTokenJSON = require('../build/contracts/BCToken')
const DebtRegistryJSON = require('../build/contracts/DebtRegistry')
const EscrowRegistryJSON = require('../build/contracts/EscrowRegistry')
const CollateralizedSimpleInterestTermsJSON = require('../build/contracts/CollateralizedSimpleInterestTermsContract')
const RepaymentRouterJSON = require('../build/contracts/RepaymentRouter')


function getNetworkId(networkName) {
    switch (networkName) {
        case 'goerli': return '5'
        case 'ganache': return '5777'
        case 'development': return '8777'
        case 'localPoA': return '7777'
    }
}

module.exports = function (deployer, network, accounts) {
    return new Promise((resolve, reject) => {
        try {
            const owner = accounts[0]
            const networkId  = getNetworkId(network)
            console.log('network id: ', networkId)
            // await web3APIs.unlockAccount(owner, 'password', 30)
            deployer.deploy(Borrower, BCTokenJSON.networks[networkId].address, DebtRegistryJSON.networks[networkId].address, CollateralizedSimpleInterestTermsJSON.networks[networkId].address, EscrowRegistryJSON.networks[networkId].address, RepaymentRouterJSON.networks[networkId].address, {from: owner} ).then(function (result) {
                console.log('Contract deployed successfully TransactionHash: ', result.transactionHash)
                console.log('Contract address: ', result.address)
                resolve({
                    status: 'success',
                    message: 'Deployment successful',
                    data: [result.address]
                })
            })
            // await web3APIs.lockAccount(owner)
        } catch (error) {
            console.log('error in deployBorrower: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}


