const BigNumber = web3.BigNumber
const chai = require('chai').use(require('chai-bignumber')(BigNumber)).use(require('chai-as-promised'))
const assert = chai.assert
const customAssert = require('../utils/assertRevert')
const customEvent = require('../utils/assertEvent')
const BC721Token = artifacts.require('BC721Token')
const ERC721HolderReceiver = artifacts.require('ERC721Holder')

contract('ERC721 token test suit @ERC721', async (accounts) => {
    describe('BC721Token [ is ERC721Token ]', async () => {
        let erc721TokenInstance
        let txObject
        let tokenIsAtIndex
        let erc721HolderInstance

        const name = 'BC721Token'
        const symbol = 'BCNFT'
        const firstTokenURI = 'This is first token URI'
        const firstTokenID = 7777

        const noOwnerAdd = '0x0000000000000000000000000000000000000000'

        const acc1 = accounts[1]
        const acc2 = accounts[2]
        const acc3 = accounts[3]
        const acc4 = accounts[4]

        before(async () => {
            erc721TokenInstance = await BC721Token.new(name, symbol) // Set the token name and symbol via the constructor
            erc721HolderInstance = await ERC721HolderReceiver.new()
        })

        describe('BC721Token: Constructor', async () => {
            it('Verify name of token', async () => {
                let tokenName = await erc721TokenInstance.name.call()
                assert.equal(name, tokenName, 'Token name doest not match')
            })

            it('Verify symbol of token', async () => {
                let tokenSymbol = await erc721TokenInstance.symbol.call()
                assert.equal(symbol, tokenSymbol, 'Token symbol does not match')
            })
        })

        describe('BC721Token:mintToken(address _to, uint256 _tokenId, string  _tokenURI) public', async () => {
            it('Address(0) cannot mint token', async () => {
                await customAssert.assertRevert(erc721TokenInstance.mintToken(noOwnerAdd, firstTokenID, firstTokenURI))
            })

            it('Verify token doest not exist', async () => {
                let doesTokenExist = await erc721TokenInstance.chkIfExists.call(firstTokenID)
                assert.equal(doesTokenExist, false, 'Token exists')
            })

            it('Verify token was minted successfully', async () => {
                txObject = await erc721TokenInstance.mintToken(acc1, firstTokenID, firstTokenURI)
                assert.equal(txObject.receipt.status, true, 'Failed to mint token')
            })

                    describe('Check for events emitted by mintToken()', async() => {
                        
                        it('Should check for Transfer event', async() => {
                            let emittedEventArray = [{
                                event: 'Transfer',
                                args: {
                                     0: noOwnerAdd,
                                     1: acc1,
                                     2: firstTokenID,
                                    __length__: 3,
                                    from: noOwnerAdd,
                                    to: acc1,
                                    tokenId: firstTokenID
                                }
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                
            
            it('Verify the owner of token', async () => {
                let owner = await erc721TokenInstance.ownerOf.call(firstTokenID)
                
                assert.equal(owner, acc1, 'Token owner do not match')
            })

            it('Verify token exists', async () => {
                let doesTokenExist = await erc721TokenInstance.chkIfExists.call(firstTokenID)
                assert.equal(doesTokenExist, true, 'Token id does not exist')
            })

            it('Verify balance of owner', async () => {
                let balance = await erc721TokenInstance.balanceOf.call(acc1)
                assert.equal(balance.toNumber(), 1, 'Balance do not match')
            })

            it('Verify tokenURI of token', async () => {
                let tokenURI = await erc721TokenInstance.tokenURI.call(firstTokenID)
                assert.equal(tokenURI, firstTokenURI, 'Token URI do not match')
            })
        })

        describe('BC721Token:setTokenURI(uint256 _tokenId, string _uri) public ', async () => {
            let newTokenURI = 'Changed firstToken URI'

            it('URI can only be set only on existing token', async () => {
                let nonExistingTokenId = 1234
                await customAssert.assertRevert(erc721TokenInstance.setTokenURI(nonExistingTokenId, newTokenURI))
            })

            it('Change the token URI', async () => {
                txObject = await erc721TokenInstance.setTokenURI(firstTokenID, newTokenURI)
                assert.equal(txObject.receipt.status, true, 'Failed to set token URI')
            })

            it('Verify token URI has changed', async () => {
                let tokenURI = await erc721TokenInstance.tokenURI.call(firstTokenID)
                assert.equal(tokenURI, newTokenURI, 'Token URI do not match')
            })
        })
        
        /*Functionality for addTokenTo differs in updated version of openzeppelin*/ 
        // describe('BC721Token:_addTokenTo(address _to, uint256 _tokenId) public', async () => {

        //     it('Token owner cannot be substituted directly', async () => {
        //         await customAssert.assertRevert(erc721TokenInstance._addTokenTo(acc2, firstTokenID))
        //     })

        //     it('First remove owner of token', async () => {
        //         txObject = await erc721TokenInstance._removeTokenFrom(acc1, firstTokenID)
        //         assert.equal(txObject.receipt.status, true, 'Failed to remove owner of firstTokenID')
        //     })

        //     it('Add new owner of token after removal of previous owner', async () => {
        //         await erc721TokenInstance._addTokenTo(acc4, firstTokenID)
        //         let owner = await erc721TokenInstance.ownerOf.call(firstTokenID)
        //         assert.equal(owner, acc4, 'Token owner do not match')
        //     })
        // })

        describe('ERC721Token [ is SupportsInterfaceWithLookup, ERC721BasicToken, ERC721 ]', async () => {
            let ownedTokensIndex

            it('Verify total supply', async () => {
                let totalSupply = await erc721TokenInstance.totalSupply.call()
                assert.equal(totalSupply.toNumber(), 1, 'Total supply do not match')
            })

            it('Verify all token ids', async () => {
                let actualTokenIdArr = [firstTokenID]
                let expectedTokenIdArr = []

                let allTokenIds = await erc721TokenInstance.getAllTokenIds.call()

                allTokenIds.forEach((element) => {
                    expectedTokenIdArr.push(element.toNumber())
                })
                // console.log('All token ids are: ', allTokenIds)
                assert.deepEqual(actualTokenIdArr, expectedTokenIdArr, 'All token ids do not match')
            })

            it('Verify tokens owned by an owner', async () => {
                let ownedTokensArray = await erc721TokenInstance.getOwnedTokens.call(acc1)
                let tokenId = ownedTokensArray.find((element) => {
                    if (element.toNumber() === firstTokenID)
                        return element
                })
                assert.equal(tokenId, firstTokenID, 'Owner do not match')
            })

            it('Verify token at index', async () => {
                tokenIsAtIndex = await erc721TokenInstance.getTokenIdIndex.call(firstTokenID)
                let tokenID = await erc721TokenInstance.tokenByIndex.call(tokenIsAtIndex)
                assert.equal(tokenID, firstTokenID, 'Token id at index do not match')
            })

            it('Verify token owner', async () => {
                ownedTokensIndex = await erc721TokenInstance.getOwnedTokensIndex.call(firstTokenID)
                let tokenId = await erc721TokenInstance.tokenOfOwnerByIndex.call(acc1, ownedTokensIndex)
                assert.equal(tokenId, firstTokenID, 'Token id do not match')
            })

            describe('ERC721BasicToken [ is SupportsInterfaceWithLookup, ERC721Basic ]', async () => {

                describe('approve(address _to, uint256 _tokenId) public', async () => {

                    it('Verify owner cannot approve self', async () => {
                        await customAssert.assertRevert(erc721TokenInstance.approve(acc2, firstTokenID, {from: acc2}))
                    })

                    it('Approve an account', async () => {
                        txObject = await erc721TokenInstance.approve(acc3, firstTokenID, {from: acc1})
                        assert.equal(txObject.receipt.status, true, 'Failed while approve')

                    })

                        describe('Check for events emitted by approve()', async() => {
                            it('Should check for Approve event', async() => {
                                let emittedEventArray = [{
                                    event: 'Approval',
                                    args: {
                                        0: acc1,
                                        1: acc3,
                                        2: firstTokenID,
                                        __length__: 3,
                                        owner: acc1,
                                        approved: acc3,
                                        tokenId: firstTokenID
                                    }
                                }]
                                await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                            })
                        })
                    })

                    describe('Check for events emitted by approve()', async () => {
                        
                        it('Verify Approve event was emitted', async () => {
                            let emittedEventArray = [{
                                event: 'Approval',
                                args: {
                                    0: acc1,
                                    1: acc3,
                                    2: firstTokenID,
                                    __length__: 3,
                                    owner: acc1,
                                    approved: acc3,
                                    tokenId: firstTokenID
                                },
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })

                describe('setApprovalForAll(address _to, bool _approved) public', async () => {

                    it('Target address cannot be owner itself', async () => {
                        await customAssert.assertRevert(erc721TokenInstance.setApprovalForAll(acc2, true, {from: acc2}))
                    })

                    it('Owner set approval for account', async () => {
                        txObject = await erc721TokenInstance.setApprovalForAll(acc3, true, {from: acc2})
                        assert.equal(txObject.receipt.status, true, 'Failed while approve')
                    })

                        describe('Check for events emitted by setApprovalForAll()', async() => {
                            it('Should check for ApprovalForAll event', async() => {
                                let emittedEventArray = [{
                                    event: 'ApprovalForAll',
                                    args: {
                                        0: acc2,
                                        1: acc3,
                                        2: true,
                                        __length__: 3,
                                        owner: acc2,
                                        operator: acc3,
                                        approved: true
                                    }
                                }]
                                await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                            })
                        })

                    describe('Check for events emitted by setApprovalForAll()', async () => {
                        it('Verify ApprovalForAll event emitted', async () => {
                            let emittedEventArray = [{
                                event: 'ApprovalForAll',
                                args: {
                                    0: acc2,
                                    1: acc3,
                                    2: true,
                                    __length__: 3,
                                    owner: acc2,
                                    operator: acc3,
                                    approved: true,
                                },
                            }]
                            await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                        })
                    })
                })

                describe('safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes _data) public', async () => {
                    describe('Check safeTransferFrom for EOA', async() => {
                        it('Should execute safeTransferFrom for EOA', async() => {
                            txObject = await erc721TokenInstance.safeTransferFrom(acc1, acc4, firstTokenID, { from: acc1})
                            assert.equal(txObject.receipt.status, true, 'Failed to execute safeTransferFrom()')
                        })

                        it('Should verify safeTransferFrom executed successfully', async () => {
                            let newOwner = await erc721TokenInstance.ownerOf.call(firstTokenID)
                            assert.equal(newOwner, acc4, 'Owner do not match after Xfer')
                        })
                    })
                })

                describe('safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes _data) public', async () => {
                    let to, data
                    before(async () => {
                        data = new Buffer('Perform safeTransferFrom acc4 to ERC721Holder.sol')
                        to = erc721HolderInstance.address
                        // owner = erc721ReceiverInstance.address
                    })
                    describe('Check safeTransferFrom for a contract address', async() => {
                        it('Should execute safeTransferFrom for a contract address', async() => {
                            txObject = await erc721TokenInstance.safeTransferFrom(acc4, to, firstTokenID, { from: acc4})
                            assert.equal(txObject.receipt.status, true, 'Failed to execute safeTransferFrom()')
                        })
                    })

                    describe('Verify safeTransferFrom()', async () => {
                        it('Should verify safeTransferFrom executed successfully', async () => {
                            let newOwner = await erc721TokenInstance.ownerOf.call(firstTokenID)
                            assert.equal(newOwner, to, 'Owner do not match after safeTransferFrom()')
                        })
                    })
                })
            })
        

        describe('burnToken(address owner, uint256 tokenId) public', async () => {

            it('Should burn all the firstTokenID', async () => {
                txObject = await erc721TokenInstance.burnToken(erc721HolderInstance.address, firstTokenID)
                assert.equal(txObject.receipt.status, true, 'Failed to burn all the tokens')
            })

            describe('Check for events emitted by burnToken()', async () => {
                it('Should check for Transfer event', async () => {
                    let emittedEventArray = [{
                        event: 'Transfer',
                        args: {
                            0: erc721HolderInstance.address,
                            1: noOwnerAdd,
                            2: firstTokenID,
                            __length__: 3,
                            from: erc721HolderInstance.address,
                            to: noOwnerAdd,
                            tokenId: firstTokenID,
                        },
                    }]
                    await customEvent.solAllEvents(txObject, emittedEventArray, 'All events are not emitted')
                })
            })

            describe('Verify all tokens have been burned', async () => {
                it('Should verify owner after burn is address(0)', async () => {
                    await customAssert.assertRevert(erc721TokenInstance.ownerOf.call(firstTokenID))
                })
            })
        })
    
    })
    
})