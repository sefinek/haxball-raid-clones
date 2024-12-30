const fs = require('node:fs/promises');

module.exports = async path => {
	try {
		await fs.access(path);
	} catch {
		const defaultContent = '# Paste the SOCKS5 proxy here.\n# Example: http://LOGIN:PASSWORD@HOSTNAME:PORT\n';
		await fs.writeFile(path, defaultContent, 'utf8');
		console.log(`Created ${path}. Please add your proxy.`);
		process.exit(2);
	}

	const proxyData = await fs.readFile(path, 'utf8');
	return proxyData.split('\n').filter(Boolean);
};