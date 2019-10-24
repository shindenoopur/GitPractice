**1. Add a token in tokenRegistry and get it's index**

tokenSymbol = await  erc20TokenInstance.symbol.call()

tokenAddress = erc20TokenInstance.address

tokenName = await  erc20TokenInstance.name.call()

numberOfDecimals = await  erc20TokenInstance.decimals.call()


`await tokenRegistryInstance.setTokenAttributes(tokenSymbol, tokenAddress, tokenName, numberOfDecimals, { from: owner })`

_tokenIndex_ = `await tokenRegistryInstance.getTokenIndexBySymbol.call(tokenSymbol)`

**principalTokenIndex = tokenIndex**

**2.Other Params**

**principalAmount = 1000**

**interestRate = 10**
                                        
**amortizationUnit = 1**

**termLength = 100** 

`Get the ERC20 Collateral Token details`

collateralTokenSymbol = await  erc20TokenInstance.symbol.call()
collateralTokenAddress = erc20TokenInstance.address
collateralTokenName = await  erc20TokenInstance.name.call()
numberOfDecimals = await  erc20TokenInstance.decimals.call()

`await tokenRegistryInstance.setTokenAttributes(collateralTokenSymbol, collateralTokenAddress, collateralTokenName, numberOfDecimals, { from: owner })`

**collateralTokenIndex = `await tokenRegistryInstance.getTokenIndexBySymbol.call(collateralTokenSymbol)**`

**collateralAmount = 500**

**gracePeriodInDays = 2**

**3.Get the termsContractParameters**

 _termsContractParameters_ = `customFunctions.getTermsContractParameters(principalTokenIndex, principalAmount, interestRate, amortizationUnit, termLength, collateralTokenIndex, collateralAmount, gracePeriodInDays)`
 
 `termsContractParameters = 0x010000000000000000000003e800000530005020000000000000000000145006` 
 
 Depending on the input parameters to customFunctions.getTermsContractParameters() the termsContractParameters hash will change.
 
 
 /*Include in some other document*/

**Insert into DebtRegistry**
 
debtor = accounts[1]

version = accounts[2]

beneficiary = accounts[3]

underwriter = accounts[4]

underwriterRiskRating = 1000

termsContract = simpleInterestTermsInstance.address 

termsContractParameters as calculated from above      

**Add authorized agent first**

await debtRegistryInstance.addAuthorizedInsertAgent(owner)

await debtRegistryInstance.insert(version, beneficiary, debtor, underwriter, underwriterRiskRating, termsContract, termsContractParameters, salt, {from: owner})