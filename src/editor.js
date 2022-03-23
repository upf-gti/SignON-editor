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

        this.mixer = null;
        this.mixerHelper = null;
        this.skeletonHelper = null;
        this.skeleton = null;
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

        this.init();
    }
    
    init() {

        let canvasArea = document.getElementById("canvasarea");

        const CANVAS_WIDTH = canvasArea.clientWidth;
        const CANVAS_HEIGHT = canvasArea.clientHeight;

        let scene = new THREE.Scene();
        scene.background = new THREE.Color(0x777777);
        scene.add(new THREE.GridHelper(300, 20));
        
        const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
        hemiLight.position.set( 0, 20, 0 );
        scene.add( hemiLight );

        const dirLight = new THREE.DirectionalLight( 0xffffff );
        dirLight.position.set( - 3, 10, - 10 );
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 2;
        dirLight.shadow.camera.bottom = - 2;
        dirLight.shadow.camera.left = - 2;
        dirLight.shadow.camera.right = 2;
        dirLight.shadow.camera.near = 0.01;
        dirLight.shadow.camera.far = 40;
        scene.add( dirLight );

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
        camera.position.set(0.5, 2, -3);
        controls.target.set(1.2, 1.5, 0);
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

        $.getJSON( "data/Taunt.json", function( data ) {
          
            that.landmarksArray = [];
            project.landmarks = [];
                    
            // Load the model (Eva)  
            that.loadGLTF("models/Kate-tpose.glb", (gltf) => {
            
                let model = gltf.scene;
                model.castShadow = true;
                
                model.traverse(  ( object ) => {
                    if ( object.isMesh ||object.isSkinnedMesh ) {
                        object.castShadow = true;
                        object.receiveShadow = true;
                        
                    }
                    if (object.isBone) {
                        object.scale.set(1.0, 1.0, 1.0);
                    }
                } );
                //model.rotateX(-Math.PI/4)
                that.skeletonHelper = new THREE.SkeletonHelper(model);
                updateThreeJSSkeleton(that.skeletonHelper.bones);
                let skeleton = createSkeleton();
                that.skeletonHelper.skeleton = skeleton;
                const boneContainer = new THREE.Group();
                boneContainer.add(skeleton.bones[0]);
                that.scene.add(that.skeletonHelper);
                that.scene.add(boneContainer);
                that.scene.add( model );

                that.animationClip = createAnimationFromRotations("Eva", data);

                that.mixer = new THREE.AnimationMixer(model);
                that.mixer.clipAction(that.animationClip).setEffectiveWeight(1.0).play();
                that.mixer.update(that.clock.getDelta()); //do first iteration to update from T pose
                that.pointsGeometry = new THREE.BufferGeometry();
            
                const material = new THREE.PointsMaterial( { color: 0x880000 } );
                material.size = 0.025;
                
                const points = new THREE.Points( that.pointsGeometry, material );
                
                that.scene.add( points );
        
                project.prepareData(that.mixer, that.animationClip, skeleton);
                that.gui.loadProject(project);
        
                that.gizmo.begin(that.skeletonHelper);
                
                that.animate();

                that.skeleton = skeleton;
                //that.export();
            });

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
            this.mixer.update(dt);

     
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