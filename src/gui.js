import { Timeline } from "./libs/timeline.module.js";
import { UTILS } from "./utils.js";
import { VideoUtils } from "./video.js"; 
class Gui {

    constructor(editor) {
       
        this.showTimeline = true;
        this.showVideo = true;
        this.current_time = 0;
        this.skeletonScroll = 0;
        this.editor = editor;

        this.boneProperties = {};

        this.create();
    }

    loadClip( clip ) {

        this.clip = clip;
        this.duration = clip.duration;

        let boneName = null;
        if(this.editor.skeletonHelper.bones.length) {
            boneName = this.editor.skeletonHelper.bones[0].name;
        }

        this.timeline = new Timeline( this.editor.animationClip, boneName);
        this.timeline.framerate = 30;
        this.timeline.setScale(400);
        this.timeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.animationClip.duration - 0.001) );
        this.timeline.onSetDuration = (t) => {this.timeline.duration = this.clip.duration = this.editor.animationClip.duration = t};
        this.timeline.onSelectKeyFrame = (e, info, index) => {
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
        this.timeline.onBoneUnselected = () => this.editor.gizmo.stop();
        this.timeline.onUpdateTrack = (idx) => this.editor.updateAnimationAction(idx);
        this.timeline.onGetSelectedBone = () => { return this.editor.getSelectedBone(); };
        this.timeline.onGetOptimizeThreshold = () => { return this.editor.optimizeThreshold; }

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
        let c = document.getElementById("timeline")
        c.style.display = "block"
        this.mainArea.onresize = window.onresize;

        let timelineCanvas = document.getElementById("timelineCanvas");
        timelineCanvas.width = canvasArea.clientWidth;
        this.timelineCTX = timelineCanvas.getContext("2d");

        timelineCanvas.addEventListener("mouseup", this.onMouse.bind(this));
        timelineCanvas.addEventListener("mousedown", this.onMouse.bind(this));
        timelineCanvas.addEventListener("mousemove", this.onMouse.bind(this));
        timelineCanvas.addEventListener("wheel", this.onMouse.bind(this));
        timelineCanvas.addEventListener('contextmenu', (e) => e.preventDefault(), false);

        timelineCanvas.addEventListener( 'keydown', (e) => {
            switch ( e.key ) {
                case " ": // Spacebar
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const stateBtn = document.getElementById("state_btn");
                    stateBtn.click();
                    break;
            }
        });

        let timelineNMFCanvas = document.getElementById("timelineNMFCanvas");
        timelineNMFCanvas.width = timelineCanvas.width;
        timelineNMFCanvas.style.display = "none";
        this.timelineNMFCTX = timelineNMFCanvas.getContext("2d");

        // timelineNMFCanvas.addEventListener("mouseup", (e) => { e.preventDefault(); if(this.NMFtimeline) this.NMFtimeline.processMouse(e); });
        // timelineNMFCanvas.addEventListener("mousedown", (e) => { e.preventDefault(); if(this.NMFtimeline) this.NMFtimeline.processMouse(e); });
        // timelineNMFCanvas.addEventListener("mousemove", (e) => { e.preventDefault(); if(this.NMFtimeline) this.NMFtimeline.processMouse(e); });
        // timelineNMFCanvas.addEventListener("wheel", (e) => { e.preventDefault(); if(this.NMFtimeline) this.NMFtimeline.processMouse(e); });
        timelineNMFCanvas.addEventListener("mouseup", this.onMouse.bind(this));
        timelineNMFCanvas.addEventListener("mousedown", this.onMouse.bind(this));
        timelineNMFCanvas.addEventListener("mousemove", this.onMouse.bind(this));
        timelineNMFCanvas.addEventListener("wheel", this.onMouse.bind(this));
        timelineNMFCanvas.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            let actions = [];
            //let track = this.NMFtimeline.clip.tracks[0];
            if(this.NMFtimeline.selected_clip) {
                actions.push(
                    {
                        title: "Copy" + " <i class='bi bi-clipboard-fill float-right'></i>",
                        callback: () => {this.clip_to_copy = this.NMFtimeline.selected_clip;}
                    }
                )
                actions.push(
                    {
                        title: "Delete" + " <i class='bi bi-trash float-right'></i>",
                        callback: () => {this.NMFtimeline.deleteClip(null, this.showClipInfo());}
                    }
                )
            }
            else{
                actions.push(
                    {
                        title: "Add" + " <i class='bi bi-plus float-right'></i>",
                        callback: () => {this.NMFtimeline.addClip( new ANIM.FaceLexemeClip(), this.editor.NMFController.updateTracks.bind(this.editor.NMFController) );}
                    }
                );
                if(this.clip_to_copy)
                {
                    actions.push(
                        {
                            title: "Paste" + " <i class='bi bi-clipboard-fill float-right'></i>",
                            callback: () => {
                                let clip = new ANIM.FaceLexemeClip(this.clip_to_copy);
                                this.clip_to_copy = null;
                                this.NMFtimeline.addClip(clip, this.editor.NMFController.updateTracks.bind(this.editor.NMFController)); 
                            }
                        }
                    )
                }
                
            }
            new LiteGUI.ContextMenu( actions, { event: e });
        }, false);

        timelineNMFCanvas.addEventListener("dblclick", (e) => { e.preventDefault(); if(this.NMFtimeline) this.NMFtimeline.processMouse(e); });
        timelineNMFCanvas.addEventListener( 'keydown', (e) => {
            switch ( e.key ) {
                case " ": // Spacebar
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const stateBtn = document.getElementById("state_btn");
                    stateBtn.click();
                    break;
                case "Delete": // Spacebar
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.NMFtimeline.deleteClip()
                    break;
            }
        });
    }

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

    updateMenubar() 
    {
        let menubar = window.menubar;
        menubar.add("Project/Upload animation", {icon: "<i class='bi bi-upload float-right'></i>", callback: () => this.editor.getApp().storeAnimation() });
        menubar.add("Project/Show video", { type: "checkbox", property: "showVideo", callback: () => {
            const tl = document.getElementById("capture");
            tl.style.display = this.showVideo ? "flex": "none";
        }});
        menubar.add("Project/");
        menubar.add("Project/Export MF Animation", {subtitle: true});
        menubar.add("Project/Export BVH", {icon: "<i class='bi bi-file-text float-right'></i>",  callback: () => this.editor.export('BVH') });
        menubar.add("Project/Export NMF Animation", {subtitle: true});
        menubar.add("Project/Export extended BVH", {icon: "<i class='bi bi-file-text float-right'></i>",  callback: () => this.editor.export("BVH extended") });
        menubar.add("Project/Export BML", {icon: "<i class='bi bi-file-text float-right'></i>",  callback: () => this.editor.export() });
        menubar.add("Project/Export Animation together", {subtitle: true});
        menubar.add("Project/Export GLB", {icon: "<i class='bi bi-file-text float-right'></i>",  callback: () => this.editor.export('GLB') });
        menubar.add("Project/Open preview", {icon: "<i class='bi bi-file-earmark-play float-right'></i>",  callback: () => this.editor.showPreview() });

        menubar.add("Timeline/Show", { type: "checkbox", property: "showTimeline", callback: () => {
            const tl = document.getElementById("timeline");
            tl.style.display = this.showTimeline ? "block": "none";
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
       
       
        this.appendCombo( menubar, { hidden: true} );
    }

    createCaptureGUI()
    {
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
                        // Update header
                        let capture = document.getElementById("capture_btn");
                        capture.disabled = true;
                        capture.style.display = "block";

                        let trimBtn = document.getElementById("trim_btn");
                        trimBtn.style.display = "none";

                        // TRIM VIDEO - be sure that only the sign is recorded
                        let canvas = document.getElementById("outputVideo");
                        let video = document.getElementById("recording");
                        let input = document.getElementById("inputVideo");
                        let live = true;
                        if(input.src)
                        {
                            window.globals.app.onLoadVideo(input.src);
                        }
                        else{

                            window.globals.app.setEvents(live);
                        }
                       // await VideoUtils.unbind();
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
                    <div id="distance-info" class="alert alert-primary"> \
                        <div class="icon__wrapper"> \
                            <i class="fas fa-solid fa-check check"></i> \
                        <!--<span class="mdi mdi-alert-outline"></span>--> \
                        </div> \
                        <p>Distance to the camera looks good</p> \
                        <!-- <span class="mdi mdi-open-in-new open"></span> -->\
                    </div> \
                    <div id="hands-info" class="alert alert-primary"> \
                        <div class="icon__wrapper"> \
                            <i class="fas fa-solid fa-check check"></i> \
                        <!--<span class="mdi mdi-alert-outline"></span>--> \
                        </div> \
                        <p>Hands visible</p> \
                        <!--<span class="mdi mdi-open-in-new open"></span>--> \
                    </div>\
                </div>\
            </div>'
            
        // div.getElementById("warnings").appendChild(button);
        //captureArea.appendChild( div );
        let videoArea = document.getElementById("video-area");
       videoArea.classList.add("video-area");

        let i = document.createElement("i");
        i.id = "expand-capture-gui";
        i.style = "position: relative;top: 35px;left: -19px;"
        i.className = "fas fa-solid fa-circle-chevron-left drop-icon";
        i.addEventListener("click", () => this.changeCaptureGUIVisivility(i.classList.contains("fa-circle-chevron-right")) );
        //videoArea.appendChild(i);

        let inspector = new LiteGUI.Inspector("capture-inspector");
        inspector.root.hidden = true;
       // inspector.root.style.margin = "0px 25px";
        inspector.addTitle("User positioning");
        //inspector.addSection("User positioning");
        inspector.addInfo(null, 'Position yourself centered on the image with the hands and troso visible. If the conditions are not met, reposition yourself or the camera.') 
        inspector.addInfo(null, 'Distance to the camera');

        let progressVar = document.createElement('div');
        progressVar.className = "progress mb-3";
        progressVar.innerHTML = 
           '<div id="progressbar-torso" class="progress-bar bg-danger" role="progressbar" style="width: 50%" aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>'
            // <div id="progressbar-torso-warning" class="progress-bar bg-warning" role="progressbar" style="width: 30%" aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>\
            // <div id="progressbar-torso-success" class="progress-bar bg-success" role="progressbar" style="width: 20%" aria-valuenow="20" aria-valuemin="0" aria-valuemax="100"></div>'

        inspector.root.appendChild(progressVar);
        inspector.addInfo(null, 'Left Hand visibility');
        let progressVarLH = document.createElement('div');
        progressVarLH.className = "progress mb-3";
        progressVarLH.innerHTML = 
           '<div id="progressbar-lefthand" class="progress-bar bg-danger" role="progressbar" style="width: 50%" aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>'
            // <div id="progressbar-torso-warning" class="progress-bar bg-warning" role="progressbar" style="width: 30%" aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>\
            // <div id="progressbar-torso-success" class="progress-bar bg-success" role="progressbar" style="width: 20%" aria-valuenow="20" aria-valuemin="0" aria-valuemax="100"></div>'

        inspector.root.appendChild(progressVarLH);

        inspector.addInfo(null, 'Right hand visibility');
        let progressVarRH = document.createElement('div');
        progressVarRH.className = "progress mb-3";
        progressVarRH.innerHTML = 
           '<div id="progressbar-righthand" class="progress-bar bg-danger" role="progressbar" style="width: 50%" aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>'
            // <div id="progressbar-torso-warning" class="progress-bar bg-warning" role="progressbar" style="width: 30%" aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>\
            // <div id="progressbar-torso-success" class="progress-bar bg-success" role="progressbar" style="width: 20%" aria-valuenow="20" aria-valuemin="0" aria-valuemax="100"></div>'

        inspector.root.appendChild(progressVarRH);
        mainCapture.appendChild(i);
        mainCapture.appendChild(inspector.root)
        videoArea.appendChild(buttonContainer);
    }

    changeCaptureGUIVisivility(hidde) {
        document.getElementById("capture-inspector").hidden = hidde;
        let i = document.getElementById("expand-capture-gui");
        if(hidde) {
            i.classList.remove("fa-circle-chevron-right") ;
            i.classList.add("fa-circle-chevron-left");
        }
        else{
            i.classList.remove("fa-circle-chevron-left"); 
            i.classList.add("fa-circle-chevron-right");
        }
    }

    updateCaptureGUI(landmarksResults, isRecording) {
        
        if(isRecording){
            this.changeCaptureGUIVisivility(true);
            return;
        }
        else {
            //document.getElementById("capture-info").classList.remove("hidden");
        }
        if(!landmarksResults || !landmarksResults.poseLandmarks) return;
        
        let infoDistance = document.getElementById("distance-info");
        let infoHands = document.getElementById("hands-info");
        const { poseLandmarks } = landmarksResults;
        
        let distance = (poseLandmarks[23].visibility + poseLandmarks[24].visibility)*0.5;
        let leftHand = (poseLandmarks[15].visibility + poseLandmarks[17].visibility + poseLandmarks[19].visibility)/3;
        let rightHand = (poseLandmarks[16].visibility + poseLandmarks[18].visibility + poseLandmarks[20].visibility)/3;
      
        // Intro message for the pose detection assesment step
        let torsoCondition = poseLandmarks[23].visibility < .5 || poseLandmarks[24].visibility < .5;
        let handsCondition = poseLandmarks[15].visibility < .5 || poseLandmarks[16].visibility < .5 || poseLandmarks[19].visibility < .5 || poseLandmarks[17].visibility < .5 || poseLandmarks[18].visibility < .5 || poseLandmarks[20].visibility < .5;
       
        // infoDistance.getElementsByTagName("p")[0].innerText = (torsoCondition) ? 'You are too close to the camera' : 'Distance to the camera looks good';
        // infoDistance.className = (torsoCondition) ? "alert alert-warning" : "alert alert-success";
        
        // infoHands.getElementsByTagName("p")[0].innerText = (handsCondition) ? 'Your hands are not visible' : 'Hands visible';
        // infoHands.className = (handsCondition) ? "alert alert-warning" : "alert alert-success";
        

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

        // if(torsoCondition) 
        // {
        //     infoDistance.getElementsByTagName("i")[0].classList.remove("fa-check");
        //     infoDistance.getElementsByTagName("i")[0].classList.add("fa-exclamation-triangle");
        // } else {
        //     infoDistance.getElementsByTagName("i")[0].classList.add("fa-exclamation-triangle");
        //     infoDistance.getElementsByTagName("i")[0].classList.remove("fa-check");
        // }
        // if(handsCondition) 
        // {
        //     infoHands.getElementsByTagName("i")[0].classList.remove("fa-check");
        //     infoHands.getElementsByTagName("i")[0].classList.add("fa-exclamation-triangle");
        // }else{
        //     infoHands.getElementsByTagName("i")[0].classList.add("fa-exclamation-triangle");
        //     infoHands.getElementsByTagName("i")[0].classList.remove("fa-check");
        // } 
        // let message = `
        // ${(torsoCondition) ? 'You are too close to the camera.\n': ''}
        // ${(handsCondition) ? 'Your hands are too near to the bottom margin.\n': ''}
        // `;
        // console.log(message)
        // canvasCtx.fillStyle = 'rgba(125,125,0, 0.6)';
        // //canvasCtx.scale(-1, 1);
        // canvasCtx.fillRect(0, 0, canvasElement.width, 80);   
        // canvasCtx.fillStyle = 'white';
        // // canvasCtx.translate(0, canvasElement.width);
        // canvasCtx.font = "20px serif";
        // canvasCtx.fillText( message, 10,  40);
        
    }

    hiddeCaptureArea() {
        let e = document.getElementById("video-area");
        e.classList.remove("video-area");
        
        let i = document.getElementById("expand-capture-gui");
        i.hidden = true;
    }
    createSidePanel() {

        let mode = document.querySelector('#mode-selector')
        mode.style.display = "flex";

        this.mainArea.split("horizontal", [null,"300px"], true);
        var docked = new LiteGUI.Panel("sidePanel", {title: 'Skeleton', scroll: true});
        this.mainArea.getSection(1).add( docked );
        $(docked).bind("closed", function() { this.mainArea.merge(); });
        this.sidePanel = docked;
        this.updateSidePanel( docked, 'root', {firstBone: true} );
        
        docked.content.id = "main-inspector-content";
        docked.content.style.width = "100%";

        this.resize();
    }

    updateSidePanel(root, item_selected, options) {

        if(!this.sidePanel)
        return;

        item_selected = item_selected || this.item_selected;
    
        options = options || {};
        this.boneProperties = {};
        this.item_selected = item_selected;
        root = root || this.sidePanel;
        $(root.content).empty();
        
        var mytree = this.updateNodeTree();
    
        var litetree = new LiteGUI.Tree(mytree, {id: "tree"});
        litetree.setSelectedItem(item_selected);
        var that = this;
    
        // Click right mouse
        litetree.onItemContextMenu = (e, el) => { 
    
            e.preventDefault();
            var bone_id = el.data.id;
    
            const bone = this.editor.skeletonHelper.getBoneByName(bone_id);
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
            item_selected = data.id;
            widgets.on_refresh();

            if(!that.editor)
            throw("No editor attached");

            that.editor.setSelectedBone( data.id );
            that.timeline.setSelectedBone( data.id );
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

        widgets.on_refresh = (o) => {

            o = o || {};
            const numBones = this.editor.skeletonHelper.bones.length;

            widgets.clear();
            widgets.addSection("Animation Clip", { pretitle: makePretitle('stickman') });
            widgets.addString("Name", this.clip.name || "Unnamed", { callback: v => this.clip.name = v });
            widgets.addInfo("Num bones", numBones);
            widgets.addInfo("Frame rate", this.timeline.framerate);
            widgets.addInfo("Duration", this.duration.toFixed(2));
            widgets.addSlider("Speed", this.editor.mixer.timeScale, { callback: v => {
                this.editor.mixer.timeScale = this.editor.video.playbackRate = v;
            }, min: 0.25, max: 1.5, step: 0.05, precision: 2});
            widgets.addSeparator();
            widgets.addSlider("Optimize Threshold", this.editor.optimizeThreshold, { callback: v => {
                this.editor.optimizeThreshold = v;
            }, min: 0, max: 0.25, step: 0.001, precision: 4});
            widgets.widgets_per_row = 1;

            const bone_selected = !(o.firstBone && numBones) ? 
                this.editor.skeletonHelper.getBoneByName(item_selected) : 
                this.editor.skeletonHelper.bones[0];

            if(bone_selected) {

                const numTracks = this.timeline.getNumTracks(bone_selected);
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

                const innerUpdate = (attribute, value) => {
                    bone_selected[attribute].fromArray( value ); 
                    this.editor.gizmo.onGUI();
                };

                widgets.addSection("Bone", { pretitle: makePretitle('circle') });
                widgets.addInfo("Name", bone_selected.name);
                widgets.addInfo("Num tracks", numTracks ?? 0);

                // Only edit position for root bone
                if(bone_selected.children.length && bone_selected.parent.constructor !== bone_selected.children[0].constructor) {
                    widgets.addTitle("Position");
                    this.boneProperties['position'] = widgets.addVector3(null, bone_selected.position.toArray(), {disabled: this.editor.state, precision: 3, className: 'bone-position', callback: (v) => innerUpdate("position", v)});
                }

                widgets.addTitle("Rotation (XYZ)");
                this.boneProperties['rotation'] = widgets.addVector3(null, bone_selected.rotation.toArray(), {disabled: this.editor.state, precision: 3, className: 'bone-euler', callback: (v) => innerUpdate("rotation", v)});

                widgets.addTitle("Quaternion");
                this.boneProperties['quaternion'] = widgets.addVector4(null, bone_selected.quaternion.toArray(), {disabled: this.editor.state, precision: 3, className: 'bone-quaternion', callback: (v) => innerUpdate("quaternion", v)});
            }
        };

        widgets.on_refresh(options);

        // update scroll position
        var element = root.content.querySelectorAll(".inspector")[0];
        var maxScroll = element.scrollHeight;
        element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
    }

    showClipInfo(clip)
    {
        this.clip_in_panel = clip;
        
        var inspector = new LiteGUI.Inspector();
        if(clip)
        {
            inspector.widgets_per_row = 1;
            inspector.addTitle( clip.constructor.name );
            inspector.addString("Id", clip.id, {callback: function(v)
            {
                this.clip_in_panel.id = v;
            }.bind(this)})
            
            inspector.addSection("Time");
            const updateTracks = () => {
                this.showClipInfo(clip);
                if(clip.start + clip.duration > this.NMFtimeline) {
                    this.NMFtimeline.onSetDuration(clip.start + clip.duration);
                }
                this.editor.NMFController.updateTracks(); 
            }
            inspector.addNumber("Start", clip.start, {min:0, step:0.01, callback: (v) =>
            {              
                // var dt = v - this.clip_in_panel.start;
                // if(clip.ready) clip.ready += dt;
                // if(clip.strokeStart) clip.strokeStart += dt;
                // if(clip.stroke) clip.stroke += dt;
                // if(clip.attackPeak) clip.attackPeak += dt;
                // if(clip.strokeEnd) clip.strokeEnd += dt;
                // if(clip.relax) clip.relax += dt;
                this.clip_in_panel.start = v;
                clip.start = v;
                updateTracks();
                
                /*this.showClipInfo(clip)*/
            }})
            inspector.addNumber("Duration", clip.duration, {min:0.01, step:0.01, callback: (v) =>
            {
                this.clip_in_panel.duration = v;
                clip.relax = Math.min(v, clip.relax);
                clip.attackPeak = Math.min(v, clip.attackPeak);
                updateTracks();
            }})
            inspector.addSection("Sync points");
            if(clip.attackPeak != undefined)
            {
                inspector.addNumber("Attack Peak", clip.attackPeak, {min:0, max: clip.duration, step:0.01, callback: (v) =>
                    {              
                       clip.attackPeak = v;
                       updateTracks();
                    }})
            }
            if(clip.relax != undefined) 
            {
                inspector.addNumber("Relax", clip.relax, {min: clip.attackPeak, max: clip.duration, step:0.01, callback: (v) =>
                    {              
                       clip.relax = v;
                       clip.attackPeak = Math.min(v, clip.attackPeak);
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
                                this.clip_in_panel.properties[i] = v;
                            }.bind(this, i)});
                            break;
                        case Number:
                            if(i=="amount")
                            {
                                inspector.addNumber(i, property, {min:0, max:1, step:0.01, callback: function(i,v)
                                {
                                    this.clip_in_panel.properties[i] = v;
                                    updateTracks();
                                }.bind(this,i)});
                            }
                        else{
                            inspector.addNumber(i, property, {callback: function(i,v)
                                {
                                    this.clip_in_panel.properties[i] = v;
                                    updateTracks();
                                }.bind(this,i)});
                            }
                            break;
                        case Boolean:
                            inspector.addCheckbox(i, property, {callback: function(i,v)
                            {
                                this.clip_in_panel.properties[i] = v;
                                updateTracks();
                            }.bind(this,i)});
                            break;
                        case Array:
                            inspector.addArray(i, property, {callback: function(i,v)
                            {
                                this.clip_in_panel.properties[i] = v;
                                updateTracks();
                            }.bind(this,i)});
                            break;
                    }
                }
            }
            inspector.addButton(null, "Delete", () => this.NMFtimeline.deleteClip(clip, () => {clip = null; updateTracks()}));
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
    
    appendCombo(menubar, options) {
        options = options || {};
        
        const comboContainer = document.createElement('div');
        comboContainer.id = "mode-selector"
        comboContainer.style.margin = "0 10px";
        comboContainer.style.display = options.hidden? "none" : "flex";
        comboContainer.style.alignItems = "center";
        comboContainer.className = "inspector";
        
        menubar.root.appendChild(comboContainer);
        
        let content = document.createElement('div');
        content.className = "wcontent";
        content.style.width = "auto";
        
        let element = document.createElement("span");
        element.className ='inputcombo';
        
        let combo = "<select name='editor-mode' class=''></select>"
        element.innerHTML = combo;
        let values = '<option value="MF" selected>' + this.editor.eModes.MF + '</option>' + '<option value="NMF" >' + this.editor.eModes.NMF + '</option>' + '<option value="MOUTHING">' + this.editor.eModes.MOUTHING + '</option>'
        let select = element.querySelector("select");
        select.innerHTML = values;
        select.addEventListener("change", (v) => {
            this.editor.mode = this.editor.eModes[select.value];
            if(this.editor.mode == this.editor.eModes.NMF){
                
                if(!this.NMFtimeline) {
                    
                    
                    this.NMFtimeline = new Timeline(null, null, "clips", [this.timeline.size[0], this.timeline.size[1]], false);
                    this.NMFtimeline.name = "Non-Manual Features";
                    this.NMFtimeline.framerate = 30;
                    this.NMFtimeline.setScale(400);
                    this.NMFtimeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.animationClip.duration - 0.001) );
                    this.NMFtimeline.onSetDuration = (t) => {this.timeline.duration = this.timeline.clip.duration = t};
                    this.NMFtimeline.onSelectClip = this.showClipInfo.bind(this);
                    this.NMFtimeline.onClipMoved = ()=> this.editor.NMFController.updateTracks.bind(this.editor.NMFController);
                    this.NMFtimeline.clip = {duration: this.timeline.duration, tracks: []};
                    this.NMFtimeline.addClip( new ANIM.FaceLexemeClip(), this.editor.NMFController.updateTracks.bind(this.editor.NMFController) );
                    this.editor.NMFController.begin(this.NMFtimeline);
                    
                    // this.NMFtimeline.onSelectKeyFrame = (e, info, index) => {
                        //     if(e.button != 2) {
                            //         //this.editor.gizmo.mustUpdate = true
                            //         this.editor.gizmo.update(true);
                            //         return false;
                            //     }
                            
                    //     // Change gizmo mode and dont handle
                    //     // return false;
                    
                    //     this.showKeyFrameOptions(e, info, index);
                    //     return true; // Handled
                    // };
                    // this.timeline.onUpdateTrack = (idx) => this.editor.updateAnimationAction(idx);
                    
                    //this.createSidePanel();
                    // let c = document.getElementById("timelineCanvas")
                    // c.style.height =  this.timelineCTX.canvas.height*2 + 'px';
                    // this.timelineCTX.canvas.height = this.timelineCTX.canvas.clientHeight;
                    //this.timelineCTX.canvas.height = this.timelineCTX.canvas.height*2;
                    
                }

                console.log(this.timeline.size)
                let c = document.getElementById("timeline")
                c.style.height =  this.timelineCTX.canvas.height*2 + 'px';
                let canvas = document.getElementById("timelineNMFCanvas")
                canvas.style.display =  'block';
                console.log(this.timeline.size)
                let canvasArea = document.getElementById("canvasarea");
                this.editor.resize(canvasArea.clientWidth, canvasArea.clientHeight);
            }
            else{
                let c = document.getElementById("timeline")
                c.style.height =  this.timelineCTX.canvas.height + 'px';
                let canvas = document.getElementById("timelineNMFCanvas")
                canvas.style.display =  'none';
            }
          
        });

        content.appendChild(element);
        comboContainer.appendChild(content);
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

    render() {

        this.drawTimeline();
    }

    drawTimeline() {
        
        const canvas = this.timelineCTX.canvas;
        this.current_time = this.editor.mixer.time;

        if(this.current_time > this.duration) {
            this.current_time = 0.0;
            this.editor.onAnimationEnded();
        }

        this.timeline.draw(this.timelineCTX, this.current_time, [0, 0, canvas.width, canvas.height]);
        if(this.NMFtimeline)
        {
            //time in the left side (current time is always in the middle)
            //seconds markers
            this.NMFtimeline.draw(this.timelineNMFCTX, this.current_time, [0, 0, canvas.width, canvas.height+50], false);
            // var w = canvas.width;
            // var seconds_full_window = (w * this.NMFtimeline._pixels_to_seconds); //how many seconds fit in the current window
            // var seconds_half_window = seconds_full_window * 0.5;
	        // var time_start = this.current_time - seconds_half_window;
            // //time in the right side
            // var time_end = this.current_time + seconds_half_window;
            // this.timelineCTX.save();
	        // this.timelineCTX.translate( 0, canvas.height ); //20 is
            // this.NMFtimeline.onDrawContent( this.timelineCTX, time_start, time_end,  this.NMFtimeline );
            // this.timelineCTX.restore();
            
        }
        
    }

    showKeyFrameOptions(e, info, index) {

        let actions = [];

        let track = this.timeline.getTrack(info);

        if(index !== undefined) {
            if(!track)
            return;
    
            e.multipleSelection &= this.timeline.isKeyFrameSelected(track, index);
    
            actions.push(
                {
                    title: (e.multipleSelection ? "Multiple selection" : "[" + index + "] " + track.name),
                    disabled: true
                },
                null,
                {
                    title: "Copy" + " <i class='bi bi-clipboard float-right'></i>",
                    callback: () => this.timeline.copyKeyFrame( track, index )
                },
                {
                    title: "Paste" + (e.multipleSelection ? " (" + this.timeline.getNumKeyFramesSelected() + ")" : "") +  " <i class='bi bi-clipboard-check float-right'></i>",
                    disabled: !this.timeline.canPasteKeyFrame(),
                    callback: () => this.timeline.pasteKeyFrame( e, track, index )
                },
                {
                    title: "Delete" + (e.multipleSelection ? " (" + this.timeline.getNumKeyFramesSelected() + ")" : "") +  " <i class='bi bi-trash float-right'></i>",
                    callback: () => this.timeline.deleteKeyFrame( e, track, index )
                }
            );
        }else {

            // No keyframe selected

            actions.push(
                {
                    title: "Add" + " <i class='bi bi-plus float-right'></i>",
                    callback: () => this.timeline.addKeyFrame( track )
                }
            );
        }
        
        new LiteGUI.ContextMenu( actions, { event: e });
    }

    onMouse(e, nmf = null) {

        e.preventDefault();
        let rect = this.timeline._canvas.getBoundingClientRect();
        if( e.x >= rect.left && e.x <= rect.right && e.y >= rect.top && e.y <= rect.bottom)
        {
            if(e.type == "mousedown" && this.NMFtimeline)
                this.NMFtimeline.selected_clip = null;
            this.timeline.processMouse(e);
            return;
        }
        else if(this.NMFtimeline)
        {
            // if(e.type == "mousedown")
            //     this.timeline.deselectAll();
            this.NMFtimeline.processMouse(e);

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

    drawSkeleton() {

        const ctx = this.skeletonCTX;
        const canvas = ctx.canvas;
        
        let scroll_y = this.skeletonScroll; // pixels scrolled (it can cause to move the whole text to the top)
        let startx = 0; // starting pixel (it can cause to move the whole text to the left)

        let vertical_offset = 15; // top space
        let name_height = 25; // space between names
        let sidebar_width = ctx.width; // width
        let sidebar_height = ctx.height;
        let names = this.names;
        let scrollable_height = names.length * name_height;
        let current_scroll_in_pixels = 0;

        //compute the current y scrollable value
        if (sidebar_height < scrollable_height)
            scroll_y = -current_scroll_in_pixels;
        if (scroll_y) {
            ctx.beginPath();
            ctx.rect(0, vertical_offset, canvas.width, sidebar_height);
            ctx.clip();
        }

        //fill bone lines
        var w = canvas.width;
        ctx.globalAlpha = 0.1;
        for (var i = 0; i < names.length; ++i) {
            ctx.fillStyle = i % 2 == 0 ? "#2D2D2D" : "#2A2A2A";
            ctx.fillRect(0, scroll_y + vertical_offset + i * name_height, w, name_height);
        }

        //draw names of bones from list
        ctx.textAlign = "left";

        //estimated starting distance of timeline in the canvas
        var w = 60; //left space for names start
        var y = scroll_y + 0.5 + vertical_offset;

        if (names)
            for (var i = 0; i < names.length; ++i) {
                var bone = names[i];
                var [name, depth, is_selected, has_childs] = bone;

                //compute horizontal position
                var x = startx > w ? startx : w;
                x = x + (20 * depth);

                //draw an opening triangle
                if (has_childs) {
                    ctx.fillStyle = "#FFF";
                    ctx.beginPath();
                    ctx.moveTo(x - 35, y + name_height * 0.4);
                    ctx.lineTo(x - 25, y + name_height * 0.4);
                    ctx.lineTo(x - 30, y + name_height * 0.7);
                    ctx.fill();
                }

                //name
                ctx.fillStyle = "#AAA";
                ctx.font = '13px sans-serif';
                ctx.fillText(name, x - 20, y + name_height * 0.65);
                ctx.fillStyle = "#123";
                ctx.globalAlpha = 1;

                if (is_selected) {
                    ctx.fillStyle = "white";
                    ctx.globalCompositeOperation = "difference";
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(sidebar_width - 7, y);
                    ctx.lineTo(sidebar_width - 2, y + name_height * 0.5);
                    ctx.lineTo(sidebar_width - 7, y + name_height);
                    ctx.lineTo(0, y + name_height);
                    ctx.closePath();
                    ctx.fill();
                    ctx.globalCompositeOperation = "source-over";
                }

                y += name_height;
            }

        ctx.restore();
    }
};

export { Gui };