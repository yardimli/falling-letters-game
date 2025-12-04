<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Spelling Game</title>
	<style>
		body {
			margin: 0;
			padding: 0;
			overflow: hidden;
			background-color: #2d2d2d;
			font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		}

		/* Game Canvas Styles */
		canvas {
			display: block;
			cursor: none; /* Hide default cursor when game is running */
		}

		/* Intro Screen Overlay */
		#intro-screen {
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: linear-gradient(135deg, #1a2a6c, #b21f1f);
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			z-index: 1000;
			color: white;
		}

		.menu-container {
			background: rgba(0, 0, 0, 0.6);
			padding: 40px;
			border-radius: 15px;
			box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
			text-align: center;
			width: 300px;
			border: 1px solid #444;
		}

		h1 {
			margin-top: 0;
			color: #00ffff;
			text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
		}

		.form-group {
			margin-bottom: 20px;
			text-align: left;
		}

		label {
			display: block;
			margin-bottom: 5px;
			font-weight: bold;
			color: #ddd;
		}

		select {
			width: 100%;
			padding: 10px;
			border-radius: 5px;
			border: 1px solid #555;
			background: #333;
			color: white;
			font-size: 16px;
		}

		button {
			width: 100%;
			padding: 12px;
			border: none;
			border-radius: 5px;
			font-size: 18px;
			font-weight: bold;
			cursor: pointer;
			transition: transform 0.2s, background 0.2s;
			margin-top: 10px;
		}

		.btn-play {
			background: #00cc44;
			color: white;
		}

		.btn-play:hover {
			background: #00aa38;
			transform: scale(1.05);
		}

		.btn-admin {
			background: #444;
			color: #ccc;
			margin-top: 20px;
			font-size: 14px;
		}

		.btn-admin:hover {
			background: #555;
			color: white;
		}

		/* Utility to hide elements */
		.hidden {
			display: none !important;
		}
	</style>
	<!-- Load Phaser -->
	<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.0/dist/phaser.min.js"></script>
</head>
<body>

<!-- Intro UI -->
<div id="intro-screen">
	<div class="menu-container">
		<h1>Spelling Game</h1>

		<div class="form-group">
			<label for="langSelect">Language:</label>
			<select id="langSelect">
				<option value="en">English</option>
				<option value="zh">Chinese</option>
				<option value="tr">Turkish</option>
			</select>
		</div>

		<div class="form-group">
			<label for="countSelect">Number of Words:</label>
			<select id="countSelect">
				<option value="3">3 Words</option>
				<option value="5">5 Words</option>
				<option value="10">10 Words</option>
				<option value="20">20 Words</option>
				<option value="50">50 Words</option>
			</select>
		</div>

		<button id="btnPlay" class="btn-play">Play Game</button>

		<button id="btnAdmin" class="btn-admin">Admin Panel</button>
	</div>
</div>

<!-- Game Entry Point -->
<script type="module">
	import { launchGame } from './src/main.js';

	const introScreen = document.getElementById('intro-screen');
	const btnPlay = document.getElementById('btnPlay');
	const btnAdmin = document.getElementById('btnAdmin');
	const langSelect = document.getElementById('langSelect');
	const countSelect = document.getElementById('countSelect');

	// Admin Button Logic
	btnAdmin.addEventListener('click', () => {
		window.location.href = 'admin.php';
	});

	// Play Button Logic
	// MODIFIED: Added async keyword to handle data fetching in launchGame
	btnPlay.addEventListener('click', async () => {
		const selectedLang = langSelect.value;
		const selectedCount = countSelect.value;

		// Hide UI
		introScreen.classList.add('hidden');

		// Change body cursor to none for the game
		document.body.style.cursor = 'none';

		// Launch Phaser Game with settings
		await launchGame({
			lang: selectedLang,
			count: selectedCount
		});
	});
</script>
</body>
</html>
