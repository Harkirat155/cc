# Tic Tac Toe Game with React and Tailwind CSS

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tic Tac Toe</title>
    <script src="https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/babel-standalone@7.22.10/babel.min.js"></script>
</head>
<body>
    <div id="root" class="min-h-screen bg-gray-100 flex items-center justify-center"></div>
    <script type="text/babel">
        const { useState, useEffect } = React;

        // BoardSquare Component
        const BoardSquare = ({ value, onClick, isWinning }) => (
            <button
                className={`w-24 h-24 text-4xl font-bold border-2 border-gray-300 flex items-center justify-center transition-all duration-300 
                    ${isWinning ? 'bg-green-200 scale-110' : 'hover:bg-gray-200'} 
                    ${value === 'X' ? 'text-blue-600' : value === 'O' ? 'text-red-600' : ''}`}
                onClick={onClick}
            >
                {value}
            </button>
        );

        // GameBoard Component
        const GameBoard = ({ squares, onSquareClick, winningSquares }) => (
            <div className="grid grid-cols-3 gap-2 bg-white p-6 rounded-lg shadow-lg transform transition-all duration-500">
                {squares.map((square, index) => (
                    <BoardSquare
                        key={index}
                        value={square}
                        onClick={() => onSquareClick(index)}
                        isWinning={winningSquares.includes(index)}
                    />
                ))}
            </div>
        );

        // HistoryItem Component
        const HistoryItem = ({ game, index, onClick }) => (
            <li className="py-2 px-4 hover:bg-gray-100 rounded-lg transition-all duration-200 cursor-pointer" onClick={() => onClick(index)}>
                <span className="text-sm font-medium text-gray-700">
                    Game {index + 1}: {game.result} (X: {game.xWins}, O: {game.oWins})
                </span>
            </li>
        );

        // HistoryPanel Component
        const HistoryPanel = ({ history, onHistoryClick }) => (
            <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg w-64 max-h-96 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-2 text-gray-800">Game History</h3>
                <ul>
                    {history.map((game, index) => (
                        <HistoryItem key={index} game={game} index={index} onClick={onHistoryClick} />
                    ))}
                </ul>
            </div>
        );

        // MenuPanel Component
        const MenuPanel = ({ onReset, onNewGame }) => (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white p-4 rounded-lg shadow-lg w-48">
                <h3 className="text-lg font-semibold mb-2 text-gray-800">Menu</h3>
                <button
                    className="w-full py-2 mb-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200"
                    onClick={onNewGame}
                >
                    New Game
                </button>
                <button
                    className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200"
                    onClick={onReset}
                >
                    Reset Score
                </button>
            </div>
        );

        // ResultModal Component
        const ResultModal = ({ result, onClose }) => (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center animate-fadeIn">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full transform transition-all duration-300 scale-100">
                    <h2 className="text-2xl font-bold mb-4 text-gray-800">{result}</h2>
                    <button
                        className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200"
                        onClick={onClose}
                    >
                        Start New Game
                    </button>
                </div>
            </div>
        );

        // Main Game Component
        const Game = () => {
            const [squares, setSquares] = useState(Array(9).fill(null));
            const [isXNext, setIsXNext] = useState(true);
            const [history, setHistory] = useState([]);
            const [xWins, setXWins] = useState(0);
            const [oWins, setOWins] = useState(0);
            const [showModal, setShowModal] = useState(false);
            const [result, setResult] = useState('');

            const calculateWinner = (squares) => {
                const lines = [
                    [0, 1, 2], [3, 4, 5], [6, 7, 8],
                    [0, 3, 6], [1, 4, 7], [2, 5, 8],
                    [0, 4, 8], [2, 4, 6]
                ];
                for (let line of lines) {
                    const [a, b, c] = line;
                    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                        return { winner: squares[a], line };
                    }
                }
                return squares.every(s => s) ? { winner: 'Draw', line: [] } : null;
            };

            const handleSquareClick = (index) => {
                if (squares[index] || calculateWinner(squares)) return;
                const newSquares = squares.slice();
                newSquares[index] = isXNext ? 'X' : 'O';
                setSquares(newSquares);
                setIsXNext(!isXNext);

                const winnerInfo = calculateWinner(newSquares);
                if (winnerInfo) {
                    const resultText = winnerInfo.winner === 'Draw' ? 'Draw!' : `${winnerInfo.winner} Wins!`;
                    setResult(resultText);
                    setShowModal(true);
                    setHistory([...history, {
                        squares: newSquares,
                        result: resultText,
                        xWins: winnerInfo.winner === 'X' ? xWins + 1 : xWins,
                        oWins: winnerInfo.winner === 'O' ? oWins + 1 : oWins
                    }]);
                    if (winnerInfo.winner === 'X') setXWins(xWins + 1);
                    if (winnerInfo.winner === 'O') setOWins(oWins + 1);
                }
            };

            const handleNewGame = () => {
                setSquares(Array(9).fill(null));
                setIsXNext(true);
                setShowModal(false);
            };

            const handleReset = () => {
                setSquares(Array(9).fill(null));
                setIsXNext(true);
                setHistory([]);
                setXWins(0);
                setOWins(0);
                setShowModal(false);
            };

            const handleHistoryClick = (index) => {
                const selectedGame = history[index];
                setSquares(selectedGame.squares);
                setIsXNext(true);
                setShowModal(false);
            };

            const winnerInfo = calculateWinner(squares);
            const winningSquares = winnerInfo ? winnerInfo.line : [];

            return (
                <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-100">
                    <h1 className="text-4xl font-bold mb-8 text-gray-800 animate-pulse">Tic Tac Toe</h1>
                    <div className="mb-4 text-lg font-medium text-gray-700">
                        Score: X - {xWins} | O - {oWins}
                    </div>
                    <GameBoard squares={squares} onSquareClick={handleSquareClick} winningSquares={winningSquares} />
                    <HistoryPanel history={history} onHistoryClick={handleHistoryClick} />
                    <MenuPanel onReset={handleReset} onNewGame={handleNewGame} />
                    {showModal && <ResultModal result={result} onClose={handleNewGame} />}
                </div>
            );
        };

        // Render the app
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<Game />);
    </script>
</body>
</html>
```

This implementation includes:

1. **Modular Components**:
   - `BoardSquare`: Handles individual square rendering and click events
   - `GameBoard`: Renders the 3x3 grid
   - `HistoryItem`: Displays individual game history entries
   - `HistoryPanel`: Shows the game history
   - `MenuPanel`: Contains game controls
   - `ResultModal`: Displays game results

2. **Features**:
   - Centered game board with modern, minimalist design using Tailwind CSS
   - History panel on top-left showing past games
   - Menu panel on right for new game and reset
   - Modal for game results with automatic board reset
   - Score tracking for X and O
   - Animations for square clicks, winning states, and modal appearance
   - Responsive design with smooth transitions

3. **Extensibility**:
   - Components are reusable and isolated
   - State management is centralized in the main `Game` component
   - Easy to add new features like AI opponents or different board sizes
   - History system can be extended for more detailed game analysis

To play:

1. Click squares to place X or O
2. View game history in the top-left panel
3. Use the right menu to start a new game or reset scores
4. When a game ends, a modal shows the result and allows starting a new game

The code uses modern React with hooks, Tailwind CSS for styling, and includes animations via CSS transitions for a polished user experience.
