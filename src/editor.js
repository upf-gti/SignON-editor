import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { load_timeline } from "./timeline_manager.js";
import { createSkeleton, createAnimation } from "./skeleton.js";
import { BVHExporter } from "./bvh_exporter.js";

class Editor {

    constructor() {
        this.clock = new THREE.Clock();
        this.loader = new BVHLoader();
        
        this.camera = null;
        this.controls = null;
        this.scene = null;
        this.renderer = null;
        this.state = false;  // defines how the animation starts (moving/static)

        this.mixer = null;
        this.skeletonHelper = null;
        
        this.points_geometry = null;
        this.landmarks_array = [];
        this.prev_time = this.iter = 0;

        this.init();
    }
    
    init() {

        var scene3d = document.getElementById("scene3d");
        var CANVAS_WIDTH = scene3d.width;
        var CANVAS_HEIGHT = scene3d.height;
        
        let scene = new THREE.Scene();
        scene.background = new THREE.Color(0xeeeeee);
        scene.add(new THREE.GridHelper(400, 10));
        
        // camera
        let camera = new THREE.PerspectiveCamera(60, CANVAS_WIDTH / CANVAS_HEIGHT, 1, 1000);
        camera.position.set(0, 5, -8);
        camera.lookAt(0, 0, 0);
        
        let renderer = new THREE.WebGLRenderer({ canvas: scene3d, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.outputEncoding = THREE.sRGBEncoding;
        //renderer.shadowMap.enabled = true;
        
        let controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = 1;
        controls.maxDistance = 7;
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;

        //animate();
    }

    getState() {
        return this.state;
    }

    setState(value) {
        this.state = value;
    }

    loadInScene(project) {

        this.landmarks_array = project.landmarks;
    
        project.path = project.path || "models/bvh/victor.bvh";
    
        let skeleton = createSkeleton(this.landmarks_array);

        this.skeletonHelper = new THREE.SkeletonHelper(skeleton.bones[0]);
        this.skeletonHelper.skeleton = skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
        
        const boneContainer = new THREE.Group();
        boneContainer.add(skeleton.bones[0]);
        
        this.scene.add(this.skeletonHelper);
        this.scene.add(boneContainer);
        
        var animation_clip = createAnimation(this.landmarks_array);

        // play animation
        this.mixer = new THREE.AnimationMixer(this.skeletonHelper);
        this.mixer.clipAction(animation_clip).setEffectiveWeight(1.0).play();
        this.mixer.update(this.clock.getDelta()); //do first iteration to update from T pose

        this.points_geometry = new THREE.BufferGeometry();

        const material = new THREE.PointsMaterial( { color: 0x880000 } );
        material.size = 0.025;

        const points = new THREE.Points( this.points_geometry, material );

        this.scene.add( points );

        BVHExporter.export(skeleton, animation_clip, this.landmarks_array.length);
        
        // play animation
        // mixer = new THREE.AnimationMixer(skeletonHelper);
        // mixer.clipAction(result.clip).setEffectiveWeight(1.0).play();
        // mixer.update(clock.getDelta()); //do first iteration to update from T pose

        this.animate();
    
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
    
    }

    animate() {


        requestAnimationFrame(this.animate.bind(this));
    
        const dt = this.clock.getDelta();
    
        if (this.mixer && this.state) {
            //console.log("Scene!");
            this.mixer.update(dt);
        }
    
        //New testing
        //if (points_geometry == undefined || landmarks_array == undefined) return;
        
        var curr_lm = this.landmarks_array[this.iter];
        var curr_time = Date.now();
        var et = (curr_time - this.prev_time);
        if (et > curr_lm.dt) {
            
            const vertices = [];
            
            for (let i = 0; i < curr_lm.PLM.length; i++) {
                const x = curr_lm.PLM[i].x;
                const y = curr_lm.PLM[i].y;
                const z = curr_lm.PLM[i].z;
                
                vertices.push( x, y, z );
            }
            
            this.points_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
            
            this.prev_time = curr_time + curr_lm.dt;
            this.iter++;
            this.iter = this.iter % this.landmarks_array.length;
        }
    
        this.renderer.render(this.scene, this.camera);
    }

    resize(width, height) {
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
};

export { Editor };