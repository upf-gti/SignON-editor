import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { createSkeleton, createAnimation } from "./skeleton.js";
import { BVHExporter } from "./bvh_exporter.js";
import { Gui } from "./gui.js";
import { Gizmo } from "./gizmo.js";
import { firstToUpperCase } from "./utils.js"

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
        this.skeletonHelper = null;
        
        this.points_geometry = null;
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
        scene.background = new THREE.Color(0xeeeeee);
        scene.add(new THREE.GridHelper(400, 10));
        
        const pixelRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
        let renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.outputEncoding = THREE.sRGBEncoding;
        canvasArea.appendChild(renderer.domElement);
        
        // camera
        let camera = new THREE.PerspectiveCamera(60, pixelRatio, 0.1, 1000);
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

        window.addEventListener( 'keydown', (function (e) {

            switch ( e.key ) {

                case " ": // Spacebar
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    let stateBtn = document.getElementById("state_btn");
                    stateBtn.click();
                    break;
            }

        }).bind(this));
    }

    getApp() {
        return this.__app;
    }

    loadInScene(project) {

        this.landmarksArray = project.landmarks;
        
        project.path = project.path || "models/bvh/victor.bvh";
        
        let skeleton = createSkeleton(this.landmarksArray);
        
        this.skeletonHelper = new THREE.SkeletonHelper(skeleton.bones[0]);
        this.skeletonHelper.skeleton = skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly

        const boneContainer = new THREE.Group();
        boneContainer.add(skeleton.bones[0]);
        
        this.scene.add(this.skeletonHelper);
        this.scene.add(boneContainer);
        
        var animation_clip = createAnimation(this.landmarksArray);
        
        // play animation
        this.mixer = new THREE.AnimationMixer(this.skeletonHelper);
        this.mixer.clipAction(animation_clip).setEffectiveWeight(1.0).play();
        this.mixer.update(this.clock.getDelta()); //do first iteration to update from T pose
        
        this.points_geometry = new THREE.BufferGeometry();
        
        const material = new THREE.PointsMaterial( { color: 0x880000 } );
        material.size = 0.025;
        
        const points = new THREE.Points( this.points_geometry, material );
        
        this.scene.add( points );
        
        BVHExporter.export(skeleton, animation_clip, this.landmarksArray.length);
        
        project.prepareData(this.mixer, animation_clip, skeleton);
        this.gui.loadProject(project);

        this.gizmo.begin(this.skeletonHelper);

        // set onclick function to play button
        let stateBtn = document.getElementById("state_btn");
        stateBtn.onclick = (e) => {
            this.state = !this.state;
            stateBtn.innerHTML = this.state ? "❚❚" : "►";
            stateBtn.style.border = "solid #268581";
        };

        let stopBtn = document.getElementById("stop_btn");
        stopBtn.onclick = (e) => {
            this.state = false;
            stateBtn.innerHTML = "►";
            stateBtn.style.removeProperty("border");
            this.stopAnimation();
        }
        
        this.animate();
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

    stopAnimation() {
        
        this.mixer.setTime(0.0);
        this.gizmo.updateBones(0.0);
    }
    
    animate() {
        
        requestAnimationFrame(this.animate.bind(this));

        this.render();
        this.update(this.clock.getDelta());

        // if (this.points_geometry == undefined || this.landmarksArray == undefined) {
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
                
        //         this.points_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
                
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
};

export { Editor };