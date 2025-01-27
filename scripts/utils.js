const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const sleep = require('./sleep.js');

const blockedResources = new Set(['image', 'icon', 'imageset', 'font', 'media', 'blob', 'websocket', 'application', 'texttrack', 'manifest', 'fetch', 'other', 'font']);
const blockedDomains = new Set(['server.cpmstar.com', 'pagead2.googlesyndication.com', 'doubleclick.net', 'www.youtube.com', 'facebook.com', 'connect.facebook.net', 'twitter.com', 'platform.twitter.com', 'instagram.com', 'cdn.jsdelivr.net', 'adservice.google.com', 'ads.yahoo.com', 'ads.twitter.com', 'ytimg.com', 'google-analytics.com', 'googletagmanager.com', 'googletagservices.com', 'fonts.googleapis.com']);

const createProfileDir = () => {
	const profilePath = path.join(__dirname, '..', 'chrome', 'profiles', Date.now().toString());
	if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });
	return { path: profilePath };
};

const randomShit = length => crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);

const getRandomNickname = USERNAMES_ARRAY =>
	USERNAMES_ARRAY.length ? USERNAMES_ARRAY[Math.floor(Math.random() * USERNAMES_ARRAY.length)] : randomShit(32);

const pressRandomKeysForMovement = async page => {
	const randomMovementDuration = Math.floor(Math.random() * 4000) + 1000;
	const keysPressed = new Set();

	const moveInRandomDirection = async () => {
		const randomKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][Math.floor(Math.random() * 4)];
		if (!keysPressed.has(randomKey)) {
			keysPressed.add(randomKey);
			await page.keyboard.down(randomKey);
		}
	};

	const stopAllMovements = async () => {
		for (const key of keysPressed) {
			await page.keyboard.up(key);
		}
		keysPressed.clear();
	};

	const pressRandomSpace = async () => {
		const randomPressDuration = Math.random() * 600 + 300;
		await page.keyboard.down('Space');
		await sleep(randomPressDuration);
		await page.keyboard.up('Space');
	};

	const movementInterval = setInterval(moveInRandomDirection, 400);
	const spacePressInterval = setInterval(pressRandomSpace, Math.random() * 4000 + 1000);

	await sleep(randomMovementDuration);
	clearInterval(movementInterval);
	clearInterval(spacePressInterval);
	await stopAllMovements();
};

const simulateMovement = async (gameView, page) => {
	try {
		const movementIntervalId = setInterval(() => pressRandomKeysForMovement(page), 500);
		await gameView.focus();
		await sleep(4000);
		clearInterval(movementIntervalId);
	} catch (err) {
		console.error(`Error while moving character: ${err.message}`);
	}
};

const openTargetRoom = async (page, targetRoom) => {
	try {
		await page.setRequestInterception(true);

		page.on('request', req => {
			if (blockedResources.has(req.resourceType()) || blockedDomains.has(new URL(req.url()).hostname)) {
				if (process.env.DEBUG === 'true') console.debug(`BL ${req.resourceType()}: ${req.url()}`);
				return req.abort();
			}

			if (process.env.DEBUG === 'true') console.debug(`DN ${req.resourceType()}: ${req.url()}`);
			req.continue();
		});

		await page.goto(targetRoom, { waitUntil: 'networkidle0' });
		console.log(`Navigated to ${targetRoom}`);
	} catch (err) {
		console.error(`Error while loading the page: ${err.message}`);
	}
};

const waitForSelector = async (frame, selector, options = {}, retries = 3, delay = 4000) => {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			return await frame.waitForSelector(selector, options);
		} catch (err) {
			if (err.message.includes('frame got detached')) {
				console.warn(`Attempt ${attempt} failed: frame got detached. Retrying in ${delay}ms...`);
				if (attempt === retries) throw new Error('Max retries reached. Could not find selector.');
				await sleep(delay);
			} else {
				console.error(err);
				return null;
			}
		}
	}
};

const setNickname = async (frame, randomNick) => {
	const nicknameInput = await frame.$('input[data-hook="input"]');
	if (!nicknameInput) return console.warn('Nickname input not found.');

	await nicknameInput.evaluate(input => input.value = '');
	await nicknameInput.type(randomNick);

	const okButton = await frame.$('button[data-hook="ok"]');
	if (okButton) {
		await okButton.click();
		console.log(`New nickname '${randomNick}' submitted`);
	}
};

const sendMessages = async (chatInput, MESSAGES_ARRAY, kill) => {
	const messageIntervalId = setInterval(async () => {
		try {
			await chatInput.focus();
			await chatInput.evaluate(input => input.value = '');

			const msg = MESSAGES_ARRAY[Math.floor(Math.random() * MESSAGES_ARRAY.length)];
			await chatInput.type(msg);
			await chatInput.press('Enter');
			// console.debug(`Random message: ${msg}`);
		} catch (err) {
			clearInterval(messageIntervalId);
			console.warn(`Error while sending messages: ${err.message}`);
			if (kill) process.exit(666);
		}
	}, 3000);

	await sleep(9000);
	clearInterval(messageIntervalId);
};

const handleRoom = async (frame, randomNick, MESSAGES_ARRAY, page, kill) => {
	await setNickname(frame, randomNick);
	const chatInput = await waitForSelector(frame, 'input[data-hook="input"]', { visible: true, timeout: 360000 });
	if (!chatInput) return;

	console.log(`Joined as ${randomNick}`);
	const gameView = await frame.$('.game-view');
	if (gameView) {
		const executeLoop = async () => {
			await sendMessages(chatInput, MESSAGES_ARRAY, kill);
			await simulateMovement(gameView, page);
			executeLoop();
		};
		executeLoop();
	} else {
		console.warn('Game view not found.');
	}
};

const setupRoom = async (page, randomNick, messagesArray, kill = false) => {
	const frame = page.frames().find(f => f.url().includes('game.html'));
	if (frame) {
		await handleRoom(frame, randomNick, messagesArray, page, kill);
	} else {
		console.warn('Iframe not found.');
	}
};

module.exports = {
	createProfileDir,
	getRandomNickname,
	pressRandomKeysForMovement,
	waitForSelector,
	openTargetRoom,
	handleRoom,
	setupRoom,
};