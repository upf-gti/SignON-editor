import { UTILS, CompareThreshold } from '../utils.js';

// Agnostic timeline, do nos impose any timeline content
// It renders to a canvas

function Timeline( clip, bone_name, timeline_mode = "tracks" , position = [0,0]) {

	this.current_time = 0;
	this.framerate = 30;
	this.opacity = 0.8;
	this.sidebar_width = 200;
	this.top_margin = 24;
	this.render_out_frames = false;

	//do not change, it will be updated when called draw
	this.duration = 100;
	this.position = position;
	this.size = [300, 150];

	this.current_scroll = 0; //in percentage
	this.current_scroll_in_pixels = 0; //in pixels
	this.scrollable_height = this.size[1]; //true height of the timeline content

	this._seconds_to_pixels = 100;
	this._pixels_to_seconds = 1 / this._seconds_to_pixels;
	this._canvas = null;
	this._grab_time = 0;
	this._start_time = 0;
	this._end_time = 1;

	this._last_mouse = [0,0];
	this._lastKeyFramesSelected = [];

	this._trackState = [];
	this._tracks_drawn = [];
	this._buttons_drawn = [];
	this._clipboard = null;

	this.clip = clip;
	this.selected_bone = bone_name;
	this.snappedKeyFrameIndex = -1;
	this.autoKeyEnabled = false;
	
	this.track_height = 15;
	this.timeline_mode = timeline_mode;
	if(clip)
		this.processTracks();

	this.onDrawContent = ( ctx, time_start, time_end, timeline ) => {
		if(this.timeline_mode == "tracks") {

			if(this.selected_bone == null)
			return;
			
			let tracks = this.tracksPerBone[this.selected_bone];
			if(!tracks) return;
			
			const height = this.track_height;
			for(let i = 0; i < tracks.length; i++) {
				let track = tracks[i];
				this.drawTrackWithKeyframes(ctx, (i+1) * height, height, track.name + " (" + track.type + ")", track, i);
			}
		}
		else if( this.timeline_mode == "clips")
		{
			
			let tracks = this.clip.tracks|| [{name: "NMF", clips: []}];
			if(!tracks) return;
			
			const height = this.track_height;
			for(let i = 0; i < tracks.length; i++) {
				let track = tracks[i];
				this.drawTrackWithBoxes(ctx, (i+1) * height, height, track.name || "", track, i);
			}
		}
	};

	this.autoKeyButtonImg = document.createElement('img');
	this.autoKeyButtonImg.src = 'data/imgs/mini-icon-auto.png';
	this.optimizeButtonImg = document.createElement('img');
	this.optimizeButtonImg.src = 'data/imgs/mini-icon-optimize.png';
	this.unSelectAllKeyFramesImg = document.createElement('img');
	this.unSelectAllKeyFramesImg.src = 'data/imgs/close-icon.png';

	// Add button data
	let offset = 25;
	this._buttons_drawn.push( [this.autoKeyButtonImg, "autoKeyEnabled", 9, -this.top_margin + 1, 22, 22] );
	this._buttons_drawn.push( [this.optimizeButtonImg, "optimize", 9 + offset * this._buttons_drawn.length, -this.top_margin + 1, 22, 22, (e) => {
		this.onShowOptimizeMenu(e);
	}] );
	this._buttons_drawn.push( [this.unSelectAllKeyFramesImg, "unselectAll", 9 + offset * this._buttons_drawn.length, -this.top_margin + 1, 22, 22, (e) => {
		this.unSelectAllKeyFrames();
	}] );
	
	if(this.timeline_mode == "clips")
	{
		let btn = document.createElement("img");
		btn.innerText = "Add NMF";
		this._buttons_drawn.push( [btn, "addNMF", 9 + offset * this._buttons_drawn.length, -this.top_margin + 1, 22, 22, (v) =>{ console.log(v)} ]);
	}
}

Timeline.prototype.onUpdateTracks = function ( keyType ) {
	
	if(this.selected_bone == null || this._lastKeyFramesSelected.length || !this.autoKeyEnabled)
	return;

	let tracks = this.tracksPerBone[this.selected_bone];
	if(!tracks) return;

	// Get current track
	const selectedTrackIdx = tracks.findIndex( t => t.type === keyType );
	if(selectedTrackIdx < 0)
		return;
	let track = tracks[ selectedTrackIdx ];
	
	// Add new keyframe
	const newIdx = this.addKeyFrame( track );
	if(newIdx === null) 
		return;

	// Select it
	this._lastKeyFramesSelected.push( [track.name, track.idx, newIdx] );
	track.selected[newIdx] = true;

	// Update time
	if(this.onSetTime)
		this.onSetTime(this.current_time);

	return true; // Handled
}

// Creates a map for each bone -> tracks
Timeline.prototype.processTracks = function () {

	this.tracksPerBone = {};

	for( let i = 0; i < this.clip.tracks.length; ++i ) {

		let track = this.clip.tracks[i];

		const [name, type] = this.getTrackName(track.name);

		let trackInfo = {
			name: name, type: type,
			dim: track.values.length/track.times.length,
			selected: [], edited: [], hovered: []
		};
		
		if(!this.tracksPerBone[name]) {
			this.tracksPerBone[name] = [trackInfo];
		}else {
			this.tracksPerBone[name].push( trackInfo );
		}

		const trackIndex = this.tracksPerBone[name].length - 1;
		this.tracksPerBone[name][trackIndex].idx = trackIndex;
		this.tracksPerBone[name][trackIndex].clip_idx = i;

		// Save index also in original track
		track.idx = trackIndex;
	}
}

Timeline.prototype.getNumTracks = function(bone) {
	if(!bone)
	return;
	const tracks = this.tracksPerBone[bone.name];
	return tracks ? tracks.length : null;
}

Timeline.prototype.onShowOptimizeMenu = function(e) {
	
	let actions = [{ title: "Optimize", disabled: true }, null];

	if(this.selected_bone == null)
	return;

	let tracks = this.tracksPerBone[this.selected_bone];
	if(!tracks) return;

	const threshold = this.onGetOptimizeThreshold ? this.onGetOptimizeThreshold() : 0.025;

	for( let t of tracks ) {
		actions.push( {
			title: t.name+"@"+t.type,
			callback: () => { 
				this.clip.tracks[t.clip_idx].optimize( threshold );
				t.edited = [];
			}
		} );
	}
	
	const menu = new LiteGUI.ContextMenu( actions, { event: e });
	for( const el of menu.root.querySelectorAll(".submenu") )
		el.style.fontSize = "0.9em";
}

Timeline.prototype.onPreProcessTrack = function( track ) {
	const name = this.getTrackName(track.name)[0];
	let trackInfo = this.tracksPerBone[name][track.idx];
	trackInfo.selected = [];
	trackInfo.edited = [];
	trackInfo.hovered = [];
}

Timeline.prototype.isKeyFrameSelected = function ( track, index ) {
	return track.selected[ index ];
}

Timeline.prototype.saveState = function(clip_idx) {

	const localIdx = this.clip.tracks[clip_idx].idx;
	const name = this.getTrackName(this.clip.tracks[clip_idx].name)[0];
	const trackInfo = this.tracksPerBone[name][localIdx];

	this._trackState.push({
		idx: clip_idx,
		t: this.clip.tracks[clip_idx].times.slice(),
		v: this.clip.tracks[clip_idx].values.slice(),
		editedTracks: [].concat(trackInfo.edited)
	});
}

Timeline.prototype.restoreState = function() {
	
	if(!this._trackState.length)
	return;

	const state = this._trackState.pop();
	this.clip.tracks[state.idx].times = state.t;
	this.clip.tracks[state.idx].values = state.v;

	const localIdx = this.clip.tracks[state.idx].idx;
	const name = this.getTrackName(this.clip.tracks[state.idx].name)[0];
	this.tracksPerBone[name][localIdx].edited = state.editedTracks;

	// Update animation action interpolation info
	if(this.onUpdateTrack)
		this.onUpdateTrack( state.idx );
}

Timeline.prototype.clearState = function() {
	this._trackState = [];
}

Timeline.prototype.selectKeyFrame = function ( track, selection_info, index ) {
	
	if(index == undefined || !track)
	return;

	this.unSelectAllKeyFrames();
						
	this._lastKeyFramesSelected.push( selection_info );
	track.selected[index] = true;

	if( this.onSetTime )
		this.onSetTime( this.clip.tracks[track.clip_idx].times[ index ] );
}

Timeline.prototype.canPasteKeyFrame = function () {
	return this._clipboard != null;
}

Timeline.prototype.copyKeyFrame = function ( track, index ) {

	// 1 element clipboard by now

	let values = [];
	let start = index * track.dim;
	for(let i = start; i < start + track.dim; ++i)
		values.push( this.clip.tracks[ track.clip_idx ].values[i] );

	this._clipboard = {
		type: track.type,
		values: values
	};
}

Timeline.prototype._paste = function( track, index ) {

	let clipboardInfo = this._clipboard;

	if(clipboardInfo.type != track.type){
		return;
	}

	let start = index * track.dim;
	let j = 0;
	for(let i = start; i < start + track.dim; ++i) {
		this.clip.tracks[ track.clip_idx ].values[i] = clipboardInfo.values[j];
		++j;
	}

	if(this.onSetTime)
		this.onSetTime(this.current_time);

	track.edited[ index ] = true;
}

Timeline.prototype.pasteKeyFrame = function ( e, track, index ) {

	this.saveState(track.clip_idx);

	// Copy to current key
	this._paste( track, index );
	
	if(!e.multipleSelection)
	return;
	
	// Don't want anything after this
	this.clearState();

	// Copy to every selected key
	for(let [name, idx, keyIndex] of this._lastKeyFramesSelected) {
		this._paste( this.tracksPerBone[name][idx], keyIndex );
	}
}

Timeline.prototype.addKeyFrame = function( track ) {

	// Update clip information
	const clip_idx = track.clip_idx;

	// Time slot with other key?
	const keyInCurrentSlot = this.clip.tracks[clip_idx].times.find( t => { return !CompareThreshold(this.current_time, t, t, 0.001 ); });
	if( keyInCurrentSlot ) {
		console.warn("There is already a keyframe stored in time slot ", keyInCurrentSlot)
		return;
	}

	this.saveState(clip_idx);

	// Find new index
	let newIdx = this.clip.tracks[clip_idx].times.findIndex( t => t > this.current_time );

	// Add as last index
	let lastIndex = false;
	if(newIdx < 0) {
		newIdx = this.clip.tracks[clip_idx].times.length;
		lastIndex = true;
	}

	// Add time key
	const timesArray = [];
	this.clip.tracks[clip_idx].times.forEach( (a, b) => {
		b == newIdx ? timesArray.push(this.current_time, a) : timesArray.push(a);
	} );

	if(lastIndex) {
		timesArray.push(this.current_time);			
	}

	this.clip.tracks[clip_idx].times = new Float32Array( timesArray );
	
	// Get mid values
	const bone = this.onGetSelectedBone();
	const lerpValue = bone[ track.type ].toArray();
	
	// Add values
	const valuesArray = [];
	this.clip.tracks[clip_idx].values.forEach( (a, b) => {
		if(b == newIdx * track.dim) {
			for( let i = 0; i < track.dim; ++i )
				valuesArray.push(lerpValue[i]);
		}
		valuesArray.push(a);
	} );

	if(lastIndex) {
		for( let i = 0; i < track.dim; ++i )
			valuesArray.push(lerpValue[i]);
	}

	this.clip.tracks[clip_idx].values = new Float32Array( valuesArray );

	// Move the other's key properties
	for(let i = (this.clip.tracks[clip_idx].times.length - 1); i > newIdx; --i) {
		track.edited[i - 1] ? track.edited[i] = track.edited[i - 1] : 0;
	}
	
	// Reset this key's properties
	track.hovered[newIdx] = undefined;
	track.selected[newIdx] = undefined;
	track.edited[newIdx] = undefined;

	// Update animation action interpolation info
	if(this.onUpdateTrack)
		this.onUpdateTrack( clip_idx );

	if(this.onSetTime)
		this.onSetTime(this.current_time);

	return newIdx;
}

Timeline.prototype._delete = function( track, index ) {

	// Don't remove by now the first key
	if(index == 0) {
		console.warn("Operation not supported! [remove first keyframe track]");
		return;
	}

	// Update clip information
	const clip_idx = track.clip_idx;

	// Don't remove by now the last key
	// if(index == this.clip.tracks[clip_idx].times.length - 1) {
	// 	console.warn("Operation not supported! [remove last keyframe track]");
	// 	return;
	// }

	// Reset this key's properties
	track.hovered[index] = undefined;
	track.selected[index] = undefined;
	track.edited[index] = undefined;

	// Delete time key
	this.clip.tracks[clip_idx].times = this.clip.tracks[clip_idx].times.filter( (v, i) => i != index);

	// Delete values
	const indexDim = track.dim * index;
	const slice1 = this.clip.tracks[clip_idx].values.slice(0, indexDim);
	const slice2 = this.clip.tracks[clip_idx].values.slice(indexDim + track.dim);

	this.clip.tracks[clip_idx].values = UTILS.concatTypedArray([slice1, slice2], Float32Array);

	// Move the other's key properties
	for(let i = index; i < this.clip.tracks[clip_idx].times.length; ++i) {
		track.edited[i] = track.edited[i + 1];
	}

	// Update animation action interpolation info
	if(this.onUpdateTrack)
		this.onUpdateTrack( clip_idx );
}

Timeline.prototype.deleteKeyFrame = function (e, track, index) {
	
	if(e.multipleSelection) {

		// Split in tracks
		const perTrack = [];
		this._lastKeyFramesSelected.forEach( e => perTrack[e[1]] ? perTrack[e[1]].push(e) : perTrack[e[1]] = [e] );
		
		for(let pts of perTrack) {
			
			if(!pts) continue;

			pts = pts.sort( (a,b) => a[2] - b[2] );
			
			let deletedIndices = 0;

			// Delete every selected key
			for(let [name, idx, keyIndex] of pts) {
				this._delete( this.tracksPerBone[name][idx], keyIndex - deletedIndices );
				deletedIndices++;
			}
		}
	}
	else{

		// Key pressed
		if(!track && this._lastKeyFramesSelected.length > 0) {
			const [boneName, trackIndex, keyIndex] = this._lastKeyFramesSelected[0];
			track = this.tracksPerBone[boneName][trackIndex];
			index = keyIndex;
		}

		if ( track ){
			this.saveState(track.clip_idx);
			this._delete( track, index );
		}
	}

	this.unSelectAllKeyFrames();
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
	
	if(keyFrameIndex == undefined)
	return;

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

	const innerSetTime = (t) => { if( this.onSetTime ) this.onSetTime( t );	 }

	if( e.type == "mouseup" )
	{
		const discard = this._movingKeys || (UTILS.getTime() - this._click_time) > 420; // ms
		this._movingKeys ? innerSetTime( this.current_time ) : 0;
		
		this._grabbing = false;
		this._grabbing_scroll = false;
		this._movingKeys = false;
		this._timeBeforeMove = null;

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
			} else {
				y -= this.top_margin;
				for( const b of this._buttons_drawn ) {
					b.pressed = false;
					const bActive = x >= b[2] && x <= (b[2] + b[4]) && y >= b[3] && y <= (b[3] + b[5]);
					if(bActive) {
						const callback = b[6]; 
						if(callback) callback(e);
						else this[ b[1] ] = !this[ b[1] ];
						break;
					}
				}
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
		this._click_time = UTILS.getTime();

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
			}else if(e.ctrlKey && track) {
				const keyFrameIndex = this.getCurrentKeyFrame( track, this.xToTime( local_x ), this._pixels_to_seconds * 5 );
				if( keyFrameIndex != undefined ) {
					this.processCurrentKeyFrame( e, keyFrameIndex, track, null, true ); // Settings this as multiple so time is not being set
					this._movingKeys = true;

					// Set pre-move state
					for(let selectedKey of this._lastKeyFramesSelected) {
						let [name, idx, keyIndex] = selectedKey;
						let track = this.tracksPerBone[name][idx];
						selectedKey[3] = this.clip.tracks[ track.clip_idx ].times[ keyIndex ];
					}

					this._timeBeforeMove = track.times[ keyFrameIndex ];
				}
			}else if(!track) {
				y -= this.top_margin;
				for( const b of this._buttons_drawn ) {
					const bActive = x >= b[2] && x <= (b[2] + b[4]) && y >= b[3] && y <= (b[3] + b[5]);
					b.pressed = bActive;
				}
			}
		}
	}
	else if( e.type == "mousemove" )
	{
		// Manage keyframe movement
		if(this._movingKeys) {

			this.clearState();
			const newTime = this.xToTime( local_x );
			
			for(let [name, idx, keyIndex, keyTime] of this._lastKeyFramesSelected) {
				let track = this.tracksPerBone[name][idx];
				const delta = this._timeBeforeMove - keyTime;
				this.clip.tracks[ track.clip_idx ].times[ keyIndex ] = Math.min( this.clip.duration, Math.max(0, newTime - delta) );
			}

			return;
		}

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

			// fix this
			if(e.shiftKey && track) {
				let keyFrameIndex = this.getNearestKeyFrame( track, this.current_time);

				if(keyFrameIndex != this.snappedKeyFrameIndex){
					this.snappedKeyFrameIndex = keyFrameIndex;
					this.current_time = track.times[ keyFrameIndex ];		
					innerSetTime( this.current_time );		
				}
				
			}else{
				innerSetTime( this.current_time );	
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

	this._canvas.style.cursor = this._grabbing && (UTILS.getTime() - this._click_time > 320) ? "grabbing" : "pointer" ;

	return true;
};

Timeline.prototype.draw = function (ctx, current_time, rect) {

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
	if(this.clip)
		this.duration = this.clip.duration;
	var duration = this.duration;
	this.current_scroll_in_pixels = this.scrollable_height <= h ? 0 : (this.current_scroll * (this.scrollable_height - timeline_height));

	ctx.save();
	ctx.translate( this.position[0], this.position[1] + this.top_margin ); //20 is the top margin area

	//background
	ctx.clearRect(0,-this.top_margin,w,h+this.top_margin);
	ctx.fillStyle = "#000";
	ctx.globalAlpha = 0.65;
	ctx.fillRect(0,-this.top_margin,w,this.top_margin);
	ctx.globalAlpha = 0.55;
	ctx.fillRect(0,0,w,h);
	ctx.globalAlpha = 1;

	//buttons
	for( const b of this._buttons_drawn ) {
		const boundProperty = b[1];
		ctx.fillStyle = this[ boundProperty ] ? "#b66" : "#454545";	
		if(b.pressed) ctx.fillStyle = "#eee";
		ctx.roundRect(b[2], b[3], b[4], b[5], 5, true, false);
		ctx.drawImage(b[0], b[2] + 2, b[3] + 2, b[4] - 4, b[5] - 4);
	}

	//seconds markers
	var seconds_full_window = (w * P2S); //how many seconds fit in the current window
	var seconds_half_window = seconds_full_window * 0.5;

	//time in the left side (current time is always in the middle)
	var time_start = current_time - seconds_half_window;
	//time in the right side
	var time_end = current_time + seconds_half_window;

	this._start_time = time_start;
	this._end_time = time_end;

	var sidebar = this.sidebar_width;
	this._last_ref = null; //used while rendering tracks

	//this ones are limited to the true timeline (not the visible area)
	var start = Math.ceil( Math.max(0,time_start) );
	var end = Math.floor( Math.min(duration,time_end) + 0.01 );
	
	// Calls using as 0,0 the top-left of the tracks area (not the top-left of the timeline but 20 pixels below)
	this._tracks_drawn.length = 0;

	// Frame lines
	if(S2P > 200)
	{
		ctx.strokeStyle = "#444";
		ctx.globalAlpha = 0.4;
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

	this._tracks_drawn.push([this.clip.tracks[track.clip_idx],y+this.top_margin,track_height]);

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
	var keyframes = this.clip.tracks[track.clip_idx].times;

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
					ctx.fillStyle = "rgba(250,250,20,1)";
					size = track_height * 0.5;
					margin = -2;
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
					ctx.globalAlpha = 0.3;
					ctx.fillRect( -size*1.5, -size*1.5, size*2, size*2);
				}
					
				ctx.restore();
			}
		}
	}

	ctx.globalAlpha = 1;
}

Timeline.prototype.drawTrackWithBoxes = function (ctx, y, track_height, title, track, track_index)
{

	if(track.enabled === false)
		ctx.globalAlpha = 0.4;

	this._tracks_drawn.push([this.clip.tracks[track.clip_idx],y+this.top_margin,track_height]);
	this._canvas = this._canvas || ctx.canvas;
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
	var clips = this.clip.tracks[track.clip_idx].clips;
	let track_alpha = 1;
	if(clips) {
		
		for(var j = 0; j < clips.length; ++j)
		{
			let clip = clips[j];
			let framerate = this.framerate;
			//let selected = track.selected[j];
			var frame_num = Math.floor( clip.start * framerate );
			var x = Math.floor( this.timeToX( frame_num / framerate) ) + 0.5;
			frame_num = Math.floor( (clip.start + clip.duration) * framerate );
			var x2 = Math.floor( this.timeToX( frame_num / framerate) ) + 0.5;
			var w = x2-x;

			if( x2 < 0 || x > this._canvas.width )
				continue;

			//background rect
			ctx.globalAlpha = track_alpha;
			ctx.fillStyle = clip.constructor.clip_color || "#333";
			ctx.fillRect(x,y,w,track_height);

			//draw clip content
			if( clip.drawTimeline )
			{
				ctx.save();
				ctx.translate(x,y);
				ctx.strokeStyle = "#AAA";
				ctx.fillStyle = "#AAA";
				clip.drawTimeline( ctx, x2-x,track_height, this.selected_clip == clip, this );
				ctx.restore();
			}
			//draw clip outline
			if(clip.hidden)
				ctx.globalAlpha = track_alpha * 0.5;
			
				var safex = Math.max(-2, x );
			var safex2 = Math.min( this._canvas.width + 2, x2 );
			ctx.lineWidth = 0.5;
			ctx.strokeStyle = clip.constructor.color || "black";
			ctx.strokeRect( safex, y, safex2-safex, track_height );
			ctx.globalAlpha = track_alpha;
			if(this.selected_clip == clip)
				selected_clip_area = [x,y,x2-x,track_height ]
		}
	}

	ctx.restore();
	
}
/**
 * Draws a rounded rectangle using the current state of the canvas.
 * If you omit the last three params, it will draw a rectangle
 * outline with a 5 pixel border radius
 * @param {Number} x The top left x coordinate
 * @param {Number} y The top left y coordinate
 * @param {Number} width The width of the rectangle
 * @param {Number} height The height of the rectangle
 * @param {Number} [radius = 5] The corner radius; It can also be an object 
 *                 to specify different radii for corners
 * @param {Number} [radius.tl = 0] Top left
 * @param {Number} [radius.tr = 0] Top right
 * @param {Number} [radius.br = 0] Bottom right
 * @param {Number} [radius.bl = 0] Bottom left
 * @param {Boolean} [fill = false] Whether to fill the rectangle.
 * @param {Boolean} [stroke = true] Whether to stroke the rectangle.
 */
 CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius, fill, stroke) {
	if (typeof stroke === 'undefined') {
	  stroke = true;
	}
	if (typeof radius === 'undefined') {
	  radius = 5;
	}
	if (typeof radius === 'number') {
	  radius = {tl: radius, tr: radius, br: radius, bl: radius};
	} else {
	  var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
	  for (var side in defaultRadius) {
		radius[side] = radius[side] || defaultRadius[side];
	  }
	}
	this.beginPath();
	this.moveTo(x + radius.tl, y);
	this.lineTo(x + width - radius.tr, y);
	this.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
	this.lineTo(x + width, y + height - radius.br);
	this.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
	this.lineTo(x + radius.bl, y + height);
	this.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
	this.lineTo(x, y + radius.tl);
	this.quadraticCurveTo(x, y, x + radius.tl, y);
	this.closePath();
	if (fill) {
	  this.fill();
	}
	if (stroke) {
	  this.stroke();
	}
  
  }

export { Timeline };