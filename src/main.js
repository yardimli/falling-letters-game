import { SelectionScene } from './scenes/SelectionScene.js';
import { GameScene } from './scenes/GameScene.js';

// MODIFIED: Made async to fetch word data before starting
export async function launchGame (settings) {
    // --- 1. Pre-calculate Session Data ---
    let sessionWords = [];
    let totalSessionLetters = 0;
    
    try {
        const response = await fetch('assets/words.json');
        const data = await response.json();
        
        // Filter by selected language
        let pool = data.words.filter(w => w.lang === settings.lang);
        
        // Shuffle the pool
        pool.sort(() => 0.5 - Math.random());
        
        // Select the requested number of words
        const count = parseInt(settings.count, 10);
        sessionWords = pool.slice(0, count);
        
        // Calculate total letters for the entire session (for the Progress Bar)
        totalSessionLetters = sessionWords.reduce((sum, wordObj) => sum + wordObj.text.length, 0);
        
        console.log(`Session Started: ${sessionWords.length} words, ${totalSessionLetters} total letters.`);
    } catch (error) {
        console.error('Failed to initialize session data:', error);
    }
    
    // --- 2. Game Config ---
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
    
    // --- 3. Store Data in Registry ---
    game.registry.set('gameSettings', settings);
    
    // Store the pre-calculated session data
    game.registry.set('sessionWords', sessionWords);
    game.registry.set('sessionTotalLetters', totalSessionLetters);
    
    // Initialize Progress & Accuracy Stats
    game.registry.set('sessionCorrect', 0); // Total correct letters placed (Progress)
    game.registry.set('sessionWrong', 0); // Total wrong drops (Accuracy)
    
    game.registry.set('completedWords', []);
    
    return game;
}
