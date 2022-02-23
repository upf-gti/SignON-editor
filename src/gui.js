import { ObjectLoader } from "./libs/three.module.js";
import { Timeline } from "./libs/timeline.module.js";

class Gui {

    constructor() {
        // Get the canvas for each GUI element
        // this.skeletonCTX = document.getElementById("skeleton").getContext("2d");
        // this.settingsCTX = document.getElementById("settings").getContext("2d");

        // let mouse_control = this.onMouse.bind(this.timeline);
        // let canvas = this.timelineCTX.canvas;
        // canvas.addEventListener("mouseup", mouse_control);
        // canvas.addEventListener("mousedown", mouse_control);
        // canvas.addEventListener("mousemove", mouse_control);
        // canvas.addEventListener("mousewheel", mouse_control, false);
        // canvas.addEventListener("wheel", mouse_control, false);
        // canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); return true; }, false);

        // ...
        this.current_time = 0;
        this.skeletonScroll = 0;

        this.create();
    }

    loadProject(project) {

        this.project = project;
        this.names = project.names;
        this.duration = project.duration;

        this.timeline = new Timeline();
        this.timeline.setScale(150.0946352969992);
        this.timeline.framerate = project.framerate;

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

        // this.mainArea.onresize = resize;

        let timelineCanvas = document.getElementById("timelineCanvas");
        timelineCanvas.width = canvasArea.clientWidth;
        timelineCanvas.height = 100;
        this.timelineCTX = timelineCanvas.getContext("2d");
    }

    createMenubar() {
        var menubar = new LiteGUI.Menubar("mainmenubar");
        LiteGUI.add( menubar );

        window.menubar = menubar;

        const logo = document.createElement("img");
        logo.id = "signOn-logo"
        logo.src = "img/logo_SignON.png";
        logo.alt = "SignON"
        logo.addEventListener('click', () => window.open('https://signon-project.eu/'));
        menubar.root.prepend(logo);

        menubar.add("Project/Any option", { callback: () => console.log() });
        menubar.add("View/Any option", { callback: () => console.log() });

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
                text: "►",
                display: "none"
            },
            {
                id: "capture_btn",
                text: "Capture"
            },
            {
                id: "upload_btn",
                text: "Upload animation",
                display: "none",
                styles: { position: "absolute", right: "20px", marginTop: "5px !important"}
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

        // this.drawSkeleton();
        // this.drawSettings();
        this.drawTimeline();
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

    drawSettings() {

    }

    drawTimeline() {
        
        const canvas = this.timelineCTX.canvas;
        this.current_time = this.timeline.current_time = this.project.mixer.time % this.duration;
        this.timeline.draw(this.timelineCTX, this.project, this.current_time, [0, 0, canvas.width, canvas.height]);
    }

    onMouse(e) {

        if (e.type == "mouseup") {
            let track_height = 20;
            //get the selected item
            if (e.offsetX < 200)  //only if we are clicking on the items zone
            {
                let y = e.offsetY + this.current_scroll_in_pixels - 10 - track_height - this.position[1];
                for (let i in project.bones) {
                    let item = project.bones[i];
                    y = y - track_height; //if( item.visible ) y = y - track_height;
                    if (y <= 0 && y > -track_height)
                        item.selected = item.selected ? false : true;
                    else
                        item.selected = false;
                }
                project.names = project.bones.map(v => [v.name, v.depth, v.selected, v.childs]);
            }
            update_timeline = true;
        }
        if (this._grabbing_scroll || this._grabbing || e.type == "wheel") update_timeline = true;
    
        this.processMouse(e);
    }

};

export { Gui };