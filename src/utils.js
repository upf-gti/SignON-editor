Math.clamp = function (v, a, b) {
	return a > v ? a : b < v ? b : v;
};

function getTime() {
	return new Date().getTime();
};

//this function requires font awesome
function createButton(element, options, onClick) {
    var button = document.createElement("BUTTON");
    button.className = "btn";
    button.id = options.id || "";
	button.innerHTML = options.text || "";
    button.style.position = "absolute";
    button.style.top = options.top || "2%";
    button.style.left = options.left || "1%";
    button.style.fontSize = options.size || "14px";
	button.style.padding = options.padding || "0px";
    button.style.fontWeight = 100;
    button.style.zIndex = "265";
	if (onClick) 
        button.addEventListener("click", onClick);
    element.appendChild(button);
    if (options.icon_name) {
        var icon = document.createElement("i");
        icon.className = options.icon_name;
        button.appendChild(icon);
    }
}

function storeAnimation() {

	//TODO

	w2popup.close();
}

export { getTime, createButton, storeAnimation }