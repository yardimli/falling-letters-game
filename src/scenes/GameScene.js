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
        // NEW: Create a gradient background
        this.createBackground();

        // NEW: Generate the 3D Ball Texture programmatically
        this.createBallTexture();

        // NEW: Generate a particle texture for explosions
        this.createParticleTexture();

        // State
        this.wordQueue = []; // Queue for the 3 words
        this.currentWordObj = null; // Store the full object {text, image, lang}
        this.currentWordText = ""; // Store just the string
        this.wordCorrectCount = 0; // Correct letters for current word
        this.globalCorrectCount = 0; // Correct letters for entire session (3 words)
        this.globalWrongCount = 0;
        this.totalSessionLetters = 0; // Total letters across all 3 words
        this.wallTimer = null;

        // Image Display Container
        this.wordImage = null;

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

    // NEW: Adds a nice gradient background
    createBackground() {
        const width = this.scale.width;
        const height = this.scale.height;

        // Create a graphics object for the background
        this.bgGraphics = this.add.graphics();

        // Fill with a vertical gradient: Dark Blue/Purple to Black
        this.bgGraphics.fillGradientStyle(0x1a2a6c, 0xb21f1f, 0x000000, 0x000000, 1);
        this.bgGraphics.fillRect(0, 0, width, height);
        this.bgGraphics.setDepth(-100); // Ensure it stays behind everything
    }

    // NEW: Helper to create a 3D-looking sphere texture using Canvas gradients
    createBallTexture() {
        const size = 64;
        const texture = this.textures.createCanvas('ball3d', size, size);
        const context = texture.getContext();

        const centerX = size / 2;
        const centerY = size / 2;
        const radius = 25;

        const grd = context.createRadialGradient(centerX - 10, centerY - 10, 2, centerX, centerY, radius);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(1, '#888888');

        context.fillStyle = grd;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fill();

        context.lineWidth = 3;
        context.strokeStyle = '#ffffff';
        context.stroke();

        texture.refresh();
    }

    // NEW: Create a simple texture for particle explosions
    createParticleTexture() {
        const size = 16;
        const texture = this.textures.createCanvas('particle', size, size);
        const context = texture.getContext();

        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        context.fill();

        texture.refresh();
    }

    update() {
        this.ballManager.update();

        if (this.inputManager) {
            this.inputManager.update();
        }
    }

    initGameSession() {
        const data = this.cache.json.get('wordData');
        // Shuffle and pick 3 words
        const allWords = Phaser.Utils.Array.Shuffle([...data.words]);
        this.wordQueue = allWords.slice(0, 3);

        // Calculate total letters based on the 'text' property
        this.totalSessionLetters = this.wordQueue.reduce((acc, wordObj) => acc + wordObj.text.length, 0);
        this.globalCorrectCount = 0;
        this.globalWrongCount = 0;

        this.scoreBoard.reset();
        this.startNextWord();
    }

    startNextWord() {
        if (this.wordQueue.length === 0) {
            alert("All Words Complete!");
            this.initGameSession();
            return;
        }

        // Clean up previous round
        this.ballManager.clear();
        this.goalManager.clear();
        if (this.wordImage) {
            this.wordImage.destroy();
            this.wordImage = null;
        }

        // Get next word object
        this.currentWordObj = this.wordQueue.pop();
        this.currentWordText = this.currentWordObj.text; // Extract string
        this.wordCorrectCount = 0;

        // --- NEW: Load and Display Image ---
        // Since images are dynamic, we load them on the fly
        if (this.currentWordObj.image) {
            const imgKey = 'wordImg_' + Date.now(); // Unique key to prevent caching issues
            this.load.image(imgKey, this.currentWordObj.image);
            this.load.once('complete', () => {
                this.displayWordImage(imgKey);
                this.setupLevelEntities(); // Start game after image loads
            });
            this.load.start();
        } else {
            this.setupLevelEntities();
        }
    }

    displayWordImage(key) {
        // Display image in the center, slightly transparent or behind goals
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        this.wordImage = this.add.image(cx, cy, key);
        this.wordImage.setOrigin(0.5);

        // Scale down if too big
        const maxSize = 200;
        if (this.wordImage.width > maxSize || this.wordImage.height > maxSize) {
            const scale = maxSize / Math.max(this.wordImage.width, this.wordImage.height);
            this.wordImage.setScale(scale);
        }

        // Add a border/frame effect
        this.wordImage.setAlpha(0);
        this.tweens.add({
            targets: this.wordImage,
            alpha: 1,
            duration: 500
        });
    }

    setupLevelEntities() {
        // Create Goals and Balls using the text string
        this.goalManager.createGoals(this.currentWordText);
        this.ballManager.createLetterBalls(this.currentWordText);

        this.ballManager.enableCollisions();

        if (this.ballManager.ballGroup) {
            if (this.goalManager.getWallGroup()) {
                this.physics.add.collider(this.ballManager.ballGroup, this.goalManager.getWallGroup());
            }
            if (this.goalManager.getBottomWallGroup()) {
                this.physics.add.collider(this.ballManager.ballGroup, this.goalManager.getBottomWallGroup());
            }
        }

        this.inputManager.bringCursorToTop();
        this.goalManager.startGlitchSequence();
    }

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

    handleBallDrop(ball) {
        let landedInGoal = false;
        const goals = this.goalManager.getGoals();

        for (let goal of goals) {
            const distance = Phaser.Math.Distance.Between(ball.x, ball.y, goal.x, goal.y);

            if (distance < 60 && !goal.isFilled) {
                landedInGoal = true;
                if (ball.char === goal.expectedChar) {
                    this.handleCorrectDrop(ball, goal);
                } else {
                    this.handleWrongDrop(ball);
                }
                break;
            }
        }

        if (!landedInGoal) {
            ball.body.setAllowGravity(true);
            ball.body.setDrag(100);
        }
    }

    handleCorrectDrop(ball, goal) {
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

        this.scoreBoard.update(this.globalCorrectCount, this.globalWrongCount, this.totalSessionLetters);

        // Check if current word is complete
        if (this.wordCorrectCount === this.currentWordText.length) {
            // MODIFIED: Call the explosion sequence instead of just waiting
            this.handleWordCompletion();
        }
    }

    // NEW: Handles the fun explosion sequence
    handleWordCompletion() {
        // 1. Wait a brief moment to see the completed word
        this.time.delayedCall(500, () => {
            // 2. Trigger explosion of all balls
            // We need to find the balls that are currently locked
            const lockedBalls = this.ballManager.balls.filter(b => b.isLocked);

            this.ballManager.explodeBalls(lockedBalls);

            // 3. Wait for explosion to finish, then load next word
            this.time.delayedCall(1500, () => {
                this.startNextWord();
            });
        });
    }

    handleWrongDrop(ball) {
        this.sound.play('drop_invalid');

        ball.body.setAllowGravity(true);
        ball.body.setVelocity(Phaser.Math.Between(-20, 20), 200);

        const ballImage = ball.list[0];
        let isRed = true;

        const blinkEvent = this.time.addEvent({
            delay: 100,
            repeat: 19,
            callback: () => {
                if (ballImage && ballImage.active) {
                    ballImage.setTint(isRed ? 0xff0000 : 0xffffff);
                    isRed = !isRed;
                }
            }
        });

        this.time.delayedCall(2000, () => {
            if (ballImage && ballImage.active) {
                ballImage.setTint(0x0077ff);
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

        // Redraw background
        if (this.bgGraphics) {
            this.bgGraphics.clear();
            this.bgGraphics.fillGradientStyle(0x1a2a6c, 0xb21f1f, 0x000000, 0x000000, 1);
            this.bgGraphics.fillRect(0, 0, width, height);
        }

        this.scoreBoard.resize(width, height);
        // Ensure we use the text length for resizing logic
        if (this.currentWordText) {
            this.goalManager.resize(width, height, this.currentWordText.length);
        }

        // Reposition image on resize
        if (this.wordImage) {
            this.wordImage.setPosition(width / 2, height / 2 - 100);
        }
    }
}