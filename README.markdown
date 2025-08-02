# Tic Tac Toe React

A modern, minimalist Tic Tac Toe game built with React, Tailwind CSS, and JSX. The game features a clean UI, smooth animations, game history tracking, a menu for game controls, and a result modal. The codebase is modular and extensible, designed for easy maintenance and future enhancements.

## Features

- **Interactive Game Board**: 3x3 grid with animated square clicks and winning state highlights.
- **Game History**: Tracks past games, allowing users to revisit previous board states.
- **Menu Controls**: Options to start a new game or reset scores.
- **Result Modal**: Displays game outcomes (win or draw) with an option to start a new game.
- **Score Tracking**: Keeps count of wins for both X and O players.
- **Responsive Design**: Optimized for various screen sizes with Tailwind CSS.
- **Animations**: Smooth transitions for square clicks, modal appearance, and winning states.

## Setup Instructions

### Prerequisites

- **Browser**: A modern web browser (e.g., Chrome, Firefox, Edge) to run the application.
- **Text Editor**: Any text editor (e.g., VS Code) for modifying the code.
- **Optional**: Node.js and a local development server (e.g., `live-server`) for local testing.

### Installation

1. **Clone or Download the Project**:
   - If using a repository, clone it:
  
     ```bash
     git clone <repository-url>
     ```

   - Alternatively, download the `index.html` file containing the full application.

2. **File Structure**:
   - The project is contained in a single `index.html` file, which includes:
     - React and ReactDOM via CDN (no local dependencies required).
     - Tailwind CSS via CDN for styling.
     - Babel for JSX transformation.
     - Inline JavaScript with React components.

3. **Running the Application**:
   - **Option 1: Open Directly in Browser**:
     - Place the `index.html` file in a directory.
     - Open it directly in a web browser by double-clicking or using a URL like `file://path/to/index.html`.
   - **Option 2: Use a Local Development Server**:
     - Install a simple server like `live-server` globally using Node.js:
  
       ```bash
       npm install -g live-server
       ```

     - Navigate to the directory containing `index.html` and run:
  
       ```bash
       live-server
       ```

     - The browser will open automatically, typically at `http://localhost:8080`.

### Dependencies

The project uses the following CDN-hosted dependencies (no local installation required):

- **React**: `https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js`
- **ReactDOM**: `https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.production.min.js`
- **Tailwind CSS**: `https://cdn.tailwindcss.com`
- **Babel**: `https://cdn.jsdelivr.net/npm/babel-standalone@7.22.10/babel.min.js`

## Usage Instructions

1. **Starting the Game**:
   - Open the application in a browser.
   - The game board appears in the center, with X starting as the first player.

2. **Playing the Game**:
   - Click any empty square to place an X or O (alternates between players).
   - The game detects wins or draws automatically and displays a modal with the result.

3. **Game Controls**:
   - **Menu (Right Side)**:
     - **New Game**: Starts a fresh game with an empty board.
     - **Reset Score**: Clears the score and history, resetting the game state.
   - **History (Top-Left)**:
     - Lists past games with their results and scores.
     - Click a history item to view the board state of that game.

4. **Result Modal**:
   - Appears when a game ends (win or draw).
   - Displays the outcome (e.g., "X Wins!" or "Draw!").
   - Click "Start New Game" to reset the board and continue playing.

5. **Score Tracking**:
   - The score for X and O is displayed above the board and updated after each game.

## Project Structure

The application is contained in a single `index.html` file for simplicity, with the following logical structure:

- **HTML**: Basic structure with a root `<div>` for React rendering.
- **React Components** (defined in inline JavaScript):
  - `BoardSquare`: Renders individual squares with click handling and animations.
  - `GameBoard`: Manages the 3x3 grid layout.
  - `HistoryItem`: Displays a single history entry.
  - `HistoryPanel`: Shows the list of past games.
  - `MenuPanel`: Contains game control buttons.
  - `Game`: Main component managing state and logic.
  - `ResultModal`: Displays game results with a restart option.
- **Styling**: Tailwind CSS classes for responsive, minimalist design.
- **Animations**: CSS transitions for square clicks, modal appearance, and winning states.

## Extending the Project

The modular structure allows for easy enhancements. Potential extensions include:

- **AI Opponent**: Add a computer player using a minimax algorithm.
- **Custom Board Sizes**: Modify the `GameBoard` component to support larger grids.
- **Player Names**: Add input fields to customize player names.
- **Persistent Storage**: Save game history to localStorage or a backend.
- **Theming**: Extend Tailwind CSS classes for different visual themes.

To extend the project:

1. Extract the inline JavaScript into separate `.js` files for better organization.
2. Use a build tool like Vite or Create React App for a full development environment.
3. Add new components or modify existing ones in the `<script type="text/babel">` section.

## Notes

- The application runs entirely in the browser, requiring no server-side setup.
- Animations are implemented using Tailwind CSS transitions for performance.
- The history panel is scrollable for games exceeding the panel height.
- The codebase is optimized for simplicity but can be refactored for larger-scale projects.

For issues or contributions, please report them via the repository's issue tracker (if applicable) or contact the developer.
