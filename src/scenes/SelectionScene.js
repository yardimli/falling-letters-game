export class SelectionScene extends Phaser.Scene {
    constructor () {
        super({ key: 'SelectionScene' });
        this.customCursor = null; // NEW: Track custom cursor
        this.baseUrl = ''; // Store path prefix
    }
    
    init () {
        this.settings = this.registry.get('gameSettings') || { lang: 'en', count: 3 };
        // MODIFIED: Retrieve baseUrl from settings
        this.baseUrl = this.settings.baseUrl || '';
        
        this.completedWords = this.registry.get('completedWords') || [];
        this.wordsToDisplay = [];
        this.poolWords = [];
    }
    
    preload () {
        // Load the JSON data first
        // MODIFIED: Use baseUrl for loading words.json via Phaser Loader
        this.load.json('wordData', this.baseUrl + 'assets/words.json');
        
        // Load particle texture for fireworks
        this.createParticleTexture();
    }
    
    create () {
        this.createBackground();
        
        // NEW: Initialize custom cursor
        this.createCustomCursor();
        
        // --- NEW: Word Pool Logic ---
        // 1. Get the master list of words for this session
        // Note: If sessionWords isn't set (direct scene load), we fallback to loading from cache in the block below,
        // but typically main.js sets this.
        let allSessionWords = this.registry.get('sessionWords');
        
        // Fallback if registry is empty (e.g. debugging)
        if (!allSessionWords) {
            const data = this.cache.json.get('wordData');
            let availableWords = data.words.filter(w => w.lang === this.settings.lang);
            if (availableWords.length === 0) availableWords = [...data.words];
            const shuffled = Phaser.Utils.Array.Shuffle(availableWords);
            allSessionWords = shuffled.slice(0, parseInt(this.settings.count, 10));
            this.registry.set('sessionWords', allSessionWords);
        }
        
        // 2. Manage Active Grid vs Pool
        // We check if we already have a state in registry.
        let activeGridWords = this.registry.get('activeGridWords');
        let poolWords = this.registry.get('poolWords');
        
        if (!activeGridWords) {
            // First time initialization
            // Take up to 15 words for the grid
            activeGridWords = allSessionWords.slice(0, 15);
            // The rest go into the waiting pool
            poolWords = allSessionWords.slice(15);
        } else {
            // Returning from GameScene
            // 1. Remove completed words from the active grid
            // We filter out any word object whose text is in the completedWords array
            const initialLength = activeGridWords.length;
            activeGridWords = activeGridWords.filter(w => !this.completedWords.includes(w.text));
            
            // 2. Refill from pool if slots opened up
            // We want to maintain up to 15 words if the pool has them
            while (activeGridWords.length < 15 && poolWords.length > 0) {
                const nextWord = poolWords.shift(); // Take from front of pool
                activeGridWords.push(nextWord);
            }
        }
        
        // 3. Save state back to registry
        this.registry.set('activeGridWords', activeGridWords);
        this.registry.set('poolWords', poolWords);
        
        // 4. Set local variable for rendering
        this.wordsToDisplay = activeGridWords;
        
        // --- End Pool Logic ---
        
        // Now load images for the selected words
        // We use a nested loader flow here
        let assetsToLoad = 0;
        
        this.wordsToDisplay.forEach((word) => {
            if (word.thumb && !this.textures.exists(word.text)) {
                // MODIFIED: Prepend baseUrl to the image path from JSON
                const imagePath = this.baseUrl + word.thumb;
                this.load.image(word.text, imagePath);
                assetsToLoad++;
            }
        });
        
        if (assetsToLoad > 0) {
            this.add.text(this.scale.width / 2, this.scale.height / 2, 'Loading...', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
            this.load.once('complete', () => {
                this.children.removeAll(); // Remove loading text
                this.createBackground(); // Re-add background
                this.createCustomCursor(); // Re-add cursor after clear
                this.buildGrid();
                this.createUI(); // NEW: Add UI elements
                this.checkWinCondition();
            });
            this.load.start();
        } else {
            this.buildGrid();
            this.createUI(); // NEW: Add UI elements
            this.checkWinCondition();
        }
        
        // Fade in effect
        this.cameras.main.fadeIn(500, 0, 0, 0);
    }
    
    // NEW: Create UI elements like the counter
    createUI () {
        const activeCount = this.wordsToDisplay.length;
        const poolCount = this.registry.get('poolWords').length;
        const totalLeft = activeCount + poolCount;
        
        this.add.text(20, 20, `Words Left: ${totalLeft}`, {
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
    }
    
    // NEW: Create and manage the custom cursor
    createCustomCursor () {
        this.input.setDefaultCursor('none');
        
        // Generate texture if it doesn't exist (same as InputManager)
        if (!this.textures.exists('customCursorTexture')) {
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
        }
        
        // Create the cursor sprite
        if (this.customCursor) this.customCursor.destroy(); // Cleanup if exists
        this.customCursor = this.add.image(0, 0, 'customCursorTexture');
        this.customCursor.setDepth(2000); // Ensure it's on top of everything
        this.customCursor.setVisible(false); // Hide until mouse moves
        
        // Update position
        this.input.on('pointermove', (pointer) => {
            this.customCursor.setVisible(true);
            this.customCursor.x = pointer.x;
            this.customCursor.y = pointer.y;
        });
    }
    
    createBackground () {
        const width = this.scale.width;
        const height = this.scale.height;
        this.bgGraphics = this.add.graphics();
        this.bgGraphics.fillGradientStyle(0x1a2a6c, 0xb21f1f, 0x000000, 0x000000, 1);
        this.bgGraphics.fillRect(0, 0, width, height);
        this.bgGraphics.setDepth(-100);
    }
    
    createParticleTexture () {
        if (this.textures.exists('firework')) return;
        const size = 8;
        const texture = this.textures.createCanvas('firework', size, size);
        const context = texture.getContext();
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, size, size);
        texture.refresh();
    }
    
    buildGrid () {
        const cols = 5;
        const cellWidth = 220;
        const cellHeight = 220;
        const spacing = 20;
        
        // Calculate total grid size to center it
        // We fix the width calculation based on max cols (5) to keep it centered consistently
        const gridWidth = (cols * cellWidth) + ((cols - 1) * spacing);
        const startX = (this.scale.width - gridWidth) / 2 + (cellWidth / 2);
        const startY = 200; // Top margin
        
        this.add.text(this.scale.width / 2, 80, 'Select a Word', {
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#00ffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        this.wordsToDisplay.forEach((wordObj, index) => {
            // Safety check: ensure we don't exceed 15 items visually (though logic prevents it)
            if (index >= 15) return;
            
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            const x = startX + (col * (cellWidth + spacing));
            const y = startY + (row * (cellHeight + spacing));
            
            this.createCard(x, y, wordObj);
        });
    }
    
    createCard (x, y, wordObj) {
        // MODIFIED: We no longer check if it is completed here for styling,
        // because completed words are removed from the list entirely.
        // However, we keep the container logic.
        
        const container = this.add.container(x, y);
        
        // Card Background
        const bg = this.add.rectangle(0, 0, 200, 200, 0x333333);
        bg.setStrokeStyle(2, 0x00ffff);
        
        // Image
        let image;
        if (this.textures.exists(wordObj.text)) {
            image = this.add.image(0, -20, wordObj.text);
            // Scale image to fit
            const scale = 140 / Math.max(image.width, image.height);
            image.setScale(scale);
        } else {
            image = this.add.text(0, -20, '?', { fontSize: '64px' }).setOrigin(0.5);
        }
        
        // Text Label
        const text = this.add.text(0, 70, wordObj.text, {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        container.add([bg, image, text]);
        
        // Interactive
        // MODIFIED: Removed useHandCursor: true to prevent system cursor from appearing
        bg.setInteractive();
        
        bg.on('pointerover', () => {
            bg.setFillStyle(0x444444);
            this.tweens.add({ targets: container, scale: 1.05, duration: 100 });
        });
        
        bg.on('pointerout', () => {
            bg.setFillStyle(0x333333);
            this.tweens.add({ targets: container, scale: 1, duration: 100 });
        });
        
        bg.on('pointerdown', () => {
            this.selectWord(wordObj);
        });
    }
    
    selectWord (wordObj) {
        // Transition to GameScene
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.start('GameScene', { wordObj: wordObj });
        });
    }
    
    checkWinCondition () {
        // MODIFIED: Win condition is now when both active grid and pool are empty
        const activeCount = this.wordsToDisplay.length;
        const poolCount = this.registry.get('poolWords').length;
        
        if (activeCount === 0 && poolCount === 0) {
            this.triggerGameOver();
        }
    }
    
    triggerGameOver () {
        // Blinking Game Over Text
        const gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
            fontSize: '120px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(1000);
        
        this.tweens.add({
            targets: gameOverText,
            alpha: 0,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // Color cycling for text
        this.time.addEvent({
            delay: 200,
            loop: true,
            callback: () => {
                const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
                gameOverText.setColor(Phaser.Utils.Array.GetRandom(colors));
            }
        });
        
        // Fireworks
        const particles = this.add.particles(0, 0, 'firework', {
            speed: { min: 100, max: 300 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            gravityY: 200,
            lifespan: 1000,
            emitting: false
        });
        
        this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                const x = Phaser.Math.Between(100, this.scale.width - 100);
                const y = Phaser.Math.Between(100, this.scale.height - 100);
                const color = Phaser.Utils.Array.GetRandom([0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff]);
                
                particles.setParticleTint(color);
                particles.emitParticleAt(x, y, 50);
                
                // Play sound if available (reusing bounce for now as placeholder)
                if (this.sound.get('bounce1')) {
                    this.sound.play('bounce1', { rate: 2.0, volume: 0.3 });
                }
            }
        });
    }
}
