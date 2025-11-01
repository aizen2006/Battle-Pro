// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BattleCard
 * @notice ERC721 NFT contract for Monad Battle Cards
 * @dev Gas-optimized card storage with uint16 stats and uint8 enums
 */
contract BattleCard is ERC721, Ownable, ReentrancyGuard {
    uint256 public constant MINT_FEE = 0.001 ether;
    uint256 public nextId = 1;

    // Character types: 0=Warrior, 1=Mage, 2=Cavalry, 3=Prince
    enum CharacterType {
        Warrior,
        Mage,
        Cavalry,
        Prince
    }

    // Rarity levels: 0=Common, 1=Rare, 2=Epic, 3=Legendary, 4=Mythic
    enum Rarity {
        Common,
        Rare,
        Epic,
        Legendary,
        Mythic
    }

    // Gas-optimized struct: packed to minimize storage operations
    struct Card {
        uint16 power;     // 0-65535
        uint16 defense;   // 0-65535
        uint16 speed;     // 0-65535
        uint8 character;  // 0-3
        uint8 rarity;     // 0-4
    }

    mapping(uint256 => Card) public cards;
    mapping(address => uint256[]) private _ownedTokens;

    // Events
    event CardMinted(
        address indexed owner,
        uint256 indexed tokenId,
        uint8 character,
        uint8 rarity,
        uint16 power,
        uint16 defense,
        uint16 speed
    );

    constructor() ERC721("MonadBattleCard", "MBC") Ownable(msg.sender) {}

    /**
     * @notice Mint a new battle card for 0.001 MON
     * @return tokenId The newly minted token ID
     */
    function mintCard() external payable nonReentrant returns (uint256) {
        require(msg.value == MINT_FEE, "Incorrect mint fee");

        uint256 tokenId = nextId++;
        _safeMint(msg.sender, tokenId);
        _ownedTokens[msg.sender].push(tokenId);

        // Generate pseudo-random seed
        uint256 rand = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    msg.sender,
                    tokenId,
                    blockhash(block.number - 1)
                )
            )
        );

        // Determine rarity (0-99)
        uint8 rarityVal = _determineRarity(rand % 100);
        // Determine character type (0-3)
        uint8 characterType = uint8((rand / 100) % 4);

        // Generate stats based on rarity
        (uint16 power, uint16 defense, uint16 speed) = _generateStats(
            Rarity(rarityVal),
            rand
        );

        cards[tokenId] = Card({
            power: power,
            defense: defense,
            speed: speed,
            character: characterType,
            rarity: rarityVal
        });

        emit CardMinted(
            msg.sender,
            tokenId,
            characterType,
            rarityVal,
            power,
            defense,
            speed
        );

        return tokenId;
    }

    /**
     * @notice Get card attributes
     * @param tokenId The token ID to query
     * @return Card struct with all attributes
     */
    function getCard(uint256 tokenId) external view returns (Card memory) {
        return cards[tokenId];
    }

    /**
     * @notice Get all token IDs owned by an address (simplified for MVP)
     * @param owner The owner address
     * @return Array of token IDs
     */
    function getOwnedTokens(address owner) external view returns (uint256[] memory) {
        return _ownedTokens[owner];
    }

    /**
     * @notice Transfer hook to update ownership tracking
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        
        if (from != address(0)) {
            // Remove from old owner's list
            uint256[] storage oldOwnerTokens = _ownedTokens[from];
            for (uint256 i = 0; i < oldOwnerTokens.length; i++) {
                if (oldOwnerTokens[i] == tokenId) {
                    oldOwnerTokens[i] = oldOwnerTokens[oldOwnerTokens.length - 1];
                    oldOwnerTokens.pop();
                    break;
                }
            }
        }

        if (to != address(0) && from != to) {
            // Add to new owner's list
            _ownedTokens[to].push(tokenId);
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Determine rarity based on probability
     * @param randValue Random value 0-99
     * @return Rarity enum value (0-4)
     */
    function _determineRarity(uint256 randValue) internal pure returns (uint8) {
        if (randValue < 60) return 0;      // Common: 60% (0-59)
        if (randValue < 85) return 1;      // Rare: 25% (60-84)
        if (randValue < 95) return 2;      // Epic: 10% (85-94)
        if (randValue < 99) return 3;      // Legendary: 4% (95-98)
        return 4;                           // Mythic: 1% (99)
    }

/**
 * @notice Generate stats within rarity-appropriate ranges
 * @param rarity The rarity level
 * @param randSeed Random seed for stat generation
 * @return power The generated power value
 * @return defense The generated defense value
 * @return speed The generated speed value
 */
    function _generateStats(Rarity rarity, uint256 randSeed)
        internal
        pure
        returns (uint16 power, uint16 defense, uint16 speed)
    {
        uint256 seed1 = randSeed;
        uint256 seed2 = randSeed / 10000;
        uint256 seed3 = randSeed / 1000000;

        if (rarity == Rarity.Common) {
            power = uint16((seed1 % 31) + 50);      // 50-80
            defense = uint16((seed2 % 31) + 30);    // 30-60
            speed = uint16((seed3 % 21) + 10);       // 10-30
        } else if (rarity == Rarity.Rare) {
            power = uint16((seed1 % 31) + 80);      // 80-110
            defense = uint16((seed2 % 31) + 60);    // 60-90
            speed = uint16((seed3 % 21) + 20);      // 20-40
        } else if (rarity == Rarity.Epic) {
            power = uint16((seed1 % 41) + 110);     // 110-150
            defense = uint16((seed2 % 31) + 90);    // 90-120
            speed = uint16((seed3 % 31) + 30);      // 30-60
        } else if (rarity == Rarity.Legendary) {
            power = uint16((seed1 % 61) + 150);     // 150-210
            defense = uint16((seed2 % 51) + 120);   // 120-170
            speed = uint16((seed3 % 41) + 50);      // 50-90
        } else {
            // Mythic
            power = uint16((seed1 % 91) + 210);      // 210-300
            defense = uint16((seed2 % 81) + 170);   // 170-250
            speed = uint16((seed3 % 71) + 80);      // 80-150
        }
    }

    /**
     * @notice Owner withdrawal function for collected mint fees
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @notice Batch transfer approval helper for battles
     * @param to The contract to approve
     * @param tokenIds Array of token IDs to approve
     */
    function batchApprove(address to, uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(ownerOf(tokenIds[i]) == msg.sender, "Not owner");
            approve(to, tokenIds[i]);
        }
    }
}