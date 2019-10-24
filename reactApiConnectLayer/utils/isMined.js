const Web3 = require('web3');
const config = require('../../truffle')
let ENVIRONMENT = 'goerli' //default environment
if (process.env.TEST_NETWORK !== undefined) {
    ENVIRONMENT = config.networks[process.env.TEST_NETWORK].name
}
const web3  = new Web3(new Web3.providers.HttpProvider(config.networks[ENVIRONMENT].protocol + '://' + config.networks[ENVIRONMENT].host + ':' + config.networks[ENVIRONMENT].port));

const checkMining = async function (txhash) {
    console.log('transaction hash in checkMining: ', txhash)
    return new Promise((resolve) => {
        const filter = web3.eth.filter('latest');
        filter.watch(function () {
            let receipt = web3.eth.getTransactionReceipt(txhash)
            do {
                if (receipt && receipt.transactionHash === txhash) {
                    if (web3.eth.getTransaction(txhash).blockNumber) {
                        filter.stopWatching();
                        resolve(web3.eth.getBlock(web3.eth.getTransaction(txhash).blockNumber));
                        break
                    }
                }
            } while (!web3.eth.getTransaction(txhash).blockNumber);
        });
    })
}

module.exports = {
    checkMining
};
