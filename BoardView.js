class BoardView {
	constructor (scene) {
		this.scene = scene; // Store a reference to the main scene.

		const config = GAME_CONFIG.BoardViewScene;
		const sharedConfig = GAME_CONFIG.Shared;
		const scoreScenesConfig = GAME_CONFIG.ScoreScenes;

		this.TOP_SCORE_SCREEN_HEIGHT = scoreScenesConfig.TOP_SCORE_SCREEN_HEIGHT;
		this.BOTTOM_SCORE_SCREEN_HEIGHT = scoreScenesConfig.BOTTOM_SCORE_SCREEN_HEIGHT;

		this.boardPixelDimension = 0;

		this.PIXEL_SCALE = sharedConfig.PIXEL_SCALE;
		this.SELECTOR_SCREEN_WIDTH = sharedConfig.SELECTOR_SCREEN_WIDTH;
		this.RIGHT_SCORE_SCREEN_WIDTH = sharedConfig.RIGHT_SCORE_SCREEN_WIDTH;
		this.backgroundColor = config.backgroundColor;
		this.debugDraw = config.debugDraw;
		this.glitchConfig = config.glitchConfig;
		this.goalConfig = config.goalConfig;

		this.borderSegments = [];
		this.currentSides = 3;
		// REMOVED: currentBoardType is no longer needed.
		this.goals = [];
		this.goalSensors = [];
		this.playArea = null;
		this.playAreaPolygon = null;

		this.glitchPipeline = null;
		this.debugGraphics = null;
		this.shaderGlitches = [];
		this.activeBorderGlitches = [];
		this.whiteColor = Phaser.Display.Color.ValueToColor('#FFFFFF');

		this.stretchGlitchTimer = null;
		this.borderGlitchTimer = null;
	}

	init () {
		console.log('BoardView: init()');

		this.calculateBoardPixelDimension();

		this.glitchPipeline = this.scene.cameras.main.getPostPipeline('Glitch');

		this.boardTexture = this.scene.textures.createCanvas('boardTexture', this.boardPixelDimension, this.boardPixelDimension);

		this.boardImage = this.scene.add.image(0, 0, 'boardTexture')
			.setScale(this.PIXEL_SCALE)
			.setInteractive();

		this.debugGraphics = this.scene.add.graphics();

		this.scene.game.events.on('boardConfigurationChanged', this.handleBoardConfigurationChanged, this);

		this.scheduleNextStretchGlitch();
		this.scheduleNextBorderGlitch();
	}

	handleBoardConfigurationChanged (config) {
		this.shaderGlitches = [];
		this.activeBorderGlitches = [];

		if (this.stretchGlitchTimer) {
			this.stretchGlitchTimer.remove();
			this.stretchGlitchTimer = null;
		}
		if (this.borderGlitchTimer) {
			this.borderGlitchTimer.remove();
			this.borderGlitchTimer = null;
		}

		this.currentSides = config.sides;
		this.goals = config.goals;
		// REMOVED: The board type is no longer part of the configuration.

		this.drawBoardShape();

		this.scheduleNextStretchGlitch();
		this.scheduleNextBorderGlitch();
	}

	update (time, delta) {
		this.shaderGlitches = this.shaderGlitches.filter(glitch => glitch.endTime > time);
		const maxGlitchAmount = this.shaderGlitches.reduce((max, glitch) => Math.max(max, glitch.size), 0);
		if (this.glitchPipeline) {
			this.glitchPipeline.setGlitchAmount(maxGlitchAmount);
		}
		this.updateBorderGlitches(time);
		this.drawDebug();
	}

	drawDebug () {
		this.debugGraphics.clear();
		if (this.debugDraw && this.playAreaPolygon) {
			this.debugGraphics.lineStyle(2, 0x00ff00, 0.7);
			this.goalSensors.forEach(sensor => {
				this.debugGraphics.strokePoints(sensor.vertices, true);
			});

			this.debugGraphics.lineStyle(2, 0xff0000, 0.7);
			this.debugGraphics.strokePoints(this.playAreaPolygon.points, true);
		}
	}

	drawBoardShape () {
		this.goalSensors.forEach(sensor => this.scene.matter.world.remove(sensor));
		this.goalSensors = [];
		this.borderSegments = [];

		const ctx = this.boardTexture.getContext();
		ctx.clearRect(0, 0, this.boardTexture.width, this.boardTexture.height);

		// MODIFIED: Directly call drawRectangleShape as it's the only option.
		this.drawRectangleShape();
	}

	// REMOVED: drawPolygonShape is no longer needed.

	drawRectangleShape () {
		const padding = 10;
		const { width: goalWidth } = this.goalConfig;

		const totalGoalWidth = this.currentSides * goalWidth;
		const minGapSize = 20;
		const minRequiredWidth = totalGoalWidth + (minGapSize * (this.currentSides + 1));

		const baseWidth = Math.floor(this.boardPixelDimension * 0.8);
		const rectWidth = Math.max(minRequiredWidth, baseWidth);

		const rectHeight = Math.floor(this.boardPixelDimension * 0.7) - (padding * 2);

		const canvasWidth = Math.max(this.boardPixelDimension, rectWidth + (padding * 2));
		const canvasHeight = this.boardPixelDimension;

		if (this.boardTexture.width !== canvasWidth || this.boardTexture.height !== canvasHeight) {
			this.boardTexture.setSize(canvasWidth, canvasHeight);
			this.boardImage.setDisplaySize(canvasWidth * this.PIXEL_SCALE, canvasHeight * this.PIXEL_SCALE);

			const centerX = this.scene.cameras.main.width / 2;
			const centerY = this.scene.cameras.main.height / 2;

			console.log(centerX, centerY, canvasWidth, canvasHeight);

			if (canvasWidth > canvasHeight) {
				this.boardImage.setPosition(centerX - (canvasWidth - canvasHeight - 40), centerY);
			} else {
				this.boardImage.setPosition(centerX, centerY - ((canvasHeight - canvasWidth) / 2));
			}
		}

		const rectX = (canvasWidth - rectWidth) / 2;
		const rectY = (canvasHeight - rectHeight) / 2;

		const worldCenter = { x: this.boardImage.x, y: this.boardImage.y };

		const topLeft = { x: rectX, y: rectY };
		const topRight = { x: rectX + rectWidth, y: rectY };
		const bottomRight = { x: rectX + rectWidth, y: rectY + rectHeight };
		const bottomLeft = { x: rectX, y: rectY + rectHeight };

		const worldVertices = [
			{ x: worldCenter.x + (topLeft.x - canvasWidth / 2) * this.PIXEL_SCALE, y: worldCenter.y + (topLeft.y - canvasHeight / 2) * this.PIXEL_SCALE },
			{ x: worldCenter.x + (topRight.x - canvasWidth / 2) * this.PIXEL_SCALE, y: worldCenter.y + (topRight.y - canvasHeight / 2) * this.PIXEL_SCALE },
			{ x: worldCenter.x + (bottomRight.x - canvasWidth / 2) * this.PIXEL_SCALE, y: worldCenter.y + (bottomRight.y - canvasHeight / 2) * this.PIXEL_SCALE },
			{ x: worldCenter.x + (bottomLeft.x - canvasWidth / 2) * this.PIXEL_SCALE, y: worldCenter.y + (bottomLeft.y - canvasHeight / 2) * this.PIXEL_SCALE }
		];
		this.playAreaPolygon = new Phaser.Geom.Polygon(worldVertices);
		this.playArea = { center: worldCenter, vertices: [] };

		this.drawRectangleArena(this.boardTexture.getContext(), topLeft, rectWidth, rectHeight, '#FFFFFF', this.borderSegments);
		// MODIFIED: Pass both canvasWidth and canvasHeight to ensure correct coordinate conversion.
		this.createRectangleGoalSensors(topLeft, rectWidth, worldCenter, canvasWidth, canvasHeight);
		this.boardTexture.update();
	}

	scheduleNextStretchGlitch () {
		const config = this.glitchConfig.stretch;
		const delay = Phaser.Math.Between(config.minDelay, config.maxDelay);
		this.stretchGlitchTimer = this.scene.time.delayedCall(delay, this.triggerNewStretchGlitch, [], this);
	}

	triggerNewStretchGlitch () {
		const config = this.glitchConfig.stretch;
		const newGlitch = {
			size: Phaser.Math.FloatBetween(config.minSize, config.maxSize),
			endTime: this.scene.time.now + Phaser.Math.Between(config.minDuration, config.maxDuration)
		};
		this.shaderGlitches.push(newGlitch);
		this.scheduleNextStretchGlitch();
	}

	scheduleNextBorderGlitch () {
		const config = this.glitchConfig.border;
		const delay = Phaser.Math.Between(config.minDelay, config.maxDelay);
		this.borderGlitchTimer = this.scene.time.delayedCall(delay, this.triggerBorderGlitch, [], this);
	}

	triggerBorderGlitch () {
		this.scheduleNextBorderGlitch();

		if (this.borderSegments.length === 0) return;

		const config = this.glitchConfig.border;
		const glitchLength = Phaser.Math.Between(config.minSegmentLength, config.maxSegmentLength);
		const startIndex = Phaser.Math.Between(0, this.borderSegments.length - 1);

		const glitchedSegments = [];
		for (let i = 0; i < glitchLength; i++) {
			const segment = this.borderSegments[(startIndex + i) % this.borderSegments.length];
			glitchedSegments.push(segment);
		}

		const newGlitch = {
			segments: glitchedSegments,
			startTime: this.scene.time.now,
			duration: Phaser.Math.Between(config.minDuration, config.maxDuration),
			color: Phaser.Display.Color.ValueToColor(config.color)
		};

		this.activeBorderGlitches.push(newGlitch);
	}

	updateBorderGlitches (time) {
		this.activeBorderGlitches = this.activeBorderGlitches.filter(g => time < g.startTime + g.duration);

		const ctx = this.boardTexture.getContext();
		ctx.clearRect(0, 0, this.boardTexture.width, this.boardTexture.height);

		const allGlitchedSegments = new Set();
		this.activeBorderGlitches.forEach(glitch => {
			glitch.segments.forEach(segment => allGlitchedSegments.add(segment));
		});

		const nonGlitchedSegments = this.borderSegments.filter(s => !allGlitchedSegments.has(s));
		const { dashLength, gapLength } = this.goalConfig;

		ctx.strokeStyle = '#FFFFFF';
		ctx.lineWidth = 1;

		const nonGlitchedWalls = nonGlitchedSegments.filter(s => !s.isGoal);
		if (nonGlitchedWalls.length > 0) {
			ctx.setLineDash([]);
			ctx.beginPath();
			nonGlitchedWalls.forEach(segment => {
				ctx.moveTo(segment.p1.x, segment.p1.y);
				ctx.lineTo(segment.p2.x, segment.p2.y);
			});
			ctx.stroke();
		}

		const nonGlitchedGoals = nonGlitchedSegments.filter(s => s.isGoal);
		if (nonGlitchedGoals.length > 0) {
			ctx.setLineDash([dashLength, gapLength]);
			ctx.beginPath();
			nonGlitchedGoals.forEach(segment => {
				ctx.moveTo(segment.p1.x, segment.p1.y);
				ctx.lineTo(segment.p2.x, segment.p2.y);
			});
			ctx.stroke();
		}

		this.activeBorderGlitches.forEach(glitch => {
			const elapsed = time - glitch.startTime;
			const progress = elapsed / glitch.duration;
			const pingPongProgress = 1.0 - Math.abs(progress - 0.5) * 2.0;

			const currentColor = Phaser.Display.Color.Interpolate.ColorWithColor(
				this.whiteColor,
				glitch.color,
				100,
				pingPongProgress * 100
			);

			ctx.strokeStyle = Phaser.Display.Color.RGBToString(currentColor.r, currentColor.g, currentColor.b);
			ctx.lineWidth = 1;

			const goalSegments = glitch.segments.filter(s => s.isGoal);
			const wallSegments = glitch.segments.filter(s => !s.isGoal);

			if (wallSegments.length > 0) {
				ctx.setLineDash([]);
				ctx.beginPath();
				wallSegments.forEach(segment => {
					ctx.moveTo(segment.p1.x, segment.p1.y);
					ctx.lineTo(segment.p2.x, segment.p2.y);
				});
				ctx.stroke();
			}

			if (goalSegments.length > 0) {
				ctx.setLineDash([dashLength, gapLength]);
				ctx.beginPath();
				goalSegments.forEach(segment => {
					ctx.moveTo(segment.p1.x, segment.p1.y);
					ctx.lineTo(segment.p2.x, segment.p2.y);
				});
				ctx.stroke();
			}
		});
		ctx.setLineDash([]);

		this.boardTexture.update();
	}

	handleResize (gameSize) {
		this.calculateBoardPixelDimension();

		const viewX = this.SELECTOR_SCREEN_WIDTH;
		const viewY = this.TOP_SCORE_SCREEN_HEIGHT;
		const viewWidth = gameSize.width - this.SELECTOR_SCREEN_WIDTH - this.RIGHT_SCORE_SCREEN_WIDTH;
		const viewHeight = gameSize.height - this.TOP_SCORE_SCREEN_HEIGHT - this.BOTTOM_SCORE_SCREEN_HEIGHT;
		this.boardImage.setPosition(viewX + viewWidth / 2, viewY + viewHeight / 2);

		this.drawBoardShape();
	}

	calculateBoardPixelDimension () {
		const viewportWidth = this.scene.scale.width - this.SELECTOR_SCREEN_WIDTH - this.RIGHT_SCORE_SCREEN_WIDTH;
		const viewportHeight = this.scene.scale.height - this.TOP_SCORE_SCREEN_HEIGHT - this.BOTTOM_SCORE_SCREEN_HEIGHT;

		const maxDisplaySize = Math.min(viewportWidth, viewportHeight);

		this.boardPixelDimension = Math.floor(maxDisplaySize / this.PIXEL_SCALE);
	}

	// REMOVED: drawArena for polygons is no longer needed.

	drawRectangleArena (ctx, topLeft, width, height, color, segmentStore) {
		const { width: goalWidth, depth: goalDepth, chamfer, dashLength, gapLength } = this.goalConfig;

		ctx.lineWidth = 1;
		ctx.lineCap = 'round';
		ctx.strokeStyle = color;

		const topRight = { x: topLeft.x + width, y: topLeft.y };
		const bottomRight = { x: topLeft.x + width, y: topLeft.y + height };
		const bottomLeft = { x: topLeft.x, y: topLeft.y + height };

		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.moveTo(bottomLeft.x, bottomLeft.y);
		ctx.lineTo(topLeft.x, topLeft.y); // Left wall
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(bottomLeft.x, bottomLeft.y);
		ctx.lineTo(bottomRight.x, bottomRight.y); // Bottom wall
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(bottomRight.x, bottomRight.y);
		ctx.lineTo(topRight.x, topRight.y); // Right wall
		ctx.stroke();

		if (segmentStore) {
			segmentStore.push({ p1: bottomLeft, p2: topLeft, isGoal: false });
			segmentStore.push({ p1: bottomLeft, p2: bottomRight, isGoal: false });
			segmentStore.push({ p1: bottomRight, p2: topRight, isGoal: false });
		}

		const totalGoalWidth = this.currentSides * goalWidth;
		const gapSize = (width - totalGoalWidth) / (this.currentSides + 1);
		let currentX = topLeft.x;
		let lastPost = { x: topLeft.x, y: topLeft.y };

		for (let i = 0; i < this.currentSides; i++) {
			const wallStart = lastPost;
			const wallEnd = { x: currentX + gapSize, y: topLeft.y };
			ctx.setLineDash([]);
			ctx.beginPath();
			ctx.moveTo(wallStart.x, wallStart.y);
			ctx.lineTo(wallEnd.x, wallEnd.y);
			ctx.stroke();
			if (segmentStore) {
				segmentStore.push({ p1: wallStart, p2: wallEnd, isGoal: false });
			}

			currentX += gapSize;

			const post1 = { x: currentX, y: topLeft.y };
			const post2 = { x: currentX + goalWidth, y: topLeft.y };

			const back1 = { x: post1.x + chamfer, y: post1.y - goalDepth };
			const back2 = { x: post2.x - chamfer, y: post2.y - goalDepth };

			ctx.setLineDash([dashLength, gapLength]);
			ctx.beginPath();
			ctx.moveTo(post1.x, post1.y);
			ctx.lineTo(back1.x, back1.y);
			ctx.lineTo(back2.x, back2.y);
			ctx.lineTo(post2.x, post2.y);
			ctx.stroke();

			if (segmentStore) {
				segmentStore.push({ p1: post1, p2: back1, isGoal: true });
				segmentStore.push({ p1: back1, p2: back2, isGoal: true });
				segmentStore.push({ p1: back2, p2: post2, isGoal: true });
			}

			currentX += goalWidth;
			lastPost = post2;
		}

		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.moveTo(lastPost.x, lastPost.y);
		ctx.lineTo(topRight.x, topRight.y);
		ctx.stroke();
		if (segmentStore) {
			segmentStore.push({ p1: lastPost, p2: topRight, isGoal: false });
		}

		ctx.setLineDash([]);
	}

	// REMOVED: createPolygonGoalSensors is no longer needed.

	// MODIFIED: Updated method signature and internal logic to fix a coordinate calculation bug.
	createRectangleGoalSensors (topLeft, width, worldCenter, canvasWidth, canvasHeight) {
		const { width: goalWidth, depth: goalDepth } = this.goalConfig;

		const totalGoalWidth = this.currentSides * goalWidth;
		const gapSize = (width - totalGoalWidth) / (this.currentSides + 1);
		let currentX = topLeft.x + gapSize;

		for (let i = 0; i < this.currentSides; i++) {
			const goalInfo = this.goals.find(g => g.side === i);
			if (!goalInfo) continue;

			const goalCenterX_canvas = currentX + (goalWidth / 2);
			const goalCenterY_canvas = topLeft.y - (goalDepth / 2);

			// MODIFIED: Use the actual canvas dimensions for correct world coordinate conversion.
			const goalCenterX_world = worldCenter.x + (goalCenterX_canvas - canvasWidth / 2) * this.PIXEL_SCALE;
			const goalCenterY_world = worldCenter.y + (goalCenterY_canvas - canvasHeight / 2) * this.PIXEL_SCALE;

			const sensor = this.scene.matter.add.rectangle(
				goalCenterX_world,
				goalCenterY_world,
				goalWidth * this.PIXEL_SCALE,
				goalDepth * this.PIXEL_SCALE,
				{ isSensor: true, isStatic: true, label: 'goal' }
			);

			sensor.color = goalInfo.color;
			this.goalSensors.push(sensor);

			currentX += goalWidth + gapSize;
		}
	}
}