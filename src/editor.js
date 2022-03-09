import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { createSkeleton, createAnimation } from "./skeleton.js";
import { BVHExporter } from "./bvh_exporter.js";
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { Gui } from "./gui.js";

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
        this.mixerHelper = null;
        this.skeletonHelper = null;
        
        this.points_geometry = null;
        this.landmarks_array = [];
        this.prev_time = this.iter = 0;
    	this.onDrawTimeline = null;
	    this.onDrawSettings = null;
        this.gui = new Gui();

        this.init();
        
    }
    
    init() {

        let canvasArea = document.getElementById("canvasarea");

        const CANVAS_WIDTH = canvasArea.clientWidth;
        const CANVAS_HEIGHT = canvasArea.clientHeight;

        let scene = new THREE.Scene();
        scene.background = new THREE.Color(0xeeeeee);
        scene.add(new THREE.GridHelper(400, 10));
        
        const pixelRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
        let renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.outputEncoding = THREE.sRGBEncoding;
        canvasArea.appendChild(renderer.domElement);
        
        // camera
        let camera = new THREE.PerspectiveCamera(60, pixelRatio, 1, 1000);
        window.camera = camera;
        let controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = 1;
        controls.maxDistance = 7;
        camera.position.set(0.5, 2, -3);
        controls.target.set(1.2, 1.5, 0);
        controls.update();  
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;
    }
    
    loadInScene(project) {
        
        let that = this;

        this.landmarks_array = project.landmarks;
        
        project.path = project.path || "models/bvh/victor.bvh";
        
        let skeleton = createSkeleton(this.landmarks_array);
        
        this.skeletonHelper = new THREE.SkeletonHelper(skeleton.bones[0]);
        this.skeletonHelper.skeleton = skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
        
        const boneContainer = new THREE.Group();
        boneContainer.add(skeleton.bones[0]);
        
        this.scene.add(this.skeletonHelper);
        this.scene.add(boneContainer);
              
        //landmark points
        this.points_geometry = new THREE.BufferGeometry();
        
        const material = new THREE.PointsMaterial( { color: 0x880000 } );
        material.size = 0.025;
        
        const points = new THREE.Points( this.points_geometry, material );
        this.scene.add( points );

        
        // play animation
        var animation_clip = createAnimation(this.landmarks_array);
       
         this.mixerHelper = new THREE.AnimationMixer(this.skeletonHelper);
         this.mixerHelper.clipAction(animation_clip).setEffectiveWeight(1.0).play();
         this.mixerHelper.update(this.clock.getDelta()); //do first iteration to update from T pose
 

        // set onlcick function to play button
        let stateBtn = document.getElementById("state_btn");
        stateBtn.onclick = function(e) {

            that.state = !that.state;
            stateBtn.innerHTML = that.state ? "❚❚" : "►";

            if(that.state)
                stateBtn.style.border = "solid #268581";
            else
                stateBtn.style.removeProperty("border");
        }

        // Load the model (Eva)
        this.loadGLTF("models/Taunt.glb", function(gltf) {
           
            let model = gltf.scene;
            model.castShadow = true;

            model.traverse( function ( object ) {
                if ( object.isMesh ) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                }
            } );
            //model.skeleton = skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
            var arm = model.getChildByName("Armature");
           // that.group_bind_skeleton(arm, that.skeletonHelper.skeleton)
            that.scene.add( model );
            var animationGroup = new THREE.AnimationObjectGroup();
            for(var i=0; i< arm.children.length; i++){
                if(!arm.children[i].isSkinnedMesh)
                    continue;
                animationGroup.add(arm.children[i]);
            }
            that.mixer = new THREE.AnimationMixer( animationGroup );
            //const action = that.mixer.clipAction( gltf.animations[0] ).play();

            // play animation
            var animation_clip = createAnimation(that.landmarks_array);
            //this.mixer = new THREE.AnimationMixer(this.skeletonHelper);
            that.mixer.clipAction(animation_clip).setEffectiveWeight(1.0).play();
            that.mixer.update(that.clock.getDelta()); //do first iteration to update from T pose
                
            //BVHExporter.export(skeleton, animation_clip, that.landmarks_array.length);
       
            project.prepareData(that.mixer, animation_clip, skeleton);
            that.gui.loadProject(project);
            
            that.animate();
        });
    }
    group_bind_skeleton( grp, skeleton ){
        let c, i, len = grp.children.length, root_bind=false;

        grp.updateMatrixWorld( true ); // MUST DO THIS, Else things gets effed up
        for( i=0; i < len; i++ ){
            c = grp.children[ i ];
            if( !c.isSkinnedMesh ) continue;

            // Need to child the root bone to a SkinnedMesh else no works
            // Can only do this once, so do it on the first possible one.
            if( !root_bind ){ c.add( skeleton.bones[0] ); root_bind = true; }

            c.bind( skeleton );			// Bind Skeleton to SkinnedMesh
            c.bindMode = "detached";	// Not sure if it does anything but just incase.
        }
    }
    loadGLTF(animationFile, onLoaded) {
            
        const loader = new GLTFLoader();
        loader.load(
            animationFile,
            onLoaded,
            (xhr) => {
                if (xhr.loaded == xhr.total) console.log('GLTF loaded correctly.');
            },
            (error) => {
                console.log(error);
            }
        );
    }
        
    animate() {
        
        requestAnimationFrame(this.animate.bind(this));
        
        const dt = this.clock.getDelta();
        
        if (this.mixer && this.state) {
            //console.log("Scene!");
            this.mixer.update(dt);
        }
        if (this.mixerHelper && this.state) {
            //console.log("Scene!");
            this.mixerHelper.update(dt);
        }
        if (this.gui)
            this.gui.render();
        
        // if (points_geometry == undefined || landmarks_array == undefined) {
        //     var curr_lm = this.landmarks_array[this.iter];
        //     var curr_time = Date.now();
        //     var et = (curr_time - this.prev_time);
        //     if (et > curr_lm.dt) {
                
        //         const vertices = [];
                
        //         for (let i = 0; i < curr_lm.PLM.length; i++) {
        //             const x = curr_lm.PLM[i].x;
        //             const y = curr_lm.PLM[i].y;
        //             const z = curr_lm.PLM[i].z;
                    
        //             vertices.push( x, y, z );
        //         }
                
        //         this.points_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
                
        //         this.prev_time = curr_time + curr_lm.dt;
        //         this.iter++;
        //         this.iter = this.iter % this.landmarks_array.length;
        //     }
        // }
    
        this.renderer.render(this.scene, this.camera);
    }

    resize(width, height) {
        
        const aspect = width / height;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(aspect);
        this.renderer.setSize(width, height);
    }
};

export { Editor };