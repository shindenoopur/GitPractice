const MultiSigWalletContract = artifacts.require("MultiSigWallet")

module.exports = function (deployer, network, accounts) {
    const owner = accounts[0]
    //For MultiSigWallet
    const signatories = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
    // const numAuthorizationsRequired = demoValues.deploymentValues.multiSigWalletNumAuthorizationRequired  uncomment for testing
    const numAuthorizationsRequired = 3
    deployer.deploy(MultiSigWalletContract, signatories, numAuthorizationsRequired, { from: owner})// Here msg.sender for MultiSigWalletContract Contract will be 0th Account
}

