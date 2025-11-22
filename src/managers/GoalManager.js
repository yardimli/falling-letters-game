export class GoalManager {
    constructor(scene) {
        this.scene = scene;
        this.goals = [];
        // Create a static group for the walls
        this.walls = this.scene.physics.add.staticGroup();

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
        }
    }

    getGoals() {
        return this.goals;
    }

    getWallGroup() {
        return this.walls;
    }

    clear() {
        // Destroy visual goals
        this.goals.forEach(goal => goal.destroy());
        this.goals = [];

        // Clear physics walls (remove from scene and destroy)
        this.walls.clear(true, true);
    }

    resize(width, height, totalLetters) {
        // For now, we rely on a full level reset (startNewLevel) to handle resizing
        // of static physics bodies correctly.
    }
}