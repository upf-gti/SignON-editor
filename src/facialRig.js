import * as THREE from "three";
import { ShaderChunk } from "./utils.js";
import { TransformControls } from './controls/TransformControls.js';

class FacialRig {

    constructor(editor) {

        if(!editor)
        throw("No editor to attach Gizmo!");

        this.raycastEnabled = true;
        this.undoSteps = [];

        let transform = new TransformControls( editor.camera, editor.renderer.domElement );
        window.trans = transform;
        transform.setSpace( 'local' );
        transform.setMode( 'translate' );
        transform.addEventListener( 'change', editor.render );
        transform.setSize(0.5);

        transform.addEventListener( 'objectChange', e => {
            // let defPosition = this.defaultPositions[this.selectedPoint];
            // let tempVec = e.target.worldPosition;
            // tempVec.x = tempVec.x > 1 ? 3: tempVec.x;//Math.min(Math.max(tempVec.x, -0.5), defPosition.x + 1);
            // tempVec.y = Math.min(Math.max(tempVec.y, defPosition.y - 1), defPosition.y + 1);
            // tempVec.z = Math.min(Math.max(tempVec.z, defPosition.z - 1), defPosition.z + 1);
           
           // e.target.position.copy(e.target.worldToLocal(tempVec));
            this.updateBlendshapes();

            if(this.selectedPoint != null) {
                
                //editor.gui.updateBlendshapesProperties();
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

        let scene = editor.scene;
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

    begin(mesh) {
        
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
        
        // First update to get bones in place
        this.update(true, 0.0);

        if(this.selectedPoint != null) 
            this.updatePointsColors();
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
                        this.updateBlendshapes();
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

    update(state, dt) {

        if(state) this.updateBlendshapes(dt);

        if(this.selectedPoint == null || !this.mustUpdate)
            return;

        this.transform.attach( this.mesh.children[this.selectedPoint] );
        this.mustUpdate = false; 
    }

    updateBlendshapes( dt ) {

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
        let keyType = FacialRig.ModeToKeyType[ this.editor.getGizmoMode() ];

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

    showOptions( inspector ) {
        inspector.addNumber( "Translation snap", this.editor.defaultTranslationSnapValue, { min: 0.5, max: 5, step: 0.5, callback: (v) => {
            this.editor.defaultTranslationSnapValue = v;
            this.editor.updateGizmoSnap();
        }});
        inspector.addNumber( "Rotation snap", this.editor.defaultRotationSnapValue, { min: 15, max: 180, step: 15, callback: (v) => {
            this.editor.defaultRotationSnapValue = v;
            this.editor.updateGizmoSnap();
        }});
        inspector.addSlider( "Size", this.editor.getGizmoSize(), { min: 0.2, max: 2, step: 0.1, callback: (v) => {
            this.editor.setGizmoSize(v);
        }});
        inspector.addTitle("Bone markers")
        inspector.addSlider( "Size", this.editor.getGizmoSize(), { min: 0.01, max: 1, step: 0.01, callback: (v) => {
            this.editor.setBoneSize(v);
        }});

        const depthTestEnabled = this.bonePoints.material.depthTest;
        inspector.addCheckbox( "Depth test", depthTestEnabled, (v) => { this.bonePoints.material.depthTest = v; })
    }

    onGUI() {

        this.updateBlendshapes();
        this.updateTracks();
    }
    
};

FacialRig.ModeToKeyType = {
    'Translate': 'position',
    'Rotate': 'quaternion',
    'Scale': 'scale'
};

export { FacialRig };