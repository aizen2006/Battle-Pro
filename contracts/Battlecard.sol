// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BattleCard is ERC721, Ownable {
    uint256 public nextId = 1;
    struct Card {
        uint256 power;
        uint256 defense;
        uint256 speed;
        uint8 rarity; // 1-5
    }
    mapping(uint256 => Card) public cards;

    constructor() ERC721("MonadBattleCard", "MBC") Ownable(msg.sender) {}

    function mintCard() external {
        uint256 tokenId = nextId++;
        _safeMint(msg.sender, tokenId);

        // Random attributes (basic pseudo-random)
        uint256 rand = uint256(
            keccak256(abi.encodePacked(block.timestamp, msg.sender, tokenId))
        );
        cards[tokenId] = Card({
            power: (rand % 50) + 50,
            defense: (rand % 40) + 30,
            speed: (rand % 20) + 10,
            rarity: uint8((rand % 5) + 1)
        });
    }

    function getCard(uint256 tokenId) external view returns (Card memory) {
        return cards[tokenId];
    }
    function battle(uint256 card1, uint256 card2) external view returns (string memory) {
        Card memory c1 = cards[card1];
        Card memory c2 = cards[card2];
        require(ownerOf(card1) != address(0) && ownerOf(card2) != address(0), "Invalid card");

        // Compute simple battle score
        uint256 score1 = c1.power + c1.defense / 2 + c1.speed;
        uint256 score2 = c2.power + c2.defense / 2 + c2.speed;

        // Add randomness
        uint256 rand = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender))) % 10;
        score1 += rand;
        score2 += (10 - rand);

        if (score1 > score2) return "Card 1 Wins!";
        else if (score2 > score1) return "Card 2 Wins!";
        else return "Draw!";
    }
    function upgrade(uint256 id1, uint256 id2) external {
        require(ownerOf(id1) == msg.sender && ownerOf(id2) == msg.sender, "Not owner");

        _burn(id1);
        _burn(id2);

        uint256 newId = nextId++;
        _safeMint(msg.sender, newId);

        Card memory c1 = cards[id1];
        Card memory c2 = cards[id2];

        cards[newId] = Card({
            power: (c1.power + c2.power) / 2 + 10,
            defense: (c1.defense + c2.defense) / 2 + 5,
            speed: (c1.speed + c2.speed) / 2 + 5,
            rarity: uint8((c1.rarity + c2.rarity) / 2 + 1)
        });
    }


}
