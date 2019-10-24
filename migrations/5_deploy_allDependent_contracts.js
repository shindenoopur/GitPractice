/**
 * Created by Balaji Pachai on 12/11/18.
 */
const BCTokenContract = artifacts.require('BCToken')
const TokenRegistry = artifacts.require("TokenRegistry")
const TokenTransferProxy = artifacts.require("TokenTransferProxy")
const DebtRegistry = artifacts.require("DebtRegistry")
const RepaymentRouter = artifacts.require('RepaymentRouter');
const DebtKernel = artifacts.require('DebtKernel')
const DebtToken = artifacts.require('DebtToken')
const ContractRegistry = artifacts.require('ContractRegistry')
const Collateralizer = artifacts.require('Collateralizer')
const CollateralizedSimpleInterestTermsContract = artifacts.require('CollateralizedSimpleInterestTermsContract')
const Escrow = artifacts.require('Escrow')
const Borrower = artifacts.require('Borrower')
const EscrowRegistry = artifacts.require('EscrowRegistry')
// const SimpleInterestTermsContract = artifacts.require('SimpleInterestTermsContract')
// const LoanData = artifacts.require('LoanData')

const web3APIs = require('../reactApiConnectLayer/utils/web3Apis')
//Libraries
// const PermissionsLib = artifacts.require('PermissionsLib')
// const SafeMath = artifacts.require('SafeMath')
// const AddressUtils = artifacts.require('AddressUtils')
// const Math = artifacts.require('Math')

// DemoValues has all the hard-coded values, that we use for testing purposes
const demoValues = require('../reactApiConnectLayer/debtLifeCycle/demoValues/demoValues')

module.exports = function (deployer, network, accounts) {
    //For all .sol files
    const owner = accounts[0]
    const fixedDepositAmount = demoValues.deploymentValues.escrowFixedDepositAmount

    //Deploy all contracts
    deployer.deploy(BCTokenContract, {from: owner} ).then(function () {
        return deployer.deploy(TokenRegistry,{ from:owner })
    }).then(function () {
        return deployer.deploy(TokenTransferProxy,{ from:owner })
    }).then(function () {
        return deployer.deploy(DebtKernel, TokenTransferProxy.address, {from: owner})
    }).then(function(){
        return deployer.deploy(DebtRegistry, { from:owner })
    }).then(function () {
        return deployer.deploy(RepaymentRouter, DebtRegistry.address, TokenTransferProxy.address, {from: owner} )
    }).then(function(){
        return deployer.deploy(DebtToken, DebtRegistry.address, {from: owner} )
    }).then(function(){
        return deployer.deploy(Collateralizer, DebtKernel.address, DebtRegistry.address, TokenRegistry.address, TokenTransferProxy.address,{ from:owner })
    }).then(function(){
        return deployer.deploy(ContractRegistry, Collateralizer.address, DebtKernel.address, DebtRegistry.address, DebtToken.address, RepaymentRouter.address, TokenRegistry.address, TokenTransferProxy.address, { from: owner})
    }).then(function () {
        return deployer.deploy(CollateralizedSimpleInterestTermsContract, ContractRegistry.address, { from: owner })
    }).then(function () {
        return deployer.deploy(EscrowRegistry, {from: owner} )
    }).then(function () {
        //Deploy the Escrow contract
        return deployer.deploy(Escrow, BCTokenContract.address, DebtToken.address, DebtRegistry.address, EscrowRegistry.address, fixedDepositAmount, {from: owner} )
    }).then(function () {
        return deployer.deploy(Borrower, BCTokenContract.address, DebtRegistry.address, CollateralizedSimpleInterestTermsContract.address, EscrowRegistry.address, RepaymentRouter.address, {from: owner} )
    })
}
