import * as THREE from "three";
import { ShaderChunk } from "./utils.js";
import { TransformControls } from './controls/TransformControls.js';

class Gizmo {

    constructor(editor) {

        if(!editor)
        throw("No editor to attach Gizmo!");

        this.raycastEnabled = true;
        this.undoSteps = [];

        let transform = new TransformControls( editor.camera, editor.renderer.domElement );
        window.trans = transform;
        transform.setSpace( 'local' );
        transform.setMode( 'rotate' );
        transform.addEventListener( 'change', editor.render );

        transform.addEventListener( 'objectChange', (e) => {
            if(this.selectedBone === undefined)
            return;
            this.updateTracks(true);
        } );

        transform.addEventListener( 'dragging-changed', (e) => {
            const enabled = e.value;
            editor.controls.enabled = !enabled;
            this.raycastEnabled = !this.raycastEnabled;
            
            if(this.selectedBone == null)
            return;

            const bone = this.editor.skeletonHelper.bones[this.selectedBone];

            if(enabled) {
                this.undoSteps.push( {
                    boneId: this.selectedBone,
                    pos: bone.position.toArray(),
                    quat: bone.quaternion.toArray(),
                } );
            }else {
                editor.gui.updateSidePanel(null, bone.name);
            }
        });

        let scene = editor.scene;
        scene.add( transform );

        this.camera = editor.camera;
        this.scene = scene;
        this.transform = transform;
		this.raycaster = null;
        this.selectedBone = null;
        this.bonePoints = null;
        this.editor = editor;

        // Update in first iteration
        this.mustUpdate = true; 
    }

    begin(skeletonHelper) {
        
        this.skeletonHelper = skeletonHelper;

        // point cloud for bones
        const pointsShaderMaterial = new THREE.ShaderMaterial( {
            uniforms: {
                color: { value: new THREE.Color( 0xffffff ) },
                pointTexture: { value: new THREE.TextureLoader().load( 'data/imgs/disc.png' ) },
                alphaTest: { value: 0.9 }
            },
            vertexShader: ShaderChunk["Point"].vertexshader,
            fragmentShader: ShaderChunk["Point"].fragmentshader
        });

        const geometry = new THREE.BufferGeometry();

        let vertices = [];

        for(let bone of skeletonHelper.bones) {
            let tempVec = new THREE.Vector3();
            bone.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }

        this.selectedBone = vertices.length ? 0 : null;

        geometry.setFromPoints(vertices);
        
        const positionAttribute = geometry.getAttribute( 'position' );
        const sizes = [];

        for ( let i = 0, l = positionAttribute.count; i < l; i ++ ) {
            sizes[i] = 0.5;
        }

        geometry.setAttribute( 'size', new THREE.Float32BufferAttribute( sizes, 1 ) );

        this.bonePoints = new THREE.Points( geometry, pointsShaderMaterial );
        this.scene.add( this.bonePoints );
        
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.05;
        
        this.bindEvents();
        
        // First update to get bones in place
        this.update(true, 0.0);

        if(this.selectedBone != null) 
            this.updateBoneColors();
    }

    stop() {
        this.transform.detach();
    }

    bindEvents() {

        if(!this.skeletonHelper)
            throw("No skeleton");

        let transform = this.transform;

        const canvas = document.getElementById("webgl-canvas");

        canvas.addEventListener( 'mousemove', (e) => {

            if(!this.bonePoints || this.editor.state)
            return;

            const pointer = new THREE.Vector2(( e.offsetX / canvas.clientWidth ) * 2 - 1, -( e.offsetY / canvas.clientHeight ) * 2 + 1);
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObject( this.bonePoints );
            canvas.style.cursor = intersections.length ? "crosshair" : "default";
        });

        canvas.addEventListener( 'pointerdown', (e) => {

            if(e.button != 0 || !this.bonePoints || this.editor.state || (!this.raycastEnabled && !e.ctrlKey))
            return;

            const pointer = new THREE.Vector2(( e.offsetX / canvas.clientWidth ) * 2 - 1, -( e.offsetY / canvas.clientHeight ) * 2 + 1);
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObject( this.bonePoints );
            if(!intersections.length)
                return;

            const intersection = intersections.length > 0 ? intersections[ 0 ] : null;

            if(intersection) {
                this.selectedBone = intersection.index;
                let boneName = this.skeletonHelper.bones[this.selectedBone].name;

                this.mustUpdate = true;
                this.editor.gui.updateSidePanel(null, boneName);
                this.editor.gui.timeline.setSelectedBone( boneName );
                this.updateBoneColors();
            }
        });

        canvas.addEventListener( 'keydown', (e) => {

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
                    transform.setMode( 'translate' );
                    this.editor.gui.updateSidePanel();
                    break;

                case 'e':
                    transform.setMode( 'rotate' );
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
                        this.updateBones();
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
                    transform.setRotationSnap( null );
                    break;
            }
        });
    }

    update(state, dt) {

        if(state) this.updateBones(dt);

        if(this.selectedBone == null || !this.mustUpdate)
        return;

        this.transform.attach( this.skeletonHelper.bones[this.selectedBone] );
        this.mustUpdate = false; 
    }

    updateBones( dt ) {

        if(!this.bonePoints)
            return;

        let vertices = [];

        for(let bone of this.skeletonHelper.bones) {
            let tempVec = new THREE.Vector3();
            bone.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }

        this.bonePoints.geometry.setFromPoints(vertices);
        this.bonePoints.geometry.computeBoundingSphere();
    }

    updateBoneColors() {
        const geometry = this.bonePoints.geometry;
        const positionAttribute = geometry.getAttribute( 'position' );
        const colors = [];
        const color = new THREE.Color(0.9, 0.9, 0.3);
        const colorSelected = new THREE.Color(0.33, 0.8, 0.75);

        for ( let i = 0, l = positionAttribute.count; i < l; i ++ ) {
            (i != this.selectedBone ? color : colorSelected).toArray( colors, i * 3 );
        }

        geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
    }

    updateTracks(force) {

        this.updateBones();

        if(!force)
        return;

        let timeline = this.editor.gui.timeline;

        if(!timeline._lastKeyFramesSelected.length)
        return;

        // TODO: Apply all the same action
        let [name, trackIndex, keyFrameIndex] = timeline._lastKeyFramesSelected[0];
        let track = timeline.getTrack(timeline._lastKeyFramesSelected[0]);

        // Don't store info if we are using wrong mode for that track
        if(Gizmo.ModeToKeyType[ this.editor.getGizmoMode() ] != track.type)
        return;

        let bone = this.skeletonHelper.skeleton.getBoneByName(name);

        let start = track.dim * keyFrameIndex;
        let values = bone[ track.type ].toArray();

        if(!values)
            return;

        const idx = track.clip_idx;

        // supports position and quaternion types
        for( let i = 0; i < values.length; ++i ) {
            this.editor.animationClip.tracks[ idx ].values[ start + i ] = values[i];
        }

        // this.editor.mixer._actions[0].updateInterpolants();

        track.edited[ keyFrameIndex ] = true;
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
};

Gizmo.ModeToKeyType = {
    'Translate': 'position',
    'Rotate': 'quaternion',
    'Scale': 'scale'
};

export { Gizmo };