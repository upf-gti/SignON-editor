import { UTILS } from "./utils.js";
import { VideoUtils } from "./video.js"; 

class Gui {

    constructor(editor) {
       
        this.timelineVisible = false;
        this.showVideo = false;
        this.currentTime = 0;
        this.skeletonScroll = 0;
        this.editor = editor;

        this.faceAreas = {
            "rgb(255,0,255)": "Brow Left",
            "rgb(0,0,255)": "Brow Right",
            "rgb(0,255,0)": "Eye Left",
            "rgb(0,255,255)": "Eye Right",
            "rgb(255,0,0)": "Nose", 
            "rgb(255,255,0)": "Cheek Left",
            "rgb(255,255,255)": "Cheek Right",
            "rgb(125,0,0)": "Mouth",
            "rgb(0,125,0)": "Jaw"
        };

        this.boneProperties = {};

        this.create();
    }

    create() {

        // Create main area
        this.mainArea = LX.init();

        //Create capture video window
        this.createCaptureArea(this.mainArea);
        
        // Create menu bar
        this.createMenubar(this.mainArea);
        
        // split main area
        this.mainArea.split({sizes:["75%","25%"]});
        
        //left -> canvas, right -> side panel
        var [left, right] = this.mainArea.sections;
        left.id = "canvasarea";
        left.root.style.position = "relative";
        right.id = "sidepanel";
        this.canvasArea = left;
        this.sidePanel = right;
       
        //Create timelines (keyframes and clips)
        this.createTimelines(this.canvasArea);
    }
    
    /** -------------------- CAPTURE GUI (app) --------------------  */
    createCaptureArea(area) {
        // Create capture info area
        let mainCapture = document.getElementById("capture");
        let captureArea = document.getElementById("capture-area");
        const buttonContainer = document.createElement('div');
        //buttonContainer.style.margin = "0 auto";
        buttonContainer.style.display = "flex";
        const buttons = [
            {
                id: "capture_btn",
                text: " <i class='bi bi-record-circle' style= 'margin:5px; font-size:initial;'></i> Start recording"
            },
            {
                id: "trim_btn",
                text: "Convert to animation",
                display: "none",
                callback: () => VideoUtils.unbind( (start, end) => window.globals.app.onRecordLandmarks(start, end) )
            },
            {
                id: "redo_btn",
                text: " <i class='fa fa-redo'></i>",
                title: "Redo video",
                display: "none",
                callback: async () => {
                    
                    window.location.reload();
                }
            }
        ];

        for(let b of buttons) {
            const button = document.createElement("button");
            button.id = b.id;
            button.title = b.title || "";
            button.style.display = b.display || "block";
            button.innerHTML = b.text;
            button.classList.add("btn-primary", "captureButton");
            if(b.styles) Object.assign(button.style, b.styles);
            if(b.callback) button.addEventListener('click', b.callback);
            buttonContainer.appendChild(button);
        }
        captureArea.appendChild(buttonContainer);

        let videoArea = document.getElementById("video-area");
        videoArea.classList.add("video-area");
        videoArea.style.paddingTop = "0px";
        let i = document.createElement("i");
        i.id = "expand-capture-gui";
        i.style = "position: relative;top: 35px;left: -19px; width: 0px;";
        i.className = "fas fa-solid fa-circle-info drop-icon";//"fas fa-solid fa-circle-chevron-left drop-icon";

        i.addEventListener("click", () => this.changeCaptureGUIVisivility());

        let inspector = new LX.Panel({id:"capture-inspector"});//new LiteGUI.Inspector("capture-inspector");
        inspector.root.hidden = true;
        inspector.root.style.padding = "5px";
        inspector.addBlank();
        inspector.addTitle("User positioning");
        inspector.addTextArea(null, 'Position yourself centered on the image with the hands and troso visible. If the conditions are not met, reposition yourself or the camera.', null, { disabled: true, className: "auto" }) 
        
        inspector.addProgress('Distance to the camera', 0, {min:0, max:1, id: 'progressbar-torso'});
        inspector.addProgress('Left Hand visibility', 0, {min:0, max:1, id: 'progressbar-lefthand'});
        inspector.addProgress('Right Hand visibility', 0, {min:0, max:1, id: 'progressbar-righthand'});
        
        videoArea.appendChild(buttonContainer);

        inspector.branch("Blendshapes weights");
        inspector = this.createBlendShapesInspector(this.editor.mapNames, {inspector: inspector});
        inspector.root.style.maxHeight = "calc(100% - 57px)";
        inspector.root.style.overflowY = "scroll";
        inspector.root.style.flexWrap = "wrap";
        this.bsInspector = inspector;
        captureArea.appendChild(i);
        captureArea.appendChild(this.bsInspector.root)

        const selectContainer = document.createElement("div");
        selectContainer.id = "select-mode";
        selectContainer.className = "lexwidget";

        const label = document.createElement("label");
        label.innerText = "Input";
        label.setAttribute("for", "input");

        const selector = document.createElement("select");
        selector.setAttribute("name", "input");
        selector.className = "lexdropdown lexwidget";
        // selector.style.background = "none";
        // selector.style.margin = "1rem";
        selector.style="background: var(--background);margin: 1rem;border-radius: 5px;"

        const option1 = document.createElement("option");
        option1.innerText = "Webcam";
        option1.setAttribute("value", "webcam");
        const option2 = document.createElement("option");
        option2.innerText = "Video";
        option2.setAttribute("value", "video");
        let input = document.createElement("input");
        input.setAttribute("type", "file");
        input.addEventListener("change", (e) => {
            e.stopPropagation();
            const files = e.target.files;
            this.editor.__app.onLoadVideo( files[0] );
        })
        option2.appendChild(input);
        selector.appendChild(option1);
        selector.appendChild(option2);
        selectContainer.appendChild(label);
        selectContainer.appendChild(selector);
        videoArea.prepend(selectContainer);
 
        selector.onchange = (e) => {
            const value = e.target.value;
            if(value == "video") {
                input.value = "";
                input.click();
            }
            else if( value == "webcam") {
                this.editor.__app.onBeginCapture();
            }
            console.log(value)
        }
    }

    createBlendShapesInspector(bsNames, options = {}) {
        
        let inspector = options.inspector || new LX.Panel({id:"blendshapes-inspector"});
        
        // if(document.getElementById('blendshapes-inspector')) {
        //     document.getElementById('blendshapes-inspector').innerHTML = "";
        //     document.getElementById('blendshapes-inspector').remove();    
        // }
        if(options.clear)
            inspector.clear();
            
        if(inspector.id)
            inspector.addTitle(inspector.id);

        for(let name in bsNames) {
    
            inspector.addProgress(name, 0, {min: 0, max: 1, low: 0.3, optimum: 1, high: 0.6, editable: options.editable, showNumber: options.showNumber, callback: (v,e) => this.editor.updateBlendshapesProperties(name, v), signal: "@on_change_" + name});
        }
        
        return inspector;
    }

    /** Create timelines */
    createTimelines( area ) {

        this.keyFramesTimeline = new LX.KeyFramesTimeline("Bones");
        this.keyFramesTimeline.setFramerate(30);
        // this.keyFramesTimeline.setScale(400);
        this.keyFramesTimeline.hide();

        this.curvesTimeline = new LX.CurvesTimeline("Action Units");
        this.curvesTimeline.setFramerate(30);
        this.curvesTimeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.auAnimation.duration - 0.001) );
        this.curvesTimeline.onUpdateTrack = (idx) => this.editor.updateAnimationAction(this.curvesTimeline.animationClip, idx);
        this.curvesTimeline.onMouse = (e, time) => {
            if(e.type == "mousemove") {

            }
        }
        this.curvesTimeline.hide();

        this.clipsTimeline = new LX.ClipsTimeline("Non manual features", {});
        this.clipsTimeline.setFramerate(30);
        // this.clipsTimeline.setScale(400);
        this.clipsTimeline.hide();
        this.clipsTimeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.bodyAnimation.duration - 0.001) );
        // this.clipsTimeline.onSetDuration = (t) => {this.duration = this.keyFramesTimeline.duration = this.keyFramesTimeline.animationClip.duration = t};
        this.clipsTimeline.onSelectClip = this.showClipInfo.bind(this);
        this.clipsTimeline.animationClip = {duration: this.keyFramesTimeline.duration, tracks: []};
        this.clipsTimeline.canvas.addEventListener( 'keydown', (e) => {
            switch ( e.key ) {
                case " ": // Spacebar
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const stateBtn = document.getElementById("state_btn");
                    stateBtn.click();
                    break;
                case "Delete": // Delete
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.clipsTimeline.deleteClip();
                    this.clipsTimeline.optimizeTracks();
                    break;
                case "Backspace":
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.clipsTimeline.deleteClip();
                    this.clipsTimeline.optimizeTracks();
                    break;
            }
        });

        area.onresize = (bounding) => this.timelineArea.setSize(bounding);
        // Create timelines container area
        this.timelineArea = new LX.Area({ height: 400, overlay:"bottom", resize: true});
        this.timelineArea.attach(this.keyFramesTimeline.root);
        this.timelineArea.attach(this.curvesTimeline.root);
        this.timelineArea.attach(this.clipsTimeline.root);

        //Resize timelines on resize timeline container area
        this.timelineArea.onresize = (bounding) => {this.keyFramesTimeline.resize( [ bounding.width, bounding.height ] );}
        this.timelineArea.onresize = (bounding) => {this.curvesTimeline.resize( [ bounding.width, bounding.height ] );}
        this.timelineArea.onresize = (bounding) => {this.clipsTimeline.resize( [ bounding.width, bounding.height ] );}
        area.attach(this.timelineArea);
        this.timelineArea.hide();

    }

    /** Create menu bar */
    createMenubar(area) {

        this.menubar = area.addMenubar( m => {

            m.setButtonImage("SignON", "data/imgs/logo_SignON.png", () => {window.open("https://signon-project.eu/")}, {float: "left"});
            m.setButtonIcon("Github", "fa-brands fa-github", () => {window.open("https://github.com/upf-gti/SignON-editor")}, {float:"right"});

        });
    }

    initEditionGUI() {
        // Hide capture buttons
        let capture = document.getElementById("capture_btn");
        capture.disabled = true;
        capture.style.display = "none";

        let redo = document.getElementById("redo_btn");
        if(redo){
            redo.disabled = true;
            redo.style.display = "none";
        } 
            
        let trimBtn = document.getElementById("trim_btn");
        trimBtn.disabled = true;
        trimBtn.style.display = "none";

    
        // Reposition video the canvas elements
        let videoDiv = document.getElementById("capture");
        videoDiv.classList.remove("expanded");
        let videoRec = document.getElementById("recording");
        videoRec.classList.remove("hidden");
        videoRec.style.width = "100%";
        videoRec.style.height = "100%";
        

        videoRec.style.cssText+= "transform: rotateY(0deg);\
        -webkit-transform:rotateY(0deg); /* Safari and Chrome */\
        -moz-transform:rotateY(0deg); /* Firefox */"
    
        // Solve the aspect ratio problem of the video
        let videoCanvas = document.getElementById("outputVideo");
        let aspectRatio = videoDiv.width / videoDiv.height;
        videoRec.width  = videoDiv.width  = videoCanvas.width  = videoDiv.clientWidth;
        videoRec.height = videoDiv.height = videoCanvas.height = videoCanvas.width / aspectRatio;

        $(videoDiv).draggable({containment: "#canvasarea"}).resizable({ aspectRatio: true, containment: "#canvasarea"});

        this.hideCaptureArea();
        //Update menu bar
        this.updateMenubar();

    }

    loadKeyframeClip( clip ) {

        this.hideCaptureArea();
        
        this.clip = clip || { duration: 1};
        this.duration =  this.clip.duration;

        let boneName = null;
        if(this.editor.skeletonHelper.bones.length) {
            boneName = this.editor.skeletonHelper.bones[0].name;
        }

        let tracks = [];
        for(let i = 0; i < this.clip.tracks.length; i++) {
            if(this.clip.tracks[i].name.includes("position") && i > 0)
                continue;
            tracks.push(this.clip.tracks[i]);
        }
        this.clip.tracks = tracks;
        // this.timeline = new KeyFramesTimeline( this.editor.bodyAnimation, boneName);
        // this.keyFramesTimeline.show();
        this.keyFramesTimeline.setAnimationClip(this.clip);
       // this.keyFramesTimeline.setSelectedItems([boneName]);
        // this.keyFramesTimeline.resize([this.keyFramesTimeline.canvas.parentElement.clientWidth, this.keyFramesTimeline.canvas.parentElement.clientHeight]);
        this.keyFramesTimeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.bodyAnimation.duration - 0.001) );
        this.keyFramesTimeline.onSetDuration = (t) => {this.duration = this.keyFramesTimeline.duration = this.clip.duration = this.editor.bodyAnimation.duration = t};
        this.keyFramesTimeline.onSelectKeyFrame = (e, info, index) => {
            if(e.button != 2) {
                //this.editor.gizmo.mustUpdate = true
                this.editor.gizmo.update(true);
                this.updateSkeletonPanel({itemSelected:info[0]});

                return false;
            }

            // Change gizmo mode and dont handle
            // return false;

            this.showKeyFrameOptions(e, info, index);

            return true; // Handled
        };
        var that = this;
        this.keyFramesTimeline.showContextMenu = function ( e ) {
            
            e.preventDefault();
            e.stopPropagation();

            let actions = [];
            //let track = this.NMFtimeline.clip.tracks[0];
            if(this.lastKeyFramesSelected && this.lastKeyFramesSelected.length) {
                if(this.lastKeyFramesSelected.length == 1 && this.clipboard && this.clipboard.value)
                {
                    actions.push(
                        {
                            title: "Paste",// + " <i class='bi bi-clipboard-fill float-right'></i>",
                            callback: () => {
                                let [id, trackIdx, keyIdx] = this.lastKeyFramesSelected[0];
                                    this.pasteKeyFrameValue(e, this.tracksPerItem[id][trackIdx], keyIdx);
                            }
                        }
                    )
                }
                actions.push(
                    {
                        title: "Copy",// + " <i class='bi bi-clipboard-fill float-right'></i>",
                        callback: () => {
                            let toCopy = {};
                            for(let i = 0; i < this.lastKeyFramesSelected.length; i++){
                                let [id, trackIdx, keyIdx] = this.lastKeyFramesSelected[i];
                                if(toCopy[this.tracksPerItem[id][trackIdx].clipIdx]) {
                                    toCopy[this.tracksPerItem[id][trackIdx].clipIdx].idxs.push(keyIdx);
                                } else {
                                    toCopy[this.tracksPerItem[id][trackIdx].clipIdx] = {idxs : [keyIdx]};
                                    toCopy[this.tracksPerItem[id][trackIdx].clipIdx].track = this.tracksPerItem[id][trackIdx]
                                }                
                                if(i == 0) {
                                    this.copyKeyFrameValue(this.tracksPerItem[id][trackIdx], keyIdx)
                                }
                            }
                            for(let clipIdx in toCopy) {
                                
                                this.copyKeyFrames(toCopy[clipIdx].track, toCopy[clipIdx].idxs)
                            }
                           
                        }
                    }
                )
                actions.push(
                    {
                        title: "Delete",// + " <i class='bi bi-trash float-right'></i>",
                        callback: () => {
                            let keyframesToDelete = this.lastKeyFramesSelected;
                            e.multipleSelection = keyframesToDelete.length > 1 ?? false;
                            for(let i = 0; i < keyframesToDelete.length; i++){
                                this.deleteKeyFrame(e, keyframesToDelete[i][1], keyframesToDelete[i][2]);
                            }
                            // that.editor.optimizeTracks(this.animationClip.tracks);
                        }
                    }
                )
            }
            else{
                let [name, type] = [e.track.name, e.track.type]
                if(that.boneProperties[type]) {
                    
                    actions.push(
                        {
                            title: "Add",
                            callback: () => this.addKeyFrame( e.track, that.boneProperties[type].toArray() )
                        }
                    )
                }

                if(this.clipboard && this.clipboard.keyframes)
                {
                    actions.push(
                        {
                            title: "Paste",// + " <i class='bi bi-clipboard-fill float-right'></i>",
                            callback: () => {
                                let currentTime = this.currentTime;
                                for(let clipIdx in this.clipboard.keyframes) {
                                    let indices = Object.keys( this.clipboard.keyframes[clipIdx].values)
                                    this.pasteKeyFrames(e, clipIdx, indices);
                                    this.currentTime = currentTime;
                                }
                            }
                        }
                    )
                }
            }
            
            LX.addContextMenu("Options", e, (m) => {
                for(let i = 0; i < actions.length; i++) {
                    m.add(actions[i].title,  actions[i].callback )
                }
            });

        }

        this.keyFramesTimeline.onItemUnselected = () => this.editor.gizmo.stop();
        this.keyFramesTimeline.onUpdateTrack = (idx) => this.editor.updateAnimationAction(this.keyFramesTimeline.animationClip, idx);
        this.keyFramesTimeline.onGetSelectedItem = () => { return this.editor.getSelectedBone(); };
        this.keyFramesTimeline.onGetOptimizeThreshold = () => { return this.editor.optimizeThreshold; }
        this.keyFramesTimeline.onChangeTrackVisibility = (e, t, n) => {this.editor.updateAnimationAction(this.keyFramesTimeline.animationClip, null, true)}
        this.keyFramesTimeline.optimizeTrack = (idx, t) => { this.editor.optimizeTrack(idx, t)}
        this.editor.activeTimeline = this.keyFramesTimeline;
        this.createSidePanel();
            
        // Canvas UI buttons
        this.createSceneUI(this.canvasArea);

        // automatic optimization of keyframes
        this.editor.optimizeTracks();
        this.render();
    }

    updateMenubar() {
        // var that = this;
        let menubar = this.menubar;
        
        menubar.add("Project/Upload animation", {icon: "fa fa-upload", callback: () => this.editor.getApp().storeAnimation() });
 
        menubar.add("Project/");
        menubar.add("Project/Export Body Animation", {icon: "fa fa-file-export"});
        menubar.add("Project/Export Body Animation/Export BVH", { callback: () => this.editor.export('BVH') });
        menubar.add("Project/Export Face Animation", {icon: "fa fa-file-export"});
        menubar.add("Project/Export Face Animation/Export extended BVH", {callback: () => this.editor.export("BVH extended") });
        menubar.add("Project/Export Face Animation/Export BML", {callback: () => this.editor.export() });
        menubar.add("Project/Export all", {icon: "fa fa-download"});
        menubar.add("Project/Export all/Export GLB", {callback: () => this.editor.export('GLB') });
        menubar.add("Project/Open preview", {icon: "fa fa-street-view",  callback: () => this.editor.showPreview() });

        menubar.add("Editor/Manual Features", { id: "mf-mode", type: "checkbox", checkbox: this.editor.mode == this.editor.eModes.MF, callback: (v) => {
            this.changeEditorMode(this.editor.eModes.MF);
        }});
        menubar.add("Editor/Non-Manual Features", { id: "nmf-mode", type: "checkbox", checkbox: this.editor.mode == this.editor.eModes.NMF, callback: (v) => {
            this.changeEditorMode(this.editor.eModes.NMF);
        }});

        menubar.add("Timeline/Shortcuts", { disabled: true });
        menubar.add("Timeline/Shortcuts/Play-Pause", { short: "SPACE" });
        menubar.add("Timeline/Shortcuts/Zoom", { short: "Wheel" });
        menubar.add("Timeline/Shortcuts/Change time", { short: "Left Click+Drag" });
        menubar.add("Timeline/Shortcuts/Move keys", { short: "Hold CTRL" });
        menubar.add("Timeline/Shortcuts/Add keys", { short: "Right Click" });
        menubar.add("Timeline/Shortcuts/Delete keys");
        menubar.add("Timeline/Shortcuts/Delete keys/Single", { short: "DEL" });
        menubar.add("Timeline/Shortcuts/Delete keys/Multiple", { short: "Hold LSHIFT" });
        menubar.add("Timeline/Shortcuts/Key Selection");
        menubar.add("Timeline/Shortcuts/Key Selection/Single", { short: "Left Click" });
        menubar.add("Timeline/Shortcuts/Key Selection/Multiple", { short: "Hold LSHIFT" });
        menubar.add("Timeline/Shortcuts/Key Selection/Box", { short: "Hold LSHIFT+Drag" });

        menubar.add("Timeline/");
        menubar.add("Timeline/Empty tracks", { callback: () => this.editor.cleanTracks() });
        menubar.add("Timeline/Optimize tracks", { callback: () => this.editor.optimizeTracks() });
        if(this.showVideo)
            menubar.add("View/Show video", { type: "checkbox", checked: this.showVideo, callback: () => {
                const tl = document.getElementById("capture");
                tl.style.display = this.showVideo ? "flex": "none";
            }});
        menubar.add("View/Show timeline", { type: "checkbox", checked: this.timelineVisible, callback: (v) => {
            if(v)
                this.timelineArea.show();
            else
                this.timelineArea.hide();
        }});

        menubar.addButtons( [
            {
                title: "Play",
                icon: "fa-solid fa-play",
                callback:  (domEl) => { 
                    console.log("play!"); 
                    if(this.editor.state ) {
                        this.editor.onPause(this.editor, domEl);    
                    }
                    else {
                        
                        this.editor.onPlay(this.editor, domEl);
                    }
                    domEl.classList.toggle('fa-play'), domEl.classList.toggle('fa-pause');
                }
            },
            {
                title: "Stop",
                icon: "fa-solid fa-stop",
                callback:  (domEl) => { 
                    this.editor.onStop(this.editor, domEl);
                    console.log("pause!") 
                    if(this.menubar.getButton("Play").children[0].classList.contains("fa-pause")) 
                        this.menubar.getButton("Play").children[0].classList.toggle('fa-pause'), this.menubar.getButton("Play").children[0].classList.toggle('fa-play');
                }
            }
        ]);
       
    }

    changeEditorMode(mode)
    {
        // if(this.editor.onChangeMode)
        //     this.editor.onChangeMode(mode);

        // let splitbar = document.getElementById("timeline-splitbar");
        // let menubar = window.menubar.findMenu("Editor");
        // let mfmenu = window.menubar.findMenu("Editor/Manual Features");
        // let nmfmenu = window.menubar.findMenu("Editor/Non-Manual Features");

        // if(mode == this.editor.eModes.NMF){
        //     mfmenu.data.checkbox = false;
        //     mfmenu.enable();
        //     nmfmenu.disable();
        //     window.menubar.showMenu( menubar, null, menubar.element, false );

        //     if(!this.clipsTimeline) {
                        
        //         this.clipsTimeline = new ClipsTimeline(null, null, [this.keyFramesTimeline.size[0], this.keyFramesTimeline.size[1]], false);
        //         this.clipsTimeline.name = "Non-Manual Features";
        //         this.clipsTimeline.framerate = 30;
        //         this.clipsTimeline.setScale(400);
        //         this.clipsTimeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.bodyAnimation.duration - 0.001) );
        //         this.clipsTimeline.onSetDuration = (t) => {this.duration = this.keyFramesTimeline.duration = this.keyFramesTimeline.animationClip.duration = t};
        //         this.clipsTimeline.onSelectClip = this.showClipInfo.bind(this);
        //         this.clipsTimeline.onClipMoved = ()=> {
        //             this.editor.NMFController.updateTracks();
        //             this.clipsTimeline.onSetTime(this.clipsTimeline.currentTime) 
        //         };
        //         this.clipsTimeline.animationClip = {duration: this.keyFramesTimeline.duration, tracks: []};
        //         // this.clipsTimeline.addClip( new ANIM.FaceLexemeClip());
                
        //         this.clipsTimeline.onUpdateTrack = this.editor.NMFController.updateTracks.bind(this.editor.NMFController);
        //         this.editor.NMFController.begin(this.clipsTimeline);
        //         this.showNMFGuide();
                
        //     }
        //     else if( !this.clipsTimeline.animationClip) {
        //         this.clipsTimeline.onClipMoved = ()=> {
        //             this.editor.NMFController.updateTracks();
        //             this.clipsTimeline.onSetTime(this.clipsTimeline.currentTime) 
        //         };
        //         this.clipsTimeline.onSetDuration(this.keyFramesTimeline.duration);
        //         this.clipsTimeline.onUpdateTrack = this.editor.NMFController.updateTracks.bind(this.editor.NMFController);
        //         this.editor.NMFController.begin(this.clipsTimeline);
        //         this.showNMFGuide();
        //     }
        //     // splitbar.classList.remove("hidden");
        //     this.clipsTimeline.resize(this.keyFramesTimeline.size);
        //     this.keyFramesTimeline.active = false;
        //     // this.keyFramesTimeline.resize([this.keyFramesTimeline.size[0], this.keyFramesTimeline.size[1]*2 + 20])
           
        //     this.clipsTimeline.show();
        //     // let canvas = document.getElementById("timelineNMFCanvas")
        //     // canvas.style.display =  'block';
        //     // let canvasArea = document.getElementById("canvasarea");
        //     this.editor.resize(this.timelineArea.clientWidth, this.timelineArea.clientHeight);
            
        //     if(this.clipsTimeline.selectedClip)
        //         this.showClipInfo(this.clipsTimeline.selectedClip);
        //     this.updateSkeletonPanel();
        //     document.querySelector("[title='skeleton']").click()

        // }
        // else{
        //     // splitbar.classList.add("hidden");
        //     this.keyFramesTimeline.active = true;
        //     // this.keyFramesTimeline.resize([this.keyFramesTimeline.size[0], this.keyFramesTimeline.size[1]/2 - 20])
        //     this.clipsTimeline.hide();
        //     // let canvas = document.getElementById("timelineNMFCanvas")
        //     // canvas.style.display =  'none';
        //     nmfmenu.data.checkbox = false;
        //     nmfmenu.enable();
        //     mfmenu.disable();
        //     window.menubar.showMenu( menubar, null, menubar.element, false );
            
        //     if(this.itemSelected != undefined)
        //         this.updateSkeletonPanel(this.sidePanel, this.itemSelected);
            
        //     document.querySelector("[title='skeleton']").click()
        // }
        
    }

    changeCaptureGUIVisivility(hidde) {
        this.bsInspector.root.hidden = hidde || !this.bsInspector.root.hidden;
    }

    updateCaptureGUI(results, isRecording) {
        
        let {landmarksResults, blendshapesResults} = results;
        if(isRecording){
            this.changeCaptureGUIVisivility(true);
            return;
        }
        else {
            //document.getElementById("capture-info").classList.remove("hidden");
        }
        if(landmarksResults && landmarksResults.poseLandmarks) {

            const { poseLandmarks } = landmarksResults;
            
            let distance = (poseLandmarks[23].visibility + poseLandmarks[24].visibility)*0.5;
            let leftHand = (poseLandmarks[15].visibility + poseLandmarks[17].visibility + poseLandmarks[19].visibility)/3;
            let rightHand = (poseLandmarks[16].visibility + poseLandmarks[18].visibility + poseLandmarks[20].visibility)/3;
        
            this.bsInspector.get('Distance to the camera').onSetValue(distance);
            this.bsInspector.get('Left Hand visibility').onSetValue(leftHand);
            this.bsInspector.get('Right Hand visibility').onSetValue(rightHand);
            
       
        }        

        if(blendshapesResults && (!this.bsInspector.root.hidden || this.facePanel && !this.facePanel.root.hidden )) {

            for(let i in blendshapesResults)
            {
                
                let value = blendshapesResults[i];
                value = value.toFixed(2);
                let widget = this.bsInspector.root.hidden ? this.facePanel.tabs[this.facePanel.selected].get(i) : this.bsInspector.get(i);
                if(!widget)
                    continue;
                widget.onSetValue(value);
            
            }
        }
    }

    hideCaptureArea() {
        let e = document.getElementById("video-area");
        e.classList.remove("video-area");
        
        let i = document.getElementById("expand-capture-gui");
        i.classList.add("hidden");

        let ci = document.getElementById("capture-inspector");
        ci.classList.add("hidden");

        this.timelineArea.hide();        
    }
    /** ------------------------------------------------------------ */

    /** -------------------- SIDE PANEL (editor) -------------------- */
    createSidePanel() {
  
        //create tabs
        let tabs = this.sidePanel.addTabs();

        let bodyArea = new LX.Area({className: "sidePanel", id: 'Body', scroll: true});  
        let faceArea = new LX.Area({className: "sidePanel", id: 'Face', scroll: true});  
        tabs.add( "Body", bodyArea, true, null, {onSelect: (e,v) => {this.editor.changeAnimation(v)}}  );
        tabs.add( "Face", faceArea, false, null, {onSelect: (e,v) => {this.editor.changeAnimation(v); 
            this.updateActionUnitsPanel(this.editor.getSelectedActionUnit());
            this.imageMap.resize();
        } });

        faceArea.split({type: "vertical", sizes: ["50%", "50%"]});
        let [faceTop, faceBottom] = faceArea.sections;
        this.createFacePanel(faceTop);
        this.createActionUnitsPanel(faceBottom);

        bodyArea.split({type: "vertical", resize: false, sizes: "auto"});
        let [bodyTop, bodyBottom] = bodyArea.sections;
        this.createSkeletonPanel( bodyTop, 'root', {firstBone: true} );
        this.createBonePanel( bodyBottom );
        
    }

    createFacePanel(root, itemSelected, options = {}) {

        let container = document.createElement("div");
        
        let img = document.createElement("img");
        img.src = "./data/imgs/face areas2.png";
        img.setAttribute("usemap", "#areasmap");
        img.style.position = "relative";
        container.appendChild(img);
        
        
        let map = document.createElement("map");
        map.name = "areasmap";

        let div = document.createElement("div");
        div.style.position = "fixed";
        let mapHovers = document.createElement("div");
        for(let area in this.faceAreas) {
            let maparea = document.createElement("area");
            maparea.shape = "poly";
            maparea.name = this.faceAreas[area];
            switch(this.faceAreas[area]) {
                case "Eye Left":
                    maparea.coords = "305,325,377,316,449,341,452,366,314,377,301,366";
                    break;
                    case "Eye Right":
                    maparea.coords = "76,347,145,317,212,318,225,327,228,366,212,379,92,375";
                    break;
                case "Mouth":
                    maparea.coords = "190,508,204,500,311,500,327,506,350,537,350,554,338,566,304,577,214,582,157,566,166,551,166,540"//"196,504,314,504,352,550,331,572,200,578,167,550";
                    break;
                case "Nose":
                    maparea.coords = "244,332,286,331,316,478,286,488,244,488,206,483";
                    break;
                case "Brow Left":
                    maparea.coords = "279,269,375,262,467,317,465,317,465,336,392,310,285,321";
                    break;
                case "Brow Right":
                    maparea.coords = "252,269,142,264,66,314,69,314,69,333,133,307,264,321";
                    break;
                case "Cheek Left":
                    maparea.coords = "305,384,378,388,441,380,461,389,463,409,436,507,390,582,357,532,333,499,321,451";
                    break;
                case "Cheek Right":
                    maparea.coords = "69,388,83,377,139,387,216,384,193,482,185,499,159,533,123,584,82,496";
                    break;
                case "Jaw":
                    maparea.coords = "155,569,184,583,258,592,342,579,364,567,377,597,311,666,259,681,205,671,132,610,130,595";
                    break;
            }
            maparea.src = "./data/imgs/"+ maparea.name + " selected.png";
            map.appendChild(maparea);
            let imgHover = document.createElement("img");
            imgHover.src = "./data/imgs/"+ maparea.name + " selected.png";
            imgHover.alt = maparea.name;
            imgHover.style.display = "none";
            imgHover.style.position = "relative";
            imgHover.style.height = "100%";
            mapHovers.appendChild(imgHover);
        }
        div.appendChild(mapHovers);
        mapHovers.style.position = "relative";
        container.appendChild(div);
        root.root.appendChild(container);
        container.appendChild(map);
        
        container.style.height = "100%";
        container.style.display = "flex";
        container.style.justifyContent = "center";
        
        map.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.updateActionUnitsPanel(e.target.name);
           
            img.src = "./data/imgs/face areas2 " + e.target.name + ".png";
            document.getElementsByClassName("map-container")[0].style.backgroundImage ="url('" +img.src +"')";

        });

        img.onload = (e) =>
        {
            let w = img.width;
            let h = img.height;
            img.style.height = "100%";
            if(!this.imageMap) {

                this.imageMap = new ImageMap(map, img, w, h);
            }
        }

        var ImageMap = function(map, img, w, h){
            var n,
                areas = map.getElementsByTagName('area'),
                len = areas.length,
                coords = [],
                previousWidth = w,
                previousHeight = h;
            for (n = 0; n < len; n++) {
                coords[n] = areas[n].coords.split(',');
            }
            this.img = img;
            this.highlighter = new ImageMapHighlighter(img, {
                strokeColor: '67aae9',
                lineJoin: "round", 
                lineCap: "round"
            });
            this.highlighter.init();
           
            this.resize =  () => {
                var n, m, clen,
                    x = root.root.clientHeight / previousHeight;
                for (n = 0; n < len; n++) {
                    clen = coords[n].length;
                    for (m = 0; m < clen; m++) {
                        coords[n][m] *= x;
                    }
                    areas[n].coords = coords[n].join(',');
                }
                previousWidth = previousWidth*x;
                previousHeight = root.root.clientHeight;
                this.highlighter.element.parentElement.querySelector("canvas").width = previousWidth;
                this.highlighter.element.parentElement.querySelector("canvas").height = previousHeight;
                this.highlighter.element.parentElement.style.width = previousWidth + "px";
                this.highlighter.element.parentElement.style.height = previousHeight + "px";
                return true;
            };
            root.onresize = this.resize;
        }

    }

    createActionUnitsPanel(root) {
        
        let tabs = root.addTabs();
        let areas = {};
        
        for(let i in this.editor.mapNames) {
            for(let item in this.faceAreas) {
                let toCompare = this.faceAreas[item].toLowerCase().split(" ");
                let found = true;
                for(let j = 0; j < toCompare.length; j++) {
    
                    if(!i.toLowerCase().includes(toCompare[j])) {
                        found = false;
                        break;
                    }
                }
                if(found)
                {
                    if(!areas[this.faceAreas[item]])
                        areas[this.faceAreas[item]] = {};
                    areas[this.faceAreas[item]][i] =  this.editor.mapNames[i];
                }
            }
        }

        for(let area in areas) {
            let panel = new LX.Panel({id: "au-"+ area});
            panel = this.createBlendShapesInspector(areas[area], {inspector: panel, editable: true, showNumber:true});
            tabs.add(area, panel, this.editor.getSelectedActionUnit() == area, null, {onSelect : (e, v) => {
                this.showTimeline();
                this.editor.setSelectedActionUnit(v);
                document.getElementsByClassName("map-container")[0].style.backgroundImage ="url('" +"./data/imgs/face areas2 " + v + ".png"+"')";
            }
            });
        }
        this.facePanel = tabs;

    }

    updateActionUnitsPanel(area) {
        this.facePanel.root.querySelector("[data-name='"+area+"']").click();
        //this.editor.setSelectedActionUnit(area);
        // let names = {};
        // for(let i in this.editor.mapNames) {
        //     let toCompare = area.toLowerCase().split(" ");
        //     let found = true;
        //     for(let j = 0; j < toCompare.length; j++) {

        //         if(!i.toLowerCase().includes(toCompare[j])) {
        //             found = false;
        //             break;
        //         }
        //     }
        //     if(found)
        //         names[i] = this.editor.mapNames[i]
        // }

        // for(let i in blendshapesResults)
        // {
            
        //     let value = blendshapesResults[i];
        //     value = value.toFixed(2);
        //     let widget = this.bsInspector.get(i);
        //     if(!widget)
        //         continue;
        //     widget.onSetValue(value);
        
        // }
        // this.auPanel = this.createBlendShapesInspector(names, this.auPanel, true)
        // this.auPanel.refresh(names)
    }

    createSkeletonPanel(root, itemSelected = this.itemSelected, options) {

        let skeletonPanel = new LX.Panel({id:"skeleton"});
        root.attach(skeletonPanel);

        options = options || {};
        this.boneProperties = {};
        this.itemSelected = itemSelected;
        // $(root.content).empty();
        
        var mytree = this.updateNodeTree();
    
        // var litetree = new LiteGUI.Tree(mytree, {id: "tree"});
        // litetree.setSelectedItem(itemSelected);
        let litetree = skeletonPanel.addTree("Skeleton bones", mytree, { 
            // icons: tree_icons, 
            filter: true,
            onevent: (event) => { 
                console.log(event.string());
    
                switch(event.type) {
                    case LX.TreeEvent.NODE_SELECTED: 
                        if(event.multiple)
                            console.log("Selected: ", event.node); 
                        else {
                            itemSelected = event.node.id;
                            this.updateSkeletonPanel({itemSelected: itemSelected});
                
                            if(!this.editor)
                                throw("No editor attached");
                
                            this.editor.setSelectedBone( itemSelected );

                            this.editor.activeTimeline = this.keyFramesTimeline;
                            this.keyFramesTimeline.setSelectedItems( [itemSelected] );
                            this.showTimeline();
                            
                            console.log(itemSelected + " selected"); 
                        }
                        break;
                    case LX.TreeEvent.NODE_DBLCLICKED: 
                        console.log(event.node.id + " dbl clicked"); 
                        break;
                    case LX.TreeEvent.NODE_CONTEXTMENU: 
                        LX.addContextMenu( event.multiple ? "Selected Nodes" : event.node.id, event.value, m => {
    
                            // {options}: callback, color
    
                            m.add( "Move before sibling" );
                            m.add( "Move after sibling" );
                            m.add( "Move to parent" );
                            
                        });
                        break;
                    case LX.TreeEvent.NODE_DRAGGED: 
                        console.log(event.node.id + " is now child of " + event.value.id); 
                        break;
                    case LX.TreeEvent.NODE_RENAMED:
                        console.log(event.node.id + " is now called " + event.value); 
                        break;
                    case LX.TreeEvent.NODE_VISIBILITY:
                        console.log(event.node.id + " visibility: " + event.value); 
                        break;
                }
            },
        });
   
        this.tree = litetree;
    }

    updateNodeTree() {
        
        const rootBone = this.editor.skeletonHelper.bones[0];
        
        let mytree = { 'id': rootBone.name };
        let children = [];
        
        const addChildren = (bone, array) => {
            
            for( let b of bone.children ) {
                
                if ( ! b.isBone ){ continue; }
                let child = {
                    id: b.name,
                    children: [],
                    closed: true
                }
                
                array.push( child );
                
                addChildren(b, child.children);
            }
        };
        
        addChildren(rootBone, children);
        
        mytree['children'] = children;
        return mytree;
    }

    createBonePanel(root, itemSelected = this.itemSelected, options) {

        let bonePanel = new LX.Panel({id:"bone"});
        root.attach(bonePanel);
        // Editor widgets 
        this.bonePanel = bonePanel;
      
        this.updateSkeletonPanel(options);

        // // update scroll position
        // var element = root.content.querySelectorAll(".inspector")[0];
        // var maxScroll = element.scrollHeight;
        // element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
    }

    updateSkeletonPanel(options = {}) {

       
        let widgets = this.bonePanel;

        widgets.onRefresh = (o) => {

            o = o || {};
            const numBones = this.editor.skeletonHelper.bones.length;
            widgets.clear();
            widgets.branch("Animation Clip", {icon: "fa-solid fa-child-reaching"});
            widgets.addText("Name", this.clip.name || "Unnamed", v => this.clip.name = v );
            widgets.addText("Num bones", numBones, null, {disabled: true});
            widgets.addText("Frame rate", this.keyFramesTimeline.framerate, null, {disabled: true});
            widgets.addText("Duration", this.duration.toFixed(2), null, {disabled: true});
            widgets.addNumber("Speed", this.editor.mixer.timeScale, v => {
                this.editor.mixer.timeScale = this.editor.video.playbackRate = v;
            }, {min: 0.25, max: 1.5, step: 0.05, precision: 2});
            widgets.addSeparator();
            widgets.addNumber("Optimize Threshold", this.editor.optimizeThreshold, v => {
                this.editor.optimizeThreshold = v;
            }, {min: 0, max: 0.25, step: 0.001, precision: 4});
            // widgets.widgets_per_row = 1;

            const boneSelected = !(o.firstBone && numBones) ? //change to get values of animation?
                this.editor.skeletonHelper.getBoneByName(o.itemSelected) : 
                this.editor.skeletonHelper.bones[0];

            if(boneSelected) {

                let disabled = false;
                if(this.editor.mode == this.editor.eModes.NMF)
                    disabled = true;
                 
                const numTracks = this.keyFramesTimeline.getNumTracks(boneSelected);
                let active = this.editor.getGizmoMode();
                if(!disabled) {

                    const toolsValues = [ {value:"Joint", callback: (v,e) => this.editor.setGizmoTool(v)}, {value:"Follow", callback: (v,e) => this.editor.setGizmoTool(v)}] ;
                    const _Tools = this.editor.hasGizmoSelectedBoneIk() ? toolsValues : [toolsValues[0]];
                    
                    widgets.branch("Gizmo", { icon:"fa-solid fa-chart-scatter-3d", settings: (e) => this.openSettings( 'gizmo' ), settings_title: "<i class='bi bi-gear-fill section-settings'></i>" });
                    
                    widgets.addComboButtons( "Tool", _Tools, {selected: this.editor.getGizmoTool(), nameWidth: "50%", width: "100%"});
                    
                    if( this.editor.getGizmoTool() == "Joint" ){
                        const modesValues = [{value:"Translate", callback: (v,e) => {this.editor.setGizmoMode(v); widgets.onRefresh(options);}}, {value:"Rotate", callback: (v,e) => {this.editor.setGizmoMode(v); widgets.onRefresh(options);}}, {value:"Scale", callback: (v,e) => {this.editor.setGizmoMode(v); widgets.onRefresh(options);}}];
                        const _Modes = numTracks > 1 ? modesValues : [modesValues[1]];
                        if( numTracks <= 1 ){ this.editor.setGizmoMode("Rotate"); }
                        widgets.addComboButtons( "Mode", _Modes, { selected: this.editor.getGizmoMode(), nameWidth: "50%", width: "100%"});
                    }

                    const _Spaces = [{value: "Local", callback: (v,e) =>  this.editor.setGizmoSpace(v)}, {value: "World", callback: (v,e) =>  this.editor.setGizmoSpace(v)}]
                    widgets.addComboButtons( "Space", _Spaces, { selected: this.editor.getGizmoSpace(), nameWidth: "50%", width: "100%"});
    
                    widgets.addCheckbox( "Snap", this.editor.isGizmoSnapActive(), () => this.editor.toggleGizmoSnap() );
    
                    widgets.addSeparator();
                }    

                const innerUpdate = (attribute, value) => {
                    boneSelected[attribute].fromArray( value ); 
                    
                    this.editor.gizmo.onGUI(attribute);
                };

                widgets.branch("Bone", { icon: "fa-solid fa-bone" });
                widgets.addText("Name", boneSelected.name, null, {disabled: true});
                widgets.addText("Num tracks", numTracks ?? 0, null, {disabled: true});

                // Only edit position for root bone
                if(boneSelected.children.length && boneSelected.parent.constructor !== boneSelected.children[0].constructor) {
                    this.boneProperties['position'] = boneSelected.position;
                    widgets.addVector3('Position', boneSelected.position.toArray(), (v) => innerUpdate("position", v), {disabled: this.editor.state || disabled || active != 'Translate', precision: 3, className: 'bone-position'});

                    this.boneProperties['scale'] = boneSelected.scale;
                    widgets.addVector3('Scale', boneSelected.scale.toArray(), (v) => innerUpdate("scale", v), {disabled: this.editor.state || disabled || active != 'Scale', precision: 3, className: 'bone-scale'});
                }

                this.boneProperties['rotation'] = boneSelected.rotation;
                widgets.addVector3('Rotation (XYZ)', boneSelected.rotation.toArray(), (v) => innerUpdate("rotation", v), {disabled: this.editor.state || disabled || active != 'Rotate', precision: 3, className: 'bone-euler'});

                this.boneProperties['quaternion'] = boneSelected.quaternion;
                widgets.addVector4('Quaternion', boneSelected.quaternion.toArray(), (v) => innerUpdate("quaternion", v), {disabled: this.editor.state || disabled || active != 'Rotate', precision: 3, className: 'bone-quaternion'});
            }

        };

        widgets.onRefresh(options);
    }
    
    createSceneUI(area) {

        $(this.editor.orientationHelper.domElement).show();

        let editor = this.editor;
        let canvasButtons = []
        
        if(editor.scene.getObjectByName("Armature")) {
            canvasButtons = [
                {
                    name: 'Skin',
                    property: 'showSkin',
                    icon: 'bi bi-person-x-fill',
                    nIcon: 'bi bi-person-check-fill',
                    selectable: true,
                    callback: (v) =>  {
                        editor.showSkin = !editor.showSkin;
                        let model = editor.scene.getObjectByName("Armature");
                        model.visible = editor.showSkin;
                        
                    }
                },
        
                {
                    name: 'Skeleton',
                    property: 'showSkeleton',
                    icon: 'fa-solid fa-bone',
                    nIcon: 'fa-solid fa-bone',
                    selectable: true,
                    selected: true,
                    callback: (v) =>  {
                        editor.showSkeleton = !editor.showSkeleton;
                        let skeleton = editor.scene.getObjectByName("SkeletonHelper");
                        skeleton.visible = editor.showSkeleton;
                        editor.scene.getObjectByName('GizmoPoints').visible = editor.showSkeleton;
                        if(!editor.showSkeleton) 
                            editor.gizmo.stop();
                    }
                }
            ];
        }
        
        canvasButtons = [...canvasButtons,
            {
                name: 'GUI',
                property: 'showGUI',
                icon: 'fa-solid fa-table-cells',
                selectable: true,
                selected: true,
                callback: (v, e) => {
                    editor.showGUI = !editor.showGUI;

                    if(editor.scene.getObjectByName('Armature'))
                        editor.scene.getObjectByName('SkeletonHelper').visible = editor.showGUI;
                    editor.scene.getObjectByName('GizmoPoints').visible = editor.showGUI;
                    editor.scene.getObjectByName('Grid').visible = editor.showGUI;
                    
                    if(!editor.showGUI) {
                        editor.gizmo.stop();
                        this.hideTimeline();

                    } else {
                        this.showTimeline();
                    }
                    
                    
                    const video = document.getElementById("capture");
                    video.style.display = editor.showGUI ? "flex" : "none";
                }
            },
    
            {
                name: 'Joints',
                property: 'boneUseDepthBuffer',
                icon: 'fa-solid fa-circle-nodes',
                selectable: true,
                selected: true,
                callback: (v) =>  {
                    editor.gizmo.bonePoints.material.depthTest = !editor.gizmo.bonePoints.material.depthTest;
                }
            },
    
            {
                name: 'Animation loop',
                property: 'animLoop',
                selectable: true,
                selected: true,
                icon: 'fa-solid fa-person-walking-arrow-loop-left',
                callback: (v) =>  {
                    editor.animLoop = !editor.animLoop;
                    editor.setAnimationLoop(editor.animLoop);
                    
                }
            }
        ]
        area.addOverlayButtons(canvasButtons, { float: "htc" } );
    }
    
    
    openSettings( settings ) {
        
        let prevDialog = document.getElementById("settings-dialog");
        if(prevDialog) prevDialog.remove();
        
        const dialog = new LiteGUI.Dialog({ id: 'settings-dialog', title: UTILS.firstToUpperCase(settings), close: true, width: 380, height: 210, scroll: false, draggable: true});
        dialog.show();
        
        const inspector = new LiteGUI.Inspector();
        
        switch( settings ) {
            case 'gizmo': 
            this.editor.gizmo.showOptions( inspector );
            break;
        };
        
        dialog.add( inspector );
    }
    
    /** Non -manual features based on BML */
    showClipInfo() {

    }

    createLexemesDialog() {
        // Create a new dialog
        let dialog = new LiteGUI.Dialog('Non Manual Features lexemes', { title:'Lexemes', close: true, minimize: false, width: 500, height: 400, scroll: true, resizable: true, draggable: true });
        var that = this;
        // Create a collection of widgets
        let widgets = new LiteGUI.Inspector();
        let values = ANIM.FaceLexemeClip.lexemes;//["Yes/No-Question", "Negative", "WH-word Questions", "Topic", "RH-Questions"];
        for(let i = 0; i < values.length; i++){
            widgets.addImageButton(values[i], null, {
                type: "image",
                image: "data/imgs/thumbnails/" + values[i].toLowerCase() + ".png",
                callback: function(v, e) { 
                    
                    dialog.close();
                    that.clipsTimeline.addClip( new ANIM.FaceLexemeClip({lexeme:this.name}));
                    
                   // that.editor.NMFController.updateTracks.bind(that.editor.NMFController) ;
                }
            } )
        }
        dialog.root.classList.add("grid");
        dialog.add(widgets);
        dialog.show();
    }
     
    setBoneInfoState( enabled ) {
        for(const ip of $(".bone-position input, .bone-euler input, .bone-quaternion input"))
        enabled ? ip.removeAttribute('disabled') : ip.setAttribute('disabled', !enabled);
    }
    /** ------------------------------------------------------------ */

    /** -------------------- TIMELINE -------------------- */
    render() {

        if(this.timelineVisible)
            this.drawTimeline();
    }

    drawTimeline(currentTimeline) {
        
        if(this.timelineVisible)
            currentTimeline.draw();
        // const canvas = this.timelineCTX.canvas;
       

        // if(this.currentTime > this.duration) {
        //     this.currentTime = 0.0;
        //     this.editor.onAnimationEnded();
        // }
        // if(this.editor.activeTimeline)
        //     this.editor.activeTimeline.draw(this.currentTime);
        // this.keyFramesTimeline.draw(this.currentTime); //  [0, 0, canvas.width, canvas.height]
        // if(this.clipsTimeline)
        // {
           
        //     this.clipsTimeline.draw(this.currentTime, null, false);    // [0, 0, this.timelineNMFCTX.canvas.width, this.timelineNMFCTX.canvas.height]
        // }
        
    }

    showTimeline() {
        this.timelineVisible = true;
        this.timelineArea.show();
        this.editor.activeTimeline.show();
        let menubarItem = this.menubar.getItem("View/Show timeline");
        if(menubarItem && !menubarItem.cheked) {
            menubarItem.checked = this.timelineVisible;
        }
    }

    hideTimeline() {
        this.timelineVisible = false;
        this.timelineArea.hide();
        this.editor.activeTimeline.hide();
    }

    showKeyFrameOptions(e, track) {

        let actions = [];
        let keyframes = this.keyFramesTimeline.lastKeyFramesSelected;
        let index = keyframes.map((x) => x[2]);
        if(index !== undefined) {
            if(!track)
            return;
    
            e.multipleSelection = index.length > 1//this.keyFramesTimeline.isKeyFrameSelected(track, index);
    
            actions.push(
                {
                    title: (e.multipleSelection ? "Multiple selection" : "[" + index + "] " + track.name),
                    disabled: true
                },
                null,
                {
                    title: "Copy" + " <i class='bi bi-clipboard float-right'></i>",
                    callback: () => this.keyFramesTimeline.copyKeyFrame( track, index )
                },
                {
                    title: "Paste" + (e.multipleSelection ? " (" + this.keyFramesTimeline.getNumKeyFramesSelected() + ")" : "") +  " <i class='bi bi-clipboard-check float-right'></i>",
                    disabled: !this.keyFramesTimeline.canPasteKeyFrame(),
                    callback: () => this.keyFramesTimeline.pasteKeyFrame( e, track, index )
                },
                {
                    title: "Delete" + (e.multipleSelection ? " (" + this.keyFramesTimeline.getNumKeyFramesSelected() + ")" : "") +  " <i class='bi bi-trash float-right'></i>",
                    callback: () => this.keyFramesTimeline.deleteKeyFrame( e, track, index )
                }
            );
        }else {

            // No keyframe selected

            actions.push(
                {
                    title: "Add" + " <i class='bi bi-plus float-right'></i>",
                    callback: () => this.timkeyFramesTimelineeline.addKeyFrame( track )
                }
            );
        }
        
        new LiteGUI.ContextMenu( actions, { event: e });
    }
    
    /** ------------------------------------------------------------ */

    /** -------------------- ON EVENTS -------------------- */
    onSelectItem(item) {
        this.keyFramesTimeline.setSelectedItems( [item] );
        this.selectedItems = [item];
        this.tree.select(item);
    }

    onMouse(e, nmf = null) {

        e.preventDefault();
        //let rect = this.timeline.canvas.getBoundingClientRect();
        // if( e.x >= rect.left && e.x <= rect.right && e.y >= rect.top && e.y <= rect.bottom)
        // {
        //     if(e.type == "mousedown" && this.clipsTimeline)
        //         this.clipsTimeline.selectedClip = null;
        //     this.timeline.processMouse(e);
        //     return;
        // }
        if(this.keyFramesTimeline && this.keyFramesTimeline.active)
        {
            this.keyFramesTimeline.processMouse(e);
            return;
        }
        else if(this.clipsTimeline)
        {
            // if(e.type == "mousedown")
            //     this.timeline.deselectAll();
            this.clipsTimeline.processMouse(e);
            if(e.type == "wheel")
                this.keyFramesTimeline.processMouse(e);

        }
        
    }

    resize(width, height) {
        this.timelineArea.setSize([width, null]);
        this.editor.activeTimeline.resize();

    }
};

export { Gui };