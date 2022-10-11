import * as THREE from "three";
import { OrbitControls } from "./controls/OrbitControls.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { BVHExporter } from "./bvh_exporter.js";
import { createSkeleton, createAnimation, createAnimationFromRotations, updateThreeJSSkeleton, injectNewLandmarks } from "./skeleton.js";
import { Gui } from "./gui.js";
import { Gizmo } from "./gizmo.js";
import { linearInterpolation, cosineInterpolation } from "./utils.js";
import { OrientationHelper } from "./libs/OrientationHelper.js";
import { CanvasButtons } from "./ui.config.js";
import { AnimationGenerator } from "./faceAnalyser.js"
import { UTILS } from "./utils.js"
import { NN } from "./ML.js"
import { AnimationRetargeting } from './retargeting.js'
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';

let LINEAR = 0;
let COSINUS = 1;

class Editor {

    constructor(app) {

        this.clock = new THREE.Clock();
        this.loader = new BVHLoader();
        this.loader2 = new GLTFLoader();
        this.help = null;
        
        this.camera = null;
        this.controls = null;
        this.scene = null;
        this.gizmo = null;
        this.renderer = null;
        this.state = false; // defines how the animation starts (moving/static)

        this.boneUseDepthBuffer = false;
        this.showHUD = true;
        this.showSkin = true; // defines if the model skin has to be rendered
        this.animLoop = true;
        this.character = "";
        
        this.spotLight = null;

        this.skeletonHelper = null;
        this.skeleton = null;
        this.mixer = null;
        
        this.retargeting = new AnimationRetargeting();

        this.nn = new NN("data/ML/model.json");
        this.landmarksArray = [];
        
    	this.onDrawTimeline = null;
	    this.onDrawSettings = null;
        this.gui = new Gui(this);

        this.optimizeThreshold = 0.025;
        this.defaultTranslationSnapValue = 1;
        this.defaultRotationSnapValue = 30; // Degrees

        this.generator = new AnimationGenerator();
        this.morphTargetDictionary = null;
        this.bodyBS = null;
        this.eyelashesBS = null;
        // Keep "private"
        this.__app = app;

        this.interpolation = LINEAR;

        // Keep "private"
        this.__app = app;

        this.init();
    }
    
    init() {

        let canvasArea = document.getElementById("canvasarea");

        const CANVAS_WIDTH = canvasArea.clientWidth;
        const CANVAS_HEIGHT = canvasArea.clientHeight;

        // Create scene
        let scene = new THREE.Scene();
        scene.background = new THREE.Color( 0xa0a0a0 );
        scene.fog = new THREE.Fog( 0xa0a0a0, 10, 50 );
        
        const grid = new THREE.GridHelper(300, 50);
        grid.name = "Grid";
        scene.add(grid);

        const ground = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
        ground.rotation.x = - Math.PI / 2;
        ground.receiveShadow = true;
        scene.add( ground );
        
        // Lights
        const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
        hemiLight.position.set( 0, 20, 0 );
        scene.add( hemiLight );

        const dirLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
        dirLight.position.set( 3, 30, -50 );
        dirLight.castShadow = false;
        dirLight.shadow.camera.top = 2;
        dirLight.shadow.camera.bottom = -2;
        dirLight.shadow.camera.left = - 2;
        dirLight.shadow.camera.right = 2;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 200;
        scene.add( dirLight );

        let spotLight = new THREE.SpotLight(0xffa95c, 1);
        spotLight.position.set(-50,50,50);
        spotLight.castShadow = true;
        spotLight.shadow.bias = -0.0001;
        spotLight.shadow.mapSize.width = 2048;
        spotLight.shadow.mapSize.height = 2048;
        scene.add( spotLight );

        // Create 3D renderer
        const pixelRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
        let renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.outputEncoding = THREE.sRGBEncoding;
        canvasArea.appendChild(renderer.domElement);

        renderer.domElement.id = "webgl-canvas";
        renderer.domElement.setAttribute("tabIndex", 1);

        this.video = document.getElementById("recording");
        
        // Camera
        let camera = new THREE.PerspectiveCamera(60, pixelRatio, 0.1, 1000);
        window.camera = camera;
        let controls = new OrbitControls(camera, renderer.domElement);
        camera.position.set(0, 1, 2);
        controls.minDistance = 0.5;
        controls.maxDistance = 5;
        controls.target.set(0, 1, 0);
        controls.update();  

        // Orientation helper
        const orientationHelper = new OrientationHelper( camera, controls, { className: 'orientation-helper-dom' }, {
            px: '+X', nx: '-X', pz: '+Z', nz: '-Z', py: '+Y', ny: '-Y'
        });

        document.getElementById("canvasarea").prepend(orientationHelper.domElement);
        orientationHelper.domElement.style.display = "none";
        orientationHelper.addEventListener("click", (result) => {
            const side = result.normal.multiplyScalar(4);
            if(side.x != 0 || side.z != 0) side.y =controls.target.y;
            camera.position.set(side.x, side.y, side.z);
            camera.setRotationFromQuaternion( new THREE.Quaternion() );
            controls.update();
        });
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;
        this.spotLight = spotLight;
        this.orientationHelper = orientationHelper;

        this.video = document.getElementById("recording");
        this.video.startTime = 0;
        this.gizmo = new Gizmo(this);

        renderer.domElement.addEventListener( 'keydown', (e) => {
            switch ( e.key ) {
                case " ": // Spacebar
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    let stateBtn = document.getElementById("state_btn");
                    stateBtn.click();
                    break;
                case "Delete":
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.gui.timeline.deleteKeyFrame(e, null);
                    break;
                case "Escape":
                    this.gui.timeline.unSelect();
                    break;
                case 'z':
                    if(e.ctrlKey) {
                        this.gui.timeline.restoreState();
                    }
                    break;
            }
        } );
    }

    getApp() {
        return this.__app;
    }

    onPlay(element, e) {

        this.state = !this.state;
        element.innerHTML = "<i class='bi bi-" + (this.state ? "pause" : "play") + "-fill'></i>";
        element.style.border = "solid #268581";

        if(this.state) {
            this.mixer._actions[0].paused = false;
            if(this.mixerLm)
                this.mixerLm._actions[0].paused = false;
            this.gizmo.stop();
            this.gui.setBoneInfoState( false );
            (this.video.paused && this.video.sync) ? this.video.play() : 0;    
        } else{
            this.gui.setBoneInfoState( true );

            if(this.video.sync) {
                try{
                    this.video.paused ? 0 : this.video.pause();    
                }catch(ex) {
                    console.error("video warning");
                }
            }
        }

        element.blur();
    }
    
    onStop(element, e) {

        this.state = false;
        element.innerHTML = "<i class='bi bi-play-fill'></i>";
        element.style.removeProperty("border");
        this.gui.setBoneInfoState( true );
        this.stopAnimation();

        if(this.video.sync) {
            this.video.pause();
            this.video.currentTime = this.video.startTime;
        }
    }

    buildAnimation(landmarks) {

        // Remove loop mode for the display video
        this.video.sync = true;
        this.video.loop = false;

        let mode = landmarks[landmarks.length/2].FLM != undefined ? 'face' : false;  
        mode = landmarks[landmarks.length/2].PLM != undefined ? 'pose' : mode;
        // Trim
        this.landmarksArray = this.processLandmarks( landmarks, mode );

        // Canvas UI buttons
        this.createSceneUI();

        // Mode for loading the animation
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);

        if ( urlParams.get('load') == 'hard') {
    
            this.loader2.load( 'models/Eva_Y.glb', (glb) => {

                let model = glb.scene;
                model.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
                model.position.set(0, 0.75, 0);
                model.castShadow = true;
                
                model.traverse( (object) => {
                    if ( object.isMesh || object.isSkinnedMesh ) {
                        object.material.side = THREE.FrontSide;
                        object.frustumCulled = false;
                        object.castShadow = true;
                        object.receiveShadow = true;
                        if (object.name == "Eyelashes")
                            object.castShadow = false;
                        if(object.material.map)
                            object.material.map.anisotropy = 16; 
                        this.help = object.skeleton;
                        
                    } else if (object.isBone) {
                        object.scale.set(1.0, 1.0, 1.0);
                    }
                } );

            
                this.skeletonHelper = new THREE.SkeletonHelper(model);
                updateThreeJSSkeleton(this.help.bones);
                this.skeletonHelper.visible = true;
                this.skeletonHelper.name = "SkeletonHelper";
                this.skeletonHelper.skeleton = this.skeleton = createSkeleton();
                
                this.scene.add(this.skeletonHelper);
                this.scene.add(model);
                
                // load the actual animation to play
                this.mixer = new THREE.AnimationMixer( model );
                this.loader.load( 'models/ISL Thanks final.bvh' , (result) => {
                    this.animationClip = result.clip;
                    for (let i = 0; i < result.clip.tracks.length; i++) {
                        this.animationClip.tracks[i].name = this.animationClip.tracks[i].name.replaceAll(/[\]\[]/g,"").replaceAll(".bones","");
                    }
                    this.gui.loadSkeletonClip(this.animationClip);
                    this.mixer.clipAction( this.animationClip ).setEffectiveWeight( 1.0 ).play();
                    this.mixer.update(0);
                    this.gizmo.begin(this.skeletonHelper);
                    this.setBoneSize(0.2);
                    this.animate();
                    $('#loading').fadeOut();
                } );
            
            } );

        } else if ( urlParams.get('load') == 'NN' ) { //|| urlParams.get('load') == undefined ) {

            // Convert landmarks into an animation
            const quatData = this.nn.getQuaternions();

            // Load the source model
            UTILS.loadGLTF("models/t_pose.glb", (gltf) => {
                
                let auxModel = gltf.scene;
                auxModel.visible = true; // change to false
                
                // Convert landmarks into an animation
                let auxAnimation = createAnimationFromRotations(this.clipName, this.nn);
                this.retargeting.loadAnimation(auxModel, auxAnimation);
                
                // Load the target model (Eva) 
                UTILS.loadGLTF("models/Eva_Y.glb", (gltf) => {
                    
                    let model = gltf.scene;
                    model.visible = true;
                    model.castShadow = true;
                    
                    // correct model
                    model.position.set(0,0.85,0);
                    model.rotateOnAxis(new THREE.Vector3(1,0,0), -Math.PI/2);
                    
                    this.animationClip = this.retargeting.createAnimation(model);
                    this.mixer = new THREE.AnimationMixer(model);
                    this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
                    
                    // guizmo stuff
                    updateThreeJSSkeleton(this.retargeting.tgtBindPose);
                    this.skeletonHelper = this.retargeting.tgtSkeletonHelper;
                    this.skeletonHelper.name = "SkeletonHelper";
                    this.skeletonHelper.skeleton = this.skeleton = createSkeleton();

                    this.scene.add( model );
                    this.scene.add( this.skeletonHelper );

                    this.gui.loadSkeletonClip(this.animationClip);
                    this.gizmo.begin(this.skeletonHelper);
                    this.setBoneSize(0.2);
                    this.animate();
                    $('#loading').fadeOut();
                });
            });
        } else if ( urlParams.get('load') == 'face' || mode == 'face') { //|| urlParams.get('load') == undefined ) {
                                       
            // Load the target model (Eva) 
            UTILS.loadGLTF("models/Eva_Y.glb", (gltf) => {
                
                let model = gltf.scene;
                model.visible = true;
                model.castShadow = true;
                
                // correct model
                model.position.set(0,0.85,0);
                model.rotateOnAxis(new THREE.Vector3(1,0,0), -Math.PI/2);
                
                //face blend shapes
                this.bodyBS = model.getObjectByName( 'Body' );
                this.eyelashesBS = model.getObjectByName( 'Eyelashes' );
                this.morphTargetDictionary = this.bodyBS.morphTargetDictionary;

                this.animationClip = this.generator.createFacialAnimation("facial_anim", this.landmarksArray, this.bodyBS.morphTargetDictionary);
                this.mixer = new THREE.AnimationMixer(model);
                this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
                
                // guizmo stuff
                this.skeletonHelper = new THREE.SkeletonHelper(model);
                this.skeletonHelper.name = "SkeletonHelper";
                this.skeletonHelper.skeleton = this.skeleton = new THREE.Skeleton(this.skeletonHelper.bones);

                this.scene.add( model );
                this.scene.add( this.skeletonHelper );

                this.gui.loadBlendshapesClip(this.animationClip, 'facialAnimation');
                this.gizmo.begin(this.skeletonHelper);
                this.setBoneSize(0.2);
                this.animate();
                $('#loading').fadeOut();
            });
        }
    }

    processLandmarks( landmarks, mode = 'pose' ) {
        
        const [startTime, endTime] = this.trimTimes;

        // Video is non duration-complete
        if(endTime) {

            let totalDt = 0;
            let index = 1;
    
            // remove starting frames
            while( totalDt < startTime ) {
                const lm = landmarks[index];
                totalDt += lm.dt * 0.001;
                index++;
            }
    
            if(totalDt > 0) {
                landmarks = landmarks.slice(index - 1);
            }
    
            // remove ending frames
            index = 1;
            while( totalDt < endTime && index < landmarks.length ) {
                const lm = landmarks[index];
                totalDt += lm.dt * 0.001;
                index++;
            }
    
            landmarks = landmarks.slice(0, index - 1);
        }
        if( mode == 'pose')
            this.nn.loadLandmarks( landmarks, offsets => {
                this.trimTimes[0] += offsets[0];
                this.trimTimes[1] += offsets[1];

                this.video.startTime = this.trimTimes[0];
                this.video.onended = function() {
                    this.currentTime = this.startTime;
                    this.play();
                };
            } );
   
        return landmarks;
    }

    loadAnimation( animation ) {

        // Canvas UI buttons
        this.createSceneUI();
        // Remove loop mode for the display video
        this.video.sync = true;
        this.video.loop = false;
        const innerOnLoad = result => {

            result.clip.name = UTILS.removeExtension(this.clipName);

            // Load the target model (Eva) 
            UTILS.loadGLTF("models/Eva_Y.glb", (gltf) => {
                
                let model = gltf.scene;
                model.visible = true;

                model.traverse( o => {
                    if (o.isMesh || o.isSkinnedMesh) {
                        o.castShadow = true;
                        o.receiveShadow = true;
                        o.frustumCulled = false;
                    }
                } );
                
                // correct model
                model.position.set(0,0.85,0);
                model.rotateOnAxis(new THREE.Vector3(1,0,0), -Math.PI/2);
                
                this.animationClip = result.clip;
                this.mixer = new THREE.AnimationMixer(model);
                this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
                this.mixer.update(0.); // Do first iteration to update from T pose

                //face blend shapes
                this.bodyBS = model.getObjectByName( 'Body' );
                this.eyelashesBS = model.getObjectByName( 'Eyelashes' );
                this.morphTargetDictionary = this.bodyBS.morphTargetDictionary;

                // guizmo stuff
                this.skeletonHelper = new THREE.SkeletonHelper(model);
                this.skeletonHelper.name = "SkeletonHelper";
                this.skeletonHelper.skeleton = this.skeleton = result.skeleton;

                this.scene.add( model );
                this.scene.add( this.skeletonHelper );

                if(result.skeleton)
                    this.gui.loadSkeletonClip(this.animationClip);
                else
                    this.gui.loadBlendshapesClip(this.animationClip);

                this.gizmo.begin(this.skeletonHelper);
                this.setBoneSize(0.2);
                this.animate();
                
                
                let positions = [];
                const geometry = new THREE.SphereGeometry(0.005, 32, 16 );
                const material = new THREE.MeshBasicMaterial( { color: 0x4287f5 } );
                
                const group = new THREE.Group();

                for ( let lm in result.landmarksClip.tracks ) {
                    const sphere = new THREE.Mesh( geometry, material );
                    sphere.position.set( result.landmarksClip.tracks[lm].values[0], result.landmarksClip.tracks[lm][1], result.landmarksClip.tracks[lm][2] );
                    sphere.name = result.landmarksClip.tracks[lm].name.replace('.position', '');
                    group.add( sphere );
                }
                this.scene.add( group );
                this.mixerLm = new THREE.AnimationMixer(group);
                this.mixerLm.clipAction(result.landmarksClip).setEffectiveWeight(1.0).play();
                this.mixerLm.update(0.); // Do first iteration to update from T pose
                $('#loading').fadeOut();
            });

        };
        var reader = new FileReader();
        if(animation.type == "text/csv"){
            reader.onload = (e) => {
                const text = e.currentTarget.result;
                const parsedData = UTILS.csvToArray( text );
                const data = this.generator.createFacialAnimationFromData( parsedData, this.morphTargetDictionary );
                const landmarks = this.generator.create3DLandmarksAnimation( parsedData );
                innerOnLoad( {clip : data, landmarksClip: landmarks} );
            };
        } else {
            reader.onload = (e) => {
                const text = e.currentTarget.result;
                const data = this.loader.parse( text );
                innerOnLoad(data);
            };
        }
        reader.readAsText(animation);
    }

    createSceneUI() {

        $(this.orientationHelper.domElement).show();

        let canvasArea = document.getElementById("canvasarea");
        let timelineCanvas = document.getElementById("timelineCanvas");
        const HEIGHT = canvasArea.clientHeight / 2
                        - timelineCanvas.clientHeight
                        - (CanvasButtons.items.length / 2) * 30;

        for( let i = 0; i < CanvasButtons.items.length; ++i ) {

            const b = CanvasButtons.items[i];
            let content = null;

            if(b.icon) {

                switch(b.type) {
                    case 'image': 
                        content = document.createElement("img");
                        content.style.opacity = 0.75;
                        content.src = b.icon;
                        break;
                    default: 
                        content = document.createElement("i");
                        content.className = 'bi bi-' + b.icon;
                }
            }

            const btn = document.createElement('button');
            btn.title = b.name;
            btn.className = "litebutton";
            btn.style = 'z-index: 2; position: absolute; right: 15px; font-size: 1.25em; width:25px; height: 25px';
            btn.style.marginTop = (HEIGHT + i * 30) + "px";
            btn.appendChild(content);
            document.getElementById("canvasarea").prepend(btn);

            CanvasButtons.onCreate.bind(this, b, content)();

            btn.addEventListener("click", CanvasButtons.onChange.bind(this, b, content) );

            if(b.callback)
                btn.addEventListener("click", b.callback.bind(this) );
        }
    }

    updateGUI() {
        this.gui.updateSidePanel();
    }

    getSelectedBone() {
        const idx = this.gizmo.selectedBone;
        return idx == undefined ? idx : this.skeletonHelper.bones[ idx ];
    }

    setBoneSize(newSize) {
        const geometry = this.gizmo.bonePoints.geometry;
        const positionAttribute = geometry.getAttribute( 'position' );
        this.gizmo.bonePoints.geometry.setAttribute( 'size', new THREE.Float32BufferAttribute( new Array(positionAttribute.count).fill(newSize), 1 ) );
        this.gizmo.raycaster.params.Points.threshold = newSize/10;
    }

    setSelectedBone( name ) {
        if(!this.gizmo)
        throw("No gizmo attached to scene");

        this.gizmo.setBone(name);
        this.gizmo.mustUpdate = true;
    }

    getGizmoMode() {
        return UTILS.firstToUpperCase( this.gizmo.transform.mode );
    }

    setGizmoMode( mode ) {
        if(!mode.length)
        throw("Invalid Gizmo mode");
        
        this.gizmo.setMode( mode.toLowerCase() );
    }

    getGizmoSpace() {
        return UTILS.firstToUpperCase( this.gizmo.transform.space );
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

    setTime(t, force) {

        // Don't change time if playing
        if(this.state && !force)
            return;
            
        if(this.mixer)
            this.mixer.setTime(t);
        
        //3D landmarks mixer
        if(this.mixerLm)
            this.mixerLm.setTime(t);

        this.gizmo.updateBones(0.0);
        this.gui.updateBoneProperties();
            
        let BS = this.morphTargetDictionary[this.gui.timeline.selected_bone];
        const morph = this.bodyBS.morphTargetInfluences[BS];
        if($(".morph-value")) $(".morph-value")[0].setValue(morph);

        // Update video
        this.video.currentTime = this.video.startTime + t;
        if(this.state && force) {
            try{
                this.video.play();
            }catch(ex) {
                console.error("video warning");
            }
        }
    }
    updateTracks(morph, force) {

        if(!force)
        return;

        let timeline = this.gui.timeline;

        if(!timeline._lastKeyFramesSelected.length)
        return;

        let [name, trackIndex, keyFrameIndex] = timeline._lastKeyFramesSelected[0];
        let track = timeline.getTrack(timeline._lastKeyFramesSelected[0]);
        
        let BS = this.morphTargetDictionary[this.gui.timeline.selected_bone];
        const value = this.bodyBS.morphTargetInfluences[BS];

        let start = track.dim * keyFrameIndex;
        

        if(!value)
            return;

        const idx = track.clip_idx;
        track.edited[ keyFrameIndex ] = true;

        this.animationClip.tracks[ idx ].values[ start ] = value;

        // Update animation interpolants
        this.updateAnimationAction( idx );
        
    }

    onAnimationEnded() {

        if(this.animLoop) {
            this.setTime(0.0, true);
        } else {
            this.mixer.setTime(0);
            this.mixer._actions[0].paused = true;
            let stateBtn = document.getElementById("state_btn");
            stateBtn.click();

            this.video.pause();
            this.video.currentTime = this.video.startTime;
        }
    }

    stopAnimation() {
        
        this.mixer.setTime(0.0);
        if(this.mixerLm)
            this.mixerLm.setTime(0.0);
        this.gizmo.updateBones(0.0);
    }

    updateAnimationAction(idx, mixer = this.mixer, animationClip = this.animationClip) {

        if(!mixer._actions.length || mixer._actions[0]._clip != animationClip) 
            return;

        const track = animationClip.tracks[idx];

        // Update times
        mixer._actions[0]._interpolants[idx].parameterPositions = track.times;
        // Update values
        mixer._actions[0]._interpolants[idx].sampleValues = track.values;
    }
    
    cleanTracks(excludeList) {

        if(!this.animationClip)
        return;

        for( let i = 0; i < this.animationClip.tracks.length; ++i ) {

            const track = this.animationClip.tracks[i];
            const [boneName, type] = this.gui.timeline.getTrackName(track.name);

            if(excludeList && excludeList.indexOf( boneName ) != -1)
            continue;

            track.times = new Float32Array( [track.times[0]] );
            track.values = track.values.slice(0, type === 'quaternion' ? 4 : 3);

            this.updateAnimationAction(i);
            this.gui.timeline.onPreProcessTrack( track );
        }
    }

    optimizeTracks() {

        if(!this.animationClip)
        return;

        for( let i = 0; i < this.animationClip.tracks.length; ++i ) {
            const track = this.animationClip.tracks[i];
            track.optimize( this.optimizeThreshold );
            this.updateAnimationAction(i);

            this.gui.timeline.onPreProcessTrack( track );
        }
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
            this.gui.updateBoneProperties();
            /*if (this.pointsGeometry != undefined && this.landmarksArray != undefined) {
                var currLM = this.landmarksArray[this.iter];
                var currTime = Date.now();
                var et = (currTime - this.prevTime);
                if (et > currLM.dt) {
                    
                    const vertices = [];
                    
                    for (let i = 0; i < currLM.PLM.length; i++) {
                        const x = currLM.PLM[i].x;
                        const y = currLM.PLM[i].y;
                        const z = currLM.PLM[i].z;
                        
                        vertices.push( x, y, z );
                    }
                    
                    this.pointsGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
                    
                    this.prevTime = currTime + currLM.dt;
                    this.iter++;
                    this.iter = this.iter % this.landmarksArray.length;
                }
               
            }*/
            
        
       
            // if (this.pointsGeometry != undefined && this.landmarksArray != undefined) {
            //     var currLM = this.landmarksArray[this.iter];
            //     var currTime = Date.now();
            //     var et = (currTime - this.prevTime);
            //     if (et > currLM.dt/ 100.0) {
                    
            //         const vertices = [];
                    
            //         for (let i = 0; i < currLM.FLM.length; i++) {
                        
            //                 const x = currLM.FLM[i].x/2;
            //                 const y = currLM.FLM[i].y/2+0.8;
            //                 const z = currLM.FLM[i].z/2;
                        
            //                 vertices.push( x, y, z );
                        
            //         }
            //         /*for (let i = 0; i < currLM.PLM.length; i++) {
            //             const x = currLM.PLM[i].x;
            //             const y = currLM.PLM[i].y;
            //             const z = currLM.PLM[i].z;
                        
            //             vertices.push( x, y, z );
            //         }*/
            //        // this.applyBlendShapes(currLM.FLM, this.iter);
                    
                    
            //         this.pointsGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
                    
            //         this.prevTime = currTime + currLM.dt/ 100.0;
            //         this.iter++;
            //         this.iter = this.iter % this.landmarksArray.length;
            //     }
               
            // }
            //3D landmarks mixer
            if(this.mixerLm)
                this.mixerLm.update(dt);
        }


        this.gizmo.update(this.state, dt);
    }
    
    applyBlendShapes(facialLandmarks, t){
        
        let neutralFace = (t<10) ? true : false;
                    
        let mouthBSw = this.mouthAnalyser.update({"points":  facialLandmarks, "scale":1, "neutral": neutralFace});
        let browsBSw = this.browsAnalyser.update({"points":  facialLandmarks, "scale":1, "neutral": neutralFace});
        let eyelidsBSw = this.eyelidsAnalyser.update({"points":  facialLandmarks, "scale":1, "neutral": neutralFace});
        
        //MouthOpen
        let moIdx = this.bodyBS.morphTargetDictionary["MouthOpen"];
        //MouthLeft
        let mlIdx = this.bodyBS.morphTargetDictionary["Midmouth_Left"];
        //MouthRight 
        let mrIdx = this.bodyBS.morphTargetDictionary["Midmouth_Right"]; 
        //MouthLeftRaise
        let mlrIdx = this.bodyBS.morphTargetDictionary["Smile_Left"];
        //MouthRightRaise
        let mrrIdx = this.bodyBS.morphTargetDictionary["Smile_Right"];

        //EyebrowDownLeft
        let bdlIdx = this.bodyBS.morphTargetDictionary["BrowsDown_Left"];
        //EyebrowDownRight
        let bdrIdx = this.bodyBS.morphTargetDictionary["BrowsDown_Right"];
        //EyebrowUpLeft
        let bulIdx = this.bodyBS.morphTargetDictionary["BrowsUp_Left"];
        //EyebrowUpRight
        let burIdx = this.bodyBS.morphTargetDictionary["BrowsUp_Right"];
        
        let s = 0.8;
        switch(this.interpolation){
            case LINEAR:
                //MouthOpen
                this.bodyBS.morphTargetInfluences[moIdx]  = this.eyelashesBS.morphTargetInfluences[moIdx]  = linearInterpolation(this.bodyBS.morphTargetInfluences[moIdx],  mouthBSw["MOUTH_OPEN"], s);
                //MouthLeft
                this.bodyBS.morphTargetInfluences[mlIdx]  = this.eyelashesBS.morphTargetInfluences[mlIdx]  = linearInterpolation(this.bodyBS.morphTargetInfluences[mlIdx],  mouthBSw["MOUTH_LEFT"], s);
                //MouthRight 
                this.bodyBS.morphTargetInfluences[mrIdx]  = this.eyelashesBS.morphTargetInfluences[mrIdx]  = linearInterpolation(this.bodyBS.morphTargetInfluences[mrIdx],  mouthBSw["MOUTH_RIGHT"], s);
                //MouthLeftRaise
                this.bodyBS.morphTargetInfluences[mlrIdx] = this.eyelashesBS.morphTargetInfluences[mlrIdx] = linearInterpolation(this.bodyBS.morphTargetInfluences[mlrIdx], mouthBSw["MOUTH_LEFT_RAISE"], s);
                //MouthRightRaise
                this.bodyBS.morphTargetInfluences[mrrIdx] = this.eyelashesBS.morphTargetInfluences[mrrIdx] = linearInterpolation(this.bodyBS.morphTargetInfluences[mrrIdx], mouthBSw["MOUTH_RIGHT_RAISE"], s);

                //EyebrowDownLeft
                this.bodyBS.morphTargetInfluences[bdlIdx] = this.eyelashesBS.morphTargetInfluences[bdlIdx] = linearInterpolation(this.bodyBS.morphTargetInfluences[bdlIdx], browsBSw["EYEBROW_DOWN_L"], s);
                //EyebrowDownRight
                this.bodyBS.morphTargetInfluences[bdrIdx] = this.eyelashesBS.morphTargetInfluences[bdrIdx] = linearInterpolation(this.bodyBS.morphTargetInfluences[bdrIdx], browsBSw["EYEBROW_DOWN_R"], s);
                //EyebrowUpLeft
                this.bodyBS.morphTargetInfluences[bulIdx] = this.eyelashesBS.morphTargetInfluences[bulIdx] = linearInterpolation(this.bodyBS.morphTargetInfluences[bulIdx], browsBSw["EYEBROW_UP_L"], s);
                //EyebrowUpRight
                this.bodyBS.morphTargetInfluences[burIdx] = this.eyelashesBS.morphTargetInfluences[burIdx] = linearInterpolation(this.bodyBS.morphTargetInfluences[burIdx], browsBSw["EYEBROW_UP_R"], s);

                break;

            case COSINUS:
                //MouthOpen
                this.bodyBS.morphTargetInfluences[moIdx] = this.eyelashesBS.morphTargetInfluences[moIdx] = cosineInterpolation(this.bodyBS.morphTargetInfluences[moIdx] , mouthBSw["MOUTH_OPEN"], s);
                //MouthLeft
                this.bodyBS.morphTargetInfluences[mlIdx] = this.eyelashesBS.morphTargetInfluences[mlIdx] = cosineInterpolation(this.bodyBS.morphTargetInfluences[mlIdx], mouthBSw["MOUTH_LEFT"], s);
                //MouthRight 
                this.bodyBS.morphTargetInfluences[mrIdx] = this.eyelashesBS.morphTargetInfluences[mrIdx] = cosineInterpolation(this.bodyBS.morphTargetInfluences[mrIdx], mouthBSw["MOUTH_RIGHT"], s);
                //MouthLeftRaise
                this.bodyBS.morphTargetInfluences[mlrIdx] = this.eyelashesBS.morphTargetInfluences[mlrIdx] = cosineInterpolation(this.bodyBS.morphTargetInfluences[mlrIdx], mouthBSw["MOUTH_LEFT_RAISE"], s);
                //MouthRightRaise
                this.bodyBS.morphTargetInfluences[mrrIdx] = this.eyelashesBS.morphTargetInfluences[mrrIdx] = cosineInterpolation(this.bodyBS.morphTargetInfluences[mrrIdx], mouthBSw["MOUTH_RIGHT_RAISE"], s);

                //EyebrowDownLeft
                this.bodyBS.morphTargetInfluences[bdlIdx] = this.eyelashesBS.morphTargetInfluences[bdlIdx] = cosineInterpolation(this.bodyBS.morphTargetInfluences[bdlIdx] , browsBSw["EYEBROW_DOWN_L"], s);
                //EyebrowDownRight
                this.bodyBS.morphTargetInfluences[bdrIdx] = this.eyelashesBS.morphTargetInfluences[bdrIdx] = cosineInterpolation(this.bodyBS.morphTargetInfluences[bdrIdx] , browsBSw["EYEBROW_DOWN_R"], s);
                //EyebrowUpLeft
                this.bodyBS.morphTargetInfluences[bulIdx] = this.eyelashesBS.morphTargetInfluences[bulIdx] = cosineInterpolation(this.bodyBS.morphTargetInfluences[bulIdx] , browsBSw["EYEBROW_UP_L"], s);
                //EyebrowUpRight
                this.bodyBS.morphTargetInfluences[burIdx] = this.eyelashesBS.morphTargetInfluences[burIdx] = cosineInterpolation(this.bodyBS.morphTargetInfluences[burIdx] , browsBSw["EYEBROW_UP_R"], s);

                break;
        }
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
        BVHExporter.export(this.mixer, this.skeletonHelper, this.animationClip);
    }

    showPreview() {
        
        BVHExporter.copyToLocalStorage(this.mixer, this.skeletonHelper, this.animationClip);
        const url = "https://webglstudio.org/users/arodriguez/demos/animationLoader/?load=three_webgl_bvhpreview";
        window.open(url, '_blank').focus();
    }
};

export { Editor };