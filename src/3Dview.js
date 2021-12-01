import * as THREE from './libs/three.module.js';
import { OrbitControls } from './controls/OrbitControls.js';
import { BVHLoader } from './loaders/BVHLoader.js';
import { load_timeline } from './timeline_manager.js';

const clock = new THREE.Clock();
const loader = new BVHLoader();

let camera, controls, scene, renderer, state = false; //state defines how the animation starts (moving/static)
let mixer, skeletonHelper;
let sphere1, sphere2, sphere3, a = 0, aaa = 0, b = [], c = [], d = [];


function loadInScene(project) {

    //create and init the 3D scene
    init_scene();

    project.path = project.path || "models/bvh/pirouette.bvh";
    
    loader.load(project.path, function (result) {
        
        skeletonHelper = new THREE.SkeletonHelper(result.skeleton.bones[0]);
        skeletonHelper.skeleton = result.skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
        
        const boneContainer = new THREE.Group();
        boneContainer.add(result.skeleton.bones[0]);
        
        scene.add(skeletonHelper);
        scene.add(boneContainer);
        
        // play animation
        mixer = new THREE.AnimationMixer(skeletonHelper);
        mixer.clipAction(result.clip).setEffectiveWeight(1.0).play();
        mixer.update(clock.getDelta()); //do first iteration to update from T pose

        // set info of the project (ONGOING WORK!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        project.prepare_data(mixer, result.clip, result.skeleton);
        var father = mixer._actions[0]._clip.tracks[0].values;
        var father_quat = mixer._actions[0]._clip.tracks[1].values;
        var father2 = mixer._actions[0]._clip.tracks[2].values;
        var father2_quat = mixer._actions[0]._clip.tracks[3].values;
        var child = mixer._actions[0]._clip.tracks[4].values;
        var child_quat = mixer._actions[0]._clip.tracks[5].values;
        d = father.map(function (num, idx) {
            return num + father2[idx] + child[idx];
        });
        for (var i = 0, j = 0; i < father.length-3; i=i+3, j=j+4) {
            var father_pos = new THREE.Vector3(father[i], father[i+1], father[i+2]);
            var father_quat_good = new THREE.Quaternion(father_quat[j], father_quat[j+1], father_quat[j+2], father_quat[j+3]);
            c.push(father_pos);
            var father_pos_good = father_pos.applyQuaternion(father_quat_good);
            var father2_pos = new THREE.Vector3(father_pos.x + father2[i], father_pos.y + father2[i+1], father_pos.z + father2[i+2]);
            var father2_quat_good = new THREE.Quaternion(father2_quat[j], father2_quat[j+1], father2_quat[j+2], father2_quat[j+3]);
            //var father2_pos_good = father2_pos.applyQuaternion(father2_quat_good);
            var child_pos = new THREE.Vector3(father2_pos.x + child[i], father2_pos.y + child[i+1], father2_pos.z + child[i+2]);
            var child_quat_good = new THREE.Quaternion(child_quat[j], child_quat[j+1], child_quat[j+2], child_quat[j+3]);
            child_pos.applyQuaternion(child_quat_good);
            b.push(child_pos);
        }
        
        // init the timeline with the corresponding bones and duration
        load_timeline(project);
    })
    
    // show the button to stop the animation
    var element = document.getElementsByClassName('top-right')[0];
    var sidebar = document.createElement("DIV");
    sidebar.id = "sidebar";
    sidebar.style.position = "absolute";
    sidebar.style.width = "35px";
    sidebar.style.height = "300px";
    sidebar.style.top = "70%";
    sidebar.style.left = "3%";
    element.appendChild(sidebar);
    $(function () {
        $('#sidebar').w2sidebar({
            name : 'sidebar',
            flatButton: true,
            flat: true,
            nodes: [
                { id: 'level-1', text: 'options', img: 'icon-folder', expanded: true, group: true, groupShowHide: false,
                  nodes: [ { id: 'play', text: 'Play/Pause', icon: 'fa fa-play' },
                           { id: 'selectable', text: 'Select Bone', icon: 'fas fa-crosshairs' },
                         ]
                },
            ],
            onFlat: function (event) {
                $('#sidebar').css('width', (event.goFlat ? '35px' : '150px'));
            },
            onClick: function (event) {
                console.log('Target: '+ event.target, event);
                var video = document.getElementById('recorded');
                switch (event.target) {
                    case "play":
                        var icon = event.node.icon;
                        if (icon == 'fa fa-play') {
                            icon = 'fa fa-pause';
                            state = true;
                            video.play();
                        }
                        else {
                            icon = 'fa fa-play';
                            state = false;
                            video.pause();
                        }
                        this.update('play', {"icon": icon});
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

    const geometry = new THREE.SphereGeometry(3, 32, 16);
    const material1 = new THREE.MeshBasicMaterial( { color: 0xff00ff } );
    const material2 = new THREE.MeshBasicMaterial( { color: 0x0000ff } );
    const material3 = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
    sphere1 = new THREE.Mesh( geometry, material1 );
    //scene.add( sphere1 );
    sphere2 = new THREE.Mesh( geometry, material2 );
    //scene.add( sphere2 );
    sphere3 = new THREE.Mesh( geometry, material3 );
    //scene.add( sphere3 );

    animate();
} 

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (mixer && state == true) {
        mixer.update(delta);
        // Object.assign(sphere1.position, b[aaa]);
        // Object.assign(sphere2.position, c[aaa]);
        // sphere3.position.x = d[a];
        // sphere3.position.y = d[a+1];
        // sphere3.position.z = d[a+2];
        // aaa=aaa+7;
        // a=a+3*7;
        // if (a > d.length) a=0;
        // if (aaa > b.length) aaa=0;
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

export { loadInScene, state };