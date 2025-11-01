# ⚔️ Monad Battle Cards - NFT Battle Game

A Web3 NFT battle card game built on **Monad Blitz Testnet**. Players mint randomly-generated NFT cards with unique stats, character types, and rarity levels, then battle other players to win cards as prizes.

## 🎮 Features

- **NFT Minting**: Pay 0.001 MON to mint randomly-generated battle cards
- **Card Attributes**: Power, Defense, Speed, Character Type (Warrior, Mage, Cavalry, Prince), and Rarity (Common → Mythic)
- **Battle System**: Best-of-3 card battles with escrow and reward claiming
- **Collection Management**: View and manage your card collection
- **Gas-Optimized**: Packed structs, minimal storage operations, and efficient contract design

## 📋 Project Structure

```
Battle-pro/
├── contracts/
│   ├── BattleCard.sol          # ERC721 NFT contract with card minting
│   └── BattleManager.sol        # Battle logic, escrow, and rewards
├── script/
│   └── deploy.js                # Deployment script
├── test/
│   └── BattleCard.test.js       # Basic tests
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── pages/               # React pages (Home, Collection, Battle)
│   │   └── lib/                 # Ethereum helpers
│   └── package.json
├── hardhat.config.js
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MetaMask or compatible Web3 wallet
- Monad Blitz testnet MON (for gas fees)

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
PRIVATE_KEY=your_private_key_here
```

### 3. Deploy Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to Monad Blitz testnet
npx hardhat run script/deploy.js --network monad
```

After deployment, you'll see the contract addresses. Copy them to `frontend/.env`:

```bash
# In frontend/.env
VITE_BATTLE_CARD_ADDRESS=0x...
VITE_BATTLE_MANAGER_ADDRESS=0x...
```

### 4. Configure MetaMask for Monad Blitz

1. Open MetaMask
2. Click "Add Network" or go to Settings → Networks
3. Add the following network:
   - **Network Name**: Monad Blitz Testnet
   - **RPC URL**: `https://rpc.blitz.monad.xyz`
   - **Chain ID**: `10143`
   - **Currency Symbol**: `MON`
   - **Block Explorer**: `https://explorer.blitz.monad.xyz`

4. Get testnet MON from a faucet (check Monad Discord/Telegram)

### 5. Run Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

## 🎯 How to Use

### Minting Cards

1. Connect your MetaMask wallet (ensure you're on Monad Blitz testnet)
2. Go to the Home page
3. Click "Generate Card — 0.001 MON"
4. Approve the transaction and wait for confirmation
5. Your new card will appear!

### Viewing Collection

1. Navigate to the Collection page
2. All your cards will be displayed in a grid
3. Select up to 3 cards by clicking on them

### Battling

#### Creating a Battle

1. Go to the Battle page
2. Click "Create Challenge"
3. Enter your opponent's address
4. Select exactly 3 cards
5. Click "Create Battle"
6. Share the Battle ID with your opponent

#### Joining a Battle

1. Go to the Battle page
2. Click "Join Challenge"
3. Enter the Battle ID
4. Click "Load Battle"
5. Select your 3 cards
6. Click "Join Battle"

#### Revealing Rounds

1. Once both players have joined, click "Reveal Round" (anyone can call this)
2. The contract compares card stats: `power + defense/2 + speed`
3. The winner of each round is tracked
4. After best-of-3 or when someone reaches 2 wins, the battle resolves

#### Claiming Rewards

1. The winner can select one of the opponent's 3 cards as a prize
2. Click "Claim Card X" (where X is 0-2)
3. The prize card will be transferred to your wallet
4. All other cards are returned to their original owners

## 📊 Rarity Distribution

- **Common** (60%): Power 50-80, Defense 30-60, Speed 10-30
- **Rare** (25%): Power 80-110, Defense 60-90, Speed 20-40
- **Epic** (10%): Power 110-150, Defense 90-120, Speed 30-60
- **Legendary** (4%): Power 150-210, Defense 120-170, Speed 50-90
- **Mythic** (1%): Power 210-300, Defense 170-250, Speed 80-150

## ⚠️ Important Notes

### Randomness Security

The contract uses **pseudo-randomness** for card generation:

```solidity
keccak256(abi.encodePacked(block.timestamp, msg.sender, tokenId, blockhash(block.number-1)))
```

⚠️ **This is NOT cryptographically secure and can be manipulated by miners**. For production, use:
- Chainlink VRF (Verifiable Random Function)
- Commit-reveal schemes
- Oracle-based randomness

The current implementation is suitable for **hackathon demos and testnets only**.

### Gas Optimization

The contracts use several gas optimization techniques:
- Packed structs (uint16 + uint8 instead of uint256)
- Fixed-size arrays (`uint256[3]` for battle cards)
- Minimal storage writes
- `unchecked` blocks where safe
- External visibility where possible

### Battle Timeout

Battles expire after ~1 hour (3600 blocks) if the opponent doesn't join. The starter can call `cancelBattle()` to retrieve their escrowed cards.

## 🧪 Testing

```bash
# Run tests on local Hardhat network
npx hardhat test
```

Tests cover:
- Card minting with correct fees
- Rarity and stat generation
- Battle creation and joining
- Round resolution
- Reward claiming

## 📝 Smart Contract Functions

### BattleCard.sol

- `mintCard()` - Mint a new card for 0.001 MON
- `getCard(uint256 tokenId)` - Get card attributes
- `getOwnedTokens(address owner)` - Get all tokens owned by an address
- `withdraw()` - Owner-only function to withdraw mint fees
- `batchApprove(address to, uint256[] tokenIds)` - Batch approve for battles

### BattleManager.sol

- `createBattle(address opponent, uint256[3] myCards)` - Create a new battle
- `joinBattle(uint256 battleId, uint256[3] opponentCards)` - Join an existing battle
- `revealRound(uint256 battleId)` - Reveal the next round (anyone can call)
- `claimReward(uint256 battleId, uint8 prizeCardIndex)` - Winner claims a prize card
- `cancelBattle(uint256 battleId)` - Cancel an expired battle
- `getBattle(uint256 battleId)` - Get battle details

## 🛠️ Tech Stack

- **Solidity** ^0.8.20
- **Hardhat** ^2.26.5
- **OpenZeppelin Contracts** ^5.4.0
- **React** 19.1.1 + **Vite**
- **Ethers.js** ^6.15.0
- **TailwindCSS** ^4.1.16
- **React Router** for navigation

## 📄 License

MIT

## 🤝 Contributing

This is a hackathon MVP. For production use, consider:
1. Implementing Chainlink VRF for randomness
2. Adding more sophisticated battle mechanics
3. Implementing card marketplace
4. Adding card upgrade/fusion system
5. Improving UI/UX with animations and better styling
6. Adding more comprehensive tests
7. Gas optimization audit

## 🐛 Known Issues

- No event listeners for real-time battle updates (frontend polls)
- Simplified card ownership tracking (use ERC721Enumerable for better UX)
- Battle timeout is fixed at 3600 blocks (adjust for network block time)
- No on-chain metadata storage (use IPFS for production)

---

**Built for Monad Blitz Testnet** 🚀