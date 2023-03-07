import * as THREE from 'three';

class Controller {

    constructor(editor) {

        if(!editor)
        throw("No editor to attach Controller!");

        this.undoSteps = [];

        let scene = editor.scene;

        this.camera = editor.camera;
        this.scene = scene;

        this.editor = editor;

        // Update in first iteration
        this.mustUpdate = false; //true; 
    }

    begin() {
        
        this.bindEvents();
        
        // First update to get bones in place
        this.update(true, 0.0);

    }

    stop() {

    }

    bindEvents() {

        
        let timeline = this.editor.gui.timeline;

        const canvas = document.getElementById("webgl-canvas");

        canvas.addEventListener( 'keydown', e => {

            switch ( e.key ) {

                case 'z':
                    if(e.ctrlKey){

                        if(!this.undoSteps.length)
                            return;
                        
                        const step = this.undoSteps.pop();
                        for ( let i = 0; i < step.length; ++i){
                           //undo step
                        }
                        //update timeline
                        
                    }
                    break;
            }

        });
    }

    update(state, dt) {

        if(state) this.updateBlendShapes(dt);

    }

    updateBlendShapes( dt ) {

       
    }

    updateTracks() {

        let timeline = this.editor.gui.NMFtimeline;

        if(timeline.onUpdateTracks( keyType ))
        return; // Return if event handled

        if(!timeline.getNumKeyFramesSelected())
        return;

        let [name, trackIndex, keyFrameIndex] = timeline._lastKeyFramesSelected[0];
        let track = timeline.getTrack(timeline._lastKeyFramesSelected[0]);

        // Don't store info if we are using wrong mode for that track
        if(keyType != track.type)
        return;
       
       
        // if ( this.toolSelected == Gizmo.Tools.ik ){
        //     if ( !this.ikSelectedChain ){ return; }
            
        //     const effectorFrameTime = this.editor.animationClip.tracks[ track.clip_idx ].times[ keyFrameIndex ];
        //     const timeThreshold = ( timeline.framerate < 60 ) ? 0.008 : ( 0.5 * 1.0 / timeline.framerate );
            
        //     const chain = this.ikSelectedChain.chain;
            
        //     for( let i = 0; i < chain.length; ++i ){
        //         const boneToProcess = this.skeleton.bones[chain[i]];
        //         const quaternionTrackIdx = ( timeline.getNumTracks(boneToProcess) > 1 ) ? 1 : 0;
                
        //         let track = timeline.getTrack([boneToProcess.name, quaternionTrackIdx]);
        //         if ( track.dim != 4 ){ continue; }
                
        //         let values = boneToProcess[ track.type ].toArray();
        //         if( !values ){ continue; }

        //         let nearestTime = timeline.getNearestKeyFrame( this.editor.animationClip.tracks[ track.clip_idx ], effectorFrameTime );
        //         let keyframe = null;
                
        //         // find nearest frame or create one if too far
        //         if ( Math.abs( nearestTime - effectorFrameTime ) > 0.008 ){ 
        //             const currentTime = timeline.current_time;
        //             timeline.current_time = effectorFrameTime;
        //             keyframe = timeline.addKeyFrame( track ); //Works with current time.  current_time and selected frame time might not be the same
        //             timeline.current_time = currentTime;
        //         }
        //         else{ 
        //             keyframe = timeline.getCurrentKeyFrame( this.editor.animationClip.tracks[ track.clip_idx ], nearestTime, 0.0001 );
        //         }
        //         if ( isNaN(keyframe) ){ continue; }
                
        //         let start = 4 * keyframe;
        //         for( let j = 0; j < values.length; ++j ) {
        //             this.editor.animationClip.tracks[ track.clip_idx ].values[ start + j ] = values[j];
        //         }

        //         track.edited[ keyframe ] = true;

        //         // Update animation interpolants
        //         this.editor.updateAnimationAction( track.clip_idx );
        //         timeline.onSetTime( timeline.current_time );

        //     }
        // }
        // else{
        //     let start = track.dim * keyFrameIndex;
        //     let values = bone[ track.type ].toArray();
    
        //     if(!values)
        //         return;
    
        //     const idx = track.clip_idx;
        //     track.edited[ keyFrameIndex ] = true;

        //     // supports position and quaternion types
        //     for( let i = 0; i < values.length; ++i ) {
        //         this.editor.animationClip.tracks[ idx ].values[ start + i ] = values[i];
        //     }

        //     // Update animation interpolants
        //     this.editor.updateAnimationAction( idx );
        //     timeline.onSetTime( timeline.current_time );

        // }

    }



    showOptions( inspector ) {
        // inspector.addNumber( "Translation snap", this.editor.defaultTranslationSnapValue, { min: 0.5, max: 5, step: 0.5, callback: (v) => {
        //     this.editor.defaultTranslationSnapValue = v;
        //     this.editor.updateGizmoSnap();
        // }});
        // inspector.addNumber( "Rotation snap", this.editor.defaultRotationSnapValue, { min: 15, max: 180, step: 15, callback: (v) => {
        //     this.editor.defaultRotationSnapValue = v;
        //     this.editor.updateGizmoSnap();
        // }});
        // inspector.addSlider( "Size", this.editor.getGizmoSize(), { min: 0.2, max: 2, step: 0.1, callback: (v) => {
        //     this.editor.setGizmoSize(v);
        // }});
        // inspector.addTitle("Bone markers")
        // inspector.addSlider( "Size", this.editor.getGizmoSize(), { min: 0.01, max: 1, step: 0.01, callback: (v) => {
        //     this.editor.setBoneSize(v);
        // }});

        // const depthTestEnabled = this.bonePoints.material.depthTest;
        // inspector.addCheckbox( "Depth test", depthTestEnabled, (v) => { this.bonePoints.material.depthTest = v; })
    }

    onGUI() {

        this.updateBlendShapes();
        this.updateTracks();
    }
    
};

export { Controller };