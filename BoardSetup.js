class BoardSetup {
	constructor (scene) {
		this.scene = scene; // Store a reference to the main scene.
		this.currentSides = 3;
		// REMOVED: currentBoardType is no longer needed.
		this.hoveredIndex = -1;
		this.justClickedIndex = -1;
		// REMOVED: Hovered and clicked types are no longer needed.

		this.PIXEL_SCALE = GAME_CONFIG.Shared.PIXEL_SCALE;
		this.SELECTOR_SCREEN_WIDTH = GAME_CONFIG.Shared.SELECTOR_SCREEN_WIDTH;
		this.SELECTOR_PIXEL_WIDTH = GAME_CONFIG.BoardSetupScene.SELECTOR_PIXEL_WIDTH;
		this.SLOT_PIXEL_HEIGHT = GAME_CONFIG.BoardSetupScene.SLOT_PIXEL_HEIGHT;
		// REMOVED: NUM_ICONS is no longer used.
		this.NUM_RECT_ICONS = GAME_CONFIG.BoardSetupScene.NUM_RECT_ICONS;
		this.BALL_COLORS = GAME_CONFIG.Shared.BALL_COLORS;

		this.selectorHitArea = null;

		// --- NEW: Timer properties ---
		this.timerText = null;
		this.gameTimer = null;
		this.elapsedSeconds = 0;
	}

	init () {
		console.log('BoardSetup: init()');

		this.selectorTexture = this.scene.textures.createCanvas('selectorTexture', this.SELECTOR_PIXEL_WIDTH, 1);

		this.selectorImage = this.scene.add.image(0, 0, 'selectorTexture')
			.setOrigin(0, 0)
			.setScale(this.PIXEL_SCALE);

		this.selectorHitArea = new Phaser.Geom.Rectangle(0, 0, this.selectorTexture.width, this.selectorTexture.height);
		this.selectorImage.setInteractive(this.selectorHitArea, Phaser.Geom.Rectangle.Contains);

		this.selectorImage.on('pointermove', this.handlePointerMove, this);
		this.selectorImage.on('pointerout', this.handlePointerOut, this);
		this.selectorImage.on('pointerdown', this.handlePointerDown, this);

		// --- NEW: Create the timer text object ---
		const textStyle = { font: '24px monospace', fill: '#FFFFFF', align: 'center' };
		this.timerText = this.scene.add.text(0, 0, '00:00', textStyle)
			.setOrigin(0.5)
			.setStroke('#000000', 4);
	}

	handleResize (gameSize) {
		// This check prevents an error if handleResize is called before init.
		if (!this.selectorTexture) {
			return;
		}

		const newWidth = this.SELECTOR_PIXEL_WIDTH;
		const newHeight = gameSize.height / this.PIXEL_SCALE;
		this.selectorTexture.setSize(newWidth, newHeight);
		this.selectorHitArea.setSize(newWidth, newHeight);
		this.selectorImage.setPosition(0, 0);
		this.drawSelectorBar();

		// --- NEW: Position the timer text on resize ---
		if (this.timerText) {
			// Position it at the bottom of the selector bar area.
			this.timerText.setPosition(this.SELECTOR_SCREEN_WIDTH / 2, gameSize.height - 30);
		}
	}

	// MODIFIED: Simplified to handle only one type of icon (rectangle/number).
	getIconInfoFromPointer (pointer) {
		const totalIconsHeight = this.NUM_RECT_ICONS * this.SLOT_PIXEL_HEIGHT;
		const startY = (this.selectorTexture.height - totalIconsHeight) / 2;
		const localY = (pointer.y - this.selectorImage.y) / this.PIXEL_SCALE;

		if (localY >= startY && localY < startY + totalIconsHeight) {
			return {
				index: Math.floor((localY - startY) / this.SLOT_PIXEL_HEIGHT)
			};
		}

		return { index: -1 }; // Not over any icon
	}

	handlePointerMove (pointer) {
		// MODIFIED: Simplified to only check for index changes.
		const { index } = this.getIconInfoFromPointer(pointer);
		if (index !== this.hoveredIndex) {
			this.hoveredIndex = index;
			this.drawSelectorBar();
		}
	}

	handlePointerOut () {
		if (this.hoveredIndex !== -1) {
			this.hoveredIndex = -1;
			this.drawSelectorBar();
		}
	}

	handlePointerDown (pointer) {
		// MODIFIED: Simplified to handle only one type of icon.
		const { index } = this.getIconInfoFromPointer(pointer);
		if (index !== -1) {
			// The number of sides/goals is the icon's index plus two (2-8 goals).
			this.currentSides = index + 2;
			this.justClickedIndex = index;

			this.drawSelectorBar();
			this.emitBoardConfiguration();

			this.scene.time.delayedCall(100, () => {
				this.justClickedIndex = -1;
				this.drawSelectorBar();
			});
		}
	}

	emitBoardConfiguration () {
		// --- MODIFIED: Start the timer when the board configuration is set/changed ---
		this.startTimer();

		// REMOVED: The logic to dynamically calculate the total max score has been moved.
		// The total max score is now managed directly in GameScene.
		GAME_CONFIG.Shared.NUMBER_OF_SIDES = this.currentSides;

		const shuffledColors = Phaser.Utils.Array.Shuffle([...this.BALL_COLORS]);
		const selectedColors = shuffledColors.slice(0, this.currentSides);

		const goals = [];
		for (let i = 0; i < this.currentSides; i++) {
			goals.push({
				side: i,
				color: selectedColors[i]
			});
		}

		// MODIFIED: Emit the board configuration without the boardType property.
		this.scene.game.events.emit('boardConfigurationChanged', {
			sides: this.currentSides,
			colors: selectedColors,
			goals: goals
		});
	}

	drawSelectorBar () {
		const ctx = this.selectorTexture.getContext();
		ctx.clearRect(0, 0, this.selectorTexture.width, this.selectorTexture.height);

		// MODIFIED: Simplified calculation to center a single group of icons.
		const totalContentHeight = this.NUM_RECT_ICONS * this.SLOT_PIXEL_HEIGHT;
		const startY = Math.floor((this.selectorTexture.height - totalContentHeight) / 2);

		// REMOVED: The entire drawing loop for Polygon Icons has been removed.

		// --- Draw Rectangle (Number) Icons ---
		ctx.font = '12px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		for (let i = 0; i < this.NUM_RECT_ICONS; i++) {
			const numGoals = i + 2;
			const cx = this.SELECTOR_PIXEL_WIDTH / 2;
			const cy = startY + i * this.SLOT_PIXEL_HEIGHT + (this.SLOT_PIXEL_HEIGHT / 2);

			const isSelected = (numGoals === this.currentSides);
			const isHovered = (i === this.hoveredIndex);
			const isClicked = (i === this.justClickedIndex);

			ctx.fillStyle = isClicked ? '#FFFFFF' : '#000';
			ctx.strokeStyle = isSelected ? '#FFFFFF' : '#00FFFF';
			if (isHovered) ctx.strokeStyle = '#FFFF00';
			this.drawPixelRect(ctx, cx - 12, cy - 15, 24, 30, isSelected ? 2 : 1);

			ctx.fillStyle = isClicked ? '#000000' : '#FFFFFF';
			let textX = cx;
			let textY = cy;
			if (isHovered && !isClicked) {
				textX += Phaser.Math.Between(-1, 1);
				textY += Phaser.Math.Between(-1, 1);
			}
			ctx.fillText(numGoals.toString(), textX, textY);
		}

		this.selectorTexture.update();
	}

	drawPixelRect (ctx, x, y, w, h, lineWidth = 1) {
		ctx.lineWidth = lineWidth;
		ctx.fillRect(x, y, w, h);
		ctx.strokeRect(x, y, w, h);
	}

	// REMOVED: drawPolygon is no longer used.

	// --- NEW: Methods to manage the game timer ---

	/**
	 * Starts or restarts the game timer.
	 */
	startTimer () {
		// Stop any existing timer.
		if (this.gameTimer) {
			this.gameTimer.remove();
		}

		this.elapsedSeconds = 0;
		this.updateTimerText(); // Display '00:00' immediately.

		// Create a new looping timer event that fires every second.
		this.gameTimer = this.scene.time.addEvent({
			delay: 1000,
			callback: () => {
				this.elapsedSeconds++;
				this.updateTimerText();
			},
			callbackScope: this,
			loop: true
		});
	}

	/**
	 * Updates the timer text display with the current elapsed time.
	 */
	updateTimerText () {
		if (!this.timerText) return;

		const minutes = Math.floor(this.elapsedSeconds / 60);
		const seconds = this.elapsedSeconds % 60;

		// Format the time to always have two digits (e.g., 01:05).
		const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

		this.timerText.setText(formattedTime);
	}
}