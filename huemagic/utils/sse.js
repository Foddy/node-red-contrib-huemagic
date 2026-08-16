//
// PARSE A SINGLE SERVER-SENT EVENT FRAME
function parseFrame(frame)
{
	let event = { id: null, event: null, data: null };
	let data = [];

	for(let line of frame.split(/\r\n|\n|\r/))
	{
		// EMPTY LINE OR COMMENT (KEEP-ALIVE)
		if(line.length === 0 || line.charAt(0) === ":") { continue; }

		const colon = line.indexOf(":");
		const field = (colon === -1) ? line : line.slice(0, colon);
		let value = (colon === -1) ? "" : line.slice(colon + 1);

		if(value.charAt(0) === " ") { value = value.slice(1); }

		if(field === "data") { data.push(value); }
		else if(field === "id") { event.id = value; }
		else if(field === "event") { event.event = value; }
	}

	if(data.length > 0) { event.data = data.join("\n"); }

	return (event.id || event.data) ? event : false;
}

//
// PARSE AN EVENT STREAM CHUNK / GIVE BACK THE INCOMPLETE REST
function parseEventStream(text)
{
	const separator = /\r\n\r\n|\n\n|\r\r/;
	let events = [];
	let rest = text;
	let match;

	while((match = separator.exec(rest)) !== null)
	{
		const frame = rest.slice(0, match.index);
		rest = rest.slice(match.index + match[0].length);

		const event = parseFrame(frame);
		if(event) { events.push(event); }
	}

	return { events: events, rest: rest };
}

// EXPORT
module.exports = { parseEventStream };
