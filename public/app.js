let peer = null;
let conn = null;

// DOM Elements
const setupView = document.getElementById('setup-view');
const chatView = document.getElementById('chat-view');
const btnCreateRoom = document.getElementById('btn-create-room');
const qrContainer = document.getElementById('qr-container');
const roomCodeDisplay = document.getElementById('room-code-display');
const btnJoinRoom = document.getElementById('btn-join-room');
const inputRoomCode = document.getElementById('input-room-code');
const joinError = document.getElementById('join-error');
const chatMessages = document.getElementById('chat-messages');
const inputMessage = document.getElementById('input-message');
const btnSend = document.getElementById('btn-send');
const btnFile = document.getElementById('btn-file');
const inputFile = document.getElementById('input-file');

// Initialize QR library
const renderQR = (url) => {
    const canvas = document.getElementById('qrcode');
    QRCode.toCanvas(canvas, url, { width: 200, margin: 2 }, function (error) {
        if (error) console.error(error);
    });
};

function generateId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const peerParam = urlParams.get('peer');
    if (peerParam) {
        inputRoomCode.value = peerParam;
        joinRoom(peerParam);
    }
});

function setupConnection(connection) {
    conn = connection;
    conn.on('open', () => {
        switchToChatView();
    });
    conn.on('data', (data) => {
        handleIncomingData(data);
    });
    conn.on('close', () => {
        addSystemMessage('The other device disconnected.');
    });
}

// PC: Create Room
btnCreateRoom.addEventListener('click', () => {
    btnCreateRoom.disabled = true;
    btnCreateRoom.textContent = 'Generating...';
    
    const id = generateId();
    peer = new Peer(id); // create peer with specific ID
    
    peer.on('open', (id) => {
        roomCodeDisplay.textContent = id;
        btnCreateRoom.classList.add('hidden');
        qrContainer.classList.remove('hidden');
        
        const joinUrl = `${window.location.origin}/?peer=${id}`;
        renderQR(joinUrl);
    });

    peer.on('connection', (connection) => {
        setupConnection(connection);
    });
});

// Mobile: Join Room
const joinRoom = (code) => {
    if (code.length === 4) {
        btnJoinRoom.disabled = true;
        btnJoinRoom.textContent = 'Connecting...';
        joinError.classList.add('hidden');
        
        peer = new Peer(); // random id for mobile
        peer.on('open', () => {
            const connection = peer.connect(code);
            setupConnection(connection);
        });
        
        peer.on('error', (err) => {
            showError('Failed to connect: ' + err.type);
            btnJoinRoom.disabled = false;
            btnJoinRoom.textContent = 'Connect';
        });
    }
};

btnJoinRoom.addEventListener('click', () => {
    const code = inputRoomCode.value.trim();
    if (!code) {
        showError('Please enter a 4-digit code');
        return;
    }
    joinRoom(code);
});

// Chat & UI Functions
function switchToChatView() {
    setupView.classList.remove('active');
    setupView.classList.add('hidden');
    chatView.classList.remove('hidden');
    chatView.classList.add('active');
    
    if (window.innerWidth > 600) {
        inputMessage.focus();
    }
}

function showError(msg) {
    joinError.textContent = msg;
    joinError.classList.remove('hidden');
}

function handleIncomingData(data) {
    if (data.type === 'text') {
        addMessage(data.content, 'received');
    } else if (data.type === 'file') {
        addFileMessage(data.file, data.filename, data.filetype, 'received');
    }
}

const sendMessage = () => {
    const text = inputMessage.value.trim();
    if (!text || !conn) return;

    addMessage(text, 'sent');
    conn.send({ type: 'text', content: text });

    inputMessage.value = '';
    inputMessage.focus();
};

btnSend.addEventListener('click', sendMessage);
inputMessage.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// File Transfer
btnFile.addEventListener('click', () => inputFile.click());

inputFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !conn) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const fileData = event.target.result;
        
        addFileMessage(fileData, file.name, file.type, 'sent');
        
        conn.send({
            type: 'file',
            file: fileData,
            filename: file.name,
            filetype: file.type
        });
    };
    reader.readAsArrayBuffer(file);
});

function addMessage(text, type) {
    hideWelcome();
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    
    if (text.startsWith('http://') || text.startsWith('https://')) {
        const link = document.createElement('a');
        link.href = text;
        link.target = '_blank';
        link.textContent = text;
        link.style.color = type === 'sent' ? 'white' : 'var(--primary)';
        msgDiv.appendChild(link);
    } else {
        msgDiv.textContent = text;
    }
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addFileMessage(fileData, filename, filetype, type) {
    hideWelcome();
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    
    // Create Blob from ArrayBuffer
    const blob = new Blob([fileData], { type: filetype });
    const url = URL.createObjectURL(blob);
    
    if (filetype && filetype.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        msgDiv.appendChild(img);
    } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.textContent = '📎 Download ' + filename;
        link.style.color = type === 'sent' ? 'white' : 'var(--primary)';
        link.style.textDecoration = 'underline';
        msgDiv.appendChild(link);
    }
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideWelcome() {
    const welcome = document.querySelector('.welcome-msg');
    if (welcome) welcome.style.display = 'none';
}

function addSystemMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('welcome-msg');
    msgDiv.style.marginTop = '10px';
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
