import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';

class MiniGLTFLoader {

    constructor() {
        this.loader = new GLTFLoader();
    }

    load(url, onload, onerror) {

        this.loader.load(
            url,
            onload,
            xhr => {
                if (xhr.loaded == xhr.total) console.log('GLTF loaded correctly.');
            },
            error => {
                if(onerror) onerror(error);
                else console.error(error);
            }
        );

    }

    parse( data, path, onload ) {
        this.loader.parse(data, path, function(gltf) {
            onload(gltf);
        }, e => console.error(e, "Can't parse file [" + path + "]"));
    }

};

export { MiniGLTFLoader };