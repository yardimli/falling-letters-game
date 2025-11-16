class TopScore {
	/**
	 * MODIFIED: The constructor now accepts word data loaded from the JSON file.
	 * @param {Phaser.Scene} scene The main game scene.
	 * @param {object} wordData The dictionary of words loaded from JSON.
	 */
	constructor(scene, wordData) {
		this.scene = scene;
		this.wordData = wordData; // NEW: Store the loaded word data.

		this.currentScore = 0; // NEW: Tracks the number of completed words.

		// --- UI element references ---
		this.totalProgressBar = null;
		this.totalProgressContainer = null;
		this.totalProgressRectangles = [];
		this.totalScoreText = null; // MODIFIED: Renamed for clarity.
		this.userNameText = null;
		this.lastRectanglesShown = 0;

		this.gameOverTriggered = false;

		const sharedConfig = GAME_CONFIG.Shared;
		const scoreScenesConfig = GAME_CONFIG.ScoreScenes;

		this.TOP_SCORE_SCREEN_HEIGHT = scoreScenesConfig.TOP_SCORE_SCREEN_HEIGHT;
		this.TOTAL_MAX_SCORE = 0; // MODIFIED: This will be set dynamically.
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
		this.RIGHT_SCORE_SCREEN_WIDTH = sharedConfig.RIGHT_SCORE_SCREEN_WIDTH;

		this.PROGRESS_RECT_WIDTH = 3;
		this.PROGRESS_RECT_PADDING = 2;
		this.PROGRESS_ANIMATION_DELAY = 50;
	}

	init() {
		console.log('TopScore: init()');

		this.scene.game.events.on('boardConfigurationChanged', this.handleBoardChange, this);
		// MODIFIED: Listen for the 'wordCompleted' event instead of 'scorePoint'.
		this.scene.game.events.on('wordCompleted', this.incrementScore, this);
		// REMOVED: The 'maxScoreChanged' event is no longer needed.
	}

	handleBoardChange(config) {
		this.currentScore = 0; // Reset completed words count.
		this.gameOverTriggered = false;

		// NEW: Set max score based on the number of available words for the selected length.
		const wordLength = config.sides.toString();
		const wordList = this.wordData[wordLength] || [];
		this.TOTAL_MAX_SCORE = wordList.length;

		console.log(`TopScore: New board with ${config.sides} goals. Max score (total words) is ${this.TOTAL_MAX_SCORE}`);

		this.drawScoreboard();
		this.updateTotalScoreBar();
	}

	/**
	 * NEW: This method is called when a word is successfully spelled.
	 */
	incrementScore() {
		this.currentScore++;
		this.updateTotalScoreBar();
	}

	drawScoreboard() {
		if (this.totalProgressBar) this.totalProgressBar.destroy();
		if (this.totalProgressContainer) this.totalProgressContainer.destroy();
		if (this.totalScoreText) this.totalScoreText.destroy();
		if (this.userNameText) this.userNameText.destroy();
		this.totalProgressRectangles = [];
		this.lastRectanglesShown = 0;

		const areaX = this.SELECTOR_SCREEN_WIDTH;
		const areaY = 0;
		const areaWidth = this.scene.scale.width - areaX - this.RIGHT_SCORE_SCREEN_WIDTH;
		const areaHeight = this.TOP_SCORE_SCREEN_HEIGHT;
		const barHeight = areaHeight * 0.8;
		const barY = areaY + areaHeight / 2;
		const barWidth = areaWidth * 0.9;
		const barX = areaX + (areaWidth - barWidth) / 2;

		this.totalProgressBar = this.scene.add.rectangle(barX + barWidth / 2, barY, barWidth, barHeight, 0x111111)
			.setStrokeStyle(2, 0xFFFFFF);

		this.totalProgressContainer = this.scene.add.container(barX + barWidth / 2, barY);

		const availableWidth = barWidth - (2 * this.PROGRESS_RECT_PADDING);
		const rectTotalWidth = this.PROGRESS_RECT_WIDTH + this.PROGRESS_RECT_PADDING;
		const maxRectangles = Math.floor(availableWidth / rectTotalWidth);
		this.maxRectangles = maxRectangles;

		const startRectX = barWidth / 2 - this.PROGRESS_RECT_PADDING - (this.PROGRESS_RECT_WIDTH / 2);
		for (let i = 0; i < maxRectangles; i++) {
			const rectX = startRectX - (i * rectTotalWidth);
			const rect = this.scene.add.rectangle(
				rectX, 0, this.PROGRESS_RECT_WIDTH, barHeight - 8, 0xDDDDDD
			);
			rect.setScale(0, 1);
			rect.setAlpha(0);
			this.totalProgressContainer.add(rect);
			this.totalProgressRectangles.push(rect);
		}

		this.userNameText = this.scene.add.text(barX + 100, barY, 'Ege', {
			font: '28px monospace',
			fill: '#FFFFFF',
			stroke: '#000000',
			strokeThickness: 4,
			align: 'center'
		}).setOrigin(0.5);

		// MODIFIED: The text now shows word count instead of a percentage.
		this.totalScoreText = this.scene.add.text(barX + barWidth - 300, barY, `Words: 0 / ${this.TOTAL_MAX_SCORE}`, {
			font: '28px monospace',
			fill: '#FFFFFF',
			stroke: '#000000',
			strokeThickness: 4,
			align: 'center'
		}).setOrigin(0.5);
	}

	updateTotalScoreBar() {
		if (!this.totalProgressRectangles || this.totalProgressRectangles.length === 0) {
			return;
		}

		// MODIFIED: The score is now the number of completed words.
		const totalScore = this.currentScore;
		const targetPercentage = this.TOTAL_MAX_SCORE > 0 ?
			Math.floor((totalScore / this.TOTAL_MAX_SCORE) * 100) :
			0;

		// MODIFIED: Update the score text directly without a tween.
		if (this.totalScoreText) {
			this.totalScoreText.setText(`Words: ${totalScore} / ${this.TOTAL_MAX_SCORE}`);
		}

		const rectanglesToShow = Math.floor((targetPercentage / 100) * this.maxRectangles);

		this.totalProgressRectangles.forEach((rect, index) => {
			if (index < rectanglesToShow) {
				if (rect.scaleX === 0) {
					const delayIndex = index - this.lastRectanglesShown;
					this.scene.tweens.add({
						targets: rect,
						scaleX: 1,
						alpha: 1,
						duration: 200,
						ease: 'Back.easeOut',
						delay: Math.max(0, delayIndex) * this.PROGRESS_ANIMATION_DELAY
					});
				}
			} else {
				if (rect.scaleX > 0) {
					this.scene.tweens.add({
						targets: rect,
						scaleX: 0,
						alpha: 0,
						duration: 150,
						ease: 'Cubic.easeIn'
					});
				}
			}
		});

		this.lastRectanglesShown = rectanglesToShow;

		// MODIFIED: Game over is triggered when all words for that length are completed.
		if (totalScore >= this.TOTAL_MAX_SCORE && !this.gameOverTriggered && this.TOTAL_MAX_SCORE > 0) {
			this.gameOverTriggered = true;
			this.scene.game.events.emit('gameOver');
			console.log('Game Over event emitted! All words completed.');
		}
	}

	handleResize(gameSize) {
		this.drawScoreboard();
		this.updateTotalScoreBar();
	}
}