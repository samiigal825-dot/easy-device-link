// =============================================
//  SyncFlow — Full-Featured P2P Device Linker
// =============================================

let peer = null;
let conn = null;
let currentRoom = null;

// ===== DOM =====
const screenSetup = document.getElementById('screen-setup');
const screenChat  = document.getElementById('screen-chat');

// Setup
const btnGenerate = document.getElementById('btn-generate');
const qrResult    = document.getElementById('qr-result');
const qrImg       = document.getElementById('qr-img');
const codeDisplay = document.getElementById('code-display');
const btnCopy     = document.getElementById('btn-copy');
const shareUrl    = document.getElementById('share-url');
const btnCopyUrl  = document.getElementById('btn-copy-url');
const inputCode   = document.getElementById('input-code');
const btnJoin     = document.getElementById('btn-join');
const joinErr     = document.getElementById('join-err');

// Chat
const msgList      = document.getElementById('msg-list');
const txtInput     = document.getElementById('txt-input');
const btnSend      = document.getElementById('btn-send');
const btnAttach    = document.getElementById('btn-attach');
const filePick     = document.getElementById('file-pick');
const btnEnd       = document.getElementById('btn-end');
const chRoom       = document.getElementById('ch-room');

// Toast
const toastEl = document.getElementById('toast');
let toastTimer = null;

// ===== HELPERS =====
function toast(msg, ms) {
    ms = ms || 2500;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
        toastEl.classList.remove('on');
    }, ms);
}

function genId() {
    return String(Math.floor(1000 + Math.random() * 9000));
}

function timeNow() {
    var d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtSize(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
}

function fileIcon(type) {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.indexOf('pdf') !== -1) return '📕';
    if (type.indexOf('zip') !== -1 || type.indexOf('rar') !== -1 || type.indexOf('7z') !== -1) return '🗜️';
    if (type.indexOf('word') !== -1 || type.indexOf('document') !== -1) return '📝';
    if (type.indexOf('sheet') !== -1 || type.indexOf('excel') !== -1) return '📊';
    if (type.indexOf('presentation') !== -1 || type.indexOf('powerpoint') !== -1) return '📊';
    return '📄';
}

function linkify(text) {
    var urlRe = /(https?:\/\/[^\s<]+)/g;
    return text.replace(urlRe, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ===== AUTO JOIN FROM QR =====
document.addEventListener('DOMContentLoaded', function() {
    var params = new URLSearchParams(window.location.search);
    var p = params.get('peer');
    if (p) {
        inputCode.value = p;
        doJoin(p);
    }
});

// ===== GENERATE ROOM =====
btnGenerate.addEventListener('click', function() {
    btnGenerate.disabled = true;
    btnGenerate.textContent = 'Connecting…';

    var id = genId();

    peer = new Peer(id, { debug: 0 });

    peer.on('open', function(myId) {
        currentRoom = myId;
        codeDisplay.textContent = myId;
        chRoom.textContent = 'Room: ' + myId;

        // Build join URL
        var base = window.location.origin + window.location.pathname;
        var joinUrl = base + '?peer=' + myId;
        shareUrl.value = joinUrl;

        // QR — render to data URL (this is the fix — canvas method was unreliable)
        if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
            QRCode.toDataURL(joinUrl, {
                width: 256,
                margin: 2,
                color: { dark: '#1e293b', light: '#ffffff' }
            }).then(function(url) {
                qrImg.src = url;
            }).catch(function(err) {
                console.error('QR error:', err);
                // Fallback: use a public API
                qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=' + encodeURIComponent(joinUrl);
            });
        } else {
            // Library didn't load — use public API fallback
            qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=' + encodeURIComponent(joinUrl);
        }

        btnGenerate.classList.add('hidden');
        qrResult.classList.remove('hidden');

        toast('Room ' + myId + ' created!');
    });

    peer.on('connection', function(connection) {
        wireConnection(connection);
    });

    peer.on('error', function(err) {
        console.error('Peer error:', err);
        if (err.type === 'unavailable-id') {
            // ID taken — retry with new ID
            peer.destroy();
            btnGenerate.disabled = false;
            btnGenerate.textContent = 'Generate Code';
            toast('Code taken, try again!');
        }
    });
});

// ===== JOIN ROOM =====
btnJoin.addEventListener('click', function() {
    var code = inputCode.value.trim();
    if (!code || code.length < 4) {
        showJoinErr('Enter a valid 4-digit code');
        return;
    }
    doJoin(code);
});

inputCode.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') btnJoin.click();
});

// Only allow numbers in code input
inputCode.addEventListener('input', function() {
    inputCode.value = inputCode.value.replace(/[^0-9]/g, '').slice(0, 4);
});

function doJoin(code) {
    btnJoin.disabled = true;
    btnJoin.textContent = 'Connecting…';
    joinErr.classList.add('hidden');

    peer = new Peer(undefined, { debug: 0 });

    peer.on('open', function() {
        currentRoom = code;
        chRoom.textContent = 'Room: ' + code;
        var connection = peer.connect(code, { reliable: true });
        wireConnection(connection);
    });

    peer.on('error', function(err) {
        console.error('Peer error:', err);
        btnJoin.disabled = false;
        btnJoin.textContent = 'Connect';

        if (err.type === 'peer-unavailable') {
            showJoinErr('Room not found. Check the code and try again.');
        } else {
            showJoinErr('Connection failed: ' + err.type);
        }
    });
}

function showJoinErr(msg) {
    joinErr.textContent = msg;
    joinErr.classList.remove('hidden');
}

// ===== DATA CONNECTION =====
function wireConnection(connection) {
    conn = connection;

    conn.on('open', function() {
        goToChat();
        toast('Devices linked! 🎉');
    });

    conn.on('data', function(data) {
        onData(data);
    });

    conn.on('close', function() {
        addSysMsg('The other device disconnected.');
        toast('Device disconnected');
    });

    conn.on('error', function(err) {
        console.error('Conn error:', err);
        toast('Connection error');
    });
}

// ===== SCREEN SWITCH =====
function goToChat() {
    screenSetup.classList.remove('visible');
    screenChat.classList.add('visible');
    if (window.innerWidth > 700) txtInput.focus();
}

function goToSetup() {
    screenChat.classList.remove('visible');
    screenSetup.classList.add('visible');
}

// ===== COPY =====
btnCopy.addEventListener('click', function() {
    copyText(codeDisplay.textContent, 'Code copied!');
});

btnCopyUrl.addEventListener('click', function() {
    copyText(shareUrl.value, 'Link copied!');
});

function copyText(text, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            toast(msg);
        }).catch(function() {
            fallbackCopy(text, msg);
        });
    } else {
        fallbackCopy(text, msg);
    }
}

function fallbackCopy(text, msg) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        toast(msg);
    } catch (e) {
        toast('Copy failed');
    }
    document.body.removeChild(ta);
}

// ===== DISCONNECT =====
btnEnd.addEventListener('click', function() {
    if (conn) { try { conn.close(); } catch(e) {} }
    if (peer) { try { peer.destroy(); } catch(e) {} }
    conn = null;
    peer = null;
    currentRoom = null;

    // Reset setup UI
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Generate Code';
    btnGenerate.classList.remove('hidden');
    qrResult.classList.add('hidden');
    btnJoin.disabled = false;
    btnJoin.textContent = 'Connect';
    inputCode.value = '';
    joinErr.classList.add('hidden');

    // Clear messages
    msgList.innerHTML = '';

    // Remove ?peer= from URL
    if (window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    goToSetup();
    toast('Disconnected');
}); 

// ===== SEND TEXT =====
btnSend.addEventListener('click', sendText);
txtInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendText();
    }
});

function sendText() {
    var text = txtInput.value.trim();
    if (!text || !conn || !conn.open) return;

    conn.send({ type: 'text', content: text, time: timeNow() });
    addBubble(text, 'out');
    txtInput.value = '';
    txtInput.focus();
}

// ===== SEND FILE =====
btnAttach.addEventListener('click', function() {
    filePick.click();
});

filePick.addEventListener('change', function() {
    var files = filePick.files;
    if (!files || !files.length || !conn || !conn.open) return;

    for (var i = 0; i < files.length; i++) {
        (function(file) {
            var reader = new FileReader();
            reader.onload = function(ev) {
                var buf = ev.target.result;
                conn.send({
                    type: 'file',
                    file: buf,
                    filename: file.name,
                    filetype: file.type,
                    filesize: file.size,
                    time: timeNow()
                });
                addFileBubble(buf, file.name, file.type, file.size, 'out');
                toast('Sent: ' + file.name);
            };
            reader.readAsArrayBuffer(file);
        })(files[i]);
    }

    filePick.value = '';
});

// ===== INCOMING DATA =====
function onData(data) {
    if (data.type === 'text') {
        addBubble(data.content, 'in');
    } else if (data.type === 'file') {
        addFileBubble(data.file, data.filename, data.filetype, data.filesize, 'in');
        toast('Received: ' + data.filename);
    }
}

// ===== UI: BUBBLES =====
function addBubble(text, dir) {
    var div = document.createElement('div');
    div.className = 'bubble ' + dir;

    var safe = escHtml(text);
    var linked = linkify(safe);
    div.innerHTML = linked + '<span class="ts">' + timeNow() + '</span>';

    msgList.appendChild(div);
    scrollBottom();
}

function addFileBubble(fileData, name, type, size, dir) {
    var div = document.createElement('div');
    div.className = 'bubble ' + dir;

    var blob = new Blob([fileData], { type: type || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);

    if (type && type.startsWith('image/')) {
        var img = document.createElement('img');
        img.src = url;
        img.alt = name;
        img.style.cursor = 'pointer';
        img.addEventListener('click', function() {
            window.open(url, '_blank');
        });
        div.appendChild(img);
    } else if (type && type.startsWith('video/')) {
        var vid = document.createElement('video');
        vid.src = url;
        vid.controls = true;
        vid.style.maxWidth = '100%';
        vid.style.borderRadius = '12px';
        div.appendChild(vid);
    } else if (type && type.startsWith('audio/')) {
        var aud = document.createElement('audio');
        aud.src = url;
        aud.controls = true;
        aud.style.width = '100%';
        div.appendChild(aud);
    } else {
        var card = document.createElement('a');
        card.href = url;
        card.download = name;
        card.className = 'file-card';
        card.innerHTML =
            '<div class="fc-icon">' + fileIcon(type) + '</div>' +
            '<div class="fc-info">' +
                '<span class="fc-name">' + escHtml(name) + '</span>' +
                '<span class="fc-size">' + fmtSize(size) + ' — Tap to download</span>' +
            '</div>';
        div.appendChild(card);
    }

    var ts = document.createElement('span');
    ts.className = 'ts';
    ts.textContent = timeNow();
    div.appendChild(ts);

    msgList.appendChild(div);
    scrollBottom();
}

function addSysMsg(text) {
    var div = document.createElement('div');
    div.className = 'sys-msg';
    div.innerHTML = '<span>ℹ️</span><span>' + escHtml(text) + '</span>';
    msgList.appendChild(div);
    scrollBottom();
}

function scrollBottom() {
    msgList.scrollTop = msgList.scrollHeight;
}
