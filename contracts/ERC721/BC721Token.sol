pragma solidity ^0.5.0; //solhint-disable compiler-fixed
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Enumerable.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Metadata.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

contract BC721Token is ERC721Enumerable, ERC721Metadata {

    uint8 public constant DECIMALS = 18;
    uint256 public constant INITIAL_SUPPLY = 10000 * (10 ** uint256(DECIMALS));

    constructor (string memory _name, string memory _symbol) public
        ERC721Metadata(_name, _symbol) { }

    /**
    * Custom accessors
    */
    function mintToken( address _to, uint256 _tokenId, string memory _tokenURI) public {
        super._mint(_to, _tokenId);
        setTokenURI(_tokenId, _tokenURI);
    }

    function setTokenURI(uint256 _tokenId, string memory _uri) public {
        super._setTokenURI(_tokenId, _uri);
    }

    function _addTokenTo(address _to, uint256 _tokenId) public {
        //  super._addTokenToOwnerEnumeration(_to, _tokenId);
        ERC721Enumerable.tryaddTokenToOwnerEnumeration(_to,_tokenId);
    }

    function _removeTokenFrom(address _from, uint256 _tokenId) public {
        // super.removeTokenFrom(_from, _tokenId);
        ERC721Enumerable.tryremoveTokenFromOwnerEnumeration(_from, _tokenId);
    }

    function burnToken(address owner, uint256 tokenId) public {
        super._burn(owner, tokenId);
    }

    /*
    * Custom accessors for internal identifiers of ERC721Full.sol
    */

    //Mapping from owner to list of owned token IDs
    //mapping(address => uint256[]) internal ownedTokens
    function getOwnedTokens(address owner) public view returns (uint256[] memory) {
        return ERC721Enumerable._tokensOfOwner(owner);
    }

    //Mapping from token ID to index of the owner tokens list
    //mapping(uint256 => uint256) internal ownedTokensIndex;
    function getOwnedTokensIndex(uint256 tokenId) public view returns (uint256) {
        // return ERC721Enumerable.ownedTokensIndex[tokenId];
        return trygetownedTokensIndex(tokenId);
    }

    // Array with all token ids, used for enumeration
    //uint256[] internal allTokens;
    function getAllTokenIds() public view returns (uint256[] memory) {
        return ERC721Enumerable.tryAlltokenId();
    }

    // Mapping from token id to position in the allTokens array
    //mapping(uint256 => uint256) internal allTokensIndex;
    function getTokenIdIndex(uint256 tokenId) public view returns (uint256) {
        //return ERC721Token.allTokensIndex[tokenId];;
    }

    function chkIfExists(uint256 tokenId) public view returns (bool) {
        return ERC721._exists(tokenId);
    }
    function chkgetownersTokens(address owner) public view returns (uint256[] memory) {
        return ERC721Enumerable._tokensOfOwner(owner);
    }
}
