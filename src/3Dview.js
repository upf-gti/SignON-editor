import * as THREE from './libs/three.module.js';

import { OrbitControls } from './controls/OrbitControls.js';
import { BVHLoader } from './loaders/BVHLoader.js';
import { load_timeline } from './timeline_manager.js';

const clock = new THREE.Clock();
const loader = new BVHLoader();

let camera, controls, scene, renderer, state = true;
let mixer, skeletonHelper;

var button = document.getElementById('play');
button.addEventListener("click", function PlayPause() {
    var icon = this.firstChild;
    if (icon.className == "fa fa-play") {
        icon.className = "fa fa-pause";
        state = true;
    }
    else {
        icon.className = "fa fa-play";
        state = false;
    }
});

function load_animation(project, path) {

    path = path == undefined ? "models/bvh/pirouette.bvh" : path;

    loader.load(path, function (result) {

        skeletonHelper = new THREE.SkeletonHelper(result.skeleton.bones[0]);
        skeletonHelper.skeleton = result.skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly

        const boneContainer = new THREE.Group();
        boneContainer.add(result.skeleton.bones[0]);

        scene.add(skeletonHelper);
        scene.add(boneContainer);

        // play animation
        mixer = new THREE.AnimationMixer(skeletonHelper);
        mixer.clipAction(result.clip).setEffectiveWeight(1.0).play();

        // set info of the project
        project.prepare_data(mixer, result.clip, result.skeleton);

        // init the timeline with the corresponding bones and duration
        load_timeline(project);
    })

    // show the button to stop the animation
    var button = document.getElementById('play');
    button.style.display = 'block';
};

function init_scene() {
    var scene3d = document.getElementById("scene3d");
    var CANVAS_WIDTH = scene3d.clientWidth;
    var CANVAS_HEIGHT = scene3d.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeeeeee);
    scene.add(new THREE.GridHelper(400, 10));

    // lights
    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(3, 10, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // camera
    camera = new THREE.PerspectiveCamera(60, CANVAS_WIDTH / CANVAS_HEIGHT, 1, 1000);
    camera.position.set(0, 200, 300);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas: scene3d, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 100;
    controls.maxDistance = 700;

    window.addEventListener('resize', onWindowResize);

    animate();
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (mixer && state == true) mixer.update(delta);

    renderer.render(scene, camera);
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

export { init_scene, load_animation, state };