import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { load_timeline } from "./timeline_manager.js";
import { createSkeleton, createAnimation } from "./skeleton.js";
import { export_bvh } from "./bvh_exporter.js";

const clock = new THREE.Clock();
const loader = new BVHLoader();

let camera, controls, scene, renderer, state = false; //state defines how the animation starts (moving/static)
let mixer, skeletonHelper;
let sphere1, sphere2, sphere3, a = 0, aaa = 0, b = [], c = [], d = [];

let points_geometry;
let landmarks_array;
var prev_time = 0, iter = 0;

function setState(val) //boolean
{
    state = val;
};

function loadInScene(project) {

    landmarks_array = project.landmarks;
    points_geometry = new THREE.BufferGeometry();
    //create and init the 3D scene
    init_scene();
    
    //project.path = project.path || "models/bvh/victor.bvh";


        // play animation
        // mixer = new THREE.AnimationMixer(skeletonHelper);
        // mixer.clipAction(result.clip).setEffectiveWeight(1.0).play();
        // mixer.update(clock.getDelta()); //do first iteration to update from T pose

        animate()
        
        // init the timeline with the corresponding bones and duration
        load_timeline(project);
    //})
    
    // show the button to stop the animation
    var element = document.getElementsByClassName("top-right")[0];
    var sidebar = document.createElement("DIV");
    sidebar.id = "sidebar";
    sidebar.style.position = "absolute";
    sidebar.style.width = "35px";
    sidebar.style.height = "300px";
    sidebar.style.top = "70%";
    sidebar.style.left = "3%";
    element.appendChild(sidebar);
    $(function () {
        $("#sidebar").w2sidebar({
            name : "sidebar",
            flatButton: true,
            flat: true,
            nodes: [
                { id: "level-1", text: "options", img: "icon-folder", expanded: true, group: true, groupShowHide: false,
                  nodes: [ { id: "play", text: "Play/Pause", icon: "fa fa-play" },
                           { id: "selectable", text: "Select Bone", icon: "fas fa-crosshairs" },
                         ]
                },
            ],
            onFlat: function (event) {
                $("#sidebar").css("width", (event.goFlat ? "35px" : "150px"));
            },
            onClick: function (event) {
                console.log("Target: "+ event.target, event);
                switch (event.target) {
                    case "play":
                        var video = document.getElementById("recorded");
                        if (video.paused == true) {
                            video.play();
                        }
                        else {
                            video.pause();
                        }
                      break;
                    case "selectable":
                        //select bone option TODO
                      break;
                    default:
                        console.warn("Item not detected in the sidebar elements.");
                      break;
                  }
            },
        });
    });

};

function init_scene() {
    var scene3d = document.getElementById("scene3d");
    var CANVAS_WIDTH = scene3d.width;
    var CANVAS_HEIGHT = scene3d.height;

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
    camera.position.set(0, 5, -8);
   

    renderer = new THREE.WebGLRenderer({ canvas: scene3d, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 1;
    controls.maxDistance = 7;
    //controls.target.set(0, 10, 0);
    
    window.addEventListener("resize", onWindowResize);

    //animate();
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    //New testing
    if (points_geometry == undefined || landmarks_array == undefined) return;
    
    var curr_lm = landmarks_array[iter];
    var curr_time = Date.now();
    var et = (curr_time - prev_time);
    if (et > curr_lm.dt) {
        
        const vertices = [];
        
        for (let i = 0; i < curr_lm.FLM.length; i++) {
            const x = curr_lm.FLM[i].x;
            const y = curr_lm.FLM[i].y;
            const z = curr_lm.FLM[i].z;
            
            vertices.push( x, y, z );
        }
        
        points_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
        const material = new THREE.PointsMaterial( { color: 0x880000 } );
        material.size = 0.025;

        const points = new THREE.Points( points_geometry, material );

        scene.add( points );
        prev_time = curr_time + curr_lm.dt;
        iter++;
        iter = iter % landmarks_array.length;
    }

    renderer.render(scene, camera);

}

function onWindowResize() {

    //resize of video canvas (think to move this to other site!!!!!!!!)
    var elem = document.getElementById("capture");
    var video = document.getElementById("recording");
    var scene_canv = document.getElementById("scene3d");
    var aspect_ratio = elem.clientWidth / elem.clientHeight;
    video.height = scene_canv.height = elem.clientHeight * 0.99;
    video.width = scene_canv.width = aspect_ratio * video.height;

    var timeline_elem = document.getElementById("timeline");
    var distance = window.innerHeight * 0.4 - 82/2; //intial distance computed in style.css
    timeline_elem.style.height = Math.max(distance, 300).toString() + "px";


    //resize the toolbar and sidebar elements


    camera.aspect = scene_canv.width / scene_canv.height;
    camera.updateProjectionMatrix();

    renderer.setSize(scene_canv.width, scene_canv.height);

}

export { loadInScene, state, setState, animate };