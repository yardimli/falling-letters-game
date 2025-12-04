<?php

	return [
		// Admin Password
		'admin_password' => 'Secret',

		// Fal.ai API Key
		'fal_api_key' => '...',

		'gemini_api_key' => '...',

		// Define where files are stored on disk and how they are accessed via URL.
		'paths' => [
			'upload_dir' => __DIR__ . '../drag-letters-keyboard/assets/uploads/',
			'audio_dir' => __DIR__ . '../drag-letters-keyboard/assets/audio/',
			'words_json_dir' => __DIR__ . '../drag-letters-keyboard/assets/',

			'source_url_extension' => '../drag-letters-keyboard/',

			'words_url' => 'assets/',
			'upload_url' => 'assets/uploads/',
			'audio_url' => 'assets/audio/',
		],

	];
