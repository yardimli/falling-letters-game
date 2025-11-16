/**
 * @file Centralized configuration for the entire Phaser game.
 * This file contains setup variables for game mechanics, UI, and scene-specific behaviors.
 */

// --- Centralized Game Configuration ---
const GAME_CONFIG = {
	// Shared values used across multiple scenes
	Shared: {
		PIXEL_SCALE: 2,
		SELECTOR_SCREEN_WIDTH: 100,
		RIGHT_SCORE_SCREEN_WIDTH: 80, // New: Width for the new right-side accuracy bar.
		NUMBER_OF_SIDES: 3,

		// MODIFIED: Added a new color to support up to 8 goals.
		BALL_COLORS: [
			'#FF0000', // Red
			'#FFA500', // Orange
			'#FFFF00', // Yellow
			'#00FF00', // Green
			'#0000FF', // Blue
			'#4B0082', // Indigo
			'#EE82EE', // Violet
			'#800080' // Purple
		]
	},

	// Configuration for BallScene
	BallScene: {
		defaultMaxBalls: 3,
		lifespan: 120000,
		fadeDuration: 1500,
		respawnDelay: 1000,
		initialSize: 0.1,
		finalSize: 0.8,
		dropDuration: 700,
		pixelSize: 35,
		frictionAir: 0.05,
		restitution: 0.8,
		organicMoveThreshold: 0.6,
		organicMoveForce: 0.00005
	},

	// Configuration for BoardSetupScene
	BoardSetupScene: {
		SELECTOR_PIXEL_WIDTH: 40,
		SLOT_PIXEL_HEIGHT: 30,
		// REMOVED: NUM_ICONS is no longer needed as polygons are removed.
		// MODIFIED: Increased the number of rectangle icons to 7 to allow for 2-8 goals.
		NUM_RECT_ICONS: 7 // For rectangles (2, 3, 4, 5, 6, 7, 8 goals)
	},

	// Configuration for BoardViewScene
	BoardViewScene: {
		backgroundColor: '#111111',
		debugDraw: false,
		glitchConfig: {
			stretch: { minSize: 0.4, maxSize: 1.0, minDuration: 50, maxDuration: 500, minDelay: 400, maxDelay: 2500 },
			border: {
				// Glitch length is now defined by number of line segments ---
				minSegmentLength: 1,
				maxSegmentLength: 5,
				minDuration: 300,
				maxDuration: 1500,
				minDelay: 100,
				maxDelay: 500,
				color: '#555555'
			}
		},
		goalConfig: {
			width: 50,
			depth: 40,
			chamfer: 18,
			dashLength: 2,
			gapLength: 6,
			goalGap: 40
		}
	},

	// Configuration for the new Top and Bottom score scenes.
	ScoreScenes: {
		TOP_SCORE_SCREEN_HEIGHT: 90,
		TOTAL_MAX_SCORE: 100
		// REMOVED: Individual max score is no longer used.
	}
};