import { LFS } from './litefileserver.js';
// FILESYSTEM FOR PRESENT PROJECT 

class FileSystem{
    
    constructor(user, pass, callback) {
        this.session = null;
        this.parsers = {};
        this.root = "https://webglstudio.org/projects/signon/repository/files/";

        this.user = user;
        this.pass = pass;

        this.ALLOW_GUEST_UPLOADS = true;

        // init server this.onReady.bind(this, user, pass, (s) => {this.session = s; callback;})
        LFS.setup("https://webglstudio.org/projects/signon/repository/src/", callback);
    }
   
    init() {
      console.log(this);
    }

    getSession() {
        return this.session;
    }

    updateSession(session, resolve) {
        this.session = session;
        resolve("DONE");
    }

    login() {
        return new Promise(resolve => LFS.login(this.user, this.pass, (s) => this.updateSession(s, resolve)));
    }

    logout() {
        this.session.logout(()=> console.log("Logout done"));
    }

    onReady(u, p, callback) {
        // log the user login: function( username, password, on_complete)
        LFS.login(u, p, callback);
    }

    onLogin( callback, session, req ){

        if(!session)
            throw("error in server login");

        if(req.status == -1) // Error in login
        {
            console.error(req.msg);
        }
        else
        {
            this.session = session;
            console.log("%cLOGGED " + session.user.username, "color: #7676cc; font-size: 16px" );
        }

        if(callback)
        callback(req.status != -1, req.msg);
    }

    onLogout( callback, closed ){

        if(closed)
        {
            this.session = null;
            console.log("%cLOGGED OUT","color: #7676cc; font-size: 16px" );
            if(callback)
                callback();    
        }
    }
    
    async uploadFile(path, file, metadata){


        return new Promise((resolve, reject) => {

            var session = this.session;
            // var unit_name = session.user.username;
            // let path = unit_name + "/" + folder + "/" + file.name;

			session.uploadFile( path, file, 
                    { "metadata": metadata }, 
                    function(e){console.log("complete",e); resolve()},
                    function(e, req){console.error("error",e, req);},
            );
        });
                //                    e => console.log("progress",e));
    }

    async uploadData(folder, data, filename, metadata){


        return new Promise((resolve, reject) => {

            var session = this.session;
            let path = session.user.username + "/" + folder + "/" + filename;

			session.uploadFile( path, data, 
                    { "metadata": metadata }, 
                    function(e){console.log("complete",e); resolve()},
                    e => console.log("error",e)); //,
//                    e => console.log("progress",e));
        });
    }

    async getFiles( unit, folder ){
        return new Promise( (resolve, reject)=>{
        
            function onError(e){
                reject(e);
            }
    
            function onFiles(f){
                if(!f)
                    return onError("Error: folder \""+folder+"\" not found.");
                resolve(f);
            }

            var session = this.session;

            session.request( 
                session.server_url,
                { action: "files/getFilesInFolder", unit: unit, folder: folder }, function(resp){

                if(resp.status < 1){
                    onError(resp.msg);
                    return;
                }
                //resp.data = JSON.parse(resp.data);
                LFS.Session.processFileList( resp.data, unit + "/" + folder );
                onFiles(resp.data, resp);
            });
        });
    }

    async getFolders( onFolders ){
        var session = this.session;

        session.getUnitsAndFolders(onFolders);

    }
}

export { FileSystem };