import { app } from "./app.js";
import { getTime } from "./utils.js";
import { Timeline } from "./libs/timeline.module.js";
import { w2popup } from "./libs/w2ui.es6.js"

var timeline = null;
var project = null;
var canvas = null;
var ctx = null; 
var pause_rendering = false;
var update_timeline = true;

function load_timeline(_project) {
    canvas = document.getElementById("timeline-canvas");
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx = canvas.getContext("2d");
    project = _project;
    timeline = new Timeline();
    timeline.onDrawContent = onDrawContent;
    timeline.setScale(150.0946352969992);
    timeline.framerate = _project.framerate;

    timeline.draw(ctx, project, timeline.current_time, [0, 0, canvas.clientWidth, canvas.clientHeight]);
    var mouse_control = onMouse.bind(timeline);
    canvas.addEventListener("mouseup", mouse_control);
    canvas.addEventListener("mousedown", mouse_control);
    canvas.addEventListener("mousemove", mouse_control);
    canvas.addEventListener("mousewheel", mouse_control, false);
    canvas.addEventListener("wheel", mouse_control, false);
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); return true; }, false);
    var last_time = getTime();


    //initialize timeline UI
    var element = document.getElementsByClassName("bottom")[0];
    var toolbar = document.createElement("DIV");
    element.appendChild(toolbar);
    toolbar.id = "toolbar";
    $(function () {
        $("#toolbar").w2toolbar({
            name: "toolbar",
            items: [
                { type: "radio", id: "item1", group: "1", title: "Keyframe", icon: "fas fa-edit", checked: true,
                    tooltip: function (item) { return "Keyframe"; } 
                },
                // { type: "radio", id: "item2", group: "1", title: "Curves", icon: "fas fa-wave-square",
                //     tooltip: function (item) { return "Curves"; } 
                // },
                { type: "break" },
                { type: "button", id: "item3", text: "Save Animation", icon: "fas fa-save", }
            ],
            onClick: function (event) {
                console.log("Target: "+ event.target, event);
                switch (event.target) {
                    case "item1":
                        timeline.mode = "keyframes"; 
                        update_timeline = true;
                      break;
                    case "item2":
                        timeline.mode = "curves";
                        update_timeline = true;
                      break;
                    case "item3":
                        w2popup.open({
                            title: 'Store Animation in Database',
                            body: '<div class="w2ui-centered">Have you finished editing your animation? Remember that uploading the animation to the database implies that it will be used in the synthesis of the 3D avatar used in SignON European project.</div>',
                            buttons: '<button class="w2ui-btn" onclick="w2popup.close();">No, I am not done yet.</button> '+
                                '<button class="w2ui-btn" onclick="storeAnimation();">Yes, upload my animation.</button>',
                            width: 500,
                            height: 300,
                            overflow: "hidden",
                            color: "#333",
                            speed: "0.3",
                            opacity: "0.8",
                            modal: true,
                            showClose: true,
                            showMax: true,
                            onOpen(event) { console.log("open"); },
                            onClose(event) { console.log("close"); },
                            onMax(event) { console.log("max"); },
                            onMin(event) { console.log("min"); },
                            onKeydown(event) { console.log("keydown"); }
                        });
                      break;
                    default:
                        console.warn("Item not detected in the toolbar elements.");
                      break;
                  }
            }
        });
        $("#toolbar")[0].style.padding = "1px";
        $("#toolbar")[0].style.left = "8px";
        $("#toolbar")[0].style.width = timeline.sidebar_width.toString() + "px";
    });

    renderFrame();
};

function renderFrame() {

    let state = app.editor.getState();

    if (!pause_rendering) {
        if (project.mixer && state == true) {
            timeline.current_time = project.mixer.time % project.duration;
            timeline.draw(ctx, project, timeline.current_time, [0, 0, canvas.width, canvas.height]);
        }
        else if (update_timeline && state == false) {
            timeline.draw(ctx, project, timeline.current_time, [0, 0, canvas.width, canvas.height]);
            update_timeline = false;
        }
    }

    var window = canvas.ownerDocument.defaultView;
    window.requestAnimationFrame(renderFrame);
};

function onDrawContent(ctx, project, start_time, end_time, timeline) {

    var items = project.bones;
    var track_height = 20;
    var framerate = timeline.framerate;
    var timeline_height = timeline.height || ctx.canvas.clientHeight;
    var scroll_y = 0;
    var canvas = ctx.canvas;
    var vertical_offset = 10;
    var margin = timeline.sidebar_width;
    timeline.scrollable_height = track_height * items.length + vertical_offset + 20; //20 is the displacement from top

    ctx.save();

    //compute the current y scrollable value
    if (timeline_height < timeline.scrollable_height)
        scroll_y = -timeline.current_scroll_in_pixels;
    if (scroll_y) {
        ctx.beginPath();
        ctx.rect(0, vertical_offset, canvas.width, timeline_height);
        ctx.clip();
    }

    //fill bone lines
    var w = canvas.width;
    ctx.globalAlpha = 0.1;
    for (var i = 0; i < items.length; ++i) {
        ctx.fillStyle = i % 2 == 0 ? "#aaa" : "#2A2A2A";
        ctx.fillRect(0, scroll_y + vertical_offset + i * track_height, w, track_height);
    }

    if (timeline.mode == "keyframes") {
        //translucent black bg
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "black";
        ctx.fillRect(margin, vertical_offset, canvas.width, timeline_height);

        //bg vertical line
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#444";
        ctx.beginPath();
        ctx.moveTo(margin + 0.5, 0);
        ctx.lineTo(margin + 0.5, canvas.height);
        ctx.stroke();

        //keyframes
        ctx.save();

        //keyframes
        //var timeline_keyframe_lines = [];
        //var vks = [];
        var times = project.times;

        for (var i = 0; i < times.length; i++) {
            // TO SPEED UP, WE CAN PASS THE ONES THAT WONT BE SEEN IN SCREEN. SAME FOR THE NAMES
            //var track_index = data.first_track + i;
            var bone_times = times[i]; //times for each bone
            if (!bone_times)
                continue;

            var y = scroll_y + vertical_offset + i * track_height;
            var offset_y = y + track_height * 0.5;
            if (offset_y < 0 || offset_y > this._canvas.height)
                continue;

            ctx.fillStyle = "#9AF";
            ctx.globalAlpha = 1;//track.enabled ? 1 : 0.5;

            for (var j = 0; j < bone_times.length; j++) {
                // if(keyframe[0] < data.start_time || keyframe[0] > data.end_time)
                //     continue;
                var time = bone_times[j];
                var posx = timeline.timeToX(time);
                if ((posx - 5) < margin || (posx + 5) > this._canvas.width) //pass the ones out of the view
                    continue;

                // var is_selected = false;
                // if(selection)
                // {
                //     if (selection.type == "keyframe" && selection.track == i && selection.keyframe == j)
                //         is_selected = true;
                //     else if (selection.type == "keyframes" && selection.hashed[ i*10000 + j ] )
                //         is_selected = true;
                // }

                // if(is_selected)
                //     ctx.fillStyle = "#FC6";
                // else
                //     ctx.fillStyle = "#9AF";
                // ctx.strokeStyle = ctx.fillStyle;


                ctx.save();

                //mini line
                // if(track.enabled)
                //timeline_keyframe_lines.push(posx);
                //vks.push([track_index,j,posx,offset_y]);

                //keyframe diamond
                ctx.beginPath();
                ctx.moveTo(posx, offset_y + 4);
                ctx.lineTo(posx + 4, offset_y);
                ctx.lineTo(posx, offset_y - 4);
                ctx.lineTo(posx - 4, offset_y);
                ctx.fill();
                ctx.restore();
            }

            ctx.globalAlpha = 1;
        }

        //timeline keyframe vertical lines ---------- (Maybe we can skip this to gain speed)
        // ctx.globalAlpha = 0.5;
        // ctx.beginPath();
        // timeline_keyframe_lines.sort(); //avoid repeating
        
        // var last = -1;
        // for(var i = 0; i < timeline_keyframe_lines.length; ++i)
        // {
        //     var posx = timeline_keyframe_lines[i];
        //     if(posx == last)
        //         continue;
        //     ctx.moveTo( posx + 0.5, 14);
        //     ctx.lineTo( posx + 0.5, timeline_height);
        //     last = posx;
        // }
        
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
    }
    else // timeline.mode == "curves"
    {
        //translucent black bg
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = "black";
        ctx.fillRect(margin, vertical_offset, canvas.width, timeline_height);

        //bg vertical line
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#444";
        ctx.beginPath();
        ctx.moveTo(margin + 0.5, 0);
        ctx.lineTo(margin + 0.5, canvas.height);
        ctx.stroke();

        //curves

    }

    //draw names of bones from list
    ctx.textAlign = "left";

    //estimated starting distance of timeline in the canvas
    start_time = Math.floor(start_time * framerate) / framerate;
    var startx = Math.floor(timeline.timeToX(start_time)) + 0.5;
    var w = 60; //left space for names start
    var y = scroll_y + 0.5 + vertical_offset;

    if (project.names)
        for (var i = 0; i < project.names.length; ++i) {
            var bone = project.names[i];
            var [name, depth, is_selected, has_childs] = bone;

            //compute horizontal position
            var x = startx > w ? startx : w;
            x = x + (15 * depth);

            //draw an opening triangle
            if (has_childs) {
                ctx.fillStyle = "#FFF";
                ctx.beginPath();
                ctx.moveTo(x - 35, y + track_height * 0.4);
                ctx.lineTo(x - 25, y + track_height * 0.4);
                ctx.lineTo(x - 30, y + track_height * 0.7);
                ctx.fill();
            }

            //name
            ctx.fillStyle = "#AAA";
            ctx.fillText(name, x - 20, y + track_height * 0.7);
            ctx.fillStyle = "#123";
            ctx.globalAlpha = 1;

            if (is_selected) {
                ctx.fillStyle = "white";
                ctx.globalCompositeOperation = "difference";
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(timeline.sidebar_width - 7, y);
                ctx.lineTo(timeline.sidebar_width - 2, y + track_height * 0.5);
                ctx.lineTo(timeline.sidebar_width - 7, y + track_height);
                ctx.lineTo(0, y + track_height);
                ctx.closePath();
                ctx.fill();
                ctx.globalCompositeOperation = "source-over";
            }

            y += track_height;
        }

    ctx.restore();
};

function onMouse(e) {

    if (e.type == "mouseup") {
        var track_height = 20;
        //get the selected item
        if (e.offsetX < 200)  //only if we are clicking on the items zone
        {
            var y = e.offsetY + this.current_scroll_in_pixels - 10 - track_height - this.position[1];
            for (var i in project.bones) {
                var item = project.bones[i];
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
};

export { load_timeline };