// ============================================
//  SyncFlow — PeerJS WebRTC Device Linker
// ============================================

let peer = null;
let conn = null;
let currentRoom = null;

// ===== DOM REFS =====
const screenSetup = document.getElementById('screen-setup');
const screenChat  = document.getElementById('screen-chat');

// Setup
const btnGenerate  = document.getElementById('btn-generate');
const qrBox        = document.getElementById('qr-box');
const qrCanvas     = document.getElementById('qr-canvas');
const roomCodeVal  = document.getElementById('room-code-value');
const btnCopyCode  = document.getElementById('btn-copy-code');
const inputCode    = document.getElementById('input-code');
const btnConnect   = document.getElementById('btn-connect');
const joinError    = document.getElementById('join-error');

// Chat
const messagesArea = document.getElementById('messages-area');
const msgInput     = document.getElementById('msg-input');
const btnSend      = document.getElementById('btn-send');
const btnAttach    = document.getElementById('btn-attach');
const fileInput    = document.getElementById('file-input');
const btnDisconnect = document.getElementById('btn-disconnect');
const chatRoomId   = document.getElementById('chat-room-id');

// Toast
const toastEl   = document.getElementById('toast');
const toastText = document.getElementById('toast-text');

// ===== UTILITY =====
function toast(msg, duration = 2500) {
    toastText.textContent = msg;
    toastEl.classList.remove('hidden');
    toastEl.classList.add('show');
    setTimeout(() => {
        toastEl.classList.remove('show');
        setTimeout(() => toastEl.classList.add('hidden'), 400);
    }, duration);
}

function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function formatTime() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(type) {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf'))     return '📕';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '🗜️';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel'))   return '📊';
    return '📄';
}

// ===== AUTO-JOIN FROM QR =====
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const peerParam = params.get('peer');
    if (peerParam) {
        inputCode.value = peerParam;
        doJoin(peerParam);
    }
});

// ===== GENERATE ROOM (PC SIDE) =====
btnGenerate.addEventListener('click', () => {
    btnGenerate.disabled = true;
    btnGenerate.innerHTML = '<span class="btn-icon">⏳</span> Connecting...';

    const roomId = generateRoomId();

    peer = new Peer(roomId, {
        debug: 0
    });

    peer.on('open', (id) => {
        currentRoom = id;
        roomCodeVal.textContent = id;
        btnGenerate.classList.add('hidden');
        qrBox.classList.remove('hidden');
        chatRoomId.textContent = 'Room: ' + id;

        // Render QR
        const joinUrl = window.location.origin + window.location.pathname + '?peer=' + id;
        QRCode.toCanvas(qrCanvas, joinUrl, {
            width: 180,
            margin: 2,
            color: { dark: '#1e293b', light: '#ffffff' }
        }, (err) => { if (err) console.error(err); });

        toast('Room created! Share the code with your phone.');
    });

    peer.on('connection', (connection) => {
        setupDataConnection(connection);
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        if (err.type === 'unavailable-id') {
            // Try again with a new ID
            btnGenerate.disabled = false;
            btnGenerate.innerHTML = '<span class="btn-icon">🔗</span> Generate Code';
            btnGenerate.classList.remove('hidden');
            qrBox.classList.add('hidden');
            toast('Code taken, try again!');
        }
    });
});

// ===== JOIN ROOM (MOBILE SIDE) =====
btnConnect.addEventListener('click', () => {
    const code = inputCode.value.trim();
    if (!code || code.length < 4) {
        showJoinError('Enter a valid 4-digit code');
        return;
    }
    doJoin(code);
});

inputCode.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnConnect.click();
});

function doJoin(code) {
    btnConnect.disabled = true;
    btnConnect.textContent = 'Connecting...';
    joinError.classList.add('hidden');

    peer = new Peer(undefined, { debug: 0 });

    peer.on('open', () => {
        currentRoom = code;
        chatRoomId.textContent = 'Room: ' + code;
        const connection = peer.connect(code, { reliable: true });
        setupDataConnection(connection);
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        btnConnect.disabled = false;
        btnConnect.textContent = 'Connect';
        showJoinError('Failed to connect: ' + err.type);
    });
}

function showJoinError(msg) {
    joinError.textContent = msg;
    joinError.classList.remove('hidden');
}

// ===== DATA CONNECTION =====
function setupDataConnection(connection) {
    conn = connection;

    conn.on('open', () => {
        switchToChat();
        toast('Devices linked! 🎉');
    });

    conn.on('data', (data) => {
        handleIncoming(data);
    });

    conn.on('close', () => {
        addSystemMsg('The other device disconnected.');
        toast('Device disconnected.');
    });

    conn.on('error', (err) => {
        console.error('Connection error:', err);
        toast('Connection error occurred.');
    });
}

// ===== SWITCH SCREENS =====
function switchToChat() {
    screenSetup.classList.remove('active');
    screenChat.classList.add('active');
    if (window.innerWidth > 700) msgInput.focus();
}

function switchToSetup() {
    screenChat.classList.remove('active');
    screenSetup.classList.add('active');
}

// ===== COPY CODE =====
btnCopyCode.addEventListener('click', () => {
    const code = roomCodeVal.textContent;
    navigator.clipboard.writeText(code).then(() => {
        toast('Code copied!');
        btnCopyCode.textContent = '✅';
        setTimeout(() => btnCopyCode.textContent = '📋', 1500);
    }).catch(() => {
        toast('Copy failed, manually share: ' + code);
    });
});

// ===== DISCONNECT =====
btnDisconnect.addEventListener('click', () => {
    if (conn) conn.close();
    if (peer) peer.destroy();
    conn = null;
    peer = null;
    currentRoom = null;

    // Reset UI
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = '<span class="btn-icon">🔗</span> Generate Code';
    btnGenerate.classList.remove('hidden');
    qrBox.classList.add('hidden');
    btnConnect.disabled = false;
    btnConnect.textContent = 'Connect';
    inputCode.value = '';

    // Clear messages
    messagesArea.innerHTML = '';

    switchToSetup();
    toast('Disconnected.');
});

// ===== SEND TEXT =====
btnSend.addEventListener('click', sendTextMessage);
msgInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendTextMessage();
});

function sendTextMessage() {
    const text = msgInput.value.trim();
    if (!text || !conn || !conn.open) return;

    conn.send({ type: 'text', content: text, time: formatTime() });
    addBubble(text, 'sent');
    msgInput.value = '';
    msgInput.focus();
}

// ===== SEND FILES =====
btnAttach.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files.length || !conn || !conn.open) return;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const arrayBuf = evt.target.result;

            conn.send({
                type: 'file',
                file: arrayBuf,
                filename: file.name,
                filetype: file.type,
                filesize: file.size,
                time: formatTime()
            });

            addFileBubble(arrayBuf, file.name, file.type, file.size, 'sent');
            toast('File sent: ' + file.name);
        };
        reader.readAsArrayBuffer(file);
    });

    fileInput.value = '';
});

// ===== HANDLE INCOMING =====
function handleIncoming(data) {
    if (data.type === 'text') {
        addBubble(data.content, 'received');
    } else if (data.type === 'file') {
        addFileBubble(data.file, data.filename, data.filetype, data.filesize, 'received');
        toast('File received: ' + data.filename);
    }
}

// ===== UI: ADD BUBBLE =====
function addBubble(text, direction) {
    const div = document.createElement('div');
    div.className = 'msg-bubble ' + direction;

    // Linkify URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const htmlContent = text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');

    div.innerHTML = htmlContent + '<span class="msg-time">' + formatTime() + '</span>';
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function addFileBubble(fileData, filename, filetype, filesize, direction) {
    const div = document.createElement('div');
    div.className = 'msg-bubble ' + direction;

    const blob = new Blob([fileData], { type: filetype });
    const url = URL.createObjectURL(blob);

    if (filetype && filetype.startsWith('image/')) {
        // Show image preview
        const img = document.createElement('img');
        img.src = url;
        img.alt = filename;
        img.style.cursor = 'pointer';
        img.onclick = () => window.open(url, '_blank');
        div.appendChild(img);
    } else {
        // Show file card
        const card = document.createElement('a');
        card.href = url;
        card.download = filename;
        card.className = 'msg-file-card';
        card.innerHTML = `
            <div class="file-icon-box">${getFileIcon(filetype)}</div>
            <div class="file-info">
                <span class="file-name">${filename}</span>
                <span class="file-size">${formatFileSize(filesize || 0)} — Tap to download</span>
            </div>
        `;
        div.appendChild(card);
    }

    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = formatTime();
    div.appendChild(time);

    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function addSystemMsg(text) {
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.innerHTML = '<span class="system-icon">ℹ️</span><span>' + text + '</span>';
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}
