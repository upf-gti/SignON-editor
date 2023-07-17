import { ClipsTimeline, KeyFramesTimeline, Timeline } from "./libs/timeline.module.js";
import { UTILS } from "./utils.js";
import { VideoUtils } from "./video.js"; 

class Gui {

    constructor(editor) {
       
        this.showTimeline = true;

        this.keyFramesTimeline = new KeyFramesTimeline("Bones", {canvas: document.getElementById("timelineCanvas"), trackHeight: 15});
        this.keyFramesTimeline.setFramerate(30);
        this.keyFramesTimeline.setScale(400);

        this.clipsTimeline = new ClipsTimeline("Non manual features", {canvas: document.getElementById("timelineNMFCanvas")});
        this.clipsTimeline.setFramerate(30);
        this.clipsTimeline.setScale(400);
        this.clipsTimeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.bodyAnimation.duration - 0.001) );
        this.clipsTimeline.onSetDuration = (t) => {this.duration = this.keyFramesTimeline.duration = this.keyFramesTimeline.animationClip.duration = t};
        this.clipsTimeline.onSelectClip = this.showClipInfo.bind(this);
       
        this.clipsTimeline.animationClip = {duration: this.keyFramesTimeline.duration, tracks: []};
        // this.clipsTimeline.addClip( new ANIM.FaceLexemeClip());

        this.showVideo = true;
        this.currentTime = 0;
        this.skeletonScroll = 0;
        this.editor = editor;

        this.boneProperties = {};

        this.create();
    }

    loadKeyframeClip( clip ) {

            
        this.clip = clip || { duration: 1};
        this.duration =  this.clip.duration;

        let boneName = null;
        if(this.editor.skeletonHelper.bones.length) {
            boneName = this.editor.skeletonHelper.bones[0].name;
        }

        // this.timeline = new KeyFramesTimeline( this.editor.bodyAnimation, boneName);
        this.keyFramesTimeline.setAnimationClip(this.clip);
        this.keyFramesTimeline.setSelectedItem(boneName);
        this.keyFramesTimeline.resize([this.keyFramesTimeline.canvas.parentElement.clientWidth, this.keyFramesTimeline.canvas.parentElement.clientHeight]);
        this.keyFramesTimeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.bodyAnimation.duration - 0.001) );
        this.keyFramesTimeline.onSetDuration = (t) => {this.duration = this.keyFramesTimeline.duration = this.clip.duration = this.editor.bodyAnimation.duration = t};
        this.keyFramesTimeline.onSelectKeyFrame = (e, info, index) => {
            if(e.button != 2) {
                //this.editor.gizmo.mustUpdate = true
                this.editor.gizmo.update(true);
                return false;
            }

            // Change gizmo mode and dont handle
            // return false;

            this.showKeyFrameOptions(e, info, index);
            return true; // Handled
        };
        this.keyFramesTimeline.showContextMenu = (e, track) => {
            this.showKeyFrameOptions(e, track);
        }
        this.keyFramesTimeline.onItemUnselected = () => this.editor.gizmo.stop();
        this.keyFramesTimeline.onUpdateTrack = (idx) => this.editor.updateAnimationAction(this.keyFramesTimeline.animationClip, idx);
        this.keyFramesTimeline.onGetSelectedItem = () => { return this.editor.getSelectedBone(); };
        this.keyFramesTimeline.onGetOptimizeThreshold = () => { return this.editor.optimizeThreshold; }

        this.updateMenubar();
        this.createSidePanel();
        this.hiddeCaptureArea();

        let canvasArea = document.getElementById("canvasarea");
        this.editor.resize(canvasArea.clientWidth, canvasArea.clientHeight);

        // automatic optimization of keyframes
        this.editor.optimizeTracks();
        this.render();
    }

    create() {

        LiteGUI.init(); 
        
        this.createCaptureGUI();
        // Create menu bar
        this.createMenubar();
        
        // Create main area
        this.mainArea = new LiteGUI.Area({id: "mainarea", content_id:"canvasarea", height: "calc( 100% - 31px )", main: true});
        LiteGUI.add( this.mainArea );
        
        const canvasArea = document.getElementById("canvasarea");

        canvasarea.appendChild( document.getElementById("timeline") );
        // let timeline = document.getElementById("timeline")
        // timeline.style.display = "block";

        this.mainArea.onresize = window.onresize;

        if(this.keyFramesTimeline)
            this.keyFramesTimeline.setVisibility(true);
        // let timelineCanvas = document.getElementById("timelineCanvas");
        // timelineCanvas.width = canvasArea.clientWidth;
        // this.timelineCTX = timelineCanvas.getContext("2d");

        // timelineCanvas.addEventListener("mouseup", this.onMouse.bind(this));
        // timelineCanvas.addEventListener("mousedown", this.onMouse.bind(this));
        // timelineCanvas.addEventListener("mousemove", this.onMouse.bind(this));
        // timelineCanvas.addEventListener("wheel", this.onMouse.bind(this));
        // timelineCanvas.addEventListener('contextmenu', (e) => e.preventDefault(), false);

        this.clipsTimeline.canvas.addEventListener( 'keydown', (e) => {
            switch ( e.key ) {
                case " ": // Spacebar
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const stateBtn = document.getElementById("state_btn");
                    stateBtn.click();
                    break;
            }
        });
        if(this.clipsTimeline)
            this.clipsTimeline.setVisibility(false);
        // let timelineNMFCanvas = document.getElementById("timelineNMFCanvas");
        // timelineNMFCanvas.width = timelineCanvas.width;
        // timelineNMFCanvas.style.display = "none";
        // this.timelineNMFCTX = timelineNMFCanvas.getContext("2d");

        // timelineNMFCanvas.addEventListener("mouseup", (e) => { e.preventDefault(); if(this.clipsTimeline) this.clipsTimeline.processMouse(e); });
        // timelineNMFCanvas.addEventListener("mousedown", (e) => { e.preventDefault(); if(this.clipsTimeline) this.clipsTimeline.processMouse(e); });
        // timelineNMFCanvas.addEventListener("mousemove", (e) => { e.preventDefault(); if(this.clipsTimeline) this.clipsTimeline.processMouse(e); });
        // timelineNMFCanvas.addEventListener("wheel", (e) => { e.preventDefault(); if(this.clipsTimeline) this.clipsTimeline.processMouse(e); });
        // timelineNMFCanvas.addEventListener("mouseup", this.onMouse.bind(this));
        // timelineNMFCanvas.addEventListener("mousedown", this.onMouse.bind(this));
        // timelineNMFCanvas.addEventListener("mousemove", this.onMouse.bind(this));
        // timelineNMFCanvas.addEventListener("wheel", this.onMouse.bind(this));
        this.clipsTimeline.showContextMenu = (e) => {
            e.preventDefault()
            let actions = [];
            //let track = this.clipsTimeline.clip.tracks[0];
            if(this.clipsTimeline.lastClipsSelected.length) {
                actions.push(
                    {
                        title: "Copy" + " <i class='bi bi-clipboard-fill float-right'></i>",
                        callback: () => {this.clipsToCopy = [...this.clipsTimeline.lastClipsSelected];}
                    }
                )
                actions.push(
                    {
                        title: "Delete" + " <i class='bi bi-trash float-right'></i>",
                        callback: () => {
                            let clipstToDelete = this.clipsTimeline.lastClipsSelected;
                            for(let i = 0; i < clipstToDelete.length; i++){
                                this.clipsTimeline.deleteClip(clipstToDelete[i], this.showClipInfo.bind(this));
                            }
                            this.clipsTimeline.optimizeTracks();
                            this.editor.NMFController.updateTracks();
                        }
                    }
                )
                actions.push(
                    {
                        title: "Create preset" + " <i class='bi bi-file-earmark-plus-fill float-right'></i>",
                        callback: () => {
                            this.clipsTimeline.lastClipsSelected.sort((a,b) => {
                                if(a[0]<b[0]) 
                                    return -1;
                                return 1;
                            });
                            this.createNewPresetDialog(this.clipsTimeline.lastClipsSelected);
                        }
                    }
                )
            }
            else{
                actions.push(
                    {
                        title: "Add lexeme" + " <i class='bi bi-plus float-right'></i>",
                        callback: this.createLexemesDialog.bind(this)
                    },
                    {
                        title: "Add preset" + " <i class='bi bi-plus float-right'></i>",
                        callback: this.createPresetsDialog.bind(this)
                    }
                );
                if(this.clipsToCopy)
                {
                    actions.push(
                        {
                            title: "Paste" + " <i class='bi bi-clipboard-fill float-right'></i>",
                            callback: () => {
                                this.clipsToCopy.sort((a,b) => {
                                    if(a[0]<b[0]) 
                                        return -1;
                                    return 1;
                                });

                                for(let i = 0; i < this.clipsToCopy.length; i++){
                                    let [trackIdx, clipIdx] = this.clipsToCopy[i];
                                    let clipToCopy = this.clipsTimeline.clip.tracks[trackIdx].clips[clipIdx];
                                    let clip = new ANIM.FaceLexemeClip(clipToCopy);
                                    this.clipsTimeline.addClip(clip, this.clipsToCopy.length > 1 ? clipToCopy.start : 0); 
                                }
                                this.clipsToCopy = null;
                            }
                        }
                    )
                }
                
            }
            new LiteGUI.ContextMenu( actions, { event: e });
        };

        // this.clipsTimeline.onDblClick = (e) => { e.preventDefault(); if(this.clipsTimeline) this.clipsTimeline.processMouse(e); };
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

        let splitbar = document.getElementById("timeline-splitbar");
        splitbar.addEventListener("mousedown", innerMousedown.bind(this));
        
        let lastPos = [0,0];
        let isGrabbing = false;
		function innerMousedown(e)
		{
            isGrabbing = true;
			var doc = document;
            doc.addEventListener("mousemove",innerMousemove.bind(this));
            doc.addEventListener("mouseup",innerMouseup.bind(this));

			lastPos[0] = e.pageX;
			lastPos[1] = e.pageY;
			e.stopPropagation();
			e.preventDefault();
		}

		function innerMousemove(e)
		{
			
			
            if (lastPos[1] != e.pageY && isGrabbing)
            {
                let delta = e.pageY - lastPos[1];
				let size = timeline.offsetHeight - delta;
				timeline.style.height = size + "px";
                timelineNMFCanvas.height = size;
                if(this.clipsTimeline)
                    this.clipsTimeline.height = size;
            }
			

			lastPos[0] = e.pageX;
			lastPos[1] = e.pageY;
			e.stopPropagation();
			e.preventDefault();
            
		}

		function innerMouseup(e)
		{
			// var doc = document;
			// doc.removeEventListener("mousemove",innerMousemove);
			// doc.removeEventListener("mouseup",innerMouseup);
			//timeline.offsetHeight = lastPos[1];
            if(!isGrabbing)
                return;
            isGrabbing = false;
            e.stopPropagation();
			e.preventDefault();
            
            if(this.keyFramesTimeline)
                this.keyFramesTimeline.resize([this.keyFramesTimeline.size[0], e.y - 5]);
            
            if(this.clipsTimeline)
                this.clipsTimeline.resize([this.clipsTimeline.size[0], e.y - 5])    
		}

    }

    /** -------------------- MENU BAR -------------------- */
    createMenubar() {

        var that = this;

        var menubar = new LiteGUI.Menubar("mainmenubar");
        LiteGUI.add( menubar );
        
        window.menubar = menubar;

        const logo = document.createElement("img");
        logo.id = "signOn-logo"
        logo.src = "data/imgs/logo_SignON.png";
        logo.alt = "SignON"
        logo.addEventListener('click', () => window.open('https://signon-project.eu/'));
        menubar.root.prepend(logo);
        this.appendButtons( menubar );
    }

    
    appendButtons(menubar) {

        const buttonContainer = document.createElement('div');
        buttonContainer.style.margin = "0 auto";
        buttonContainer.style.display = "flex";
        menubar.root.appendChild(buttonContainer);

        const buttons = [
            {
                id: "state_btn",
                text: "<i class='bi bi-play-fill'></i>",
                display: "none"
            },
            {
                id: "stop_btn",
                text: "<i class='bi bi-skip-start-fill'></i>",
                display: "none"
            },
            // {
            //     id: "capture_btn",
            //     text: "Capture" + " <i class='bi bi-record2'></i>"
            // },
            // {
            //     id: "trim_btn",
            //     text: "Convert to animation",
            //     display: "none"
            // }
        ];

        for(let b of buttons) {
            const button = document.createElement("button");
            button.id = b.id;
            button.style.display = b.display || "block";
            button.innerHTML = b.text;
            button.classList.add( "litebutton", "menuButton", "captureButton" );
            if(b.styles) Object.assign(button.style, b.styles);
            if(b.callback) button.addEventListener('click', b.callback);
            buttonContainer.appendChild(button);
        }

        // Add editor listeners
        let stateBtn = document.getElementById("state_btn");
        stateBtn.onclick = this.editor.onPlay.bind(this.editor, stateBtn);
        let stopBtn = document.getElementById("stop_btn");
        stopBtn.onclick = this.editor.onStop.bind(this.editor, stateBtn);
    }

    updateMenubar() {
        var that = this;
        let menubar = window.menubar;
        menubar.add("Project/Upload animation", {icon: "<i class='bi bi-upload float-right'></i>", callback: () => this.editor.getApp().storeAnimation() });
 
        menubar.add("Project/");
        menubar.add("Project/Export MF Animation", {subtitle: true});
        menubar.add("Project/Export BVH", {icon: "<i class='bi bi-file-text float-right'></i>",  callback: () => this.editor.export('BVH') });
        menubar.add("Project/Export NMF Animation", {subtitle: true});
        menubar.add("Project/Export extended BVH", {icon: "<i class='bi bi-file-text float-right'></i>",  callback: () => this.editor.export("BVH extended") });
        menubar.add("Project/Export BML", {icon: "<i class='bi bi-file-text float-right'></i>",  callback: () => this.editor.export() });
        menubar.add("Project/Export Animation together", {subtitle: true});
        menubar.add("Project/Export GLB", {icon: "<i class='bi bi-file-text float-right'></i>",  callback: () => this.editor.export('GLB') });
        menubar.add("Project/Open preview", {icon: "<i class='bi bi-file-earmark-play float-right'></i>",  callback: () => this.editor.showPreview() });

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

        menubar.add("View/Show video", { type: "checkbox", instance: this, property: "showVideo", callback: () => {
            const tl = document.getElementById("capture");
            tl.style.display = this.showVideo ? "flex": "none";
        }});
        menubar.add("View/Show timeline", { type: "checkbox", instance: this, property: "showTimeline", callback: () => {
            const tl = document.getElementById("timeline");
            tl.style.display = this.showTimeline ? "block": "none";
        }});
       
    }

    changeEditorMode(mode)
    {
        if(this.editor.onChangeMode)
            this.editor.onChangeMode(mode);

        let splitbar = document.getElementById("timeline-splitbar");
        let menubar = window.menubar.findMenu("Editor");
        let mfmenu = window.menubar.findMenu("Editor/Manual Features");
        let nmfmenu = window.menubar.findMenu("Editor/Non-Manual Features");

        if(mode == this.editor.eModes.NMF){
            mfmenu.data.checkbox = false;
            mfmenu.enable();
            nmfmenu.disable();
            window.menubar.showMenu( menubar, null, menubar.element, false );

            if(!this.clipsTimeline) {
                        
                this.clipsTimeline = new ClipsTimeline(null, null, [this.keyFramesTimeline.size[0], this.keyFramesTimeline.size[1]], false);
                this.clipsTimeline.name = "Non-Manual Features";
                this.clipsTimeline.framerate = 30;
                this.clipsTimeline.setScale(400);
                this.clipsTimeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.bodyAnimation.duration - 0.001) );
                this.clipsTimeline.onSetDuration = (t) => {this.duration = this.keyFramesTimeline.duration = this.keyFramesTimeline.animationClip.duration = t};
                this.clipsTimeline.onSelectClip = this.showClipInfo.bind(this);
                this.clipsTimeline.onClipMoved = ()=> {
                    this.editor.NMFController.updateTracks();
                    this.clipsTimeline.onSetTime(this.clipsTimeline.currentTime) 
                };
                this.clipsTimeline.animationClip = {duration: this.keyFramesTimeline.duration, tracks: []};
                // this.clipsTimeline.addClip( new ANIM.FaceLexemeClip());
                
                this.clipsTimeline.onUpdateTrack = this.editor.NMFController.updateTracks.bind(this.editor.NMFController);
                this.editor.NMFController.begin(this.clipsTimeline);
                this.showNMFGuide();
                
            }
            else if( !this.clipsTimeline.animationClip) {
                this.clipsTimeline.onClipMoved = ()=> {
                    this.editor.NMFController.updateTracks();
                    this.clipsTimeline.onSetTime(this.clipsTimeline.currentTime) 
                };
                this.clipsTimeline.onSetDuration(this.keyFramesTimeline.duration);
                this.clipsTimeline.onUpdateTrack = this.editor.NMFController.updateTracks.bind(this.editor.NMFController);
                this.editor.NMFController.begin(this.clipsTimeline);
                this.showNMFGuide();
            }
            // splitbar.classList.remove("hidden");
            this.clipsTimeline.resize(this.keyFramesTimeline.size);
            this.keyFramesTimeline.active = false;
            // this.keyFramesTimeline.resize([this.keyFramesTimeline.size[0], this.keyFramesTimeline.size[1]*2 + 20])
           
            this.clipsTimeline.setVisibility(true);
            // let canvas = document.getElementById("timelineNMFCanvas")
            // canvas.style.display =  'block';
            let canvasArea = document.getElementById("canvasarea");
            this.editor.resize(canvasArea.clientWidth, canvasArea.clientHeight);
            
            if(this.clipsTimeline.selectedClip)
                this.showClipInfo(this.clipsTimeline.selectedClip);
            this.updateSidePanel();
            document.querySelector("[title='skeleton']").click()

        }
        else{
            // splitbar.classList.add("hidden");
            this.keyFramesTimeline.active = true;
            // this.keyFramesTimeline.resize([this.keyFramesTimeline.size[0], this.keyFramesTimeline.size[1]/2 - 20])
            this.clipsTimeline.setVisibility(false);
            // let canvas = document.getElementById("timelineNMFCanvas")
            // canvas.style.display =  'none';
            nmfmenu.data.checkbox = false;
            nmfmenu.enable();
            mfmenu.disable();
            window.menubar.showMenu( menubar, null, menubar.element, false );
            
            if(this.itemSelected != undefined)
                this.updateSidePanel(this.sidePanel, this.itemSelected);
            
            document.querySelector("[title='skeleton']").click()
        }
        
    }
    /** ------------------------------------------------------------ */

    /** -------------------- CAPTURE GUI (app) --------------------  */
    createCaptureGUI() {
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
                    //     // Update header
                    //     let capture = document.getElementById("capture_btn");
                    //     capture.disabled = true;
                    //     capture.style.display = "block";

                    //     let trimBtn = document.getElementById("trim_btn");
                    //     trimBtn.style.display = "none";

                    //     // TRIM VIDEO - be sure that only the sign is recorded
                    //     let canvas = document.getElementById("outputVideo");
                    //     let video = document.getElementById("recording");
                    //     let input = document.getElementById("inputVideo");
                    //     let live = true;
                    //     if(input.src)
                    //     {
                    //         window.globals.app.onLoadVideo(input.src);
                    //     }
                    //     else{
                    //         await VideoUtils.unbind(() => window.globals.app.init())
                           
                    //     }
                    //    // await VideoUtils.unbind();
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


        let div = document.createElement("div");
        div.id = "capture-info";
        div.className = "hidden";
        div.innerHTML = 
            '<div id="text-info" class="header"> Position yourself centered on the image with the hands and troso visible. If the conditions are not met, reposition yourself or the camera. </div>\
                <div id="warnings" style= "display:flex;     justify-content: center;"> \
                    <div id="distance-info" class="alert-info alert-primary"> \
                        <div class="icon__wrapper"> \
                            <i class="fas fa-solid fa-check check"></i> \
                        <!--<span class="mdi mdi-alert-outline"></span>--> \
                        </div> \
                        <p>Distance to the camera looks good</p> \
                        <!-- <span class="mdi mdi-open-in-new open"></span> -->\
                    </div> \
                    <div id="hands-info" class="alert-info alert-primary"> \
                        <div class="icon__wrapper"> \
                            <i class="fas fa-solid fa-check check"></i> \
                        <!--<span class="mdi mdi-alert-outline"></span>--> \
                        </div> \
                        <p>Hands visible</p> \
                        <!--<span class="mdi mdi-open-in-new open"></span>--> \
                    </div>\
                </div>\
            </div>'

        let videoArea = document.getElementById("video-area");
        videoArea.classList.add("video-area");

        let i = document.createElement("i");
        i.id = "expand-capture-gui";
        i.style = "position: relative;top: 35px;left: -19px;"
        i.className = "fas fa-solid fa-circle-info drop-icon";//"fas fa-solid fa-circle-chevron-left drop-icon";

        i.addEventListener("click", () => this.changeCaptureGUIVisivility());

        let inspector = new LiteGUI.Inspector("capture-inspector");
        inspector.root.hidden = true;
        inspector.addTitle("User positioning");
        inspector.addInfo(null, 'Position yourself centered on the image with the hands and troso visible. If the conditions are not met, reposition yourself or the camera.') 
        inspector.addInfo(null, 'Distance to the camera');

        let progressBar = document.createElement('div');
        progressBar.className = "progress mb-3";
        progressBar.innerHTML = 
           '<div id="progressbar-torso" class="progress-bar bg-danger" role="progressbar" style="width: 50%" aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>'

        inspector.root.appendChild(progressBar);
        inspector.addInfo(null, 'Left Hand visibility');
        let progressBarLH = document.createElement('div');
        progressBarLH.className = "progress mb-3";
        progressBarLH.innerHTML = 
           '<div id="progressbar-lefthand" class="progress-bar bg-danger" role="progressbar" style="width: 50%" aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>'
           
        inspector.root.appendChild(progressBarLH);

        inspector.addInfo(null, 'Right hand visibility');
        let progressBarRH = document.createElement('div');
        progressBarRH.className = "progress mb-3";
        progressBarRH.innerHTML = 
           '<div id="progressbar-righthand" class="progress-bar bg-danger" role="progressbar" style="width: 50%" aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>'
        
        inspector.root.appendChild(progressBarRH);
        mainCapture.appendChild(i);
        mainCapture.appendChild(inspector.root)
        videoArea.appendChild(buttonContainer);

        let section = inspector.addSection("Blendshapes weights");
        let inspect = this.createBlendShapesInspector(this.editor.mapNames, inspector);
        inspector = inspect;
        inspector.root.style.maxHeight = "calc(100% - 57px)";
        inspector.root.style.overflowY = "scroll";
 
    }

    changeCaptureGUIVisivility(hidde) {
        document.getElementById("capture-inspector").hidden = hidde || !document.getElementById("capture-inspector").hidden;
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
        
  
            let progressBarT = document.getElementById("progressbar-torso");
            progressBarT.setAttribute("aria-valuenow", distance*100);
            progressBarT.style.width = distance*100 + '%';
            progressBarT.className = "progress-bar";
            if(distance < 0.3) 
                progressBarT.classList.add("bg-danger")
            else if(distance > 0.3 && distance < 0.7) 
                progressBarT.classList.add("bg-warning")
            else 
                progressBarT.classList.add("bg-success")
            
            let progressBarLH = document.getElementById("progressbar-lefthand");
            progressBarLH.setAttribute("aria-valuenow", leftHand*100);
            progressBarLH.style.width = leftHand*100 + '%';
            progressBarLH.className = "progress-bar";
            if(leftHand < 0.3) 
                progressBarLH.classList.add("bg-danger")
            else if(leftHand > 0.3 && leftHand < 0.7) 
                progressBarLH.classList.add("bg-warning")
            else 
                progressBarLH.classList.add("bg-success")

            let progressBarRH = document.getElementById("progressbar-righthand");
            progressBarRH.setAttribute("aria-valuenow", rightHand*100);
            progressBarRH.style.width = rightHand*100 + '%';
            progressBarRH.className = "progress-bar";
            if(leftHand < 0.3) 
                progressBarRH.classList.add("bg-danger")
            else if(leftHand > 0.3 && leftHand < 0.7) 
                progressBarRH.classList.add("bg-warning")
            else 
                progressBarRH.classList.add("bg-success")
        }        

        if(blendshapesResults) {

            for(let i in blendshapesResults)
            {
                let progressBar = document.getElementById("progressbar-"+i);
                if(!progressBar) 
                    continue;
                let value = blendshapesResults[i];
                value = value.toFixed(2);
                // progressBar.setAttribute("aria-valuenow", value*100);
                // progressBar.style.width = value*100 + '%';
                // progressBar.className = "progress-bar";
                // if(value < 0.25) 
                //     progressBar.classList.add("bg-danger")
                // else if(value > 0.25 && value < 0.5) 
                //     progressBar.classList.add("bg-warning")
                // else 
                //     progressBar.classList.add("bg-success")
                progressBar.value = value;
                if(document.getElementById('progressvalue-' + i ))
				    document.getElementById('progressvalue-' + i ).innerText = value;
            }
        }
    }

    hiddeCaptureArea() {
        let e = document.getElementById("video-area");
        e.classList.remove("video-area");
        
        let i = document.getElementById("expand-capture-gui");
        i.classList.add("hidden");

        let ci = document.getElementById("capture-inspector");
        ci.classList.add("hidden");
        
    }
    /** ------------------------------------------------------------ */

    /** -------------------- SIDE PANEL (editor) -------------------- */
    createSidePanel() {
        this.mainArea.split("horizontal", [null,"300px"], true);

        //create tabs
        let tabs = new LiteGUI.Tabs("mode-tabs", {size: "full"});

        let skeletonPanel = new LiteGUI.Panel("sidePanel", {title: 'Skeleton', scroll: true});  
        $(skeletonPanel).bind("closed", function() { this.mainArea.merge(); });
        this.sidePanel = skeletonPanel;

        skeletonPanel.content.id = "main-inspector-content";
        skeletonPanel.content.style.width = "100%";


        let bsPanel = new LiteGUI.Panel("sidePanel", {title: 'Blendshapes', scroll: true});  
        let bsArea = new LiteGUI.Area({content_id: "blenshapes-area"});
        bsArea.split("vertical", [null, "50%"], true);

        //Create face areas selector
        let canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        let section = bsArea.getSection(0);
        section.content.appendChild(canvas);
        bsPanel.add(bsArea);
        bsPanel.content.style.height = "calc(100% - 20px)";
        let areas = {
            "rgb(255,0,0)": "Nose", 
            "rgb(0,0,255)": "Brow Right",
            "rgb(255,0,255)": "Brow Left",
            "rgb(0,255,255)": "Eye Right",
            "rgb(0,255,0)": "Eye Left",
            "rgb(255,255,255)": "Cheek Right",
            "rgb(255,255,0)": "Cheek Left",
            "rgb(0,125,0)": "Jaw",
            "rgb(125,0,0)": "Mouth"
        }
        let ctx = canvas.getContext("2d");
        let img = document.createElement("img");
        img.src = "./data/imgs/face areas2.png";
        img.onload = (e) =>
        {
            //canvas.height = bsArea.getSection(0).getHeight();
            ctx.drawImage(img, Math.abs(canvas.height*img.width/img.height - canvas.width)/2, 0, canvas.height*img.width/img.height, canvas.height);
        }

        let clon = canvas.cloneNode(true);
        clon.hidde = true;
        let ctxClon = clon.getContext("2d");
        let mask = document.createElement("img");
        mask.src = "./data/imgs/face mask.png";
        mask.onload = (e) =>
        {
            //clon.height = canvas.height;
            ctxClon.drawImage(mask, Math.abs(canvas.height*img.width/img.height - canvas.width)/2, 0, canvas.height*img.width/img.height, canvas.height);
            let currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let maskData = ctxClon.getImageData(0, 0, clon.width, clon.height).data;
            updateAreasColor([null,null,null], currentData, maskData);
            ctx.putImageData(currentData, 0, 0);
        }

        canvas.onmousemove = (e) => {
            e.preventDefault();
            e.stopPropagation();
            ctxClon = clon.getContext("2d");
            var pos = findPos(canvas);
            var x = e.pageX - pos.x;
            var y = e.pageY - pos.y;
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
            ctx.drawImage(img, Math.abs(canvas.height*img.width/img.height - canvas.width)/2, 0, canvas.height*img.width/img.height, canvas.height);

            let data = ctxClon.getImageData(x, y, 1, 1).data;
            let color = "rgb(" + data[0] + "," + data[1] + "," + data[2] + ")";
            let currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let maskData = ctxClon.getImageData(0, 0, clon.width, clon.height).data;
            
            if(this.editor.getSelectedActionUnit()) {
                
                let idx = Object.values(areas).indexOf(this.editor.getSelectedActionUnit());
                let area = Object.keys(areas)[idx];
                let c = area.replace("rgb(", "").replace(")","").split(",");
                
                updateAreasColor(c, currentData, maskData, null);
                
            }
            if(areas[color]) {                
                updateAreasColor(data, currentData, maskData);
                
            }
            else {                
                updateAreasColor([null,null,null], currentData, maskData);          
            }
            ctx.putImageData(currentData, 0, 0)
        }   

        function updateAreasColor(data, currentData, maskData, threshold = 50, ctx) {
            let color = [73, 100, 141];
            for (var i = 0; i < maskData.length-4; i+=4) {
                
                if(maskData[i] == data[0] && maskData[i+1] == data[1] && maskData[i+2] == data[2]) {
                    currentData.data[i+3] = 250;    
                }
                else if(!(currentData.data[i] == color[0] && currentData.data[i+1] == color[1] && currentData.data[i+2] == color[2] && currentData.data[i+3] == 250) && maskData[i+3]!=0) {
                    currentData.data[i+3] = 160;
                }
            }
        }

        function findPos(obj) {
            var curleft = 0, curtop = 0;
            if (obj.offsetParent) {
                do {
                    curleft += obj.offsetLeft;
                    curtop += obj.offsetTop;
                } while (obj = obj.offsetParent);
                return { x: curleft, y: curtop };
            }
            return undefined;
        }

        //Create blendshapes panel
        let inspector = this.createBlendShapesInspector(this.editor.mapNames);
        inspector.root.style.padding = "10px";
        inspector.hidde = true;
        bsArea.getSection(1).add(inspector);
        bsArea.onResize = (e) => {
            canvas.height = bsArea.getSection(0).getHeight();
            clon.height = canvas.height;
            ctx.drawImage(img, Math.abs(canvas.height*img.width/img.height - canvas.width)/2, 0, canvas.height*img.width/img.height, canvas.height);
            ctxClon.drawImage(mask, Math.abs(canvas.height*img.width/img.height - canvas.width)/2, 0, canvas.height*img.width/img.height, canvas.height);
            let currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let maskData = ctxClon.getImageData(0, 0, clon.width, clon.height).data;
            if(this.editor.getSelectedActionUnit()) {

                let idx = Object.values(areas).indexOf(this.editor.getSelectedActionUnit());
                let area = Object.keys(areas)[idx];
                let c = area.replace("rgb(", "").replace(")","").split(",");
                
                updateAreasColor(c, currentData, maskData);
                //ctx.clearRect(0,0, canvas.width,canvas.height);
                ctx.putImageData(currentData, 0, 0)
            }else{
                updateAreasColor([null,null,null], currentData, maskData);
                //ctx.clearRect(0,0, canvas.width,canvas.height);
                ctx.putImageData(currentData, 0, 0)
            }

        }
        // bsPanel.content.appendChild(inspector.root);

        canvas.onmouseup = (e) => {

            e.preventDefault();
            e.stopPropagation();

            ctxClon = clon.getContext("2d");
            var pos = findPos(canvas);
            var x = e.pageX - pos.x;
            var y = e.pageY - pos.y;
            ctx.drawImage(img, Math.abs(canvas.height*img.width/img.height - canvas.width)/2, 0, canvas.height*img.width/img.height, canvas.height);

            let data = ctxClon.getImageData(x, y, 1, 1).data;
            let color = "rgb(" + data[0] + "," + data[1] + "," + data[2] + ")";
            let currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let maskData = ctxClon.getImageData(0, 0, clon.width, clon.height).data;

            if(areas[color]) {
                this.editor.setSelectedActionUnit(areas[color]);
                //ctx.drawImage(img, Math.abs(canvas.height*img.width/img.height - canvas.width)/2, 0, canvas.height*img.width/img.height, canvas.height);
                this.keyFramesTimeline.selectedItem = areas[color];
                updateAreasColor(data, currentData, maskData);
                let names = {};
                for(let i in this.editor.mapNames) {
                    let toCompare = areas[color].toLowerCase().split(" ");
                    let found = true;
                    for(let j = 0; j < toCompare.length; j++) {

                        if(!i.toLowerCase().includes(toCompare[j])) {
                            found = false;
                            break;
                        }
                    }
                    if(found)
                        names[i] = this.editor.mapNames[i]
                }

                inspector.id = areas[color];
                let newinspector = this.createBlendShapesInspector(names, inspector);
                bsArea.getSection(1).add(newinspector);
                ctx.clearRect(0,0, canvas.width,canvas.height);
                ctx.putImageData(currentData, 0, 0)
            }else {
                inspector.root.remove();
                this.editor.setSelectedActionUnit();
                updateAreasColor([null,null,null], currentData, maskData);
                //ctx.clearRect(0,0, canvas.width,canvas.height);
                ctx.putImageData(currentData, 0, 0)
            }
        }   


        
        this.updateSidePanel( skeletonPanel, 'root', {firstBone: true} );
        
        tabs.addTab("Skeleton", { size: "full", content: skeletonPanel.content, callback: (tab, content, e) => {
            this.keyFramesTimeline.processTracks = KeyFramesTimeline.prototype.processTracks;
            this.keyFramesTimeline.setAnimationClip(this.editor.bodyAnimation);
            let bone = this.editor.getSelectedBone();
            this.keyFramesTimeline.selectedItem = bone ? bone.name : null;
            // if(this.timeline.clip != this.editor.bodyAnimation)
            //     this.loadClip(this.editor.bodyAnimation);
        } });

        tabs.addTab("Blendshapes", { size: "full" , content: bsPanel.content, callback: (tab, content, e) => {
            e.stopPropagation();
            // this.loadClip(this.editor.auAnimation);
            canvas.height = bsArea.getSection(0).getHeight();
            bsArea.onResize();
            
            this.keyFramesTimeline.processTracks = function() {

                let areas = [ "Nose", "Brow Right", "Brow Left", "Eye Right", "Eye Left", "Cheek Right", "Cheek Left", "Jaw", "Mouth"];

                this.tracksPerItem = {};
        
                for( let i = 0; i < this.animationClip.tracks.length; ++i ) {
                    let track = this.animationClip.tracks[i];

                    for(let j = 0; j < areas.length; j++) {
                        let toCompare = areas[j].toLowerCase().split(" ");
                        this.tracksPerItem[areas[j]] = this.tracksPerItem[areas[j]] ? this.tracksPerItem[areas[j]] : [];
                            let found = true;
                            for(let x = 0; x < toCompare.length; x++) {
        
                                if(!track.name.toLowerCase().includes(toCompare[x])) {
                                    found = false;
                                    break;
                                }
                            }
                            if(found) {
                                let trackInfo = {
                                    name: track.name, 
                                    dim: track.values.length/track.times.length,
                                    selected: [], edited: [], hovered: []
                                };
                                this.tracksPerItem[areas[j]].push(trackInfo);
                                const trackIndex = this.tracksPerItem[areas[j]].length - 1;
                                this.tracksPerItem[areas[j]][trackIndex].idx = trackIndex;
                                this.tracksPerItem[areas[j]][trackIndex].clipIdx = i;
                                this.tracksDictionary[track.name] = areas[j];
                                // Save index also in original track
                                track.idx = trackIndex;
                            }
                    }
                }
            }
            this.keyFramesTimeline.setAnimationClip(this.editor.auAnimation);
            this.keyFramesTimeline.selectedItem = this.editor.getSelectedActionUnit();
            // this.keyFramesTimeline.resize(this.keyFramesTimeline.size)
        } });

        this.mainArea.getSection(1).add( tabs );

        this.resize();
    }

    createBlendShapesInspector(bsNames, inspector = null) {
        
        inspector = inspector || new LiteGUI.Inspector("blendshapes-inspector");
        if(document.getElementById('blendshapes-inspector')) {
                document.getElementById('blendshapes-inspector').innerHTML = "";
            document.getElementById('blendshapes-inspector').remove();    
        }
            

        if(inspector.id)
            inspector.addTitle(inspector.id);
        
        // inspector.root.hidden = true;
       // inspector.root.style.margin = "0px 25px";
        //inspector.addSection("User positioning");

        for(let name in bsNames) {
            // let info = inspector.addInfo(null, name, {width: "150px"});
            // if(document.getElementById('progressbar-' + name ))
            //     document.getElementById('progressbar-' + name ).remove();

            // let progressBar = document.createElement('div');
            // progressBar.className = "progress mb-3";
            // progressBar.innerHTML = 
            // '<div id="progressbar-' + name + '" class="progress-bar bg-danger" role="progressbar" style="width: 0%" aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>'
          
            // info.appendChild(progressBar);
            inspector.addProgressbar(name, 0, {min: 0, max: 1, low: 0.3, optimum: 1, high: 0.6, showValue: true, editable: true, callback: this.updateBlendshapesProperties.bind(this)});
        }
        
        return inspector;
    }

    updateSidePanel(root, itemSelected, options) {

        if(!this.sidePanel)
        return;

        itemSelected = itemSelected || this.itemSelected;
    
        options = options || {};
        this.boneProperties = {};
        this.itemSelected = itemSelected;
        root = root || this.sidePanel;
        $(root.content).empty();
        
        var mytree = this.updateNodeTree();
    
        var litetree = new LiteGUI.Tree(mytree, {id: "tree"});
        litetree.setSelectedItem(itemSelected);
        var that = this;
    
        // Click right mouse
        litetree.onItemContextMenu = (e, el) => { 
    
            e.preventDefault();
            var boneId = el.data.id;
    
            const bone = this.editor.skeletonHelper.getBoneByName(boneId);
            if(!bone)
            return;
    
            const boneEnabled = true;

            var actions = [
                {
                    title: (boneEnabled?"Disable":"Enable") + "<i class='bi bi-" + (boneEnabled?"dash":"check") + "-circle float-right'></i>",
                    disabled: true,
                    callback: () => console.log("TODO: Disable")
                },
                {
                    title: "Copy" + "<i class='bi bi-clipboard float-right'></i>",
                    callback: () => LiteGUI.toClipboard( bone )
                }
            ];
            
            new LiteGUI.ContextMenu( actions, { event: e });
        };
    
        litetree.onItemSelected = function(data){
            this.expandItem(data.id);
            itemSelected = data.id;
            widgets.onRefresh();

            if(!that.editor)
            throw("No editor attached");

            that.editor.setSelectedBone( data.id );
            that.keyFramesTimeline.setSelectedItem( data.id );
        };
    
        litetree.root.addEventListener("item_dblclicked", function(e){
            e.preventDefault();
        });
    
        this.tree = litetree;
    
        $(root.content).append( litetree.root );
    
        // Editor widgets 
        var widgets = new LiteGUI.Inspector();
        $(root.content).append(widgets.root);
    
        const makePretitle = (src) => { return "<img src='data/imgs/mini-icon-"+src+".png' style='margin-right: 4px;'>"; }

        widgets.onRefresh = (o) => {

            o = o || {};
            const numBones = this.editor.skeletonHelper.bones.length;

            widgets.clear();
            widgets.addSection("Animation Clip", { pretitle: makePretitle('stickman') });
            widgets.addString("Name", this.clip.name || "Unnamed", { callback: v => this.clip.name = v });
            widgets.addInfo("Num bones", numBones);
            widgets.addInfo("Frame rate", this.keyFramesTimeline.framerate);
            widgets.addInfo("Duration", this.duration.toFixed(2));
            widgets.addSlider("Speed", this.editor.mixer.timeScale, { callback: v => {
                this.editor.mixer.timeScale = this.editor.video.playbackRate = v;
            }, min: 0.25, max: 1.5, step: 0.05, precision: 2});
            widgets.addSeparator();
            widgets.addSlider("Optimize Threshold", this.editor.optimizeThreshold, { callback: v => {
                this.editor.optimizeThreshold = v;
            }, min: 0, max: 0.25, step: 0.001, precision: 4});
            widgets.widgets_per_row = 1;

            const boneSelected = !(o.firstBone && numBones) ? 
                this.editor.skeletonHelper.getBoneByName(itemSelected) : 
                this.editor.skeletonHelper.bones[0];

            if(boneSelected) {

                let disabled = false;
                if(this.editor.mode == this.editor.eModes.NMF)
                    disabled = true;
                 
                const numTracks = this.keyFramesTimeline.getNumTracks(boneSelected);
                if(!disabled) {
                    const _Tools = this.editor.hasGizmoSelectedBoneIk() ? ["Joint", "Follow"] : ["Joint"];
                    
                    widgets.addSection("Gizmo", { pretitle: makePretitle('gizmo'), settings: (e) => this.openSettings( 'gizmo' ), settings_title: "<i class='bi bi-gear-fill section-settings'></i>" });
                    
                    widgets.addButtons( "Tool", _Tools, { selected: this.editor.getGizmoTool(), name_width: "50%", width: "100%", callback: (v) => {
                        if(this.editor.getGizmoTool() != v) this.editor.setGizmoTool(v);
                    }});
                    
                    if( this.editor.getGizmoTool() == "Joint" ){
                        const _Modes = numTracks > 1 ? ["Translate","Rotate"] : ["Rotate"];
                        if( numTracks <= 1 ){ this.editor.setGizmoMode("Rotate"); }
                        widgets.addButtons( "Mode", _Modes, { selected: this.editor.getGizmoMode(), name_width: "50%", width: "100%", callback: (v) => {
                            if(this.editor.getGizmoMode() != v) this.editor.setGizmoMode(v);
                        }});
                    }
    
                    widgets.addButtons( "Space", ["Local","World"], { selected: this.editor.getGizmoSpace(), name_width: "50%", width: "100%", callback: (v) => {
                        if(this.editor.getGizmoSpace() != v) this.editor.setGizmoSpace(v);
                    }});
    
                    widgets.addCheckbox( "Snap", this.editor.isGizmoSnapActive(), {callback: () => this.editor.toggleGizmoSnap() } );
    
                    widgets.addSeparator();
                }    

                const innerUpdate = (attribute, value) => {
                    boneSelected[attribute].fromArray( value ); 
                    this.editor.gizmo.onGUI();
                };

                widgets.addSection("Bone", { pretitle: makePretitle('circle') });
                widgets.addInfo("Name", boneSelected.name);
                widgets.addInfo("Num tracks", numTracks ?? 0);

                // Only edit position for root bone
                if(boneSelected.children.length && boneSelected.parent.constructor !== boneSelected.children[0].constructor) {
                    widgets.addTitle("Position");
                    this.boneProperties['position'] = widgets.addVector3(null, boneSelected.position.toArray(), {disabled: this.editor.state || disabled, precision: 3, className: 'bone-position', callback: (v) => innerUpdate("position", v)});
                }

                widgets.addTitle("Rotation (XYZ)");
                this.boneProperties['rotation'] = widgets.addVector3(null, boneSelected.rotation.toArray(), {disabled: this.editor.state || disabled, precision: 3, className: 'bone-euler', callback: (v) => innerUpdate("rotation", v)});

                widgets.addTitle("Quaternion");
                this.boneProperties['quaternion'] = widgets.addVector4(null, boneSelected.quaternion.toArray(), {disabled: this.editor.state || disabled, precision: 3, className: 'bone-quaternion', callback: (v) => innerUpdate("quaternion", v)});
            }
        };

        widgets.onRefresh(options);

        // update scroll position
        var element = root.content.querySelectorAll(".inspector")[0];
        var maxScroll = element.scrollHeight;
        element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
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

    createPresetsDialog() {
        // Create a new dialog
        let dialog = new LiteGUI.Dialog('Non Manual Features presets', { title:'Presets', close: true, minimize: false, width: 500, height: 400, scroll: true, resizable: true, draggable: true });
        var that = this;
        // Create a collection of widgets
        let widgets = new LiteGUI.Inspector();
        let values = ANIM.FacePresetClip.facePreset;//["Yes/No-Question", "Negative", "WH-word Questions", "Topic", "RH-Questions"];
        for(let i = 0; i < values.length; i++) {
            widgets.addButton(null, values[i], {
                width: 100,
                callback: function(v, e,) { 
                    dialog.close();
                    let presetClip = new ANIM.FacePresetClip({preset: v});
                    for(let i = 0; i < presetClip.clips.length; i++){
                        that.clipsTimeline.addClip( presetClip.clips[i], presetClip.clips[i].start);
                    }
                    //that.editor.NMFController.updateTracks.bind(that.editor.NMFController) 
                }
            } )
        }
        dialog.root.classList.add("grid");
        dialog.add(widgets);

        // Placeholder function to show the new settings. Normally you would do something usefull here
        // with the new settings.
        function applySettings() {
            console.log("Expression is " + expressions.getValue() );
        }

        // Add some buttons
        dialog.show();
    }

    createNewPresetDialog(clips) {
         LiteGUI.prompt( "Preset name", (v) => {
            let presetInfo = {preset: v, clips:[]};
            for(let i = 0; i < clips.length; i++){
                let [trackIdx, clipIdx] = clips[i];
                presetInfo.clips.push(this.clipsTimeline.clip.tracks[trackIdx].clips[clipIdx]);
            }
            let preset = new ANIM.FacePresetClip(presetInfo);
        }, {title: "Create preset"} )
    }

    showNMFGuide() {
        //let dialog = new LiteGUI.Dialog();
        LiteGUI.popup("Right click on the Non-Manual Features timeline to create a new clip. You can create a clip from a selected lexeme or from a preset configuration.")
    }

    showClipInfo(clip) {

        this.clipInPanel = clip;
        
        var inspector = new LiteGUI.Inspector();
        if(clip)
        {
            inspector.widgets_per_row = 1;
            inspector.addTitle( clip.constructor.name );
            inspector.addString("Id", clip.id, {callback: function(v)
            {
                this.clipInPanel.id = v;
            }.bind(this)})
            
            inspector.addSection("Time");
            const updateTracks = () => {
                this.showClipInfo(clip);
                if(clip.start + clip.duration > this.clipsTimeline) {
                    this.clipsTimeline.onSetDuration(clip.start + clip.duration);
                }
                this.editor.NMFController.updateTracks(); 
            }
            inspector.addNumber("Start", clip.start, {min:0, step:0.01, callback: (v) =>
            {              
                // var dt = v - this.clipInPanel.start;
                // if(clip.ready) clip.ready += dt;
                // if(clip.strokeStart) clip.strokeStart += dt;
                // if(clip.stroke) clip.stroke += dt;
                // if(clip.attackPeak) clip.attackPeak += dt;
                // if(clip.strokeEnd) clip.strokeEnd += dt;
                // if(clip.relax) clip.relax += dt;
                this.clipInPanel.start = v;
                clip.start = v;
                updateTracks();
                
                /*this.showClipInfo(clip)*/
            }})
            inspector.addNumber("Duration", clip.duration, {min:0.01, step:0.01, callback: (v) =>
            {
                this.clipInPanel.duration = v;
                clip.relax = Math.min(v +   clip.start, clip.relax);
                clip.attackPeak = Math.min(v +  clip.start, clip.attackPeak);
                updateTracks();
            }})
            inspector.addSection("Sync points");
            if(clip.attackPeak != undefined)
            {
                inspector.addNumber("Attack Peak", clip.attackPeak - clip.start, {min:0, max: clip.relax - clip.start, step:0.01, callback: (v) =>
                    {              
                       clip.attackPeak = v + clip.start;
                       updateTracks();
                    }})
            }
            if(clip.relax != undefined) 
            {
                inspector.addNumber("Relax", clip.relax  - clip.start, {min: clip.attackPeak - clip.start, max: clip.duration , step:0.01, callback: (v) =>
                    {              
                       clip.relax = v + clip.start;
                       clip.attackPeak = Math.min(clip.relax, clip.attackPeak);
                       updateTracks();
                    }})
            }

            inspector.addSection("Content");
            if(clip.showInfo)
            {
                clip.showInfo(inspector, updateTracks);
            }
            else{
                for(var i in clip.properties)
                {
                    var property = clip.properties[i];
                    switch(property.constructor)
                    {
                        
                        case String:
                            inspector.addString(i, property, {callback: function(i,v)
                            {
                                this.clipInPanel.properties[i] = v;
                            }.bind(this, i)});
                            break;
                        case Number:
                            if(i=="amount")
                            {
                                inspector.addNumber(i, property, {min:0, max:1, step:0.01, callback: function(i,v)
                                {
                                    this.clipInPanel.properties[i] = v;
                                    updateTracks();
                                }.bind(this,i)});
                            }
                        else{
                            inspector.addNumber(i, property, {callback: function(i,v)
                                {
                                    this.clipInPanel.properties[i] = v;
                                    updateTracks();
                                }.bind(this,i)});
                            }
                            break;
                        case Boolean:
                            inspector.addCheckbox(i, property, {callback: function(i,v)
                            {
                                this.clipInPanel.properties[i] = v;
                                updateTracks();
                            }.bind(this,i)});
                            break;
                        case Array:
                            inspector.addArray(i, property, {callback: function(i,v)
                            {
                                this.clipInPanel.properties[i] = v;
                                updateTracks();
                            }.bind(this,i)});
                            break;
                    }
                }
            }
            inspector.addButton(null, "Delete", () => this.clipsTimeline.deleteClip(this.clipsTimeline.lastClipsSelected[0], () => {clip = null;  this.clipsTimeline.optimizeTracks(); updateTracks()}));
        }
        this.sidePanel.content.replaceChild(inspector.root, this.sidePanel.content.getElementsByClassName("inspector")[0]);
    }
    // Listed with __ at the beggining
    updateBoneProperties() {
                            
        const bone = this.editor.skeletonHelper.bones[this.editor.gizmo.selectedBone];
        if(!bone)
        return;
        
        for( const p in this.boneProperties ) {
            // @eg: p as position, element.setValue( bone.position.toArray() )
            this.boneProperties[p].setValue( bone[p].toArray(), true );
        }
    }
    
    updateBlendshapesProperties(name, value) {
        value = Number(value);
        let tracksIdx = [];                    
        for(let i = 0; i < this.editor.auAnimation.tracks.length; i++) {
            if(name == this.editor.auAnimation.tracks[i].name) {
                let idx = this.keyFramesTimeline.getCurrentKeyFrame(this.keyFramesTimeline.animationClip.tracks[i], this.keyFramesTimeline.currentTime, 0.1)
                this.keyFramesTimeline.animationClip.tracks[i].values[idx] = value;
                this.editor.auAnimation.tracks[i].values[idx] = value;
                this.editor.blendshapesArray[idx][name] = value;
                let map = this.editor.blendshapesManager.getBlendshapesMap(name);
                for(let j = 0; j < map.length; j++){
                    for(let t = 0; t < this.editor.faceAnimation.tracks.length; t++) {
                        
                        if(this.editor.faceAnimation.tracks[t].name == map[j]) {
                            this.editor.faceAnimation.tracks[t].values[idx] = value;
                            tracksIdx.push(t);
                            break;
                        }
                    }
                }
                // Update animation interpolants
                this.editor.updateAnimationAction(this.editor.faceAnimation, tracksIdx );
                return true;
            }
        }
        //update clip
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
    
    updateNodeTree() {
        
        const rootBone = this.editor.skeletonHelper.bones[0];
        
        let mytree = { 'id': rootBone.name };
        let children = [];
        
        const addChildren = (bone, array) => {
            
            for( let b of bone.children ) {
                
                if ( ! b.isBone ){ continue; }
                let child = {
                    id: b.name,
                    children: []
                }
                
                array.push( child );
                
                addChildren(b, child.children);
            }
        };
        
        addChildren(rootBone, children);
        
        mytree['children'] = children;
        return mytree;
    }
    
    setBoneInfoState( enabled ) {
        for(const ip of $(".bone-position input, .bone-euler input, .bone-quaternion input"))
        enabled ? ip.removeAttribute('disabled') : ip.setAttribute('disabled', !enabled);
    }
    /** ------------------------------------------------------------ */

    /** -------------------- TIMELINE -------------------- */
    render() {

        this.drawTimeline();
    }

    drawTimeline() {
        
        // const canvas = this.timelineCTX.canvas;
        this.currentTime = this.editor.mixer.time;

        if(this.currentTime > this.duration) {
            this.currentTime = 0.0;
            this.editor.onAnimationEnded();
        }

        this.keyFramesTimeline.draw(this.currentTime); //  [0, 0, canvas.width, canvas.height]
        if(this.clipsTimeline)
        {
           
            this.clipsTimeline.draw(this.currentTime, null, false);    // [0, 0, this.timelineNMFCTX.canvas.width, this.timelineNMFCTX.canvas.height]
        }
        
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
        this.keyFramesTimeline.setSelectedItem( item );
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

    resize() {
        for(let s of LiteGUI.SliderList) {
            // Resize canvas
            s.root.width = s.root.parentElement.offsetWidth + 35;
            s.setValue(null);
        }

        const canvasArea = document.getElementById("canvasarea");
        let timelineCanvas = document.getElementById("timelineCanvas");
        let timelineNMFCanvas = document.getElementById("timelineNMFCanvas");
        timelineCanvas.width = timelineNMFCanvas.width = canvasArea.clientWidth;
    }
};

export { Gui };