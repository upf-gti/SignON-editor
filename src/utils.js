import { MiniGLTFLoader } from "./loaders/GLTFLoader.js";

/*
	Some utils
*/

const UTILS = {
	getTime() {
		return new Date().getTime();
	},
	
	firstToUpperCase(string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	},
	
	concatTypedArray (Arrays, ArrayType){
		return Arrays.reduce((acc, arr) => new ArrayType([...acc, ...arr]), []);
	},

	// Function to find consecutive ranges
	consecutiveRanges(a) {
		let length = 1;
		let list = [];
	
		// If the array is empty, return the list
		if (a.length == 0)
			return list;

		for (let i = 1; i <= a.length; i++) {
			// Check the difference between the current and the previous elements. If the difference doesn't equal to 1 just increment the length variable.
			if (i == a.length || a[i] - a[i - 1] != 1) {
				// If the range contains only one element. Add it into the list.
				if (length == 1) {
					list.push((a[i - length]));
				}
				else {
					// Build the range between the first element of the range and the current previous element as the last range.
					list.push([a[i - length], a[i - 1]]);
				}
				// After finding the first range initialize the length by 1 to build the next range.
				length = 1;
			}
			else {
				length++;
			}
		}
		return list;
	},

	loadGLTF(animationFile, onLoaded) {
        
        this.makeLoading("Loading GLTF [" + animationFile +"]...", 0.75)
        const gltfLoader = new MiniGLTFLoader();

        if(typeof(Worker) !== 'undefined') {
            const worker = new Worker("src/workers/loader.js?filename=" + animationFile, { type: "module" });
            worker.onmessage = function (event) {
                gltfLoader.parse(event.data, animationFile, onLoaded);
                worker.terminate();
            };
        } else {
            // browser does not support Web Workers
            // call regular load function
            gltfLoader.load( animationFile, onLoaded );
        }
    },

	makeLoading( string, opacity = 1 ) {

		$("#loading p").text( string );
		$("#loading").css({ background: "rgba(17,17,17," + opacity + ")" })
		$("#loading").fadeIn();
	}
};

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

export { UTILS, ShaderChunk }