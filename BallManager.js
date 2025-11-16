// --- The Ball Manager ---
class BallManager {
	/**
	 * MODIFIED: The constructor now accepts word data loaded from a JSON file.
	 * @param {Phaser.Scene} scene The main game scene.
	 * @param {BoardView} boardView A reference to the board view manager.
	 * @param {object} wordData The dictionary of words loaded from JSON.
	 */
	constructor(scene, boardView, wordData) {
		this.scene = scene;
		this.boardView = boardView;
		this.wordData = wordData; // NEW: Store the loaded word data.

		this.ballConfig = { ...GAME_CONFIG.BallScene
		};
		// Adjusted physics parameters for stable dragging
		this.ballConfig.dragStiffness = 0.01;
		this.ballConfig.dragDamping = 0.9;
		this.ballConfig.maxDragVelocity = 10;

		this.ballConfig.maxBalls = this.ballConfig.defaultMaxBalls;

		this.balls = null;
		this.walls = null;
		this.goals = [];

		this.isGameOver = false;

		// --- NEW: Word-based game state ---
		this.currentWord = '';
		this.wordLetters = []; // e.g., ['A', 'P', 'P', 'L', 'E']
		this.placedState = []; // Array of booleans to track placed letters, e.g., [false, true, false]
		this.activeBallMap = new Map(); // Maps a word index to an active ball instance to handle duplicate letters.
		this.alphabetTexturesCreated = false; // Flag to ensure textures are made only once.
	}

	init() {
		console.log('BallManager: init()');

		this.balls = this.scene.add.group();
		this.walls = this.scene.add.group();

		// NEW: Create textures for all letters of the alphabet once at the start.
		this.createAlphabetTextures();

		this.scene.game.events.on('boardConfigurationChanged', (config) => {
			// REMOVED: Color configuration is no longer needed.
			this.ballConfig.maxBalls = config.sides;
			this.goals = config.goals;
			this.createWallsFromPolygon();
			// MODIFIED: Instead of just resetting balls, this now selects the first word for the chosen length.
			this.selectNextWord();
		}, this);

		this.scene.game.events.on('gameOver', () => {
			this.isGameOver = true;
			this.balls.getChildren().forEach(ball => {
				if (ball.lifespanTimer) {
					ball.lifespanTimer.remove();
				}
				this.fadeAndDestroyBall(ball, false);
			});
		}, this);

		// --- Physics-based Dragging Logic ---
		this.scene.input.on('dragstart', (pointer, gameObject) => {
			if (!gameObject.body || gameObject.body.label !== 'ball') return;
			this.scene.sound.play('click', { volume: 0.5 });
			gameObject.originalFrictionAir = gameObject.body.frictionAir;
			gameObject.setFrictionAir(0.1);
			gameObject.isDragging = true;
			gameObject.draggingPointer = pointer;
			gameObject.dragOffsetX = gameObject.x - pointer.x;
			gameObject.dragOffsetY = gameObject.y - pointer.y;
			this.scene.children.bringToTop(gameObject);
			gameObject.setStatic(true);
			this.scene.tweens.add({
				targets: gameObject,
				scale: this.ballConfig.finalSize * 0.75,
				duration: 150,
				ease: 'Power2',
				onComplete: () => {
					gameObject.setStatic(false);
				}
			});
		});

		// --- MODIFIED: Refactored dragend logic for letters and words ---
		this.scene.input.on('dragend', (pointer, gameObject) => {
			if (!gameObject.body || gameObject.body.label !== 'ball' || !gameObject.active) return;
			gameObject.isDragging = false;

			delete gameObject.draggingPointer;
			delete gameObject.dragOffsetX;
			delete gameObject.dragOffsetY;
			if (gameObject.originalFrictionAir !== undefined) {
				gameObject.setFrictionAir(gameObject.originalFrictionAir);
				delete gameObject.originalFrictionAir;
			}
			gameObject.setVelocity(0, 0);
			gameObject.setAngularVelocity(0);
			this.scene.tweens.killTweensOf(gameObject);

			const playArea = this.boardView.playAreaPolygon;
			const goalSensors = this.boardView.goalSensors;
			const dropX = gameObject.x;
			const dropY = gameObject.y;

			let dropType = 'invalid';
			let hitSensor = null;

			if (goalSensors && goalSensors.length > 0) {
				const point = { x: dropX, y: dropY };
				const bodiesUnderPoint = this.scene.matter.query.point(goalSensors, point);

				if (bodiesUnderPoint.length > 0) {
					hitSensor = bodiesUnderPoint[0];
					// MODIFIED: A drop is correct if the ball's index in the word matches the goal's index,
					// and that goal slot is not already filled.
					if (gameObject.wordIndex === hitSensor.sideIndex && !this.placedState[hitSensor.sideIndex]) {
						dropType = 'correct';
					} else {
						dropType = 'incorrect_goal';
					}
				}
			}

			if (dropType === 'invalid' && playArea) {
				if (Phaser.Geom.Polygon.Contains(playArea, pointer.x, pointer.y)) {
					dropType = 'valid_play_area';
				}
			}

			switch (dropType) {
				case 'correct':
					this.scene.game.events.emit('correctDrop');
					this.scene.sound.play('drop_valid', { volume: 0.6 });

					// --- MODIFIED: Logic for placing a correct letter ---
					this.placedState[gameObject.wordIndex] = true; // Mark letter as placed.
					this.activeBallMap.delete(gameObject.wordIndex); // Remove from active balls map.

					// The ball is not destroyed. It's locked in place.
					gameObject.setStatic(true);
					gameObject.setCollisionCategory(0);
					this.scene.input.disable(gameObject); // Make it undraggable.

					// Animate the ball to the center of the goal for a clean look.
					this.scene.tweens.add({
						targets: gameObject,
						x: hitSensor.position.x,
						y: hitSensor.position.y,
						scale: this.ballConfig.finalSize,
						duration: 200,
						ease: 'Power2'
					});

					this.checkForWordCompletion();

					// After a correct drop, try to spawn the next available letter.
					this.scene.time.delayedCall(500, this.spawnBall, [], this);
					break;

				case 'valid_play_area':
					this.scene.sound.play('click_drop', { volume: 0.6 });
					gameObject.setStatic(true);
					this.scene.tweens.add({
						targets: gameObject,
						scale: this.ballConfig.finalSize,
						duration: 250,
						ease: 'Sine.easeOut',
						onComplete: () => {
							gameObject.setStatic(false);
						}
					});
					break;

				case 'incorrect_goal':
				case 'invalid':
					this.scene.game.events.emit('incorrectDrop');
					this.scene.sound.play('drop_invalid', { volume: 0.6 });
					if (gameObject.active) {
						const center = this.boardView.playArea.center;
						if (center) {
							gameObject.setStatic(true);
							this.scene.tweens.add({
								targets: gameObject,
								x: center.x,
								y: center.y,
								scale: this.ballConfig.finalSize,
								duration: 500,
								ease: 'Power2',
								onComplete: () => {
									if (gameObject.active) {
										gameObject.setStatic(false);
									}
								}
							});
						} else {
							this.fadeAndDestroyBall(gameObject, true);
						}
					}
					break;
			}
		});
	}

	update(time, delta) {
		this.balls.getChildren().forEach(ball => {
			if (!ball.body || !ball.active || ball.isStatic()) {
				return;
			}
			if (ball.isDragging && ball.draggingPointer) {
				const pointer = ball.draggingPointer;
				const targetX = pointer.x + ball.dragOffsetX;
				const targetY = pointer.y + ball.dragOffsetY;
				const dx = targetX - ball.x;
				const dy = targetY - ball.y;
				const forceX = dx * this.ballConfig.dragStiffness;
				const forceY = dy * this.ballConfig.dragStiffness;
				ball.setVelocity(forceX * 60, forceY * 60);
				const currentVelocity = ball.body.velocity;
				const speed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y);
				if (speed > this.ballConfig.maxDragVelocity) {
					const scale = this.ballConfig.maxDragVelocity / speed;
					ball.setVelocity(currentVelocity.x * scale, currentVelocity.y * scale);
				}
				ball.setVelocity(
					ball.body.velocity.x * this.ballConfig.dragDamping,
					ball.body.velocity.y * this.ballConfig.dragDamping
				);
				ball.setAngularVelocity(0);
			} else {
				const goalSensors = this.boardView.goalSensors;
				const playAreaCenter = this.boardView.playArea.center;
				let isInGoal = false;
				if (goalSensors && goalSensors.length > 0) {
					const bodiesUnderPoint = this.scene.matter.query.point(goalSensors, { x: ball.x, y: ball.y });
					if (bodiesUnderPoint.length > 0) {
						isInGoal = true;
					}
				}
				if (isInGoal && playAreaCenter) {
					const direction = new Phaser.Math.Vector2(playAreaCenter.x - ball.x, playAreaCenter.y - ball.y);
					direction.normalize();
					const repelForce = 0.001;
					direction.scale(repelForce);
					ball.applyForce(direction);
				} else {
					if (Math.random() > this.ballConfig.organicMoveThreshold) {
						const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
						const force = new Phaser.Math.Vector2(
							Math.cos(angle) * this.ballConfig.organicMoveForce,
							Math.sin(angle) * this.ballConfig.organicMoveForce
						);
						ball.applyForce(force);
					}
				}
			}
		});
	}

	createWallsFromPolygon() {
		this.walls.clear(true, true);
		const borderSegments = this.boardView.borderSegments;
		const boardImage = this.boardView.boardImage;
		const boardPixelDimension = this.boardView.boardPixelDimension;
		const pixelScale = this.boardView.PIXEL_SCALE;
		if (!borderSegments || borderSegments.length === 0 || !boardImage) {
			return;
		}
		const wallThickness = 10;
		const textureCenter = { x: boardPixelDimension / 2, y: boardPixelDimension / 2 };
		borderSegments.forEach(segment => {
			const p1_world = { x: boardImage.x + (segment.p1.x - textureCenter.x) * pixelScale, y: boardImage.y + (segment.p1.y - textureCenter.y) * pixelScale };
			const p2_world = { x: boardImage.x + (segment.p2.x - textureCenter.x) * pixelScale, y: boardImage.y + (segment.p2.y - textureCenter.y) * pixelScale };
			const length = Phaser.Math.Distance.BetweenPoints(p1_world, p2_world);
			const angle = Phaser.Math.Angle.BetweenPoints(p1_world, p2_world);
			const centerX = (p1_world.x + p2_world.x) / 2;
			const centerY = (p1_world.y + p2_world.y) / 2;
			const wallSegmentGO = this.scene.add.rectangle(centerX, centerY, length, wallThickness);
			this.scene.matter.add.gameObject(wallSegmentGO, { isStatic: true, restitution: 0.5, friction: 0.1 });
			wallSegmentGO.setRotation(angle);
			wallSegmentGO.setVisible(false);
			this.walls.add(wallSegmentGO);
		});
	}

	/**
	 * NEW: Checks if the current word has been fully spelled.
	 */
	checkForWordCompletion() {
		if (this.placedState.every(isPlaced => isPlaced)) {
			console.log(`Word complete: ${this.currentWord}`);
			// NEW: Emit an event that the TopScore manager can listen for.
			this.scene.game.events.emit('wordCompleted');

			this.scene.time.delayedCall(2000, () => {
				this.balls.getChildren().forEach(ball => {
					this.fadeAndDestroyBall(ball, false);
				});
				this.selectNextWord();
			}, [], this);
		}
	}

	/**
	 * NEW: Selects a new word and sets up the game state for the new round.
	 */
	selectNextWord() {
		this.activeBallMap.clear();

		const wordLength = this.ballConfig.maxBalls.toString();
		const wordList = this.wordData[wordLength];

		if (!wordList || wordList.length === 0) {
			console.error(`No words of length ${wordLength} found in words.json`);
			return;
		}

		this.currentWord = Phaser.Utils.Array.GetRandom(wordList);
		this.wordLetters = this.currentWord.split('');
		this.placedState = new Array(this.wordLetters.length).fill(false);
		console.log(`New word: ${this.currentWord}`);

		this.boardView.setGoalLetters(this.wordLetters);

		this.resetBalls();
	}

	spawnBall() {
		if (this.isGameOver) return;
		if (this.activeBallMap.size >= this.ballConfig.maxBalls) {
			return;
		}
		if (!this.boardView.playArea || !this.boardView.playArea.center) {
			this.scene.time.delayedCall(50, this.spawnBall, [], this);
			return;
		}

		let availableIndex = -1;
		const shuffledIndices = Phaser.Utils.Array.Shuffle([...this.wordLetters.keys()]);

		for (const i of shuffledIndices) {
			if (!this.placedState[i] && !this.activeBallMap.has(i)) {
				availableIndex = i;
				break;
			}
		}

		if (availableIndex === -1) {
			return;
		}

		const targetPoint = this.boardView.playArea.center;
		const spawnX = targetPoint.x;
		const spawnY = -50;

		const ballLetter = this.wordLetters[availableIndex];
		const textureKey = `ball_${ballLetter}`;

		const ball = this.scene.matter.add.image(spawnX, spawnY, textureKey, null, {
			shape: { type: 'circle', radius: this.ballConfig.pixelSize },
			restitution: this.ballConfig.restitution,
			frictionAir: this.ballConfig.frictionAir,
			label: 'ball'
		});
		this.balls.add(ball);
		ball.letter = ballLetter;
		ball.wordIndex = availableIndex;
		ball.isDragging = false;

		this.activeBallMap.set(availableIndex, ball);

		ball.setScale(this.ballConfig.initialSize);
		ball.setOrigin(0.5, 0.5);
		ball.setStatic(true);
		this.scene.input.setDraggable(ball.setInteractive());

		this.scene.tweens.add({
			targets: ball,
			y: targetPoint.y,
			scale: this.ballConfig.finalSize,
			duration: this.ballConfig.dropDuration,
			ease: 'Bounce.easeOut',
			onStart: () => {
				this.scene.sound.play('drop', { volume: 0.7 });
			},
			onComplete: () => {
				if (!ball.active) return;
				ball.setStatic(false);
				const initialSpeed = Phaser.Math.FloatBetween(2, 5);
				const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
				const velocityX = Math.cos(angle) * initialSpeed;
				const velocityY = Math.sin(angle) * initialSpeed;
				ball.setVelocity(velocityX, velocityY);
			}
		});
	}

	createAlphabetTextures() {
		if (this.alphabetTexturesCreated) return;

		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
		alphabet.forEach(letter => {
			const textureKey = `ball_${letter}`;
			const size = this.ballConfig.pixelSize * 2;
			const radius = size / 2;

			if (this.scene.textures.exists(textureKey)) {
				this.scene.textures.remove(textureKey);
			}

			const canvas = this.scene.textures.createCanvas(textureKey, size, size);
			if (!canvas) return;
			const ctx = canvas.getContext();

			const highlightX = radius * 0.7;
			const highlightY = radius * 0.7;
			const gradient = ctx.createRadialGradient(highlightX, highlightY, radius * 0.05, radius, radius, radius);
			const baseColor = Phaser.Display.Color.HexStringToColor('#CCCCCC');
			const lightColor = Phaser.Display.Color.ValueToColor('#FFFFFF');
			const darkColor = Phaser.Display.Color.ValueToColor('#999999');
			gradient.addColorStop(0, `rgba(${lightColor.r}, ${lightColor.g}, ${lightColor.b}, 1)`);
			gradient.addColorStop(0.8, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 1)`);
			gradient.addColorStop(1, `rgba(${darkColor.r}, ${darkColor.g}, ${darkColor.b}, 1)`);
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(radius, radius, radius, 0, Math.PI * 2);
			ctx.fill();

			ctx.font = `${radius * 1.2}px monospace`;
			ctx.fillStyle = '#000000';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(letter, radius, radius);

			canvas.refresh();
		});

		this.alphabetTexturesCreated = true;
	}

	resetBalls() {
		this.isGameOver = false;

		this.balls.getChildren().forEach(ball => {
			if (ball.lifespanTimer) ball.lifespanTimer.remove();
			this.scene.tweens.killTweensOf(ball);
		});
		this.balls.clear(true, true);
		this.activeBallMap.clear();

		let ball_delay = 0;
		for (let i = 0; i < this.ballConfig.maxBalls; i++) {
			const delay = Phaser.Math.Between(500, 1500);
			ball_delay += delay;
			this.scene.time.delayedCall(ball_delay, this.spawnBall, [], this);
		}
	}

	fadeAndDestroyBall(ball, shouldRespawn = false) {
		if (!ball || !ball.active) return;
		ball.setActive(false);

		if (ball.body) {
			ball.setCollisionCategory(0);
		}

		this.scene.tweens.add({
			targets: ball,
			alpha: 0,
			duration: this.ballConfig.fadeDuration,
			ease: 'Power2',
			onComplete: () => {
				if (ball.wordIndex !== undefined && this.activeBallMap.has(ball.wordIndex)) {
					this.activeBallMap.delete(ball.wordIndex);
				}
				this.balls.remove(ball, true, true);
				if (shouldRespawn && !this.isGameOver && this.currentWord) {
					this.scene.time.delayedCall(this.ballConfig.respawnDelay, this.spawnBall, [], this);
				}
			}
		});
	}
}