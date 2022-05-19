import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { MiniGLTFLoader } from "./loaders/GLTFLoader.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { BVHExporter } from "./bvh_exporter.js";
import { createSkeleton, createAnimation, createAnimationFromRotations, updateThreeJSSkeleton, injectNewLandmarks } from "./skeleton.js";
import { Gui } from "./gui.js";
import { Gizmo } from "./gizmo.js";
import { firstToUpperCase, linearInterpolation, cosineInterpolation } from "./utils.js";
import { OrientationHelper } from "./libs/OrientationHelper.js";
import { CanvasButtons } from "./ui.config.js";
import { AnimationGenerator } from "./faceAnalyser.js"

let LINEAR = 0;
let COSINUS = 1;

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

        this.showHUD = true;
        this.showSkin = true; // defines if the model skin has to be rendered
        this.character = "";

        this.mixer = null;
        this.mixerHelper = null;
        this.skeletonHelper = null;
        
        this.pointsGeometry = null;
        this.landmarksArray = [];
        this.prevTime = this.iter = 0;
    	this.onDrawTimeline = null;
	    this.onDrawSettings = null;
        this.gui = new Gui(this);

        this.defaultTranslationSnapValue = 1;
        this.defaultRotationSnapValue = 30; // Degrees

        this.generator = new AnimationGenerator();
        this.morphTargetDictionary = null;
        this.bodyBS = null;
        this.eyelashesBS = null;
        // Keep "private"
        this.__app = app;

        this.interpolation = LINEAR;

        this.init();
    }
    
    init() {

        let canvasArea = this.canvas = document.getElementById("canvasarea");

        const CANVAS_WIDTH = canvasArea.clientWidth;
        const CANVAS_HEIGHT = canvasArea.clientHeight;

        
        let scene = new THREE.Scene();
        scene.background = new THREE.Color( 0xa0a0a0 );
        const grid = new THREE.GridHelper(300, 50);
        grid.name = "Grid";
        scene.add(grid);
        
        // ground
        const ground = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
        ground.rotation.x = - Math.PI / 2;
        ground.receiveShadow = true;
        scene.add( ground );
        
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
        let camera = new THREE.PerspectiveCamera(60, pixelRatio, 0.1, 1000);
        window.camera = camera;
        let controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = 1;
        controls.maxDistance = 7;
        camera.position.set(0.5, 2, 3);
        controls.update();  

        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;

        this.gizmo = new Gizmo(this);
        this.setGizmoSize( 0.5 )
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
        });
    }

    getApp() {
        return this.__app;
    }
    
    loadGLTF(animationFile, onLoaded) {
        
        $('#loading').fadeIn();
        const gltfLoader = new MiniGLTFLoader();

        if(typeof(Worker) !== 'undefined') {
            const worker = new Worker("src/workers/loader.js?filename=" + animationFile, { type: "module" });
            worker.onmessage = function (event) {
                gltfLoader.parse(event.data, animationFile, onLoaded);
                worker.terminate();
            };
        } else {
            // browser does not support Web Workers
            // call regular load function
            gltfLoader.load( animationFile, onLoaded );
        }
    }

    loadInScene(project) {

        this.project = project;
        this.landmarksArray = project.landmarks;
        
        project.path = project.path || "models/bvh/victor.bvh";

        this.processLandmarks(project);

        // Orientation helper
        const orientationHelper = new OrientationHelper( this.camera, this.controls, { className: 'orientation-helper-dom' }, {
            px: '+X', nx: '-X', pz: '+Z', nz: '-Z', py: '+Y', ny: '-Y'
        });
        document.getElementById("canvasarea").prepend(orientationHelper.domElement);
        orientationHelper.addEventListener("click", (result) => {
            const side = result.normal.multiplyScalar(5);
            if(side.x != 0 || side.z != 0) side.y = this.controls.target.y;
            this.camera.position.set(side.x, side.y, side.z);
            this.camera.setRotationFromQuaternion( new THREE.Quaternion() );
            this.controls.update();
        });

        // set onclick function to play button
        let stateBtn = document.getElementById("state_btn");
        let video = document.getElementById("recording");
        video.loop = false;
        stateBtn.onclick = (e) => {
            this.state = !this.state;
            stateBtn.innerHTML = "<i class='bi bi-" + (this.state ? "pause" : "play") + "-fill'></i>";
            stateBtn.style.border = "solid #268581";
            if(this.state) {
                this.gizmo.stop()
                video.paused ? video.play() : 0;    
            } else{
                try{
                    video.paused ? 0 : video.pause();    
                }catch(ex) {
                    console.error("video warning");
                }
            }
            stateBtn.blur();
        };

        let stopBtn = document.getElementById("stop_btn");
        stopBtn.onclick = (e) => {
            this.state = false;
            stateBtn.innerHTML = "<i class='bi bi-play-fill'></i>";
            stateBtn.style.removeProperty("border");
            this.stopAnimation();
            video.pause();
            video.currentTime = video.startTime;
        }

        this.appendCanvasButtons();

        // To debug landmarks (Not the gizmo ones)
        this.pointsGeometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial( { color: 0x880000 } );
        material.size = 0.015;
        const points = new THREE.Points( this.pointsGeometry, material );
        points.frustumCulled = false;
        this.scene.add( points );

        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);

        if( urlParams.get('load') == 'skin' || urlParams.get('load') == undefined ) {

            this.loadGLTF("models/Eva_Y.glb", gltf => {
            
                let model = gltf.scene;
                this.character = model.name;
                model.castShadow = true;

                model.traverse(  ( object ) => {
                    if ( object.isMesh || object.isSkinnedMesh ) {
                        object.castShadow = true;
                        object.receiveShadow = true;
                        object.frustumCulled = false;

                        if(object.material.map) object.material.map.anisotropy = 16;                     
                    }
                });
                
               /* this.skeletonHelper = new THREE.SkeletonHelper(model);
                this.skeletonHelper.name = "SkeletonHelper";
                this.skeletonHelper.visible = false;

                model.children[0].setRotationFromQuaternion(new THREE.Quaternion());
                
                for (var bone_id in this.skeletonHelper.bones) {
                    this.skeletonHelper.bones[bone_id].setRotationFromQuaternion(new THREE.Quaternion());
                }
                
                updateThreeJSSkeleton(this.skeletonHelper.bones);
                let skeleton = createSkeleton();
                injectNewLandmarks(this.landmarksArray);
                this.skeleton = skeleton;
                this.skeletonHelper.skeleton = skeleton;
                
                const boneContainer = new THREE.Group();
                boneContainer.add(skeleton.bones[0]);
                this.scene.add(this.skeletonHelper);
                this.scene.add(boneContainer);*/
                this.scene.add( model );

                // Play animation
                
                /*this.animationClip = createAnimation("Eva", this.landmarksArray);
                // this.animationClip = gltf.animations[0];
                this.mixer = new THREE.AnimationMixer(model);
                this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
                //this.mixer.update(this.clock.getDelta()); // Do first iteration to update from T pose
        
                project.prepareData(this.mixer, this.animationClip, skeleton, this.video);
                this.gui.loadProject(project);
                
                */
                
                this.bodyBS = model.getObjectByName( 'Body' );
				this.eyelashesBS = model.getObjectByName( 'Eyelashes' );
                this.morphTargetDictionary = this.bodyBS.morphTargetDictionary;

                model.rotateOnAxis( new THREE.Vector3(1,0,0), -Math.PI/2);
                // project.landmarks = [];

                this.animationClip = this.generator.createFacialAnimation("facial_anim", this.landmarksArray, this.bodyBS.morphTargetDictionary);

                this.mixer = new THREE.AnimationMixer(model);
                this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
                
                project.prepareData(this.mixer, this.animationClip, this.morphTargetDictionary, this.video);
                this.gui.loadMorphTargetsProject(project);

                this.animate();
                $('#loading').fadeOut();
            });

        } else if( urlParams.get('load') == 'ai' ) {

            let that = this;

            $.getJSON( "data/Taunt.json", function( data ) {
          
                that.landmarksArray = [];
                project.landmarks = [];
                        
                // Load the model (Eva)  
                that.loadGLTF("models/t_pose.glb", (gltf) => {
                
                    let model = gltf.scene;
                    model.castShadow = true;

                    model.children[0].setRotationFromQuaternion(new THREE.Quaternion());
                
                    that.skeletonHelper = new THREE.SkeletonHelper(model);
                    that.skeletonHelper.name = "SkeletonHelper";

                    for (var bone_id in that.skeletonHelper.bones) {
                        that.skeletonHelper.bones[bone_id].setRotationFromQuaternion(new THREE.Quaternion());
                    }
                    
                    model.traverse(  ( object ) => {
                        if ( object.isMesh ||object.isSkinnedMesh ) {
                            object.castShadow = true;
                            object.receiveShadow = true;
                            
                        }
                        if (object.isBone) {
                            object.scale.set(1.0, 1.0, 1.0);
                        }
                    } );
                    
                    updateThreeJSSkeleton(that.skeletonHelper.bones);
                    let skeleton = createSkeleton();
                    that.skeleton = skeleton;
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
            
                    project.prepareData(that.mixer, that.animationClip, skeleton);
                    that.gui.loadProject(project);
                    that.gizmo.begin(that.skeletonHelper);
                    
                    $('#loading').fadeOut();
                    that.animate();
                });
    
            });
        }
        else if( urlParams.get('load') == 'simple' ) {

            // 3D model is always needed to extract the skeleton, commenteds for now 

            let skeleton = createSkeleton(this.landmarksArray);
            this.skeleton = skeleton;

            this.skeletonHelper = new THREE.SkeletonHelper(skeleton.bones[0]);
            this.skeletonHelper.skeleton = skeleton; // Allow animation mixer to bind to THREE.SkeletonHelper directly

            const boneContainer = new THREE.Group();
            boneContainer.add(skeleton.bones[0]);
            
            this.scene.add(this.skeletonHelper);
            this.scene.add(boneContainer);
            
            this.animationClip = createAnimation(project.clipName, this.landmarksArray);
            
            // play animation
            this.mixer = new THREE.AnimationMixer(this.skeletonHelper);
            this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
            this.mixer.update(this.clock.getDelta()); // Do first iteration to update from T pose
            
            project.prepareData(this.mixer, this.animationClip, skeleton);
            this.gui.loadProject(project);
            this.gizmo.begin(this.skeletonHelper);

            // Update camera
            const bone0 = this.skeletonHelper.bones[0];
            if(bone0) {
                bone0.getWorldPosition(this.controls.target);
                this.controls.update();
            }
            
            this.animate();
        }
    }

    processLandmarks(project) {
        
        const [startTime, endTime] = project.trimTimes;

        // Video is duration-complete
        if(!endTime)
        return;

        let totalDt = 0;
        let index = 1;

        // remove starting frames
        while( totalDt < startTime ) {
            const lm = this.landmarksArray[index];
            totalDt += lm.dt * 0.001;
            index++;
        }

        if(totalDt > 0) {
            this.landmarksArray = this.landmarksArray.slice(index - 1);
        }

        // remove ending frames
        index = 1;
        while( totalDt < endTime && index < this.landmarksArray.length ) {
            const lm = this.landmarksArray[index];
            totalDt += lm.dt * 0.001;
            index++;
        }
        
        for(let i = 0; i < this.landmarksArray.length; i++){
            if(this.landmarksArray[i].PLM)
                for(let j = 0; j < this.landmarksArray[i].PLM.length; j++){
                    if(i && this.landmarksArray[i].PLM[j].visibility<0.1 && this.landmarksArray[i].PLM[j].visibility <this.landmarksArray[i-1].PLM[j].visibility){
                        this.landmarksArray[i].PLM[j] = this.landmarksArray[i].PLM[j-1];
                    }
                }
        }
        /*let s = 0.1;
        for(let i = 0; i < this.landmarksArray.length; i++){
            for(let j = 1; j < this.landmarksArray[i].FLM.length; j++){
                s = 0.1
                if(Math.abs(this.landmarksArray[i].FLM[j].distanceTo(this.landmarksArray[i].FLM[j-1]))<1e-2)
                    s = 0.9;
                this.landmarksArray[i].FLM[j].lerp(this.landmarksArray[i].FLM[j-1], s);
        
            }
        }*/
      
        this.landmarksArray = this.landmarksArray.slice(0, index - 1);
    }

    appendCanvasButtons() {

        let canvasArea = document.getElementById("canvasarea");
        let timelineCanvas = document.getElementById("timelineCanvas");
        const HEIGHT = canvasArea.clientHeight / 2
                        - timelineCanvas.clientHeight
                        - (CanvasButtons.items.length / 2) * 30;

        for( let i = 0; i < CanvasButtons.items.length; ++i ) {

            const b = CanvasButtons.items[i];
            let content = null;

            if(b.icon) {
                content = document.createElement("i");
                content.className = 'bi bi-' + b.icon;
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
        return idx == undefined ? idx : this.skeleton.bones[ idx ];
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

    setTime(t, force) {

        // Don't change time if playing
        if(this.state && !force)
            return;
            
        if(this.mixer)
            this.mixer.setTime(t);
        this.gizmo.updateBones(0.0);
            
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
    stopAnimation() {
        
        this.mixer.setTime(0.0);
        this.gizmo.updateBones(0.0);
    }

    updateAnimationAction(idx) {

        const mixer = this.mixer;

        if(!mixer._actions.length || mixer._actions[0]._clip != this.animationClip) 
        return;

        // Update times
        mixer._actions[0]._interpolants[idx].parameterPositions = this.animationClip.tracks[idx].times;
        // Update values
        mixer._actions[0]._interpolants[idx].sampleValues = this.animationClip.tracks[idx].values;
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
        BVHExporter.download(JSON.stringify(this.animationClip.toJSON()), this.animationClip.name, "application/json")
        //BVHExporter.export(this.skeleton, this.animationClip, this.landmarksArray.length);
    }

    showPreview() {
        console.log( "TODO: Open URL preview with data to show BVH" );
    }
};

THREE.SkeletonHelper.prototype.getBoneByName = function( name ) {

    for ( let i = 0, il = this.bones.length; i < il; i ++ ) {

        const bone = this.bones[ i ];

        if ( bone.name === name ) {

            return bone;

        }

    }

    return undefined;
}

export { Editor };