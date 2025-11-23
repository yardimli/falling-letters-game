export class BallManager {
    constructor(scene) {
        this.scene = scene;
        this.balls = [];
        this.ballGroup = null; // Physics Group for collisions
    }

    createLetterBalls(word) {
        // Create a physics group to handle collisions easier
        this.ballGroup = this.scene.physics.add.group({
            bounceX: 0.8,
            bounceY: 0.8,
            collideWorldBounds: true
        });

        const totalLetters = word.length;

        for (let i = 0; i < totalLetters; i++) {
            const char = word[i];

            const rX = Phaser.Math.Between(50, this.scene.scale.width - 50);

            // Goals are at y=140 with size 70, so bottom is approx 175-180.
            // We set a safe minimum Y of 250.
            const minY = Math.max(this.scene.scale.height / 2, 250);
            const rY = Phaser.Math.Between(minY, this.scene.scale.height - 50);

            const ball = this.scene.add.container(rX, rY);
            ball.setSize(50, 50);

            // MODIFIED: Use the generated 3D texture instead of a flat circle
            // The texture is grayscale, so we tint it to the desired Blue color (0x0077ff)
            const ballImage = this.scene.add.image(0, 0, 'ball3d');
            ballImage.setTint(0x0077ff);

            const text = this.scene.add.text(0, 0, char, { fontSize: '32px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);

            // Add image first, then text so text is on top
            ball.add([ballImage, text]);

            // Add to physics group
            this.ballGroup.add(ball);

            // Configure specific body properties after adding to group
            ball.body.setDrag(10);
            ball.body.setCircle(25);

            // Initial Velocity
            const vX = Phaser.Math.Between(-20, 20);
            const vY = Phaser.Math.Between(-30, -30);
            ball.body.setVelocity(vX, vY);

            ball.setInteractive({ draggable: true });
            ball.char = char;
            ball.isLocked = false;
            ball.isDragging = false;

            // --- Audio: Bounce on World Bounds ---
            ball.body.onWorldBounds = true;

            this.balls.push(ball);
        }

        // Listen for world bounds collision to play sound
        this.scene.physics.world.on('worldbounds', (body) => {
            // Check if the body belongs to one of our balls and has sufficient speed
            if (this.balls.includes(body.gameObject) && body.speed > 10) {
                this.playBounceSound();
            }
        });
    }

    enableCollisions() {
        // --- Enable Ball-to-Ball Collision ---
        this.scene.physics.add.collider(this.ballGroup, this.ballGroup, (ball1, ball2) => {
            // Play sound on collision if speed is high enough to warrant it
            const relativeSpeed = ball1.body.speed + ball2.body.speed;
            if (relativeSpeed > 10) {
                this.playBounceSound();
            }
        });
    }

    playBounceSound() {
        // Pick a random bounce sound for variety
        const sounds = ['bounce1', 'bounce2', 'bounce3'];
        const key = Phaser.Utils.Array.GetRandom(sounds);
        // Prevent overlapping spam by checking if sound is locked or limit volume
        this.scene.sound.play(key, { volume: 0.5 });
    }

    update() {
        // Check every ball to see if it has stopped moving
        if (this.balls) {
            this.balls.forEach(ball => {
                // Only affect balls that are not locked in a goal and not currently being dragged
                if (!ball.isLocked && !ball.isDragging && ball.body) {
                    // If speed is very low (effectively stopped)
                    if (ball.body.speed < 1) {
                        console.log('Ball stopped, reapplying velocity:', ball.char);
                        // Give a random vector and velocity
                        const vX = Phaser.Math.Between(-30, 30);
                        const vY = Phaser.Math.Between(-30, 30);
                        ball.body.setVelocity(vX, vY);
                    }
                }
            });
        }
    }

    clear() {
        if (this.balls) {
            this.balls.forEach(l => l.destroy());
        }
        this.balls = [];
        if (this.ballGroup) {
            this.ballGroup.clear(true, true);
        }
    }
}