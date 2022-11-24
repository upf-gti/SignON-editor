import * as THREE from './libs/three.module.js';
import { ShaderChunk } from "./utils.js";
import { TransformControls } from './controls/TransformControls.js';
import { FABRIKSolver } from "./IKSolver.js"

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

        transform.addEventListener( 'objectChange', e => {
            this.mustUpdate = true;
            this.updateBones();

            if(this.selectedBone != null) {
                editor.gui.updateBoneProperties();
            }
        });

        transform.addEventListener( 'mouseUp', e => {
            this.mustUpdate = false;

            if(this.selectedBone === undefined)
            return;
            this.updateTracks();
        } );

        transform.addEventListener( 'dragging-changed', e => {
            const enabled = e.value;
            editor.controls.enabled = !enabled;
            this.raycastEnabled = !enabled;//!this.raycastEnabled;
            
            if(this.selectedBone == null)
            return;

            
            if(enabled) {
                if ( this.toolSelected == Gizmo.Tools.ik ){
                    if ( !this.ikSelectedChain ){
                        return; 
                    }
       
                    let step = [];
                    let chain = this.ikSelectedChain.chain;
                    for ( let i = 1; i < chain.length; ++i){ // effector does not change
                        const bone = this.editor.skeletonHelper.bones[chain[i]];
                        step.push( {
                            boneId: chain[i],
                            pos: bone.position.toArray(),
                            quat: bone.quaternion.toArray(),
                        } );
                    }
                    if ( step.length > 0 ){                      
                        this.undoSteps.push( step );
                    }
                }else{
                    const bone = this.editor.skeletonHelper.bones[this.selectedBone];
            
                    this.undoSteps.push( [{
                        boneId: this.selectedBone,
                        pos: bone.position.toArray(),
                        quat: bone.quaternion.toArray(),
                    }] );
                }
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

        this.toolSelected = Gizmo.Tools.joint;
        this.mode = "rotate";
    }

    begin(skeletonHelper) {
        
        this.skeletonHelper = skeletonHelper;
        this.ikInit();

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

        
        let vertices = [];
        
        for(let bone of skeletonHelper.bones) {
            let tempVec = new THREE.Vector3();
            bone.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }
        
        this.selectedBone = vertices.length ? 0 : null;
        
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints(vertices);
        
        const positionAttribute = geometry.getAttribute( 'position' );
        const size = 0.5;
        geometry.setAttribute( 'size', new THREE.Float32BufferAttribute( new Array(positionAttribute.count).fill(size), 1 ) );

        this.bonePoints = new THREE.Points( geometry, pointsShaderMaterial );
        this.bonePoints.name = "GizmoPoints";
        this.bonePoints.renderOrder = 1;
        this.scene.remove(this.scene.getObjectByName("GizmoPoints"));
        this.scene.add( this.bonePoints );
        
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.05;
        
        this.bindEvents();
        
        // First update to get bones in place
        this.update(true, 0.0);

        if(this.selectedBone != null) 
            this.updateBoneColors();

    }

    ikInit() {
        this.ikTarget = new THREE.Object3D();
        this.ikTarget.name = "ikTarget";
        let scene = this.editor.scene;
        scene.add( this.ikTarget );
        
        this.ikSolver = new FABRIKSolver( this.skeletonHelper.skeleton );
        this.ikSolver.setIterations( 1 );
        this.ikSolver.setSquaredDistanceThreshold( 0.000001 );

        this.ikSelectedChain = null;
        this._ikCreateChains( "HeadTop_End", "Spine" );
        this._ikCreateChains( "LeftToe_End", "LeftUpLeg" );
        this._ikCreateChains( "RightToe_End", "RightUpLeg" );
        
        this._ikCreateChains( "LeftHandThumb4",  "LeftShoulder" );
        this._ikCreateChains( "LeftHandIndex4",  "LeftShoulder" );
        this._ikCreateChains( "LeftHandMiddle4", "LeftShoulder" );
        this._ikCreateChains( "LeftHandRing4",   "LeftShoulder" );
        this._ikCreateChains( "LeftHandPinky4",  "LeftShoulder" );
        
        this._ikCreateChains( "RightHandThumb4",  "RightShoulder" );
        this._ikCreateChains( "RightHandIndex4",  "RightShoulder" );
        this._ikCreateChains( "RightHandMiddle4", "RightShoulder" );
        this._ikCreateChains( "RightHandRing4",   "RightShoulder" );
        this._ikCreateChains( "RightHandPinky4",  "RightShoulder" );
        
        this.ikSolver.setChainEnablerAll( false );
    }

    _ikCreateChains( effectorName, rootName ){
        let bones = this.skeletonHelper.bones;
        let effector = this.skeletonHelper.getBoneByName( effectorName );
        let root = this.skeletonHelper.getBoneByName( rootName );
        
        if ( !effector ){ // find similarly named bone
            for ( let i= 0; i < bones.length; ++i ){
                if( bones[i].name.includes(effectorName) ){ 
                    effector = bones[i]; 
                    break;
                }
            } 
        }
        if ( !root ){ // bind similarly named bone
            for ( let i= 0; i < bones.length; ++i ){
                if( bones[i].name.includes(rootName) ){ 
                    root = bones[i]; 
                    break;
                }
            } 
        }
        if ( !effector || !root ){  return; }

        let chain = []
        
        while ( true ){
            let i = bones.indexOf( effector );
            if ( i < 0 ){ console.warn("IK chain: Skeleton root was reached before chain root "); break; }
            
            chain.push( i );
            // TO DO : insert here a constraint, depending on the name of the bone 
            if ( effector == root ){ break; }
            effector = effector.parent;
        }
//        chain.push( bones.indexOf( root ) );

        
        effector = bones[ chain[0] ];
        
        while ( effector != root ){
            if( ! this.ikSolver.getChain( effector.name ) ){
                this.ikSolver.createChain( chain, null, this.ikTarget, effector.name );
            }
            chain.splice(0,1);
            effector = bones[ chain[0] ];
        }
    }

    ikSetTargetToBone (){
        if( !this.ikSelectedChain ){ return; }
        this.skeletonHelper.bones[ this.selectedBone ].updateMatrixWorld();
        this.skeletonHelper.bones[ this.selectedBone ].parent.updateMatrixWorld();
        this.skeletonHelper.bones[ this.selectedBone ].getWorldPosition( this.ikTarget.position );
    }
    ikSetBone( boneIdx ){
        this.ikSolver.setChainEnablerAll( false );
        this.transform.detach();
        this.ikSelectedChain = null;
        
        let enabled = this.ikSolver.setChainEnabler( this.skeletonHelper.bones[ boneIdx ].name, true );
        if ( !enabled ){ return false; }
        
        this.ikSelectedChain = this.ikSolver.getChain( this.skeletonHelper.bones[ boneIdx ].name );

        this.ikSetTargetToBone();
        this.transform.attach( this.ikTarget );
        return true;
    }
    ikStop() {
        this.ikSelectedChain = null;
    }

    stop() {
        this.transform.detach();
        this.ikStop();
    }

    bindEvents() {

        if(!this.skeletonHelper)
            throw("No skeleton");

        let transform = this.transform;
        let timeline = this.editor.gui.timeline;

        const canvas = document.getElementById("webgl-canvas");

        canvas.addEventListener( 'mousemove', e => {

            if(!this.bonePoints || this.editor.state)
            return;

            const pointer = new THREE.Vector2(( e.offsetX / canvas.clientWidth ) * 2 - 1, -( e.offsetY / canvas.clientHeight ) * 2 + 1);
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObject( this.bonePoints );
            canvas.style.cursor = intersections.length ? "crosshair" : "default";
        });

        canvas.addEventListener( 'pointerdown', e => {

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

                this.setTool( this.toolSelected ); // updates panel already

                this.editor.gui.timeline.setSelectedBone( boneName );
                this.updateBoneColors();
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
                    this.setTool( Gizmo.Tools.joint );
                    this.setMode( "translate" );
                    this.editor.gui.updateSidePanel();
                    break;

                case 'e':
                    this.setTool( Gizmo.Tools.joint );
                    this.setMode( "rotate" );
                    this.editor.gui.updateSidePanel();
                    break;

                case 'r':
                    this.setTool( Gizmo.Tools.ik );
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
                        for ( let i = 0; i < step.length; ++i){
                            let bone = this.editor.skeletonHelper.bones[step[i].boneId];
                            bone.position.fromArray( step[i].pos );
                            bone.quaternion.fromArray( step[i].quat );
                        }
                        this.updateBones();
                        if ( this.toolSelected == Gizmo.Tools.ik ){ // reset target position
                            this.ikSetTargetToBone( );
                        }
                    }
                    else{
                        transform.showZ = ! transform.showZ;
                    }
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

        
        if(this.selectedBone == null ){ return; }
        
        if ( !this.mustUpdate ){
            if ( this.toolSelected == Gizmo.Tools.ik ){ // in case of dragging timeline, make target follow bone
                this.ikSetTargetToBone();
            }
            return;
        }
        
        if ( this.ikSelectedChain ){
            this.ikSolver.update(); 
            this.updateBones();
            this.editor.gui.updateBoneProperties();
        }
        //this.transform.attach( this.skeletonHelper.bones[this.selectedBone] );
        //this.mustUpdate = false; 
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

    updateTracks() {

        let timeline = this.editor.gui.timeline;
        let keyType = Gizmo.ModeToKeyType[ this.editor.getGizmoMode() ];

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
            this.setTool( this.toolSelected );
            this.updateBoneColors();
        }
    }

    setMode( mode ) {
        if ( this.toolSelected == Gizmo.Tools.joint ){ 
            this.mode = mode;
            this.transform.setMode( mode );
        }
    }

    setSpace( space ) {
        this.transform.setSpace( space );
    }

    setTool( tool ){
        this.toolSelected = Gizmo.Tools.joint;

        let ikResult = false;
        if ( tool == Gizmo.Tools.ik ){
            this.toolSelected = tool;
            this.mode = "rotate";
            this.transform.setMode( "translate" ); // ik moves target, but rotates joints
            ikResult = this.ikSetBone( this.selectedBone );
        }
        if ( !ikResult ){
            this.toolSelected = Gizmo.Tools.joint;
            this.ikStop();
            this.transform.setMode( this.mode );
            this.transform.attach( this.skeletonHelper.bones[this.selectedBone] );
        }

        this.editor.gui.updateSidePanel(null, this.skeletonHelper.bones[ this.selectedBone ].name );

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

        this.updateBones();
        this.updateTracks();
    }
    
};

Gizmo.ModeToKeyType = {
    'Translate': 'position',
    'Rotate': 'quaternion',
    'Scale': 'scale'
};

Gizmo.Tools = {
    joint : 0,
    ik : 1
}
export { Gizmo };