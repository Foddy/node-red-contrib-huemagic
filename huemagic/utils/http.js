const http = require('http');
const https = require('https');
const tls = require('tls');
const net = require('net');

// NOTHING WE TALK TO ANSWERS WITH MORE THAN THIS, AND A RUNAWAY RESPONSE MUST NOT EAT THE HEAP
const MAX_BYTES = 16 * 1024 * 1024;

//
// THE PROXY THE ENVIRONMENT WANTS FOR A TARGET, IF IT WANTS ONE AT ALL
function proxyFor(target)
{
	const environment = process.env;
	const noProxy = (environment.NO_PROXY || environment.no_proxy || "").trim();
	const port = target.port ? target.port : (target.protocol === "https:" ? "443" : "80");

	if(noProxy === "*") { return false; }

	for(let rule of noProxy.split(","))
	{
		rule = rule.trim().toLowerCase();
		if(rule.length === 0) { continue; }

		// A RULE MAY NAME A PORT AND MAY START WITH A DOT
		const [ruleHost, rulePort] = rule.split(":");
		if(rulePort && rulePort !== port) { continue; }

		const host = target.hostname.toLowerCase();
		const bare = ruleHost.startsWith(".") ? ruleHost.slice(1) : ruleHost;

		if(host === bare || host.endsWith("." + bare)) { return false; }
	}

	const proxy = (target.protocol === "https:")
		? (environment.HTTPS_PROXY || environment.https_proxy || environment.ALL_PROXY || environment.all_proxy)
		: (environment.HTTP_PROXY || environment.http_proxy || environment.ALL_PROXY || environment.all_proxy);

	return proxy ? proxy : false;
}

//
// PROXIES WANT THEIR CREDENTIALS IN A HEADER, NOT IN THE URL
function proxyAuthorization(proxy)
{
	if(!proxy.username) { return false; }

	const user = decodeURIComponent(proxy.username) + ":" + decodeURIComponent(proxy.password);
	return "Basic " + Buffer.from(user).toString('base64');
}

//
// HTTPS THROUGH A PROXY IS A CONNECT TUNNEL WITH TLS SPOKEN INSIDE IT
function tunnel(proxy, host, port, timeout)
{
	return new Promise(function(resolve, reject)
	{
		const authorization = proxyAuthorization(proxy);
		const request = http.request({
			host: proxy.hostname,
			port: proxy.port ? parseInt(proxy.port) : 80,
			method: "CONNECT",
			path: host + ":" + port,
			// THE TUNNEL IS OURS, IT MUST NOT END UP IN THE POOL OF THE GLOBAL AGENT
			agent: false,
			headers: authorization ? { "Host": host + ":" + port, "Proxy-Authorization": authorization } : { "Host": host + ":" + port }
		});

		request.on('connect', function(response, socket)
		{
			if(response.statusCode !== 200)
			{
				socket.destroy();
				const error = new Error("The proxy refused the tunnel (HTTP " + response.statusCode + ").");
				error.code = "EPROXY";
				return reject(error);
			}

			resolve(socket);
		});

		request.setTimeout(timeout, function()
		{
			const error = new Error("The proxy did not answer in time.");
			error.code = "ETIMEDOUT";
			request.destroy(error);
		});

		request.on('error', function(error) { reject(error); });
		request.end();
	});
}

//
// SEND ONE REQUEST AND COLLECT WHAT COMES BACK
async function send({ url, method = 'GET', headers = {}, data = null, timeout = 15000, agent = null, proxy = true, redirects = 3, maxBytes = MAX_BYTES })
{
	const target = new URL(url);
	const secure = (target.protocol === "https:");
	const port = target.port ? parseInt(target.port) : (secure ? 443 : 80);

	// WHAT GOES OUT: AN OBJECT BECOMES JSON, EVERYTHING ELSE TRAVELS AS IT IS
	let body = null;
	let requestHeaders = Object.assign({}, headers);

	if(data !== null && typeof data !== 'undefined')
	{
		body = (Buffer.isBuffer(data) || typeof data === 'string') ? data : JSON.stringify(data);

		if(!Object.keys(requestHeaders).some(function(one) { return one.toLowerCase() === "content-type"; }))
		{
			requestHeaders["Content-Type"] = "application/json; charset=utf-8";
		}

		requestHeaders["Content-Length"] = Buffer.byteLength(body);
	}

	let options = {
		host: target.hostname,
		port: port,
		path: target.pathname + target.search,
		method: method,
		headers: requestHeaders,
		agent: agent
	};

	// THE LOCAL NETWORK IS NEVER BEHIND A PROXY, THE INTERNET MAY BE
	const wanted = (proxy === false) ? false : proxyFor(target);
	let tunnelSocket = false;

	if(wanted)
	{
		const address = new URL(wanted);

		if(secure)
		{
			tunnelSocket = await tunnel(address, target.hostname, port, timeout);
			const rejectUnauthorized = !(agent && agent.options && agent.options.rejectUnauthorized === false);

			// createConnection IS ONLY LOOKED AT WHEN NO AGENT IS IN THE WAY, NOT EVEN "false"
			delete options.agent;
			options.createConnection = function()
			{
				// SNI TAKES NO IP ADDRESS, NODE 26 EVEN THROWS ON ONE
				return tls.connect({ socket: tunnelSocket, servername: net.isIP(target.hostname) ? undefined : target.hostname, rejectUnauthorized: rejectUnauthorized });
			};
		}
		else
		{
			// PLAIN HTTP GOES TO THE PROXY WITH THE WHOLE URL IN THE REQUEST LINE
			const authorization = proxyAuthorization(address);

			options.host = address.hostname;
			options.port = address.port ? parseInt(address.port) : 80;
			options.path = url;
			options.headers["Host"] = target.host;

			if(authorization) { options.headers["Proxy-Authorization"] = authorization; }
		}
	}

	return new Promise(function(resolve, reject)
	{
		// A TUNNEL BELONGS TO NO AGENT, SO NOBODY BUT US EVER CLOSES IT OR THE TLS SOCKET ON TOP
		let started = null;
		const done = function(finish, value)
		{
			if(tunnelSocket)
			{
				if(started && started.socket) { started.socket.destroy(); }
				tunnelSocket.destroy();
				tunnelSocket = false;
			}

			finish(value);
		};

		const request = (secure ? https : http).request(options, function(response)
		{
			// FOLLOW A REDIRECT, BUT NOT IN CIRCLES
			if(response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects > 0)
			{
				response.resume();

				const next = new URL(response.headers.location, url).toString();
				const keepMethod = (response.statusCode === 307 || response.statusCode === 308);

				return done(resolve, send({
					url: next,
					method: keepMethod ? method : "GET",
					headers: headers,
					data: keepMethod ? data : null,
					timeout: timeout,
					agent: agent,
					proxy: proxy,
					redirects: redirects - 1,
					maxBytes: maxBytes
				}));
			}

			let chunks = [];
			let size = 0;

			response.on('data', function(chunk)
			{
				size += chunk.length;

				if(size > maxBytes)
				{
					request.destroy();
					const error = new Error("The answer is larger than " + Math.round(maxBytes/1024/1024) + " MB.");
					error.code = "EMSGSIZE";
					return done(reject, error);
				}

				chunks.push(chunk);
			});

			response.on('end', function()
			{
				done(resolve, { status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) });
			});

			response.on('error', function(error) { done(reject, error); });
		});

		request.setTimeout(timeout, function()
		{
			const error = new Error("The request did not get an answer in time.");
			error.code = "ETIMEDOUT";
			request.destroy(error);
		});

		request.on('error', function(error) { done(reject, error); });

		started = request;
		request.end(body);
	});
}

//
// A JSON REQUEST / THE ANSWER IS PARSED WHEN IT CAN BE
async function request(options)
{
	const response = await send(options);
	const text = response.body.toString('utf8');

	let parsed = text;
	if(text.length > 0) { try { parsed = JSON.parse(text); } catch(error) { parsed = text; } }

	const result = { status: response.status, headers: response.headers, data: parsed };

	// A STATUS THE CALLER DID NOT ASK FOR IS AN ERROR THAT CARRIES THE ANSWER
	if(response.status < 200 || response.status >= 300)
	{
		const error = new Error("Request failed with status code " + response.status);
		error.response = result;
		throw error;
	}

	return result;
}

//
// THE RAW BYTES, FOR EVERYTHING THAT IS NOT JSON
async function buffer(options)
{
	const response = await send(options);

	if(response.status < 200 || response.status >= 300)
	{
		const error = new Error("Request failed with status code " + response.status);
		error.response = { status: response.status, headers: response.headers };
		throw error;
	}

	return response.body;
}

// EXPORT
module.exports = { request, buffer, send, proxyFor };
