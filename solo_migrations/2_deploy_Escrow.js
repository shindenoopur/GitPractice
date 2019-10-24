const Escrow = artifacts.require('Escrow')
const BCTokenJSON = require('../build/contracts/BCToken')
const DebtTokenJSON = require('../build/contracts/DebtToken')
const DebtRegistryJSON = require('../build/contracts/DebtRegistry')
const EscrowRegistryJSON = require('../build/contracts/EscrowRegistry')
const CollateralizedSimpleInterestTermsContract = artifacts.require('CollateralizedSimpleInterestTermsContract')
const ContractRegistryJSON = require('../build/contracts/ContractRegistry')
const fixedDepositAmount = 10000

// const web3APIs = require('../reactApiConnectLayer/utils/web3Apis')l


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
    console.log('network id: ', networkId)

    // deployer.deploy(CollateralizedSimpleInterestTermsContract, ContractRegistryJSON.networks[networkId].address, { from: owner }).then(function () {
    //     return
    deployer.deploy(Escrow, BCTokenJSON.networks[networkId].address, DebtTokenJSON.networks[networkId].address, DebtRegistryJSON.networks[networkId].address, EscrowRegistryJSON.networks[networkId].address, fixedDepositAmount, {from: owner}).then(function (result) {
        console.log('Contract deployed successfully TransactionHash: ', result.transactionHash)
        console.log('Contract address: ', result.address)
    })
    // })
    // await web3APIs.unlockAccount(owner, 'password', 30)

    // await web3APIs.lockAccount(owner)
}
