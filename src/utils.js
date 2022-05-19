/*
	Some utils
*/
function getTime() {
	return new Date().getTime();
}

function firstToUpperCase(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

function concatTypedArray (Arrays, ArrayType){
	return Arrays.reduce((acc, arr) => new ArrayType([...acc, ...arr]), []);
}

const ShaderChunk = {

	Point: {
		vertexshader: `

			attribute float size;
			attribute vec3 color;

			varying vec3 vColor;

			void main() {

				vColor = color;

				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

				gl_PointSize = size * ( 300.0 / -mvPosition.z );

				gl_Position = projectionMatrix * mvPosition;

			}

		`,

		fragmentshader: `

			uniform vec3 color;
			uniform sampler2D pointTexture;
			uniform float alphaTest;

			varying vec3 vColor;

			void main() {

				gl_FragColor = vec4( color * vColor, 1.0 );

				gl_FragColor = gl_FragColor * texture2D( pointTexture, gl_PointCoord );

				if ( gl_FragColor.a < alphaTest ) discard;

			}

		`
	}

};
// y1: start value
// y2: end value
// mu: the current frame of the interpolation,
//     in a linear range from 0-1.
const linearInterpolation = (y1, y2, mu) => {
	return (y1 * (1 - mu)) + (y2 * mu);
};
const cosineInterpolation = (y1, y2, mu) => {
	const mu2 = (1 - Math.cos(mu * Math.PI)) / 2;
	return (y1 * (1 - mu2)) + (y2 * mu2);
};

export { getTime, firstToUpperCase, concatTypedArray, ShaderChunk, cosineInterpolation, linearInterpolation }