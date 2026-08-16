// TODO: Replace with your actual Firebase project configuration credentials
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentUsername = "";
let currentSearchUser = ""; // Filter variable for looking up individual user vaults

// DOM Elements
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const usernameInput = document.getElementById("username");
const authMessage = document.getElementById("auth-message");
const addCoinBtn = document.getElementById("add-coin-btn");
const coinsContainer = document.getElementById("coins-container");
const sectionTitle = document.getElementById("section-title");

// Search Bar Elements
const searchUsernameInput = document.getElementById("search-username");
const searchBtn = document.getElementById("search-btn");
const resetSearchBtn = document.getElementById("reset-search-btn");

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        authSection.style.display = "none";
        appSection.style.display = "block";
        
        // Fetch username from Firestore user document
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (userDoc.exists) {
            currentUsername = userDoc.data().username;
        } else {
            currentUsername = user.email.split('@')[0];
        }
        
        loadCoins();
    } else {
        currentUser = null;
        currentUsername = "";
        authSection.style.display = "block";
        appSection.style.display = "none";
    }
});

// Login / Register Handler
loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim();
    authMessage.innerText = "";

    if (!email || !password) {
        authMessage.innerText = "Please enter email and password.";
        return;
    }

    try {
        // Try logging in first
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Ensure username record exists
        const userRef = db.collection("users").doc(user.uid);
        const doc = await userRef.get();
        if (!doc.exists && username) {
            await userRef.set({ username: username });
        }
    } catch (error) {
        // If login fails, try signing up a new account
        try {
            if (!username) {
                authMessage.innerText = "Please enter a username to register a new account.";
                return;
            }
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await db.collection("users").doc(user.uid).set({ username: username });
        } catch (regError) {
            authMessage.innerText = regError.message;
        }
    }
});

// Logout Handler
logoutBtn.addEventListener("click", () => {
    auth.signOut();
});

// Add Coin Handler
addCoinBtn.addEventListener("click", async () => {
    const coinName = document.getElementById("coin-name").value.trim();
    const coinYear = document.getElementById("coin-year").value.trim();
    const imageFile = document.getElementById("coin-image").files[0];

    if (!coinName || !imageFile) {
        alert("Please provide a coin name and select an image.");
        return;
    }

    addCoinBtn.innerText = "Uploading...";
    addCoinBtn.disabled = true;

    // Convert image file to Base64 string for lightweight database storage
    const reader = new FileReader();
    reader.readAsDataURL(imageFile);
    reader.onload = async () => {
        const base64Image = reader.result;

        try {
            await db.collection("coins").add({
                name: coinName,
                year: coinYear,
                image: base64Image,
                userId: currentUser.uid,
                username: currentUsername,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            document.getElementById("coin-name").value = "";
            document.getElementById("coin-year").value = "";
            document.getElementById("coin-image").value = "";
            loadCoins();
        } catch (err) {
            alert("Error uploading coin: " + err.message);
        } finally {
            addCoinBtn.innerText = "Upload & Catalog Coin";
            addCoinBtn.disabled = false;
        }
    };
});

// Search Specific User Vault
searchBtn.addEventListener("click", () => {
    const query = searchUsernameInput.value.trim().toLowerCase();
    if (!query) return;
    currentSearchUser = query;
    sectionTitle.innerText = `Vault: ${query}`;
    loadCoins();
});

// Reset Search back to Global Feed
resetSearchBtn.addEventListener("click", () => {
    searchUsernameInput.value = "";
    currentSearchUser = "";
    sectionTitle.innerText = "Global Collection";
    loadCoins();
});

// Load and Render Coins from Firestore
function loadCoins() {
    coinsContainer.innerHTML = "<p>Loading coins...</p>";

    db.collection("coins").orderBy("createdAt", "desc").get().then((snapshot) => {
        coinsContainer.innerHTML = "";

        if (snapshot.empty) {
            coinsContainer.innerHTML = "<p>No coins found in the vault.</p>";
            return;
        }

        let visibleCount = 0;

        snapshot.forEach((doc) => {
            const coin = doc.data();
            const coinId = doc.id;
            const coinUsername = (coin.username || "").toLowerCase();

            // If a user search is active, filter out coins that don't match the searched username
            if (currentSearchUser && !coinUsername.includes(currentSearchUser)) {
                return;
            }

            visibleCount++;

            const card = document.createElement("div");
            card.className = "coin-card";

            let deleteBtnHTML = "";
            // Allow users to delete only their own uploaded coins
            if (coin.userId === currentUser.uid) {
                deleteBtnHTML = `<button class="delete-coin-btn" onclick="deleteCoin('${coinId}')">Delete Coin</button>`;
            }

            card.innerHTML = `
                <img src="${coin.image}" alt="${coin.name}">
                <h4>${coin.name}</h4>
                <p>Minted: ${coin.year || 'Unknown'}</p>
                <div class="user-tag">User: ${coin.username || 'Anonymous'}</div>
                ${deleteBtnHTML}
            `;

            coinsContainer.appendChild(card);
        });

        if (visibleCount === 0) {
            coinsContainer.innerHTML = `<p>No coins found for user "${currentSearchUser}".</p>`;
        }
    }).catch((err) => {
        coinsContainer.innerHTML = "<p>Error loading coins.</p>";
        console.error(err);
    });
}

// Delete Coin Function
window.deleteCoin = async function(coinId) {
    if (confirm("Are you sure you want to delete this coin?")) {
        try {
            await db.collection("coins").doc(coinId).delete();
            loadCoins();
        } catch (err) {
            alert("Error deleting coin: " + err.message);
        }
    }
};