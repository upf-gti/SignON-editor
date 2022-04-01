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
	this.size = [300, 150];

	this.current_scroll = 0; //in percentage
	this.current_scroll_in_pixels = 0; //in pixels
	this.scrollable_height = 0; //true height of the timeline content

	this._seconds_to_pixels = 100;
	this._pixels_to_seconds = 1 / this._seconds_to_pixels;
	this._canvas = null;
	this._grab_time = 0;
	this._start_time = 0;
	this._end_time = 1;

	this._last_mouse = [0,0];
	this._lastKeyFramesSelected = [];

	this._tracks_drawn = [];
	this._clipboard = null;

	this.clip = clip;
	this.selected_bone = bone_name;
	this.snappedKeyFrameIndex = -1;

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

// Creates a map for each bone -> tracks
Timeline.prototype.processTracks = function () {

	this.tracksPerBone = {};

	for( let i = 0; i < this.clip.tracks.length; ++i ) {

		let track = this.clip.tracks[i];

		const [name, type] = this.getTrackName(track.name);
		let trackInfo = {
			name: name, type: type, data: track,
			dim: track.values.length/track.times.length,
			selected: [], edited: [], hovered: []
		};
		
		if(!this.tracksPerBone[name]) {
			this.tracksPerBone[name] = [trackInfo];
		}else {
			this.tracksPerBone[name].push( trackInfo );
		}

		track.idx = this.tracksPerBone[name].length - 1; // Last element
		track.clip_idx = i;
	}
}

Timeline.prototype.isKeyFrameSelected = function ( track, index ) {
	return track.selected[ index ];
}

Timeline.prototype.selectKeyFrame = function ( track, selection_info, index ) {
	
	if(index == undefined || !track)
	return;

	this.unSelectAllKeyFrames();
						
	this._lastKeyFramesSelected.push( selection_info );
	track.selected[index] = true;

	if( this.onSetTime )
		this.onSetTime( track.data.times[ index ] );
}

Timeline.prototype.canPasteKeyFrame = function () {
	return this._clipboard != null;
}

Timeline.prototype.copyKeyFrame = function ( track, index ) {

	// 1 element clipboard by now

	let values = [];
	let start = index * track.dim;
	for(let i = start; i < start + track.dim; ++i)
		values.push( track.data.values[i] );

	this._clipboard = {
		type: track.type,
		values: values
	};
}

Timeline.prototype._paste = function( track, index ) {

	let data = this._clipboard;

	if(data.type != track.type){
		return;
	}

	let start = index * track.dim;
	let j = 0;
	for(let i = start; i < start + track.dim; ++i) {
		track.data.values[i] = data.values[j];
		++j;
	}

	if(this.onSetTime)
		this.onSetTime(this.current_time);

	track.edited[ index ] = true;
}

Timeline.prototype.pasteKeyFrame = function ( e, track, index ) {

	// Copy to current key
	this._paste( track, index );
	
	if(!e.multipleSelection)
	return;
	
	// Copy to every selected key
	for(let [name, idx, keyIndex] of this._lastKeyFramesSelected) {
		this._paste( this.tracksPerBone[name][idx], keyIndex );
	}
}

Timeline.prototype.deleteKeyFrame = function (e, track, index) {
	
	// TODO: delete multiple selection
	if(e.multipleSelection)
	return;

	// Delete time key
	track.data.times = track.data.times.filter( (v, i) => i != index);

	// Delete values
	track.data.values = track.data.values.filter( (v, i) => {
		let b = true;
		for(let k = i; k < i + track.dim; ++k)
			b &= (k != index);
		return b;
	});

	// Update clip information
	const clip_idx = track.data.clip_idx;
	this.clip.tracks[clip_idx].times = track.data.times;
	this.clip.tracks[clip_idx].values = track.data.values;
}

Timeline.prototype.getNumKeyFramesSelected = function () {
	return this._lastKeyFramesSelected.length;
}

Timeline.prototype.unSelect = function () {

	if(!this.unSelectAllKeyFrames()) {
		this.selected_bone = null;
		if(this.onBoneUnselected)
			this.onBoneUnselected();
	}
}

Timeline.prototype.setSelectedBone = function ( bone_name ) {

	if(bone_name.constructor !== String)
	throw("Bone name has to be a string!");

	this.selected_bone = bone_name;
	this.unSelectAllKeyFrames();
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

Timeline.prototype.getTrack = function(track_info)  {
	const [name, trackIndex] = track_info;
	return this.tracksPerBone[ name ][trackIndex];
}

Timeline.prototype.getTracksInRange = function (minY, maxY, threshold) {

	let tracks = [];

	// Manage negative selection
	if(minY > maxY) {
		let aux = minY;
		minY = maxY;
		maxY = aux;
	}

	for(let i = this._tracks_drawn.length - 1; i >= 0; --i) {
		let t = this._tracks_drawn[i];
		let pos = t[1] - this.top_margin, size = t[2];
		if( pos + threshold >= minY && (pos + size - threshold) <= maxY ) {
			tracks.push( t[0] );
		}
	}
/*let trackType = trackInfo.name.split(".");
		
		if(trackType.length>1){
			name = trackType[0];
			trackInfo.type = trackType[1];
		}*/
	return tracks;
}


Timeline.prototype.getTrackName = function (ugly_name) {

	let name, type;

	// Support other versions
	if(ugly_name.includes("[")) {
		const nameIndex = ugly_name.indexOf('['),
			trackNameInfo = ugly_name.substr(nameIndex+1).split("].");
		name = trackNameInfo[0];
		type = trackNameInfo[1];
	}else {
		const trackNameInfo = ugly_name.split(".");
		name = trackNameInfo[0];
		type = trackNameInfo[1];
	}

	return [name, type];
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
			return i;
		}
	}

	return;
}

Timeline.prototype.getKeyFramesInRange = function (track, minTime, maxTime, threshold) {

	if(!track || !track.times.length)
	return;

	// Manage negative selection
	if(minTime > maxTime) {
		let aux = minTime;
		minTime = maxTime;
		maxTime = aux;
	}

	// Avoid iterating through all timestamps
	if((maxTime + threshold) < track.times[0])
	return;

	let indices = [];

	for(let i = 0; i < track.times.length; ++i) {
		let t = track.times[i];
		if(t >= (minTime - threshold) && 
			t <= (maxTime + threshold)) {
			indices.push(i);
		}
	}

	return indices;
}

Timeline.prototype.getNearestKeyFrame = function (track, time) {

	if(!track || !track.times.length)
	return;

	return track.times.reduce((a, b) => {
		return Math.abs(b - time) < Math.abs(a - time) ? b : a;
	});
}

Timeline.prototype.setScale = function (v) {
	this._seconds_to_pixels = v;
	if (this._seconds_to_pixels > 3000)
		this._seconds_to_pixels = 3000;
	this._pixels_to_seconds = 1 / this._seconds_to_pixels;
}

Timeline.prototype.unSelectAllKeyFrames = function() {
	for(let [name, idx, keyIndex] of this._lastKeyFramesSelected) {
		this.tracksPerBone[name][idx].selected[keyIndex] = false;
	}

	// Something has been unselected
	const unselected = this._lastKeyFramesSelected.length > 0;
	this._lastKeyFramesSelected.length = 0;
	return unselected;
}

Timeline.prototype.processCurrentKeyFrame = function (e, keyFrameIndex, track, local_x, multiple) {

	e.multipleSelection = multiple;
	keyFrameIndex = keyFrameIndex ?? this.getCurrentKeyFrame( track, this.xToTime( local_x ), this._pixels_to_seconds * 5 );

	if(keyFrameIndex == undefined)
	return;

	if(!multiple && e.button != 2) {
		this.unSelectAllKeyFrames();
	}
					
	const [name, type] = this.getTrackName( track.name );
	let t = this.tracksPerBone[ name ][track.idx];
	let currentSelection = [name, track.idx, keyFrameIndex];
	
	if( this.onSelectKeyFrame && this.onSelectKeyFrame(e, currentSelection, keyFrameIndex)) {
		// Event handled
		return;
	}
	
	// Select if not handled
	this._lastKeyFramesSelected.push( currentSelection );
	t.selected[keyFrameIndex] = true;

	if( !multiple && this.onSetTime )
		this.onSetTime( track.times[ keyFrameIndex ] );
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

		const discard = getTime() - this._click_time > 420; // ms

		if(e.shiftKey) {

			// Multiple selection
			if(!discard && track) {
				this.processCurrentKeyFrame( e, null, track, local_x, true );
			}
			// Box selection
			else{

				this.unSelectAllKeyFrames();

				let tracks = this.getTracksInRange(this.boxSelectionStart[1], this.boxSelectionEnd[1], this._pixels_to_seconds * 5);

				for(let t of tracks) {
					let keyFrameIndices = this.getKeyFramesInRange(t, 
						this.xToTime( this.boxSelectionStart[0] ), 
						this.xToTime( this.boxSelectionEnd[0] ),
						this._pixels_to_seconds * 5);
					
					if(keyFrameIndices) {
						for(let index of keyFrameIndices)
						this.processCurrentKeyFrame( e, index, t, null, true );
					}
				}
			}

		}else {
			// Check exact track keyframe
			if(!discard && track) {
				this.processCurrentKeyFrame( e, null, track, local_x );
			}
		}

		this.boxSelection = false;
		this.boxSelectionStart = null;
		this.boxSelectionEnd = null;

		if( this.onMouseUp )
			this.onMouseUp(e, time);
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

			if(e.shiftKey) {
				this.boxSelection = true;
				this.boxSelectionStart = [local_x,local_y - 20];
			}
		}
	}
	else if( e.type == "mousemove" )
	{
		if(e.shiftKey) {
			if(this.boxSelection) {
				this.boxSelectionEnd = [local_x,local_y - 20];
				return; // Handled
			}
		}

		const removeHover = () => {
			if(this.lastHovered)
				this.tracksPerBone[ this.lastHovered[0] ][ this.lastHovered[1] ].hovered[ this.lastHovered[2] ] = undefined;
		};

		if( this._grabbing && e.button != 2)
		{
			var curr = time - this.current_time;
			var delta = curr - this._grab_time;
			this._grab_time = curr;
			this.current_time = Math.max(0,this.current_time - delta);

			const inner = (t) => { if( this.onSetTime ) this.onSetTime( t );	 }

			// fix this
			if(e.shiftKey && track) {
				let keyFrameIndex = this.getNearestKeyFrame( track, this.current_time);

				if(keyFrameIndex != this.snappedKeyFrameIndex){
					this.snappedKeyFrameIndex = keyFrameIndex;
					this.current_time = track.times[ keyFrameIndex ];		
					inner( this.current_time );		
				}
				
			}else{
				inner( this.current_time );	
			}
		}else if(track) {

			let keyFrameIndex = this.getCurrentKeyFrame( track, this.xToTime( local_x ), this._pixels_to_seconds * 5 );
			if(keyFrameIndex != undefined) {
				
				const [name, type] = this.getTrackName(track.name);
				let t = this.tracksPerBone[ name ][track.idx];

				removeHover();
					
				this.lastHovered = [name, track.idx, keyFrameIndex];
				t.hovered[keyFrameIndex] = true;

			}else {
				removeHover();
			}
		}else {
			removeHover();
		}
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
		ctx.globalAlpha = t % 10 == 0 ? 0.5 : Math.clamp( (this._seconds_to_pixels - 50) * 0.01,0,0.7);
		// if(Math.abs(t - current_time) < 0.05)
		// 	ctx.globalAlpha = 0.25;
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

	// Current time text
	ctx.fillText(String(current_time.toFixed(3)), x, -5);

	// Selections
	if(this.boxSelection && this.boxSelectionStart && this.boxSelectionEnd) {
		ctx.globalAlpha = 0.5;
		ctx.fillStyle = "#AAA";
		ctx.strokeRect( this.boxSelectionStart[0], this.boxSelectionStart[1], this.boxSelectionEnd[0] - this.boxSelectionStart[0], this.boxSelectionEnd[1] - this.boxSelectionStart[1]);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

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
			let selected = track.selected[j];
			if( time < this._start_time || time > this._end_time )
				continue;
			var keyframe_posx = this.timeToX( time );
			if( keyframe_posx > this.sidebar_width ){
				ctx.save();

				let margin = 0;
				let size = track_height * 0.4;
				if(track.edited[j])
					ctx.fillStyle = "rgba(255,0,255,1)";
				if(selected) {
					ctx.fillStyle = "rgba(200,200,10,1)";
					size = track_height * 0.45;
					margin = -1;
				}
				if(track.hovered[j]) {
					size = track_height * 0.5;
					ctx.fillStyle = "rgba(250,250,250,0.7)";
					margin = -2;
				}
				ctx.translate(keyframe_posx, y + size * 2 + margin);
				ctx.rotate(45 * Math.PI / 180);		
				ctx.fillRect( -size, -size, size, size);
				if(selected) {
					ctx.globalAlpha = 0.25;
					ctx.fillRect( -size*1.5, -size*1.5, size*2, size*2);
				}
					
				ctx.restore();
			}
		}
	}

	ctx.globalAlpha = 1;
}

export { Timeline };