import * as THREE from 'three';
import {BehaviourManager} from './libs/BehaviourManager.js'
import {FacialExpr} from './libs/BehaviourRealizer.js'

class Controller {

    constructor(editor) {

        if(!editor)
        throw("No editor to attach Controller!");

        this.undoSteps = [];

        let scene = editor.scene;

        this.camera = editor.camera;
        this.scene = scene;

        this.editor = editor;
        
        this.bmlManager = new BehaviourManager();
        // Update in first iteration
        this.mustUpdate = false; //true; 
        if(!editor.morphTargets)
            console.warn("No morph targets to attach Controller!");
        this.morphDictionary = editor.morphTargets;
        this.morphTargets = [];
        this.morphTargets.length = Object.keys(this.morphDictionary).length; 

    }

    begin(timeline) {
        
        this.bindEvents(timeline);
        
        // First update to get bones in place
        this.update(true, 0.0);

    }

    stop() {

    }

    bindEvents(timeline) {

        timeline = timeline || this.editor.gui.NMFtimeline;
        if(!timeline)
            return;

        let canvas = timeline._canvas;
        if(!canvas)
            canvas = this.editor.gui.timelineNMFCTX.canvas;

        canvas.onkeyup = (e) => {

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
                case 'Delete':
                    timeline.deleteClip();
                    break;
            }

        };
    }

    update(state, dt) {

        //if(state) this.updateBlendShapes(dt);

    }

    updateBlendShapes( dt ) {
         // FacialExpr lexemes
         for (let k = 0; k < this.lexemes.length; k++) {
            let lexeme = this.lexemes[k];
            if (lexeme.transition) {
                lexeme.updateLexemesBSW(dt);
                // accumulate blendshape values
                for (let i = 0; i < lexeme.indicesLex.length; i++) {
                    for (let j = 0; j < lexeme.indicesLex[i].length; j++) {
                        let value = lexeme.currentLexBSW[i][j];
                        let index = lexeme.indicesLex[i][j];
                        this.morphTargets[index] += Math.abs(value); // denominator of biased average
                    }
                }
            }

            // remove lexeme if finished
            if (lexeme && !lexeme.transition) {
                this.lexemes.splice(k, 1);
                --k;
            }
        }
             
    }

    updateTracks(trackIdx) {

        let timeline = this.editor.gui.NMFtimeline;
        
        // if(timeline.onUpdateTracks( keyType ))
        // return; // Return if event handled

        // if(!timeline.clip_selected)
        // return;
        
        //convert each clip to BML json format
        let json = { faceLexeme: []};;

        for(let i = 0; i < timeline.clip.tracks.length; i++){
            let track = timeline.clip.tracks[i];
            for(let j = 0; j < track.clips.length; j++){
                let clip = track.clips[j];
                var data = ANIM.clipToJSON( clip );
                if(data)
                {
                    data[3].end = data[3].end || data[3].start + data[3].duration;
                    json.faceLexeme.push( data[3] );
                }
            }
        }
        if(!json.faceLexeme.length) return;

        this.lexemes = [];
        //manage bml blocks sync
        this.bmlManager.newBlock(json, 0);
        let dt = 1.0/timeline.framerate;
        let times = [];
        let values = [];
        for(let time = 0; time < timeline.duration; time+= dt){
            this.morphTargets.fill(0);
            times.push(time);
            //update blendshapes weights based on lexemes
            this.updateBlendShapes(dt);
            let bs = [];
            this.morphTargets.map((x) => bs.push(x));
            values.push(bs);
            //update bml blocks sync
            this.bmlManager.update((type,faceData) => this.lexemes.push(new FacialExpr(faceData, false, this.morphTargets)), time);
        }
        let tracks = [];
        //convert blendshapes weights to animation clip
        for(let morph in this.morphDictionary){
            let i = this.morphDictionary[morph];
            let v = [];
            values.forEach(element => {
                v.push(element[i]);
            });
            tracks.push(new THREE.NumberKeyframeTrack('Body.morphTargetInfluences['+ morph +']', times, v));
            tracks.push(new THREE.NumberKeyframeTrack('Eyelashes.morphTargetInfluences['+ morph +']', times, v));
        }
        this.editor.NMFclip = new THREE.AnimationClip("nmf", timeline.duration, tracks);
        console.log(this.editor.NMFclip )
        if(this.onUpdateTracks)
            this.onUpdateTracks();
        // let [name, trackIndex, keyFrameIndex] = timeline._lastKeyFramesSelected[0];
        // let track = timeline.getTrack(timeline._lastKeyFramesSelected[0]);

        // // Don't store info if we are using wrong mode for that track
        // if(keyType != track.type)
        // return;
       
       
       
       
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
    
    //on update values on gui inspector
    onGUI() {

        this.updateBlendShapes();
        this.updateTracks();
    }
    
};

export { Controller };