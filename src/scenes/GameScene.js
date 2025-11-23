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
        // NEW: Generate the 3D Ball Texture programmatically
        this.createBallTexture();

        // State
        this.wordQueue = []; // Queue for the 3 words
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

    // NEW: Helper to create a 3D-looking sphere texture using Canvas gradients
    createBallTexture() {
        // Create a texture with the key 'ball3d'
        // MODIFIED: Increased size to 64x64 to prevent border clipping.
        // The ball is 50px (radius 25), plus a border, so 50x50 was too tight.
        const size = 64;
        const texture = this.textures.createCanvas('ball3d', size, size);
        const context = texture.getContext();

        const centerX = size / 2;
        const centerY = size / 2;
        const radius = 25; // Matches the physics body radius

        // Create a radial gradient to simulate 3D lighting
        // Light source offset to top-left relative to center
        const grd = context.createRadialGradient(centerX - 10, centerY - 10, 2, centerX, centerY, radius);
        grd.addColorStop(0, '#ffffff'); // Specular highlight (White)
        grd.addColorStop(1, '#888888'); // Shadow/Base (Gray) - allows tinting

        context.fillStyle = grd;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fill();

        // Add a border
        // Stroke is centered on the path, so it extends half-width inside and half-width outside
        context.lineWidth = 3;
        context.strokeStyle = '#ffffff';
        context.stroke();

        texture.refresh();
    }

    update() {
        // Delegate update logic to BallManager (handling idle movement)
        this.ballManager.update();

        // Update InputManager to handle physics-based dragging
        if (this.inputManager) {
            this.inputManager.update();
        }
    }

    // Initializes a session of 3 words
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

    // Starts the next word in the queue
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
                    // Only apply rejection velocity if inside the WRONG goal
                    this.handleWrongDrop(ball);
                }
                break;
            }
        }

        // If not in any goal, just release it without rejection velocity
        if (!landedInGoal) {
            ball.body.setAllowGravity(true);
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
        ball.list[0].setTint(0x00cc44);

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

        // Push downwards (Rejection)
        ball.body.setVelocity(Phaser.Math.Between(-20, 20), 200);

        // Visual Feedback - Blink Red and White for 2 seconds
        const ballImage = ball.list[0];
        let isRed = true;

        // Create a timer event to toggle colors
        // Blink every 100ms for 20 times = 2000ms (2 seconds)
        const blinkEvent = this.time.addEvent({
            delay: 100,
            repeat: 19,
            callback: () => {
                if (ballImage && ballImage.active) {
                    // Toggle between Red (0xff0000) and White (0xffffff)
                    ballImage.setTint(isRed ? 0xff0000 : 0xffffff);
                    isRed = !isRed;
                }
            }
        });

        // After 2 seconds, reset to original Blue color
        this.time.delayedCall(2000, () => {
            if (ballImage && ballImage.active) {
                ballImage.setTint(0x0077ff); // Back to original blue
            }
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