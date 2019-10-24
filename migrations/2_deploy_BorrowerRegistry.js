const BorrowerRegistry = artifacts.require('BorrowerRegistry')

module.exports = function (deployer, network, accounts) {
    const owner = accounts[0]
    deployer.deploy(BorrowerRegistry, {from: owner} )
}
