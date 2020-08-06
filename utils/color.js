module.exports = {
	/**
	 * Generates a random 6 digit hex string
	 * @return {string}
	 */
	randomHexColor: function () {
		return '#' + (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, "0");
	}
}