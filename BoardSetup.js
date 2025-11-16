class BoardSetup {
	constructor (scene) {
		this.scene = scene;
		this.currentSides = 3;
		this.hoveredIndex = -1;
		this.justClickedIndex = -1;

		this.PIXEL_SCALE = GAME_CONFIG.Shared.PIXEL_SCALE;
		this.SELECTOR_SCREEN_WIDTH = GAME_CONFIG.Shared.SELECTOR_SCREEN_WIDTH;
		this.SELECTOR_PIXEL_WIDTH = GAME_CONFIG.BoardSetupScene.SELECTOR_PIXEL_WIDTH;
		this.SLOT_PIXEL_HEIGHT = GAME_CONFIG.BoardSetupScene.SLOT_PIXEL_HEIGHT;
		this.NUM_RECT_ICONS = GAME_CONFIG.BoardSetupScene.NUM_RECT_ICONS;
		this.BALL_COLORS = GAME_CONFIG.Shared.BALL_COLORS;

		this.selectorHitArea = null;

		this.timerText = null;
		this.gameTimer = null;
		this.elapsedSeconds = 0;
	}

	init () {
		console.log('BoardSetup: init()');
		this.selectorTexture = this.scene.textures.createCanvas('selectorTexture', this.SELECTOR_PIXEL_WIDTH, 1);
		this.selectorImage = this.scene.add.image(0, 0, 'selectorTexture').setOrigin(0, 0).setScale(this.PIXEL_SCALE);
		this.selectorHitArea = new Phaser.Geom.Rectangle(0, 0, this.selectorTexture.width, this.selectorTexture.height);
		this.selectorImage.setInteractive(this.selectorHitArea, Phaser.Geom.Rectangle.Contains);
		this.selectorImage.on('pointermove', this.handlePointerMove, this);
		this.selectorImage.on('pointerout', this.handlePointerOut, this);
		this.selectorImage.on('pointerdown', this.handlePointerDown, this);
		const textStyle = { font: '24px monospace', fill: '#FFFFFF', align: 'center' };
		this.timerText = this.scene.add.text(0, 0, '00:00', textStyle).setOrigin(0.5).setStroke('#000000', 4);
	}

	handleResize (gameSize) {
		if (!this.selectorTexture) {
			return;
		}
		const newWidth = this.SELECTOR_PIXEL_WIDTH;
		const newHeight = gameSize.height / this.PIXEL_SCALE;
		this.selectorTexture.setSize(newWidth, newHeight);
		this.selectorHitArea.setSize(newWidth, newHeight);
		this.selectorImage.setPosition(0, 0);
		this.drawSelectorBar();
		if (this.timerText) {
			this.timerText.setPosition(this.SELECTOR_SCREEN_WIDTH / 2, gameSize.height - 30);
		}
	}

	getIconInfoFromPointer (pointer) {
		const totalIconsHeight = this.NUM_RECT_ICONS * this.SLOT_PIXEL_HEIGHT;
		const startY = (this.selectorTexture.height - totalIconsHeight) / 2;
		const localY = (pointer.y - this.selectorImage.y) / this.PIXEL_SCALE;
		if (localY >= startY && localY < startY + totalIconsHeight) {
			return { index: Math.floor((localY - startY) / this.SLOT_PIXEL_HEIGHT) };
		}
		return { index: -1 };
	}

	handlePointerMove (pointer) {
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
		const { index } = this.getIconInfoFromPointer(pointer);
		if (index !== -1) {
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
		this.startTimer();
		GAME_CONFIG.Shared.NUMBER_OF_SIDES = this.currentSides;

		const goals = [];
		for (let i = 0; i < this.currentSides; i++) {
			// MODIFIED: Goals now just have a side index. The letter will be assigned later by BallManager.
			goals.push({
				side: i,
				letter: null // Letter will be assigned by BallManager
			});
		}

		// MODIFIED: Emit the board configuration without color information.
		this.scene.game.events.emit('boardConfigurationChanged', {
			sides: this.currentSides,
			goals: goals
		});
	}

	drawSelectorBar () {
		const ctx = this.selectorTexture.getContext();
		ctx.clearRect(0, 0, this.selectorTexture.width, this.selectorTexture.height);
		const totalContentHeight = this.NUM_RECT_ICONS * this.SLOT_PIXEL_HEIGHT;
		const startY = Math.floor((this.selectorTexture.height - totalContentHeight) / 2);
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

	startTimer () {
		if (this.gameTimer) {
			this.gameTimer.remove();
		}
		this.elapsedSeconds = 0;
		this.updateTimerText();
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

	updateTimerText () {
		if (!this.timerText) return;
		const minutes = Math.floor(this.elapsedSeconds / 60);
		const seconds = this.elapsedSeconds % 60;
		const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
		this.timerText.setText(formattedTime);
	}
}