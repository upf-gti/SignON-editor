import * as THREE from "./libs/three.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { BVHLoader } from "./loaders/BVHLoader.js";
import { createSkeleton, createAnimation, createThreeJSSkeleton, updateThreeJSSkeleton } from "./skeleton.js";
import { BVHExporter } from "./bvh_exporter.js";
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
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
        scene.add(new THREE.GridHelper(300, 20));
        
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
        
        this.landmarksArray = project.landmarks;
        
        project.path = project.path || "models/bvh/victor.bvh";
        
        /*let skeleton = createSkeleton(this.landmarksArray);
        this.skeleton = skeleton;
        
        this.skeletonHelper = new THREE.SkeletonHelper(skeleton.bones[0]);
        this.skeletonHelper.skeleton = skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly

        const boneContainer = new THREE.Group();
        boneContainer.add(skeleton.bones[0]);*/
        
        //this.scene.add(this.skeletonHelper);
       // this.scene.add(boneContainer);
        
        //this.animationClip = createAnimation(project.clipName, this.landmarksArray);
        
        // play animation
      //  this.mixer = new THREE.AnimationMixer(this.skeletonHelper);
        //this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
      //  this.mixer.update(this.clock.getDelta()); //do first iteration to update from T pose
        
        /*this.pointsGeometry = new THREE.BufferGeometry();
        
        const material = new THREE.PointsMaterial( { color: 0x880000 } );
        material.size = 0.025;
        
        const points = new THREE.Points( this.pointsGeometry, material );
        
        this.scene.add( points );*/
        
        /*project.prepareData(this.mixer, this.animationClip, skeleton);
        this.gui.loadProject(project);

        this.gizmo.begin(this.skeletonHelper);
*/
        // set onclick function to play button
        let stateBtn = document.getElementById("state_btn");
        let video = document.getElementById("recording");
        stateBtn.onclick = (e) => {
            this.state = !this.state;
            stateBtn.innerHTML = "<i class='bi bi-" + (this.state ? "pause" : "play") + "-fill'></i>";
            stateBtn.style.border = "solid #268581";
            this.state ? this.gizmo.stop() : 0;
            video.paused ? video.play() : video.pause();
        };

        let stopBtn = document.getElementById("stop_btn");
        stopBtn.onclick = (e) => {
            this.state = false;
            stateBtn.innerHTML = "<i class='bi bi-play-fill'></i>";
            stateBtn.style.removeProperty("border");
            this.stopAnimation();
            video.pause();
            video.currentTime = 0;
        }
      
        //this.animate();
        let skeleton = createSkeleton(this.landmarksArray);
        
        // Load the model (Eva)
        this.loadGLTF("models/Taunt.glb", (gltf) => {
           
            let model = gltf.scene;
            model.castShadow = true;

           
            //model.skeleton = skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
            var arm = model.getChildByName("Armature");
            //var bones = this.get_skin(gltf.parser.json, null,arm)
            //skeleton = updateThreeJSSkeleton(this.skeletonHelper.skeleton, bones);
            //skeleton = createThreeJSSkeleton( bones);
           // this.skeletonHelper = new THREE.SkeletonHelper(skeleton.bones[0]);
           // this.skeletonHelper.skeleton = skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
          
            
            model.traverse(  ( object ) => {
                if ( object.isMesh ||object.isSkinnedMesh ) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                    
                    //this.group_bind_skeleton(object, this.skeletonHelper.skeleton)
                }
                if (object.isBone) {
            		object.scale.set(1.0, 1.0, 1.0);
                }
            } );
            this.skeletonHelper = new THREE.SkeletonHelper(model);
            skeleton = createSkeleton(this.landmarksArray);
            updateThreeJSSkeleton(this.skeletonHelper.bones);
            this.skeletonHelper.skeleton = skeleton;
             const boneContainer = new THREE.Group();
             boneContainer.add(skeleton.bones[0]);
            this.scene.add(this.skeletonHelper);
            this.scene.add(boneContainer);
            
           // this.group_bind_skeleton(gltf.scene, this.skeletonHelper.skeleton)
            this.scene.add( model );
            /*var animationGroup = new THREE.AnimationObjectGroup();
            for(var i=0; i< arm.children.length; i++){
                if(!arm.children[i].isSkinnedMesh)
                    continue;
                animationGroup.add(arm.children[i]);
            }
            this.mixer = new THREE.AnimationMixer( animationGroup );*/
            //const action = this.mixer.clipAction( gltf.animations[0] ).play();

            // play animation
            
            this.animationClip = createAnimation("Eva",this.landmarksArray);
            this.animationClip = gltf.animations[0];
            this.mixer = new THREE.AnimationMixer(this.skeletonHelper);
            this.mixer.clipAction(this.animationClip).setEffectiveWeight(1.0).play();
            this.mixer.update(this.clock.getDelta()); //do first iteration to update from T pose
            this.pointsGeometry = new THREE.BufferGeometry();
        
            const material = new THREE.PointsMaterial( { color: 0x880000 } );
            material.size = 0.025;
            
            const points = new THREE.Points( this.pointsGeometry, material );
            
            this.scene.add( points );
            //BVHExporter.export(skeleton, animation_clip, this.landmarksArray.length);
       
            project.prepareData(this.mixer, this.animationClip, skeleton);
            this.gui.loadProject(project);
    
            this.gizmo.begin(this.skeletonHelper);
            
            this.animate();
        });
    }

    group_bind_skeleton( mesh, jointNodes ){
        /*let c, i, len = grp.children.length, root_bind=false;

        grp.updateMatrixWorld( true ); // MUST DO THIS, Else things gets effed up
        for( i=0; i < len; i++ ){
            c = grp.children[ i ];
            if( !c.isSkinnedMesh ) continue;

            // Need to child the root bone to a SkinnedMesh else no works
            // Can only do this once, so do it on the first possible one.
            if( !root_bind ){ c.add( skeleton.bones[0] ); root_bind = true; }

            c.bind( skeleton );			// Bind Skeleton to SkinnedMesh
            c.bindMode = "detached";	// Not sure if it does anything but just incase.
        }*/
        if ( ! mesh.isMesh ) return;

            const bones = [];
            const boneInverses = [];

            for ( let j = 0, jl = jointNodes.bones.length; j < jl; j ++ ) {

                const jointNode = jointNodes.bones[ j ];

                if ( jointNode ) {

                    bones.push( jointNode );

                    const mat = new Matrix4();

                    if ( skinEntry.inverseBindMatrices !== undefined ) {

                        mat.fromArray( skinEntry.inverseBindMatrices.array, j * 16 );

                    }

                    boneInverses.push( mat );

                } else {

                    console.warn( 'THREE.GLTFLoader: Joint "%s" could not be found.', skinEntry.joints[ j ] );

                }

            }

            mesh.bind( new Skeleton( bones, boneInverses ), mesh.matrixWorld );
    }
    ////////////////////////////////////////////////////////
	// SKIN
	// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
	// https://github.com/KhronosGroup/glTF-Tutorials/blob/master/gltfTutorial/gltfTutorial_020_Skins.md
	////////////////////////////////////////////////////////
            
    // This one uses the Inverted Bind Matrices in the bin file then converts
    // to local space transforms.
    get_skin( json, name=null, node_info=null ){
        if( !json.skins ){
            console.error( "There is no skin in the GLTF file." );
            return null;
        }

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Skin Checking
        let ji, skin = null;
        if( name != null ){
            for( ji of json.skins ) if( ji.name == name ){ skin = ji; break; }
            if( !skin ){ console.error( "skin not found", name ); return null; }
        }else{
            // Not requesting one, Use the first one available
            for( ji of json.skins ){ 
                skin = ji;
                name = ji.name; // Need name to fill in node_info
                break;
            }
        }

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Create Bone Items
        let boneCnt = skin.joints.length,
            bones 	= new Array(boneCnt),
            n2j 	= {},			// Lookup table to link Parent-Child (Node Idx to Joint Idx) Key:NodeIdx, Value:JointIdx
            n, 						// Node
            ni, 					// Node Index
            itm;					// Bone Item

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Create Bone Array and Loopup Table.
        for(ji=0; ji < boneCnt; ji++ ){
            ni				= skin.joints[ ji ];
            n2j[ "n"+ni ] 	= ji;

            bones[ ji ] = {
                idx : ji, prev_idx : null, lvl : 0, name : null,
                pos : null, rot : null, scl : null };
        }

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Get Bone's name and set it's parent index value
        for( ji=0; ji < boneCnt; ji++){
            n				= json.nodes[ skin.joints[ ji ] ];
            itm 			= bones[ ji ];
            bones[ ji ].pos = n.translation;
            bones[ ji ].rot = n.rotation;
            bones[ ji ].scl = n.scale;
            // Each Bone Needs a Name, create one if one does not exist.
            if( n.name === undefined || n.name == "" )	itm.name = "bone_" + ji;
            else{
                itm.fullname = n.name;
                itm.name = n.name.replace(":", "");
                itm.name = itm.name.replace("_", "");
            } 										

            // Set Children who the parent is.
            if( n.children && n.children.length > 0 ){
                for( ni of n.children ) bones[ n2j["n"+ni] ].prev_idx = ji;
            }
        }

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Set the Hierarchy Level for each bone
        let lvl;
        for( ji=0; ji < boneCnt; ji++){
            // Check for Root Bones
            itm = bones[ ji ];
            if( itm.prev_idx == null ){ itm.lvl = 0; continue; }

            // Traverse up the tree to count how far down the bone is
            lvl = 0;
            while( itm.prev_idx != null ){ lvl++; itm = bones[ itm.prev_idx ]; }

            bones[ ji ].lvl = lvl;
        }

        
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        return bones;
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