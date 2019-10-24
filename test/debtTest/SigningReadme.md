**Steps to get the r,s and v of ECDSA using ethereumjs-util and web3**

**1. Connect to the local Blockchain instance**

i). `const Web3 = require('web3')`

ii). `const web3 = new web3(new web3.providers.HttpProvider('PROTOCOL://IP:PORT_NO'));`

`PROTOCOL: http or https`

`IP: System on which the blockchain instance is running`

`PORT_NO: Port no on which the blockchain instance is accepting RPC connections`

**2. Get the ethereumjs-util npm library**
i). `const ethjsUtil = require('ethereumjs-util')`

**3. Get the r,s and v components of the ECDSA**
i). `const hashedMessage = web3.sha3('Hashed Message') `
`'0x26265dfc4e0d3c75f485cddd88d83d7d7c6bc9874be856d3d43b6f3720963014'` The hash depends on the message

ii). `const coinbase = web3.eth.accounts[0]` //Signing from the 0th account

iii). `const rsvCoinbase = ethJsUtil.fromRpcSig(web3.eth.sign(coinbase, hashedMessage))`

`{ v: 28,
   r: <Buffer 8f 68 8e d0 08 b0 10 df 89 31 06 ed e6 66 ed 83 d2 65 73 ab b6 cf 32 c1 f5 01 e1 2d 2f e8 a2 56>,
   s: <Buffer 52 89 e9 2c d8 92 c3 54 1b 1f 36 9e a0 7f 06 2f db 05 13 e8 c7 a6 fd ca 2f a2 9a 81 bd d8 c8 c5> }
`

iv). `r = ethJsUtil.bufferToHex(rsvCoinbase.r)`
`0x8f688ed008b010df893106ede666ed83d26573abb6cf32c1f501e12d2fe8a256`

v). `s = ethJsUtil.bufferToHex(rsvCoinbase.s)`
`0x5289e92cd892c3541b1f369ea07f062fdb0513e8c7a6fdca2fa29a81bdd8c8c5`

vi). `v = rsvCoinbase.v`

    `28`