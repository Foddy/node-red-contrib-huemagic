var colorPointsGamut_A = [[0.703, 0.296], [0.214, 0.709], [0.139, 0.081]];
var colorPointsGamut_B = [[0.674, 0.322], [0.408, 0.517], [0.168, 0.041]];
var colorPointsGamut_C = [[0.692, 0.308], [0.17, 0.7], [0.153, 0.048]];
var colorPointsDefault = [[1.0, 0.0], [0.0, 1.0], [0.0, 0.0]];

var GAMUT_A_BULBS_LIST = ["LLC001", "LLC005", "LLC006", "LLC007", "LLC010", "LLC011", "LLC012", "LLC014", "LLC013", "LST001"];
var GAMUT_B_BULBS_LIST = ["LCT001", "LCT002", "LCT003", "LCT004", "LLM001", "LCT005", "LCT006", "LCT007"];
var GAMUT_C_BULBS_LIST = ["LCT010", "LCT011", "LCT012", "LCT014", "LCT015", "LCT016", "LLC020", "LST002"];
var MULTI_SOURCE_LUMINAIRES = ["HBL001", "HBL002", "HBL003", "HIL001", "HIL002", "HEL001", "HEL002"];

module.exports = {
  convertXYtoRGB: _getRGBFromXYState,
  convertRGBtoXY: function(rgb, model) {
    var red = rgb[0];
    var green = rgb[1];
    var blue = rgb[2];
    red = red / 255;
    green = green / 255;
    blue = blue / 255;
    var r = red > 0.04045 ? Math.pow(((red + 0.055) / 1.055), 2.4000000953674316) : red / 12.92;
    var g = green > 0.04045 ? Math.pow(((green + 0.055) / 1.055), 2.4000000953674316) : green / 12.92;
    var b = blue > 0.04045 ? Math.pow(((blue + 0.055) / 1.055), 2.4000000953674316) : blue / 12.92;
    var x = r * 0.664511 + g * 0.154324 + b * 0.162028;
    var y = r * 0.283881 + g * 0.668433 + b * 0.047685;
    var z = r * 8.8E-5 + g * 0.07231 + b * 0.986039;
    var xy = [x / (x + y + z), y / (x + y + z)];
    if (isNaN(xy[0])) {
      xy[0] = 0.0;
    }

    if (isNaN(xy[1])) {
      xy[1] = 0.0;
    }

    var colorPoints = colorPointsForModel(model);
    var inReachOfLamps = checkPointInLampsReach(xy, colorPoints);
    if (!inReachOfLamps) {
      var pAB = getClosestPointToPoints(colorPoints[0], colorPoints[1], xy);
      var pAC = getClosestPointToPoints(colorPoints[2], colorPoints[0], xy);
      var pBC = getClosestPointToPoints(colorPoints[1], colorPoints[2], xy);
      var dAB = getDistanceBetweenTwoPoints(xy, pAB);
      var dAC = getDistanceBetweenTwoPoints(xy, pAC);
      var dBC = getDistanceBetweenTwoPoints(xy, pBC);
      var lowest = dAB;
      var closestPoint = pAB;
      if (dAC < dAB) {
        lowest = dAC;
        closestPoint = pAC;
      }

      if (dBC < lowest) {
        closestPoint = pBC;
      }

      xy[0] = closestPoint[0];
      xy[1] = closestPoint[1];
    }

    xy[0] = precision(xy[0]);
    xy[1] = precision(xy[1]);
    return xy;
  }
};

function colorPointsForModel(model) {
  if (model == null) {
    model = " ";
  }

  if (GAMUT_B_BULBS_LIST.indexOf(model) == -1 && MULTI_SOURCE_LUMINAIRES.indexOf(model) == -1) {
    if(GAMUT_A_BULBS_LIST.indexOf(model) >= 0) {
      return colorPointsGamut_A;
    } else if(GAMUT_C_BULBS_LIST.indexOf(model) >= 0) {
      return colorPointsGamut_C;
    } else {
      return colorPointsDefault;
    }
  } else {
    return colorPointsGamut_B;
  }
}

function checkPointInLampsReach(point, colorPoints) {
  if (point != null && colorPoints != null) {
    var red = colorPoints[0];
    var green = colorPoints[1];
    var blue = colorPoints[2];
    var v1 = [green[0] - red[0], green[1] - red[1]];
    var v2 = [blue[0] - red[0], blue[1] - red[1]];
    var q = [point[0] - red[0], point[1] - red[1]];
    var s = crossProduct(q, v2) / crossProduct(v1, v2);
    var t = crossProduct(v1, q) / crossProduct(v1, v2);
    return s >= 0.0 && t >= 0.0 && s + t <= 1.0;
  } else {
    return false;
  }
}

function crossProduct(point1, point2) {
  return point1[0] * point2[1] - point1[1] * point2[0];
}

function getClosestPointToPoints(pointA, pointB, pointP) {
  if (pointA != null && pointB != null && pointP != null) {
    var pointAP = [pointP[0] - pointA[0], pointP[1] - pointA[1]];
    var pointAB = [pointB[0] - pointA[0], pointB[1] - pointA[1]];
    var ab2 = pointAB[0] * pointAB[0] + pointAB[1] * pointAB[1];
    var apAb = pointAP[0] * pointAB[0] + pointAP[1] * pointAB[1];
    var t = apAb / ab2;
    if(t < 0.0) {
      t = 0.0;
    } else if(t > 1.0) {
      t = 1.0;
    }

    return [pointA[0] + pointAB[0] * t, pointA[1] + pointAB[1] * t];
  } else {
    return null;
  }
}

function getDistanceBetweenTwoPoints(pointA, pointB) {
  var dx = pointA[0] - pointB[0];
  var dy = pointA[1] - pointB[1];
  var dist = Math.sqrt(dx * dx + dy * dy);
  return dist;
}

function precision(d) {
  return Math.round(10000.0 * d) / 10000.0;
}

function _getRGBFromXYState(x, y, brightness) {
    var Y = brightness
      , X = (Y / y) * x
      , Z = (Y / y) * (1 - x - y)
      , rgb =  [
          X * 1.612 - Y * 0.203 - Z * 0.302,
          -X * 0.509 + Y * 1.412 + Z * 0.066,
          X * 0.026 - Y * 0.072 + Z * 0.962
      ]
      ;

    rgb = rgb.map(function (x) {
        return (x <= 0.0031308) ? (12.92 * x) : ((1.0 + 0.055) * Math.pow(x, (1.0 / 2.4)) - 0.055);
    });

    rgb = rgb.map(function (x) { return Math.max(0, x); });
    var max = Math.max(rgb[0], rgb[1], rgb[2]);
    if (max > 1) {
        rgb = rgb.map(function (x) { return x / max; });
    }

    rgb = rgb.map(function (x) { return Math.floor(x * 255); });

    return rgb;
}