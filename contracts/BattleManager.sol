// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Battlecard.sol";

/**
 * @title BattleManager
 * @notice Manages card battles, escrow, and rewards
 * @dev Handles battle flow: create -> join -> reveal rounds -> claim reward
 */
contract BattleManager is ReentrancyGuard {
    BattleCard public immutable battleCard;

    enum BattleStatus {
        WaitingForOpponent,
        ReadyToReveal,
        InProgress,
        Resolved,
        Cancelled
    }

    struct Battle {
        address starter;
        address opponent;
        uint256[3] starterCards;
        uint256[3] opponentCards;
        uint8 starterWins;
        uint8 opponentWins;
        uint8 currentRound;
        BattleStatus status;
        uint256 createdAt;
        address winner;
    }

    uint256 public battleCount;
    mapping(uint256 => Battle) public battles;
    mapping(uint256 => mapping(uint256 => bool)) public roundsRevealed; // battleId => roundIndex => revealed

    // Timeout for battle creation (e.g., 1 hour in blocks, adjust for Monad)
    uint256 public constant BATTLE_TIMEOUT = 3600; // ~1 hour at 1s block time

    // Events
    event BattleCreated(
        uint256 indexed battleId,
        address indexed starter,
        address indexed opponent,
        uint256[3] starterCards
    );

    event BattleJoined(
        uint256 indexed battleId,
        address indexed opponent,
        uint256[3] opponentCards
    );

    event RoundResolved(
        uint256 indexed battleId,
        uint8 indexed roundIndex,
        uint256 starterCardId,
        uint256 opponentCardId,
        bool starterWon
    );

    event BattleResolved(
        uint256 indexed battleId,
        address indexed winner
    );

    event CardClaimed(
        uint256 indexed battleId,
        address indexed winner,
        uint256 indexed claimedTokenId
    );

    event BattleCancelled(uint256 indexed battleId);

    constructor(address _battleCardAddress) {
        battleCard = BattleCard(_battleCardAddress);
    }

    /**
     * @notice Create a new battle challenge
     * @param opponent The opponent's address
     * @param myCards Array of exactly 3 token IDs to battle with
     * @return battleId The battle ID
     */
    function createBattle(address opponent, uint256[3] calldata myCards)
        external
        nonReentrant
        returns (uint256)
    {
        require(opponent != address(0) && opponent != msg.sender, "Invalid opponent");

        // Validate ownership and escrow cards
        for (uint256 i = 0; i < 3; i++) {
            require(battleCard.ownerOf(myCards[i]) == msg.sender, "Not owner");
            battleCard.transferFrom(msg.sender, address(this), myCards[i]);
        }

        uint256 battleId = battleCount++;
        battles[battleId] = Battle({
            starter: msg.sender,
            opponent: opponent,
            starterCards: myCards,
            opponentCards: [uint256(0), uint256(0), uint256(0)],
            starterWins: 0,
            opponentWins: 0,
            currentRound: 0,
            status: BattleStatus.WaitingForOpponent,
            createdAt: block.number,
            winner: address(0)
        });

        emit BattleCreated(battleId, msg.sender, opponent, myCards);
        return battleId;
    }

    /**
     * @notice Join an existing battle
     * @param battleId The battle ID
     * @param opponentCards Array of exactly 3 token IDs to battle with
     */
    function joinBattle(uint256 battleId, uint256[3] calldata opponentCards)
        external
        nonReentrant
    {
        Battle storage battle = battles[battleId];
        require(battle.status == BattleStatus.WaitingForOpponent, "Battle not open");
        require(battle.opponent == msg.sender, "Not the intended opponent");
        require(block.number <= battle.createdAt + BATTLE_TIMEOUT, "Battle expired");

        // Validate ownership and escrow cards
        for (uint256 i = 0; i < 3; i++) {
            require(battleCard.ownerOf(opponentCards[i]) == msg.sender, "Not owner");
            battleCard.transferFrom(msg.sender, address(this), opponentCards[i]);
        }

        battle.opponentCards = opponentCards;
        battle.status = BattleStatus.ReadyToReveal;

        emit BattleJoined(battleId, msg.sender, opponentCards);
    }

    /**
     * @notice Reveal the next round of battle (anyone can call)
     * @param battleId The battle ID
     */
    function revealRound(uint256 battleId) external {
        Battle storage battle = battles[battleId];
        require(battle.status == BattleStatus.ReadyToReveal || battle.status == BattleStatus.InProgress, "Battle not ready");
        require(battle.currentRound < 3, "All rounds complete");
        require(!roundsRevealed[battleId][battle.currentRound], "Round already revealed");

        uint256 starterCardId = battle.starterCards[battle.currentRound];
        uint256 opponentCardId = battle.opponentCards[battle.currentRound];

        BattleCard.Card memory starterCard = battleCard.getCard(starterCardId);
        BattleCard.Card memory opponentCard = battleCard.getCard(opponentCardId);

        // Calculate scores: power + defense/2 + speed
        uint256 starterScore;
        uint256 opponentScore;
        unchecked {
            starterScore = uint256(starterCard.power) + (uint256(starterCard.defense) / 2) + uint256(starterCard.speed);
            opponentScore = uint256(opponentCard.power) + (uint256(opponentCard.defense) / 2) + uint256(opponentCard.speed);
        }

        bool starterWon = starterScore > opponentScore;
        roundsRevealed[battleId][battle.currentRound] = true;

        if (starterWon) {
            battle.starterWins++;
        } else {
            battle.opponentWins++;
        }

        battle.currentRound++;
        
        // Check if battle is complete (best of 3)
        if (battle.starterWins >= 2 || battle.opponentWins >= 2 || battle.currentRound >= 3) {
            battle.status = BattleStatus.Resolved;
            if (battle.starterWins > battle.opponentWins) {
                battle.winner = battle.starter;
            } else if (battle.opponentWins > battle.starterWins) {
                battle.winner = battle.opponent;
            } else {
                // Draw - return all cards to owners
                battle.winner = address(0);
            }
            emit BattleResolved(battleId, battle.winner);
        } else {
            battle.status = BattleStatus.InProgress;
        }

        emit RoundResolved(battleId, battle.currentRound - 1, starterCardId, opponentCardId, starterWon);
    }

    /**
     * @notice Claim reward after winning a battle, or retrieve cards in case of a draw
     * @param battleId The battle ID
     * @param prizeCardIndex Index (0-2) of opponent card to claim (ignored in draw)
     */
    function claimReward(uint256 battleId, uint8 prizeCardIndex) external nonReentrant {
        Battle storage battle = battles[battleId];
        require(battle.status == BattleStatus.Resolved, "Battle not resolved");
        
        // Handle draw case: both players can retrieve their own cards
        if (battle.winner == address(0)) {
            require(
                msg.sender == battle.starter || msg.sender == battle.opponent,
                "Only battle participants can claim in a draw"
            );
            
            // Return all cards to their original owners
            // Return starter's cards to starter
            for (uint256 i = 0; i < 3; i++) {
                if (battle.starterCards[i] != 0) {
                    battleCard.transferFrom(address(this), battle.starter, battle.starterCards[i]);
                }
            }
            
            // Return opponent's cards to opponent
            for (uint256 i = 0; i < 3; i++) {
                if (battle.opponentCards[i] != 0) {
                    battleCard.transferFrom(address(this), battle.opponent, battle.opponentCards[i]);
                }
            }
            
            emit CardClaimed(battleId, msg.sender, 0); // 0 indicates draw
            return;
        }
        
        // Winner case: only winner can claim
        require(battle.winner == msg.sender, "Not the winner");
        require(prizeCardIndex < 3, "Invalid index");

        uint256 prizeTokenId = battle.opponentCards[prizeCardIndex];
        require(prizeTokenId != 0, "Invalid prize card");

        // Transfer prize to winner
        battleCard.transferFrom(address(this), msg.sender, prizeTokenId);

        // Return remaining opponent cards to opponent
        for (uint256 i = 0; i < 3; i++) {
            if (i != prizeCardIndex && battle.opponentCards[i] != 0) {
                battleCard.transferFrom(address(this), battle.opponent, battle.opponentCards[i]);
            }
        }

        // Return all starter cards to starter
        for (uint256 i = 0; i < 3; i++) {
            if (battle.starterCards[i] != 0) {
                battleCard.transferFrom(address(this), battle.starter, battle.starterCards[i]);
            }
        }

        emit CardClaimed(battleId, msg.sender, prizeTokenId);
    }

    /**
     * @notice Cancel battle if opponent doesn't join in time
     * @param battleId The battle ID
     */
    function cancelBattle(uint256 battleId) external nonReentrant {
        Battle storage battle = battles[battleId];
        require(battle.status == BattleStatus.WaitingForOpponent, "Cannot cancel");
        require(battle.starter == msg.sender, "Not starter");
        require(block.number > battle.createdAt + BATTLE_TIMEOUT, "Not expired");

        // Return starter's cards
        for (uint256 i = 0; i < 3; i++) {
            if (battle.starterCards[i] != 0) {
                battleCard.transferFrom(address(this), battle.starter, battle.starterCards[i]);
            }
        }

        battle.status = BattleStatus.Cancelled;
        emit BattleCancelled(battleId);
    }

    /**
     * @notice Get battle details
     * @param battleId The battle ID
     * @return Battle struct
     */
    function getBattle(uint256 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }
}
