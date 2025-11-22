export class GoalManager {
    constructor(scene) {
        this.scene = scene;
        this.goals = [];
        // Create a static group for the walls
        this.walls = this.scene.physics.add.staticGroup();
        // NEW: Create a separate static group for bottom walls to manage them easily
        this.bottomWalls = this.scene.physics.add.staticGroup();
        // NEW: Track timers for the glitch effect to clean them up on level reset
        this.glitchTimers = [];

        // Settings
        this.goalSize = 70;
        this.wallThickness = 8;
        this.wallColor = 0x555555; // Color for the visible walls
    }

    /**
     * Creates the goal containers and physical walls for the given word.
     * @param {string} word
     */
    createGoals(word) {
        const startX = 100;
        const startY = 140;
        const spacing = 110;

        // Calculate total width to center them
        const totalWidth = (word.length * spacing);
        const screenCenter = this.scene.scale.width / 2;
        const startOffset = screenCenter - (totalWidth / 2) + (spacing / 2);

        for (let i = 0; i < word.length; i++) {
            const x = startOffset + (i * spacing);
            const y = startY;

            // 1. Create the Visual Goal Container
            const goalContainer = this.scene.add.container(x, y);

            // Visual Background (The "Hole")
            const bg = this.scene.add.rectangle(0, 0, this.goalSize, this.goalSize, 0x222222);
            bg.setStrokeStyle(2, 0x555555);

            // Expected Character Text
            const text = this.scene.add.text(0, 0, word[i], {
                fontSize: '48px',
                color: '#555555',
                fontFamily: 'Arial'
            }).setOrigin(0.5);

            goalContainer.add([bg, text]);

            // Store metadata
            goalContainer.expectedChar = word[i];
            goalContainer.isFilled = false;

            this.goals.push(goalContainer);

            // 2. Create Visible Physical Walls (Top, Left, Right)
            const halfSize = this.goalSize / 2;
            const halfThick = this.wallThickness / 2;

            // Top Wall
            const topWall = this.scene.add.rectangle(
                x,
                y - halfSize - halfThick,
                this.goalSize + (this.wallThickness * 2),
                this.wallThickness,
                this.wallColor
            );
            this.scene.physics.add.existing(topWall, true); // Enable static physics
            this.walls.add(topWall);

            // Left Wall
            const leftWall = this.scene.add.rectangle(
                x - halfSize - halfThick,
                y,
                this.wallThickness,
                this.goalSize,
                this.wallColor
            );
            this.scene.physics.add.existing(leftWall, true);
            this.walls.add(leftWall);

            // Right Wall
            const rightWall = this.scene.add.rectangle(
                x + halfSize + halfThick,
                y,
                this.wallThickness,
                this.goalSize,
                this.wallColor
            );
            this.scene.physics.add.existing(rightWall, true);
            this.walls.add(rightWall);

            // NEW: Bottom Wall (Initially visible)
            const bottomWall = this.scene.add.rectangle(
                x,
                y + halfSize + halfThick,
                this.goalSize + (this.wallThickness * 2),
                this.wallThickness,
                this.wallColor
            );
            this.scene.physics.add.existing(bottomWall, true);
            this.bottomWalls.add(bottomWall);
        }
    }

    // NEW: Initiates the glitch sequence for the letters inside the goals
    startGlitchSequence() {
        // Get the text objects from the goals (index 1 in container children)
        const texts = this.goals.map(goal => goal.list[1]);

        // Shuffle them to randomize the order
        const shuffledTexts = Phaser.Utils.Array.Shuffle([...texts]);

        shuffledTexts.forEach((textObj, index) => {
            // Start 3 seconds after call, then 1 second apart
            const delay = 3000 + (index * 1000);

            const timer = this.scene.time.delayedCall(delay, () => {
                // Ensure object is still active before animating
                if (textObj.active) {
                    this.runGlitchEffect(textObj);
                }
            });
            this.glitchTimers.push(timer);
        });
    }

    // NEW: Performs the visual glitch animation
    runGlitchEffect(textObj) {
        // 1. Jitter/Shake
        this.scene.tweens.add({
            targets: textObj,
            x: { from: textObj.x, to: textObj.x + Phaser.Math.Between(-5, 5) },
            y: { from: textObj.y, to: textObj.y + Phaser.Math.Between(-5, 5) },
            alpha: { from: 1, to: 0.5 },
            duration: 50,
            yoyo: true,
            repeat: 5,
            onComplete: () => {
                // 2. Fly out of screen (Glitch out)
                this.scene.tweens.add({
                    targets: textObj,
                    y: -1000, // Move well off-screen relative to container
                    scaleX: 0.1, // Distort
                    scaleY: 2,
                    alpha: 0,
                    duration: 200,
                    ease: 'Power1'
                });
            }
        });
    }

    getGoals() {
        return this.goals;
    }

    getWallGroup() {
        return this.walls;
    }

    // NEW: Get the bottom walls group
    getBottomWallGroup() {
        return this.bottomWalls;
    }

    // NEW: Toggle visibility and physics of bottom walls
    toggleBottomWalls(enabled) {
        this.bottomWalls.children.iterate((wall) => {
            if (wall && wall.body) {
                wall.setVisible(enabled);
                wall.body.enable = enabled;
            }
        });
    }

    clear() {
        // NEW: Clear any pending glitch timers
        if (this.glitchTimers) {
            this.glitchTimers.forEach(timer => timer.remove(false));
        }
        this.glitchTimers = [];

        // Destroy visual goals
        this.goals.forEach(goal => goal.destroy());
        this.goals = [];

        // Clear physics walls (remove from scene and destroy)
        this.walls.clear(true, true);
        // NEW: Clear bottom walls
        this.bottomWalls.clear(true, true);
    }

    resize(width, height, totalLetters) {
        // For now, we rely on a full level reset (startNewLevel) to handle resizing
        // of static physics bodies correctly.
    }
}