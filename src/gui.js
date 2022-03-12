import { TransformControls } from "./controls/TransformControls.js";
import { Timeline } from "./libs/timeline.module.js";
import { firstToUpperCase } from "./utils.js";

class Gui {

    constructor(editor) {
       
        this.showTimeline = true;
        this.showVideo = true;
        this.current_time = 0;
        this.skeletonScroll = 0;
        this.editor = editor;

        this.create();
    }

    loadProject(project) {

        this.project = project;
        this.names = project.names;
        this.duration = project.duration;

        let boneName = null;
        if(this.editor.skeletonHelper.bones.length) {
            boneName = this.editor.skeletonHelper.bones[0].name;
        }

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

        // Move this to another place
        // the idea is to create once and reset on load project
        // const name = project.clipName.length ? project.clipName : null;
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
        timelineCanvas.height = 100;
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

        menubar.add("Project/Upload animation", { callback: () => this.editor.getApp().storeAnimation() });
        menubar.add("Project/Export BVH", { callback: () => this.editor.export() });
        menubar.add("View/Video", { type: "checkbox", instance: this, property: "showVideo", callback: () => {
            const tl = document.getElementById("capture");
            tl.style.display = that.showVideo ? "flex": "none";
        }});
        menubar.add("View/Timeline", { type: "checkbox", instance: this, property: "showTimeline", callback: () => {
            const tl = document.getElementById("timeline");
            tl.style.display = that.showTimeline ? "block": "none";
        }});

        this.appendButtons( menubar );
    }

    createSidePanel( anim_name ) {

        this.mainArea.split("horizontal", [null,"300px"], true);
        var docked = new LiteGUI.Panel("sidePanel", {title: anim_name || 'Inspector', scroll: true});
        this.mainArea.getSection(1).add( docked );
        $(docked).bind("closed", function() { this.mainArea.merge(); });
        this.sidePanel = docked;
        this.updateSidePanel( docked, 'root', {firstBone: true} );
        
        docked.content.id = "main-inspector-content";
        docked.content.style.width = "100%";

        this.resize();
    }

    updateSidePanel(root, item_selected, options) {

        item_selected = item_selected || this.item_selected;
    
        options = options || {};
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
    
            const bone = this.editor.skeletonHelper.skeleton.getBoneByName(bone_id);
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
    
        const makePretitle = (src) => { return "<img src='data/imgs/mini-icon-"+src+".png' style='margin-right: 4px;margin-top: 6px;'>"; }

        widgets.on_refresh = () => {

            const numBones = this.editor.skeletonHelper.bones.length;

            widgets.clear();
            widgets.addSection("Animation Clip", { pretitle: makePretitle('stickman') });
            widgets.addString("Name", this.project.clipName || "Unnamed", { callback: (v) => this.project.clipName = v });
            widgets.addInfo("Num bones", numBones);
            widgets.addInfo("Frame rate", this.project.framerate);
            widgets.addInfo("Duration", this.project.duration);
            widgets.widgets_per_row = 1;
            widgets.addSection("Gizmo", { pretitle: makePretitle('gizmo'), settings: (e) => this.openSettings( 'gizmo' ), settings_title: "<i class='bi bi-gear-fill section-settings'></i>" });
            widgets.addButtons( "Mode", ["Translate","Rotate"], { selected: this.editor.getGizmoMode(), name_width: "50%", width: "100%", callback: (v) => {
                this.editor.setGizmoMode(v);
                widgets.on_refresh();
            }});

            widgets.addButtons( "Space", ["Local","World"], { selected: this.editor.getGizmoSpace(), name_width: "50%", width: "100%", callback: (v) => {
                this.editor.setGizmoSpace(v);
                widgets.on_refresh();
            }});

            widgets.addCheckbox( "Snap", this.editor.isGizmoSnapActive(), {callback: () => this.editor.toggleGizmoSnap() } );

            widgets.addSeparator();

            const bone_selected = !(options.firstBone && numBones) ? 
                this.editor.skeletonHelper.skeleton.getBoneByName(item_selected) : 
                this.editor.skeletonHelper.bones[0];

            if(bone_selected) {

                const innerUpdate = (attribute, value) => {
                    bone_selected[attribute].fromArray( value ); 
                    this.editor.gizmo.updateBones();
                };

                widgets.addSection("Bone", { pretitle: makePretitle('circle') });
                widgets.addInfo("Name", bone_selected.name);
                widgets.addTitle("Position");
                widgets.addVector3(null, bone_selected.position.toArray(), {callback: (v) => innerUpdate("position", v)});

                widgets.addTitle("Rotation (XYZ)");
                widgets.addVector3(null, bone_selected.rotation.toArray(), {callback: (v) => innerUpdate("rotation", v)});

                widgets.addTitle("Quaternion");
                widgets.addVector4(null, bone_selected.quaternion.toArray(), {callback: (v) => innerUpdate("quaternion", v)});
            }
        };

        widgets.on_refresh();

        // update scroll position
        var element = root.content.querySelectorAll(".inspector")[0];
        var maxScroll = element.scrollHeight;
        element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
    }

    openSettings( settings ) {

        let prevDialog = document.getElementById("settings-dialog");
        if(prevDialog) prevDialog.remove();

        const dialog = new LiteGUI.Dialog({ id: 'settings-dialog', title: firstToUpperCase(settings), close: true, width: 380, height: 128, scroll: false, draggable: true});
		dialog.show();

        const inspector = new LiteGUI.Inspector();

        switch( settings ) {
            case 'gizmo': 

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
    }

    render() {

        this.drawTimeline();
    }

    drawTimeline() {
        
        if(!this.project)
        return;

        const canvas = this.timelineCTX.canvas;
        this.current_time = this.timeline.current_time = this.project.mixer.time % this.duration;
        this.timeline.draw(this.timelineCTX, this.project, this.current_time, [0, 0, canvas.width, canvas.height]);
    }

    showKeyFrameOptions(e, info, index) {

        let track = this.timeline.getTrack(info, index);
        if(!track)
        return;

        e.multipleSelection &= this.timeline.isKeyFrameSelected(track, index);

        var actions = [
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
                title: "Delete" +  " <i class='bi bi-trash float-right'></i>",
                callback: () => console.log("TODO: Delete")
            }
        ];
        
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
            scroll_y = -current_scroll_in_pixels; //TODO
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