const fs = require('fs')
const solc = require('solc')
const Web3 = require('web3');

const provider = process.argv[2]
const gas = process.argv[3]
const network = process.argv[4]
const web3 = new Web3(new Web3.providers.HttpProvider(provider))

const BCTokenJSON = require('./build/contracts/BCToken')
const TokenRegistryJSON = require('./build/contracts/TokenRegistry')
const EscrowRegistryJSON = require('./build/contracts/EscrowRegistry')
const TokenTransferProxyJSON = require('./build/contracts/TokenTransferProxy')
const DebtRegistryJSON = require('./build/contracts/DebtRegistry')
const DebtKernelJSON = require('./build/contracts/DebtKernel')
const RepaymentRouterJSON = require('./build/contracts/RepaymentRouter')
const DebtTokenJSON = require('./build/contracts/DebtToken')
const CollateralizerJSON = require('./build/contracts/Collateralizer')
const ContractRegistryJSON = require('./build/contracts/ContractRegistry')
const CollateralizedSimpleInterestTermsContractJSON = require('./build/contracts/CollateralizedSimpleInterestTermsContract')
const EscrowJSON = require('./build/contracts/Escrow')
const BorrowerJSON = require('./build/contracts/Borrower')

const input = {
    language: "Solidity",
    sources: {
        'FlattenedDebtKernel.sol': fs.readFileSync('./contracts/Debt/FlattenedDebtKernel.sol', 'utf-8')
    }
}
const output = solc.compile(input, 1)

function getNetworkId(networkName) {
    switch (networkName) {
        case 'goerli': return '5'
        case 'ganache': return '5777'
        case 'development': return '8777'
        case 'localPoA': return '7777'
    }
}


//Function that deploys the contract and writes the updated contract address and transaction hash to build/contracts/.json file
function deployContractX(contractName, jsonFile) {
    return new Promise(async (resolve, reject) => {
        let bytecode, abi, contract, result
        try {
            bytecode = output.contracts[`FlattenedDebtKernel.sol:${contractName}`].bytecode
            abi = JSON.parse(output.contracts[`FlattenedDebtKernel.sol:${contractName}`].interface)
            contract = web3.eth.contract(abi);
            result = await deployContract(contract, bytecode, contractName)
            console.log(`${contractName} address: `, result.data[0])
            jsonFile.networks[getNetworkId(network)].address = result.data[0]
            jsonFile.networks[getNetworkId(network)].transactionHash = result.data[1]
            fs.writeFile(`./build/contracts/${contractName}.json`, JSON.stringify(jsonFile, null, 2), function(err) {
                if (err) return console.log(err)
                resolve({
                    status: 'success',
                    message: `Deployed contract ${contractName} successfully`
                })
            })
        } catch (error) {
            console.log('error in deployContractX: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

//Function that deploys all the contracts
function deployAllDependentContracts() {
    return new Promise(async (resolve, reject) => {
        try {
            await deployContractX('BCToken', BCTokenJSON)
            await deployContractX('TokenRegistry', TokenRegistryJSON)
            await deployContractX('TokenTransferProxy', TokenTransferProxyJSON)
            await deployContractX('DebtRegistry', DebtRegistryJSON)
            await deployContractX('EscrowRegistry', EscrowRegistryJSON)
            await deployContractX('DebtKernel', DebtKernelJSON)
            await deployContractX('RepaymentRouter', RepaymentRouterJSON)
            await deployContractX('DebtToken', DebtTokenJSON)
            await deployContractX('Collateralizer', CollateralizerJSON)
            await deployContractX('ContractRegistry', ContractRegistryJSON)
            await deployContractX('CollateralizedSimpleInterestTermsContract', CollateralizedSimpleInterestTermsContractJSON)
            await deployContractX('Escrow', EscrowJSON)
            await deployContractX('Borrower', BorrowerJSON)
        } catch(error) {
            console.log('error in deployAllDependentContracts: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function deployIndependentContract(contract, bytecode) {
    return new Promise((resolve, reject) => {
        try {
            contract.new({ data: '0x' + bytecode, from: web3.eth.coinbase, gas: gas }, (err, res) => {
                if (err) {
                    console.log(err)
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    if (res.address) {
                        console.log('TransactionHash: ', res.transactionHash)
                        console.log('Contract address: ' + res.address);
                        resolve({
                            status: 'success',
                            message: 'Contract deployed successfully',
                            data: [res.address, res.transactionHash]
                        })
                    }
                }
            })
        } catch (error) {
            console.log('error in deployIndependentContract: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function deployDebtKernel(contract, bytecode) {
    return new Promise((resolve, reject) => {
        try {
            console.log('In deployDebtKernel TokenTransferProxy address: ', TokenTransferProxyJSON.networks[getNetworkId(network)].address)
            contract.new(TokenTransferProxyJSON.networks[getNetworkId(network)].address, { data: '0x' + bytecode, from: web3.eth.coinbase, gas: gas }, (err, res) => {
                if (err) {
                    console.log(err)
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    if (res.address) {
                        console.log('TransactionHash: ', res.transactionHash)
                        console.log('Contract address: ' + res.address);
                        resolve({
                            status: 'success',
                            message: 'Contract deployed successfully',
                            data: [res.address, res.transactionHash]
                        })
                    }
                }
            })
        } catch (error) {
            console.log('error in deployDebtKernel: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function deployRepaymentRouter(contract, bytecode) {
    return new Promise((resolve, reject) => {
        try {
            contract.new(DebtRegistryJSON.networks[getNetworkId(network)].address, TokenTransferProxyJSON.networks[getNetworkId(network)].address, { data: '0x' + bytecode, from: web3.eth.coinbase, gas: gas }, (err, res) => {
                if (err) {
                    console.log(err)
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    if (res.address) {
                        console.log('TransactionHash: ', res.transactionHash)
                        console.log('Contract address: ' + res.address);
                        resolve({
                            status: 'success',
                            message: 'Contract deployed successfully',
                            data: [res.address, res.transactionHash]
                        })
                    }
                }
            })
        } catch (error) {
            console.log('error in deployRepaymentRouter: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function deployDebtToken(contract, bytecode) {
    return new Promise((resolve, reject) => {
        try {
            contract.new(DebtRegistryJSON.networks[getNetworkId(network)].address, { data: '0x' + bytecode, from: web3.eth.coinbase, gas: gas }, (err, res) => {
                if (err) {
                    console.log(err)
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    if (res.address) {
                        console.log('TransactionHash: ', res.transactionHash)
                        console.log('Contract address: ' + res.address);
                        resolve({
                            status: 'success',
                            message: 'Contract deployed successfully',
                            data: [res.address, res.transactionHash]
                        })
                    }
                }
            })
        } catch (error) {
            console.log('error in deployDebtToken: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function deployCollateralizer(contract, bytecode) {
    return new Promise((resolve, reject) => {
        try {
            contract.new(DebtKernelJSON.networks[getNetworkId(network)].address, DebtRegistryJSON.networks[getNetworkId(network)].address, TokenRegistryJSON.networks[getNetworkId(network)].address, TokenTransferProxyJSON.networks[getNetworkId(network)].address, { data: '0x' + bytecode, from: web3.eth.coinbase, gas: gas }, (err, res) => {
                if (err) {
                    console.log(err)
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    if (res.address) {
                        console.log('TransactionHash: ', res.transactionHash)
                        console.log('Contract address: ' + res.address);
                        resolve({
                            status: 'success',
                            message: 'Contract deployed successfully',
                            data: [res.address, res.transactionHash]
                        })
                    }
                }
            })
        } catch (error) {
            console.log('error in deployCollateralizer: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function deployContractRegistry(contract, bytecode) {
    return new Promise((resolve, reject) => {
        try {
            contract.new(CollateralizerJSON.networks[getNetworkId(network)].address, DebtKernelJSON.networks[getNetworkId(network)].address, DebtRegistryJSON.networks[getNetworkId(network)].address, DebtTokenJSON.networks[getNetworkId(network)].address, RepaymentRouterJSON.networks[getNetworkId(network)].address, TokenRegistryJSON.networks[getNetworkId(network)].address, TokenTransferProxyJSON.networks[getNetworkId(network)].address, { data: '0x' + bytecode, from: web3.eth.coinbase, gas: gas }, (err, res) => {
                if (err) {
                    console.log(err)
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    if (res.address) {
                        console.log('TransactionHash: ', res.transactionHash)
                        console.log('Contract address: ' + res.address);
                        resolve({
                            status: 'success',
                            message: 'Contract deployed successfully',
                            data: [res.address, res.transactionHash]
                        })
                    }
                }
            })
        } catch (error) {
            console.log('error in deployContractRegistry: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function deployCollateralizedSimpleInterestTermsContract(contract, bytecode) {
    return new Promise((resolve, reject) => {
        try {
            contract.new(ContractRegistryJSON.networks[getNetworkId(network)].address, { data: '0x' + bytecode, from: web3.eth.coinbase, gas: gas }, (err, res) => {
                if (err) {
                    console.log(err)
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    if (res.address) {
                        console.log('TransactionHash: ', res.transactionHash)
                        console.log('Contract address: ' + res.address);
                        resolve({
                            status: 'success',
                            message: 'Contract deployed successfully',
                            data: [res.address, res.transactionHash]
                        })
                    }
                }
            })
        } catch (error) {
            console.log('error in deployCollateralizedSimpleInterestTermsContract: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function deployEscrow(contract, bytecode) {
    return new Promise((resolve, reject) => {
        try {
            contract.new(BCTokenJSON.networks[getNetworkId(network)].address, DebtTokenJSON.networks[getNetworkId(network)].address, DebtRegistryJSON.networks[getNetworkId(network)].address, EscrowRegistryJSON.networks[getNetworkId(network)].address, 10000, { data: '0x' + bytecode, from: web3.eth.coinbase, gas: gas }, (err, res) => {
                if (err) {
                    console.log(err)
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    if (res.address) {
                        console.log('TransactionHash: ', res.transactionHash)
                        console.log('Contract address: ' + res.address);
                        resolve({
                            status: 'success',
                            message: 'Contract deployed successfully',
                            data: [res.address, res.transactionHash]
                        })
                    }
                }
            })
        } catch (error) {
            console.log('error in deployEscrow: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

function deployBorrower(contract, bytecode) {
    return new Promise((resolve, reject) => {
        try {
            contract.new(BCTokenJSON.networks[getNetworkId(network)].address, DebtRegistryJSON.networks[getNetworkId(network)].address, CollateralizedSimpleInterestTermsContractJSON.networks[getNetworkId(network)].address,EscrowRegistryJSON.networks[getNetworkId(network)].address, RepaymentRouterJSON.networks[getNetworkId(network)].address, { data: '0x' + bytecode, from: web3.eth.coinbase, gas: gas }, (err, res) => {
                if (err) {
                    console.log(err)
                    reject({
                        status: 'failure',
                        message: err.message,
                        data: []
                    })
                } else {
                    if (res.address) {
                        console.log('TransactionHash: ', res.transactionHash)
                        console.log('Contract address: ' + res.address);
                        resolve({
                            status: 'success',
                            message: 'Contract deployed successfully',
                            data: [res.address, res.transactionHash]
                        })
                    }
                }
            })
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


//Function that deploys the contract
function deployContract(contract, bytecode, contractName) {
    return new Promise(async (resolve, reject) => {
        try {
            switch (contractName) {
                case 'BCToken':
                    resolve(await deployIndependentContract(contract, bytecode))
                    break

                case 'TokenRegistry':
                    resolve(await deployIndependentContract(contract, bytecode))
                    break

                case 'TokenTransferProxy':
                    resolve(await deployIndependentContract(contract, bytecode))
                    break

                case 'DebtRegistry':
                    resolve(await deployIndependentContract(contract, bytecode))
                    break

                case 'EscrowRegistry':
                    resolve(await deployIndependentContract(contract, bytecode))
                    break

                case 'DebtKernel':
                    resolve(await deployDebtKernel(contract, bytecode))
                    break

                case 'RepaymentRouter':
                    resolve(await deployRepaymentRouter(contract, bytecode))
                    break

                case 'DebtToken':
                    resolve(await deployDebtToken(contract, bytecode))
                    break

                case 'Collateralizer':
                    resolve(await deployCollateralizer(contract, bytecode))
                    break


                case 'ContractRegistry':
                    resolve(await deployContractRegistry(contract, bytecode))
                    break

                case 'CollateralizedSimpleInterestTermsContract':
                    resolve(await deployCollateralizedSimpleInterestTermsContract(contract, bytecode))
                    break

                case 'Escrow':
                    resolve(await deployEscrow(contract, bytecode))
                    break

                case 'Borrower':
                    resolve(await deployBorrower(contract, bytecode))
                    break

                default: console.log('No case matched in the switch statement')
                    throw new Error('No case matched')

            }
        } catch(error) {
            console.log('error in deployContract: ', error)
            reject({
                status: 'failure',
                message: error.message,
                data: []
            })
        }
    })
}

// deployAllDependentContracts()
