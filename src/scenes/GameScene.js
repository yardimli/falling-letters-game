import { ScoreBoard } from '../ui/ScoreBoard.js';
import { BallManager } from '../managers/BallManager.js';
import { GoalManager } from '../managers/GoalManager.js';
import { InputManager } from '../managers/InputManager.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        console.log('GameScene: preload()');
        // Load JSON via AJAX
        this.load.json('wordData', 'assets/words.json');

        // --- Audio Assets ---
        this.load.audio('drop', 'assets/audio/DSGNBass_Smooth Sub Drop Bass Downer.wav');
        this.load.audio('bounce1', 'assets/audio/basketball_bounce_single_3.wav');
        this.load.audio('bounce2', 'assets/audio/basketball_bounce_single_5.wav');
        this.load.audio('bounce3', 'assets/audio/Vintage Bounce.wav');
        this.load.audio('click', 'assets/audio/basketball_bounce_single_5.wav');
        this.load.audio('click_drop', 'assets/audio/basketball_bounce_single_3.wav');
        this.load.audio('drop_valid', 'assets/audio/Drop Game Potion.wav');
        this.load.audio('drop_invalid', 'assets/audio/Hit Item Dropped 2.wav');
    }

    create() {
        // State
        this.wordQueue = []; // NEW: Queue for the 3 words
        this.currentWord = "";
        this.wordCorrectCount = 0; // Correct letters for current word
        this.globalCorrectCount = 0; // Correct letters for entire session (3 words)
        this.globalWrongCount = 0;
        this.totalSessionLetters = 0; // Total letters across all 3 words
        this.wallTimer = null;

        // Physics Boundaries
        this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

        // Initialize Managers
        this.scoreBoard = new ScoreBoard(this);
        this.scoreBoard.create();

        // Pass scene reference to managers
        this.ballManager = new BallManager(this);
        this.goalManager = new GoalManager(this);
        this.inputManager = new InputManager(this);

        // Setup Input (Cursor and Drag logic)
        this.inputManager.create();

        // Start Logic
        this.initGameSession();

        // Event Listeners
        this.scale.on('resize', this.resize, this);
    }

    update() {
        // Delegate update logic to BallManager (handling idle movement)
        this.ballManager.update();

        // Update InputManager to handle physics-based dragging
        if (this.inputManager) {
            this.inputManager.update();
        }
    }

    // NEW: Initializes a session of 3 words
    initGameSession() {
        const data = this.cache.json.get('wordData');
        // Pick 3 unique random words
        const allWords = Phaser.Utils.Array.Shuffle([...data.words]);
        this.wordQueue = allWords.slice(0, 3);

        // Calculate total letters for the progress bar
        this.totalSessionLetters = this.wordQueue.reduce((acc, word) => acc + word.length, 0);
        this.globalCorrectCount = 0;
        this.globalWrongCount = 0;

        this.scoreBoard.reset();
        this.startNextWord();
    }

    // NEW: Starts the next word in the queue
    startNextWord() {
        if (this.wordQueue.length === 0) {
            // Session Complete
            alert("All Words Complete!");
            this.initGameSession(); // Restart
            return;
        }

        // Cleanup previous level data
        this.ballManager.clear();
        this.goalManager.clear();

        this.currentWord = this.wordQueue.pop();
        this.wordCorrectCount = 0;

        // Build Level via Managers
        this.goalManager.createGoals(this.currentWord);
        this.ballManager.createLetterBalls(this.currentWord);

        // --- Enable Collisions ---
        this.ballManager.enableCollisions();

        if (this.ballManager.ballGroup) {
            // Main walls
            if (this.goalManager.getWallGroup()) {
                this.physics.add.collider(this.ballManager.ballGroup, this.goalManager.getWallGroup());
            }
            // Bottom walls
            if (this.goalManager.getBottomWallGroup()) {
                this.physics.add.collider(this.ballManager.ballGroup, this.goalManager.getBottomWallGroup());
            }
        }

        // Ensure cursor is on top
        this.inputManager.bringCursorToTop();

        // Start the glitch sequence
        this.goalManager.startGlitchSequence();
    }

    // Kept for compatibility if called externally, but logic moved to startNextWord
    startNewLevel() {
        this.initGameSession();
    }

    handleDragStart() {
        if (this.wallTimer) {
            this.wallTimer.remove(false);
            this.wallTimer = null;
        }
        this.goalManager.toggleBottomWalls(false);
    }

    handleDragEnd() {
        this.wallTimer = this.time.delayedCall(1000, () => {
            this.goalManager.toggleBottomWalls(true);
        });
    }

    /**
     * Called by InputManager when a ball is dropped.
     * @param {Phaser.GameObjects.Container} ball
     */
    handleBallDrop(ball) {
        let landedInGoal = false;
        const goals = this.goalManager.getGoals();

        for (let goal of goals) {
            const distance = Phaser.Math.Distance.Between(ball.x, ball.y, goal.x, goal.y);

            // Check if ball is dropped INSIDE a goal area
            if (distance < 60 && !goal.isFilled) {
                landedInGoal = true;
                if (ball.char === goal.expectedChar) {
                    this.handleCorrectDrop(ball, goal);
                } else {
                    // MODIFIED: Only apply rejection velocity if inside the WRONG goal
                    this.handleWrongDrop(ball);
                }
                break;
            }
        }

        // MODIFIED: If not in any goal, just release it without rejection velocity
        if (!landedInGoal) {
            ball.body.setAllowGravity(true);
            // We do NOT call handleWrongDrop here, so it doesn't shoot down.
            // It just falls naturally or floats depending on physics config.
            // Ensure it has some damping so it doesn't fly away if it was moving fast
            ball.body.setDrag(100);
        }
    }

    handleCorrectDrop(ball, goal) {
        // Play Success Sound
        this.sound.play('drop_valid');

        ball.x = goal.x;
        ball.y = goal.y;
        ball.body.setEnable(false);
        ball.disableInteractive();

        goal.isFilled = true;
        ball.isLocked = true;

        // Visual Feedback: Green
        ball.list[0].setFillStyle(0x00cc44);

        this.wordCorrectCount++;
        this.globalCorrectCount++;

        // Update ScoreBoard with global progress
        this.scoreBoard.update(this.globalCorrectCount, this.globalWrongCount, this.totalSessionLetters);

        // Check if current word is complete
        if (this.wordCorrectCount === this.currentWord.length) {
            this.time.delayedCall(1000, () => {
                this.startNextWord();
            });
        }
    }

    handleWrongDrop(ball) {
        // Play Error Sound
        this.sound.play('drop_invalid');

        ball.body.setAllowGravity(true);

        // NEW LOGIC: Push downwards (Rejection)
        // Only called if the ball was actually inside a goal but wrong
        ball.body.setVelocity(Phaser.Math.Between(-20, 20), 200);

        // Visual Feedback: Red then fade to Blue
        const circle = ball.list[0];
        circle.setFillStyle(0xff0000);

        this.tweens.add({
            targets: circle,
            fillColor: { from: 0xff0000, to: 0x0077ff },
            duration: 500
        });

        this.globalWrongCount++;
        this.scoreBoard.update(this.globalCorrectCount, this.globalWrongCount, this.totalSessionLetters);
    }

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        this.cameras.main.setViewport(0, 0, width, height);
        this.physics.world.setBounds(0, 0, width, height);

        this.scoreBoard.resize(width, height);
        this.goalManager.resize(width, height, this.currentWord.length);
    }
}