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

        // --- New Audio Assets ---
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
        this.currentWord = "";
        this.correctCount = 0;
        this.wrongCount = 0;
        this.totalLetters = 0;

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
        this.startNewLevel();

        // Event Listeners
        this.scale.on('resize', this.resize, this);
    }

    update() {
        // Delegate update logic to BallManager (handling idle movement)
        this.ballManager.update();
    }

    startNewLevel() {
        // Cleanup previous level data via managers
        this.ballManager.clear();
        this.goalManager.clear();

        this.correctCount = 0;
        this.wrongCount = 0;

        // Get Random Word
        const data = this.cache.json.get('wordData');
        this.currentWord = Phaser.Utils.Array.GetRandom(data.words);
        this.totalLetters = this.currentWord.length;

        // Reset UI
        this.scoreBoard.reset();

        // Build Level via Managers
        this.goalManager.createGoals(this.currentWord);
        this.ballManager.createLetterBalls(this.currentWord);

        // --- Enable Collisions ---
        // Enable ball-to-ball collision
        this.ballManager.enableCollisions();

        // NEW: Enable collision between balls and goal walls
        // We assume ballManager exposes the group via 'balls' property or a getter
        // If ballManager.balls is the group:
        if (this.ballManager.balls && this.goalManager.getWallGroup()) {
            this.physics.add.collider(this.ballManager.balls, this.goalManager.getWallGroup());
        }

        // Ensure cursor is on top
        this.inputManager.bringCursorToTop();
    }

    /**
     * Called by InputManager when a ball is dropped.
     * @param {Phaser.GameObjects.Container} ball
     */
    handleBallDrop(ball) {
        let landed = false;
        const goals = this.goalManager.getGoals();

        for (let goal of goals) {
            const distance = Phaser.Math.Distance.Between(ball.x, ball.y, goal.x, goal.y);

            // Increased distance check because goals are bigger now
            if (distance < 60 && !goal.isFilled) {
                if (ball.char === goal.expectedChar) {
                    this.handleCorrectDrop(ball, goal);
                    landed = true;
                    break;
                }
            }
        }

        if (!landed) {
            this.handleWrongDrop(ball);
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

        this.correctCount++;
        this.scoreBoard.update(this.correctCount, this.wrongCount, this.totalLetters);

        if (this.correctCount === this.totalLetters) {
            this.time.delayedCall(500, () => {
                // Simple alert for now, could be a UI modal
                alert("Word Complete!");
                this.startNewLevel();
            });
        }
    }

    handleWrongDrop(ball) {
        // Play Error Sound
        this.sound.play('drop_invalid');

        ball.body.setAllowGravity(true);

        // NEW LOGIC: Push downwards
        // Since there are walls on Top, Left, and Right, the only exit is down.
        // We apply a strong positive Y velocity.
        // We also add a slight random X velocity to prevent stacking perfectly.
        ball.body.setVelocity(Phaser.Math.Between(-20, 20), 300);

        // Visual Feedback: Red then fade to Blue
        const circle = ball.list[0];
        circle.setFillStyle(0xff0000);

        this.tweens.add({
            targets: circle,
            fillColor: { from: 0xff0000, to: 0x0077ff },
            duration: 500
        });

        this.wrongCount++;
        this.scoreBoard.update(this.correctCount, this.wrongCount, this.totalLetters);
    }

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        this.cameras.main.setViewport(0, 0, width, height);
        this.physics.world.setBounds(0, 0, width, height);

        this.scoreBoard.resize(width, height);
        this.goalManager.resize(width, height, this.totalLetters);

        // On resize, we might want to restart the level to fix static physics bodies positions
        // this.startNewLevel();
    }
}