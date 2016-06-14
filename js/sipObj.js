/**
 * browser sip object
 * method:
 *   init, sipDial, sipCall, sipAnswer, sipHangup
 * callback:
 *   onShowMsg,
 *   onErr, onDestroyed,
 *   onRegisterSuccess, onRegisterFail,
 *   onCalling, onIncoming, onAccepted, onHangup
 */

sipObj = {
    _address: "http://janus.conf.meetecho.com:8088/janus",
    _info:{},
    _lib: null,
    _sip: null,
    _status: null,
    _sipNumber:null,

    init: function(proxy, user, secret) {
        if(!proxy || !user || !secret){
            sip.onErr();
            return false;
        }
        sipObj._info.proxy = proxy;
        sipObj._info.user = user;
        sipObj._info.secret = secret;

        sipObj._libInit();
    },
    sipRegister: function() {
        sipObj._info.registered = -1;
        var register = {
            'request': 'register',
            'proxy': 'sip:'+sipObj._info.proxy,
            'username': 'sip:'+sipObj._info.user+'@'+sipObj._info.proxy,
            'secret': sipObj._info.secret
        };
        sipObj._sip.send({
            "message": register
        });
    },
    sipCall: function(number) {
        if (!sipObj._sip || !number) {
            return false;
        }
        sipObj._sip.createOffer({
            media: {
                audio: true,
                video: false
            },
            success: function(jsep) {
                //SDP:Session Description Protocol
                sipObj.onShowMsg("sip do call");
                var body = {
                    'request': "call",
                    'uri': 'sip:'+number+'@'+sipObj._info.user
                };
                sipObj._sip.send({
                    "message": body,
                    "jsep": jsep
                });
            },
            error: function(error) {
                sipObj.onShowMsg("WebRTC error:sipCall");
            }
        });
    },
    sipDial: function(number) {
        if (!sipObj._sip || !number) {
            return false;
        }
        sipObj._sip.dtmf({
            dtmf: {
                tones: number
            }
        });
    },
    sipAnswer: function() {
        if (!sipObj._sip) {
            return false;
        }
        sipObj._sip.createAnswer({
            jsep: sipObj.jsep,
            media: {
                audio: true,
                video: false
            },
            success: function(jsep) {
                sipObj.onShowMsg("sip do answer");
                var body = { "request": "accept" };
                sipObj._sip.send({"message": body, "jsep": jsep});
            },
            error: function(error) {
                sipObj.onShowMsg("WebRTC error:sipAnswer");
                // Don't keep the caller waiting any longer
                var body = { "request": "decline", "code": 480 };
                sipObj._sip.send({"message": body});
            }
        });
    },
    sipHangup: function() {
        // Hangup a call
        if (!sipObj._sip) {
            return false;
        }
        var body = {
            "request": "hangup"
        };
        if(sipObj._status === 'incomingcall'){
            //decline
            sipObj.onShowMsg("sip do decline");
            body.request = "decline";
            sipObj._sip.send({
                "message": body
            });
        }else{
            //hangup
            sipObj.onShowMsg("sip do hangup");
            sipObj._sip.send({
                "message": body
            });
            sipObj._sip.hangup();
        }
    },
    _sipMessageHandler: function(msg, jsep) {
        var _event = '';
        if ('error' in msg) {
            sipObj.onShowMsg('sip msg error : ' + msg.error);
            return false;
        }
        if ('result' in msg && 'event' in msg.result) {
            _event = msg.result.event;
        }
        sipObj._status = _event;
        sipObj.onShowMsg('sip onMsg event : ' + _event);
        switch (_event) {
            case 'registered':
                sipObj._info.registered = 1;
                sipObj.onRegisterSuccess();
                break;
            case 'registration_failed':
                sipObj._info.registered = 0;
                sipObj.onRegisterFail();
                break;
            case 'calling':
                sipObj.onCalling();
                break;
            case 'incomingcall':
                sipObj.jsep = jsep;
                sipObj._sipNumber = msg.result.username;
                var _number = sipObj._getNumber(sipObj._sipNumber);
                sipObj.onIncoming(_number);
                break;
            case 'accepted':
                if(jsep !== null && jsep !== undefined) {
                    sipObj._sip.handleRemoteJsep({jsep: jsep, error: sipObj.sipHangup });
                }
                if('username' in msg.result){
                    sipObj._sipNumber = msg.result.username;
                }
                var _number = sipObj._getNumber(sipObj._sipNumber);
                sipObj.onAccepted(_number);
                break;
            case 'hangup':
                sipObj._sip.hangup();
                sipObj.onHangup(sipObj._info.user);
                break;
        }
    },

    _libInit: function() {
        if (sipObj._lib) {
            if(sipObj._sip && sipObj._info.registered === 0){
                sipObj.sipRegister();
            }
            return true;
        }
        Janus.init({
            debug: false,
            callback: function() {
                sipObj.onShowMsg('Janus lib init...');
                sipObj._lib = new Janus({
                    server: sipObj._address,
                    success: function() {
                        sipObj.onShowMsg('Janus lib connect.');
                        sipObj._libAttachSip();
                    },
                    error: function(cause) {
                        sipObj.onShowMsg('Janus lib Error!');
                        sipObj._lib = null;
                        sipObj._sip = null;
                        sipObj.onErr();
                    },
                    destroyed: function() {
                        sipObj.onShowMsg('Janus lib Destroyed!');
                        sipObj._lib = null;
                        sipObj._sip = null;
                        sipObj.onDestroyed();
                    }
                });
            }
        });
    },
    _libAttachSip: function() {
        if (!sipObj._lib) {
            return false;
        }
        sipObj._lib.attach({
            plugin: "janus.plugin.sip",
            success: function(pluginHandle) {
                // Plugin attached! 'pluginHandle' is our handle
                sipObj.onShowMsg('sip attach success');
                sipObj._sip = pluginHandle;
                sipObj.sipRegister();
            },
            error: function(error) {
                // Couldn't attach to the plugin
                sipObj.onShowMsg('sip attach error');
            },
            consentDialog: function(on) {
                // e.g., Darken the screen if on=true (getUserMedia incoming), restore it otherwise
                sipObj.onShowMsg('sip on consentDialog : '+on);
            },
            onmessage: function(msg, jsep) {
                // We got a message/event (msg) from the plugin
                // If jsep is not null, this involves a WebRTC negotiation
                sipObj._sipMessageHandler(msg, jsep);
            },
            onlocalstream: function(stream) {
                // We have a local stream (getUserMedia worked!) to display
                sipObj.onShowMsg('sip on localStream');
                //attachMediaStream($('#myvideo').get(0), stream);
                //$("#myvideo").get(0).muted = "muted";
            },
            onremotestream: function(stream) {
                // We have a remote stream (working PeerConnection!) to display
                sipObj.onShowMsg('sip on remoteStream');
                if($('video#sipRemoteVideo').length===0){
                    $('body').append('<video id="sipRemoteVideo" autoplay style="display:none"></video>');
                }
                attachMediaStream($('#sipRemoteVideo').get(0), stream);
            },
            oncleanup: function() {
                // PeerConnection with the plugin closed, clean the UI
                // The plugin handle is still valid so we can create a new one
                if($('video#sipRemoteVideo').length!==0){
                    $('video#sipRemoteVideo').remove();
                }
                sipObj.onShowMsg('sip on cleanup');
            },
            detached: function() {
                // Connection with the plugin closed, get rid of its features
                // The plugin handle is not valid anymore
                sipObj.onShowMsg('sip detached');
                sipObj._sip = null;
                sipObj.onDestroyed();
            }
        });
    },
    onShowMsg: function(txt){
        if(typeof onSipShowMsg === 'function'){
            onSipShowMsg(txt);
        }
    },
    onErr: function(){
        if(typeof onSipError === 'function'){
            onSipError();
        }
    },
    onDestroyed: function(){
        if(typeof onSipDestroyed === 'function'){
            onSipDestroyed();
        }
    },
    onRegisterSuccess: function(){
        if(typeof onSipRegisterSuccess === 'function'){
            onSipRegisterSuccess();
        }
    },
    onRegisterFail: function(){
        if(typeof onSipRegisterFail === 'function'){
            onSipRegisterFail();
        }
    },
    onCalling: function(){
        if(typeof onSipCalling === 'function'){
            onSipCalling();
        }
    },
    onIncoming: function(number){
        if(typeof onSipIncoming === 'function'){
            onSipIncoming(number);
        }
    },
    onAccepted: function(number){
        if(typeof onSetDialNumber === 'function'){
            onSetDialNumber(number);
        }
    },
    onHangup: function(user){
        if(typeof onSipHangup === 'function'){
            onSipHangup();
        }
    },
    _libEnd: function() {
        if (!sipObj._lib) {
            return false;
        }
        sipObj._lib.destroy();
        sipObj._lib = null;
        sipObj._sip = null;
    },
    _getNumber: function(user){
        if(!user){
            return 'unknown';
        }
        return user.substring(user.indexOf('sip:')+4,user.indexOf('@'));
    },
};