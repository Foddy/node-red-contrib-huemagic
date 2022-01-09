// EXTERNAL HELPERS
const colornames = require("colornames");
const colornamer = require('color-namer');
const getColors = require('get-image-colors');

// RGB -> XY
function rgbToXy(red, green, blue, gamut = null)
{
	var colorGamut = { red: [1.0, 0], green: [0.0, 1.0], blue: [0.0, 0.0] };
	if(!!gamut)
	{
		colorGamut = { red: [gamut.red.x, gamut.red.y], green: [gamut.green.x, gamut.green.y], blue: [gamut.blue.x, gamut.blue.y] };
	}

	red = parseFloat(red / 255);
	green = parseFloat(green / 255);
	blue = parseFloat(blue / 255);

	red = _getGammaCorrectedValue(red);
	green = _getGammaCorrectedValue(green);
	blue = _getGammaCorrectedValue(blue);

	let x = red * 0.649926 + green * 0.103455 + blue * 0.197109;
	let y = red * 0.234327 + green * 0.743075 + blue * 0.022598;
	let z = red * 0.0000000 + green * 0.053077 + blue * 1.035763;

	let xy = {
		x: x / (x + y + z),
		y: y / (x + y + z)
	};

	if(!_xyIsInGamutRange(xy, colorGamut))
	{
		xy = _getClosestColor(xy, colorGamut);
	}

	return xy;
}

function _getGammaCorrectedValue(value)
{
	return (value > 0.04045) ? Math.pow((value + 0.055) / (1.0 + 0.055), 2.4) : (value / 12.92)
}

function _xyIsInGamutRange(xy, gamut)
{
	if(Array.isArray(xy))
	{
		xy = {
			x: xy[0],
			y: xy[1]
		};
	}

	const v0 = [gamut.blue[0] - gamut.red[0], gamut.blue[1] - gamut.red[1]];
	const v1 = [gamut.green[0] - gamut.red[0], gamut.green[1] - gamut.red[1]];
	const v2 = [xy.x - gamut.red[0], xy.y - gamut.red[1]];

	const dot00 = (v0[0] * v0[0]) + (v0[1] * v0[1]);
	const dot01 = (v0[0] * v1[0]) + (v0[1] * v1[1]);
	const dot02 = (v0[0] * v2[0]) + (v0[1] * v2[1]);
	const dot11 = (v1[0] * v1[0]) + (v1[1] * v1[1]);
	const dot12 = (v1[0] * v2[0]) + (v1[1] * v2[1]);

	const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);

	const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
	const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

	return ((u >= 0) && (v >= 0) && (u + v < 1));
}

function _getClosestColor(xy, gamut)
{
	let greenBlue = {
		a: {
			x: gamut.green[0],
			y: gamut.green[1]
		},
		b: {
			x: gamut.blue[0],
			y: gamut.blue[1]
		}
	};

	let greenRed = {
		a: {
			x: gamut.green[0],
			y: gamut.green[1]
		},
		b: {
			x: gamut.red[0],
			y: gamut.red[1]
		}
	};

	let blueRed = {
		a: {
			x: gamut.red[0],
			y: gamut.red[1]
		},
		b: {
			x: gamut.blue[0],
			y: gamut.blue[1]
		}
	};

	let closestColorPoints = {
		greenBlue: _getClosestPoint(xy,greenBlue.a, greenBlue.b),
		greenRed: _getClosestPoint(xy,greenRed.a, greenRed.b),
		blueRed: _getClosestPoint(xy,blueRed.a, blueRed.b)
	};

	let distance = {
		greenBlue: _getLineDistance(xy,closestColorPoints.greenBlue),
		greenRed: _getLineDistance(xy,closestColorPoints.greenRed),
		blueRed: _getLineDistance(xy,closestColorPoints.blueRed)
	};

	let closestDistance;
	let closestColor;
	for (let i in distance)
	{
		if(distance.hasOwnProperty(i))
		{
			if(!closestDistance)
			{
				closestDistance = distance[i];
				closestColor = i;
			}

			if(closestDistance > distance[i])
			{
				closestDistance = distance[i];
				closestColor = i;
			}
		}
	}

	return closestColorPoints[closestColor];
}

function _getLineDistance(pointA,pointB)
{
	return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
}

function _getClosestPoint(xy, pointA, pointB)
{
	let xy2a = [xy.x - pointA.x, xy.y - pointA.y];
	let a2b = [pointB.x - pointA.x, pointB.y - pointA.y];
	let a2bSqr = Math.pow(a2b[0],2) + Math.pow(a2b[1],2);
	let xy2a_dot_a2b = xy2a[0] * a2b[0] + xy2a[1] * a2b[1];
	let t = xy2a_dot_a2b /a2bSqr;

	return {
		x: pointA.x + a2b[0] * t,
		y: pointA.y + a2b[1] * t
	}
}

// XY -> RGB
function xyBriToRgb(x, y, bri)
{
	const z = 1.0 - x - y;
	const Y = bri / 100;
	const X = (Y / y) * x;
	const Z = (Y / y) * z;

	let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
	let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
	let b =  X * 0.051713 - Y * 0.121364 + Z * 1.011530;

	r = _getReversedGammaCorrectedValue(r);
	g = _getReversedGammaCorrectedValue(g);
	b = _getReversedGammaCorrectedValue(b);

	r = Math.max(r, 0);
	g = Math.max(g, 0);
	b = Math.max(b, 0);

	let max = Math.max(r, g, b);
	if (max > 1)
	{
		r = r / max;
		g = g / max;
		b = b / max;
	}

	return { r: Math.floor(r * 255), g: Math.floor(g * 255), b: Math.floor(b * 255), };
}

function _getReversedGammaCorrectedValue(value)
{
	return value <= 0.0031308 ? 12.92 * value : (1.0 + 0.055) * Math.pow(value, (1.0 / 2.4)) - 0.055;
}

// RGB -> HEX
function rgbHex(red, green, blue, alpha)
{
	const isPercent = (red + (alpha || '')).toString().includes('%');

	if (typeof red === 'string') {
		[red, green, blue, alpha] = red.match(/(0?\.?\d{1,3})%?\b/g).map(component => Number(component));
	} else if (alpha !== undefined) {
		alpha = Number.parseFloat(alpha);
	}

	if (typeof red !== 'number' ||
		typeof green !== 'number' ||
		typeof blue !== 'number' ||
		red > 255 ||
		green > 255 ||
		blue > 255
	) {
		throw new TypeError('Expected three numbers below 256');
	}

	if (typeof alpha === 'number') {
		if (!isPercent && alpha >= 0 && alpha <= 1) {
			alpha = Math.round(255 * alpha);
		} else if (isPercent && alpha >= 0 && alpha <= 100) {
			alpha = Math.round(255 * alpha / 100);
		} else {
			throw new TypeError(`Expected alpha value (${alpha}) as a fraction or percentage`);
		}

		alpha = (alpha | 1 << 8).toString(16).slice(1);
	} else {
		alpha = '';
	}

	return ((blue | green << 8 | red << 16) | 1 << 24).toString(16).slice(1) + alpha;
}

// HEX -> RGB
function hexRgb(hex, options = {})
{
	const hexCharacters = 'a-f\\d';
	const match3or4Hex = `#?[${hexCharacters}]{3}[${hexCharacters}]?`;
	const match6or8Hex = `#?[${hexCharacters}]{6}([${hexCharacters}]{2})?`;
	const nonHexChars = new RegExp(`[^#${hexCharacters}]`, 'gi');
	const validHexSize = new RegExp(`^${match3or4Hex}$|^${match6or8Hex}$`, 'i');

	if (typeof hex !== 'string' || nonHexChars.test(hex) || !validHexSize.test(hex)) {
		throw new TypeError('Expected a valid hex string');
	}

	hex = hex.replace(/^#/, '');
	let alphaFromHex = 1;

	if (hex.length === 8) {
		alphaFromHex = Number.parseInt(hex.slice(6, 8), 16) / 255;
		hex = hex.slice(0, 6);
	}

	if (hex.length === 4) {
		alphaFromHex = Number.parseInt(hex.slice(3, 4).repeat(2), 16) / 255;
		hex = hex.slice(0, 3);
	}

	if (hex.length === 3) {
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	}

	const number = Number.parseInt(hex, 16);
	const red = number >> 16;
	const green = (number >> 8) & 255;
	const blue = number & 255;
	const alpha = typeof options.alpha === 'number' ? options.alpha : alphaFromHex;

	return [red, green, blue];
}

// RANDOM HEX COLOR GENERATOR
function randomHexColor()
{
	return '#' + (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, "0");
}

function rgbToHsl(r, g, b)
{
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min)
    {
        h = s = 0;
    }
    else
    {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max)
        {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}

function hslToRgb(h, s, l)
{
    var r, g, b;

    if(s == 0)
    {
        r = g = b = l; // achromatic
    }
    else
    {
        var hue2rgb = function hue2rgb(p, q, t)
        {
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// MIX TWO COLORS
function mixColors(rgbA, rgbB, amount = 0.5)
{
   var r = _colorChannelMixer(rgbA[0], rgbB[0], amount);
   var g = _colorChannelMixer(rgbA[1], rgbB[1], amount);
   var b = _colorChannelMixer(rgbA[2], rgbB[2], amount);

   return [r, g, b];
}

function _colorChannelMixer(colorChannelA, colorChannelB, amount)
{
   var channelA = colorChannelA * amount;
   var channelB = colorChannelB * (1 - amount);

   return parseInt(channelA + channelB);
}

// GET CURRENT COLOR TEMPERATURE
function colorTemperature()
{
	let hour = (new Date()).getHours();
	let minute = (new Date()).getMinutes();
	let time = hour + minute * 0.01667;

	let autoTemperature = Math.floor(3.125 * time ** 2 - 87.5 * time + 812);
	autoTemperature = (autoTemperature < 153) ? 153 : autoTemperature;
	autoTemperature = (autoTemperature > 500) ? 500 : autoTemperature;

	return autoTemperature;
}


// EXPORT
module.exports.rgbToXy = rgbToXy;
module.exports.rgbHex = rgbHex;
module.exports.rgbToHsl = rgbToHsl;
module.exports.hslToRgb = hslToRgb;
module.exports.xyBriToRgb = xyBriToRgb;
module.exports.hexRgb = hexRgb;
module.exports.randomHexColor = randomHexColor;
module.exports.colornames = colornames;
module.exports.colornamer = colornamer;
module.exports.getColors = getColors;
module.exports.colorTemperature = colorTemperature;
module.exports.mixColors = mixColors;