import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { createSkeleton, createAnimation, createAnimationFromRotations, createThreeJSSkeleton, updateThreeJSSkeleton } from "./skeleton.js";
import { BVHExporter } from "./bvh_exporter.js";
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/FBXLoader.js';
import { Gui } from "./gui.js";
import { Gizmo } from "./gizmo.js";
import { firstToUpperCase } from "./utils.js";
import { OrientationHelper } from "./libs/OrientationHelper.js";
import {AnimationRetargeting, PlayAnimation} from "./retargeting.js";

class Editor {

    constructor(app) {
        this.clock = new THREE.Clock();
        this.loader = new BVHLoader();
        
        this.camera = null;
        this.controls = null;
        this.scene = null;
        this.gizmo = null;
        this.renderer = null;
        this.state = false;  // defines how the animation starts (moving/static)

        this.spotLight = null;

        this.mixer = null;
        this.mixerHelper = null;
        
        this.skeletonHelper = null;
        this.skeleton = null;
        
        this.animSkeleton = null;
        this.srcBindPose = null;
        this.tgtBindPose = null;

        this.pointsGeometry = null;
        this.landmarksArray = [];
        this.prevTime = this.iter = 0;
    	this.onDrawTimeline = null;
	    this.onDrawSettings = null;
        this.gui = new Gui(this);

        this.defaultTranslationSnapValue = 1;
        this.defaultRotationSnapValue = 30; // Degrees

        // Keep "private"
        this.__app = app;

        this.character = null;

        this.playAnimation = null;
        this.retargeting = new AnimationRetargeting();
        this.init();
    }
    
    init() {

        let canvasArea = document.getElementById("canvasarea");

        const CANVAS_WIDTH = canvasArea.clientWidth;
        const CANVAS_HEIGHT = canvasArea.clientHeight;

        let scene = new THREE.Scene();
        scene.background = new THREE.Color( 0xa0a0a0 );
               
        // ground
        const ground = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
        ground.rotation.x = - Math.PI / 2;
        ground.receiveShadow = true;
        scene.add( ground );

        //gridhelper
        scene.add(new THREE.GridHelper(300, 20));
        
        scene.fog = new THREE.Fog( 0xa0a0a0, 10, 50 );
        
        const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
        hemiLight.position.set( 0, 20, 0 );
        scene.add( hemiLight );

        const dirLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
        dirLight.position.set( 3, 30, -50 );
        dirLight.castShadow = false;
        dirLight.shadow.camera.top = 2;
        dirLight.shadow.camera.bottom = - 2;
        dirLight.shadow.camera.left = - 2;
        dirLight.shadow.camera.right = 2;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 200;
        scene.add( dirLight );

        this.spotLight = new THREE.SpotLight(0xffa95c,1);
        this.spotLight.position.set(-50,50,50);
        this.spotLight.castShadow = true;
        this.spotLight.shadow.bias = -0.0001;
        this.spotLight.shadow.mapSize.width = 1024*4;
        this.spotLight.shadow.mapSize.height = 1024*4;
        scene.add( this.spotLight );

        const pixelRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
        let renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        canvasArea.appendChild(renderer.domElement);

        renderer.domElement.id = "webgl-canvas";
        renderer.domElement.setAttribute("tabIndex", 1);

        this.video = document.getElementById("recording");

        // camera
        let camera = new THREE.PerspectiveCamera(60, pixelRatio, 0.01, 1000);
        window.camera = camera;
        let controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = 1;
        controls.maxDistance = 7;
        camera.position.set(0, 1, 3);
        controls.target.set(0, 1, 0);
        controls.update();  

        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;

        this.gizmo = new Gizmo(this);

        renderer.domElement.addEventListener( 'keydown', (e) => {
            switch ( e.key ) {

                case " ": // Spacebar
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    let stateBtn = document.getElementById("state_btn");
                    stateBtn.click();
                    break;
                case "Escape":
                    this.gui.timeline.unSelect();
                    break;
            }
        });
    }

    getApp() {
        return this.__app;
    }
    
    loadInScene(project) {
        
        //this.landmarksArray = project.landmarks;
        
        project.path = project.path || "models/bvh/victor.bvh";
        
        // Orientation helper
        const ohOptions = {
            className: 'orientation-helper-dom'
            }, 
            ohLabels = {
                px: '+X',
                nx: '-X',
                pz: '+Z',
                nz: '-Z',
                py: '+Y',
                ny: '-Y'
            };

        const orientationHelper = new OrientationHelper( this.camera, this.controls, ohOptions, ohLabels );
        document.getElementById("canvasarea").prepend(orientationHelper.domElement);

        // let skeleton = createSkeleton(this.landmarksArray);
        // this.skeleton = skeleton;

        // this.skeletonHelper = new THREE.SkeletonHelper(skeleton.bones[0]);
        // this.skeletonHelper.skeleton = skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly

        // const boneContainer = new THREE.Group();
        // boneContainer.add(skeleton.bones[0]);
        
        // this.scene.add(this.skeletonHelper);
        // this.scene.add(boneContainer);
        
        // this.animationClip = createAnimation(project.clipName, this.landmarksArray);
        
        // // play animation
        // this.mixer = new THREE.AnimationMixer(this.skeletonHelper);
        // this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
        // this.mixer.update(this.clock.getDelta()); //do first iteration to update from T pose
        
        // this.pointsGeometry = new THREE.BufferGeometry();
        
        // const material = new THREE.PointsMaterial( { color: 0x880000 } );
        // material.size = 0.025;
        
        // const points = new THREE.Points( this.pointsGeometry, material );
        
        // this.scene.add( points );
        
        // project.prepareData(this.mixer, this.animationClip, skeleton);
        // this.gui.loadProject(project);

        // this.gizmo.begin(this.skeletonHelper);

        // set onclick function to play button
        let stateBtn = document.getElementById("state_btn");
        //let video = document.getElementById("recording");
        stateBtn.onclick = (e) => {
            this.state = !this.state;
            stateBtn.innerHTML = "<i class='bi bi-" + (this.state ? "pause" : "play") + "-fill'></i>";
            stateBtn.style.border = "solid #268581";
            this.state ? this.gizmo.stop() : 0;
            //video.paused ? video.play() : video.pause();
        };

        let stopBtn = document.getElementById("stop_btn");
        stopBtn.onclick = (e) => {
            this.state = false;
            stateBtn.innerHTML = "<i class='bi bi-play-fill'></i>";
            stateBtn.style.removeProperty("border");
            this.stopAnimation();
            // video.pause();
            // video.currentTime = 0;
        }    

        stateBtn.style.display = "block";
        stopBtn.style.display = "block";
      
        this.animate();

        var that = this;
        function loadModel(){
            
        }
        $.getJSON( "data/Taunt.json", function( data ) {
          
            that.landmarksArray = [];
            project.landmarks = [];

            //that.retargeting.createSkeletonFromJSON("data/defaultSkeleton.json", function(bindPose){
            that.loadGLTF("models/Kate_Y.glb", function(gltf){
                let anim = gltf.animations;
                var srcpose = [];
                gltf.scene.visible = false;
                gltf.scene.traverse( function ( object ) {

                    if ( object.isSkinnedMesh ){
                        srcpose = object.skeleton;
                        return;
                    }

                } );
                that.srcBindPose = that.retargeting.getBindPose(srcpose, true);
                    
                for(var i = 0; i < that.srcBindPose.length; i++)
                {
                    var bone = that.srcBindPose[i];
                    var o = gltf.scene.getObjectByName(bone.name);
                    o.position.copy(bone.position);
                    //o.scale.copy(bone.scale);
                    bone.scale.copy( o.scale );
                    o.quaternion.copy(bone.quaternion);
                    o.updateWorldMatrix()
                }
                that.animSkeleton = new THREE.SkeletonHelper( gltf.scene );			
                that.animSkeleton.visible = false;
                that.scene.add(that.animSkeleton)
                that.scene.add(gltf.scene)
               
                updateThreeJSSkeleton(that.srcBindPose);
                that.animationClip = createAnimationFromRotations("Taunt", data);
              
                that.mixer = new THREE.AnimationMixer(gltf.scene);
                that.mixer.clipAction(that.animationClip).setEffectiveWeight(1.0).play();
                

                // Load the model (Eva)  
                that.loadGLTF("models/Eva_Y.glb", (gltf) => {
                
                    that.character = gltf.scene;
                    
                    /*that.character.rotateX(-Math.PI);
                    that.character.rotateY(-Math.PI);*/
                    that.character.rotateOnAxis (new THREE.Vector3(1,0,0), Math.PI);
                    that.character.position.set(0,0.75,0);

                    that.character.castShadow = true;
                    
                    that.character.traverse(  ( object ) => {
                        if ( object.isMesh || object.isSkinnedMesh ) {
                            object.castShadow = true;
                            object.receiveShadow = true;
                            object.frustumCulled = false;

                            if(object.material.map) object.material.map.anisotropy = 16; 
                            that.tgtBindPose = object.skeleton;
                            
                        }
                        else if (object.isBone) {
                            object.scale.set(1.0, 1.0, 1.0);
                        }
                        if(!that.tgtBindPose){
                            object.traverse(function(o){
                                if(o.isSkinnedMesh){
                                    that.tgtBindPose = o.skeleton;
                                }
                            })
                        }
                    } );
                    that.tgtBindPose = that.retargeting.getBindPose(that.tgtBindPose);
                    that.tgtBindPose[0].position.copy(that.srcBindPose[0].position)
                    that.skeletonHelper = new THREE.SkeletonHelper(that.character);

                    const boneContainer = new THREE.Group();
                    boneContainer.add(that.tgtBindPose[0]);
                    that.scene.add(that.skeletonHelper);
                    that.scene.add(boneContainer);
                    that.scene.add( that.character );

                    that.pointsGeometry = new THREE.BufferGeometry();
                
                    const material = new THREE.PointsMaterial( { color: 0x880000 } );
                    material.size = 0.025;
                    
                    const points = new THREE.Points( that.pointsGeometry, material );
                    
                    that.scene.add( points );
            
                    //project.prepareData(that.mixer, that.animationClip, skeleton);
                    that.gui.loadProject(project);
            
                    
                    
                    that.retargeting.updateSkeleton(that.srcBindPose);
                    that.retargeting.automap(that.skeletonHelper.bones);
                    that.mixer.update(0);
                    that.retargeting.retargetAnimation(that.srcBindPose, that.tgtBindPose, that.animSkeleton, that.skeletonHelper, true);
                    that.gizmo.begin(that.skeletonHelper);
                    that.animate();
                
                    //that.skeleton = skeleton;
                    //that.export();
                });
            })
        });
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

    setSelectedBone( name ) {
        if(!this.gizmo)
        throw("No gizmo attached to scene");

        this.gizmo.setBone(name);
        this.gizmo.mustUpdate = true;
    }

    getGizmoMode() {
        return firstToUpperCase( this.gizmo.transform.mode );
    }

    setGizmoMode( mode ) {
        if(!mode.length)
        throw("Invalid Gizmo mode");
        
        this.gizmo.setMode( mode.toLowerCase() );
    }

    getGizmoSpace() {
        return firstToUpperCase( this.gizmo.transform.space );
    }

    setGizmoSpace( space ) {
        if(!space.length)
        throw("Invalid Gizmo mode");
        
        this.gizmo.setSpace( space.toLowerCase() );
    }

    getGizmoSize() {
        return this.gizmo.transform.size;
    }

    setGizmoSize( size ) {
        
        this.gizmo.transform.setSize( size );
    }

    isGizmoSnapActive() {

        return this.getGizmoMode() === 'Translate' ? 
            this.gizmo.transform.translationSnap != null : 
            this.gizmo.transform.rotationSnap != null;

    }
    
    toggleGizmoSnap() {

        if( this.getGizmoMode() === 'Translate' )
            this.gizmo.transform.setTranslationSnap( this.isGizmoSnapActive() ? null : this.defaultTranslationSnapValue );
        else
            this.gizmo.transform.setRotationSnap( this.isGizmoSnapActive() ? null : THREE.MathUtils.degToRad( this.defaultRotationSnapValue ) );
    }

    updateGizmoSnap() {
        
        if(!this.isGizmoSnapActive())
        return;
        this.gizmo.transform.setTranslationSnap( this.defaultTranslationSnapValue );
        this.gizmo.transform.setRotationSnap( THREE.MathUtils.degToRad( this.defaultRotationSnapValue ) );
    }

    setTime(t) {

        // Don't change time if playing
        if(this.state)
        return;

        //this.mixer.setTime(t);
        this.gizmo.updateBones(0.0);

        // Update video
        this.video.currentTime = t;
    }

    stopAnimation() {
        
        //this.mixer.setTime(0.0);
        this.gizmo.updateBones(0.0);
    }
    
    animate() {
        
        requestAnimationFrame(this.animate.bind(this));

        this.render();
        this.update(this.clock.getDelta());

        this.spotLight.position.set( 
            this.camera.position.x + 10,
            this.camera.position.y + 10,
            this.camera.position.z + 10,
        );
        // if (this.pointsGeometry == undefined || this.landmarksArray == undefined) {
        //     var currLM = this.landmarksArray[this.iter];
        //     var currTime = Date.now();
        //     var et = (currTime - this.prevTime);
        //     if (et > currLM.dt) {
                
        //         const vertices = [];
                
        //         for (let i = 0; i < currLM.PLM.length; i++) {
        //             const x = currLM.PLM[i].x;
        //             const y = currLM.PLM[i].y;
        //             const z = currLM.PLM[i].z;
                    
        //             vertices.push( x, y, z );
        //         }
                
        //         this.pointsGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
                
        //         this.prevTime = currTime + currLM.dt;
        //         this.iter++;
        //         this.iter = this.iter % this.landmarksArray.length;
        //     }
        // }
    }

    render() {

        if(!this.renderer)
        return;

        this.renderer.render(this.scene, this.camera);

        if (this.gui)
            this.gui.render();
    }

    update(dt) {

        if (this.mixer && this.state)
        {
            this.mixer.update(dt);
           // this.animSkeleton = this.playAnimation.animateSkeleton(this.animSkeleton,dt)
            this.retargeting.retargetAnimation(this.srcBindPose, this.tgtBindPose, this.animSkeleton, this.skeletonHelper, true);
            for(var i = 0; i < this.skeletonHelper.bones.length; i++)
            {
                var bone = this.skeletonHelper.bones[i];
                var o = this.character.getObjectByName(bone.name);
                o.position.copy(bone.position);
                o.scale.copy(bone.scale);
                o.quaternion.copy(bone.quaternion);
                o.matrixWorldNeedsUpdate = true;
            }
        }
        this.gizmo.update(this.state, dt);
    }

    resize(width, height) {
        
        const aspect = width / height;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(aspect);
        this.renderer.setSize(width, height);
        this.gui.resize();
    }

    export() {
        
        BVHExporter.export(this.skeleton, this.animationClip, this.landmarksArray.length);
    }
};

export { Editor };