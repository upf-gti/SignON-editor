import { FS } from './main.js';

Math.clamp = function (v, a, b) {
	return a > v ? a : b < v ? b : v;
};

function getTime() {
	return new Date().getTime();
};

async function storeAnimation() {

	//CHECK THE INPUT FILE !!!!TODO!!!!
    var file = undefined;//document.getElementById("testInput").files[0];

    //Check if are files loaded
    if (!file) {
        w2popup.close();
        console.log("Not BVH found.");
        return;
    }

    //Log the user
    await FS.login();

    //folder, data, filename, metadata
    await FS.uploadData('animations', file, file.name || 'noName', '');

    //Log out the user
    FS.logout();

    console.log("Upload Clicked");

	w2popup.close();
}

export { getTime, storeAnimation }