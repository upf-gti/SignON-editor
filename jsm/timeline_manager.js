import { state } from './3Dview.js';
import { getTime } from './utils.js';
import { Timeline } from './build/timeline.module.js';

var timeline = null;
var project = null;
var pause_rendering = false;
var canvas = document.getElementById("timeline-canvas");
var w = canvas.width = canvas.clientWidth;
var h = canvas.height = canvas.clientHeight;
var ctx = canvas.getContext('2d');

function load_timeline( _project ) {
    project = _project;
    timeline = new Timeline();
    timeline.onDrawContent = onDrawContent;
    timeline.setScale(150.0946352969992);
    timeline.framerate = Math.floor(_project.max_keyframes / _project.duration);
    
    timeline.draw( ctx, project, timeline.current_time,  [0, 0, canvas.width, canvas.height] );
    var mouse_control = onMouse.bind( timeline );
    canvas.addEventListener("mouseup", mouse_control);
    canvas.addEventListener("mousedown", mouse_control);
    canvas.addEventListener("mousemove", mouse_control);
    canvas.addEventListener("mousewheel", mouse_control, false);
    canvas.addEventListener("wheel", mouse_control, false);
    canvas.addEventListener("contextmenu", function(e){ e.preventDefault(); return true; }, false);
    var last_time = getTime();
    
    renderFrame();
};

function renderFrame() {
    if (!pause_rendering) {
        if (project.mixer && state == true) 
            timeline.current_time = project.mixer.time % project.duration;
        timeline.draw( ctx, project, timeline.current_time, [0, 0, canvas.width, canvas.height] );
    }

    var window = canvas.ownerDocument.defaultView;
    window.requestAnimationFrame( renderFrame );
};

function onDrawContent( ctx, project, start_time, end_time, timeline ) {
    
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
    if( timeline_height < timeline.scrollable_height )
        scroll_y = -timeline.current_scroll_in_pixels;
    if( scroll_y )
    {
        ctx.beginPath();
        ctx.rect(0, vertical_offset, canvas.width, timeline_height);
        ctx.clip();
    }

    //fill bone lines
    var w = canvas.width;
    ctx.globalAlpha = 0.1;
    for(var i = 0; i < items.length; ++i)
    {
        ctx.fillStyle = i % 2 == 0 ? "#aaa" : "#2A2A2A";
        ctx.fillRect( 0, scroll_y + vertical_offset + i * track_height, w, track_height );
    }

    //icons on top
    //TODO

    if( timeline.mode == "keyframes" )
    {
        //translucent black bg
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "black";
        ctx.fillRect( margin, vertical_offset, canvas.width, timeline_height );
        
        //bg vertical line
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#444";
        ctx.beginPath();
        ctx.moveTo( margin + 0.5, 0);
        ctx.lineTo( margin + 0.5, canvas.height);
        ctx.stroke();












        //keyframes
        ctx.save();
    
        //keyframes
        var timeline_keyframe_lines = [];
        var vks = [];
        var keyframe_width = 10;
    
        for(var i = 0; i < items.length; i++)
        {
            // TO SPEED UP, WE CAN PASS THE ONES THAT WONT BE SEEN IN SCREEN. SAME FOR THE NAMES
            //var track_index = data.first_track + i;
            var bone = items[i];
            if(!bone.positions) //it has no keyframes
                continue;
    
            var y = scroll_y + vertical_offset + i * track_height;
            ctx.fillStyle = "#9AF";
            ctx.globalAlpha = 1;//track.enabled ? 1 : 0.5;
    
            for(var j = 0; j < bone.positions.length-3; j=j+3)
            {
                var keyframe = [bone.positions[j], bone.positions[j+1], bone.positions[j+2]]; //x,y,z
                // if(keyframe[0] < data.start_time || keyframe[0] > data.end_time)
                //     continue;
                var time = bone.times[j/3];
                var posx = timeline.timeToX( time );
                var offset_y = y + track_height * 0.5;
    
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
    
                //diamonds
                if( (posx - 5) < margin)
                    continue;

                ctx.save();

                //mini line
                // if(track.enabled)
                timeline_keyframe_lines.push( posx );

                //vks.push([track_index,j,posx,offset_y]);

                //keyframe
                ctx.beginPath();
                ctx.moveTo(posx, offset_y + 5);
                ctx.lineTo(posx + 5, offset_y);
                ctx.lineTo(posx, offset_y - 5);
                ctx.lineTo(posx - 5, offset_y);
                ctx.fill();
                ctx.restore();
            }
    
            ctx.globalAlpha = 1;
        }
    
        //timeline keyframe vertical lines
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
        //render inner background
        var y = scroll_y + vertical_offset;
        ctx.save();
        ctx.fillStyle = "#232323";
        ctx.fillRect(0, y, ctx.canvas.width - 10, y + timeline.scrollable_height)
        ctx.restore(); 

        // if( startx < w )
        // {
        //     ctx.fillStyle = "black";
        //     ctx.globalAlpha = 0.75;
        //     ctx.fillRect(0, 0, w, timeline.size[1]);
        //     ctx.globalAlpha = 1;
        // }
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, timeline.sidebar_width, timeline.size[1]);
        ctx.stroke();

        //TODO curves
    }

    //draw names of bones from list
    ctx.textAlign = "left";

    //estimated starting distance of timeline in the canvas
    start_time = Math.floor( start_time * framerate) / framerate;
    var startx = Math.floor( timeline.timeToX( start_time ) ) + 0.5;
    var w = 60; //left space for names start
    var y = scroll_y + 0.5 + vertical_offset;
    
    if( items )
        for(var i = 0; i < items.length; ++i)
        {
            var item = items[i];
            var is_selected = item.selected;
            
            //compute horizontal position
            var x = startx > w ? startx : w;
            x = x + (15 * item.depth);

            //draw an opening triangle
            if ( item.childs ) {
                ctx.fillStyle = "#FFF";
                ctx.beginPath();
                ctx.moveTo(x - 35, y + track_height * 0.4);
                ctx.lineTo(x - 25, y + track_height * 0.4);
                ctx.lineTo(x - 30, y + track_height * 0.7);
                ctx.fill();
            }

            //name
            ctx.fillStyle = "#AAA";
            ctx.fillText( item.name, x - 20, y + track_height * 0.7);
            ctx.fillStyle = "#123";
            ctx.globalAlpha = 1;

            if( is_selected )
            {
                ctx.fillStyle = "white";
                ctx.globalCompositeOperation = "difference";
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(timeline.sidebar_width-7, y);
                ctx.lineTo(timeline.sidebar_width-2, y + track_height * 0.5);
                ctx.lineTo(timeline.sidebar_width-7, y + track_height);
                ctx.lineTo(0, y + track_height);
                ctx.closePath();
                ctx.fill();
                ctx.globalCompositeOperation = "source-over";
            }

            y += track_height;
        }

    ctx.restore();
};

function onMouse( e ) {

    if( e.type == "mouseup" )
	{
        var track_height = 20;
        //get the selected item
        if( e.offsetX < 200 )  //only if we are clicking on the items zone
        {
            var y = e.offsetY + this.current_scroll_in_pixels - 10 - track_height - this.position[1];
            for( var i in project.bones )
            {
                var item = project.bones[i];
                y = y - track_height; //if( item.visible ) y = y - track_height;
                if( y <= 0 && y > -track_height)
                    item.selected = item.selected ? false : true;
                else 
                    item.selected = false;
            }
        }
    }

    this.processMouse(e);
};

export { load_timeline };