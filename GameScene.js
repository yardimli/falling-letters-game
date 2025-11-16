/**
 * @file The main and only Phaser Scene for the game.
 * This scene orchestrates all the different parts of the game (board, balls, UI)
 * which are encapsulated in their own manager classes.
 */
class GameScene extends Phaser.Scene {
	constructor() {
		super({ key: 'GameScene' });

		this.boardSetup = null;
		this.boardView = null;
		this.ballManager = null;
		this.topScore = null;
		this.rightScore = null;
		this.gameOverManager = null;
		this.customCursor = null;
	}

	preload() {
		console.log('GameScene: preload()');
		this.load.json('words', 'words.json');

		this.load.audio('drop', 'assets/audio/DSGNBass_Smooth Sub Drop Bass Downer.wav');
		this.load.audio('bounce1', 'assets/audio/basketball_bounce_single_3.wav');
		this.load.audio('bounce2', 'assets/audio/basketball_bounce_single_5.wav');
		this.load.audio('bounce3', 'assets/audio/Vintage Bounce.wav');
		this.load.audio('click', 'assets/audio/basketball_bounce_single_5.wav');
		this.load.audio('click_drop', 'assets/audio/basketball_bounce_single_3.wav');
		this.load.audio('drop_valid', 'assets/audio/Drop Game Potion.wav');
		this.load.audio('drop_invalid', 'assets/audio/Hit Item Dropped 2.wav');
		this.load.plugin('rexcrtpipelineplugin', 'rexcrtpipelineplugin.min.js', true);
	}

	create() {
		console.log('GameScene: create()');

		this.cameras.main.setPostPipeline(['Glitch']);
		this.cameras.main.setBackgroundColor(GAME_CONFIG.BoardViewScene.backgroundColor);

		var postFxPlugin = this.plugins.get('rexcrtpipelineplugin');
		postFxPlugin.add(this.cameras.main, {
			warpX: 0.15,
			warpY: 0.15,
			scanLineStrength: 0.1,
			scanLineWidth: 1024
		});

		const cursorSize = 32;
		const cursorGraphics = this.make.graphics();
		cursorGraphics.lineStyle(2, 0xFFFFFF, 1);
		cursorGraphics.moveTo(cursorSize / 2, 0);
		cursorGraphics.lineTo(cursorSize / 2, cursorSize);
		cursorGraphics.moveTo(0, cursorSize / 2);
		cursorGraphics.lineTo(cursorSize, cursorSize / 2);
		cursorGraphics.strokePath();
		cursorGraphics.generateTexture('customCursorTexture', cursorSize, cursorSize);
		cursorGraphics.destroy();
		this.customCursor = this.add.image(0, 0, 'customCursorTexture');
		this.customCursor.setDepth(1000);

		// MODIFIED: Pass the loaded word data to the managers that need it.
		const wordData = this.cache.json.get('words');
		this.boardView = new BoardView(this);
		this.topScore = new TopScore(this, wordData);
		this.rightScore = new RightScore(this);
		this.ballManager = new BallManager(this, this.boardView, wordData);
		this.boardSetup = new BoardSetup(this);
		this.gameOverManager = new GameOver(this);

		// REMOVED: The max score text and hint text are no longer needed.

		this.boardView.init();
		this.topScore.init();
		this.rightScore.init();
		this.ballManager.init();
		this.boardSetup.init();
		this.gameOverManager.init();

		this.handleResize(this.scale.gameSize);
		this.boardSetup.emitBoardConfiguration();

		// REMOVED: Keyboard listeners for changing max score are no longer needed.
	}

	// REMOVED: The changeMaxScore method is no longer needed.

	update(time, delta) {
		if (this.customCursor) {
			this.customCursor.setPosition(this.input.activePointer.x, this.input.activePointer.y);
		}

		this.boardView.update(time, delta);
		this.ballManager.update(time, delta);
	}

	handleResize(gameSize) {
		this.boardView.handleResize(gameSize);
		this.boardSetup.handleResize(gameSize);
		this.topScore.handleResize(gameSize);
		this.rightScore.handleResize(gameSize);
		// REMOVED: Repositioning for max score and hint text is no longer needed.
	}
}