import { getTime } from '../utils.js';

// Agnostic timeline, do nos impose any timeline content
// It renders to a canvas

function Timeline( clip, bone_name ) {

	this.current_time = 0;
	this.framerate = 30;
	this.opacity = 0.8;
	this.sidebar_width = 200;
	this.top_margin = 20;
	this.render_out_frames = false;

	//do not change, it will be updated when called draw
	this.duration = 100;
	this.position = [0,0];
	this.size = [300,150];

	this.current_scroll = 0; //in percentage
	this.current_scroll_in_pixels = 0; //in pixels
	this.scrollable_height = 0; //true height of the timeline content

	this._seconds_to_pixels = 100;
	this._pixels_to_seconds = 1/this._seconds_to_pixels;
	this._canvas = null;
	this._grab_time = 0;
	this._start_time = 0;
	this._end_time = 1;

	this._last_mouse = [0,0];

	this._tracks_drawn = [];
	this.clip = clip;
	this.selected_bone = bone_name;

	this.processTracks();

	this.onDrawContent = ( ctx, time_start, time_end, timeline ) => {

		if(this.selected_bone == null)
		return;

		let tracks = this.tracksPerBone[this.selected_bone];
		const height = 15;
		for(let i = 0; i < tracks.length; i++) {
			let track = tracks[i];
			this.drawTrackWithKeyframes(ctx, (i+1) * height, height, track.name + " (" + track.type + ")", track, i);
		}
	};
}

Timeline.prototype.setSelectedBone = function ( bone_name ) {

	if(bone_name.constructor !== String)
	throw("Bone name has to be a string!");

	this.selected_bone = bone_name;
}

// Creates a map for each bone -> tracks
Timeline.prototype.processTracks = function () {

	this.tracksPerBone = {};

	for( let track of this.clip.tracks ) {

		let trackInfo = this.getTrackName(track.name);
		trackInfo.data = track;

		let name = trackInfo.name;

		if(!this.tracksPerBone[name]) {
			this.tracksPerBone[name] = [trackInfo];
		}else {
			this.tracksPerBone[name].push( trackInfo );
		}
	}

}

// Project must have .duration in seconds
Timeline.prototype.draw = function (ctx, project, current_time, rect) {

	if(!project)
		return;

	if(!rect)
		rect = [0, ctx.canvas.height - 150, ctx.canvas.width, 150 ];

	this._canvas = ctx.canvas;
	this.position[0] = rect[0];
	this.position[1] = rect[1];
	var w = this.size[0] = rect[2];
	var h = this.size[1] = rect[3];
	var P2S = this._pixels_to_seconds;
	var S2P = this._seconds_to_pixels;
	var timeline_height = this.size[1];

	this.current_time = current_time;
	var duration = this.duration = project.duration;
	this.current_scroll_in_pixels = this.scrollable_height <= h ? 0 : (this.current_scroll * (this.scrollable_height - timeline_height));

	ctx.save();
	ctx.translate( this.position[0], this.position[1] + this.top_margin ); //20 is the top margin area

	//background
	ctx.fillStyle = "#000";
	ctx.globalAlpha = 1;
	ctx.fillRect(0,-this.top_margin,w,this.top_margin);
	ctx.globalAlpha = this.opacity;
	ctx.fillRect(0,0,w,h);
	ctx.globalAlpha = 1;

	//seconds markers
	var seconds_full_window = (w * P2S); //how many seconds fit in the current window
	var seconds_half_window = seconds_full_window * 0.5;
	var hw = w * 0.5; //half width

	//time in the left side (current time is always in the middle)
	var time_start = current_time - seconds_half_window;
	//if(time_start < 0)
	//	time_start = 0;

	//time in the right side
	var time_end = current_time + seconds_half_window;
	//if(time_end > duration )
	//	time_end = duration;

	this._start_time = time_start;
	this._end_time = time_end;

	var sidebar = this.sidebar_width;
	this._last_ref = null; //used while rendering tracks

	//this ones are limited to the true timeline (not the visible area)
	var start = Math.ceil( Math.max(0,time_start) );
	var end = Math.floor( Math.min(duration,time_end) + 0.01 );
	
	// Calls using as 0,0 the top-left of the tracks area (not the top-left of the timeline but 20 pixels below)
	this._tracks_drawn.length = 0;

	// Scrollbar
	// if( h < this.scrollable_height )
	// {
	// 	ctx.fillStyle = "#222";
	// 	ctx.fillRect( w - 10, 0, h, 10 );
	// 	var scrollh = h * (h / this.scrollable_height);
	// 	ctx.fillStyle = "#AAA";
	// 	ctx.fillRect( w - 8, this.current_scroll * (h - scrollh), 6, scrollh );
	// }

	// Frame lines
	if(S2P > 200)
	{
		ctx.strokeStyle = "#444";
		ctx.globalAlpha = (S2P - 200) / 400;
		ctx.beginPath();

		let start = time_start;
		let end = time_end;
		
		if(!this.render_out_frames) {
			start = 0;
			end = duration;
		}
		
		var pixels_per_frame = S2P / this.framerate;
		var x = pixels_per_frame + Math.round( this.timeToX( Math.floor(start * this.framerate) / this.framerate));
		var num_frames = (end - start ) * this.framerate - 1;
		for(var i = 0; i < num_frames; ++i)
		{
			ctx.moveTo( Math.round(x) + 0.5, 0);
			ctx.lineTo( Math.round(x) + 0.5, 10);
			x += pixels_per_frame;
		}
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	// Vertical lines
	ctx.strokeStyle = "#444";
	ctx.beginPath();
	var linex = this.timeToX( 0 );
	if( linex > sidebar )
	{
		ctx.moveTo( linex, 0.5);
		ctx.lineTo( linex, h );
	}
	var linex = this.timeToX( duration );
	if( linex > sidebar && linex < w )
	{
		ctx.moveTo( linex, 0.5);
		ctx.lineTo( linex, h );
	}
	ctx.stroke();

	// Horizontal line
	ctx.strokeStyle = "#AAA";
	ctx.beginPath();
	ctx.moveTo( Math.max(sidebar, this.timeToX( Math.max(0,time_start) ) ), 0.5);
	ctx.lineTo( Math.min(w, this.timeToX( Math.min(duration,time_end) ) ), 0.5);
	ctx.moveTo( Math.max(sidebar, this.timeToX( Math.max(0,time_start) ) ), 1.5);
	ctx.lineTo( Math.min(w, this.timeToX( Math.min(duration,time_end) ) ), 1.5);
	var delta_seconds = 1;
	if( this._seconds_to_pixels < 50)
		delta_seconds = 10;
	ctx.stroke();
	
	// Numbers
	ctx.fillStyle = "#FFF";
	ctx.font = "12px Tahoma";
	ctx.textAlign = "center";
	for(var t = start; t <= end; t += 1 )
	{
		if( t % delta_seconds != 0 )
			continue;
		ctx.globalAlpha = t % 10 == 0 ? 1 : Math.clamp( (this._seconds_to_pixels - 50) * 0.01,0,0.7);
		var x = ((this.timeToX(t))|0) + 0.5;
		if( x > sidebar-10 && x < (w + 10))
			ctx.fillText(String(t),x,-5);
	}
	ctx.fillText(String(duration.toFixed(3)), this.timeToX(duration),-5);
	ctx.globalAlpha = 1;

	// Current time marker
	ctx.strokeStyle = "#AFD";
	var x = ((w*0.5)|0) + 0.5;
	ctx.globalAlpha = 0.5;
	ctx.fillStyle = "#AAA";
	ctx.fillRect( x-2,1,4,h);
	ctx.globalAlpha = 1;
	ctx.beginPath();
	ctx.moveTo( x,1);
	ctx.lineTo( x,h);
	ctx.stroke();

	ctx.fillStyle = "#AFD";
	ctx.beginPath();
	ctx.moveTo( x - 4,1);
	ctx.lineTo( x + 4,1);
	ctx.lineTo( x,6);
	ctx.fill();

	if(this.onDrawContent)
		this.onDrawContent( ctx, time_start, time_end, this );

	ctx.restore();
}

Timeline.prototype.drawMarkers = function (ctx, markers) {
	//render markers
	ctx.fillStyle = "white";
	ctx.textAlign = "left";
	var markers_pos = [];
	for (var i = 0; i < markers.length; ++i) {
		var marker = markers[i];
		if (marker.time < this._start_time - this._pixels_to_seconds * 100 ||
			marker.time > this._end_time)
			continue;
		var x = this.timeToX(marker.time);
		markers_pos.push(x);
		ctx.save();
		ctx.translate(x, 0);
		ctx.rotate(Math.PI * -0.25);
		ctx.fillText(marker.title, 20, 4);
		ctx.restore();
	}

	if (markers_pos.length) {
		ctx.beginPath();
		for (var i = 0; i < markers_pos.length; ++i) {
			ctx.moveTo(markers_pos[i] - 5, 0);
			ctx.lineTo(markers_pos[i], -5);
			ctx.lineTo(markers_pos[i] + 5, 0);
			ctx.lineTo(markers_pos[i], 5);
			ctx.lineTo(markers_pos[i] - 5, 0);
		}
		ctx.fill();
	}
}

//helper function, you can call it from onDrawContent to render all the keyframes
Timeline.prototype.drawTrackWithKeyframes = function (ctx, y, track_height, title, track, track_index) {
	
	if(track.enabled === false)
		ctx.globalAlpha = 0.4;

	this._tracks_drawn.push([track.data,y+this.top_margin,track_height]);

	ctx.font = Math.floor( track_height * 0.8) + "px Arial";
	ctx.textAlign = "left";
	ctx.fillStyle = "rgba(255,255,255,0.8)";

	if(title != null)
	{
		// var info = ctx.measureText( title );
		ctx.fillStyle = "rgba(255,255,255,0.9)";
		ctx.fillText( title, 25, y + track_height * 0.75 );
	}

	ctx.fillStyle = "rgba(10,200,200,1)";
	var keyframes = track.data.times;

	if(keyframes) {
		
		for(var j = 0; j < keyframes.length; ++j)
		{
			let time = keyframes[j];
			let selected = j == track.selectedKeyFrame;
			if( time < this._start_time || time > this._end_time )
				continue;
			var keyframe_posx = this.timeToX( time );
			if( keyframe_posx > this.sidebar_width ){
				ctx.save();

				let size = track_height * 0.4;
				if(0) // edited: purple
					ctx.fillStyle = "rgba(200,20,200,1)";
				if(selected)
					ctx.fillStyle = "rgba(200,200,10,1)";
				ctx.translate(keyframe_posx, y + size * 2)
				ctx.rotate(45 * Math.PI / 180);		
				ctx.fillRect( -size, -size, size, size);
				if(selected){
					ctx.globalAlpha = 0.3;
					ctx.fillRect( -size*1.5, -size*1.5, size*2, size*2);
				}
					
				ctx.restore();
			}
		}
	}

	ctx.globalAlpha = 1;
}

// Converts distance in pixels to time
Timeline.prototype.xToTime = function (x, global) {
	if (global)
		x -= this.position[0];
	var v = (x - this.size[0] * 0.5) * this._pixels_to_seconds + this.current_time;
	return v;
}

// Converts time to disance in pixels
Timeline.prototype.timeToX = function (t, framerate, global) {
	if (framerate)
		t = Math.round(t * framerate) / framerate;
	var x = (t - this.current_time) * this._seconds_to_pixels + this.size[0] * 0.5;
	if (global)
		x += this.position[0];
	return x;
}

Timeline.prototype.getCurrentFrame = function (framerate) {
	return Math.floor(this.current_time * framerate);
}

Timeline.prototype.getTrackName = function (ugly_name) {
	const nameIndex = ugly_name.indexOf('['),
			trackNameInfo = ugly_name.substr(nameIndex+1).split("]."),
			name = trackNameInfo[0],
			type = trackNameInfo[1];

	return {
		"name": name, 
		"type": type
	};
}

Timeline.prototype.getCurrentKeyFrame = function (track, time, threshold) {

	if(!track || !track.times.length)
	return;

	// Avoid iterating through all timestamps
	if((time + threshold) < track.times[0])
	return;

	for(let i = 0; i < track.times.length; ++i) {
		let t = track.times[i];
		if(t >= (time - threshold) && 
			t <= (time + threshold)) {
			// const n = track.values.length / track.times.length;
			return i;
		}
	}

	return;
}

Timeline.prototype.setScale = function (v) {
	this._seconds_to_pixels = v;
	if (this._seconds_to_pixels > 3000)
		this._seconds_to_pixels = 3000;
	this._pixels_to_seconds = 1 / this._seconds_to_pixels;
}

Timeline.prototype.processMouse = function (e) {
	if(!this._canvas)
		return;

	var w = this.size[0];
	var h = this.size[1];

	// Process mouse
	var x = e.offsetX;
	var y = e.offsetY;
	e.deltax = x - this._last_mouse[0];
	e.deltay = y - this._last_mouse[1];
	var local_x = e.offsetX - this.position[0];
	var local_y = e.offsetY - this.position[1];
	this._last_mouse[0] = x;
	this._last_mouse[1] = y;
	var timeline_height = this.size[1];

	var time = this.xToTime(x, true);

	var is_inside = x >= this.position[0] && x <= (this.position[0] + this.size[0]) &&
					y >= this.position[1] && y <= (this.position[1] + this.size[1]);

	var track = null;
	for(var i = this._tracks_drawn.length - 1; i >= 0; --i)
	{
		var t = this._tracks_drawn[i];
		if( local_y >= t[1] && local_y < (t[1] + t[2]) )
		{
			track = t[0];
			break;
		}
	}

	e.track = track;

	if( e.type == "mouseup" )
	{
		this._grabbing = false;
		this._grabbing_scroll = false;
		if( this.onMouseUp )
			this.onMouseUp(e, time);

		const discard = getTime() - this._click_time > 420; // ms

		if(!discard && track) {
			let keyFrameIndex = this.getCurrentKeyFrame( track, this.xToTime( local_x ), this._pixels_to_seconds * 5 );
			if(keyFrameIndex != undefined) {
				let trackInfo = this.getTrackName(track.name);
				let tracks = this.tracksPerBone[ trackInfo.name ];

				for(let i = 0; i < tracks.length; ++i) {
					let t = tracks[i];
					if(t.type == trackInfo.type) {

						if(this.lastSelected) {
							this.tracksPerBone[ this.lastSelected[0] ][ this.lastSelected[1] ].selectedKeyFrame = null;
						}
						
						// Store selection to remove later
						this.lastSelected = [t.name, i];
						t.selectedKeyFrame = keyFrameIndex;

						// Set time
						if( this.onSetTime )
							this.onSetTime( t.data.times[ keyFrameIndex ] );

						break;
					}
				}

			}
		}
	}

	if ( !is_inside && !this._grabbing && !(e.metaKey || e.altKey ) )
		return;

	if( this.onMouse && this.onMouse( e, time, this ) )
		return;

	if( e.type == "mousedown")
	{
		this._click_time = getTime();

		if(this._track_bullet_callback && e.track)
			this._track_bullet_callback(e.track,e,this,[local_x,local_y]);

		if( timeline_height < this.scrollable_height && x > w - 10)
		{
			this._grabbing_scroll = true;
		}
		else
		{
			this._grabbing = true;
			this._grab_time = time - this.current_time;
		}
	}
	else if( e.type == "mousemove" )
	{
		if( this._grabbing )
		{
			var curr = time - this.current_time;
			var delta = curr - this._grab_time;
			this._grab_time = curr;
			//console.log( "grab_time",this._grab_time);
			this.current_time = Math.max(0,this.current_time - delta);
			if( this.onSetTime )
				this.onSetTime( this.current_time );
		}
		// else if( this._grabbing_scroll )
		// {
		// 	var scrollh = timeline_height * (timeline_height / this.scrollable_height);
		// 	this.current_scroll = Math.clamp( this.current_scroll + e.movementY / timeline_height, 0, 1);
		// }
	}
	else if( e.type == "wheel" )
	{
		if( timeline_height < this.scrollable_height && x > w - 10)
		{
			this.current_scroll = Math.clamp( this.current_scroll + (e.wheelDelta < 0 ? 0.1 : -0.1), 0, 1);
		}
		else
		{
			this.setScale( this._seconds_to_pixels * (e.wheelDelta < 0 ? 0.9 : (1/0.9)) );
		}
	}

	this._canvas.style.cursor = this._grabbing && (getTime() - this._click_time > 320) ? "grabbing" : "pointer" ;

	return true;
};

export { Timeline };