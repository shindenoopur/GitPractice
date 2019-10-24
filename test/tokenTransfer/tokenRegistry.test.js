/**
 * Created by Baljai on 29/10/18.
 */

const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const TokenRegistry = artifacts.require('TokenRegistry')
const BCToken = artifacts.require('BCToken')

contract('Token Registry Test Suite', async (accounts) => {
    describe('TokenRegistry [ is Ownable ]', async () => {

        let tokenRegistryInstance, erc20TokenInstance
        let txObject
        let tokenSymbol, tokenAddress, tokenName, numberOfDecimals
        let tokenIndex // will be used in all other functions that uses the tokenIndex
        let expectedTokenAttributes

        const owner = accounts[0]

        before(async () => {
            tokenRegistryInstance = await TokenRegistry.new({ from: owner })
            erc20TokenInstance = await BCToken.new({ from: owner })
        })

        describe('Get token details', async () => {
            it('Should get the token details', async () => {
                tokenSymbol = await  erc20TokenInstance.symbol.call()
                tokenAddress = erc20TokenInstance.address
                tokenName = await  erc20TokenInstance.name.call()
                numberOfDecimals = await  erc20TokenInstance.decimals.call()

                expectedTokenAttributes = {
                    0: tokenAddress,
                    1: 0,
                    2: tokenName,
                    3: numberOfDecimals.toNumber()
                } // 0 will be updated , when we fetch the index of the token
            })
        })

        describe('setTokenAttributes(string _symbol, address _tokenAddress, string _tokenName, uint8 _numDecimals) public onlyOwner', async() => {
            it('Should succeed for setTokenAttributes for valid contract token address', async() => {
                txObject = await  tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, { from: owner })
                assert.equal(txObject.receipt.status, true, 'Failed while invoking setTokenAttributes')
            })

        })

            describe('Has setTokenAttributes() executed as expected', async () => {

                it('Should getTokenAddressBySymbol(string _symbol) public view returns (address)', async () => {
                    let tokenAddressBySymbol = await  tokenRegistryInstance.getTokenAddressBySymbol.call(tokenSymbol)
                    assert.equal(tokenAddressBySymbol, tokenAddress, 'Token address by getTokenAddressBySymbol() do not match')
                })

                it('Should getTokenIndexBySymbol(string _symbol) public view returns (uint)', async () => {
                    tokenIndex = await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)
                    expectedTokenAttributes[1] = tokenIndex.toNumber()
                    assert.ok('Fetched token index successfully')
                })

                it('Should getTokenAddressByIndex(uint _index) public view returns (address)', async () => {
                    let tokenAddressByIndex = await  tokenRegistryInstance.getTokenAddressByIndex.call(tokenIndex)
                    assert.equal(tokenAddressByIndex, tokenAddress, 'Token address by getTokenAddressByIndex() do not match')
                })

                it('Should getTokenSymbolByIndex(uint _index) public view returns (string)', async () => {
                    let tokenSymbolByIndex = await tokenRegistryInstance.getTokenSymbolByIndex.call(tokenIndex)
                    assert.equal(tokenSymbolByIndex, tokenSymbol, 'Token symbol by getTokenSymbolByIndex() do not match')
                })

                it('Should getTokenNameBySymbol(string _symbol) public view returns (string)', async () => {
                    let tokenNameBySymbol = await tokenRegistryInstance.getTokenNameBySymbol.call(tokenSymbol)
                    assert.equal(tokenNameBySymbol, tokenName, 'Token name by getTokenNameBySymbol() do not match')
                })

                it('Should getNumDecimalsFromSymbol(string _symbol) public view returns (uint8)', async() => {
                    let numOfDecimals = await  tokenRegistryInstance.getNumDecimalsFromSymbol.call(tokenSymbol)
                    assert.equal(numOfDecimals.toNumber(), numberOfDecimals.toNumber(), 'Number of decimals by getNumDecimalsFromSymbol() do not match')
                })

                it('Should getNumDecimalsByIndex(uint _index) public view returns (uint8)', async () => {
                    let numOfDecimals = await  tokenRegistryInstance.getNumDecimalsByIndex.call(tokenIndex)
                    assert.equal(numOfDecimals.toNumber(), numberOfDecimals.toNumber(), 'Number of decimals by getNumDecimalsByIndex() do not match')
                })

                it('Should getTokenNameByIndex(uint _index) public view returns (string)', async() => {
                    let tokenNameByIndex = await tokenRegistryInstance.getTokenNameByIndex.call(tokenIndex)
                    assert.equal(tokenNameByIndex, tokenName, 'Token name by getTokenNameByIndex() do not match')
                })

                it('Should getTokenAttributesBySymbol(string _symbol) public view returns (address, uint, string, uint)', async () => {
                    let actualTokenAttributes = await tokenRegistryInstance.getTokenAttributesBySymbol.call(tokenSymbol)
                    actualTokenAttributes[1] = actualTokenAttributes[1].toNumber()
                    actualTokenAttributes[3] = actualTokenAttributes[3].toNumber()
                    assert.deepEqual(actualTokenAttributes , expectedTokenAttributes, 'Token attributes by getTokenAttributesBySymbol() do not match')
                })

                it('Should getTokenAttributesByIndex(uint _index) public view returns (address, string, string, uint8)', async () => {
                    expectedTokenAttributes[1] = tokenSymbol //since here the token attributes is being fetched by tokenIndex
                    let actualTokenAttributes = await  tokenRegistryInstance.getTokenAttributesByIndex.call(tokenIndex)
                    actualTokenAttributes[3] = actualTokenAttributes[3].toNumber()
                    assert.deepEqual(actualTokenAttributes , expectedTokenAttributes, 'Token attributes by getTokenAttributesByIndex() do not match')
                })
            })
    })
})