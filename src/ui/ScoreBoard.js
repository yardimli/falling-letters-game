export class ScoreBoard {
    constructor(scene) {
        this.scene = scene;
        this.barWidth = 300;
        this.barHeight = 30;
        this.padding = 20;

        this.progressBar = null;
        this.accuracyBar = null;
        this.accuracyBg = null;
        this.accuracyLabel = null;
    }

    create() {
        // --- Progress Bar (Top Left) ---
        this.scene.add.text(this.padding, this.padding, "PROGRESS", { fontSize: '14px', color: '#fff' });

        // Background
        this.scene.add.rectangle(this.padding, this.padding + 20, this.barWidth, this.barHeight, 0x444444).setOrigin(0, 0);
        // Fill
        this.progressBar = this.scene.add.rectangle(this.padding, this.padding + 20, 0, this.barHeight, 0x00ff00).setOrigin(0, 0);

        // --- Accuracy Bar (Top Right) ---
        const rightX = this.scene.scale.width - this.barWidth - this.padding;
        this.accuracyLabel = this.scene.add.text(rightX, this.padding, "ACCURACY: 100%", { fontSize: '14px', color: '#fff' });

        // Background
        this.accuracyBg = this.scene.add.rectangle(rightX, this.padding + 20, this.barWidth, this.barHeight, 0x444444).setOrigin(0, 0);
        // Fill
        this.accuracyBar = this.scene.add.rectangle(rightX, this.padding + 20, this.barWidth, this.barHeight, 0x00ccff).setOrigin(0, 0);
    }

    update(correctCount, wrongCount, totalLetters) {
        // 1. Update Progress
        const progressPct = correctCount / totalLetters;
        const targetProgressWidth = this.barWidth * progressPct;

        this.scene.tweens.add({
            targets: this.progressBar,
            width: targetProgressWidth,
            duration: 300,
            ease: 'Power2'
        });

        // 2. Update Accuracy
        const totalAttempts = correctCount + wrongCount;
        let accuracyPct = 1; // Default 100%

        if (totalAttempts > 0) {
            accuracyPct = correctCount / totalAttempts;
        }

        const targetAccuracyWidth = this.barWidth * accuracyPct;

        this.scene.tweens.add({
            targets: this.accuracyBar,
            width: targetAccuracyWidth,
            duration: 300,
            ease: 'Power2'
        });

        this.accuracyLabel.setText(`ACCURACY: ${Math.round(accuracyPct * 100)}%`);
    }

    reset() {
        this.progressBar.width = 0;
        this.accuracyBar.width = this.barWidth;
        this.accuracyLabel.setText("ACCURACY: 100%");
    }

    resize(width, height) {
        const rightX = width - this.barWidth - this.padding;
        this.accuracyLabel.x = rightX;
        this.accuracyBg.x = rightX;
        this.accuracyBar.x = rightX;
    }
}