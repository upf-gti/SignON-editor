Math.clamp = function (v, a, b) {
	return a > v ? a : b < v ? b : v;
};

function getTime() {
	return new Date().getTime();
};

export { getTime }