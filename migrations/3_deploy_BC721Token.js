const BC721Token = artifacts.require("BC721Token")

module.exports = function (deployer, network, accounts) {
    const owner = accounts[0]
    deployer.deploy(BC721Token, "BC721Token", "BCNFT", {from: owner} )
}
