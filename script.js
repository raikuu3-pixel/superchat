// script.js

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// State aplikasi
let currentUser = null;
let currentRoom = null;
let roomsRef = null;
let messagesRef = null;
let usersRef = null;

// DOM Elements
const loadingScreen = document.getElementById('loading');
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const usernameInput = document.getElementById('username');
const roomIdInput = document.getElementById('roomId');
const generateRoomBtn = document.getElementById('generateRoom');
const joinPublicBtn = document.getElementById('joinPublic');
const joinPrivateBtn = document.getElementById('joinPrivate');
const startChatBtn = document.getElementById('startChat');
const leaveRoomBtn = document.getElementById('leaveRoom');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const messagesContainer = document.getElementById('messagesContainer');
const usersList = document.getElementById('usersList');
const inviteButton = document.getElementById('inviteButton');
const inviteModal = document.getElementById('inviteModal');
const inviteCode = document.getElementById('inviteCode');
const copyInviteCodeBtn = document.getElementById('copyInviteCode');
const closeModalBtn = document.querySelector('.close-modal');
const onlineUsersSpan = document.getElementById('onlineUsers');
const totalMessagesSpan = document.getElementById('totalMessages');
const activeRoomsSpan = document.getElementById('activeRooms');
const roomNameSpan = document.getElementById('roomName');
const roomCodeSpan = document.querySelector('#roomCode span');
const roomUsersSpan = document.getElementById('roomUsers');

// Generate random room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Update stats global
function updateGlobalStats() {
    // Hitung pengguna online
    const usersOnlineRef = database.ref('users');
    usersOnlineRef.once('value', (snapshot) => {
        const users = snapshot.val();
        let count = 0;
        for (let id in users) {
            if (users[id].online) count++;
        }
        onlineUsersSpan.textContent = count;
    });

    // Hitung total pesan
    const messagesRef = database.ref('messages');
    messagesRef.once('value', (snapshot) => {
        const messages = snapshot.val();
        let count = 0;
        for (let room in messages) {
            for (let id in messages[room]) {
                count++;
            }
        }
        totalMessagesSpan.textContent = count;
    });

    // Hitung room aktif
    const roomsRef = database.ref('rooms');
    roomsRef.once('value', (snapshot) => {
        const rooms = snapshot.val();
        let count = 0;
        for (let id in rooms) {
            count++;
        }
        activeRoomsSpan.textContent = count;
    });
}

// Tampilkan pesan
function displayMessage(message, isSystem = false) {
    const messageDiv = document.createElement('div');
    
    if (isSystem) {
        messageDiv.className = 'system-message';
        messageDiv.innerHTML = `<p>${message.content}</p>`;
    } else {
        const isSent = message.senderId === currentUser.id;
        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender-name">${message.senderName}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${message.content}</div>
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update daftar pengguna di room
function updateUsersList(users) {
    usersList.innerHTML = '';
    let count = 0;
    
    for (let userId in users) {
        const user = users[userId];
        if (user.online) {
            count++;
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            userDiv.innerHTML = `
                <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <h4>${user.name} ${userId === currentUser.id ? '(Anda)' : ''}</h4>
                    <div class="user-status online">
                        <i class="fas fa-circle"></i> Online
                    </div>
                </div>
            `;
            usersList.appendChild(userDiv);
        }
    }
    
    roomUsersSpan.textContent = count;
}

// Join room
function joinRoom(roomId, username) {
    // Sembunyikan loading setelah timeout singkat
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 1000);

    currentUser = {
        id: Date.now().toString(),
        name: username,
        online: true
    };
    
    currentRoom = roomId || 'PUBLIC';
    
    // Update UI
    roomNameSpan.textContent = currentRoom === 'PUBLIC' ? 'Room Publik' : `Room ${currentRoom}`;
    roomCodeSpan.textContent = currentRoom;
    inviteCode.textContent = currentRoom;
    
    // Referensi Firebase
    roomsRef = database.ref(`rooms/${currentRoom}`);
    messagesRef = database.ref(`messages/${currentRoom}`);
    usersRef = database.ref(`users/${currentRoom}`);
    
    // Set user online
    usersRef.child(currentUser.id).set({
        name: currentUser.name,
        online: true,
        joinedAt: Date.now()
    });
    
    // Listen untuk perubahan user
    usersRef.on('value', (snapshot) => {
        const users = snapshot.val() || {};
        updateUsersList(users);
    });
    
    // Listen untuk pesan baru
    messagesRef.limitToLast(100).on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
    });
    
    // Kirim pesan sistem
    const systemMessage = {
        content: `${currentUser.name} bergabung ke chat`,
        timestamp: Date.now(),
        type: 'system'
    };
    
    messagesRef.push(systemMessage);
    
    // Update stats global
    updateGlobalStats();
    
    // Pindah ke layar chat
    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');
}

// Event Listeners
generateRoomBtn.addEventListener('click', () => {
    roomIdInput.value = generateRoomCode();
});

joinPublicBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Masukkan nama terlebih dahulu!');
        return;
    }
    
    loadingScreen.style.display = 'flex';
    joinRoom('PUBLIC', username);
});

joinPrivateBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const roomId = roomIdInput.value.trim().toUpperCase();
    
    if (!username) {
        alert('Masukkan nama terlebih dahulu!');
        return;
    }
    
    if (!roomId) {
        alert('Masukkan kode room atau gunakan room publik!');
        return;
    }
    
    loadingScreen.style.display = 'flex';
    joinRoom(roomId, username);
});

// Kirim pesan
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !currentUser) return;
    
    const message = {
        senderId: currentUser.id,
        senderName: currentUser.name,
        content: content,
        timestamp: Date.now(),
        type: 'text'
    };
    
    messagesRef.push(message);
    messageInput.value = '';
}

// Leave room
leaveRoomBtn.addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin keluar dari room?')) {
        // Set user offline
        usersRef.child(currentUser.id).update({
            online: false,
            leftAt: Date.now()
        });
        
        // Kirim pesan sistem
        const systemMessage = {
            content: `${currentUser.name} meninggalkan chat`,
            timestamp: Date.now(),
            type: 'system'
        };
        
        messagesRef.push(systemMessage);
        
        // Hapus listeners
        usersRef.off();
        messagesRef.off();
        
        // Reset state
        currentUser = null;
        currentRoom = null;
        
        // Kembali ke login
        chatScreen.classList.remove('active');
        loginScreen.classList.add('active');
        messagesContainer.innerHTML = '';
        usersList.innerHTML = '';
        
        // Update stats
        updateGlobalStats();
    }
});

// Invite modal
inviteButton.addEventListener('click', () => {
    inviteModal.classList.add('show');
});

closeModalBtn.addEventListener('click', () => {
    inviteModal.classList.remove('show');
});

copyInviteCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(inviteCode.textContent)
        .then(() => alert('Kode room disalin!'))
        .catch(err => console.error('Gagal menyalin: ', err));
});

// Tutup modal ketika klik di luar
window.addEventListener('click', (event) => {
    if (event.target === inviteModal) {
        inviteModal.classList.remove('show');
    }
});

// Update stats saat pertama kali load
window.addEventListener('load', () => {
    updateGlobalStats();
    loadingScreen.style.display = 'none';
    loginScreen.classList.add('active');
});