import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { MiniGLTFLoader } from "./loaders/GLTFLoader.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { BVHExporter } from "./bvh_exporter.js";
import { createSkeleton, createAnimation, createAnimationFromRotations, updateThreeJSSkeleton, injectNewLandmarks } from "./skeleton.js";
import { Gui } from "./gui.js";
import { Gizmo } from "./gizmo.js";
import { firstToUpperCase } from "./utils.js"
import { OrientationHelper } from "./libs/OrientationHelper.js";
import { CanvasButtons } from "./ui.config.js";

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
        this.skeletonHelper = null;
        
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
        const grid = new THREE.GridHelper(300, 50);
        grid.name = "Grid";
        scene.add(grid);

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
        camera.position.set(0.5, 2, -3);
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
        material.size = 0.025;
        const points = new THREE.Points( this.pointsGeometry, material );
        this.scene.add( points );

        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);

        if( urlParams.get('load') == 'skin' || urlParams.get('load') == undefined ) {

            this.loadGLTF("models/t_pose.glb", gltf => {
            
                let model = gltf.scene;
                this.character = model.name;
                model.castShadow = true;
                
                this.skeletonHelper = new THREE.SkeletonHelper(model);
                this.skeletonHelper.name = "SkeletonHelper";
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