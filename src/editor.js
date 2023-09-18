import * as THREE from "three";
import { OrbitControls } from "./controls/OrbitControls.js";
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { BVHExporter } from "./exporters/BVHExporter.js";
import { createSkeleton, createAnimation, createAnimationFromRotations, updateThreeJSSkeleton, injectNewLandmarks, postProcessAnimation } from "./skeleton.js";
import { KeyframesGui, ScriptGui } from "./gui2.js";
import { Gizmo } from "./gizmo.js";
import { UTILS } from "./utils.js"
import { NN } from "./ML.js"
import { OrientationHelper } from "./libs/OrientationHelper.js";
import { AnimationRetargeting } from './retargeting.js'
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from './exporters/GLTFExporoter.js' 
import { BMLController } from "./controller.js"
import { BlendshapesManager } from "./blendshapes.js"

const MapNames = await import('../data/mapnames.json', {assert: { type: 'json' }});

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";



class Editor {
    
    constructor(app, mode) {
        
        this.clock = new THREE.Clock();
        this.BVHloader = new BVHLoader();
        this.GLTFloader = new GLTFLoader();

        this.GLTFExporter = new GLTFExporter();
        this.help = null;
        
        this.camera = null;
        this.controls = null;
        this.scene = null;
        this.gizmo = null;
        this.renderer = null;
        this.state = false; // defines how the animation starts (moving/static)
        this.eModes = {keyframes: "keyframes editor", capture: "keyframes editor", script: "BML editor", MOUTHING: "Mouthing Editor"};
        this.mode = this.eModes[mode];
        this.NMFController = null;

        this.boneUseDepthBuffer = true;
        this.showGUI = true;
        this.showSkin = true; // defines if the model skin has to be rendered
        this.showSkeleton = true;
        this.animLoop = true;
        
        this.skeletonHelper = null;
        this.skeleton = null;
        this.mixer = null;

        this.bodyAnimation = null;
        this.faceAnimation = null;
        
        this.morphTargets = null;
        this.blendshapesManager = null;
        this.retargeting = new AnimationRetargeting();

        this.nn = new NN("data/ML/model.json");
        this.landmarksArray = [];
        this.blendshapesArray = [];
        this.applyRotation = false; // head and eyes rotation
        this.selectedAU = "Brow Left";
        
        this.character = "EVA";
        this.mapNames = MapNames.default.map_llnames[this.character];

    	this.onDrawTimeline = null;
	    this.onDrawSettings = null;

        this.activeTimeline = null;
        if(this.mode == this.eModes.keyframes)
            this.gui = new KeyframesGui(this);
        else
            this.gui = new ScriptGui(this);

        this.optimizeThreshold = 0.01;
        this.defaultTranslationSnapValue = 1;
        this.defaultRotationSnapValue = 30; // Degrees
        this.defaultScaleSnapValue = 1;

        // Keep "private"
        this.__app = app;

        this.init();
    }
    
    //Create canvas scene
    init() {

        let canvasArea = this.gui.canvasArea;
        const [CANVAS_WIDTH, CANVAS_HEIGHT] = canvasArea.size;

        // Create scene
        let scene = new THREE.Scene();
        scene.background = new THREE.Color( 0xa0a0a0 );
        scene.fog = new THREE.Fog( 0xa0a0a0, 10, 50 );
        window.scene = scene;

        const grid = new THREE.GridHelper(300, 300, 0x101010, 0x555555 );
        grid.name = "Grid";
        scene.add(grid);
        window.GridHelper = THREE.GridHelper;

        const ground = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0x353535, depthWrite: false } ) );
        ground.rotation.x = - Math.PI / 2;
        ground.receiveShadow = true;
        scene.add( ground );
        
        // Lights
        const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444, 0.3 );
        hemiLight.position.set( 0, 20, 0 );
        scene.add( hemiLight );

        const dirLight = new THREE.DirectionalLight( 0xffffff, 0.1 );
        dirLight.position.set( 3, 30, -50 );
        dirLight.castShadow = false;
        scene.add( dirLight );

        // Left spotlight
        let spotLight = new THREE.SpotLight( 0xffffff, 0.5 );
        spotLight.position.set(-2,2,2);
        spotLight.penumbra = 1;
        spotLight.castShadow = false;
        scene.add( spotLight );
        
        // Right spotlight
        let spotLight2 = new THREE.SpotLight( 0xffffff, 0.5 );
        spotLight2.position.set(1, 3, 1.5);
        spotLight2.penumbra = 1;
        spotLight2.castShadow = true;
        spotLight2.shadow.bias = -0.0001;
        spotLight2.shadow.mapSize.width = 2048;
        spotLight2.shadow.mapSize.height = 2048;
        scene.add( spotLight2 );
        
        let spotLightTarget = new THREE.Object3D();
        spotLightTarget.position.set(0, 1.5, 0); 
        scene.add( spotLightTarget );
        spotLight.target = spotLightTarget;
        spotLight2.target = spotLightTarget;

        // Create 3D renderer
        const pixelRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
        let renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.gammaInput = true; // applies degamma to textures ( not applied to material.color and roughness, metalnes, etc. Only to colour textures )
        renderer.gammaOutput = true; // applies gamma after all lighting operations ( which are done in linear space )
        renderer.shadowMap.enabled = true;

        canvasArea.root.appendChild(renderer.domElement);
        canvasArea.onresize = (bounding) => this.resize(bounding[0], bounding[1]);
        renderer.domElement.id = "webgl-canvas";
        renderer.domElement.setAttribute("tabIndex", 1);

        // Camera
        let camera = new THREE.PerspectiveCamera(60, pixelRatio, 0.1, 1000);
        camera.position.set(-0.1175218614251044, 1.303585797450244, 1.4343282767035261);
        window.camera = camera;
        let controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = 0.5;
        controls.maxDistance = 5;
        controls.target.set(-0.20428114060514568, 1.0667066120801934, -0.017019104933513607);
        controls.update();  

        // Orientation helper
        const orientationHelper = new OrientationHelper( camera, controls, { className: 'orientation-helper-dom' }, {
            px: '+X', nx: '-X', pz: '+Z', nz: '-Z', py: '+Y', ny: '-Y'
        });

        canvasArea.root.appendChild(orientationHelper.domElement);
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
        this.orientationHelper = orientationHelper;

        this.video = document.getElementById("recording");
        this.video.startTime = 0;
        this.gizmo = new Gizmo(this);

        renderer.domElement.addEventListener( 'keydown', (e) => {
            switch ( e.key ) {
                case " ": // Spacebar
                    e.preventDefault();
                    //e.stopImmediatePropagation();
                    document.querySelector("[title = Play]").children[0].click()
                    break;
                case "Delete":
                    e.preventDefault();
                    // e.stopImmediatePropagation();
                    this.activeTimeline.deleteKeyFrame(e, null);
                    break;
                case "Escape":
                    this.gui.timelineArea.hide();
                    this.gui.updateSkeletonPanel();
                    this.gui.tree.select()
                    this.activeTimeline.unSelect();
                    break;
                case 'z':
                    if(e.ctrlKey) {
                        this.activeTimeline.restoreState();
                    }
                    break;
            }
        } );
    }

    getApp() {
        return this.__app;
    }

    startEdition() {
        this.gui.initEditionGUI();
    }

    /** -------------------- CREATE ANIMATIONS FROM MEDIAPIPE -------------------- */

    /**Create face and body animations from mediapipe and load character*/
    buildAnimation(data) {

        let {landmarks, blendshapes} = data;
        // Remove loop mode for the display video
        this.video.sync = true;
        this.video.loop = false;

        // Trim
        this.landmarksArray = this.processLandmarks( landmarks );
        this.blendshapesArray = this.processBlendshapes( blendshapes );

        // Mode for loading the animation
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);

        if ( urlParams.get('load') == 'hard') {
    
            this.GLTFloader.load( 'models/Eva_Y.glb', (glb) => {

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
                        if(object.morphTargetDictionary)
                            this.morphTargets = object.morphTargetDictionary;
                        
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
                this.BVHloader.load( 'models/ISL Thanks final.bvh' , (result) => {
                    this.bodyAnimation = result.clip;
                    for (let i = 0; i < result.clip.tracks.length; i++) {
                        this.bodyAnimation.tracks[i].name = this.bodyAnimation.tracks[i].name.replaceAll(/[\]\[]/g,"").replaceAll(".bones","");

                    }
                    this.gizmo.begin(this.skeletonHelper);
                    this.gui.loadKeyframeClip(this.bodyAnimation);
                    this.animationClip = this.bodyAnimation;
                    this.mixer.clipAction( this.bodyAnimation ).setEffectiveWeight( 1.0 ).play();
                    this.mixer.update(0);
                    this.setBoneSize(0.05);
                    this.animate();
                    $('#loading').fadeOut();
                } );
            } );

        } 
        else {// -- default -- if ( urlParams.get('load') == 'NN' ) {
            UTILS.makeLoading("")
            this.bodyAnimation = createAnimationFromRotations(this.clipName, this.nn);
            //postProcessAnimation(this.bodyAnimation, this.landmarksArray);
            if (urlParams.get('skin') && urlParams.get('skin') == 'false') {
                this.loadAnimationWithSkeleton(this.bodyAnimation);
            }
            else {
                this.BVHloader.load( 'models/kateBVH.bvh', (result) => {
                    result.clip = this.bodyAnimation;
                    this.loadAnimationWithSkin(result);
                });
            }
        }
        this.gui.showVideo = true;
    }

    processLandmarks( landmarks ) {
        
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

        this.nn.loadLandmarks( landmarks, 
            offsets => {
                this.trimTimes[0] += offsets[0];
                this.trimTimes[1] += offsets[1];

                this.video.startTime = this.trimTimes[0];
                this.video.onended = function() {
                    this.currentTime = this.startTime;
                    this.play();
                };
            },
            (err) => {
                alert(err, "Try it again."); 
                window.location.reload();
            } 
        );

        return landmarks;
    }

    processBlendshapes( blendshapes ) {
        
        const [startTime, endTime] = this.trimTimes;

        // Video is non duration-complete
        if(endTime) {

            let totalDt = 0;
            let index = 1;
    
            // remove starting frames
            while( totalDt < startTime ) {
                const bs = blendshapes[index];
                totalDt += bs.dt * 0.001;
                index++;
            }
    
            if(totalDt > 0) {
                blendshapes = blendshapes.slice(index - 1);
            }
    
            // remove ending frames
            index = 1;
            while( totalDt < endTime && index < blendshapes.length ) {
                const bs = blendshapes[index];
                totalDt += bs.dt * 0.001;
                index++;
            }
    
            blendshapes = blendshapes.slice(0, index - 1);
        }

        return blendshapes;
    }

    loadModel(clip) {
        // Load the target model (Eva) 
        UTILS.loadGLTF("models/Eva_Y.glb", (gltf) => {
            let model = gltf.scene;
            model.visible = true;
            
            let skinnedMeshes = [];
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
                        if(object.morphTargetDictionary) {

                            this.morphTargets = object.morphTargetDictionary;
                            skinnedMeshes.push(object)
                        }
                        
                    } else if (object.isBone) {
                        object.scale.set(1.0, 1.0, 1.0);
                    }
                } );
            
            // correct model
            // model.position.set(0, 0.75, 0);            
            model.rotateOnAxis(new THREE.Vector3(1,0,0), -Math.PI/2);
            this.skeletonHelper = this.retargeting.tgtSkeletonHelper || new THREE.SkeletonHelper(model);
            this.skeletonHelper.name = "SkeletonHelper";

            //Create animations
            this.mixer = new THREE.AnimationMixer(model);
            
            this.skeletonHelper.skeleton = this.help; //= createSkeleton();

            //Create face animation from mediapipe blendshapes
            // this.blendshapesManager = new BlendshapesManager(skinnedMeshes, this.morphTargets, this.mapNames);
            
            // guizmo stuff
            this.scene.add( model );
            // this.scene.add( this.skeletonHelper );
            //this.scene.add( this.retargeting.srcSkeletonHelper );
            
            // this.gui.createScriptTimeline();
            // this.gui.updateMenubar();// this.onBeginEdition();
            
            this.animationClip = clip || {duration:0, tracks:[]};
            this.setAnimation();
            this.gui.loadBMLClip(this.animationClip);
          
            this.NMFController = new BMLController(this, skinnedMeshes, this.morphTargets);
            this.NMFController.onUpdateTracks = () => {
                if(this.mixer._actions.length > 1) this.mixer._actions.pop();
                this.mixer.clipAction( this.animationClip  ).setEffectiveWeight( 1.0 ).play();
            }
            this.gui.clipsTimeline.onUpdateTrack = this.NMFController.updateTracks.bind(this.NMFController);
            this.NMFController.begin(this.gui.clipsTimeline);
            this.animate();
            $('#loading').fadeOut();
            
        });   
    }

    loadAnimation( animation ) {

        const extension = UTILS.getExtension(animation.name);
        // // Canvas UI buttons
        // this.createSceneUI();
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        
        const innerOnLoad = result => {
            if(urlParams.get('skin') && urlParams.get('skin') == 'true') {
                
                this.loadAnimationWithSkin(result);

            } else if(!result.skeleton) {

                this.loadAnimationWithSkin(result.skeletonAnim, result.blendshapesAnim);

            } else {
                
                this.loadAnimationWithSkeleton(result);
            }
        };

        var reader = new FileReader();
        reader.onload = (e) => {
            const text = e.currentTarget.result;
            let data = null;
            if(extension.includes('bvh'))
                data = this.BVHloader.parse( text );
            else
                data = this.BVHloader.parseExtended( text );
            innerOnLoad(data);
        };
        reader.readAsText(animation);
    }

    loadAnimationWithSkin(skeletonAnim, blendshapesAnim = null) {
        
        if(skeletonAnim && skeletonAnim.skeleton ) {
            skeletonAnim.clip.name = UTILS.removeExtension(this.clipName || skeletonAnim.clip.name);
            this.bodyAnimation = skeletonAnim.clip;
            let srcSkeleton = skeletonAnim.skeleton; 
            let tracks = [];
            
            // remove position changes (only keep i == 0, hips)
            for (let i = 0; i < this.bodyAnimation.tracks.length; i++) {
                if(i && this.bodyAnimation.tracks[i].name.includes('position')) {
                    continue;
                }
                tracks.push( this.bodyAnimation.tracks[i] );

            }

            this.bodyAnimation.tracks = tracks;
            this.retargeting.loadAnimation(srcSkeleton, this.bodyAnimation);
            //this.retargeting.loadAnimationFromSkeleton(skinnedMesh, this.bodyAnimation);
        }
        
        // Load the target model (Eva) 
        UTILS.loadGLTF("models/Eva_Y.glb", (gltf) => {
            let model = gltf.scene;
            model.visible = true;
            
            let skinnedMeshes = [];
            model.traverse( o => {
                if (o.isMesh || o.isSkinnedMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                    o.frustumCulled = false;
                    if ( o.skeleton ){ 
                        this.skeleton = o.skeleton;
                    }
                    if(o.morphTargetDictionary)
                    {
                        this.morphTargets = o.morphTargetDictionary;
                        skinnedMeshes.push(o);
                    }
                    o.material.side = THREE.FrontSide;
                    
                }
            } );
            
            // correct model
            model.position.set(0,0.85,0);
            model.rotateOnAxis(new THREE.Vector3(1,0,0), -Math.PI/2);
            this.skeletonHelper = this.retargeting.tgtSkeletonHelper || new THREE.SkeletonHelper(model);
            this.skeletonHelper.name = "SkeletonHelper";

            //Create animations
            this.mixer = new THREE.AnimationMixer(model);
            //Create body animation from mediapipe landmarks
            if(this.bodyAnimation)
            {
                this.bodyAnimation = this.retargeting.createAnimation(model);
                
                this.validateAnimationClip();
                this.mixer.clipAction(this.bodyAnimation).setEffectiveWeight(1.0).play();
                updateThreeJSSkeleton(this.retargeting.tgtBindPose);
                
            }
            this.skeletonHelper.skeleton = this.skeleton; //= createSkeleton();

            //Create face animation from mediapipe blendshapes
            this.blendshapesManager = new BlendshapesManager(skinnedMeshes, this.morphTargets, this.mapNames);
            let anim = this.blendshapesManager.createAnimationFromBlendshapes("au-animation", this.blendshapesArray);
            this.faceAnimation = anim[0];
            this.auAnimation = anim[1];

            if( blendshapesAnim )
                this.mixer.clipAction(blendshapesAnim.clip).setEffectiveWeight(1.0).play();
            else if(this.faceAnimation )
                this.mixer.clipAction(this.faceAnimation).setEffectiveWeight(1.0).play();

            // guizmo stuff
            this.scene.add( model );
            this.scene.add( this.skeletonHelper );
            //this.scene.add( this.retargeting.srcSkeletonHelper );
            
            this.gizmo.begin(this.skeletonHelper);
                    
            this.startEdition();// this.onBeginEdition();
            this.gui.loadKeyframeClip(this.bodyAnimation);
            this.animationClip = this.bodyAnimation;
      
            this.setBoneSize(0.05);
            this.animate();
            if(this.bodyAnimation )
                $('#loading').fadeOut();
        });   
    }

    loadAnimationWithSkeleton(animation) {
        this.bodyAnimation = animation.clip || animation || this.bodyAnimation;
        this.BVHloader.load( 'models/kateBVH.bvh' , (result) => {
    
            let skinnedMesh = result.skeleton;
            // skinnedMesh.bones.map(x => x.scale.set(0.1, 0.1, 0.1));
            skinnedMesh.bones[0].scale.set(0.1,0.1,0.1)
            skinnedMesh.bones[0].position.set(0,0.85,0)
            this.skeletonHelper = new THREE.SkeletonHelper( skinnedMesh.bones[0] );
            this.skeletonHelper.skeleton = this.skeleton = skinnedMesh;
            this.skeletonHelper.name = "SkeletonHelper";
            // this.skeletonHelper.position.set(0, 0.85, 0);

            let boneContainer = new THREE.Group();
            boneContainer.add( skinnedMesh.bones[0] );
            boneContainer.rotateOnAxis( new THREE.Vector3(1,0,0), Math.PI/2 );
            // boneContainer.position.set(0, 0.85, 0);

            this.scene.add( boneContainer );
            this.scene.add(skinnedMesh.bones[0])
            this.scene.add( this.skeletonHelper );

            this.mixer = new THREE.AnimationMixer( this.skeletonHelper );
            this.gui.loadKeyframeClip(this.bodyAnimation);
            this.animationClip = this.bodyAnimation;

            this.mixer.clipAction( this.bodyAnimation ).setEffectiveWeight( 1.0 ).play();
            
            this.mixer.update(0);
            this.gizmo.begin(this.skeletonHelper);
            this.setBoneSize(0.05);
            this.animate();
            $('#loading').fadeOut();
        } );
    }

    /** Validate body animation clip created using ML */
    validateAnimationClip() {

        let newTracks = [];
        let tracks = this.bodyAnimation.tracks;
        let bones = this.skeleton.bones;
        let bonesNames = [];
        tracks.map((v) => { bonesNames.push(v.name.split(".")[0])});

        for(let i = 0; i < bones.length; i++)
        {
            
            let name = bones[i].name;
            if(bonesNames.indexOf( name ) > -1)
                continue
            let times = [tracks[0].times[0]];
            let values = [bones[i].quaternion.x, bones[i].quaternion.y, bones[i].quaternion.z, bones[i].quaternion.w];
            
            let track = new THREE.QuaternionKeyframeTrack(name + '.quaternion', times, values);
            newTracks.push(track);
            
        }
        this.bodyAnimation.tracks = [...this.bodyAnimation.tracks, ...newTracks] ;
    }


    /** -------------------- BONES INTERACTION -------------------- */
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

    getBoneSize() {
        const geometry = this.gizmo.bonePoints.geometry;
        return geometry.getAttribute('size').array[0];
    }

    setSelectedBone( name ) {

        if(!this.gizmo)
        throw("No gizmo attached to scene");

        this.gizmo.setBone(name);
        if(this.mode == this.eModes.NMF)
            this.gizmo.stop();
        //this.gizmo.mustUpdate = true;
    }

    updateBoneProperties() {
                            
        const bone = this.skeletonHelper.bones[this.gizmo.selectedBone];
        if(!bone)
        return;
        
        for( const p in this.boneProperties ) {
            // @eg: p as position, element.setValue( bone.position.toArray() )
            this.boneProperties[p].copy( bone[p]);
        }
    }

    /** -------------------- GIZMO INTERACTION -------------------- */
    hasGizmoSelectedBoneIk() { 
        return !!this.gizmo.ikSolver && !!this.gizmo.ikSolver.getChain( this.gizmo.skeleton.bones[this.gizmo.selectedBone].name );
    }
    
    getGizmoTool() { 
        return ( this.gizmo.toolSelected == Gizmo.Tools.ik ) ? "Follow" : "Joint"; 
    }

    setGizmoTool( tool ) { 
        if ( tool == "Follow" ){ this.gizmo.setTool( Gizmo.Tools.ik ); }
        else { this.gizmo.setTool( Gizmo.Tools.joint ); }
    }

    getGizmoMode() {
        return UTILS.firstToUpperCase( this.gizmo.mode );
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

        if( this.getGizmoMode() === 'Translate' )
            return this.gizmo.transform.translationSnap != null;
        else if( this.getGizmoMode() === 'Rotate' )
            return this.gizmo.transform.rotationSnap != null;
        else
            return this.gizmo.transform.scaleSnap != null;

    }
    
    toggleGizmoSnap() {

        if( this.getGizmoMode() === 'Translate' )
            this.gizmo.transform.setTranslationSnap( this.isGizmoSnapActive() ? null : this.defaultTranslationSnapValue );
        else if( this.getGizmoMode() === 'Rotate' )
            this.gizmo.transform.setRotationSnap( this.isGizmoSnapActive() ? null : THREE.MathUtils.degToRad( this.defaultRotationSnapValue ) );
        else
            this.gizmo.transform.setScaleSnap( this.isGizmoSnapActive() ? null : this.defaultScaleSnapValue );
    }

    updateGizmoSnap() {
        
        if(!this.isGizmoSnapActive())
        return;
        this.gizmo.transform.setTranslationSnap( this.defaultTranslationSnapValue );
        this.gizmo.transform.setRotationSnap( THREE.MathUtils.degToRad( this.defaultRotationSnapValue ) );
        this.gizmo.transform.setScaleSnap( this.defaultScaleSnapValue );
    }

    /** -------------------- BLENDSHAPES INTERACTION -------------------- */
    getSelectedActionUnit() {
        return this.selectedAU;
    }

    setSelectedActionUnit(au) {
        this.selectedAU = au;
        this.activeTimeline.setSelectedItems([au]);
        this.setTime(this.activeTimeline.currentTime);
        
    }

    updateBlendshapesProperties(name, value) {
        value = Number(value);
        let tracksIdx = [];                    
        for(let i = 0; i < this.activeTimeline.tracksDrawn.length; i++) {
            let info = this.activeTimeline.tracksDrawn[i][0];
            if(info.type == name){
                i = info.clipIdx;
        
                let idx = this.activeTimeline.getCurrentKeyFrame(this.activeTimeline.animationClip.tracks[i], this.activeTimeline.currentTime, 0.01)
                this.activeTimeline.animationClip.tracks[i].values[idx] = value;
                this.auAnimation.tracks[i].values[idx] = value;
                this.blendshapesArray[idx][name] = value;
                let map = this.blendshapesManager.getBlendshapesMap(name);
                for(let j = 0; j < map.length; j++){
                    for(let t = 0; t < this.faceAnimation.tracks.length; t++) {
                        
                        if(this.faceAnimation.tracks[t].name == map[j]) {
                            this.faceAnimation.tracks[t].values[idx] = value;
                            tracksIdx.push(t);
                            break;
                        }
                    }
                }
                // Update animation interpolants
                this.updateAnimationAction(this.faceAnimation, tracksIdx );
                return true;
            }
        }
    }

    /** -------------------- BODY ANIMATION EDITION -------------------- */
    cleanTracks(excludeList) {

        if(!this.gui.keyFramesTimeline.animationClip)
        return;

        for( let i = 0; i < this.gui.keyFramesTimeline.animationClip.tracks.length; ++i ) {

            const track = this.gui.keyFramesTimeline.animationClip.tracks[i];
            const [boneName, type] = this.gui.keyFramesTimeline.getTrackName(track.name);

            if(excludeList && excludeList.indexOf( boneName ) != -1)
            continue;

            track.times = new Float32Array( [track.times[0]] );
            track.values = track.values.slice(0, type === 'quaternion' ? 4 : 3);

            this.updateAnimationAction(this.gui.keyFramesTimeline.animationClip,i);
            this.gui.keyFramesTimeline.onPreProcessTrack( track );
        }
    }

    optimizeTrack(trackIdx, threshold = this.optimizeThreshold) {
        this.optimizeThreshold = threshold;
        const track = this.animationClip.tracks[trackIdx];
        track.optimize( this.optimizeThreshold );
        this.updateAnimationAction(this.animationClip, trackIdx);
    }

    optimizeTracks(tracks) {

        if(!this.animationClip)
            return;

        for( let i = 0; i < this.animationClip.tracks.length; ++i ) {
            const track = this.animationClip.tracks[i];
            if(track.optimize) {

                track.optimize( this.optimizeThreshold );
                this.updateAnimationAction(this.animationClip, i);
    
                // this.gui.keyFramesTimeline.onPreProcessTrack( track, i );
            }
        }
        this.gui.keyFramesTimeline.draw();
        if(this.gui.clipsTimeline)
            this.gui.clipsTimeline.optimizeTracks();
        this.gui.clipsTimeline.draw();
    }

    updateAnimationAction(animation, idx, replace = false) {

        const mixer = this.mixer;

        if(!mixer._actions.length) 
            return;

        if(typeof idx == 'number')
            idx = [idx];

        if(replace) {
            this.animationClip.tracks = [];
            for(let i = 0; i < animation.tracks.length; i++) {
                const track = animation.tracks[i];
                if(track.active) {
                    switch(track.type) {
                        case "position":
                            this.animationClip.tracks.push(new THREE.VectorKeyframeTrack(track.fullname, track.times, track.values));
                            break;
                        case "quaternion":
                            this.animationClip.tracks.push(new THREE.QuaternionKeyframeTrack(track.fullname, track.times, track.values));
                            break;
                        case "scale":
                            this.animationClip.tracks.push(new THREE.VectorKeyframeTrack(track.fullname, track.times, track.values));
                            break;
                        default:
                            this.animationClip.tracks.push(new THREE.NumberKeyframeTrack(track.fullname, track.times, track.values));
                            break;
                    } 
                }
            }
            for(let i = 0; i< mixer._actions.length; i++) {
                if(mixer._actions[i]._clip.name == animation.name) {
                    this.mixer.uncacheClip(mixer._actions[i]._clip)
                    this.mixer.uncacheAction(mixer._actions[i])
                    this.mixer.clipAction(this.animationClip).play();
                }
            }
            if(this.bodyAnimation.name == animation.name)
                this.bodyAnimation = animation;
            else if(this.faceAnimation.name == animation.name)
                this.faceAnimation = animation;
        }
        else {
            let valueDeletedInfo = null;
            for(let i = 0; i< mixer._actions.length; i++) {
                if(mixer._actions[i]._clip.name == animation.name) {
                    for(let j = 0; j < idx.length; j++) {
    
                        const track = animation.tracks[idx[j]];
                        if(!track.active)
                            continue;

                        if( mixer._actions[i]._interpolants[idx[j]].parameterPositions.length > track.times.length )
                            valueDeletedInfo = track;

                        // Update times
                        mixer._actions[i]._interpolants[idx[j]].parameterPositions = track.times;
                        // Update values
                        mixer._actions[i]._interpolants[idx[j]].sampleValues = track.values;

                        
                    }
                    if(this.bodyAnimation.name == animation.name)
                        this.bodyAnimation = animation;
                    else if(this.faceAnimation.name == animation.name) {
                        this.faceAnimation = animation;
                        
                        //update timeline animation track if a value is deleted
                        if(this.auAnimation.name == animation.name && valueDeletedInfo) {

                            for(let a = 0; a < this.auAnimation.tracks.length; a++) {
                                if(this.auAnimation.tracks[a].name == valueDeletedInfo.fullname) {
                                    this.auAnimation.tracks[a].values = valueDeletedInfo.values;
                                    this.auAnimation.tracks[a].times = valueDeletedInfo.times;
                                }
                            }
                            
                         }
                    }
                    return;
                }
            }
        }


    }

    setAnimationLoop(loop) {
        
        for(let i = 0; i < this.mixer._actions.length; i++) {

            if(loop)
                this.mixer._actions[i].loop = THREE.LoopOnce;
            else
                this.mixer._actions[i].loop = THREE.LoopRepeat;
        }
    }

    /** BML ANIMATION */ 
    
    updateTracks(tracks) {
        this.NMFController.updateTracks();

        if(tracks) {
            for(let t = 0; t < tracks.length; t++) {
                let [trackIdx, clipIdx] = tracks[t];
                let clip = this.gui.clipsTimeline.animationClip.tracks[trackIdx].clips[clipIdx].toJSON();
                if(this.animationClip.tracks.length == trackIdx)
                    this.animationClip.tracks.push([clip]);
                else
                    this.animationClip.tracks[trackIdx][clipIdx] = clip;
            }
        }
        // else if(trackIdx != null) {
        //     for(let i = 0; i < this.gui.clipsTimeline.animationClip.tracks[trackIdx].clips.length; i++) {

        //         this.animationClip.tracks[trackIdx][i] = this.gui.clipsTimeline.animationClip.tracks[trackIdx].clips[i];
        //     }
        // }
         else {
            for(let idx = 0; idx < this.gui.clipsTimeline.animationClip.tracks.length; idx++) {
                for(let i = 0; i < this.gui.clipsTimeline.animationClip.tracks[idx].clips.length; i++) {

                    this.animationClip.tracks[idx][i] = this.gui.clipsTimeline.animationClip.tracks[idx].clips[i].toJSON();
                }
            }
        }
    }


    /** -------------------- UPDATES, RENDER AND EVENTS -------------------- */

    animate() {
        
        requestAnimationFrame(this.animate.bind(this));

        this.render();
        this.update(this.clock.getDelta());

    }

    render() {

        if(!this.renderer)
            return;

        this.renderer.render(this.scene, this.camera);
        if(this.activeTimeline)
            this.gui.drawTimeline(this.activeTimeline);            

    }

    update(dt) {

        if(this.currentTime > this.activeTimeline.duration) {
            this.currentTime = this.activeTimeline.currentTime = 0.0;
            this.onAnimationEnded();
        }
        if (this.mixer && this.state) {

            this.mixer.update(dt);
            this.currentTime = this.activeTimeline.currentTime = this.mixer.time;

            if(this.mode == this.eModes.keyframes) {

                this.updateBoneProperties();
                this.updateCaptureDataTime({blendshapesResults: this.blendshapesArray}, this.mixer.time);
            }
        }
       
       
        this.gizmo.update(this.state, dt);
        if(this.NMFController)
            this.NMFController.update(this.state, dt);
    }

    onChangeMode(mode) {
        this.mode = mode;
        if( this.mode == this.eModes.NMF ) {
            this.gizmo.disable();
        }
        else {
            this.gizmo.enable();
        }
    }
    
    setTime(t, force) {

        // Don't change time if playing
        // this.gui.currentTime = t;
        if(this.state && !force)
            return;

        this.mixer.setTime(t);
        if(this.mode == this.eModes.keyframes) {

            this.gizmo.updateBones(0.0);
            this.updateBoneProperties();
            //results = {faceBlendshapes: {}}
            this.updateCaptureDataTime({blendshapesResults: this.blendshapesArray}, t);
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
    }

    setAnimation(type) {
        if(this.activeTimeline) {
            this.activeTimeline.hide()
        }
        switch(type) {
            case "Face":
                this.activeTimeline = this.gui.curvesTimeline;
                if(!this.selectedAU) return;
                this.activeTimeline.setAnimationClip( this.auAnimation );
                this.activeTimeline.show();
                this.setSelectedActionUnit(this.selectedAU);
                
                break;
            case "Body":
            
                this.activeTimeline = this.gui.keyFramesTimeline;
                this.activeTimeline.setAnimationClip( this.bodyAnimation );
                this.activeTimeline.show();            
                break;

             default:
                this.activeTimeline = this.gui.clipsTimeline;
                this.activeTimeline.show();
                break;
        }
    }

    updateCaptureDataTime(data, t) {
        let timeAcc = 0;
        let bs = null, lm = null;
        let idx = -1;

        for(let i = 0; i < data.blendshapesResults.length; i++) {
            timeAcc += data.blendshapesResults[i].dt*0.001;
            if(timeAcc <= t) {
                idx = i
                
            }
        }
        if(idx >= 0) {
            bs = data.blendshapesResults[idx];
            if(data.landmarksResults)
                lm = data.landmarksResults[idx];
        }
            
        this.gui.updateCaptureGUI({blendshapesResults: bs, landmarksResults: lm}, false)
    }

    // Play all animations
    onPlay(element, e) {
    
        this.state = true;
        this.gui.setBoneInfoState( true );
        if(this.video.sync) {
            try{
                this.video.paused ? this.video.play() : 0;    
            }catch(ex) {
                console.error("video warning");
            }
        }

    }

    // Stop all animations 
    onStop(element, e) {

        this.state = false;
        element.innerHTML = "<i class='bi bi-play-fill'></i>";
        //element.style.removeProperty("border");
        this.gui.setBoneInfoState( true );
        this.stopAnimation();

        if(this.video.sync) {
            this.video.pause();
            this.video.currentTime = this.video.startTime;
        }
        this.setTime(0);
    }

    onPause(element, e) {
        this.state = !this.state;
        if(this.state) {
            
            this.gui.setBoneInfoState( true );
            if(this.video.sync) {
                try{
                    this.video.paused ? this.video.pause() : 0;    
                }catch(ex) {
                    console.error("video warning");
                }
            }
        } else {

            this.state = false;
            if(this.video.sync) {
                this.video.pause();
            }
            this.mixer._actions[0].paused = false;
            this.gizmo.stop();
            if(this.NMFController)
               this.NMFController.stop();
        }
        
        this.gui.setBoneInfoState( false );
        // (this.video.paused && this.video.sync) ? this.video.play() : 0;    
    }

    stopAnimation() {
        
        this.mixer.setTime(0.0);
        this.gizmo.updateBones(0.0);
        this.activeTimeline.onSetTime(0.0);
    }

    onAnimationEnded() {

        if(this.animLoop) {
            this.setTime(0.0, true);
        } else {
            this.mixer.setTime(0);
            this.mixer._actions[0].paused = true;
            let stateBtn = document.querySelector("[title=Play]");
            stateBtn.children[0].click();

            this.video.pause();
            this.video.currentTime = this.video.startTime;
        }
    }


    resize(width = this.gui.canvasArea.root.clientWidth, height = this.gui.canvasArea.root.clientHeight) {
        
        const aspect = width / height;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(aspect);
        this.renderer.setSize(width, height);

        this.gui.resize(width, height);
    }

    export(type = null) {
        switch(type){
            case 'BVH':
                BVHExporter.export(this.mixer._actions[0], this.skeletonHelper, this.bodyAnimation);
                break;
            case 'GLB':
                let options = {
                    binary: true,
                    animations: []
                };
                for(let i = 0; i < this.mixer._actions.length; i++) {
                    options.animations.push(this.mixer._actions[i]._clip);
                }
                let model = this.mixer._root.getChildByName('Armature');
                this.GLTFExporter.parse(model, 
                    ( gltf ) => BVHExporter.download(gltf, 'animation.glb', 'arraybuffer' ), // called when the gltf has been generated
                    ( error ) => { console.log( 'An error happened:', error ); }, // called when there is an error in the generation
                options
            );
                break;
            case 'BVH extended':
                BVHExporter.exportMorphTargets(this.mixer._actions[1], this.morphTargets, this.animationClip);
                break;
            default:
                let json =  {
                    tracks: [],
                    name : this.animationClip.name || "bml animation",
                    duration: this.animationClip.duration
                }

                if(!this.gui.clipsTimeline.animationClip) {

                    alert("You can't export an animation with empty tracks.")
                    return;
                }
                for(let i = 0; i < this.gui.clipsTimeline.animationClip.tracks.length; i++ ) {
                    let track = [];
                    for(let j = 0; j < this.gui.clipsTimeline.animationClip.tracks[i].clips.length; j++) {
                        let data = this.gui.clipsTimeline.animationClip.tracks[i].clips[j];
                        if(data.toJSON) data = data.toJSON()
                        if(data)
                        {
                            track.push( data );
                        }
                    }
                    json.tracks.push(track);
                }
                BVHExporter.download(JSON.stringify(json), json.name, "application/json");
                console.log(type + " ANIMATION EXPORTATION IS NOT YET SUPPORTED");
                break;
        }
    }

    showPreview() {
        
        BVHExporter.copyToLocalStorage(this.mixer._actions[0], this.skeletonHelper, this.bodyAnimation);
        const url = "https://webglstudio.org/users/arodriguez/demos/animationLoader/?load=three_webgl_bvhpreview";
        window.open(url, '_blank').focus();
    }
};

export { Editor };