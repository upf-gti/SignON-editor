import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { MiniGLTFLoader } from "./loaders/GLTFLoader.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { BVHExporter } from "./bvh_exporter.js";
import { createSkeleton, createAnimation, createAnimationFromRotations, updateThreeJSSkeleton, injectNewLandmarks } from "./skeleton.js";
import { Gui } from "./gui.js";
import { Gizmo } from "./gizmo.js";
import { firstToUpperCase, consecutiveRanges } from "./utils.js"
import { lerp } from "./math.js"
import { OrientationHelper } from "./libs/OrientationHelper.js";
import { TFModel } from "./libs/tensorFlowWrap.module.js";
import { CanvasButtons } from "./ui.config.js";
import { AnimationRetargeting } from './retargeting.js'

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
        
        this.spotLight = null;

        this.mixer = null;
        this.mixerHelper = null;
        
        this.skeletonHelper = null;
        this.skeleton = null;
        
        this.animSkeleton = null;
        this.srcBindPose = null;
        this.tgtBindPose = null;
        this.tgtSkeletonHelper = null;

        this.pointsGeometry = null;
        this.landmarksArray = [];
        this.landmarksNN = [];
        this.prevTime = this.iter = 0;
    	this.onDrawTimeline = null;
	    this.onDrawSettings = null;
        this.gui = new Gui(this);

        this.defaultTranslationSnapValue = 1;
        this.defaultRotationSnapValue = 30; // Degrees

        // Keep "private"
        this.__app = app;

        this.retargeting = new AnimationRetargeting();
        this.init();
    }
    
    init() {

        let canvasArea = document.getElementById("canvasarea");

        const CANVAS_WIDTH = canvasArea.clientWidth;
        const CANVAS_HEIGHT = canvasArea.clientHeight;

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
        dirLight.shadow.camera.bottom = - 2;
        dirLight.shadow.camera.left = - 2;
        dirLight.shadow.camera.right = 2;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 200;
        scene.add( dirLight );

        let spotLight = new THREE.SpotLight(0xffa95c,1);
        spotLight.position.set(-50,50,50);
        spotLight.castShadow = true;
        spotLight.shadow.bias = -0.0001;
        spotLight.shadow.mapSize.width = 1024*4;
        spotLight.shadow.mapSize.height = 1024*4;
        scene.add( spotLight );

        const pixelRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
        let renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.outputEncoding = THREE.sRGBEncoding;
        canvasArea.appendChild(renderer.domElement);

        renderer.domElement.id = "webgl-canvas";
        renderer.domElement.setAttribute("tabIndex", 1);

        // camera
        let camera = new THREE.PerspectiveCamera(60, pixelRatio, 0.1, 1000);
        window.camera = camera;
        let controls = new OrbitControls(camera, renderer.domElement);
        camera.position.set(0, 1, 2);
        controls.minDistance = 0.5;
        controls.maxDistance = 5;
        controls.target.set(0, 1, 0);
        controls.update();  
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;
        this.spotLight = spotLight;
        
        this.video = document.getElementById("recording");
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
        
        // Trim
        this.processLandmarks(project);

        // Prepare landmarks for the NN (PLM + RLM + LLM)
        let firstNonNull = null;
        let lastNonNull = null;
        this.landmarksNN = this.landmarksArray.map((v, idx) => {
            if (v.PLM !== undefined && v.RLM !== undefined && v.LLM !== undefined) {
                lastNonNull = idx;
                if (!firstNonNull) firstNonNull = idx;
            } else {
                const dt = v.dt * 0.001;
                if (!firstNonNull) {
                    // Add delta to start time
                    project.trimTimes[0] += dt;
                } else {
                    // Sub delta to end time
                    project.trimTimes[1] -= dt;
                }
            }

            if (v.PLM == undefined)
                v.PLM = new Array(33).fill(0).map((x) => ({x:undefined, y:undefined, z:undefined, visibility:undefined}));
            if (v.RLM == undefined)
                v.RLM = new Array(21).fill(0).map((x) => ({x:undefined, y:undefined, z:undefined, visibility:undefined}));
            if (v.LLM == undefined)
                v.LLM = new Array(21).fill(0).map((x) => ({x:undefined, y:undefined, z:undefined, visibility:undefined}));
            
            let vec1 = v.PLM.concat(v.RLM, v.LLM);
            let vec2 = vec1.map((x) => {return Object.values(x).slice(0, -1);}); // remove visibility
            
            return vec2.flat(1);
        });
        if (!firstNonNull || !lastNonNull) throw('Missing landmarks error');
        this.landmarksNN = this.landmarksNN.slice(firstNonNull, lastNonNull + 1);

        this.video.startTime = project.trimTimes[0];
        this.video.onended = function() {
            this.currentTime = this.startTime;
            this.play();
        };

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
                for(const ip of $(".bone-position input, .bone-euler input, .bone-quaternion input")) ip.setAttribute('disabled', true);
            } else{
                for(const ip of $(".bone-position input, .bone-euler input, .bone-quaternion input")) ip.removeAttribute('disabled');
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
        material.size = 0.025;
        const points = new THREE.Points( this.pointsGeometry, material );
        this.scene.add( points );

        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);

        if ( urlParams.get('load') == 'hard') {
        
            this.loadGLTF("models/t_pose.glb", gltf => {
                let model = gltf.scene;
                this.character = model.name;
                model.castShadow = true;
                
                this.skeletonHelper = new THREE.SkeletonHelper(model);
                this.skeletonHelper.name = "SkeletonHelper";
                model.children[0].setRotationFromQuaternion(new THREE.Quaternion());
                
                for (let bone_id in this.skeletonHelper.bones) {
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
                this.scene.add(boneContainer);
                this.scene.add( model );

                // Play animation
                this.animationClip = createAnimation("Eva", this.landmarksArray);
                // this.animationClip = gltf.animations[0];
                this.mixer = new THREE.AnimationMixer(model);
                this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
                this.mixer.update(this.clock.getDelta()); // Do first iteration to update from T pose
        
                project.prepareData(this.mixer, this.animationClip, skeleton, this.video);
                this.gui.loadProject(project);
                this.gizmo.begin(this.skeletonHelper);
                this.setBoneSize(0.2);
                
                this.animate();
                $('#loading').fadeOut();
            });

        } else if ( urlParams.get('load') == 'NN' || urlParams.get('load') == undefined ) {

            // Convert landmarks into an animation
            let quatData = [];
            let blankFrames = [];
            let NN = new TFModel("data/ML/model.json");
            console.log('Creating animation');

            NN.onLoad = () => {
                for (let i = 0; i < this.landmarksNN.length; i++) {
                    let outputNN = NN.predictSampleSync( this.landmarksNN[i] );
                    
                    // Solve normalization problem
                    for (let j = 0; j < outputNN.length; j+=4)
                    {
                        let val = new THREE.Quaternion(outputNN[j], outputNN[j+1], outputNN[j+2], outputNN[j+3]);
                        val.normalize();
                        outputNN[j] = val.x;
                        outputNN[j+1] = val.y;
                        outputNN[j+2] = val.z;
                        outputNN[j+3] = val.w;
                    }
                    
                    if (outputNN.includes(NaN)) blankFrames.push(i); // track lost frames
                    
                    quatData.push([0, 90, 0, ... outputNN]); // add netral position to hip
                }
                                                
                // Linear interpolation to solves blank frames
                blankFrames = consecutiveRanges(blankFrames);
                for (let range of blankFrames) {
                    if (typeof range == 'number') {
                        let frame = quatData[range];
                        let prevFrame = quatData[range - 1];
                        let nextFrame = quatData[range + 1];
                        quatData[range] = frame.map( (v, idx) => {
                            let a = prevFrame[idx];
                            let b = nextFrame[idx];
                            return lerp(a, b, 0.5);
                        } );
                    } else {
                        let [x0, x1] = [... range];
                        let n = x1 - x0 + 1; // Count middle frames
                        let divisions = 1 / (n + 1); // Divide 1 by num of frames + 1
                        let prevFrame = quatData[x0 - 1];
                        let nextFrame = quatData[x1 + 1];
    
                        // Compute lerp for all frames
                        for (let i = x0; i <= x1; i++) {
                            let frame = quatData[i];
                            quatData[i] = frame.map( (v, idx) => {
                                let a = prevFrame[idx];
                                let b = nextFrame[idx];
                                return lerp(a, b, divisions);
                            } );
                            divisions += divisions;
                        }
                    }
                }

                NN.deinit();
            }
            
            // Load the source model
            this.loadGLTF("models/t_pose.glb", (gltf) => {
    
                let model = gltf.scene;
                model.visible = true; // change to false

                // find bind skeleton
                let srcpose = [];
                model.traverse( (object) => {
                    if (object.isSkinnedMesh) {
                        srcpose = object.skeleton;
                        return;
                    }
                } );
                // solve the initial rotation of Kate
                model.children[0].setRotationFromQuaternion(new THREE.Quaternion());

                // get bones in bind pose
                this.srcBindPose = this.retargeting.getBindPose(srcpose, true);
                
                // set model in bind pose
                for(let i = 0; i < this.srcBindPose.length; i++)
                {
                    let bone = this.srcBindPose[i];
                    let o = model.getObjectByName(bone.name);
                    o.position.copy(bone.position);
                    bone.scale.copy(o.scale);
                    o.quaternion.copy(bone.quaternion);
                    o.updateWorldMatrix();
                }

                this.skeletonHelper = this.animSkeleton = new THREE.SkeletonHelper( model );			
                this.animSkeleton.visible = true; // change to false
                this.scene.add(this.animSkeleton)
                this.scene.add(model)

                this.animSkeleton.name = "SkeletonHelper"; // move this line below once retargeting solved (animSkeleton --> skeletonHelper)
                
                updateThreeJSSkeleton(this.srcBindPose);
                let skeleton = createSkeleton();
                this.skeleton = skeleton;
                this.animSkeleton.skeleton = skeleton;

                const boneContainer = new THREE.Group();
                boneContainer.add(skeleton.bones[0]);
                this.scene.add(boneContainer);
    
                this.animationClip = createAnimationFromRotations("SignName", quatData);
    
                this.mixer = new THREE.AnimationMixer(model);
                this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
                       
                project.prepareData(this.mixer, this.animationClip, skeleton);
                this.gui.loadProject(project);
                
                // Load the target model (Eva) 
                this.loadGLTF("models/Eva_Y.glb", (gltf) => {
                    
                    this.character = gltf.scene;
                    this.character.visible = false; // change to true
                    //this.character.position.set(0,0.75,0);
                    this.character.castShadow = true;
                    
                    this.character.traverse( (object) => {
                        if ( object.isMesh || object.isSkinnedMesh ) {
                            object.castShadow = true;
                            object.receiveShadow = true;
                            object.frustumCulled = false;
                            
                            if(object.material.map) object.material.map.anisotropy = 16; 
                            // find bind skeleton (bind matrices)
                            this.tgtBindPose = object.skeleton;
                            
                        }
                        else if (object.isBone) {
                            object.scale.set(1.0, 1.0, 1.0);
                        }
                        if(!this.tgtBindPose){
                            // find bind skeleton on children
                            object.traverse((o) => {
                                if(o.isSkinnedMesh) {
                                    this.tgtBindPose = o.skeleton;
                                }
                            })
                        }
                    } );
                    
                    // get bones in bind pose
                    this.tgtBindPose = this.retargeting.getBindPose(this.tgtBindPose);
                    //this.tgtBindPose[0].position.copy(this.srcBindPose[0].position)
                    this.tgtSkeletonHelper = new THREE.SkeletonHelper(this.character);
                    this.tgtSkeletonHelper.visible = false; // change to true

                    // correct rotation
                    //this.character.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
                    
                    this.scene.add(this.tgtSkeletonHelper);
                    this.scene.add( this.character );
                    
                    // apply source bind pose to intermediate skeleton
                    this.retargeting.updateSkeleton(this.srcBindPose);
                    // map bone names between source (Kate) and target (Eva)
                    this.retargeting.automap(this.tgtSkeletonHelper.bones);
                    // apply retargeting to the first frame
                    this.mixer.update(0);
                    this.retargeting.retargetAnimation(this.srcBindPose, this.tgtBindPose, this.animSkeleton, this.tgtSkeletonHelper, false);
                    
                    this.gizmo.begin(this.animSkeleton);
                    this.setBoneSize(0.2);
                    this.animate();
                    $('#loading').fadeOut();
                });
            });
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

        const bone = this.skeletonHelper.bones[this.gizmo.selectedBone];
        if($(".bone-position").length) $(".bone-position")[0].setValue(bone.position.toArray());
        if($(".bone-euler").length) $(".bone-euler")[0].setValue(bone.rotation.toArray());
        if($(".bone-quaternion").length) $(".bone-quaternion")[0].setValue(bone.quaternion.toArray());

        this.mixer.setTime(t);
        this.gizmo.updateBones(0.0);

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

        if (this.mixer && this.state) {
            this.mixer.update(dt);
            // Update ui data
            const bone = this.skeletonHelper.bones[this.gizmo.selectedBone];
            for(const ip of $(".bone-position")) ip.setValue(bone.position.toArray());
            for(const ip of $(".bone-euler")) ip.setValue(bone.rotation.toArray());
            for(const ip of $(".bone-quaternion")) ip.setValue(bone.quaternion.toArray());

            this.retargeting.retargetAnimation(this.srcBindPose, this.tgtBindPose, this.animSkeleton, this.tgtSkeletonHelper, false);
            for(let i = 0; i < this.tgtSkeletonHelper.bones.length; i++)
            {
                let b = this.tgtSkeletonHelper.bones[i];
                let o = this.character.getObjectByName(b.name);
                o.position.copy(b.position);
                o.scale.copy(b.scale);
                o.quaternion.copy(b.quaternion);
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
        BVHExporter.export(this.mixer, this.skeletonHelper, this.animationClip);
    }

    showPreview() {
        
        BVHExporter.copyToLocalStorage(this.mixer, this.skeletonHelper, this.animationClip);

        const url = "https://webglstudio.org/users/arodriguez/demos/animationLoader/?load=three_webgl_bvhpreview";
        window.open(url, '_blank').focus();
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