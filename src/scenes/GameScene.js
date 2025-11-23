import { ScoreBoard } from '../ui/ScoreBoard.js';
import { BallManager } from '../managers/BallManager.js';
import { GoalManager } from '../managers/GoalManager.js';
import { InputManager } from '../managers/InputManager.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    // MODIFIED: Init method now accepts specific word data from SelectionScene
    init(data) {
        this.targetWordObj = data.wordObj;
        console.log(`GameScene started for: ${this.targetWordObj.text}`);
    }

    preload() {
        // Audio Assets
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
        // Fade in transition
        this.cameras.main.fadeIn(500, 0, 0, 0);

        this.createBackground();
        this.createBallTexture();
        this.createParticleTexture();

        // State
        this.currentWordText = this.targetWordObj.text;
        this.wordCorrectCount = 0;
        this.globalCorrectCount = 0;
        this.globalWrongCount = 0;
        this.totalSessionLetters = this.currentWordText.length;
        this.wallTimer = null;

        // Image Display Container
        this.wordImage = null;

        // Physics Boundaries
        this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);

        // Initialize Managers
        this.scoreBoard = new ScoreBoard(this);
        this.scoreBoard.create();

        this.ballManager = new BallManager(this);
        this.goalManager = new GoalManager(this);
        this.inputManager = new InputManager(this);

        this.inputManager.create();

        // Start Logic for the single word
        this.setupSingleWord();

        // Event Listeners
        this.scale.on('resize', this.resize, this);

        // Add a "Back" button
        this.createBackButton();
    }

    createBackButton() {
        const btn = this.add.text(50, 50, '← BACK', {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
        }).setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => {
            this.returnToSelection();
        });
    }

    createBackground() {
        const width = this.scale.width;
        const height = this.scale.height;
        this.bgGraphics = this.add.graphics();
        this.bgGraphics.fillGradientStyle(0x1a2a6c, 0xb21f1f, 0x000000, 0x000000, 1);
        this.bgGraphics.fillRect(0, 0, width, height);
        this.bgGraphics.setDepth(-100);
    }

    createBallTexture() {
        if (this.textures.exists('ball3d')) return;
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

    createParticleTexture() {
        if (this.textures.exists('particle')) return;
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

    setupSingleWord() {
        // Display Image (using the texture key loaded in SelectionScene)
        // The texture key is the word text itself based on SelectionScene logic
        if (this.textures.exists(this.targetWordObj.text)) {
            this.displayWordImage(this.targetWordObj.text);
        }

        // Setup Entities
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

    displayWordImage(key) {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        this.wordImage = this.add.image(cx, cy, key);
        this.wordImage.setOrigin(0.5);
        const maxSize = 200;
        if (this.wordImage.width > maxSize || this.wordImage.height > maxSize) {
            const scale = maxSize / Math.max(this.wordImage.width, this.wordImage.height);
            this.wordImage.setScale(scale);
        }
        this.wordImage.setAlpha(0);
        this.tweens.add({
            targets: this.wordImage,
            alpha: 1,
            duration: 500
        });
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
        ball.list[0].setTint(0x00cc44);

        this.wordCorrectCount++;
        this.globalCorrectCount++;
        this.scoreBoard.update(this.globalCorrectCount, this.globalWrongCount, this.totalSessionLetters);

        if (this.wordCorrectCount === this.currentWordText.length) {
            this.handleWordCompletion();
        }
    }

    handleWordCompletion() {
        this.time.delayedCall(500, () => {
            const lockedBalls = this.ballManager.balls.filter(b => b.isLocked);
            this.ballManager.explodeBalls(lockedBalls);

            // MODIFIED: Return to Selection Scene after explosion
            this.time.delayedCall(1500, () => {
                // Update Registry
                const completed = this.registry.get('completedWords') || [];
                if (!completed.includes(this.currentWordText)) {
                    completed.push(this.currentWordText);
                    this.registry.set('completedWords', completed);
                }

                this.returnToSelection();
            });
        });
    }

    returnToSelection() {
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.start('SelectionScene');
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
        if (this.bgGraphics) {
            this.bgGraphics.clear();
            this.bgGraphics.fillGradientStyle(0x1a2a6c, 0xb21f1f, 0x000000, 0x000000, 1);
            this.bgGraphics.fillRect(0, 0, width, height);
        }
        this.scoreBoard.resize(width, height);
        if (this.currentWordText) {
            this.goalManager.resize(width, height, this.currentWordText.length);
        }
        if (this.wordImage) {
            this.wordImage.setPosition(width / 2, height / 2 - 100);
        }
    }
}