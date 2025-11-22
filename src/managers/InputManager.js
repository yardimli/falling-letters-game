export class InputManager {
    constructor(scene) {
        this.scene = scene;
        this.customCursor = null;
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

            // Stop physics
            gameObject.body.setAllowGravity(false);
            gameObject.body.setVelocity(0, 0);

            // Highlight: Yellow
            const circle = gameObject.list[0];
            circle.setFillStyle(0xffff00);

            this.scene.children.bringToTop(gameObject);
            this.bringCursorToTop();
        });

        this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            gameObject.x = dragX;
            gameObject.y = dragY;

            this.customCursor.x = pointer.x;
            this.customCursor.y = pointer.y;
        });

        this.scene.input.on('dragend', (pointer, gameObject) => {
            gameObject.isDragging = false;

            // Reset Highlight: Blue
            const circle = gameObject.list[0];
            circle.setFillStyle(0x0077ff);

            // Trigger logic in GameScene
            this.scene.handleBallDrop(gameObject);
        });
    }

    bringCursorToTop() {
        if (this.customCursor) {
            this.scene.children.bringToTop(this.customCursor);
        }
    }
}