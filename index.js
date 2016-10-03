'use strict';
var stream, socket, masterPC, slavePC, roomId;

const roomIdInput = document.getElementById('roomId');
const createRoom = document.getElementById('createRoom');
const joinRoom = document.getElementById('joinRoom');

const HOST = 'http://192.168.1.130:3000';

const optionsForGet = {
      'mandatory': {
        'OfferToReceiveAudio': true,
        'OfferToReceiveVideo': true
      }
  };

const optionsForSend = {
      'mandatory': {
        'OfferToReceiveAudio': false,
        'OfferToReceiveVideo': false
      }
  };


  function createPeerConnection() {
    const pc = new RTCPeerConnection({"iceServers": [{"urls": "stun:stun.l.google.com:19302"}]});
    pc.onicecandidate = gotIceCandidate;
    pc.onaddstream = gotRemoteStream;
    return pc;
  }

  function initScript(roomId, isMaster) {

      if(isMaster) navigator.mediaDevices.getUserMedia({video: {height: 340, width: 640}, audio: true}).then(setLocalStream).catch(errorHandler);

      socket.emit('user:init', {role: (isMaster ? 'master' : 'slave'), room: roomId});

        }

  function createOffer() {
    slavePC = createPeerConnection();
    slavePC.createOffer(optionsForGet)
      .then(gotLocalDescription.bind(this, false, slavePC))
      .catch(errorHandler);
  }

  function createAnswer() {
    masterPC.createAnswer(optionsForSend)
      .then(gotLocalDescription.bind(this, true, masterPC))
      .catch(errorHandler);
  }


function gotLocalDescription(role, pc, description ) {
    pc.setLocalDescription(description);
    sendWebRTCMessage(role, description);
}

function gotIceCandidate(event) {
    if (event.candidate) {
      sendWebRTCMessage(true, {
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
  }
}

function gotRemoteStream(event) {
    const cont = document.getElementById('remoteVideo');
    cont.src = URL.createObjectURL(event.stream);
    stream = event.stream;
    hideButtons(cont);
}

function errorHandler(err) {
    console.error(err);
}

function setLocalStream(e) {
  const cont = document.getElementById("remoteVideo");
  cont.src = URL.createObjectURL(e);
  hideButtons(cont);

  stream = e;
}

function hideButtons(cont) {
  cont.style.display = 'initial';
  const buttons = document.getElementById("buttons");
  buttons.style.display = 'none';
}

function sendWebRTCMessage(role, message) {
    socket.emit('webrtc:message', {isParent: role, message: message});
  }

roomIdInput.onchange = (e)=>{
  if(e.target.value.length > 2) {
    createRoom.disabled = false;
    joinRoom.disabled = false;
    roomId = e.target.value;
  } else {
    createRoom.disabled = true;
    joinRoom.disabled = true;
  }
};

createRoom.onclick = ()=>{
    socket = io(HOST);
    socket.on('connect', ()=>{
      initScript(roomId, true);
    })
    handleSocketMessage(socket);
}

joinRoom.onclick = ()=>{
    socket = io(HOST);
    socket.on('connect', ()=>{
      initScript(roomId, false);

    })
    socket.on('parent:left', (data)=>{
      slavePC.close();
        initScript(roomId, false);
    });
    handleSocketMessage(socket);
}

function handleSocketMessage(socket) {
      socket.on('user:init', (message)=>{
        createOffer();
      });

      socket.on('room:notExists', (message)=>{
      });

      setInterval(()=>{
        socket.emit('user:depth');
      })

      socket.on('user:depth', (data)=>{
        const depth = document.getElementById('depth');
        depth.innerHTML = data.depth;
      }, 3000);

      socket.on('webrtc:message', function (message) {
        if (message.type === 'offer') {
          masterPC = createPeerConnection();
          masterPC.setRemoteDescription(new RTCSessionDescription(message));
          masterPC.addStream(stream);
          createAnswer();
        } else if (message.type === 'answer') {
          slavePC.setRemoteDescription(new RTCSessionDescription(message));
        } else if (message.type === 'candidate') {
          const candidate = new RTCIceCandidate({sdpMLineIndex: message.label, candidate: message.candidate});
          slavePC.addIceCandidate(candidate);
        }
  });
}
