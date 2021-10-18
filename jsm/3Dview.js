import * as THREE from './build/three.module.js';

import { OrbitControls } from './controls/OrbitControls.js';
import { BVHLoader } from './loaders/BVHLoader.js';
import { load_timeline } from './timeline_manager.js';
import { listNames } from './utils.js';

const clock = new THREE.Clock();
const loader = new BVHLoader();

let camera, controls, scene, renderer, state = true;
let mixer, skeletonHelper;

var button = document.getElementById('play');
button.addEventListener( "click", function PlayPause() {
    if ( this.innerHTML == "PLAY") {
        this.innerHTML = "PAUSE";
        state = false;
    }
    else {
        this.innerHTML = "PLAY";
        state = true;
    }
} );

function load_animation( project, path ) {

    path = path == undefined ? "models/bvh/pirouette.bvh" : path; 

    loader.load( path, function ( result ) {
        
        skeletonHelper = new THREE.SkeletonHelper( result.skeleton.bones[ 0 ] );
        skeletonHelper.skeleton = result.skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
        
        const boneContainer = new THREE.Group();
        boneContainer.add( result.skeleton.bones[ 0 ] );
        
        scene.add( skeletonHelper );
        scene.add( boneContainer );
        
        // play animation
        mixer = new THREE.AnimationMixer( skeletonHelper );
        mixer.clipAction( result.clip ).setEffectiveWeight( 1.0 ).play();
        
        //set info of the project (PREPARE DATA)
        //TODO - PUT IT ALL INTO A FUNCTION
        project.mixer = mixer;
        project.duration = result.clip.duration;
        project.bones = listNames( mixer._root.bones, 0, [] );

        var j = 0;
        for (var i = 0; i < project.bones.length; i++) 
        {
            var bone = project.bones[i];
            var track_name = result.clip.tracks[j].name;
            if (track_name.includes(bone.name) && track_name.includes("position"))
            {
                bone.positions = result.clip.tracks[j].values; //number of frames * 3 (x, y, z)
                bone.times = result.clip.tracks[j].times;
                if (bone.times && bone.times.length > project.max_keyframes) project.max_keyframes = bone.times.length;
                j = j + 1;
                track_name = result.clip.tracks[j].name;
                if (track_name.includes(bone.name) && track_name.includes("quaternion"))
                {
                    bone.quaternions = result.clip.tracks[j].values; //number of frames * 4
                    j = j + 1;
                }
            }
            if (j > result.clip.tracks.length - 1) break;
        }


        project.names = bones.map( v => v.name );
        project.times = bones.map( v => v.times );

        //init the timeline with the corresponding bones and duration
        load_timeline( project );
    } )

    //show the button to stop the animation
    var button = document.getElementById('play');
    button.style.display = 'block';
};

function init_scene() {
    var scene3d = document.getElementById("scene3d");
    var CANVAS_WIDTH = scene3d.clientWidth;
    var CANVAS_HEIGHT = scene3d.clientHeight;
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xeeeeee );
    scene.add( new THREE.GridHelper( 400, 10 ) );
    
    // lights
    const dirLight = new THREE.DirectionalLight( 0xffffff );
    dirLight.position.set( 3, 10, 10 );
    dirLight.castShadow = true;
    scene.add( dirLight );
    
    // camera
    camera = new THREE.PerspectiveCamera( 60, CANVAS_WIDTH / CANVAS_HEIGHT, 1, 1000 );
    camera.position.set( 0, 200, 300 );
    camera.lookAt( 0, 0, 0 );
    
    renderer = new THREE.WebGLRenderer( {canvas: scene3d, antialias: true} );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( CANVAS_WIDTH, CANVAS_HEIGHT );
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    
    controls = new OrbitControls( camera, renderer.domElement );
    controls.minDistance = 100;
    controls.maxDistance = 700;
    
    window.addEventListener( 'resize', onWindowResize );
    
    animate();
}

function animate() {
    requestAnimationFrame( animate );
    
    const delta = clock.getDelta();
    
    if ( mixer && state == true) mixer.update( delta );
    
    renderer.render( scene, camera );
}

function onWindowResize() {
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize( window.innerWidth, window.innerHeight );
    
}

export { init_scene, load_animation, state };