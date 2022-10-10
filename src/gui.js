import { Timeline } from "./libs/timeline.module.js";
import { UTILS } from "./utils.js";

class Gui {

    constructor(editor) {
       
        this.showTimeline = true;
        this.showVideo = true;
        this.current_time = 0;
        this.skeletonScroll = 0;
        this.editor = editor;

        // Move this to another place
        // the idea is to create once and reset on load project
        // const name = project.clipName.length ? project.clipName : null;
        //if(this.editor.skeletonHelper)
        this.boneProperties = {};

        this.create();
    }

    loadSkeletonProject(project) {

        this.project = project;
        this.names = project.names;
        this.duration = project.duration;

        let boneName = "";
        if(this.editor.skeletonHelper && this.editor.skeletonHelper.bones.length) {
            boneName = this.editor.skeletonHelper.bones[0].name;
        }

        if(this.editor.animationClip) {

            this.timeline = new Timeline( this.editor.animationClip, boneName);
            this.timeline.framerate = project.framerate;
            this.timeline.setScale(400);
            this.timeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.animationClip.duration - 0.001) );
            this.timeline.onSelectKeyFrame = (e, info, index) => {
                if(e.button != 2)
                return false;

                // Change gizmo mode and dont handle
                // return false;

                this.showKeyFrameOptions(e, info, index);
                return true; // Handled
            };
            this.timeline.onBoneUnselected = () => this.editor.gizmo.stop();
            this.timeline.onUpdateTrack = (track) => this.editor.updateAnimationAction(track);
            this.timeline.onGetSelectedBone = () => { return this.editor.getSelectedBone(); };
        }

        // Move this to another place
        // the idea is to create once and reset on load project
        // const name = project.clipName.length ? project.clipName : null;
        if(this.editor.skeletonHelper)
            this.createSidePanel();

        let canvasArea = document.getElementById("canvasarea");
        this.editor.resize(canvasArea.clientWidth, canvasArea.clientHeight);

        this.render();
    }

    loadBlendshapesClip(clip) {

        this.clip = clip;
        this.duration = clip.duration;
        
        let morphName = 'Blink_Left';
        if(this.editor.morphTargetDictionary) {
            morphName = Object.keys(this.editor.morphTargetDictionary)[0];
        }

        this.timeline = new Timeline( this.editor.animationClip, morphName, "morphTargets");
        this.timeline.framerate = 30;
        this.timeline.setScale(400);
        this.timeline.onSetTime = (t) => this.editor.setTime( Math.clamp(t, 0, this.editor.animationClip.duration - 0.001) );
        this.timeline.onSelectKeyFrame = (e, info, index) => {
            if(e.button != 2)
                return false;

            // Change gizmo mode and dont handle
            // return false;

            this.showKeyFrameOptions(e, info, index);
            return true; // Handled
        };
        //this.timeline.onBoneUnselected = () => this.editor.gizmo.stop();
        this.timeline.onUpdateTrack = (idx) => this.editor.updateAnimationAction(idx);
        this.timeline.onGetSelectedMorphTarget = () => { return this.editor.getSelectedBone(); };

        // this.timeline.onGetSelectedBone = () => { return this.editor.getSelectedBone(); };
        // this.timeline.onGetOptimizeThreshold = () => { return this.editor.optimizeThreshold; }

        this.createSidePanel();

        let canvasArea = document.getElementById("canvasarea");
        this.editor.resize(canvasArea.clientWidth, canvasArea.clientHeight);

        this.render();
        
    }

    loadSkeletonClip( clip ) {

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
        this.timeline.onSelectKeyFrame = (e, info, index) => {
            if(e.button != 2) {
                this.editor.gizmo.mustUpdate = true
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

        this.createSidePanel();

        let canvasArea = document.getElementById("canvasarea");
        this.editor.resize(canvasArea.clientWidth, canvasArea.clientHeight);

        this.render();
    }
    create() {

        LiteGUI.init(); 
	
        // Create menu bar
        this.createMenubar();

        // Create main area
        this.mainArea = new LiteGUI.Area({id: "mainarea", content_id:"canvasarea", height: "calc( 100% - 31px )", main: true});
        LiteGUI.add( this.mainArea );
        
        const canvasArea = document.getElementById("canvasarea");
        canvasarea.appendChild( document.getElementById("timeline") );

        this.mainArea.onresize = window.onresize;

        let timelineCanvas = document.getElementById("timelineCanvas");
        timelineCanvas.width = canvasArea.clientWidth;
        timelineCanvas.height = 115;
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

        menubar.add("Project/Upload animation", {icon: "<i class='bi bi-upload float-right'></i>", callback: () => this.editor.getApp().storeAnimation() });
        menubar.add("Project/Show video", { type: "checkbox", instance: this, property: "showVideo", callback: () => {
            const tl = document.getElementById("capture");
            tl.style.display = that.showVideo ? "flex": "none";
        }});
        menubar.add("Project/");
        menubar.add("Project/BVH", {subtitle: true});
        menubar.add("Project/Export", {icon: "<i class='bi bi-file-text float-right'></i>",  callback: () => this.editor.export() });
        menubar.add("Project/Open preview", {icon: "<i class='bi bi-file-earmark-play float-right'></i>",  callback: () => this.editor.showPreview() });

        menubar.add("Timeline/Show", { type: "checkbox", instance: this, property: "showTimeline", callback: () => {
            const tl = document.getElementById("timeline");
            tl.style.display = that.showTimeline ? "block": "none";
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

        this.appendButtons( menubar );
    }

    createSidePanel() {

        this.mainArea.split("horizontal", [null,"300px"], true);
        var docked = new LiteGUI.Panel("sidePanel", {title: 'Skeleton', scroll: true});
        this.mainArea.getSection(1).add( docked );
        $(docked).bind("closed", function() { this.mainArea.merge(); });
        this.sidePanel = docked;
        this.updateSidePanel( docked, 'root', {firstBone: true, id : 'Blink_Left'} );
        
        docked.content.id = "main-inspector-content";
        docked.content.style.width = "100%";

        this.resize();
    }

    updateSidePanel(root, item_selected, options) {

        if(!this.sidePanel)
            return;

        options = options || {};
        item_selected = item_selected || this.item_selected;
        this.item_selected = item_selected;
        root = root || this.sidePanel;
        $(root.content).empty();
        
        var mytree = this.updateMTNodeTree(); //this.updateNodeTree();
    
        var litetree = new LiteGUI.Tree(mytree, {id: "tree", selected: "Blink_left"});
        litetree.setSelectedItem(item_selected);
        var that = this;
        
        //  // Click right mouse
        //  litetree.onItemContextMenu = (e, el) => { 
    
        //     e.preventDefault();
        //     var bone_id = el.data.id;
    
        //     const bone = this.editor.skeletonHelper.getBoneByName(bone_id);
        //     if(!bone)
        //     return;
    
        //     const boneEnabled = true;
        //     var actions = [
        //         {
        //             title: (boneEnabled?"Disable":"Enable") + "<i class='bi bi-" + (boneEnabled?"dash":"check") + "-circle float-right'></i>",
        //             disabled: true,
        //             callback: () => console.log("TODO: Disable")
        //         },
        //         {
        //             title: "Copy" + "<i class='bi bi-clipboard float-right'></i>",
        //             callback: () => LiteGUI.toClipboard( bone )
        //         }
        //     ];
            
        //     new LiteGUI.ContextMenu( actions, { event: e });
        // };
    
        litetree.onItemSelected = function(data){
            if(data.children)
                return;
            this.expandItem(data.id);
            item_selected = data.id;
            widgets.on_refresh({id: data.id});

            if(!that.editor)
            throw("No editor attached");

            //that.editor.setSelectedBone( data.id );
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

        widgets.on_refresh = (o) => {
            widgets.clear();
            o = o || {};
            if(o.id)
            {
                let idx = this.editor.morphTargetDictionary[o.id];
                widgets.addSlider(o.id, this.editor.bodyBS.morphTargetInfluences[o.id], {className: 'morph-value', callback : function(v){
                    this.editor.bodyBS.morphTargetInfluences[idx] = v;
                    this.editor.eyelashesBS.morphTargetInfluences[idx] = v;
                    this.editor.updateTracks(o.id, true);
                }.bind(this)})
            }
            
        }
        widgets.refresh(options);
    }

    // updateSidePanel(root, item_selected, options) {

    //     if(!this.sidePanel)
    //     return;

    //     item_selected = item_selected || this.item_selected;
    
    //     options = options || {};
    //     this.boneProperties = {};
    //     this.item_selected = item_selected;
    //     root = root || this.sidePanel;
    //     $(root.content).empty();
        
    //     var mytree = this.updateNodeTree();
    
    //     var litetree = new LiteGUI.Tree(mytree, {id: "tree"});
    //     litetree.setSelectedItem(item_selected);
    //     var that = this;
    
    //     // Click right mouse
    //     litetree.onItemContextMenu = (e, el) => { 
    
    //         e.preventDefault();
    //         var bone_id = el.data.id;
    
    //         const bone = this.editor.skeletonHelper.getBoneByName(bone_id);
    //         if(!bone)
    //         return;
    
    //         const boneEnabled = true;

    //         var actions = [
    //             {
    //                 title: (boneEnabled?"Disable":"Enable") + "<i class='bi bi-" + (boneEnabled?"dash":"check") + "-circle float-right'></i>",
    //                 disabled: true,
    //                 callback: () => console.log("TODO: Disable")
    //             },
    //             {
    //                 title: "Copy" + "<i class='bi bi-clipboard float-right'></i>",
    //                 callback: () => LiteGUI.toClipboard( bone )
    //             }
    //         ];
            
    //         new LiteGUI.ContextMenu( actions, { event: e });
    //     };
    
    //     litetree.onItemSelected = function(data){
    //         this.expandItem(data.id);
    //         item_selected = data.id;
    //         widgets.on_refresh();

    //         if(!that.editor)
    //         throw("No editor attached");

    //         that.editor.setSelectedBone( data.id );
    //         that.timeline.setSelectedBone( data.id );
    //     };
    
    //     litetree.root.addEventListener("item_dblclicked", function(e){
    //         e.preventDefault();
    //     });
    
    //     this.tree = litetree;
    
    //     $(root.content).append( litetree.root );
    
    //     // Editor widgets 
    //     var widgets = new LiteGUI.Inspector();
    //     $(root.content).append(widgets.root);
    
    //     const makePretitle = (src) => { return "<img src='data/imgs/mini-icon-"+src+".png' style='margin-right: 4px;margin-top: 6px;'>"; }

    //     widgets.on_refresh = (o) => {

    //         o = o || {};
    //         const numBones = this.editor.skeletonHelper.bones.length;

    //         widgets.clear();
    //         widgets.addSection("Animation Clip", { pretitle: makePretitle('stickman') });
    //         widgets.addString("Name", this.clip.name || "Unnamed", { callback: v => this.clip.name = v });
    //         widgets.addInfo("Num bones", numBones);
    //         widgets.addInfo("Frame rate", this.timeline.framerate);
    //         widgets.addInfo("Duration", this.duration.toFixed(2));
    //         widgets.addSlider("Speed", this.editor.mixer.timeScale, { callback: v => {
    //             this.editor.mixer.timeScale = this.editor.video.playbackRate = v;
    //         }, min: 0.25, max: 1.5, step: 0.05, precision: 2});
    //         widgets.addSeparator();
    //         widgets.addSlider("Optimize Threshold", this.editor.optimizeThreshold, { callback: v => {
    //             this.editor.optimizeThreshold = v;
    //         }, min: 0, max: 0.25, step: 0.001, precision: 4});
    //         widgets.widgets_per_row = 1;

    //         const bone_selected = !(o.firstBone && numBones) ? 
    //             this.editor.skeletonHelper.getBoneByName(item_selected) : 
    //             this.editor.skeletonHelper.bones[0];

    //         if(bone_selected) {

    //             const numTracks = this.timeline.getNumTracks(bone_selected);
    //             const _Modes = numTracks > 1 ? ["Translate","Rotate"] : ["Rotate"];

    //             widgets.addSection("Gizmo", { pretitle: makePretitle('gizmo'), settings: (e) => this.openSettings( 'gizmo' ), settings_title: "<i class='bi bi-gear-fill section-settings'></i>" });
    //             widgets.addButtons( "Mode", _Modes, { selected: this.editor.getGizmoMode(), name_width: "50%", width: "100%", callback: (v) => {
    //                 if(this.editor.getGizmoMode() != v) this.editor.setGizmoMode(v);
    //             }});

    //             widgets.addButtons( "Space", ["Local","World"], { selected: this.editor.getGizmoSpace(), name_width: "50%", width: "100%", callback: (v) => {
    //                 if(this.editor.getGizmoSpace() != v) this.editor.setGizmoSpace(v);
    //             }});

    //             widgets.addCheckbox( "Snap", this.editor.isGizmoSnapActive(), {callback: () => this.editor.toggleGizmoSnap() } );

    //             widgets.addSeparator();

    //             const innerUpdate = (attribute, value) => {
    //                 bone_selected[attribute].fromArray( value ); 
    //                 this.editor.gizmo.onGUI();
    //             };

    //             widgets.addSection("Bone", { pretitle: makePretitle('circle') });
    //             widgets.addInfo("Name", bone_selected.name);
    //             widgets.addInfo("Num tracks", numTracks ?? 0);

    //             // Only edit position for root bone
    //             if(bone_selected.children.length && bone_selected.parent.constructor !== bone_selected.children[0].constructor) {
    //                 widgets.addTitle("Position");
    //                 this.boneProperties['position'] = widgets.addVector3(null, bone_selected.position.toArray(), {disabled: this.editor.state, precision: 3, className: 'bone-position', callback: (v) => innerUpdate("position", v)});
    //             }

    //             widgets.addTitle("Rotation (XYZ)");
    //             this.boneProperties['rotation'] = widgets.addVector3(null, bone_selected.rotation.toArray(), {disabled: this.editor.state, precision: 3, className: 'bone-euler', callback: (v) => innerUpdate("rotation", v)});

    //             widgets.addTitle("Quaternion");
    //             this.boneProperties['quaternion'] = widgets.addVector4(null, bone_selected.quaternion.toArray(), {disabled: this.editor.state, precision: 3, className: 'bone-quaternion', callback: (v) => innerUpdate("quaternion", v)});
    //         }
    //     };

    //     widgets.on_refresh(options);

    //     // update scroll position
    //     var element = root.content.querySelectorAll(".inspector")[0];
    //     var maxScroll = element.scrollHeight;
    //     element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
    // }

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

    updateMTNodeTree() {
               
        let names = Object.keys(this.editor.morphTargetDictionary);
        
        let children = [ {id: names[0], selected: "true"}, {id: names[1]}, {id: names[13]}, {id: names[14]} ];
        var eyelids = { id: "Eyelids", children: children};

        children = [];
        for(let i = 2; i < 10; i++) children.push({id: names[i]});
        var eyebrows = { id: "Eyebrows", children: children};
        
        children = [ {id: names[39]}, {id: names[40]}];
        var nose = { id: "Nose", children: children};

        children = [ {id: names[10]}, {id: names[11]}];
        var cheecks = { id: "Cheeks", children: children};
        
        children = [ {id: names[45]}];
        var tongue = { id: "Tongue", children: children};

        children = [];
        for(let i = 26; i < 39; i++) children.push({id: names[i]});
        for(let i = 41; i < 50; i++) children.push({id: names[i]});
        var mouth = { id: "Mouth", children: children};

        children = [];
        for(let i = 16; i < 26; i++) children.push({id: names[i]});
        var jaw = { id: "Jaw", children: children};        

        //tree
        var mytree = { id: "Morph Targets", 
        children: [ eyelids, eyebrows, nose, cheecks, tongue, mouth, jaw]};

        return mytree;
    }
    
    updateNodeTree() {
        
        const rootBone = this.editor.skeletonHelper.bones[0];

        let mytree = { 'id': rootBone.name };
        let children = [];

        const addChildren = (bone, array) => {

            for( let b of bone.children ) {

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
            {
                id: "capture_btn",
                text: "Capture" + " <i class='bi bi-record2'></i>"
            },
            {
                id: "trim_btn",
                text: "Convert data to 3D animation",
                display: "none"
            }
        ];

        for(let b of buttons) {
            const button = document.createElement("button");
            button.id = b.id;
            button.style.display = b.display || "block";
            button.innerHTML = b.text;
            button.classList.add( "litebutton", "menuButton" );
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
        
        if(!this.editor.mixer)
            return;

        const canvas = this.timelineCTX.canvas;
        this.current_time = this.editor.mixer.time;

        if(this.current_time > this.duration) {
            this.current_time = 0.0;
            this.editor.onAnimationEnded();
        }

        this.timeline.draw(this.timelineCTX, this.current_time, [0, 0, canvas.width, canvas.height]);
    }

    onAnimationEnded() {
        this.current_time = 0.0;
        this.editor.setTime(0.0, true);
        const canvas = this.timelineCTX.canvas;
        this.current_time = this.editor.mixer.time;

        if(this.current_time > this.duration) {
            this.current_time = 0.0;
            this.editor.onAnimationEnded();
        }

        this.timeline.draw(this.timelineCTX, this.current_time, [0, 0, canvas.width, canvas.height]);
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

    onMouse(e) {

        e.preventDefault();
        this.timeline.processMouse(e);
    }

    resize() {
        for(let s of LiteGUI.SliderList) {
            // Resize canvas
            s.root.width = s.root.parentElement.offsetWidth + 35;
            s.setValue(null);
        }

        const canvasArea = document.getElementById("canvasarea");
        let timelineCanvas = document.getElementById("timelineCanvas");
        timelineCanvas.width = canvasArea.clientWidth;
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