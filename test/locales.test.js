const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const nodes = path.join(__dirname, '..', 'huemagic');
const locales = path.join(nodes, 'locales');
const languages = fs.readdirSync(locales);

//
// COLLECT EVERY KEY THE RUNTIME ASKS FOR
function usedKeys()
{
	let keys = new Set();

	for(const file of fs.readdirSync(nodes).filter(function(f) { return f.endsWith('.js'); }))
	{
		const source = fs.readFileSync(path.join(nodes, file), 'utf8');

		// RED._("…") AND status({ … text: "hue-*.…" })
		for(const match of source.matchAll(/RED\._\(\s*"(hue-[a-z-]+\.[a-z-]+\.[a-z0-9-]+)"/g)) { keys.add(match[1]); }
		for(const match of source.matchAll(/text:\s*"(hue-[a-z-]+\.[a-z-]+\.[a-z0-9-]+)"/g)) { keys.add(match[1]); }
	}

	return keys;
}

//
// READ A DOTTED KEY OUT OF A LOCALE FILE
function lookup(language, key)
{
	const [node, ...rest] = key.split('.');
	const file = path.join(locales, language, node + '.json');

	if(!fs.existsSync(file)) { return undefined; }

	let value = JSON.parse(fs.readFileSync(file, 'utf8'))[node];
	for(const part of rest)
	{
		if(!value || typeof value !== 'object') { return undefined; }
		value = value[part];
	}

	return value;
}

function flatten(object, prefix = "")
{
	return Object.entries(object).reduce(function(all, [key, value])
	{
		return all.concat(typeof value === 'object' ? flatten(value, prefix + key + ".") : [prefix + key]);
	}, []);
}

test('locales: every language ships the same keys', function()
{
	let files = new Set();
	for(const language of languages)
	{
		fs.readdirSync(path.join(locales, language)).filter(function(f) { return f.endsWith('.json'); }).forEach(function(f) { files.add(f); });
	}

	let missing = [];

	for(const file of files)
	{
		let perLanguage = {};
		let union = new Set();

		for(const language of languages)
		{
			const target = path.join(locales, language, file);
			perLanguage[language] = fs.existsSync(target) ? flatten(JSON.parse(fs.readFileSync(target, 'utf8'))) : [];
			perLanguage[language].forEach(function(key) { union.add(key); });
		}

		for(const language of languages)
		{
			for(const key of union)
			{
				if(!perLanguage[language].includes(key)) { missing.push(language + "/" + file + " → " + key); }
			}
		}
	}

	assert.deepStrictEqual(missing, [], "keys that only exist in some languages");
});

test('locales: every key used by a node exists in every language', function()
{
	let missing = [];

	for(const key of usedKeys())
	{
		for(const language of languages)
		{
			if(typeof lookup(language, key) !== 'string') { missing.push(language + " → " + key); }
		}
	}

	assert.deepStrictEqual(missing, [], "untranslated keys");
});

test('locales: no user facing english is left hardcoded in the nodes', function()
{
	let hardcoded = [];

	for(const file of fs.readdirSync(nodes).filter(function(f) { return f.endsWith('.js'); }))
	{
		const source = fs.readFileSync(path.join(nodes, file), 'utf8');

		for(const match of source.matchAll(/scope\.error\(\s*"([^"]+)"/g)) { hardcoded.push(file + ": " + match[1]); }
		for(const match of source.matchAll(/scope\.log\(\s*"([^"]+)"/g)) { hardcoded.push(file + ": " + match[1]); }
	}

	assert.deepStrictEqual(hardcoded, [], "these strings have to go through RED._()");
});

test('locales: the shipped help never loads anything from the internet', function()
{
	let external = [];

	for(const language of languages)
	{
		for(const file of fs.readdirSync(path.join(locales, language)).filter(function(f) { return f.endsWith('.html'); }))
		{
			const source = fs.readFileSync(path.join(locales, language, file), 'utf8');

			for(const match of source.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g))
			{
				external.push(language + "/" + file + " → " + match[1]);
			}
		}
	}

	assert.deepStrictEqual(external, [], "help images have to be served from huemagic/assets");
});

test('locales: every referenced asset exists on disk', function()
{
	const assets = path.join(nodes, 'assets');
	let missing = [];

	for(const language of languages)
	{
		for(const file of fs.readdirSync(path.join(locales, language)).filter(function(f) { return f.endsWith('.html'); }))
		{
			const source = fs.readFileSync(path.join(locales, language, file), 'utf8');

			for(const match of source.matchAll(/\(hue\/assets\/([^)]+)\)/g))
			{
				if(!fs.existsSync(path.join(assets, match[1]))) { missing.push(language + "/" + file + " → " + match[1]); }
			}
		}
	}

	assert.deepStrictEqual(missing, [], "assets referenced by the help but not shipped");
});

test('locales: both languages document the same sections per node', function()
{
	const sections = function(source)
	{
		// COMPARE THE SHAPE OF THE DOCUMENT, NOT THE TRANSLATED HEADINGS
		return source.split('\n')
			.filter(function(l) { return l.trim().startsWith('###'); })
			.map(function(l) { return l.trim().replace(/[^#]/g, '').length; });
	};

	const reference = languages[0];
	let mismatched = [];

	for(const file of fs.readdirSync(path.join(locales, reference)).filter(function(f) { return f.endsWith('.html'); }))
	{
		const expected = sections(fs.readFileSync(path.join(locales, reference, file), 'utf8'));

		for(const language of languages.slice(1))
		{
			const target = path.join(locales, language, file);
			if(!fs.existsSync(target)) { mismatched.push(language + " is missing " + file); continue; }

			const actual = sections(fs.readFileSync(target, 'utf8'));
			if(actual.length !== expected.length)
			{
				mismatched.push(file + ": " + reference + " has " + expected.length + " sections, " + language + " has " + actual.length);
			}
		}
	}

	assert.deepStrictEqual(mismatched, [], "help documents that drifted apart between languages");
});

test('docs: every image the README embeds is committed to the repository', function()
{
	const root = path.join(__dirname, '..');
	const prefix = "https://raw.githubusercontent.com/Foddy/node-red-contrib-huemagic/master/";
	let problems = [];

	for(const doc of ['README.md', 'CHANGELOG.md'])
	{
		const source = fs.readFileSync(path.join(root, doc), 'utf8');

		for(const match of source.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)|<img[^>]+src="(https?:\/\/[^"]+)"/g))
		{
			const url = match[1] || match[2];

			// BADGES ARE GENERATED ON THE FLY AND HAVE TO STAY EXTERNAL
			if(url.startsWith('https://img.shields.io/')) { continue; }

			if(!url.startsWith(prefix)) { problems.push(doc + " hotlinks " + url); continue; }
			if(!fs.existsSync(path.join(root, url.slice(prefix.length)))) { problems.push(doc + " points at a missing file: " + url); }
		}
	}

	assert.deepStrictEqual(problems, [], "README images must live in this repository");
});
