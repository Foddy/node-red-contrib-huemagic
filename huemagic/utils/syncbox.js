const axios = require('axios');
const https = require('https');

// THE SYNC BOX SERVES A CERTIFICATE THAT NO OS TRUST STORE KNOWS
const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

//
// THE SYNC BOX SPEAKS ITS OWN LOCAL API, IT IS NOT A RESOURCE OF THE BRIDGE
function SyncBoxAPI()
{
	//
	// MAKE A REQUEST
	this.request = function({ config = null, method = 'GET', resource = "", data = null, token = null })
	{
		return new Promise(function(resolve, reject)
		{
			if(!config || !config.syncbox)
			{
				reject({ status: "ENOTCONFIGURED", errors: "The sync box is not configured." });
				return false;
			}

			const accessToken = (token !== null) ? token : config.token;

			let request = {
				"method": method,
				"url": "https://" + config.syncbox.trim() + "/api/v1" + resource,
				"headers": { "Content-Type": "application/json" },
				"httpsAgent": httpsAgent,
				"proxy": false, // THE BOX IS ON THE LOCAL NETWORK, NEVER GO THROUGH A PROXY
				"timeout": 10000,
			};

			if(accessToken) { request["headers"]["Authorization"] = "Bearer " + accessToken; }
			if(data !== null) { request["data"] = data; }

			axios(request)
			.then(function(response) { resolve(response.data); })
			.catch(function(error)
			{
				if(error.response)
				{
					const body = error.response.data;
					reject({ status: error.response.status, code: body ? body.code : false, errors: (body && body.message) ? body.message : body });
				}
				else
				{
					reject({ status: error.code, errors: error.message });
				}
			});
		});
	}

	//
	// REGISTER WITH THE BOX / THE BUTTON HAS TO BE PRESSED WHILE THIS RUNS
	this.register = function(config)
	{
		const scope = this;
		return scope.request({
			config: config,
			method: "POST",
			resource: "/registrations",
			token: false,
			data: { appName: "huemagic", instanceName: "node-red" }
		});
	}

	//
	// READ THE COMPLETE STATE (device, execution, hdmi, hue, behavior)
	this.state = function(config)
	{
		return this.request({ config: config, resource: "/" });
	}

	//
	// CHANGE WHAT THE BOX IS DOING
	this.execute = function(config, patch)
	{
		return this.request({ config: config, method: "PUT", resource: "/execution", data: patch });
	}
}

// EXPORT
module.exports = new SyncBoxAPI;
