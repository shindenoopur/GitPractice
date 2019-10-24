`Performing a transaction using MultiSigWallet`

**1. Get the Hex equivalent of the function**

_getData():_

`data = contractInstance.contract.functionName.getData(arguments)`

**2. submitTransaction**
`walletInstance.submitTransaction(contractAddress, 0, data, {from: walletOwner, gas: 3000000})`

**3. Get the Transaction Index**

`txIds = walletInstance.getTransactionIds.call(0, 1, true, false)`

`txCount = walletInstance.getTransactionCount.call(true, false)`

`transactionIndex = txIds.length`

**4. Confirm the transaction**

`walletInstance.confirmTransaction(transactionIndex, {from: owner2})`

Note: Grant the required number of confirmations, in order that the transaction executes successfully.

**If the contractAddress is other than MultiSigWallet in that case:**

Change ownership of that contract to MultiSigWallet and then perform transaction using MultiSigWallet