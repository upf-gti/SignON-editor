import { getTime } from '../utils.js';

//Agnostic timeline, do nos impose any timeline content
//it renders to a canvas

function Timeline() {
	this.current_time = 0;
	this.framerate = 30;
	this.opacity = 0.8;
	this.sidebar_width = 250;

	//do not change, it will be updated when called draw
	this.duration = 100;
	this.position = [0, 0];
	this.size = [600, 300];

	this.current_scroll = 0; //in percentage
	this.current_scroll_in_pixels = 0; //in pixels
	this.scrollable_height = 100; //true height of the timeline content

	this._seconds_to_pixels = 100;
	this._pixels_to_seconds = 1 / this._seconds_to_pixels;
	this._canvas = null;
	this._grab_time = 0;
	this._start_time = 0;
	this._end_time = 5;

	this._last_mouse = [0, 0];
	this.mode = "keyframes";

	this.onDrawContent = null;
	this.extended = true
}

//project must have .duration in seconds
Timeline.prototype.draw = function (ctx, project, current_time, rect) {
	if (!project)
		return;

	if (!rect)
		rect = [0, ctx.canvas.height - 150, ctx.canvas.width, 150];

	this._canvas = ctx.canvas;
	this.position[0] = rect[0];
	this.position[1] = rect[1];
	var w = this.size[0] = rect[2];
	var h = this.size[1] = rect[3];
	var timeline_height = h;
	var P2S = this._pixels_to_seconds;
	var S2P = this._seconds_to_pixels;

	this.current_time = current_time;
	var duration = this.duration = project.duration;
	this.current_scroll_in_pixels = this.scrollable_height <= h ? 0 : (this.current_scroll * (this.scrollable_height - timeline_height));

	ctx.save();
	ctx.translate(this.position[0], this.position[1] + 20);

	//background
	ctx.fillStyle = "#111";
	ctx.globalAlpha = 1;
	ctx.fillRect(0, -20, w, 20);
	ctx.globalAlpha = this.opacity;
	ctx.globalAlpha = 1;
	ctx.fillRect(0, 0, w, h);

	//seconds markers
	var seconds_full_window = (w * P2S); //how many seconds fit in the current window
	var seconds_half_window = seconds_full_window * 0.5;
	var hw = w * 0.5; //half width

	//time in the left side (current time is always in the middle)
	var time_start = current_time - seconds_half_window;

	//time in the right side
	var time_end = current_time + seconds_half_window;

	this._start_time = time_start;
	this._end_time = time_end;

	var sidebar = this.sidebar_width;
	this._last_ref = null; //used while rendering tracks

	//this ones are limited to the true timeline (not the visible area)
	var start = Math.ceil(Math.max(0, time_start));
	var end = Math.floor(Math.min(duration, time_end) + 0.01);

	//calls using as 0,0 the top-left of the tracks area (not the top-left of the timeline but 20 pixels below)
	if (this.onDrawContent)
		this.onDrawContent(ctx, project, time_start, time_end, this);

	ctx.translate(this.position[0], this.position[1] - 20); //restore the original top margin area

	//draw time markers
	var top_margin = 30;
	var margin = this.sidebar_width;

	//background of numbers
	ctx.fillStyle = "#111";
	ctx.fillRect(margin, 0, ctx.canvas.width, top_margin);

	//draw lines for each frame
	if (S2P > 200) {
		ctx.strokeStyle = "#AAA";
		ctx.globalAlpha = 0.5 * (1.0 - Math.clamp(200 / S2P, 0, 1));
		ctx.beginPath();
		for (var time = 0; time <= duration; time += 1 / this.framerate) {
			var x = this.timeToX(time);
			if (x < margin)
				continue;
			ctx.moveTo(Math.round(x) + 0.5, top_margin * 0.75);
			ctx.lineTo(Math.round(x) + 0.5, top_margin - 1);
		}
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	//init and end vertical lines
	ctx.strokeStyle = "#444";
	ctx.beginPath();
	var linex = this.timeToX(0);
	if (linex > sidebar) {
		ctx.moveTo(linex, 20.5);
		ctx.lineTo(linex, h);
	}
	var linex = this.timeToX(duration);
	if (linex > sidebar && linex < w) {
		ctx.moveTo(linex, 20.5);
		ctx.lineTo(linex, h);
	}
	ctx.stroke();

	//draw lines for each round and half second
	ctx.globalAlpha = 0.5;
	ctx.strokeStyle = "#AFD";
	ctx.beginPath();
	for (var time = 0; time <= duration; time += 0.5) {
		var x = this.timeToX(time);

		if (x < margin)
			continue;

		var is_tick = time % 1 == 0;

		ctx.moveTo(Math.round(x) + 0.5, top_margin * 0.6 + (is_tick ? 0 : top_margin * 0.15));
		ctx.lineTo(Math.round(x) + 0.5, top_margin);
	}

	//horizontal line
	var start = 0;
	var x = this.timeToX(start);
	var end_x = this.timeToX(duration);
	if (x < margin)
		x = margin;
	ctx.moveTo(x, top_margin - 0.5);
	ctx.lineTo(end_x, top_margin - 0.5);
	ctx.stroke();
	ctx.globalAlpha = 1;

	//time seconds in text
	ctx.font = "11px Arial";
	ctx.textAlign = "center";
	ctx.fillStyle = "#888";
	for (var i = 0; i < duration; ++i) {
		var x = this.timeToX(i);
		if (x < margin)
			continue;
		ctx.fillText(i, Math.round(x) + 0.5, top_margin * 0.5);
	}

	ctx.globalAlpha = 1;

	//current time marker
	ctx.strokeStyle = "#AFD";
	var x = ((w * 0.5) | 0) + 0.5;
	ctx.globalAlpha = 1;
	ctx.beginPath();
	ctx.moveTo(x, 1);
	ctx.lineTo(x, h);
	ctx.stroke();

	ctx.fillStyle = "#AFD";
	ctx.beginPath();
	ctx.moveTo(x - 4, 1);
	ctx.lineTo(x + 4, 1);
	ctx.lineTo(x, 6);
	ctx.fill();

	//scrollbar
	if (h < this.scrollable_height) {
		ctx.fillStyle = "#333";
		ctx.fillRect(w - 10, top_margin, 10, 10);
		ctx.fillRect(w - 10, h - 10, 10, 10);
		h = h - top_margin;
		var scrollh = h * (h / this.scrollable_height);
		ctx.fillStyle = "#AAA";
		ctx.fillRect(w - 8, top_margin + this.current_scroll * (h - scrollh), 6, scrollh);
	}

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
Timeline.prototype.drawTrackWithKeyframes = function (ctx, y, track_height, title, subtitle, track, track_index, prev_ref) {
	track_index = track_index || 0;

	if (track_index % 2) {
		ctx.fillColor = [1, 1, 1, 0.1];
		ctx.fillRect(0, y, this.size[0], track_height);
	}

	ctx.font = Math.floor(track_height * 0.7) + "px Arial";
	ctx.textAlign = "left";
	ctx.fillColor = [1, 1, 1, 0.8];

	if (prev_ref && prev_ref != this._last_ref)
		ctx.fillText(title, 10, y + track_height * 0.75);
	this._last_ref = prev_ref;

	if (subtitle != null) {
		var info = ctx.measureText(title);
		ctx.fillColor = [0.6, 0.8, 1, 0.8];
		ctx.fillText(subtitle, 10 + info.width, y + track_height * 0.75);
	}

	ctx.fillColor = [0.9, 0.8, 0.5, 1];
	var keyframes = track.data;

	if (keyframes)
		for (var j = 0; j < keyframes.length; ++j) {
			var keyframe = keyframes[j];
			var time = keyframe[0];
			var value = keyframe[1];
			if (time < this._start_time || time > this._end_time)
				continue;
			var keyframe_posx = this.timeToX(time);
			if (keyframe_posx > this.sidebar_width)
				ctx.fillRect(keyframe_posx - 4, y + 4, 8, track_height - 8);
		}
}

//converts distance in pixels to time
Timeline.prototype.xToTime = function (x, global) {
	if (global)
		x -= this.position[0];
	var v = (x - this.size[0] * 0.5) * this._pixels_to_seconds + this.current_time;
	return v;
}

//converts time to disance in pixels
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

Timeline.prototype.setScale = function (v) {
	this._seconds_to_pixels = v;
	if (this._seconds_to_pixels > 1000)
		this._seconds_to_pixels = 1000;
	this._pixels_to_seconds = 1 / this._seconds_to_pixels;
}

Timeline.prototype.processMouse = function (e) {
	if (!this._canvas)
		return;

	var w = this.size[0];
	var h = this.size[1];

	//process mouse
	var x = e.offsetX;
	var y = e.offsetY;
	e.deltax = x - this._last_mouse[0];
	e.deltay = y - this._last_mouse[1];
	this._last_mouse[0] = x;
	this._last_mouse[1] = y;
	var timeline_height = this.size[1];

	var time = this.xToTime(x, true);

	var is_inside = x >= this.position[0] && x <= (this.position[0] + this.size[0]) &&
		y >= this.position[1] && y <= (this.position[1] + this.size[1]);

	if (e.type == "mouseup") {
		this._grabbing = false;
		this._grabbing_scroll = false;
		if (this.onMouseUp)
			this.onMouseUp(e, time);
	}

	if (!is_inside && !this._grabbing && !(e.metaKey || e.altKey))
		return;

	if (this.onMouse && this.onMouse(e, time, this))
		return;

	if (e.type == "mousedown") {
		this._click_time = getTime();

		if (timeline_height < this.scrollable_height && x > w - 10) {
			this._grabbing_scroll = true;
		}
		else {
			this._grabbing = true;
			this._grab_time = time - this.current_time;
		}
	}
	else if (e.type == "mousemove") {
		if (this._grabbing) {
			var curr = time - this.current_time;
			var delta = curr - this._grab_time;
			this._grab_time = curr;
			this.current_time = Math.clamp(this.current_time - delta, 0, this.duration);
			if (this.onSetTime)
				this.onSetTime(this.current_time);
		}
		else if (this._grabbing_scroll) {
			var scrollh = timeline_height * (timeline_height / this.scrollable_height);
			this.current_scroll = Math.clamp(this.current_scroll + e.movementY / (timeline_height - 80), 0, 1);
		}
	}
	else if (e.type == "wheel") {
		if (timeline_height < this.scrollable_height && x < this.sidebar_width) {
			this.current_scroll = Math.clamp(this.current_scroll + (e.wheelDelta < 0 ? 0.1 : -0.1), 0, 1);
		}
		else {
			this.setScale(this._seconds_to_pixels * (e.wheelDelta < 0 ? 0.9 : (1 / 0.9)));
		}
	}

	if (this._canvas) {
		var cursor = this._grabbing ? "grabbing" : "pointer";
		this._canvas.style.cursor = cursor;
	}

	return true;
};

export { Timeline };