class GameManager {
  constructor(size, InputManager, Actuator, StorageManager) {

    this.size           = size; // Size of the grid
    this.inputManager   = new InputManager();
    this.storageManager = new StorageManager();
    this.actuator       = new Actuator();

    this.startTiles     = 2;

    this.inputManager.on("move", this.move.bind(this));
    this.inputManager.on("restart", this.restart.bind(this));
    this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

    this.setup();
  }
  
  actuate() {
    if (this.storageManager.getBestScore() < this.score) {
      this.storageManager.setBestScore(this.score);
    }

    // Clear the state when the game is over (game over only, not win)
    if (this.over) {
      this.storageManager.clearGameState();
    } else {
      this.storageManager.setGameState(this.serialize());
    }

    this.actuator.actuate(this.grid, {
      score:      this.score,
      over:       this.over,
      won:        this.won,
      bestScore:  this.storageManager.getBestScore(),
      terminated: this.isGameTerminated()
    });
  }
  
  setup() {
    var previousState = this.storageManager.getGameState();

    // Reload the game from a previous game if present
    if (previousState) {
      this.grid        = new Grid(previousState.grid.size,
                                  previousState.grid.cells); // Reload grid
      this.score       = previousState.score;
      this.over        = previousState.over;
      this.won         = previousState.won;
      this.keepPlaying = previousState.keepPlaying;
    } else {
      this.grid        = new Grid(this.size);
      this.score       = 0;
      this.over        = false;
      this.won         = false;
      this.keepPlaying = false;

      // Add the initial tiles
      this.addStartTiles();
    }

    // Update the actuator
    this.actuate();
  }

  restart() {
    this.storageManager.clearGameState();
    this.actuator.continueGame(); // Clear the game won/lost message
    this.setup();
  }

  keepPlaying() {
    this.keepPlaying = true;
    this.actuator.continueGame(); // Clear the game won/lost message
  }

  isGameTerminated() {
    return this.over || (this.won && !this.keepPlaying);
  }

  addStartTiles() {
    for (var i = 0; i < this.startTiles; i++) {
      this.addRandomTile();
    }
  }

  addRandomTile() {
    if (this.grid.cellsAvailable()) {
      var value = Math.random() < 0.9 ? 2 : 4;
      var tile = new Tile(this.grid.randomAvailableCell(), value);

      this.grid.insertTile(tile);
    }
  }

  serialize() {
    return {
      grid:        this.grid.serialize(),
      score:       this.score,
      over:        this.over,
      won:         this.won,
      keepPlaying: this.keepPlaying
    };
  }

  prepareTiles() {
    this.grid.eachCell(function (x, y, tile) {
      if (tile) {
        tile.mergedFrom = null;
        tile.savePosition();
      }
    });
  }

  moveTile(tile, cell) {
    this.grid.cells[tile.x][tile.y] = null;
    this.grid.cells[cell.x][cell.y] = tile;
    tile.updatePosition(cell);
  }

  move(direction) {
    // 0: up, 1: right, 2: down, 3: left
    var self = this;

    if (this.isGameTerminated()) return; // Don't do anything if the game's over

    var cell, tile;

    var vector     = this.getVector(direction);
    var traversals = this.buildTraversals(vector);
    var moved      = false;

    // Save the current tile positions and remove merger information
    this.prepareTiles();

    // Traverse the grid in the right direction and move tiles
    traversals.x.forEach(function (x) {
      traversals.y.forEach(function (y) {
        cell = { x: x, y: y };
        tile = self.grid.cellContent(cell);

        if (tile) {
          var positions = self.findFarthestPosition(cell, vector);
          var next      = self.grid.cellContent(positions.next);

          // Only one merger per row traversal?
          if (next && next.value === tile.value && !next.mergedFrom) {
            var merged = new Tile(positions.next, tile.value * 2);
            merged.mergedFrom = [tile, next];

            self.grid.insertTile(merged);
            self.grid.removeTile(tile);

            // Converge the two tiles' positions
            tile.updatePosition(positions.next);

            // Update the score
            self.score += merged.value;

            // The mighty 2048 tile
            // Note: This is the second place you need to change
            // to change the maxTile from 2048 to a variable.
            if (merged.value === 2048) self.won = true;
          } else {
            self.moveTile(tile, positions.farthest);
          }

          if (!self.positionsEqual(cell, tile)) {
            moved = true; // The tile moved from its original cell!
          }
        }
      });
    });

    if (moved) {
      this.addRandomTile();

      if (!this.movesAvailable()) {
        this.over = true; // Game over!
      }

      this.actuate();
    }
  }

  getVector(direction) {
    // Vectors representing tile movement
    var map = {
      0: { x: 0,  y: -1 }, // Up
      1: { x: 1,  y: 0 },  // Right
      2: { x: 0,  y: 1 },  // Down
      3: { x: -1, y: 0 }   // Left
    };

    return map[direction];
  }

  buildTraversals(vector) {
    var traversals = { x: [], y: [] };

    for (var pos = 0; pos < this.size; pos++) {
      traversals.x.push(pos);
      traversals.y.push(pos);
    }

    // Always traverse from the farthest cell in the chosen direction
    if (vector.x === 1) traversals.x = traversals.x.reverse();
    if (vector.y === 1) traversals.y = traversals.y.reverse();

    return traversals;
  }

  findFarthestPosition(cell, vector) {
    var previous;

    // Progress towards the vector direction until an obstacle is found
    do {
      previous = cell;
      cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
    } while (this.grid.withinBounds(cell) &&
            this.grid.cellAvailable(cell));

    return {
      farthest: previous,
      next: cell // Used to check if a merge is required
    };
  }

  movesAvailable() {
    return this.grid.cellsAvailable() || this.tileMatchesAvailable();
  }

  tileMatchesAvailable() {
    var self = this;

    var tile;

    for (var x = 0; x < this.size; x++) {
      for (var y = 0; y < this.size; y++) {
        tile = this.grid.cellContent({ x: x, y: y });

        if (tile) {
          for (var direction = 0; direction < 4; direction++) {
            var vector = self.getVector(direction);
            var cell   = { x: x + vector.x, y: y + vector.y };

            var other  = self.grid.cellContent(cell);

            if (other && other.value === tile.value) {
              return true; // These two tiles can be merged
            }
          }
        }
      }
    }

    return false;
  }

  positionsEqual(first, second) {
    return first.x === second.x && first.y === second.y;
  }
}
