use serde::{Deserialize, Serialize};

/// Represents a player mark on the board
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Mark {
    #[serde(rename = "X")]
    X,
    #[serde(rename = "O")]
    O,
}

impl Mark {
    pub fn opposite(&self) -> Self {
        match self {
            Mark::X => Mark::O,
            Mark::O => Mark::X,
        }
    }
    
    pub fn as_str(&self) -> &str {
        match self {
            Mark::X => "X",
            Mark::O => "O",
        }
    }
}

/// Represents the winner of a game
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Winner {
    #[serde(rename = "X")]
    Player(Mark),
    #[serde(rename = "draw")]
    Draw,
}

/// The game board (9 cells)
pub type Board = [String; 9];

/// Winning line positions
pub type WinningLine = Vec<usize>;

/// Winning lines on the board
pub const WINNING_LINES: [[usize; 3]; 8] = [
    [0, 1, 2], // top row
    [3, 4, 5], // middle row
    [6, 7, 8], // bottom row
    [0, 3, 6], // left column
    [1, 4, 7], // middle column
    [2, 5, 8], // right column
    [0, 4, 8], // diagonal \
    [2, 4, 6], // diagonal /
];

/// Game state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameState {
    pub board: Board,
    pub turn: Mark,
    pub winner: Option<Winner>,
    pub winning_line: WinningLine,
    pub x_score: u32,
    pub o_score: u32,
    pub new_game_requester: Option<String>,
    pub new_game_requested_at: Option<i64>,
}

impl Default for GameState {
    fn default() -> Self {
        Self::new()
    }
}

impl GameState {
    pub fn new() -> Self {
        Self {
            board: Default::default(),
            turn: Mark::X,
            winner: None,
            winning_line: Vec::new(),
            x_score: 0,
            o_score: 0,
            new_game_requester: None,
            new_game_requested_at: None,
        }
    }

    /// Reset the game but keep scores
    pub fn reset_with_scores(&mut self, new_turn: Mark) {
        let x_score = self.x_score;
        let o_score = self.o_score;
        *self = Self::new();
        self.x_score = x_score;
        self.o_score = o_score;
        self.turn = new_turn;
    }

    /// Reset scores
    pub fn reset_scores(&mut self) {
        self.x_score = 0;
        self.o_score = 0;
    }

    /// Make a move on the board
    pub fn make_move(&mut self, index: usize, mark: Mark) -> bool {
        // Validate move
        if index >= 9 || !self.board[index].is_empty() || self.winner.is_some() || self.turn != mark {
            return false;
        }

        // Make the move
        self.board[index] = mark.as_str().to_string();

        // Check for winner
        if let Some((winner, line)) = Self::calculate_winner(&self.board) {
            self.winner = Some(winner.clone());
            self.winning_line = line;
            
            // Update scores
            match winner {
                Winner::Player(Mark::X) => self.x_score += 1,
                Winner::Player(Mark::O) => self.o_score += 1,
                Winner::Draw => {},
            }
        } else {
            // Switch turn
            self.turn = self.turn.opposite();
        }

        true
    }

    /// Calculate the winner from a board state
    pub fn calculate_winner(board: &Board) -> Option<(Winner, WinningLine)> {
        // Check all winning lines
        for line in &WINNING_LINES {
            let [a, b, c] = *line;
            if !board[a].is_empty() && board[a] == board[b] && board[a] == board[c] {
                let winner = if board[a] == "X" {
                    Winner::Player(Mark::X)
                } else {
                    Winner::Player(Mark::O)
                };
                return Some((winner, vec![a, b, c]));
            }
        }

        // Check for draw
        if board.iter().all(|cell| !cell.is_empty()) {
            return Some((Winner::Draw, Vec::new()));
        }

        None
    }

    /// Determine the next turn based on the last game
    pub fn determine_next_turn(&self) -> Mark {
        if let Some(ref winner) = self.winner {
            match winner {
                Winner::Player(mark) => {
                    // Loser goes first
                    mark.opposite()
                }
                Winner::Draw => {
                    // In draw, second-to-last player goes first
                    let mut move_order = Vec::new();
                    for cell in &self.board {
                        if !cell.is_empty() {
                            move_order.push(cell.clone());
                        }
                    }
                    if move_order.len() >= 2 {
                        let second_last = &move_order[move_order.len() - 2];
                        if second_last == "X" {
                            Mark::X
                        } else {
                            Mark::O
                        }
                    } else {
                        Mark::X
                    }
                }
            }
        } else {
            Mark::X
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_game_state() {
        let state = GameState::new();
        assert_eq!(state.turn, Mark::X);
        assert!(state.winner.is_none());
        assert_eq!(state.x_score, 0);
        assert_eq!(state.o_score, 0);
    }

    #[test]
    fn test_make_valid_move() {
        let mut state = GameState::new();
        assert!(state.make_move(0, Mark::X));
        assert_eq!(state.board[0], "X");
        assert_eq!(state.turn, Mark::O);
    }

    #[test]
    fn test_invalid_move() {
        let mut state = GameState::new();
        state.make_move(0, Mark::X);
        assert!(!state.make_move(0, Mark::O)); // Already occupied
        assert!(!state.make_move(1, Mark::X)); // Wrong turn
    }

    #[test]
    fn test_winner_detection() {
        let mut state = GameState::new();
        // X wins horizontally
        state.make_move(0, Mark::X);
        state.make_move(3, Mark::O);
        state.make_move(1, Mark::X);
        state.make_move(4, Mark::O);
        state.make_move(2, Mark::X);
        
        assert!(state.winner.is_some());
        assert_eq!(state.x_score, 1);
    }
}
