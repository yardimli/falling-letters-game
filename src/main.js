import { SelectionScene } from './scenes/SelectionScene.js';
import { GameScene } from './scenes/GameScene.js';

// MODIFIED: Export a function to start the game with specific settings
export function launchGame(settings) {
    const config = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: '#2d2d2d',
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 0 },
                debug: false
            }
        },
        // MODIFIED: SelectionScene is now the first scene
        scene: [SelectionScene, GameScene]
    };

    const game = new Phaser.Game(config);

    // Store the settings in the registry so Scenes can access them
    game.registry.set('gameSettings', settings);
    // Initialize progress tracking
    game.registry.set('completedWords', []);

    return game;
}