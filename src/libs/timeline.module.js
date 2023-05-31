import { UTILS, CompareThreshold, CompareThresholdRange } from '../utils.js';

// Agnostic timeline, do nos impose any timeline content
// It renders to a canvas

function Timeline( clip, boneName, timelineMode = "tracks" , position = [0,0], drawButtons = true) {

	this.name = null;
	this.currentTime = 0;
	this.framerate = 30;
	this.opacity = 0.8;
	this.sidebarWidth = 200;
	this.topMargin = 24;
	this.renderOutFrames = false;

	//do not change, it will be updated when called draw
	this.duration = 100;
	this.position = position;
	this.size = [300, 100];

	this.currentScroll = 0; //in percentage
	this.currentScrollInPixels = 0; //in pixels
	this.scrollableHeight = this.size[1]; //true height of the timeline content

	this._secondsToPixels = 100;
	this._pixelsToSeconds = 1 / this._secondsToPixels;
	this._canvas = null;
	this._grabTime = 0;
	this._startTime = 0;
	this._endTime = 1;

	this._lastMouse = [0,0];
	this._lastKeyFramesSelected = [];
	this._lastClipsSelected = [];
	this._trackState = [];
	this._tracksDrawn = [];
	this._buttonsDrawn = [];
	this._clipboard = null;

	this.clip = clip;
	this.selectedBone = boneName;
	this.snappedKeyFrameIndex = -1;
	this.autoKeyEnabled = false;
	
	this.trackHeight = 15;
	this.timelineMode = timelineMode;
	this.drawButtons = drawButtons;

	this.active = true;

	if(clip)
		this.processTracks();

	this.onDrawContent = ( ctx ) => {
		ctx.save();
		if(this.timelineMode == "tracks") {

			if(this.selectedBone == null || !this.tracksPerBone)
			return;
			
			let tracks = this.tracksPerBone[this.selectedBone] ? this.tracksPerBone[this.selectedBone] : [{name: this.selectedBone}];
			//if(!tracks) return;
			
			const height = this.trackHeight;
			for(let i = 0; i < tracks.length; i++) {
				let track = tracks[i];
				this.drawTrackWithKeyframes(ctx, (i+1) * height, height, track.name + " (" + track.type + ")", track, i);
			}
		}
		else if( this.timelineMode == "clips")
		{
			
			let tracks = this.clip.tracks|| [{name: "NMF", clips: []}];
			if(!tracks) return;
			
			const height = this.trackHeight*1.2;
			for(let i = 0; i < tracks.length; i++) {
				let track = tracks[i];
				this.drawTrackWithBoxes(ctx, (i+1) * height, height, track.name || "", track, i);
			}
		}
		ctx.restore();
		let offset = 25;
		ctx.fillStyle = 'white';
		if(this.name)
			ctx.fillText(this.name, 9 + ctx.measureText(this.name).actualBoundingBoxLeft + offset * this._buttonsDrawn.length, -this.topMargin*0.5 );
	};

	this.autoKeyButtonImg = document.createElement('img');
	this.autoKeyButtonImg.src = 'data/imgs/mini-icon-auto.png';
	this.optimizeButtonImg = document.createElement('img');
	this.optimizeButtonImg.src = 'data/imgs/mini-icon-optimize.png';
	this.unSelectAllKeyFramesImg = document.createElement('img');
	this.unSelectAllKeyFramesImg.src = 'data/imgs/close-icon.png';

	// Add button data
	let offset = 25;
	if(this.drawButtons && this.active)
	{

		this._buttonsDrawn.push( [this.autoKeyButtonImg, "autoKeyEnabled", 9, -this.topMargin + 1, 22, 22] );
		this._buttonsDrawn.push( [this.optimizeButtonImg, "optimize", 9 + offset * this._buttonsDrawn.length, -this.topMargin + 1, 22, 22, (e) => {
			this.onShowOptimizeMenu(e);
		}] );
		this._buttonsDrawn.push( [this.unSelectAllKeyFramesImg, "unselectAll", 9 + offset * this._buttonsDrawn.length, -this.topMargin + 1, 22, 22, (e) => {
			this.unSelectAllKeyFrames();
		}] );
	}
	
	
}

Timeline.prototype.onUpdateTracks = function ( keyType ) {
	
	if(this.selectedBone == null || this._lastKeyFramesSelected.length || !this.autoKeyEnabled)
	return;

	let tracks = this.tracksPerBone[this.selectedBone];
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
		this.onSetTime(this.currentTime);

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
		this.tracksPerBone[name][trackIndex].clipIdx = i;

		// Save index also in original track
		track.idx = trackIndex;
	}
}

Timeline.prototype.getNumTracks = function(bone) {
	if(!bone || !this.tracksPerBone)
		return;
	const tracks = this.tracksPerBone[bone.name];
	return tracks ? tracks.length : null;
}

Timeline.prototype.onShowOptimizeMenu = function(e) {
	
	let actions = [{ title: "Optimize", disabled: true }, null];

	if(this.selectedBone == null)
	return;

	let tracks = this.tracksPerBone[this.selectedBone];
	if(!tracks) return;

	const threshold = this.onGetOptimizeThreshold ? this.onGetOptimizeThreshold() : 0.025;

	for( let t of tracks ) {
		actions.push( {
			title: t.name+"@"+t.type,
			callback: () => { 
				this.clip.tracks[t.clipIdx].optimize( threshold );
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

Timeline.prototype.saveState = function(clipIdx) {

	const localIdx = this.clip.tracks[clipIdx].idx;
	const name = this.getTrackName(this.clip.tracks[clipIdx].name)[0];
	const trackInfo = this.tracksPerBone[name][localIdx];

	this._trackState.push({
		idx: clipIdx,
		t: this.clip.tracks[clipIdx].times.slice(),
		v: this.clip.tracks[clipIdx].values.slice(),
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

Timeline.prototype.selectKeyFrame = function ( track, selectionInfo, index ) {
	
	if(index == undefined || !track)
	return;

	this.unSelectAllKeyFrames();
						
	this._lastKeyFramesSelected.push( selectionInfo );
	track.selected[index] = true;

	if( this.onSetTime )
		this.onSetTime( this.clip.tracks[track.clipIdx].times[ index ] );
}

Timeline.prototype.canPasteKeyFrame = function () {
	return this._clipboard != null;
}

Timeline.prototype.copyKeyFrame = function ( track, index ) {

	// 1 element clipboard by now

	let values = [];
	let start = index * track.dim;
	for(let i = start; i < start + track.dim; ++i)
		values.push( this.clip.tracks[ track.clipIdx ].values[i] );

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
		this.clip.tracks[ track.clipIdx ].values[i] = clipboardInfo.values[j];
		++j;
	}

	if(this.onSetTime)
		this.onSetTime(this.currentTime);

	track.edited[ index ] = true;
}

Timeline.prototype.pasteKeyFrame = function ( e, track, index ) {

	this.saveState(track.clipIdx);

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
	const clipIdx = track.clipIdx;

	// Time slot with other key?
	const keyInCurrentSlot = this.clip.tracks[clipIdx].times.find( t => { return !CompareThreshold(this.currentTime, t, t, 0.001 ); });
	if( keyInCurrentSlot ) {
		console.warn("There is already a keyframe stored in time slot ", keyInCurrentSlot)
		return;
	}

	this.saveState(clipIdx);

	// Find new index
	let newIdx = this.clip.tracks[clipIdx].times.findIndex( t => t > this.currentTime );

	// Add as last index
	let lastIndex = false;
	if(newIdx < 0) {
		newIdx = this.clip.tracks[clipIdx].times.length;
		lastIndex = true;
	}

	// Add time key
	const timesArray = [];
	this.clip.tracks[clipIdx].times.forEach( (a, b) => {
		b == newIdx ? timesArray.push(this.currentTime, a) : timesArray.push(a);
	} );

	if(lastIndex) {
		timesArray.push(this.currentTime);			
	}

	this.clip.tracks[clipIdx].times = new Float32Array( timesArray );
	
	// Get mid values
	const bone = this.onGetSelectedBone();
	const lerpValue = bone[ track.type ].toArray();
	
	// Add values
	const valuesArray = [];
	this.clip.tracks[clipIdx].values.forEach( (a, b) => {
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

	this.clip.tracks[clipIdx].values = new Float32Array( valuesArray );

	// Move the other's key properties
	for(let i = (this.clip.tracks[clipIdx].times.length - 1); i > newIdx; --i) {
		track.edited[i - 1] ? track.edited[i] = track.edited[i - 1] : 0;
	}
	
	// Reset this key's properties
	track.hovered[newIdx] = undefined;
	track.selected[newIdx] = undefined;
	track.edited[newIdx] = undefined;

	// Update animation action interpolation info
	if(this.onUpdateTrack)
		this.onUpdateTrack( clipIdx );

	if(this.onSetTime)
		this.onSetTime(this.currentTime);

	return newIdx;
}
Timeline.prototype.setDuration = function (t) { this.duration = this.clip.duration = t; if( this.onSetDuration ) this.onSetDuration( t );	 }

Timeline.prototype.addTrackClip = function(){
	if(!this.clip)
		this.clip = {tracks:[]};

	let trackInfo = {
		idx: this.clip.tracks.length,
		clips: [],
		selected: [], edited: [], hovered: []
	};

	this.clip.tracks.push(trackInfo);
	return trackInfo.idx;
}

Timeline.prototype.addClip = function( clip, offsetTime = 0, callback = null) {

	// Update clip information
	let trackIdx = null;
	let newStart = this.currentTime + offsetTime
	clip.attackPeak += (newStart - clip.start);
	clip.relax += (newStart - clip.start);
	clip.start = newStart;
	// Time slot with other key?
	let keyInCurrentSlot = null;
	if(!this.clip) 
		this.addTrackClip();

	for(let i = 0; i < this.clip.tracks.length; i++) {
		keyInCurrentSlot = this.clip.tracks[i].clips.find( t => { 
			return CompareThresholdRange(this.currentTime, clip.start + clip.duration, t.start, t.start+t.duration);
			
		 });
		if(!keyInCurrentSlot)
		{
			trackIdx = i;
			break;
		}
		console.warn("There is already a keyframe stored in time slot ", keyInCurrentSlot)
	}
	if(trackIdx == undefined)
	{
		// clipIdx = this.clip.tracks.length;
		// this.clip.tracks.push({clipIdx: clipIdx, clips: []} );
		trackIdx = this.addTrackClip();
	}
	//this.saveState(clipIdx);

	// Find new index
	let newIdx = this.clip.tracks[trackIdx].clips.findIndex( t => t.start > this.currentTime );

	// Add as last index
	let lastIndex = false;
	if(newIdx < 0) {
		newIdx = this.clip.tracks[trackIdx].clips.length;
		lastIndex = true;
	}

	// Add clip
	const clipsArray = [];
	this.clip.tracks[trackIdx].clips.forEach( (a, b) => {
		b == newIdx ? clipsArray.push(clip, a) : clipsArray.push(a);
	} );

	if(lastIndex) {
		clipsArray.push(clip);			
	}

	this.clip.tracks[trackIdx].clips = clipsArray;	
	// Move the other's key properties
	let track = this.clip.tracks[trackIdx];
	for(let i = (track.clips.length - 1); i > newIdx; --i) {
		track.edited[i - 1] ? track.edited[i] = track.edited[i - 1] : 0;
	}
	
	// Reset this key's properties
	track.hovered[newIdx] = undefined;
	track.selected[newIdx] = undefined;
	track.edited[newIdx] = undefined;

	// // Update animation action interpolation info
	if(this.onUpdateTrack)
		this.onUpdateTrack( trackIdx );

	if(this.onSetTime)
		this.onSetTime(this.currentTime);
		
	let end = clip.start + clip.duration;
	
	if( end > this.duration)
		this.setDuration(end);

	// if(callback)
	// 	callback();
	return newIdx;
}
Timeline.prototype.deleteClip = function (clip, callback) {

	let index = -1;
	// Key pressed
	if(!clip && this.selectedClip) {
		clip = this.selectedClip;
	}
	
	// for(let i = 0; i < this.clip.tracks.length; i++){
	// 	let clips = this.clip.tracks[i].clips;
	// 	index =  clips.findIndex( t => t == clip );
	// 	if(index >= 0)
	// 	{
	// 		clips = [...clips.slice(0, index), ...clips.slice(index + 1, clips.length)]
	// 		this.clip.tracks[i].clips = clips;
	// 		if(callback)
	// 			callback();

	// 		return;
	// 	}
	// }
	let [trackIdx, clipIdx] = clip;
	let clips = this.clip.tracks[trackIdx].clips;
	if(clipIdx >= 0)
	{
		clips = [...clips.slice(0, clipIdx), ...clips.slice(clipIdx + 1, clips.length)];
		this.clip.tracks[trackIdx].clips = clips;
		if(clips.length)
		{
			let selectedIdx = 0;
			for(let i = 0; i < this._lastClipsSelected.length; i++)
			{
				let [t,c] = this._lastClipsSelected[i];
			
				if( t == trackIdx  && c > clipIdx)
					this._lastClipsSelected[i][1] = c - 1;
				if(t == trackIdx && c == clipIdx)
					selectedIdx = i;
			}
			this._lastClipsSelected = [...this._lastClipsSelected.slice(0, selectedIdx), ...this._lastClipsSelected.slice(selectedIdx + 1, this._lastClipsSelected.length)];
		 }
		if(callback)
			callback();
	}
	this.selectedClip = null;
	//this.unSelectAllClips();
	// // Update animation action interpolation info

}

Timeline.prototype._delete = function( track, index ) {

	// Don't remove by now the first key
	if(index == 0) {
		console.warn("Operation not supported! [remove first keyframe track]");
		return;
	}

	// Update clip information
	const clipIdx = track.clipIdx;

	// Don't remove by now the last key
	// if(index == this.clip.tracks[clipIdx].times.length - 1) {
	// 	console.warn("Operation not supported! [remove last keyframe track]");
	// 	return;
	// }

	// Reset this key's properties
	track.hovered[index] = undefined;
	track.selected[index] = undefined;
	track.edited[index] = undefined;

	// Delete time key
	this.clip.tracks[clipIdx].times = this.clip.tracks[clipIdx].times.filter( (v, i) => i != index);

	// Delete values
	const indexDim = track.dim * index;
	const slice1 = this.clip.tracks[clipIdx].values.slice(0, indexDim);
	const slice2 = this.clip.tracks[clipIdx].values.slice(indexDim + track.dim);

	this.clip.tracks[clipIdx].values = UTILS.concatTypedArray([slice1, slice2], Float32Array);

	// Move the other's key properties
	for(let i = index; i < this.clip.tracks[clipIdx].times.length; ++i) {
		track.edited[i] = track.edited[i + 1];
	}

	// Update animation action interpolation info
	if(this.onUpdateTrack)
		this.onUpdateTrack( clipIdx );
}

Timeline.prototype.optimizeTracks = function () {
	
	let tracks = [];
	for(let i = 0; i < this.clip.tracks.length; i++)
	{
		if(this.clip.tracks[i].clips.length) {
			this.clip.tracks[i].idx = tracks.length;
			for(let j = 0; j < this.clip.tracks[i].clips.length; j++)
			{
				this.clip.tracks[i].clips[j].trackIdx = tracks.length;
			}
			let selectedIdx = 0;
			for(let l = 0; l < this._lastClipsSelected.length; l++)
			{
				let [t,c] = this._lastClipsSelected[l];
			
				if(t > i)
					this._lastClipsSelected[l][1] = t - 1;
				if(t == i)
					selectedIdx = l;
			}
			this._lastClipsSelected = [...this._lastClipsSelected.slice(0, selectedIdx), ...this._lastClipsSelected.slice(selectedIdx + 1, this._lastClipsSelected.length)];
			tracks.push(this.clip.tracks[i]);
		}			
	}
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
			this.saveState(track.clipIdx);
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
		this.selectedBone = null;
		if(this.onBoneUnselected)
			this.onBoneUnselected();
	}
}

Timeline.prototype.setSelectedBone = function ( boneName ) {

	if(boneName.constructor !== String)
	throw("Bone name has to be a string!");

	this.selectedBone = boneName;
	this.unSelectAllKeyFrames();
}

// Converts distance in pixels to time
Timeline.prototype.xToTime = function (x, global) {
	if (global)
		x -= this.position[0];
	var v = (x - this.size[0] * 0.5) * this._pixelsToSeconds + this.currentTime;
	return v;
}

// Converts time to disance in pixels
Timeline.prototype.timeToX = function (t, framerate, global) {
	if (framerate)
		t = Math.round(t * framerate) / framerate;
	var x = (t - this.currentTime) * this._secondsToPixels + this.size[0] * 0.5;
	if (global)
		x += this.position[0];
	return x;
}

Timeline.prototype.getCurrentFrame = function (framerate) {
	return Math.floor(this.currentTime * framerate);
}

Timeline.prototype.getTrack = function(trackInfo)  {
	const [name, trackIndex] = trackInfo;
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

	for(let i = this._tracksDrawn.length - 1; i >= 0; --i) {
		let t = this._tracksDrawn[i];
		let pos = t[1] - this.topMargin, size = t[2];
		if( pos + threshold >= minY && (pos + size - threshold) <= maxY ) {
			tracks.push( t[0] );
		}
	}

	return tracks;
}


Timeline.prototype.getTrackName = function (uglyName) {

	let name, type;

	// Support other versions
	if(uglyName.includes("[")) {
		const nameIndex = uglyName.indexOf('['),
			trackNameInfo = uglyName.substr(nameIndex+1).split("].");
		name = trackNameInfo[0];
		type = trackNameInfo[1];
	}else {
		const trackNameInfo = uglyName.split(".");
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
	this._secondsToPixels = v;
	if (this._secondsToPixels > 3000)
		this._secondsToPixels = 3000;
	this._pixelsToSeconds = 1 / this._secondsToPixels;
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

Timeline.prototype.processCurrentKeyFrame = function (e, keyFrameIndex, track, localX, multiple) {

	e.multipleSelection = multiple;
	keyFrameIndex = keyFrameIndex ?? this.getCurrentKeyFrame( track, this.xToTime( localX ), this._pixelsToSeconds * 5 );

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

Timeline.prototype.getCurrentClip = function( track, time, threshold )
{
	if(!track || !track.clips.length)
	return;

	// Avoid iterating through all timestamps
	if((time + threshold) < track.clips[0])
	return;

	for(let i = 0; i < track.clips.length; ++i) {
		let t = track.clips[i];
		if(t.start + t.duration >= (time - threshold) && 
			t.start <= (time + threshold)) {
			return i;
		}
	}

	return;
};

Timeline.prototype.unSelectAllClips = function() {
	for(let [ idx, keyIndex] of this._lastClipsSelected) {
		this.clip.tracks[idx].selected[keyIndex]= false;
	}
	// Something has been unselected
	const unselected = this._lastClipsSelected.length > 0;
	this._lastClipsSelected.length = 0;
	this.selectedClip = false;
	return unselected;
}

Timeline.prototype.processCurrentClip = function (e, clipIndex, track, localX, multiple) {

	e.multipleSelection = multiple;
	clipIndex = clipIndex ?? this.getCurrentClip( track, this.xToTime( localX ), this._pixelsToSeconds * 5 );

	if(!multiple && e.button != 2) {
		this.unSelectAllClips();
	}
					
	if(clipIndex == undefined)
		return;

	let currentSelection = [ track.idx, clipIndex];
	// Select if not handled
	this._lastClipsSelected.push( currentSelection );
	track.selected[clipIndex] = true;

	// if( !multiple && this.onSetTime )
	// 	this.onSetTime( track.clips[ clipIndex ] );

	if( this.onSelectClip && this.onSelectClip(track.clips[ clipIndex ])) {
		// Event handled
		return;
	}
	

}

Timeline.prototype.getClipsInRange = function (track, minTime, maxTime, threshold) {

	if(!track || !track.clips.length)
	return;

	// Manage negative selection
	if(minTime > maxTime) {
		let aux = minTime;
		minTime = maxTime;
		maxTime = aux;
	}

	// Avoid iterating through all timestamps
	
	if((maxTime + threshold) < track.clips[0].start)
		return;

	let indices = [];

	for(let i = 0; i < track.clips.length; ++i) {
		let t = track.clips[i];
		if((t.start + t.duration <= (maxTime + threshold) || t.start <= (maxTime + threshold)) &&
			(t.start + t.duration >= (minTime - threshold) || t.start >= (minTime - threshold)) ) 
		{
			indices.push(i);
		}
	}

	return indices;
}

Timeline.prototype.processMouse = function (e) {
	if(!this._canvas)
		return;

	var w = this.size[0];

	// Process mouse
	var x = e.offsetX;
	var y = e.offsetY;
	e.deltax = x - this._lastMouse[0];
	e.deltay = y - this._lastMouse[1];
	var localX = e.offsetX - this.position[0];
	var localY = e.offsetY - this.position[1];
	this._lastMouse[0] = x;
	this._lastMouse[1] = y;
	var timelineHeight = this.size[1];

	var time = this.xToTime(x, true);

	var is_inside = x >= this.position[0] && x <= (this.position[0] + this.size[0]) &&
					y >= this.position[1] && y <= (this.position[1] + this.size[1]);

	var track = null;
	for(var i = this._tracksDrawn.length - 1; i >= 0; --i)
	{
		var t = this._tracksDrawn[i];
		if( localY >= t[1] && localY < (t[1] + t[2]) )
		{
			track = t[0];
			break;
		}
	}

	e.track = track;

	const innerSetTime = (t) => { if( this.onSetTime ) this.onSetTime( t );	 }

	if( e.type == "mouseup" )
	{
		const discard = this._movingKeys || (UTILS.getTime() - this._clickTime) > 420; // ms
		this._movingKeys ? innerSetTime( this.currentTime ) : 0;
		if(this._grabbing && this.timelineMode == "clips"){
			if(this.onClipMoved) this.onClipMoved();
		}
		this._grabbing = false;
		this._grabbingScroll = false;
		this._movingKeys = false;
		this._timeBeforeMove = null;

		if(e.shiftKey) {

			// Multiple selection
			if(!discard && track) {
				if(this.timelineMode == "tracks")
					this.processCurrentKeyFrame( e, null, track, localX, true );
				else 
					this.processCurrentClip( e, null, track, localX, true );
			}
			// Box selection
			else{
				if(this.timelineMode == "tracks"){

					this.unSelectAllKeyFrames();
					
					let tracks = this.getTracksInRange(this.boxSelectionStart[1], this.boxSelectionEnd[1], this._pixelsToSeconds * 5);
					
					for(let t of tracks) {
						let keyFrameIndices = this.getKeyFramesInRange(t, 
							this.xToTime( this.boxSelectionStart[0] ), 
							this.xToTime( this.boxSelectionEnd[0] ),
							this._pixelsToSeconds * 5);
							
						if(keyFrameIndices) {
						for(let index of keyFrameIndices)
							this.processCurrentKeyFrame( e, index, t, null, true );
						}
					}
				}
				else{
					let tracks = this.getTracksInRange(this.boxSelectionStart[1], this.boxSelectionEnd[1], this._pixelsToSeconds * 5);
					
					for(let t of tracks) {
						let clipsIndices = this.getClipsInRange(t, 
							this.xToTime( this.boxSelectionStart[0] ), 
							this.xToTime( this.boxSelectionEnd[0] ),
							this._pixelsToSeconds * 5);
							
						if(clipsIndices) {
						for(let index of clipsIndices)
							this.processCurrentClip( e, index, t, null, true );
						}
					}
				}
			}

		}else {
			let boundingBox = this._canvas.getBoundingClientRect()
			if(e.y < boundingBox.top || e.y > boundingBox.bottom)
				return;
			// Check exact track keyframe
			if(!discard && track) {
				if(this.timelineMode == "tracks")
					this.processCurrentKeyFrame( e, null, track, localX );
				else if(e.button!=2){
					this.processCurrentClip( e, null, track, localX );
					// let clipIdx = this.getCurrentClip(track, this.xToTime( localX ), this._pixelsToSeconds * 5 ); //this.processCurrentClip( e, null, track, localX );
					// if(clipIdx!=undefined)
					// {
					// 	track.clips[clipIdx].selected = true;
					// 	this.selectedClip = track.clips[clipIdx];
					// 	if(this.selectedClip != undefined && this.onSelectClip) {
					// 		this.onSelectClip(this.selectedClip);
					// 	}
					// }
				}
			} else if(this.drawButtons){
				y -= this.topMargin;
				for( const b of this._buttonsDrawn ) {
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
		this._clickTime = UTILS.getTime();

		if(this._trackBulletCallback && e.track)
			this._trackBulletCallback(e.track,e,this,[localX,localY]);

		if( timelineHeight < this.scrollableHeight && x > w - 10)
		{
			this._grabbingScroll = true;
		}
		else
		{
			this._grabbing = true;
			this._grabTime = time - this.currentTime;

			if(e.shiftKey) {
				this.boxSelection = true;
				this.boxSelectionStart = [localX,localY - 20];
			}else if(e.ctrlKey && track) {
				if(this.timelineMode == "tracks")
				{

					const keyFrameIndex = this.getCurrentKeyFrame( track, this.xToTime( localX ), this._pixelsToSeconds * 5 );
					if( keyFrameIndex != undefined ) {
						this.processCurrentKeyFrame( e, keyFrameIndex, track, null, true ); // Settings this as multiple so time is not being set
						this._movingKeys = true;
						
						// Set pre-move state
						for(let selectedKey of this._lastKeyFramesSelected) {
							let [name, idx, keyIndex] = selectedKey;
							track = this.tracksPerBone[name][idx];
							selectedKey[3] = this.clip.tracks[ track.clipIdx ].times[ keyIndex ];
						}
						
						this._timeBeforeMove = track.times[ keyFrameIndex ];
					}
				}
				else{
					let trackIndex = track.idx;
					let clipIndex = null;
					let selectedClips = [];
					if(this._lastClipsSelected.length){
						selectedClips = this._lastClipsSelected;
					}
					// else{
					// 	clipIndex = this.getCurrentClip( track, this.xToTime( localX ), this._pixelsToSeconds * 5 );
					// 	if(clipIndex != undefined)
					// 	{
					// 		selectedClips = [[trackIndex, clipIndex]];
					// 	}
					
					// }
					
					for(let i = 0; i< selectedClips.length; i++)
					{
						this._movingKeys = false
						let [trackIndex, clipIndex] = selectedClips[i];
						var clip = this.clip.tracks[trackIndex].clips[clipIndex];
						if(!this.timelineClickedClips)
							this.timelineClickedClips  = [];
						this.timelineClickedClips.push(clip);
						if(!this.timelineClickedClipsTime)
							this.timelineClickedClipsTime  = [];
						this.timelineClickedClipsTime.push(this.xToTime( localX ));
						var endingX = this.timeToX( clip.start + clip.duration );
						var distToStart = Math.abs( this.timeToX( clip.start ) - x );
						var distToEnd = Math.abs( this.timeToX( clip.start + clip.duration ) - e.offsetX );
						if(this.duration < clip.start + clip.duration  )
							this.setDuration(clip.start + clip.duration);
						//this.addUndoStep( "clip_modified", clip );
						if( (e.shiftKey && distToStart < 5) || (clip.fadein && Math.abs( this.timeToX( clip.start + clip.fadein ) - e.offsetX ) < 5) )
							this.dragClipMode = "fadein";
						else if( (e.shiftKey && distToEnd < 5) || (clip.fadeout && Math.abs( this.timeToX( clip.start + clip.duration - clip.fadeout ) - e.offsetX ) < 5) )
							this.dragClipMode = "fadeout";
						else if( Math.abs( endingX - x ) < 10 )
							this.dragClipMode = "duration";
						else
							this.dragClipMode = "move";
					}
					
					
					// if(clipIndex != undefined &&  (this.selectedClip == track.clips[clipIndex] || track.selected[clipIndex])) //modifying clip
					// {
					// 	this._movingKeys = false
					// 	var clip = track.clips[clipIndex];
					// 	this.timeline_clicked_clip = clip;
					// 	this.timeline_clicked_clipTime = this.xToTime( localX );
					// 	var endingX = this.timeToX( clip.start + clip.duration );
					// 	var distToStart = Math.abs( this.timeToX( clip.start ) - x );
					// 	var distToEnd = Math.abs( this.timeToX( clip.start + clip.duration ) - e.offsetX );
					// 	if(this.duration < clip.start + clip.duration  )
					// 		this.setDuration(clip.start + clip.duration);
					// 	//this.addUndoStep( "clip_modified", clip );
					// 	if( (e.shiftKey && distToStart < 5) || (clip.fadein && Math.abs( this.timeToX( clip.start + clip.fadein ) - e.offsetX ) < 5) )
					// 		this.dragClipMode = "fadein";
					// 	else if( (e.shiftKey && distToEnd < 5) || (clip.fadeout && Math.abs( this.timeToX( clip.start + clip.duration - clip.fadeout ) - e.offsetX ) < 5) )
					// 		this.dragClipMode = "fadeout";
					// 	else if( Math.abs( endingX - x ) < 10 )
					// 		this.dragClipMode = "duration";
					// 	else
					// 		this.dragClipMode = "move";
					// }
				}

			}else if(!track) {
				y -= this.topMargin;
				for( const b of this._buttonsDrawn ) {
					const bActive = x >= b[2] && x <= (b[2] + b[4]) && y >= b[3] && y <= (b[3] + b[5]);
					b.pressed = bActive;
				}
				if(this.timelineMode == "clips") {
					if( this.timelineClickedClips )
					{
						for(let i = 0; i < this.timelineClickedClips.length; i++){

							if( this.timelineClickedClips[i].fadein && this.timelineClickedClips[i].fadein < 0 )
								this.timelineClickedClips[i].fadein = 0;
							if( this.timelineClickedClips[i].fadeout && this.timelineClickedClips[i].fadeout < 0 )
								this.timelineClickedClips[i].fadeout = 0;
						}
					}
					this.timelineClickedClips = null;
					this.selectedClip = null;
					this.unSelectAllClips();
					this.onSelectClip(null);
				}
			}
		}
	}
	else if( e.type == "mousemove" )
	{
		// Manage keyframe movement
		if(this._movingKeys) {

			this.clearState();
			const newTime = this.xToTime( localX );
			
			for(let [name, idx, keyIndex, keyTime] of this._lastKeyFramesSelected) {
				track = this.tracksPerBone[name][idx];
				const delta = this._timeBeforeMove - keyTime;
				this.clip.tracks[ track.clipIdx ].times[ keyIndex ] = Math.min( this.clip.duration, Math.max(0, newTime - delta) );
			}

			return;
		}

		if(e.shiftKey) {
			if(this.boxSelection) {
				this.boxSelectionEnd = [localX,localY - 20];
				return; // Handled
			}
		}

		const removeHover = () => {
			if(this.lastHovered)
				this.tracksPerBone[ this.lastHovered[0] ][ this.lastHovered[1] ].hovered[ this.lastHovered[2] ] = undefined;
		};

		if( this._grabbing && e.button != 2)
		{
			var curr = time - this.currentTime;
			var delta = curr - this._grabTime;
			this._grabTime = curr;
			this.currentTime = Math.max(0,this.currentTime - delta);

			// fix this
			if(this.timelineMode == "tracks"){
				if(e.shiftKey && track) {

					let keyFrameIndex = this.getNearestKeyFrame( track, this.currentTime);
					
					if(keyFrameIndex != this.snappedKeyFrameIndex){
						this.snappedKeyFrameIndex = keyFrameIndex;
						this.currentTime = track.times[ keyFrameIndex ];		
						innerSetTime( this.currentTime );		
					}
				}
				else{
					innerSetTime( this.currentTime );	
				}
			}else if( this.timelineClickedClips != undefined)
			{
				for(let i = 0; i < this.timelineClickedClips.length; i++){
					
					var clip = this.timelineClickedClips[i] ;
					var diff = delta;//this.currentTime - this.timelineClickedClipsTime[i];//delta;
					if( this.dragClipMode == "move" ) {
						clip.start += diff;
						clip.attackPeak += diff;
						clip.relax += diff;
					}
					else if( this.dragClipMode == "fadein" )
						clip.fadein = (clip.fadein || 0) + diff;
					else if( this.dragClipMode == "fadeout" )
						clip.fadeout = (clip.fadeout || 0) - diff;
					else if( this.dragClipMode == "duration" )
						clip.duration += diff;
					this.clipTime = this.currentTime;
					if(this.duration < clip.start + clip.duration  )
						this.setDuration(clip.start + clip.duration);
				}
				return true;
			}
			else{
				innerSetTime( this.currentTime );	
			}
				
		}else if(track) {

			if(this.timelineMode == "tracks")
			{
				let keyFrameIndex = this.getCurrentKeyFrame( track, this.xToTime( localX ), this._pixelsToSeconds * 5 );
				if(keyFrameIndex != undefined) {
					
					const [name, type] = this.getTrackName(track.name);
					let t = this.tracksPerBone[ name ][track.idx];
	
					removeHover();
						
					this.lastHovered = [name, track.idx, keyFrameIndex];
					t.hovered[keyFrameIndex] = true;
	
				}else {
					removeHover();
				}
			}
			// else if( this.timeline_clicked_clip != undefined)
			// {
			// 	var clip = this.timeline_clicked_clip;
			// 	var diff = this.currentTime - this.timeline_clicked_clipTime;
			// 	if( this.dragClipMode == "move" )
			// 		clip.start += diff;
			// 	else if( this.dragClipMode == "fadein" )
			// 		clip.fadein = (clip.fadein || 0) + diff;
			// 	else if( this.dragClipMode == "fadeout" )
			// 		clip.fadeout = (clip.fadeout || 0) - diff;
			// 	else if( this.dragClipMode == "duration" )
			// 		clip.duration += diff;
			// 	this.clipTime = this.currentTime;
			// 	return true;
			// }
	
		}else {
			removeHover();
		}
	}
	else if( e.type == "wheel" )
	{
		if( timelineHeight < this.scrollableHeight && x > w - 10)
		{
			this.currentScroll = Math.clamp( this.currentScroll + (e.wheelDelta < 0 ? 0.1 : -0.1), 0, 1);
		}
		else
		{
			this.setScale( this._secondsToPixels * (e.wheelDelta < 0 ? 0.9 : (1/0.9)) );
		}
	}
	else if (e.type == "dblclick" && this.timelineMode == "clips") {
		let clipIndex = this.getCurrentClip( track, this.xToTime( localX ), this._pixelsToSeconds * 5 );
		if(clipIndex != undefined)  {
			this._lastClipsSelected = [track.idx, clipIndex];

			if( this.onSelectClip ) 
				this.onSelectClip(track.clips[clipIndex]);
		}
		
	}
	this._canvas.style.cursor = this._grabbing && (UTILS.getTime() - this._clickTime > 320) ? "grabbing" : "pointer" ;

	return true;
};

Timeline.prototype.draw = function (ctx, currentTime, rect) {

	if(!rect)
		rect = [0, ctx.canvas.height - 150, ctx.canvas.width, 150 ];

	this._canvas = ctx.canvas;
	this.position[0] = rect[0];
	this.position[1] = rect[1];
	var w = this.size[0] = rect[2];
	var h = this.size[1] = rect[3];
	var P2S = this._pixelsToSeconds;
	var S2P = this._secondsToPixels;
	var timelineHeight = this.size[1];

	this.currentTime = currentTime;
	if(this.clip)
		this.duration = this.clip.duration;
	var duration = this.duration;
	this.currentScrollInPixels = this.scrollableHeight <= h ? 0 : (this.currentScroll * (this.scrollableHeight - timelineHeight));

	ctx.save();
	ctx.translate( this.position[0], this.position[1] + this.topMargin ); //20 is the top margin area

	//background
	ctx.clearRect(0,-this.topMargin,w,h+this.topMargin);
	ctx.fillStyle = "#161c21";// "#000";
	//ctx.globalAlpha = 0.65;
	ctx.fillRect(0,-this.topMargin,w,this.topMargin);
	ctx.fillStyle = "#1a2025";// "#000";
	ctx.globalAlpha = 0.75;
	ctx.fillRect(0,0,w,h);
	ctx.globalAlpha = 1;

	//buttons
	for( const b of this._buttonsDrawn ) {
		const boundProperty = b[1];
		ctx.fillStyle = this[ boundProperty ] ? "#b66" : "#454545";	
		if(b.pressed) ctx.fillStyle = "#eee";
		ctx.roundRect(b[2], b[3], b[4], b[5], 5, true, false);
		ctx.drawImage(b[0], b[2] + 2, b[3] + 2, b[4] - 4, b[5] - 4);
	}

	//seconds markers
	var secondsFullWindow = (w * P2S); //how many seconds fit in the current window
	var secondsHalfWindow = secondsFullWindow * 0.5;

	//time in the left side (current time is always in the middle)
	var timeStart = currentTime - secondsHalfWindow;
	//time in the right side
	var timeEnd = currentTime + secondsHalfWindow;

	this._startTime = timeStart;
	this._endTime = timeEnd;

	var sidebar = this.sidebarWidth;
	this._lastRef = null; //used while rendering tracks

	//this ones are limited to the true timeline (not the visible area)
	var start = Math.ceil( Math.max(0,timeStart) );
	var end = Math.floor( Math.min(duration,timeEnd) + 0.01 );
	
	// Calls using as 0,0 the top-left of the tracks area (not the top-left of the timeline but 20 pixels below)
	this._tracksDrawn.length = 0;

	// Frame lines
	if(S2P > 200)
	{
		ctx.strokeStyle = "#444";
		ctx.globalAlpha = 0.4;
		ctx.beginPath();

		let start = timeStart;
		let end = timeEnd;
		
		if(!this.renderOutFrames) {
			start = 0;
			end = duration;
		}
		
		var pixelsPerFrame = S2P / this.framerate;
		var x = pixelsPerFrame + Math.round( this.timeToX( Math.floor(start * this.framerate) / this.framerate));
		var numFrames = (end - start ) * this.framerate - 1;
		for(var i = 0; i < numFrames; ++i)
		{
			ctx.moveTo( Math.round(x) + 0.5, 0);
			ctx.lineTo( Math.round(x) + 0.5, 10);
			x += pixelsPerFrame;
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
	ctx.moveTo( Math.max(sidebar, this.timeToX( Math.max(0,timeStart) ) ), 0.5);
	ctx.lineTo( Math.min(w, this.timeToX( Math.min(duration,timeEnd) ) ), 0.5);
	ctx.moveTo( Math.max(sidebar, this.timeToX( Math.max(0,timeStart) ) ), 1.5);
	ctx.lineTo( Math.min(w, this.timeToX( Math.min(duration,timeEnd) ) ), 1.5);
	var deltaSeconds = 1;
	if( this._secondsToPixels < 50)
		deltaSeconds = 10;
	ctx.stroke();
	
	// Numbers
	ctx.fillStyle = "#FFF";
	ctx.font = "12px Tahoma";
	ctx.textAlign = "center";
	for(var t = start; t <= end; t += 1 )
	{
		if( t % deltaSeconds != 0 )
			continue;
		ctx.globalAlpha = t % 10 == 0 ? 0.5 : Math.clamp( (this._secondsToPixels - 50) * 0.01,0,0.7);
		// if(Math.abs(t - currentTime) < 0.05)
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
	ctx.fillText(String(currentTime.toFixed(3)), x, -5);

	// Selections
	if(this.boxSelection && this.boxSelectionStart && this.boxSelectionEnd) {
		ctx.globalAlpha = 0.5;
		ctx.fillStyle = "#AAA";
		ctx.strokeRect( this.boxSelectionStart[0], this.boxSelectionStart[1], this.boxSelectionEnd[0] - this.boxSelectionStart[0], this.boxSelectionEnd[1] - this.boxSelectionStart[1]);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	if(this.onDrawContent)
		this.onDrawContent( ctx, timeStart, timeEnd, this );

	ctx.restore();
}

Timeline.prototype.drawMarkers = function (ctx, markers) {
	//render markers
	ctx.fillStyle = "white";
	ctx.textAlign = "left";
	var markersPos = [];
	for (var i = 0; i < markers.length; ++i) {
		var marker = markers[i];
		if (marker.time < this._startTime - this._pixelsToSeconds * 100 ||
			marker.time > this._endTime)
			continue;
		var x = this.timeToX(marker.time);
		markersPos.push(x);
		ctx.save();
		ctx.translate(x, 0);
		ctx.rotate(Math.PI * -0.25);
		ctx.fillText(marker.title, 20, 4);
		ctx.restore();
	}

	if (markersPos.length) {
		ctx.beginPath();
		for (var i = 0; i < markersPos.length; ++i) {
			ctx.moveTo(markersPos[i] - 5, 0);
			ctx.lineTo(markersPos[i], -5);
			ctx.lineTo(markersPos[i] + 5, 0);
			ctx.lineTo(markersPos[i], 5);
			ctx.lineTo(markersPos[i] - 5, 0);
		}
		ctx.fill();
	}
}

//helper function, you can call it from onDrawContent to render all the keyframes
Timeline.prototype.drawTrackWithKeyframes = function (ctx, y, trackHeight, title, track, trackIndex) {
	
	if(track.enabled === false)
		ctx.globalAlpha = 0.4;

	this._tracksDrawn.push([this.clip.tracks[track.clipIdx],y+this.topMargin,trackHeight]);

	ctx.font = Math.floor( trackHeight * 0.8) + "px Arial";
	ctx.textAlign = "left";
	ctx.fillStyle = "rgba(255,255,255,0.8)";

	if(title != null)
	{
		// var info = ctx.measureText( title );
		ctx.fillStyle = this.active ? "rgba(255,255,255,0.9)" : "rgba(250,250,250,0.7)";
		ctx.fillText( title, 25, y + trackHeight * 0.75 );
	}

	ctx.fillStyle = "rgba(10,200,200,1)";
	var keyframes = track.clipIdx != undefined ? this.clip.tracks[track.clipIdx].times : null;

	if(keyframes) {
		
		for(var j = 0; j < keyframes.length; ++j)
		{
			let time = keyframes[j];
			let selected = track.selected[j];
			if( time < this._startTime || time > this._endTime )
				continue;
			var keyframePosX = this.timeToX( time );
			if( keyframePosX > this.sidebarWidth ){
				ctx.save();

				let margin = 0;
				let size = trackHeight * 0.4;
				if(track.edited[j])
					ctx.fillStyle = "rgba(255,0,255,1)";
				if(selected) {
					ctx.fillStyle = "rgba(250,250,20,1)";
					size = trackHeight * 0.5;
					margin = -2;
				}
				if(track.hovered[j]) {
					size = trackHeight * 0.5;
					ctx.fillStyle = "rgba(250,250,250,0.7)";
					margin = -2;
				}
				if(!this.active)
					ctx.fillStyle = "rgba(250,250,250,0.7)";
					
				ctx.translate(keyframePosX, y + size * 2 + margin);
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

Timeline.prototype.drawTrackWithBoxes = function (ctx, y, trackHeight, title, track, trackIndex)
{

	trackHeight *= 0.8;
	let selectedClipArea = null;
	if(track.enabled === false)
		ctx.globalAlpha = 0.4;
	this._tracksDrawn.push([this.clip.tracks[track.idx],y+this.topMargin,trackHeight]);
	this._canvas = this._canvas || ctx.canvas;
	ctx.font = Math.floor( trackHeight * 0.8) + "px Arial";
	ctx.textAlign = "left";
	ctx.fillStyle = "rgba(255,255,255,0.8)";

	if(title != null)
	{
		// var info = ctx.measureText( title );
		ctx.fillStyle = "rgba(255,255,255,0.9)";
		ctx.fillText( title, 25, y + trackHeight * 0.8 );
	}

	ctx.fillStyle = "rgba(10,200,200,1)";
	var clips = this.clip.tracks[track.idx].clips;
	let trackAlpha = 1;
	if(clips) {
		// A utility function to draw a rectangle with rounded corners.

		function roundedRect(ctx, x, y, width, height, radius, fill = true) {
			ctx.beginPath();
			ctx.moveTo(x, y + radius);
			ctx.arcTo(x, y + height, x + radius, y + height, radius);
			ctx.arcTo(x + width, y + height, x + width, y + height - radius, radius);
			ctx.arcTo(x + width, y, x + width - radius, y, radius);
			ctx.arcTo(x, y, x, y + radius, radius);
			if(fill)
				ctx.fill();
			else
				ctx.stroke();
		}
		for(var j = 0; j < clips.length; ++j)
		{
			let clip = clips[j];
			let framerate = this.framerate;
			//let selected = track.selected[j];
			var frameNum = Math.floor( clip.start * framerate );
			var x = Math.floor( this.timeToX( frameNum / framerate) ) + 0.5;
			frameNum = Math.floor( (clip.start + clip.duration) * framerate );
			var x2 = Math.floor( this.timeToX( frameNum / framerate) ) + 0.5;
			var w = x2-x;

			if( x2 < 0 || x > this._canvas.width )
				continue;

			//background rect
			ctx.globalAlpha = trackAlpha;
			ctx.fillStyle = clip.clipColor || "#333";
			//ctx.fillRect(x,y,w,trackHeight);
			roundedRect(ctx, x, y, w, trackHeight, 5, true);

			//draw clip content
			if( clip.drawTimeline )
			{
				ctx.save();
				ctx.translate(x,y);
				ctx.strokeStyle = "#AAA";
				ctx.fillStyle = "#AAA";
				clip.drawTimeline( ctx, x2-x,trackHeight, this.selectedClip == clip || track.selected[j], this );
				ctx.restore();
			}
			//draw clip outline
			if(clip.hidden)
				ctx.globalAlpha = trackAlpha * 0.5;
			
				var safex = Math.max(-2, x );
			var safex2 = Math.min( this._canvas.width + 2, x2 );
			// ctx.lineWidth = 0.5;
			// ctx.strokeStyle = clip.constructor.color || "black";
			// ctx.strokeRect( safex, y, safex2-safex, trackHeight );
			ctx.globalAlpha = trackAlpha;
			if(this.selectedClip == clip || track.selected[j])
				selectedClipArea = [x,y,x2-x,trackHeight ]
			//render clip selection area
			if(selectedClipArea)
			{
				ctx.strokeStyle = track.clips[j].clipColor;
				ctx.globalAlpha = 0.8;
				ctx.lineWidth = 1;
				roundedRect(ctx, selectedClipArea[0]-1,selectedClipArea[1]-1,selectedClipArea[2]+2,selectedClipArea[3]+2, 5, false);
				ctx.strokeStyle = "#888";
				ctx.lineWidth = 0.5;
				ctx.globalAlpha = 1;
		}
		}
	}

	//ctx.restore();
	
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