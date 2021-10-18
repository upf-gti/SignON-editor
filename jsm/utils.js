Math.clamp = function( v, a, b ) {
	return a > v ? a : b < v ? b : v;
};

function getTime() {
	return new Date().getTime();
};

function listNames( bones, _depth, list ) {
    
	for (var index in bones) 
	{
		var result = {name: '', depth: null, childs: false, selected: false};//, result_list = list;
		var read = bones[index];
		result.name = read.name;
		result.depth = _depth;
		list.push(result);
		if ( read.children.length > 0 ) {
			result.childs = true;
			listNames(read.children, _depth+1, list);
		}
		if ( _depth == 0 )
			return list;
	}

	return list ;
};

export { getTime, listNames }