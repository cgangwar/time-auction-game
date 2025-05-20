# Time Auction

A real-time multiplayer strategy game featuring a dynamic time-based bidding system with enhanced interactive gameplay mechanics.

## Description

Time Auction is a strategic multiplayer game where players compete to win tokens by bidding their time. The player who holds down the bidding button for the longest time without depleting their time bank wins each round and earns a token. The game tests your nerve and strategy in a unique real-time competition.

### Key Features

- **Time-Based Bidding**: Use your limited time bank strategically to win rounds
- **Multiplayer Support**: Compete against friends in real-time
- **Bot Players**: Play against AI opponents with different psychological profiles
- **Token Collection**: Earn tokens by winning rounds
- **Real-Time Updates**: See opponent actions as they happen
- **Responsive Design**: Play on any device with a web browser

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v7 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/time-auction.git
   cd time-auction
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

### Database Setup (Optional)

By default, the application uses in-memory storage for development. For persistent storage:

1. Set up a PostgreSQL database
2. Create a `.env` file with your database connection details:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/timeauction
   ```

3. Initialize the database schema:
   ```bash
   npm run db:push
   ```

## Game Rules

1. **Starting a Game**:
   - Create a new game by setting the number of rounds and time bank
   - Share the game code with friends or add AI opponents
   - Game starts when all players are ready

2. **During a Round**:
   - Hold down the buzzer button to bid time
   - Your time bank decreases while holding
   - The player who holds longest wins the round
   - Releasing the buzzer locks in your bid

3. **Winning the Game**:
   - Earn 1 token for each round you win
   - The player with the most tokens at the end wins
   - In case of a tie, remaining time bank is the tiebreaker

## Project Structure

- `client/` - Frontend React application
- `server/` - Backend Express server
- `shared/` - Shared TypeScript types and utilities
- `docs/` - Project documentation

## Development

### Key Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the production version
- `npm run start` - Start the production server
- `npm run db:push` - Push schema changes to the database

### Creating Bot Players

When hosting a game, you can add bots with different psychological profiles:

- **Aggressive**: Takes large risks with time
- **Conservative**: Makes safer, smaller bids
- **Erratic**: Unpredictable bidding behavior

## Deployment

### Deploying to Replit

1. Create a new Replit project
2. Import the code from GitHub or upload directly
3. Install dependencies with `npm install`
4. Click the "Run" button to start the server
5. Set up environment variables in the Replit Secrets tab if using a database

### Deploying to Other Platforms

1. Build the production version:
   ```bash
   npm run build
   ```

2. Set the required environment variables:
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=your_database_url (optional)
   ```

3. Start the production server:
   ```bash
   npm start
   ```

## Contributing

Contributions are welcome! Here's how you can contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with React, Express, and WebSockets
- Styled with TailwindCSS
- Icons from Lucide React