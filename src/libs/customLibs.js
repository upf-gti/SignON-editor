// overwrite method
Inspector.prototype.addSlider = function(name, value, options)
{
	options = this.processOptions(options);

	if(options.min === undefined)
		options.min = 0;

	if(options.max === undefined)
		options.max = 1;

	if(options.step === undefined)
		options.step = 0.01;

	if(options.precision === undefined)
		options.precision = 3;

	var that = this;
	if(value === undefined || value === null)
		value = 0;
	this.values[name] = value;

	var element = this.createWidget(name,"<span class='inputfield full'>\
				<input tabIndex='"+this.tab_index+"' style='font-weight: bolder; color: white; display: none; position: absolute; z-index: 1000; margin-left: 6px; margin-top: -3px;' class='slider-text fixed' value='"+value+"' /><span class='slider-container'></span></span>", options);

	var slider_container = element.querySelector(".slider-container");

	var slider = new LiteGUI.Slider(value,options);
	slider_container.appendChild(slider.root);

	slider.root.addEventListener('dblclick', function(e) {
		
		text_input.value = parseFloat(text_input.value).toFixed(3);
		text_input.style.display = "block";
		text_input.focus();
	});

	//Text change -> update slider
	var skip_change = false; //used to avoid recursive loops
	var text_input = element.querySelector(".slider-text");
	text_input.addEventListener('change', function(e) {
		if(skip_change)
			return;
		var v = parseFloat( this.value ).toFixed(options.precision);
		value = v;
		slider.setValue( v );
		Inspector.onWidgetChange.call( that,element,name,v, options );
	});

	text_input.addEventListener('keyup', function(e) {

		if(e.keyCode == 27){
			text_input.style.display = "none";
		}
		
	});

	text_input.addEventListener('blur', function(e) {

		text_input.style.display = "none";
		
	});

	//Slider change -> update Text
	slider.onChange = function(value) {
		text_input.value = value;
		text_input.style.display = "none";
		Inspector.onWidgetChange.call( that, element, name, value, options);
	};

	this.append(element,options);

	element.setValue = function(v,skip_event) { 
		if(v === undefined)
			return;

		value = v;
		slider.setValue(parseFloat( v ),skip_event);
	};
	element.getValue = function() { 
		return value;
	};

	this.processElement(element, options);
	return element;
}

LiteGUI.SliderList = [];

function Slider(value, options)
{
	options = options || {};
	var canvas = document.createElement("canvas");
	canvas.className = "slider " + (options.extraclass ? options.extraclass : "");

	canvas.width = 300;
	canvas.height = 22; 	

	this.root = canvas;
	var that = this;
	this.value = value;

	this.ready = true;

	LiteGUI.SliderList.push( this );

	this.setValue = function(value, skip_event)
	{
		if(!value)
		value = this.value;

		if(options.integer)
			value = parseInt(value);
		else
			value = parseFloat(value);

		var ctx = canvas.getContext("2d");
		var min = options.min || 0.0;
		var max = options.max || 1.0;
		if(value < min) value = min;
		else if(value > max) value = max;
		var range = max - min;
		var norm = (value - min) / range;
		ctx.clearRect(0,0,canvas.width,canvas.height);
		ctx.fillStyle = "#5f88c9";
		ctx.fillRect(0,0, canvas.width * norm, canvas.height);

		ctx.fillStyle = "#EEE";
		ctx.font = "13px Arial";

		var text = value.toFixed(options.precision);
		ctx.fillText(text, canvas.width - 16 - text.length * 8, 15);

		if(value != this.value)
		{
			this.value = value;
			if(!skip_event)
			{
				LiteGUI.trigger(this.root, "change", value );
				if(this.onChange)
					this.onChange( value );
			}
		}
	}

	function setFromX(x)
	{
		var width = canvas.getClientRects()[0].width;
		var norm = x / width;
		var min = options.min || 0.0;
		var max = options.max || 1.0;
		var range = max - min;
		that.setValue( range * norm + min );
	}

	var doc_binded = null;

	canvas.addEventListener("mousedown", function(e) {
		var mouseX, mouseY;
		if(e.offsetX) { mouseX = e.offsetX; mouseY = e.offsetY; }
		else if(e.layerX) { mouseX = e.layerX; mouseY = e.layerY; }	
		setFromX(mouseX);
		doc_binded = canvas.ownerDocument;
		doc_binded.addEventListener("mousemove", onMouseMove );
		doc_binded.addEventListener("mouseup", onMouseUp );

		doc_binded.body.style.cursor = "none";
	});

	function onMouseMove(e)
	{
		var rect = canvas.getClientRects()[0];
		var x = e.x === undefined ? e.pageX : e.x;
		var mouseX = x - rect.left;
		setFromX(mouseX);
		e.preventDefault();
		return false;
	}

	function onMouseUp(e)
	{
		var doc = doc_binded || document;
		doc_binded = null;
		doc.removeEventListener("mousemove", onMouseMove );
		doc.removeEventListener("mouseup", onMouseUp );
		e.preventDefault();
		
		doc.body.style.cursor = "default";

		return false;
	}

	this.setValue(value);
}

LiteGUI.Slider = Slider;