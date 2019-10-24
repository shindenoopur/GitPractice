const HDWalletProvider = require("truffle-hdwallet-provider")
const MNEMONIC = 'mirror avocado fetch group hub earn office meadow depart catalog pepper hover'

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
    description: "Test Configuration",
    authors: [
        "Chaitanya Amin <chaitanyaamin@gmail.com>"
    ],
    license: "Private License. Permission to copy / modify / change / re-use NOT GIVEN.",
    // contracts_build_directory: "./output",                 // USE THIS to change <ROOT>/build/contracts directory can be out of project root.
    networks: {
        development: {
            name: "development",
            protocol: "http",
            host: "172.17.0.2",          //"localhost",
            port: 8501,
            network_id: "8777",          // Match any network id
            gas: 8000000,
            gasPrice: 1,
        },
        ganache: {
            name: "ganache",
            protocol: "http",
            host: "10.0.10.250",
            port: 8550,
            network_id: "5777",          // Match any network id
            gas: 8000000,
            gasPrice: 1,
        },

        localPoA: {
            name: "localPoA",
            protocol: "http",
            host: "10.0.10.250",
            port: 8501,
            network_id: "7777",          // Match any network id
            gas: 8000000,
            gasPrice: 1,
        },
        rinkeby: {
            provider: function () {
                return new HDWalletProvider(MNEMONIC, "https://rinkeby.infura.io/v3/275873b9f431493a89153738398abf2a", 0, 10)
            },
            network_id: 4,
            // gas: 7010000
            // name: "rinkeby",
            // provider: function () {
            //     return new HDWalletProvider(MNEMONIC, "https://goerli.infura.io/v3/275873b9f431493a89153738398abf2a", 0, 10)
            // },
            // protocol: "http",
            // host: "10.0.10.250",
            // port: 8551,
            // network_id: 4,
            // gas: 50769977 //Total gas estimate required from Ganache , Exact amount of gas was taken by Goerli network for deployment
            // gas: 33801200 //Block Limit of Goerli
            gas: 7000000
        },
        goerli: {
            name: "goerli",
            // provider: function () {
            //     return new HDWalletProvider(MNEMONIC, "https://goerli.infura.io/v3/275873b9f431493a89153738398abf2a", 0, 10)
            // },
            protocol: "http",
            host: "10.0.10.250",
            port: 8550,
            network_id: 5,
            // gas: 50769977 //Total gas estimate required from Ganache , Exact amount of gas was taken by Goerli network for deployment
            // gas: 33801200 //Block Limit of Goerli
            gas: 8000000
        },

        localTestNet: {
            name: "localTestNet",
            host: "192.168.0.125",    //"localhost",
            port: 8101,               //8545,
            network_id: "*",          // Match any network id
            gas: 4700000
        },
        coverage: {
            name: "coverage",
            host: "localhost",
            network_id: "*",
            port: 8555,    // <-- If you change this, also set the port option in .solcover.js.
            gas: 0xfffffffffff, // <-- Use this high gas value
            gasPrice: 0x01      // <-- Use this low gas price
        },
        live: {
            name: "live",
            host: "0.0.0.0", // Random IP for example purposes (do not use)
            port: 80,
            network_id: 1,        // Ethereum public network
            // optional config values:
            // gas
            // gasPrice
            // from - default address to use for any transaction Truffle makes during migrations
            // provider - web3 provider instance Truffle should use to talk to the Ethereum network.
            //          - if specified, host and port are ignored.
        },
    },
    mocha: {
        useColors: true
    },
    compilers: {
        solc: {
            version: "0.4.24",
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    test_directory: "test",
    migrations_directory: "migrations",

};
