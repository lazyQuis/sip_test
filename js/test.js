function onSipRegisterSuccess(){
    $('#proxy, #user, #secret').attr('disabled','disabled');
}

function onSipRegisterFail(){
    $('#proxy, #user, #secret').val('');
}

function onSipDestroyed(){
    $('#proxy, #user, #secret').removeAttr('disabled');
}

function onSipError(){
    window.location.reload();
}

function onSipCalling(){
    $('#phone').attr('disabled','disabled');
}

function onSipIncoming(number){
    $('#phone').val(number).attr('disabled','disabled');
}

function onSipHangup(){
    $('#phone').removeAttr('disabled');
}

function onSipShowMsg(text) {
    $('#msg').prepend(text+'<br/>');
}

$(document).ready(function() {
    $('#btn_start').click(function(){
        var _proxy = $('#proxy').val();
        var _user = $('#user').val();
        var _secret = $('#secret').val();
        sipObj.init(_proxy,_user,_secret);
    });
    $('#btn_close').click(sipObj._libEnd);

    $('#btn_call').click(function(){
        var _phone = $('#phone').val();
        sipObj.sipCall(_phone);
    });
    $('#btn_hangup').click(sipObj.sipHangup);
    $('#btn_answer').click(sipObj.sipAnswer);
    $('#btn_decline').click(sipObj.sipDecline);
});
