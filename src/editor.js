import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { BVHExporter } from "./bvh_exporter.js";
import { createSkeleton, createAnimation, createAnimationFromRotations, updateThreeJSSkeleton, injectNewLandmarks } from "./skeleton.js";
import { Gui } from "./gui.js";
import { Gizmo } from "./gizmo.js";
import { UTILS } from "./utils.js"
import { NN } from "./ML.js"
import { OrientationHelper } from "./libs/OrientationHelper.js";
import { CanvasButtons } from "./ui.config.js";
import { AnimationRetargeting } from './retargeting.js'
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
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
        this.landmarksNN = [];
        this.landmarksArray = [];
        
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

        // Create 3D renderer
        const pixelRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
        let renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.outputEncoding = THREE.sRGBEncoding;
        canvasArea.appendChild(renderer.domElement);

        renderer.domElement.id = "webgl-canvas";
        renderer.domElement.setAttribute("tabIndex", 1);

        // Camera
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

    buildAnimation(landmarks) {

        this.landmarksArray = landmarks;
                
        // Trim
        this.processLandmarks();

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
                this.mixer._actions[0].paused = false;
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
                    this.gui.loadClip(this.animationClip);
                    this.mixer.clipAction( this.animationClip ).setEffectiveWeight( 1.0 ).play();
                    this.mixer.update(0);
                    this.gizmo.begin(this.skeletonHelper);
                    this.setBoneSize(0.2);
                    this.animate();
                    $('#loading').fadeOut();
                } );
                
            } );

        } else if ( urlParams.get('load') == 'NN' || urlParams.get('load') == undefined ) {

            // Convert landmarks into an animation
            const quatData = this.nn.getQuaternions();

            // Load the source model
            UTILS.loadGLTF("models/t_pose.glb", (gltf) => {
                
                let auxModel = gltf.scene;
                auxModel.visible = true; // change to false

                let auxAnimation = createAnimationFromRotations(this.clipName, quatData);
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

                    // const boneContainer = new THREE.Group();
                    // boneContainer.add(skeleton.bones[0]);
                    // this.scene.add(boneContainer); 
                    
                    this.scene.add( model );
                    this.scene.add( this.skeletonHelper );
                    
                    this.gui.loadClip(this.animationClip);
                    this.gizmo.begin(this.skeletonHelper);
                    this.setBoneSize(0.2);
                    this.animate();
                    $('#loading').fadeOut();
                });
            });
        }
    }

    processLandmarks() {
        
        const [startTime, endTime] = this.trimTimes;

        // Video is non duration-complete
        if(endTime) {

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

        this.nn.loadLandmarks( this.landmarksArray, offsets => {
            this.trimTimes[0] += offsets[0];
            this.trimTimes[1] += offsets[1];

            this.video.startTime = this.trimTimes[0];
            this.video.onended = function() {
                this.currentTime = this.startTime;
                this.play();
            };
        } );
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