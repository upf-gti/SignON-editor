// Thread for loading files
const FileLoader = {

    Load: (url, onload, onerror) => {
        const _onError = function(e) {
            if (onerror) {
                onerror(e);
            } else {
                console.error(e);
            }
        };

        var request = new XMLHttpRequest();
        request.addEventListener("load", function(data) {
            try {
                onload(data);
            } catch (e) {
                _onError(e);
            }
        });
        request.addEventListener("error", _onError);
        request.responseType = 'arraybuffer';
        request.open("GET", url);
        request.send();
    }

};

export { FileLoader };