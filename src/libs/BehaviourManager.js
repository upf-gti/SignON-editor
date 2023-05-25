// @BehaviourManager

// Message gets to BehaviourManager -> then to facial control -> then to BehaviorRealizer

// Needs to synchronize BML actions of the same block
// [MERGE,APPEND,REPLACE,OVERWRITE]
// Warnings and feedback
// wait, synchronize, constraints, before, after

function BehaviourManager() {

	// BML instruction keys
	this.bmlKeys = [ "gaze", "gazeShift", "face", "faceShift", "head", "headDirectonShift", "lg", "gesture", "posture", "animation"];

	// BML stack
	this.gazeStack = [];
	this.faceStack = [];
	this.headStack = [];
	this.headDirStack = [];
	this.speechStack = [];
	this.gestureStack = [];
	this.pointingStack = [];
	this.postureStack = [];

	this.lgStack = [];
	this.animationStack = [];

	this.BMLStacks = [this.gazeStack, this.faceStack, this.headStack, this.headDirStack, this.speechStack, this.lgStack,
	this.gestureStack, this.pointingStack, this.postureStack, this.animationStack];

	// Block stack
	this.stack = [];
}

BehaviourManager.prototype.reset = function (){
	// reset stacks
	this.gazeStack.length = 0;
	this.faceStack.length = 0;
	this.headStack.length = 0;
	this.headDirStack.length = 0;
	this.speechStack.length = 0;
	this.gestureStack.length = 0;
	this.pointingStack.length = 0;
	this.postureStack.length = 0;
	this.lgStack.length = 0;
	this.animationStack.length = 0;

	this.stack.length = 0;
}

// TODO: PROVIDE FEEDBACK AND WARNINGS
BehaviourManager.prototype.update = function (actionCallback, time) {

	// Time now
	this.time = time;

	// Several blocks can be active (MERGE composition)
	for (let i = 0; i < this.stack.length; i++) {
		// If it is not active
		if (!this.stack[i].isActive) {
			// Block starts
			if (this.stack[i].startGlobalTime <= this.time) {
				this.stack[i].isActive = true;
			}
		}
		// Check if has ended
		if ( this.stack[i].isActive ) {
			if (this.stack[i].endGlobalTime <= this.time) {
				this.stack[i].isActive = false;
				// Remove
				this.removeFromStacks(this.stack[i]);
				this.stack.splice(i, 1);
				i--;
			}
		}
	}
	

	// Check active BML and blocks (from BMLStacks)
	for (let i = 0; i < this.BMLStacks.length; i++) {
		// Select bml instructions stack
		let stack = this.BMLStacks[i];
		for (let j = 0; j < stack.length; j++) {
			let bml = stack[j];

			// BML is not active
			if ( !bml.isActive ) {
				// Set BML to active
				if (bml.startGlobalTime <= this.time) {
					bml.isActive = true;
					actionCallback(bml.key, bml); // CALL BML INSTRUCTION
				}
			}
			// BML has finished
			else if (bml.isActive) {
				if (bml.endGlobalTime <= this.time) {
					bml.isActive = undefined;
					// Remove from bml stack
					stack.splice(j, 1);
					j--;
				}
			}
		}
	}
}

BehaviourManager.prototype.newBlock = function (block, time) {

	if (!block) {
		return;
	}

	// Time now
	if (time == 0) {
		time = 0.001;
	}
	this.time = time;

	// TODO: require
	// Fix and Sychronize (set missing timings) (should substitute "start:gaze1:end + 1.1" by a number)
	this.fixBlock(block);

	// Remove blocks with no content
	if (block.end == 0) {
		//console.error("Refused block.\n", JSON.stringify(block));
		return;
	}

	// Add to stack
	this.addToStack(block);

}

BehaviourManager.prototype.fixBlock = function (block) {
	// Define block start (in BML this is not specified, only in bml instructions, not in blocks)
	//block.start = block.start || 0.0;
	// Check if it is a number
	block.start = isNaN(block.start) ? 0 : block.start;

	// Define timings and find sync attributes (defaults in percentage unless start and end)
	// Gaze
	if (block.gaze)
		block.gaze = this.fixBML(block.gaze, "gaze", block, { start: 0, ready: 0.33, relax: 0.66, end: 2.0 });

	// GazeShift
	if (block.gazeShift)
		block.gazeShift = this.fixBML(block.gazeShift, "gazeShift", block, { start: 0, end: 2.0 });

	// Head
	if (block.head)
		block.head = this.fixBML(block.head, "head", block, { start: 0, ready: 0.15, strokeStart: 0.15, stroke: 0.5, strokeEnd: 0.8, relax: 0.8, end: 2.0 });

	// HeadDirection
	if (block.headDirectionShift)
		block.headDirectionShift = this.fixBML(block.headDirectionShift, "headDirectionShift", block, { start: 0, end: 2.0 });

	// Face
	if (block.face)
		block.face = this.fixBML(block.face, "face", block, { start: 0, attackPeak: 0.4, relax: 0.6, end: 1 });
	// Face
	if (block.faceFACS)
		block.faceFACS = this.fixBML(block.faceFACS, "faceFACS", block, { start: 0, attackPeak: 0.4, relax: 0.6, end: 1 });

	// Face
	if (block.faceLexeme)
		block.faceLexeme = this.fixBML(block.faceLexeme, "faceLexeme", block, { start: 0, attackPeak: 0.4, relax: 0.6, end: 1 });

	// Face
	if (block.faceEmotion)
		block.face = this.fixBML(block.faceEmotion, "face", block, { start: 0, attackPeak: 0.4, relax: 0.6, end: 1 });

	// Face VA
	if (block.faceVA)
		block.face = this.fixBML(block.faceVA, "face", block, { start: 0, attackPeak: 0.4, relax: 0.6, end: 1 });

	// FaceShift
	if (block.faceShift)
		block.faceShift = this.fixBML(block.faceShift, "faceShift", block, { start: 0, end: 1 });

	// Speech (several instructions not implemented)
	if (block.speech)
		block.speech = this.fixBML(block.speech, "speech", block, { start: 0, end: 2.5 });

	// Language-generation
	if (block.lg)
		block.lg = this.fixBML(block.lg, "lg", block, { start: 0, end: 1 });

	// Posture
	if (block.posture)
		block.posture = this.fixBML(block.posture, "posture", block, { start: 0, ready: 0.3, strokeStart: 0.3, stroke: 0.4, strokeEnd: 0.6, relax: 0.7, end: 1.0 });

	// Gesture
	if (block.gesture)
		block.gesture = this.fixBML(block.gesture, "gesture", block, { start: 0, ready: 0.1, strokeStart: 0.2, stroke: 0.7, strokeEnd: 0.7, relax: 1.4, end: 1.5 });

	// Pointing
	if (block.pointing)
		block.pointing = this.fixBML(block.pointing, "pointing", block, { start: 0, ready: 0.3, strokeStart: 0.3, stroke: 0.4, strokeEnd: 0.6, relax: 0.7, end: 1.0 });

	// Animation
	if (block.animation)
		block.animation = this.fixBML(block.animation, "animation", block, { start: 0, end: 2.0 });

	// Find end of block
	block.end = this.findEndOfBlock(block);
}

BehaviourManager.prototype.fixBML = function (bml, key, block, sync) {
	// Error check
	if (!bml) {
		console.warn("BML instruction undefined or null:", key, bml);
		delete block[key];
		return;
	}

	// Several instructions inside
	if (bml.constructor === Array) {
		for (var i = 0; i < bml.length; i++)
			bml[i] = this.fixBML(bml[i], key, block, sync);
		return bml;
	}

	// Check if is it an object
	if (typeof bml !== "object" || bml === null)
		bml = {};

	// Define type (key)
	bml.key = key;

	// Define timings
	// START
	bml.start = isNaN(bml.start) ? 0.0 : bml.start;
	if (bml.start < 0) {
		bml.start = 0;
	}
	// END
	bml.end = isNaN(bml.end) ? (bml.start + sync.end) : bml.end;

	return bml;
}


BehaviourManager.prototype.findEndOfBlock = function (block) {

	let keys = Object.keys(block);
	let latestEnd = 0;

	for (let i = 0; i < keys.length; i++) {
		let bml = block[keys[i]];
		if (bml === null || bml === undefined) { continue; }
		else if ( !isNaN( bml.end ) ) // bml is just an instruction
			latestEnd = Math.max(bml.end, latestEnd);

		else if (bml.constructor === Array){ // several instructions inside class
			for (let j = 0; j < bml.length; j++) {
				if (bml[j] && !isNaN( bml[j].end ) )
					latestEnd = Math.max(bml[j].end, latestEnd);
			}
		}
	}

	return latestEnd;
}

BehaviourManager.prototype.addToStack = function (block) {
	// block composition defined in bml standard [MERGE, REPLACE, APPEND]. OVERWRITE is not included

	if (Object.prototype.toString.call(block.composition) === '[object String]')
		block.composition = block.composition.toUpperCase();

	
	if (this.stack.length == 0) {
		block.startGlobalTime = this.time + block.start;
		block.endGlobalTime = this.time + block.end;
		this.stack.push( block );
	}

	// OVERWRITE
	else if (block.composition == "OVERWRITE") { // Doens't make sense, only for individual stacks, not whole
		// Substitute in stack

		block.startGlobalTime = this.time + block.start;
		block.endGlobalTime = this.time + block.end;

		let last = this.stack[this.stack.length - 1];
		if (block.endGlobalTime < last.endGlobalTime) {
			this.stack[this.stack.length - 1] = block;
			this.stack.push(last);
		}
		else
			this.stack.push(block);
		
		// Add to bml stack (called at the end of function)
	}

	// APPEND
	else if (block.composition == "APPEND") {
		//The start time of the new block will be as soon as possible after the end time of all prior blocks.
		block.startGlobalTime = this.stack[this.stack.length - 1].endGlobalTime + block.start;
		block.endGlobalTime = this.stack[this.stack.length - 1].endGlobalTime + block.end;
		this.stack.push(block);
	}

	// REPLACE
	else if (block.composition == "REPLACE") {
		//The start time of the new block will be as soon as possible. The new block will completely replace all prior bml blocks. All behavior specified in earlier blocks will be ended and the ECA will revert to a neutral state before the new block starts.

		// Second action in the stack (if start != 0 waiting time?)
		block.startGlobalTime = (this.stack[0].isActive) ? this.stack[0].endGlobalTime : this.time;
		block.endGlobalTime = block.startGlobalTime + block.end;

		// Remove following blocks
		for (let i = (this.stack[0].isActive) ? 1: 0; i < this.stack.length; i++)
			this.removeFromStacks(this.stack[i]);

		this.stack.push( block );
	}

	// MERGE (default)
	else {
		// Add to block stack
		block.startGlobalTime = this.time + block.start;
		block.endGlobalTime = this.time + block.end;

		this.stack.push(block);

		// bubble sort. Lowest endGlobalTimes should be first, Biggest endGlobalTime should be the last
		if ( this.stack.length > 1 ){
			for ( let i = this.stack.length-2; i >= 0; --i ){
				let prev = this.stack[i];
				if ( prev.endGlobalTime > block.endGlobalTime ){
					this.stack[i] = block;
					this.stack[i+1] = prev;
				}
				else{ break; }
			}
		}		
	}

	// Add to stacks
	this.addToBMLStacks(block);
}

// Removes all bml instructions from stacks
BehaviourManager.prototype.removeFromStacks = function (block) {

	// Add delete variable in block to bml instructions
	let keys = Object.keys(block);
	for (let i = 0; i < keys.length; i++) { // Through bml instructions
		let bml = block[keys[i]];
		if (bml !== null || bml !== undefined) {
			if (typeof bml === "object"){ // bml is an instruction
				bml.del = true;
			}
			else if (bml.constructor === Array){ // bml is an array of bml instructions
				for (let j = 0; j < bml.length; j++){
					bml[j].del = true;
				}
			}

		}
	}

	// Remove from each stack all bml with del
	for (let i = 0; i < this.BMLStacks.length; i++) { // Through list of stacks
		for (let j = 0; j < this.BMLStacks[i].length; j++) {// Through stack
			if (this.BMLStacks[i][j].del) { // Find del variable in stack
				this.BMLStacks[i][j].isActive = undefined; // If reusing object
				this.BMLStacks[i].splice(j, 1); // Remove from stack
				j--;
			}
		}
	}
}

// Add bml actions to stacks with global timings
BehaviourManager.prototype.addToBMLStacks = function (block) {

	let globalStart = block.startGlobalTime;

	// Gaze
	if (block.gaze)
		this.processIntoBMLStack(block.gaze, this.gazeStack, globalStart, block.composition);
	if (block.gazeShift)
		this.processIntoBMLStack(block.gazeShift, this.gazeStack, globalStart, block.composition);

	// Head
	if (block.head)
		this.processIntoBMLStack(block.head, this.headStack, globalStart, block.composition);
	if (block.headDirectionShift)
		this.processIntoBMLStack(block.headDirectionShift, this.headDirStack, globalStart, block.composition);

	// Face
	if (block.faceLexeme)
		this.processIntoBMLStack(block.faceLexeme, this.faceStack, globalStart, block.composition);

	if (block.faceFACS)
		this.processIntoBMLStack(block.faceFACS, this.faceStack, globalStart, block.composition);

	if (block.face)
		this.processIntoBMLStack(block.face, this.faceStack, globalStart, block.composition);

	if (block.faceShift)
		this.processIntoBMLStack(block.faceShift, this.faceStack, globalStart, block.composition);

	// Speech
	if (block.speech)
		this.processIntoBMLStack(block.speech, this.speechStack, globalStart, block.composition);

	// Posture
	if (block.posture)
		this.processIntoBMLStack(block.posture, this.postureStack, globalStart, block.composition);

	// Gesture
	if (block.gesture)
		this.processIntoBMLStack(block.gesture, this.gestureStack, globalStart, block.composition);

	// Pointing
	if (block.pointing)
		this.processIntoBMLStack(block.pointing, this.pointingStack, globalStart, block.composition);

	// LG
	if (block.lg)
		this.processIntoBMLStack(block.lg, this.lgStack, globalStart, block.composition);

	// Animation
	if (block.animation)
		this.processIntoBMLStack(block.animation, this.animationStack, globalStart, block.composition);
}

// Add bml action to stack
BehaviourManager.prototype.processIntoBMLStack = function (bml, stack, globalStart, composition) {

	// Several instructions
	if (bml.constructor === Array) {
		for (let i = 0; i < bml.length; i++)
			this.processIntoBMLStack(bml[i], stack, globalStart, composition);
		return;
	}


	let merged = this.mergeBML(bml,stack,globalStart,  composition);
 	bml.del = !merged;

	// First, we check if the block fits between other blocks, thus all bml instructions
	// should fit in the stack.
	if (!merged)
		console.warn("Could not add to " + bml.key + " stack. \n");// + "BML: ", 

}


BehaviourManager.prototype.mergeBML = function(bml, stack, globalStart, composition){
	let merged = false;
	
	// Refs to another block (negative global timestamp)
	if (bml.start < 0)
		bml.start = (-bml.start) - globalStart; // The ref timestamp should be always bigger than globalStart

	if (bml.end < 0)
		bml.end = (-bml.end) - globalStart;

	bml.startGlobalTime = globalStart + bml.start;
	bml.endGlobalTime = globalStart + bml.end;

	// Check errors
	if (bml.start < 0) console.error("BML start is negative", bml.start, bml.key, globalStart);
	if (bml.end < 0) console.error("BML end is negative", bml.end, bml.key, globalStart);

	// Now change all attributes from timestamps to offsets with respect to startGlobalTime
	
	// Modify all sync attributes to remove non-zero starts (offsets)
	// Also fix refs to another block (negative global timestamp)
	bml.end -= bml.start;

	if ( !isNaN(bml.attackPeak) ) 
		bml.attackPeak = this.mergeBMLSyncFix(bml.attackPeak, bml.start, globalStart);
	if ( !isNaN(bml.ready) )
		bml.ready = this.mergeBMLSyncFix(bml.ready, bml.start, globalStart);
	if ( !isNaN(bml.strokeStart) )
		bml.strokeStart = this.mergeBMLSyncFix(bml.strokeStart, bml.start, globalStart);
	if ( !isNaN(bml.stroke) )
		bml.stroke = this.mergeBMLSyncFix(bml.stroke, bml.start, globalStart);
	if ( !isNaN(bml.strokeEnd) )
		bml.strokeEnd = this.mergeBMLSyncFix(bml.strokeEnd, bml.start, globalStart);
	if ( !isNaN(bml.relax))
		bml.relax = this.mergeBMLSyncFix(bml.relax, bml.start, globalStart);

	bml.start = 0;

	bml.composition = composition;


	let overwrite = composition === "OVERWRITE";
	let merge = composition === "MERGE";

	if ( !overwrite ) {
		stack.push( bml );
		// bubble sort the stack by endGlobalTime. First the lowest 
		for( let i = stack.length-2; i > 0; --i){
			if ( stack[i].endGlobalTime > bml.endGlobalTime ){
				stack[i+1] = stack[i];
				stack[i] = bml;
			}
			else { break; }
		}
		return true;
	}


	// OLD CODE
	// add to bml stack
	// Empty
	if (stack.length == 0) {
		stack.push( bml );
		return true;
	}
	else {
		// Fits between
		if (stack.length > 1) {

			//append at the end
			if (bml.startGlobalTime >= stack[stack.length - 1].endGlobalTime){
				stack.push(bml);
				merged = true;
			}
			// fit on the stack?
			else{
				for (let i = 0; i < stack.length-1; i++){
					if(merged) break;
					// Does it fit?
					if (bml.startGlobalTime >= stack[i].endGlobalTime && bml.endGlobalTime <= stack[i + 1].startGlobalTime || i == 0 && bml.endGlobalTime < stack[i].startGlobalTime) {
						let tmp = stack.splice(i, stack.length);
						stack.push(bml);
						stack = stack.concat(tmp);
						merged = true;
					}
					// If it doesn't fit remove if overwrite
					else if (overwrite) {
						// Remove from bml stack
						stack.splice(i, 1);
						i--;
					}
					else if(merge){
						stack.push(bml);
						merged = true;
					}
				}
			}
		}
		// End of stack (stack.length == 1)
		if (!merged || overwrite) {
			// End of stack
			if (stack[stack.length - 1].endGlobalTime <= bml.startGlobalTime) {
				if (!merged) {
					stack.push(bml);
					merged = true;
				}
			}
			else if (overwrite)
				stack.splice(stack.length - 1, 1);
			else if (bml.endGlobalTime < stack[0].startGlobalTime) {// Start of stack
				stack.push(bml);
				stack.reverse();
			}
		}
	}
	// After removing conflicting bml, add
	if (overwrite && !merged) {
		stack.push(bml);
		merged = true;
	}

	return merged;
}

// Fix ref to another block (negative global timestamp) and remove start offset
BehaviourManager.prototype.mergeBMLSyncFix = function (syncAttr, start, globalStart) {
	return ( syncAttr > start ) ? ( syncAttr - start ) : 0;

	// ORIGINAL FUNCTION BELOW

	// Ref to another block
	if (syncAttr < 0) syncAttr = (-syncAttr) - globalStart;
	// Remove offset
	syncAttr -= start;

	// Check error
	if (syncAttr < 0)
		console.error("BML sync attribute is negative.", syncAttr, start, globalStart);

	return syncAttr;
}

// Checks that all stacks are ordered according to the timeline (they should be as they are insterted in order)
BehaviourManager.prototype.check = function () {

	if (this.errorCheck(this.gazeStack)) console.error("Previous error is in gaze stack");
	if (this.errorCheck(this.faceStack)) console.error("Previous error is in face stack");
	if (this.errorCheck(this.headStack)) console.error("Previous error is in head stack");
	if (this.errorCheck(this.headDirStack)) console.error("Previous error is in headDir stack");
	if (this.errorCheck(this.speechStack)) console.error("Previous error is in speech stack");
	if (this.errorCheck(this.postureStack)) console.error("Previous error is in posture stack");
	if (this.errorCheck(this.gestureStack)) console.error("Previous error is in gesture stack");
	if (this.errorCheck(this.pointingStack)) console.error("Previous error is in pointing stack");
	if (this.errorCheck(this.lgStack)) console.error("Previous error is in lg stack");
	if (this.errorCheck(this.animationStack)) console.error("Previous error is in animation stack");
}

BehaviourManager.prototype.errorCheck = function (stack) {
	// Check timings
	for (let i = 0; i < stack.length - 1; i++) {
		if (stack[i].endGlobalTime > stack[i + 1].startGlobalTime) {
			console.error("Timing error in stack: ", stack);
			return true;
		}
	}
}

export { BehaviourManager }