import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-TJ2069bqGcE6FDNQeps7wBWLIjfcD9w",
  authDomain: "prime-vault-41987.firebaseapp.com",
  projectId: "prime-vault-41987",
  storageBucket: "prime-vault-41987.firebasestorage.app",
  messagingSenderId: "437248741084",
  appId: "1:437248741084:web:4fa7dd89569e7e19a72e19"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// --- AUTHENTICATION LOGIC ---
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    const msg = document.getElementById('auth-message');
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        msg.innerText = "Success! Loading vault...";
    } catch (error) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            if (username) {
                await updateProfile(userCredential.user, { displayName: username });
            }
            msg.innerText = "New account created! Loading vault...";
        } catch (err) {
            msg.innerText = "Error: " + err.message;
        }
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        loadPermanentCoins(); 
    }
});

// --- DATABASE LOGIC WITH LOCAL FILE READER ---
document.getElementById('coin-form').addEventListener('submit', async function(e) {
    e.preventDefault(); 
    
    const name = document.getElementById('coin-name').value;
    const year = parseInt(document.getElementById('mint-year').value);
    const condition = document.getElementById('condition').value;
    const fileInput = document.getElementById('coin-file');

    const age = 2026 - year;
    let baseValue = 50 + (age * 1.5);
    const estimatedValue = (baseValue * 1.5).toFixed(2);
    const displayName = currentUser.displayName || currentUser.email.split('@')[0];

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        
        reader.onload = async function(uploadEvent) {
            const base64Image = uploadEvent.target.result;
            
            try {
                await addDoc(collection(db, "global_coins"), {
                    ownerName: displayName,
                    coinName: name,
                    mintYear: year,
                    condition: condition,
                    value: estimatedValue,
                    photoData: base64Image,
                    timestamp: new Date()
                });
                
                loadPermanentCoins(); 
                document.getElementById('coin-form').reset();
            } catch (e) {
                console.error("Error saving coin: ", e);
            }
        };
        
        reader.readAsDataURL(fileInput.files[0]);
    }
});

async function loadPermanentCoins() {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = ""; 
    
    const querySnapshot = await getDocs(collection(db, "global_coins"));
    
    querySnapshot.forEach((documentSnapshot) => {
        const data = documentSnapshot.data();
        const docId = documentSnapshot.id; // Get unique ID to delete later
        
        let imageHtml = '';
        if (data.photoData) {
            imageHtml = `<img src="${data.photoData}" alt="${data.coinName}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 6px; margin-bottom: 10px;">`;
        }
        
        const card = document.createElement('div');
        card.className = 'coin-card';
        card.innerHTML = `
            ${imageHtml}
            <div class="coin-name">${data.coinName}</div>
            <div class="coin-details">Minted: ${data.mintYear} (${data.condition})</div>
            <div class="coin-details" style="color: #d4af37; margin-top: 4px;">User: ${data.ownerName}</div>
            <div class="coin-value">₹${data.value}</div>
            <button class="delete-btn" data-id="${docId}" style="background-color: #ff4c4c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-top: 10px; width: 100%;">Delete Coin</button>
        `;
        
        // Attach delete event to the button
        card.querySelector('.delete-btn').addEventListener('click', async () => {
            if (confirm("Are you sure you want to delete this coin from the vault?")) {
                await deleteDoc(doc(db, "global_coins", docId));
                loadPermanentCoins(); // Refresh grid
            }
        });

        grid.prepend(card); 
    });
}

// --- SEARCH FILTER LOGIC ---
document.getElementById('search-bar').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const allCards = document.querySelectorAll('.coin-card');
    
    allCards.forEach(card => {
        const text = card.innerText.toLowerCase();
        if (text.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
});