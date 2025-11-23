export class InputManager {
    constructor(scene) {
        this.scene = scene;
        this.customCursor = null;
        this.draggedObject = null; // Track the object currently being dragged
        this.currentPointer = null; // NEW: Track the specific pointer (mouse or touch ID)
    }

    create() {
        // --- Custom Cursor Setup ---
        this.scene.input.setDefaultCursor('none');

        const cursorSize = 32;
        const cursorGraphics = this.scene.make.graphics();
        cursorGraphics.lineStyle(2, 0xFFFFFF, 1);

        cursorGraphics.moveTo(cursorSize / 2, 0);
        cursorGraphics.lineTo(cursorSize / 2, cursorSize);
        cursorGraphics.moveTo(0, cursorSize / 2);
        cursorGraphics.lineTo(cursorSize, cursorSize / 2);
        cursorGraphics.strokePath();

        cursorGraphics.generateTexture('customCursorTexture', cursorSize, cursorSize);
        cursorGraphics.destroy();

        this.customCursor = this.scene.add.image(0, 0, 'customCursorTexture');
        this.customCursor.setDepth(1000);

        this.setupInputListeners();
    }

    setupInputListeners() {
        // Update custom cursor position
        this.scene.input.on('pointermove', (pointer) => {
            this.customCursor.x = pointer.x;
            this.customCursor.y = pointer.y;
        });

        this.scene.input.on('dragstart', (pointer, gameObject) => {
            // --- Audio: Click Sound ---
            this.scene.sound.play('click');

            gameObject.isDragging = true;
            this.draggedObject = gameObject;

            // NEW: Store reference to the specific pointer (touch finger) dragging this object
            this.currentPointer = pointer;

            // MODIFIED: Visual Feedback - Accent Color
            // Change tint to a lighter blue (Accent) to indicate interaction
            const ballImage = gameObject.list[0];
            ballImage.setTint(0x44aaff);

            this.scene.children.bringToTop(gameObject);
            this.bringCursorToTop();

            // Notify scene that drag started (to hide bottom walls)
            if (this.scene.handleDragStart) {
                this.scene.handleDragStart();
            }
        });

        this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            // Just update the cursor visual
            this.customCursor.x = pointer.x;
            this.customCursor.y = pointer.y;
        });

        this.scene.input.on('dragend', (pointer, gameObject) => {
            gameObject.isDragging = false;
            this.draggedObject = null;
            this.currentPointer = null; // NEW: Clear pointer reference

            // MODIFIED: Reset Visual Feedback
            // Return to original Blue color (0x0077ff)
            // Note: If dropped in a wrong goal, GameScene will override this with the blinking effect immediately.
            const ballImage = gameObject.list[0];
            ballImage.setTint(0x0077ff);

            // Notify scene that drag ended (to schedule wall reappearance)
            if (this.scene.handleDragEnd) {
                this.scene.handleDragEnd();
            }

            // Trigger logic in GameScene
            this.scene.handleBallDrop(gameObject);
        });
    }

    // Update loop to handle physics-based dragging
    update() {
        // MODIFIED: Check for currentPointer to ensure we follow the correct finger on touch devices
        if (this.draggedObject && this.draggedObject.active && this.draggedObject.body && this.currentPointer) {

            // Calculate vector from ball to the specific pointer being used
            // Using a P-controller approach (spring-like)
            const speed = 10; // Responsiveness factor
            const maxVelocity = 1000; // Prevent tunneling through walls

            let vX = (this.currentPointer.x - this.draggedObject.x) * speed;
            let vY = (this.currentPointer.y - this.draggedObject.y) * speed;

            // Clamp velocity
            vX = Phaser.Math.Clamp(vX, -maxVelocity, maxVelocity);
            vY = Phaser.Math.Clamp(vY, -maxVelocity, maxVelocity);

            this.draggedObject.body.setVelocity(vX, vY);
        }
    }

    bringCursorToTop() {
        if (this.customCursor) {
            this.scene.children.bringToTop(this.customCursor);
        }
    }
}