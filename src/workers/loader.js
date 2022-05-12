// Thread for loading a gltf
import { FileLoader } from '../loaders/fileloader.js';

const parameters = {};
location.search.slice(1).split("&").forEach( function(key_value) { var kv = key_value.split("="); parameters[kv[0]] = kv[1]; })

const file = "../../" + parameters['filename'];
const onLoad = data => postMessage( data.currentTarget.response );

FileLoader.Load(
    file,
    onLoad
);