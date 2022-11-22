import * as THREE from "three";
import { ShaderChunk } from "./utils.js";
import { TransformControls } from './controls/TransformControls.js';
import { TranslationConstraint } from './controls/Constraint.js'

class FacialRig {

    constructor(editor) {

        if(!editor)
        throw("No editor to attach Gizmo!");

        let scene = editor.scene;

        this.raycastEnabled = true;
        this.helper = null;
        this.undoSteps = [];
        this.maxBlendShapeTranslationOffset = 0.015;

        let transform = new TransformControls( editor.camera, editor.renderer.domElement );
        window.trans = transform;
        transform.setSpace( 'local' );
        transform.setMode( 'translate' );
        transform.addEventListener( 'change', editor.render );
        transform.setSize(0.1);

        transform.constraint = new TranslationConstraint();

        transform.addEventListener( 'objectChange', e => {

            this.updateRig();

            if(this.selectedPoint != null) {
                this.updateBlendshapes(e.target);
                // editor.gui.updateBlendshapesProperties();
            }
        });

        transform.addEventListener( 'mouseUp', e => {
            if(this.selectedPoint === undefined)
            return;
            this.updateTracks();
        } );

        transform.addEventListener( 'dragging-changed', e => {
            const enabled = e.value;
            editor.controls.enabled = !enabled;
            this.raycastEnabled = !this.raycastEnabled;
            
            if( enabled && this.helper !== null ) {
                this.helper.material.color.setHex( transform.constraint.getHelperColor( e ) );
            }

            if(this.selectedPoint == null)
            return;

            // const bone = this.editor.skeletonHelper.bones[this.selectedBone];

            // if(enabled) {
            //     this.undoSteps.push( {
            //         boneId: this.selectedBone,
            //         pos: bone.position.toArray(),
            //         quat: bone.quaternion.toArray(),
            //     } );
            // }
        });

        scene.add( transform );

        this.camera = editor.camera;
        this.scene = scene;
        this.transform = transform;
		this.raycaster = null;
        this.selectedPoint = null;
        this.meshPoints = null;
        this.defaultPositions = [];
        this.editor = editor;

        // Update in first iteration
        this.mustUpdate = true; 
    }

    begin(mesh, blendshapes) {
        
        this.mesh = mesh;

        // point cloud for bones
        const pointsShaderMaterial = new THREE.ShaderMaterial( {
            uniforms: {
                color: { value: new THREE.Color( 0xffffff ) },
                pointTexture: { value: new THREE.TextureLoader().load( 'data/imgs/disc.png' ) },
                alphaTest: { value: 0.9 }
            },
            depthTest: false,
            vertexShader: ShaderChunk["Point"].vertexshader,
            fragmentShader: ShaderChunk["Point"].fragmentshader
        });

        const geometry = new THREE.BufferGeometry();

        let vertices = [];

        for(let point of mesh.children) {
            let tempVec = new THREE.Vector3();
            point.getWorldPosition(tempVec);
            this.defaultPositions.push(tempVec.clone());
            vertices.push( tempVec );
        }

        this.selectedPoint = vertices.length ? 0 : null;

        geometry.setFromPoints(vertices);
        
        const positionAttribute = geometry.getAttribute( 'position' );
        const size = 0.05;
        geometry.setAttribute( 'size', new THREE.Float32BufferAttribute( new Array(positionAttribute.count).fill(size), 1 ) );

        this.meshPoints = new THREE.Points( geometry, pointsShaderMaterial );
        this.meshPoints.name = "FacialRigPoints";
        this.scene.add( this.meshPoints );
        
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.005;
        
        this.bindEvents();
        
        this.automap();
        // First update to get bones in place
        this.update(true, 0.0);

        if(this.selectedPoint != null) 
            this.updatePointsColors();
    }

    automap() {

        this.map = {};
        let i = 0;
        for(let point of this.mesh.children) {
            this.map[i] = point.name;
            i++
        }
        this.blendshapesMap = {
            "Brows": {x: [], y: ["BrowsDown_Left", "BrowsDown_Right","-BrowsOuterLower_Left", "-BrowsOuterLower_Right"], z:[]},
            "Brow_L": {x: ["BrowsIn_Left"], y: ["-BrowsUp_Left", "-EyesWide_Left"], z:[]},
            "Brow_R": {x: ["-BrowsIn_Right"], y: ["-BrowsUp_Right", "-EyesWide_Right"], z:[]},
            "Nose_R001": {x: [], y: ["-NoseScrunch_Right"], z:[]},
            "Nose_L001": {x: [], y: ["-NoseScrunch_Left"], z:[]},
            "Cheek_L": {x: ["-CheekPuff_Left"], y: [], z:[]},
            "Cheek_R": {x: ["CheekPuff_Right"], y: [], z:[]},
            "UpperLip_R001": {x: [], y: ["-UpperLipUp_Right", "UpperLipDown_Right"], z: ["UpperLip"]},
            "UpperLip_L001": {x: [], y: ["-UpperLipUp_Left", "UpperLipDown_Left"], z: []},
            "Smile_R001": {x: ["-MotuhNarrow_Right"], y: ["-Smile_Right", "Frown_Right"], z:[]},
            "Smile_L001": {x: ["MotuhNarrow_Left"], y: ["-Smile_Left", "Frown_Left"], z:[]},
            "Mouth001": { x: ["Midmouth_Right","-Midmouth_Left"], y: ["-MouthUp", "MouthDown"], z: ["MouthWhistle_NazrrowAdjust_Left", "MouthWhistle_NarrowAdjust_Right"]},
            "LowerLip_L001": {x: [], y: ["-LowerLip_Right"], z:[]},
            "LowerLip_R001": {x: [], y: ["-LowerLip_Left"], z:[]},
            "Jaw001": {x: ["Jaw_Right","-Jaw_Left"], y: ["Jaw_Down","-Jaw_Up"], z:[]},

        }

    }
    stop() {
        this.transform.detach();
    }

    bindEvents() {

        // if(!this.skeletonHelper)
        //     throw("No skeleton");

        let transform = this.transform;
        let timeline = this.editor.gui.timeline;

        const canvas = document.getElementById("webgl-canvas");

        canvas.addEventListener( 'mousemove', e => {

            if(!this.meshPoints || this.editor.state)
            return;

            const pointer = new THREE.Vector2(( e.offsetX / canvas.clientWidth ) * 2 - 1, -( e.offsetY / canvas.clientHeight ) * 2 + 1);
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObject( this.meshPoints );
            canvas.style.cursor = intersections.length ? "crosshair" : "default";
        });

        canvas.addEventListener( 'pointerdown', e => {

            if(e.button != 0 || !this.meshPoints || this.editor.state || (!this.raycastEnabled && !e.ctrlKey))
            return;

            const pointer = new THREE.Vector2(( e.offsetX / canvas.clientWidth ) * 2 - 1, -( e.offsetY / canvas.clientHeight ) * 2 + 1);
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObject( this.meshPoints );
            if(!intersections.length)
                return;

            const intersection = intersections.length > 0 ? intersections[ 0 ] : null;

            if(intersection) {
                
                this.selectedPoint = intersection.index;
                //let boneName = this.skeletonHelper.bones[this.selectedBone].name;

                 this.mustUpdate = true;
                // this.editor.gui.updateSidePanel(null, boneName);
                // this.editor.gui.timeline.setSelectedBone( boneName );
                 this.updatePointsColors();
            }
        });

        canvas.addEventListener( 'keydown', e => {

            switch ( e.key ) {

                case 'q':
                    transform.setSpace( transform.space === 'local' ? 'world' : 'local' );
                    this.editor.gui.updateSidePanel();
                    break;

                case 'Shift':
                    transform.setTranslationSnap( this.editor.defaultTranslationSnapValue );
                    transform.setRotationSnap( THREE.MathUtils.degToRad( this.editor.defaultRotationSnapValue ) );
                    break;

                case 'w':
                    const bone = this.editor.skeletonHelper.bones[this.selectedBone];
                    if(timeline.getNumTracks(bone) < 2) // only rotation
                    return;
                    transform.setMode( 'translate' );
                    this.editor.gui.updateSidePanel();
                    break;

                case 'x':
                    transform.showX = ! transform.showX;
                    break;

                case 'y':
                    transform.showY = ! transform.showY;
                    break;

                case 'z':
                    if(e.ctrlKey){

                        if(!this.undoSteps.length)
                        return;
                        
                        const step = this.undoSteps.pop();
                        let bone = this.editor.skeletonHelper.bones[step.boneId];
                        bone.position.fromArray( step.pos );
                        bone.quaternion.fromArray( step.quat );
                        this.updateRig();
                    }
                    else
                        transform.showZ = ! transform.showZ;
                    break;
            }

        });

        window.addEventListener( 'keyup', function ( event ) {

            switch ( event.key ) {

                case 'Shift': // Shift
                    transform.setTranslationSnap( null );
                    break;
            }
        });
    }

    attachObject() {

        this.mustUpdate = false; 

        this.transform.attach( this.mesh.children[this.selectedPoint] );

        if( this.transform.constraint !== null ) {
            
            // Set new max translation constraints
            
            let dPos = this.defaultPositions[this.selectedPoint];
            
            this.transform.constraint.setFromPointAndOffset( dPos, this.maxBlendShapeTranslationOffset );

            // Add constraint helper
            
            if( this.helper !== null ) {
                this.helper.removeFromParent();
                delete this.helper;
                this.helper = null;
            }

            const size = this.maxBlendShapeTranslationOffset * 2;
            const helper = new THREE.BoxHelper( new THREE.Mesh( new THREE.BoxGeometry( size, size, size ) ) );
            helper.material = new THREE.MeshBasicMaterial( {
                depthTest: false,
                depthWrite: false,
                fog: false,
                toneMapped: false,
                transparent: true
            } );
            helper.material.color.setHex( 0x444444 );
            helper.material.opacity = 0.75;
            helper.position.copy( dPos );
            helper.updateMatrix();
            this.helper = helper;
            this.editor.scene.add( helper );
        }

        // Detach skeleton gizmo
        
        this.editor.gizmo.stop();

    }

    update(state, dt) {

        if(state) this.updateRig(dt);

        if(this.selectedPoint === null || !this.mustUpdate)
            return;

        this.attachObject();
    }

    updateRig( dt ) {

        if(!this.meshPoints)
            return;

        let vertices = [];

        for(let point of this.mesh.children) {
            let tempVec = new THREE.Vector3();
            point.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }

        this.meshPoints.geometry.setFromPoints(vertices);
        this.meshPoints.geometry.computeBoundingSphere();
    }

    updateBlendshapes(target) {
        let name = this.map[this.selectedPoint];
        let bs = {};
        let max = this.maxBlendShapeTranslationOffset;
        let offsets = new THREE.Vector3();
        offsets.subVectors(target.worldPosition, this.defaultPositions[this.selectedPoint]);;

        for(let i = 0; i < this.blendshapesMap[name].x.length; i++) {
            let bsName = this.blendshapesMap[name].x[i];
            let sign = 1;
            if(bsName.includes('-')) {
                bsName = bsName.replace('-', '');
                sign = -1;
            }
            bs[bsName] = -sign*offsets.x/max;
        }
        for(let i = 0; i < this.blendshapesMap[name].y.length; i++) {
            let bsName = this.blendshapesMap[name].y[i];
            let sign = 1;
            if(bsName.includes('-')) {
                bsName = bsName.replace('-', '');
                sign = -1;
            }
            bs[bsName] = -sign*offsets.y/max;
        }

        for(let i = 0; i < this.blendshapesMap[name].z.length; i++) {
            let bsName = this.blendshapesMap[name].z[i];
            let sign = 1;
            if(bsName.includes('-')) {
                bsName = bsName.replace('-', '');
                sign = -1;
            }
            bs[bsName] = sign*offsets.z/max;
        }
        this.editor.updateBlendshapes(bs);
    }

    updatePointsColors() {
        const geometry = this.meshPoints.geometry;
        const positionAttribute = geometry.getAttribute( 'position' );
        const colors = [];
        const color = new THREE.Color(0.33, 0.8, 0.75);
        const colorSelected = new THREE.Color(0.9, 0.9, 0.3);

        for ( let i = 0, l = positionAttribute.count; i < l; i ++ ) {
            (i != this.selectedPoint ? color : colorSelected).toArray( colors, i * 3 );
        }

        geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
    }

    updateTracks() {

        let timeline = this.editor.gui.timeline;
        let keyType = 'weight';// FacialRig.ModeToKeyType[ this.editor.getGizmoMode() ];

        if(timeline.onUpdateTracks( keyType ))
        return; // Return if event handled

        if(!timeline.getNumKeyFramesSelected())
        return;

        let [name, trackIndex, keyFrameIndex] = timeline._lastKeyFramesSelected[0];
        let track = timeline.getTrack(timeline._lastKeyFramesSelected[0]);

        // Don't store info if we are using wrong mode for that track
        if(keyType != track.type)
        return;

        let bone = this.skeletonHelper.getBoneByName(name);

        let start = track.dim * keyFrameIndex;
        let values = bone[ track.type ].toArray();

        if(!values)
            return;

        const idx = track.clip_idx;
        track.edited[ keyFrameIndex ] = true;

        // supports position and quaternion types
        for( let i = 0; i < values.length; ++i ) {
            this.editor.animationClip.tracks[ idx ].values[ start + i ] = values[i];
        }

        // Update animation interpolants
        this.editor.updateAnimationAction( idx );
        timeline.onSetTime( timeline.current_time );
    }

    setBone( name ) {

        let bone = this.skeletonHelper.skeleton.getBoneByName(name);
        if(!bone) {
            console.warn("No bone with name " + name);
            return;
        }

        const boneId = this.skeletonHelper.bones.findIndex((bone) => bone.name == name);
        if(boneId > -1){
            this.selectedBone = boneId;
            this.updateBoneColors();
        }
    }

    setMode( mode ) {
        this.transform.setMode( mode );
    }

    setSpace( space ) {
        this.transform.setSpace( space );
    }


    onGUI() {

        this.updateRig();
        this.updateTracks();
    }
    
};
export { FacialRig };