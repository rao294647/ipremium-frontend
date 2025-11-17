import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
// Cleaned up Firestore imports to only include what is used
import { getFirestore, doc, collection, query, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'; 
// Removed direct import of jsPDF since it's loaded via CDN script below

// --- CDN Loading Logic ---
const script = document.createElement('script');
script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
document.head.appendChild(script);

// --- CONFIGURATION & GLOBAL VARIABLES ---
// eslint-disable-next-line no-undef
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// eslint-disable-next-line no-undef
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
// eslint-disable-next-line no-undef
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : undefined;

// CRITICAL FIX: The API key must be provided here. 
// For production, use secure environment variables, but for this component, a placeholder reminder is necessary.
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"; 

// Hardcoded Credentials for Login Screen Simulation (ID: Admin, Password: Admin)
const LOGIN_CREDENTIALS = {
    ID: "Admin",
    PASSWORD: "Admin"
};

// Firebase initialization and setup
let app, db, auth;
if (Object.keys(firebaseConfig).length) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}

// --- LIGHT THEME AESTHETIC CONSTANTS ---
const COLORS = {
  // Switched to light theme:
  primary: '#F9FAFB', // Light Background
  secondary: '#DAA520', // Gold/Premium Accent (Same)
  accent: '#0D99FF', // Neon Blue (Same)
  glass: 'rgba(255, 255, 255, 0.8)', // Light Glass Base (Lighter)
  glassDark: 'rgba(240, 240, 245, 0.9)', // Sidebar/Card Base (Very Light)
  textLight: '#1F2937', // Dark Text
  textDark: '#101820', // Primary Dark Color for elements
};

// --- UTILITY FUNCTIONS ---

/**
 * Generates a unique invoice number (IP-YYYY-####)
 * @param {number} index - The latest invoice index.
 * @returns {string} The formatted invoice number.
 */
const generateInvoiceNumber = (index) => {
    const year = new Date().getFullYear();
    const paddedIndex = String(index + 1).padStart(4, '0');
    return `IP-${year}-${paddedIndex}`;
};

/**
 * Generates a WhatsApp deep link URL.
 * @param {string} phoneNumber - The recipient's phone number.
 * @param {string} customerName - The customer's name.
 * @param {string} invoiceNumber - The invoice number.
 * @returns {string} The WhatsApp URL.
 */
const generateWhatsAppLink = (phoneNumber, customerName, invoiceNumber) => {
    // Sanitize phone number (remove non-digits, typically WA expects country code included)
    const cleanNumber = phoneNumber.replace(/\D/g, ''); 
    
    const message = `Hi ${customerName}, thank you for choosing iPremium! Your repair receipt ${invoiceNumber} is ready. 
    
Please find the PDF attached (it should be in your recent downloads) and confirm successful receipt.`;
    
    const encodedMessage = encodeURIComponent(message.trim());
    return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
};

/**
 * Formats a number to currency string (INR).
 * @param {number} amount
 * @returns {string}
 */
const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

// Simple number to words function for the Invoice PDF (Indian numbering system)
const numberToWords = (n) => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    let num = ('000000000' + n).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!num) return 'Zero Rupees Only';

    const p = num.slice(1).map(Number);
    let str = '';

    str += (p[0] !== 0) ? (a[p[0]] || b[String(p[0])[0]] + ' ' + a[String(p[0])[1]]) + 'crore ' : '';
    str += (p[1] !== 0) ? (a[p[1]] || b[String(p[1])[0]] + ' ' + a[String(p[1])[1]]) + 'lakh ' : '';
    str += (p[2] !== 0) ? (a[p[2]] || b[String(p[2])[0]] + ' ' + a[String(p[2])[1]]) + 'thousand ' : '';
    str += (p[3] !== 0) ? (a[p[3]]) + 'hundred ' : '';
    str += (p[4] !== 0) ? ((str !== '') ? 'and ' : '') + (a[p[4]] || b[String(p[4])[0]] + ' ' + a[String(p[4])[1]]) : '';
    
    return (str.trim() || 'Zero') + ' Rupees Only.';
};


/**
 * Handles toast notifications for feedback.
 * @param {string} message - The message to display.
 * @param {'success' | 'error' | 'warning'} type - The type of notification.
 */
const showToast = (message, type) => {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-message fixed right-4 top-4 p-3 pr-10 mb-3 rounded-lg shadow-xl font-sans transition-all duration-300 transform translate-x-full
                       ${type === 'success' ? 'bg-green-600/80' : type === 'error' ? 'bg-red-600/80' : 'bg-yellow-600/80'} backdrop-blur-md text-white z-[100]`;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    toast.innerHTML = `<div class="flex items-center space-x-2 font-semibold"><span class="text-xl">${icon}</span><span>${message}</span></div>`;

    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'absolute top-1 right-2 text-white opacity-70 hover:opacity-100';
    closeButton.innerHTML = '&times;';
    toast.appendChild(closeButton);

    toastContainer.prepend(toast);

    // Animate in and out
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        toast.style.transform = 'translateX(calc(100% + 1rem))';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

// --- ICON COMPONENT (Moved to top level) ---

const Icon = ({ name, className = '', size = 24 }) => {
    const iconMap = {
        'LayoutDashboard': '📊',
        'FilePlus': '📄+',
        'Settings': '⚙️',
        'LogOut': '🚪',
        'Trash2': '🗑️',
        'Download': '⬇️',
        'WhatsApp': '💬',
        'OpenInDrive': '☁️',
        'Eye': '👁️',
        'Check': '✅',
        'X': '❌',
        'ChevronDown': '▼',
        'Plus': '+',
        'Sparkle': '✨',
        'Volume2': '🔊',
        'DollarSign': '💰',
        'MessageSquare': '✉️',
        'Info': 'ℹ️',
    };
    const defaultIcon = '★';

    return <span className={className} style={{ fontSize: size/1.5 }}>{iconMap[name] || defaultIcon}</span>;
};


// --- GEMINI API HELPERS (Updated with new features) ---

/**
 * Calls the Gemini API to generate professional text based on a user's brief input.
 * @param {string} issueDescription - The short, often technical description (e.g., "dead").
 * @returns {Promise<string>} A promise that resolves to the professionally expanded description.
 */
const generateProfessionalIssueDescription = async (issueDescription) => {
    if (!issueDescription || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        showToast("Gemini API Key missing. Using original description.", 'warning');
        return issueDescription;
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const userQuery = `Expand the following brief technical fault description into a professional, polite, and customer-facing statement suitable for an Apple Service Centre receipt. Keep it concise, professional, and under 20 words. Fault: "${issueDescription}"`;
    
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        config: { 
            systemInstruction: "You are a professional service manager. Your task is to rephrase technical notes into polite, customer-facing language."
        },
    };

    for (let i = 0; i < 3; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || `Could not expand issue: ${issueDescription}`;
                return text.trim().replace(/^"/, '').replace(/"$/, ''); 
            } else if (response.status === 429 && i < 2) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            } else {
                throw new Error(`API call failed with status: ${response.status}`);
            }
        } catch (error) {
            console.error("Gemini API Error:", error);
            if (i === 2) throw error; 
        }
    }
    return `Failed to expand issue due to API error. Original: ${issueDescription}`;
};


/**
 * Calls the Gemini API to predict repair cost and certainty.
 * @param {string} deviceType - The device type (e.g., iPhone).
 * @param {string} issueDescription - The detailed issue description.
 * @returns {Promise<object>} Object with { costEstimate: number, certainty: string }
 */
const predictRepairCost = async (deviceType, issueDescription) => {
    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        showToast("Gemini API Key missing. Using mock prediction.", 'warning');
        return { costEstimate: 4500, certainty: "Medium" };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const systemPrompt = `You are an expert Apple Service Technician. Based on the device and fault, provide a realistic Indian Rupee (INR) cost estimate (return only the number) and a certainty level (High/Medium/Low). Base your response only on the requested JSON schema.`;
    const userQuery = `Predict the cost and certainty for repairing a ${deviceType} with the fault: "${issueDescription}".`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    costEstimate: {
                        type: "INTEGER",
                        description: "The estimated cost of repair in Indian Rupees (INR), rounded to the nearest 500."
                    },
                    certainty: {
                        type: "STRING",
                        description: "The certainty level of the estimate: High, Medium, or Low."
                    },
                    notes: {
                        type: "STRING",
                        description: "Brief note explaining the potential cause."
                    }
                }
            }
        }
    };
    
    for (let i = 0; i < 3; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (jsonText) {
                    const parsed = JSON.parse(jsonText);
                    return { costEstimate: parsed.costEstimate || 0, certainty: parsed.certainty || 'Low', notes: parsed.notes || 'No specific notes.' };
                }
            } else if (response.status === 429 && i < 2) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            } else {
                throw new Error(`API call failed with status: ${response.status}`);
            }
        } catch (error) {
            console.error("Gemini Cost Prediction Error:", error);
            if (i === 2) throw error; 
        }
    }
    return { costEstimate: 0, certainty: "Failed", notes: "API request failed after multiple retries." };
};


/**
 * Calls the Gemini API to draft a customer follow-up message.
 * @param {string} customerName - The customer's name.
 * @param {string} deviceType - The device type.
 * @param {number} amount - The final repair amount.
 * @returns {Promise<string>} A ready-to-use WhatsApp message draft.
 */
const draftFollowUpMessage = async (customerName, deviceType, amount) => {
    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        return `Hi ${customerName}, your ${deviceType} repair for ${formatCurrency(amount)} is complete. Please pick it up soon!`;
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const userQuery = `Draft a polite, professional, and concise WhatsApp message to ${customerName}. The message should confirm that their ${deviceType} repair is complete and the final amount is ${formatCurrency(amount)}. Ask them politely to confirm a pickup time.`;
    
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        config: { 
            systemInstruction: "You are a courteous service assistant. Draft a single, friendly paragraph."
        },
    };

    for (let i = 0; i < 3; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || `Error drafting message for ${customerName}.`;
                return text.trim();
            } else if (response.status === 429 && i < 2) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            } else {
                throw new Error(`API call failed with status: ${response.status}`);
            }
        } catch (error) {
            console.error("Gemini Message Draft Error:", error);
            if (i === 2) throw error; 
        }
    }
    return `[AI Draft Failed] Please contact ${customerName} regarding their completed ${deviceType} repair. Amount: ${formatCurrency(amount)}`;
};


/**
 * Mock function to simulate the Text-to-Speech API call, as a public Gemini TTS API is not currently available.
 * @param {string} text - The text to synthesize.
 * @returns {Promise<string>} A promise that resolves to a mock URL or null.
 */
const generateSpeech = async (text) => {
    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        showToast("TTS failed. Gemini API Key missing.", 'error');
        return null;
    }
    
    console.log("TTS Mock: Simulating audio generation for:", text);

    // Simulate network delay and audio playback
    return new Promise(resolve => {
        setTimeout(() => {
            showToast('🔊 Playing diagnostics summary (Simulated).', 'success');
            // In a real scenario, an Audio object would be created and played here using a returned audio file URL
            resolve('mock-audio-url'); 
        }, 1500); // 1.5 second simulation delay
    });
};


// --- CORE FIREBASE HOOK (Logic updated for simulated login) ---

const useFirebase = (isLoggedIn, setIsLoggedIn) => {
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [invoices, setInvoices] = useState([]);

    useEffect(() => {
        if (!auth || !db) {
            console.error("Firebase not initialized.");
            setIsAuthReady(true); // Mark ready even if failed to continue local development
            return;
        }

        let unsubscribe = () => {};
        
        // 1. Initial Authentication (FIXED: Ensure anonymous sign-in for a userId)
        const authenticateFirebase = async () => {
             // 1a. Attempt to sign in with token if available (highest privilege)
            if (initialAuthToken) {
                try {
                    const userCredential = await signInWithCustomToken(auth, initialAuthToken);
                    setUserId(userCredential.user.uid);
                } catch (e) {
                     console.error("Token sign-in failed:", e);
                     // 1b. Fallback to anonymous if token fails
                     try {
                        const userCredential = await signInAnonymously(auth);
                        setUserId(userCredential.user.uid);
                     } catch (e) {
                          console.error("Anonymous sign-in failed:", e);
                     }
                }
            } else if (!auth.currentUser) {
                 // 1c. If no token, attempt anonymous sign in to get a uid
                 try {
                    const userCredential = await signInAnonymously(auth);
                    setUserId(userCredential.user.uid);
                 } catch (e) {
                      console.error("Anonymous sign-in failed:", e);
                 }
            } else {
                 setUserId(auth.currentUser.uid);
            }
            setIsAuthReady(true);
        };
        authenticateFirebase();

        
        // 2. Data Fetching (Only run if the user is explicitly logged in via the LoginPage simulation)
        // This listener is now dependent on the manual login (isLoggedIn) but uses the Firebase userId.
        if (isLoggedIn) {
            const invoicesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'invoices');
            const q = query(invoicesCollectionRef);

            unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedInvoices = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    invoiceDate: doc.data().invoiceDate?.toDate ? doc.data().invoiceDate.toDate().toISOString().split('T')[0] : doc.data().invoiceDate || 'N/A',
                    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(),
                }));
                fetchedInvoices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                setInvoices(fetchedInvoices);
            }, (error) => {
                // This error is now likely due to strict server-side rules.
                console.error("[CONSOLE_ERROR] Error fetching real-time invoices: ", error);
                showToast('Failed to load real-time data. Check Firebase permissions.', 'error');
            });
        } else {
            // Clear invoices if logged out
            setInvoices([]);
        }


        // 3. Cleanup
        const authUnsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(null);
            }
        });


        return () => {
            if (unsubscribe) unsubscribe(); // Firestore listener cleanup
            authUnsubscribe(); // Auth listener cleanup
        };
    }, [initialAuthToken, isLoggedIn, setIsLoggedIn]); // Re-run effect when isLoggedIn state changes

    const safeUserId = useMemo(() => userId || 'Anonymous', [userId]); // Default to 'Anonymous' if null

    const handleLogout = useCallback(async () => {
        try {
            // Sign out Firebase user (if any)
            if (auth.currentUser) await signOut(auth);
            
            // CRITICAL FIX: Ensure the local isLoggedIn state is reset to enforce routing back to LoginPage
            setUserId(null);
            setIsLoggedIn(false); 
            showToast('Logged out successfully.', 'success');
        } catch (error) {
            showToast('Logout failed.', 'error');
            console.error('Logout error:', error);
        }
    }, [setIsLoggedIn]);

    return { userId: safeUserId, isAuthReady, invoices, handleLogout };
};


// --- PDF GENERATION UTILITY (Same logic, updated colors) ---

const generateInvoicePDF = (invoiceData) => {
    if (typeof window.jsPDF === 'undefined') {
        return null;
    }

    const { jsPDF } = window;
    const doc = new jsPDF('p', 'mm', [150, 210]); 
    let y = 10;
    const margin = 8;
    const pageWidth = doc.internal.pageSize.getWidth();
    const lineHeight = 5;
    const padding = 2;

    // Helper to set font styles consistently
    const setFont = (style, size) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
    };
    
    // Custom Line Drawing Utility to match the receipt style
    const drawLine = (startY, label, value, labelWidth = 35) => {
        setFont('normal', 10);
        doc.text(label, margin, startY);
        
        doc.setLineWidth(0.2);
        doc.setDrawColor(COLORS.textDark); // Use dark text color for lines
        const startX = margin + labelWidth;
        const endX = pageWidth - margin;
        
        doc.line(startX, startY + 0.5, endX, startY + 0.5); 
        
        doc.text(String(value || ''), startX + 2, startY);
        return startY + lineHeight;
    };

    // 1. Header (Name, Address, Contact)
    doc.setTextColor(COLORS.textDark); // Ensure text is dark
    setFont('bold', 16);
    doc.text('iPremium', pageWidth / 2, y, { align: 'center' });
    y += lineHeight;

    setFont('normal', 10);
    doc.text('Apple Service Centre', pageWidth / 2, y, { align: 'center' });
    y += lineHeight + 2;

    setFont('normal', 8);
    doc.text('Ratna Arcade, NCL Colony, Beside Vijetha Super Market,', pageWidth / 2, y, { align: 'center' });
    y += lineHeight - 1;
    doc.text('Medchal Road, Kompally, Hyderabad - 500 100. Telangana, India.', pageWidth / 2, y, { align: 'center' });
    y += lineHeight;
    doc.text('Cell: 9959299797', pageWidth / 2, y, { align: 'center' });
    y += lineHeight + 5;


    // 2. Invoice Number and Date
    setFont('normal', 10);
    y = drawLine(y, 'No.', invoiceData.invoiceNumber, 15);
    y = drawLine(y, 'Date', invoiceData.invoiceDate, 15);
    y += lineHeight;


    // 3. Customer Details
    y = drawLine(y, 'Customer Name', invoiceData.customerName, 35);
    y = drawLine(y, 'Phone Number', invoiceData.phoneNumber, 35);
    y = drawLine(y, 'Address', invoiceData.address, 35);
    y = drawLine(y, 'E-mail', invoiceData.email, 35);
    y += lineHeight;
    
    // 4. Device and Issue Details
    y = drawLine(y, 'IMEI No.', invoiceData.imeiNumber, 35);
    y = drawLine(y, 'Serial No.', invoiceData.serialNumber, 35);
    y = drawLine(y, 'Issue', invoiceData.issueDescription, 35);
    y = drawLine(y, 'Condition', invoiceData.deviceCondition, 35);
    y += lineHeight;

    // 5. Device Checklist
    const devices = ['iPhone', 'iPad', 'iMac', 'MacBook', 'Apple Watch'];
    let x_start = margin;
    let boxSize = 3;
    setFont('normal', 10);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.setTextColor(COLORS.textDark);

    devices.forEach((device) => {
        doc.rect(x_start, y, boxSize, boxSize, 'S');
        
        if (invoiceData.deviceType === device) {
            setFont('bold', 10); 
            doc.text('X', x_start + boxSize / 2, y + 2.5, { align: 'center' });
            setFont('normal', 10); 
        }
        
        doc.text(device, x_start + boxSize + padding, y + 3);
        x_start += 30;
    });
    y += lineHeight + 5;

    // 6. Amount and Rupees in Words
    doc.setDrawColor(COLORS.textDark); 
    doc.setLineWidth(0.5); 
    
    // Amount box
    let boxY = y + 2;
    doc.rect(margin, boxY, pageWidth - 2 * margin, 15, 'S');
    
    // Amount Label
    setFont('normal', 10);
    doc.text('Amount:', margin + 2, boxY + 5);
    
    // Amount Value (right aligned)
    setFont('bold', 12);
    doc.text(formatCurrency(invoiceData.totalAmount), pageWidth - margin - 2, boxY + 5, null, null, 'right');
    
    // Rupees in Words
    setFont('normal', 8);
    doc.text('Rupees in words:', margin + 2, boxY + 12);
    setFont('italic', 8);
    doc.text(numberToWords(invoiceData.totalAmount).toUpperCase(), margin + 25, boxY + 12);
    y = boxY + 18;


    // 7. Signatures
    y += 10;
    setFont('normal', 10);
    doc.setDrawColor(COLORS.textDark);

    // Line for Customer Signature
    doc.setLineWidth(0.2);
    doc.line(margin + 5, y + 5, margin + 40, y + 5);
    doc.text('Customer Signature', margin + 22.5, y + 8, { align: 'center' });

    // Line for Authorized Signature
    doc.line(pageWidth - margin - 40, y + 5, pageWidth - margin - 5, y + 5);
    doc.text('Authorised Signature', pageWidth - margin - 22.5, y + 8, { align: 'center' });
    y += 15;


    // 8. Notes
    setFont('bold', 10);
    doc.text('Note:', margin, y);
    y += lineHeight;

    setFont('normal', 8);
    doc.text('1. For Motherboard 15 days warranty only.', margin, y);
    y += lineHeight - 1;
    doc.text('2. We use only OEM (Original Equipment Manufacturer) Product batteries and screens.', margin, y);
    setFont('normal', 10); 

    return doc;
};


// --- STYLED COMPONENTS (Updated for Light Theme) ---

const NavItem = ({ name, iconName, currentPage, setCurrentPage, handleLogout }) => {
    const isActive = currentPage === name;
    // Updated styling for light theme
    const baseClasses = "flex items-center p-3 rounded-xl transition duration-300 transform font-semibold hover:translate-x-1 hover:shadow-lg";
    const activeClasses = "bg-accent/10 border border-accent/50 shadow-[0_0_15px_rgba(13,153,255,0.2)] text-textDark";
    const inactiveClasses = "text-textDark/70 hover:bg-white/50";

    const handleClick = (e) => {
        e.preventDefault();
        if (name === 'Logout') {
            handleLogout();
        } else {
            setCurrentPage(name);
        }
    };

    return (
        <a 
            href="#" 
            onClick={handleClick} 
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
            style={{ 
                backgroundColor: isActive ? COLORS.glass : COLORS.glassDark, 
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: isActive ? COLORS.textDark : COLORS.textDark, // Ensure dark text color
                border: `1px solid ${isActive ? COLORS.accent : COLORS.primary}50`
            }}
        >
            <Icon name={iconName} size={20} className="mr-3" />
            {name}
        </a>
    );
};

const GlassCard = ({ title, children, className = '' }) => (
    <div 
        className={`backdrop-blur-md rounded-2xl p-6 shadow-xl transition duration-300 hover:shadow-2xl ${className}`}
        style={{ 
            backgroundColor: COLORS.glassDark,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)', // Subtle shadow for light theme
            border: `1px solid ${COLORS.textDark}10`
        }}
    >
        <h2 className="text-2xl font-bold mb-4 uppercase tracking-wider border-b border-secondary/50 pb-2 flex items-center" style={{ color: COLORS.textDark }}>
            {title}
        </h2>
        {children}
    </div>
);

const GlassInput = (props) => (
    <input
        {...props}
        // Updated input styling for light theme
        className={`w-full p-3 rounded-lg bg-white/50 border border-secondary/50 text-textDark placeholder-gray-500 focus:ring-1 focus:ring-accent focus:border-accent transition duration-200 ${props.className || ''}`}
    />
);

const GlassButton = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }) => {
    const base = "w-full px-4 py-3 rounded-xl font-bold uppercase tracking-wider transition-all duration-300 transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";
    
    let colorClasses = '';
    if (variant === 'primary') {
        // Neon Accent button (Blue text on light background)
        colorClasses = "bg-accent text-white hover:bg-blue-600 hover:shadow-[0_0_15px_rgba(13,153,255,0.7)]";
    } else if (variant === 'secondary') {
        // Gold Accent button
        colorClasses = "bg-secondary text-textDark hover:bg-yellow-600 hover:shadow-[0_0_15px_rgba(218,165,32,0.7)]";
    } else if (variant === 'danger') {
        colorClasses = "bg-red-600 text-white hover:bg-red-700";
    } else if (variant === 'ghost') {
        colorClasses = "bg-gray-200/50 text-textDark/80 hover:bg-gray-300/80";
    }

    return (
        <button type={type} onClick={onClick} className={`${base} ${colorClasses} ${className}`} disabled={disabled}>
            {children}
        </button>
    );
};


// --- LOGIN PAGE COMPONENT ---

const LoginPage = ({ onLoginSuccess }) => {
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');

        if (userId === LOGIN_CREDENTIALS.ID && password === LOGIN_CREDENTIALS.PASSWORD) {
            // Simulate token generation and sign-in
            // For this simulation, we consider the user successfully logged in
            onLoginSuccess();
            showToast('Welcome, Admin! Access granted.', 'success');
        } else {
            setError('Invalid User ID or Password. Try Admin/Admin.');
            showToast('Invalid credentials.', 'error');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4" style={{ backgroundColor: COLORS.primary }}>
            <GlassCard title="iPremium Portal Login" className="max-w-md w-full p-8 shadow-2xl">
                <p className="text-sm text-gray-600 mb-6 text-center">Use credentials: **ID: Admin** / **Password: Admin**</p>
                
                {error && (
                    <div className="p-3 mb-4 rounded-lg bg-red-100 border border-red-500 text-red-700 font-semibold">
                        {error}
                    </div>
                )}
                
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold mb-1" style={{ color: COLORS.textDark }}>User ID</label>
                        <GlassInput
                            type="text"
                            placeholder="Enter User ID"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1" style={{ color: COLORS.textDark }}>Password</label>
                        <GlassInput
                            type="password"
                            placeholder="Enter Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <GlassButton type="submit" variant="primary" className="mt-4">
                        Login
                    </GlassButton>
                </form>
            </GlassCard>
        </div>
    );
};


// --- CORE PAGES (Invoice Creation, Dashboard, Settings - Logic remains the same) ---

// Invoice Creation Page State Structure (Updated for Repair Receipt)
const initialInvoiceState = {
    customerName: '',
    address: '',
    phoneNumber: '',
    email: '',
    imeiNumber: '',
    serialNumber: '',
    issueDescription: '',
    deviceCondition: '',
    deviceType: '', // For the checklist: iPhone, iPad, etc.
    totalAmount: 0,
    invoiceDate: new Date().toISOString().split('T')[0],
};

const InvoiceCreation = ({ userId, invoices, isAuthReady, isJsPdfReady }) => {
    const [invoiceData, setInvoiceData] = useState(initialInvoiceState);
    const [isSaving, setIsSaving] = useState(false);
    
    // AI Feature 1: Issue Expansion State
    const [isGeneratingText, setIsGeneratingText] = useState(false);
    
    // AI Feature 2: TTS Diagnostics State
    const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
    
    // NEW AI Feature 3: Cost Prediction State
    const [isPredictingCost, setIsPredictingCost] = useState(false);
    const [costPrediction, setCostPrediction] = useState(null);

    // NEW AI Feature 4: Message Drafting State
    const [isDraftingMessage, setIsDraftingMessage] = useState(false);
    const [draftedMessage, setDraftedMessage] = useState('');


    const [autoSend, setAutoSend] = useState(true);

    const invoiceCount = useMemo(() => invoices.length, [invoices]);

    const handleInputChange = (field, value) => {
        setInvoiceData(p => ({ 
            ...p, 
            [field]: value
        }));
    };

    const handleAmountChange = (value) => {
        const amount = parseFloat(value) || 0;
        setInvoiceData(p => ({ 
            ...p, 
            totalAmount: amount
        }));
    };

    // --- AI Feature 1: Issue Expansion Handler ---
    const handleGenerateProfessionalIssue = async () => {
        if (!invoiceData.issueDescription) {
            showToast('Please enter a brief issue first.', 'warning');
            return;
        }

        setIsGeneratingText(true);
        try {
            const professionalText = await generateProfessionalIssueDescription(invoiceData.issueDescription);
            handleInputChange('issueDescription', professionalText);
            showToast('✨ Issue description enhanced!', 'success');
        } catch (error) {
            showToast('❌ Failed to generate text. Check API Key/Network.', 'error');
        } finally {
            setIsGeneratingText(false);
        }
    };
    
    // --- AI Feature 2: TTS Diagnostics Handler ---
    const handleGenerateAndPlaySpeech = async () => {
        const textToRead = `The customer is ${invoiceData.customerName || 'not specified'}. The device is a ${invoiceData.deviceType || 'general Apple product'}. The reported issue is: ${invoiceData.issueDescription || 'Unknown issue'}. The amount due is ${numberToWords(invoiceData.totalAmount)}.`;
        
        setIsGeneratingSpeech(true);
        try {
            await generateSpeech(textToRead);
        } finally {
            setIsGeneratingSpeech(false);
        }
    };
    
    // --- NEW AI Feature 3: Cost Prediction Handler ---
    const handlePredictCost = async () => {
        if (!invoiceData.deviceType || !invoiceData.issueDescription) {
            showToast('Select a device type and enter the issue first.', 'warning');
            return;
        }

        setIsPredictingCost(true);
        setCostPrediction(null);
        try {
            const prediction = await predictRepairCost(invoiceData.deviceType, invoiceData.issueDescription);
            setCostPrediction(prediction);
            showToast(`✨ Cost Predicted: ${formatCurrency(prediction.costEstimate)} (Certainty: ${prediction.certainty})`, 'success');
        } catch (error) {
            showToast('❌ Failed to get cost prediction. Check console.', 'error');
            setCostPrediction({ costEstimate: 0, certainty: "Failed", notes: "API Error" });
        } finally {
            setIsPredictingCost(false);
        }
    };

    // --- NEW AI Feature 4: Message Drafting Handler ---
    const handleDraftFollowUp = async () => {
         if (!invoiceData.customerName || !invoiceData.deviceType || invoiceData.totalAmount <= 0) {
            showToast('Please complete Customer, Device Type, and Final Amount fields.', 'warning');
            return;
        }

        setIsDraftingMessage(true);
        setDraftedMessage('');
        try {
            const draft = await draftFollowUpMessage(
                invoiceData.customerName,
                invoiceData.deviceType,
                invoiceData.totalAmount
            );
            setDraftedMessage(draft);
            showToast('✉️ Follow-up message drafted.', 'success');
        } catch (error) {
            showToast('❌ Failed to draft message. Check API key/Network.', 'error');
        } finally {
            setIsDraftingMessage(false);
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        // Since we are using simulated login, this check relies on the overall app state, not just Firebase Auth state
        if (!isAuthReady || userId === 'Anonymous') {
            showToast('Authentication is required to save receipts.', 'warning');
            return;
        }
        if (!isJsPdfReady) {
            showToast('⚠️ PDF library is still loading. Please wait a moment and try again.', 'warning');
            return;
        }

        if (!invoiceData.customerName || !invoiceData.phoneNumber || invoiceData.totalAmount < 0) {
            showToast('Please fill out Customer Name, Phone, and valid Amount.', 'warning');
            return;
        }
        
        setIsSaving(true);
        const newInvoiceNumber = generateInvoiceNumber(invoiceCount);
        
        const newInvoice = {
            ...invoiceData,
            invoiceNumber: newInvoiceNumber,
            rupeesInWords: numberToWords(invoiceData.totalAmount),
            createdBy: userId,
            createdAt: serverTimestamp(),
            status: 'Pending',
            whatsappSent: autoSend,
            driveLink: `https://drive.google.com/${newInvoiceNumber}` // Dynamic simulated link
        };

        try {
            // 1. Save metadata to Firestore (simulates saving to cloud storage)
            const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'invoices');
            await addDoc(collectionRef, newInvoice); 
            showToast('✅ Receipt metadata saved to cloud (Firestore).', 'success');


            // 2. Simulate PDF Generation and local download (simulates physical file creation)
            const pdfDoc = generateInvoicePDF(newInvoice);
            if (pdfDoc) {
                 pdfDoc.save(`${newInvoiceNumber}_${newInvoice.customerName.replace(/\s/g, '_')}_REPAIR.pdf`);
                 showToast('⬇️ Repair Receipt downloaded locally.', 'success');
            } else {
                showToast('⚠️ PDF failed to generate. The PDF library might not be fully ready.', 'error');
            }
           
            // 3. Open WhatsApp link if auto-send is enabled
            if (autoSend) {
                const waLink = generateWhatsAppLink(
                    newInvoice.phoneNumber,
                    newInvoice.customerName,
                    newInvoiceNumber
                );
                // Open the link in a new tab
                window.open(waLink, '_blank');
                showToast(`💬 WhatsApp chat opened for ${newInvoice.customerName}. Please manually attach the PDF from your downloads.`, 'warning');
            }

            // Reset form
            setInvoiceData(initialInvoiceState);
            setCostPrediction(null);
            setDraftedMessage('');

        } catch (error) {
            console.error("Error creating receipt: ", error);
            showToast('❌ Failed to create receipt. Check console for details.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // JSX for the Invoice Preview (Component-like structure within the page)
    const InvoicePreview = () => {
        const currentAmount = invoiceData.totalAmount || 0;
        const words = numberToWords(currentAmount);

        return (
            // The Preview remains in a light theme structure for printability
            <div id="invoice-preview" className="p-4 bg-white rounded-xl text-primary shadow-xl h-full overflow-y-auto font-serif text-sm border-2 border-gray-400">
                <div className="text-center font-bold">
                    <h1 className="text-2xl" style={{ fontFamily: 'Poppins' }}>iPremium</h1>
                    <p className="text-xs">Apple Service Centre</p>
                </div>

                <div className="text-center mt-2 text-xs border-y border-gray-300 py-1">
                    <p>Ratna Arcade, NCL Colony, Beside Vijetha Super Market, Medchal Road, Kompally, Hyderabad - 500 100.</p>
                    <p>Telangana, India. | Cell: 9959299797</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                    <div>
                        <p>No. <span className="underline ml-2">{invoiceData.invoiceNumber || generateInvoiceNumber(invoiceCount)}</span></p>
                    </div>
                    <div className="text-right">
                        <p>Date: <span className="underline ml-2">{invoiceData.invoiceDate}</span></p>
                    </div>
                </div>

                {/* Customer Fields (Underlined Style) */}
                <div className="mt-4 space-y-1 text-xs">
                    <p>Customer Name: <span className="underline ml-2 font-semibold">{invoiceData.customerName || '__________________'}</span></p>
                    <p>Address: <span className="underline ml-2">{invoiceData.address || '_____________________________________________________'}</span></p>
                    <p>Phone Number: <span className="underline ml-2">{invoiceData.phoneNumber || '__________'}</span></p>
                    <p>E-mail: <span className="underline ml-2">{invoiceData.email || '__________________________'}</span></p>
                </div>

                {/* Device & Issue */}
                <div className="mt-4 space-y-1 text-xs">
                    <p>IMEI No.: <span className="underline ml-2">{invoiceData.imeiNumber || '__________________________'}</span></p>
                    <p>Serial No.: <span className="underline ml-2">{invoiceData.serialNumber || '__________________________'}</span></p>
                    <p>Issue: <span className="underline ml-2">{invoiceData.issueDescription || '_______________________________________________________'}</span></p>
                    <p>Condition: <span className="underline ml-2">{invoiceData.deviceCondition || '____________________________________________________'}</span></p>
                </div>

                {/* Device Checklist */}
                <div className="mt-4 flex flex-wrap gap-x-4 text-xs font-mono">
                    {['iPhone', 'iPad', 'iMac', 'MacBook', 'Apple Watch'].map(device => (
                        <div key={device} className="flex items-center space-x-1">
                            <span className="border border-gray-500 w-3 h-3 text-center leading-3">
                                {invoiceData.deviceType === device ? 'X' : ''}
                            </span>
                            <span className="font-semibold">{device}</span>
                        </div>
                    ))}
                </div>

                {/* Amount Section */}
                <div className="mt-6 p-2 border border-black">
                    <div className="flex justify-between items-center font-bold text-base">
                        <p className="text-sm">Amount:</p>
                        <p className="text-xl text-secondary">{formatCurrency(currentAmount)}</p>
                    </div>
                    <p className="mt-2 text-xs">Rupees in words: <span className="italic font-semibold">{words}</span></p>
                </div>

                {/* Signatures */}
                <div className="flex justify-between mt-8 text-xs">
                    <div className="text-center">
                        <p className="border-t border-black w-32 pt-1">Customer Signature</p>
                    </div>
                    <div className="text-center">
                        <p className="border-t border-black w-32 pt-1">Authorised Signature</p>
                    </div>
                </div>

                {/* Notes */}
                <div className="mt-6 text-xs border-t border-gray-300 pt-3">
                    <p className="font-bold">Note:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                        <li>For Motherboard 15 days warranty only.</li>
                        <li>We use only OEM (Original Equipment Manufacturer) Product batteries and screens.</li>
                    </ol>
                </div>
            </div>
        );
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 md:p-8 h-full overflow-hidden">
            <div className="lg:order-1 overflow-y-auto max-h-full">
                <GlassCard title="Create New Repair Receipt" className="h-full">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <h3 className="font-bold" style={{ color: COLORS.secondary }}>Customer & Device Details</h3>
                        <GlassInput
                            type="text"
                            placeholder="Customer Name"
                            value={invoiceData.customerName}
                            onChange={(e) => handleInputChange('customerName', e.target.value)}
                            required
                        />
                        <GlassInput
                            type="text"
                            placeholder="Address"
                            value={invoiceData.address}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                        />
                        <GlassInput
                            type="tel"
                            placeholder="Phone Number (for WhatsApp delivery)"
                            value={invoiceData.phoneNumber}
                            onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                            required
                        />
                        <GlassInput
                            type="email"
                            placeholder="E-mail"
                            value={invoiceData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                        />
                        <div className="flex space-x-4">
                            <GlassInput
                                type="text"
                                placeholder="IMEI No."
                                value={invoiceData.imeiNumber}
                                onChange={(e) => handleInputChange('imeiNumber', e.target.value)}
                                className="w-1/2"
                            />
                             <GlassInput
                                type="text"
                                placeholder="Serial No."
                                value={invoiceData.serialNumber}
                                onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                                className="w-1/2"
                            />
                        </div>
                        
                        {/* Gemini Feature 1: Issue Expansion */}
                        <div className="space-y-2">
                            <div className="flex items-end space-x-2">
                                <label className="flex-grow">
                                    <span className="block mb-1" style={{ color: COLORS.textDark }}>Issue / Fault Description</span>
                                    <GlassInput
                                        type="text"
                                        placeholder="E.g., dead, no display, battery drain"
                                        value={invoiceData.issueDescription}
                                        onChange={(e) => handleInputChange('issueDescription', e.target.value)}
                                    />
                                </label>
                                <GlassButton 
                                    onClick={(e) => { e.preventDefault(); handleGenerateProfessionalIssue(); }} 
                                    variant="secondary" 
                                    className="w-auto px-3 py-3 text-sm flex-shrink-0"
                                    disabled={isGeneratingText}
                                    title="Generate professional, customer-friendly description."
                                >
                                    {isGeneratingText ? 'Generating...' : <><Icon name="Sparkle" size={16} /> AI Expand</>}
                                </GlassButton>
                            </div>
                            <div className="flex items-center space-x-2">
                                <GlassInput
                                    type="text"
                                    placeholder="Device Condition on Handover (e.g., Minor Scratches)"
                                    value={invoiceData.deviceCondition}
                                    onChange={(e) => handleInputChange('deviceCondition', e.target.value)}
                                    className="flex-grow"
                                />
                                {/* Gemini Feature 2: TTS Diagnostics Summary */}
                                <GlassButton 
                                    onClick={(e) => { e.preventDefault(); handleGenerateAndPlaySpeech(); }} 
                                    variant="ghost" 
                                    className="w-auto px-3 py-3 text-sm flex-shrink-0"
                                    disabled={isGeneratingSpeech}
                                    title="Read the device issue and customer name aloud for verification."
                                >
                                    {isGeneratingSpeech ? 'Loading Audio...' : <><Icon name="Volume2" size={16} /> Read Issue</>}
                                </GlassButton>
                            </div>
                        </div>
                        
                        <h3 className="font-bold pt-4" style={{ color: COLORS.secondary }}>Device Type Checklist</h3>
                        <div className="flex flex-wrap gap-4">
                            {['iPhone', 'iPad', 'iMac', 'MacBook', 'Apple Watch'].map(device => (
                                <GlassButton 
                                    key={device}
                                    onClick={(e) => { e.preventDefault(); handleInputChange('deviceType', invoiceData.deviceType === device ? '' : device); }}
                                    variant={invoiceData.deviceType === device ? 'primary' : 'ghost'}
                                    className="w-auto px-4 py-2 text-sm"
                                >
                                    {device} {invoiceData.deviceType === device ? <Icon name="Check" size={16} /> : ''}
                                </GlassButton>
                            ))}
                        </div>
                        
                        {/* --- NEW AI FEATURE 3: COST PREDICTION --- */}
                        <h3 className="font-bold pt-4" style={{ color: COLORS.secondary }}>Repair Estimate & Cost</h3>

                        {costPrediction && (
                            <div className={`p-3 rounded-lg border flex flex-col md:flex-row justify-between items-start md:items-center ${costPrediction.certainty === 'High' ? 'bg-green-100 border-green-400' : costPrediction.certainty === 'Medium' ? 'bg-yellow-100 border-yellow-400' : 'bg-red-100 border-red-400'}`}>
                                <div>
                                    <p className="font-bold text-gray-800 flex items-center space-x-2">
                                        <Icon name="DollarSign" size={20} />
                                        <span>AI Estimated Cost: {formatCurrency(costPrediction.costEstimate)}</span>
                                    </p>
                                    <p className="text-sm text-gray-700 mt-1">Certainty: {costPrediction.certainty}.</p>
                                </div>
                                <div className="text-xs text-gray-600 mt-2 md:mt-0 md:text-right">
                                    <p className="font-semibold">Notes:</p>
                                    <p>{costPrediction.notes}</p>
                                </div>
                            </div>
                        )}
                        
                        <GlassButton
                            onClick={(e) => { e.preventDefault(); handlePredictCost(); }}
                            variant="ghost"
                            className="w-full text-sm mb-4"
                            disabled={isPredictingCost || !invoiceData.deviceType || !invoiceData.issueDescription}
                            title="Get an AI estimate based on device type and fault description."
                        >
                            {isPredictingCost ? 'Predicting Cost...' : <><Icon name="DollarSign" size={16} /> Predict Repair Cost ✨</>}
                        </GlassButton>

                        <label className="flex-1">
                            <span className="block mb-1" style={{ color: COLORS.textDark }}>Actual Final Amount (₹)</span>
                            <GlassInput
                                type="number"
                                placeholder="0.00"
                                value={invoiceData.totalAmount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                min="0"
                                step="1"
                                required
                            />
                        </label>
                        <div className="text-lg font-bold bg-white/50 p-3 rounded-lg border border-secondary/50" style={{ color: COLORS.textDark }}>
                            Amount in Words: <span className="text-secondary text-sm italic">{numberToWords(invoiceData.totalAmount)}</span>
                        </div>
                        
                        {/* --- NEW AI FEATURE 4: FOLLOW-UP DRAFTING --- */}
                        <h3 className="font-bold pt-4" style={{ color: COLORS.secondary }}>Communication Tools</h3>
                        
                        <GlassButton
                            onClick={(e) => { e.preventDefault(); handleDraftFollowUp(); }}
                            variant="secondary"
                            className="w-full text-sm mb-4"
                            disabled={isDraftingMessage || !invoiceData.customerName || !invoiceData.deviceType || invoiceData.totalAmount <= 0}
                            title="Draft a polite WhatsApp message confirming repair completion and pickup."
                        >
                            {isDraftingMessage ? 'Drafting Message...' : <><Icon name="MessageSquare" size={16} /> Draft Follow-up Message ✨</>}
                        </GlassButton>

                        {draftedMessage && (
                            <div className="p-3 bg-gray-100 rounded-lg border border-gray-300 text-sm text-gray-800 space-y-2">
                                <p className="font-semibold flex items-center space-x-2"><Icon name="Info" size={16} /> Draft Ready (Copy Below):</p>
                                <p className="p-2 bg-white rounded border border-dotted border-gray-400 select-all">{draftedMessage}</p>
                                <GlassButton 
                                    onClick={() => { navigator.clipboard.writeText(draftedMessage); showToast("Draft message copied!", 'success'); }}
                                    variant="ghost"
                                    className="w-auto px-3 py-2 text-xs"
                                >
                                    Copy Draft
                                </GlassButton>
                            </div>
                        )}
                        
                        <div className="flex items-center space-x-3" style={{ color: COLORS.textDark }}>
                            <input 
                                type="checkbox" 
                                id="autoSend" 
                                checked={autoSend} 
                                onChange={(e) => setAutoSend(e.target.checked)}
                                className="h-4 w-4 text-accent bg-transparent border-gray-400 rounded focus:ring-accent"
                            />
                            <label htmlFor="autoSend" className="text-sm">Auto-send Receipt via WhatsApp on Creation</label>
                        </div>

                        <GlassButton type="submit" variant="primary" className="mt-6" disabled={isSaving}>
                            {isSaving ? 'Processing...' : 'Generate Receipt & Save'}
                        </GlassButton>
                    </form>
                </GlassCard>
            </div>
            
            {/* Invoice Preview Section */}
            <div className="lg:order-2 overflow-y-auto lg:h-full h-96">
                <GlassCard title="Repair Receipt Preview (PDF Style)" className="h-full">
                    <div className="bg-gray-100 p-2 h-full">
                        <InvoicePreview />
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};

// Invoice Dashboard Page (Functionality remains largely the same, now listing receipts)
const InvoiceDashboard = ({ invoices, isJsPdfReady }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');

    const filteredInvoices = useMemo(() => {
        return invoices.filter(invoice => {
            const matchesSearch = invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  invoice.phoneNumber.includes(searchTerm) ||
                                  invoice.imeiNumber?.includes(searchTerm);
            
            const matchesStatus = filterStatus === 'All' || invoice.status === filterStatus;
            
            return matchesSearch && matchesStatus;
        });
    }, [invoices, searchTerm, filterStatus]);
    
    // Calculate Analytics
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const monthlyInvoices = invoices.filter(inv => {
        const date = new Date(inv.createdAt?.toDate ? inv.createdAt.toDate() : inv.createdAt);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const totalInvoicesMonth = monthlyInvoices.length;
    const totalRevenueMonth = monthlyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    const AnalyticsCard = ({ title, value, color }) => (
        <div className="p-4 rounded-xl bg-white/50 border border-secondary/50 shadow-lg text-textDark">
            <p className="text-sm text-gray-500 font-semibold">{title}</p>
            <p className={`text-2xl font-bold mt-1`} style={{ color }}>{value}</p>
        </div>
    );

    const handleAction = (action, invoice) => {
        if (!isJsPdfReady) {
            showToast('⚠️ PDF library is still loading. Please wait a moment.', 'warning');
            return;
        }

        const invoiceTitle = `${invoice.invoiceNumber} - ${invoice.customerName}`;
        
        try {
            // All actions involving the PDF document start here:
            const pdfDoc = generateInvoicePDF(invoice);

            if (!pdfDoc) {
                 showToast('⚠️ PDF generation failed for this receipt. The document object is null.', 'error');
                 return;
            }

            if (action === 'view') {
                pdfDoc.output('bloburl');
                window.open(pdfDoc.output('bloburl'), '_blank');
            } else if (action === 'download') {
                 pdfDoc.save(`${invoice.invoiceNumber}_${invoice.customerName.replace(/\s/g, '_')}_REPAIR.pdf`);
                 showToast(`⬇️ Downloaded ${invoiceTitle}`, 'success');
            } else if (action === 'resend') {
                // 1. Download the PDF first (required before opening chat)
                 pdfDoc.save(`${invoice.invoiceNumber}_${invoice.customerName.replace(/\s/g, '_')}_REPAIR.pdf`);

                // 2. Open WhatsApp link
                const waLink = generateWhatsAppLink(
                    invoice.phoneNumber,
                    invoice.customerName,
                    invoice.invoiceNumber
                );
                window.open(waLink, '_blank');
                showToast(`💬 WhatsApp chat opened for ${invoice.customerName}. Please manually attach the PDF from your downloads.`, 'warning');
                
            } else if (action === 'drive') {
                // Simulate opening in Drive
                showToast(`☁️ Opening Drive link for ${invoiceTitle} (Simulated)`, 'warning');
                window.open(invoice.driveLink || 'https://drive.google.com/folder/simulated', '_blank');
            }
        } catch (e) {
            console.error("Action execution error:", e);
            showToast('❌ An error occurred during PDF processing.', 'error');
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 h-full overflow-y-auto">
            <h1 className="text-3xl font-extrabold" style={{ color: COLORS.textDark, fontFamily: 'Poppins' }}>Repair Receipt Management Portal</h1>

            {/* Analytics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AnalyticsCard 
                    title="Receipts This Month" 
                    value={totalInvoicesMonth} 
                    color={COLORS.accent} 
                />
                <AnalyticsCard 
                    title="Total Revenue (Month)" 
                    value={formatCurrency(totalRevenueMonth)} 
                    color={COLORS.secondary} 
                />
                <AnalyticsCard 
                    title="Top Customer (Simulated)" 
                    value="Raju Electronics" 
                    color="#4ADE80" // Green shade
                />
            </div>
            
            <GlassCard title="All Receipts">
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
                    <GlassInput 
                        type="text"
                        placeholder="Search by Customer Name, IMEI, or Phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-grow"
                    />
                    <select 
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="p-3 rounded-lg bg-white/50 border border-secondary/50 text-textDark"
                        style={{ appearance: 'none' }}
                    >
                        <option value="All" className="bg-white text-textDark">All Statuses</option>
                        <option value="Paid" className="bg-white text-green-600">Paid</option>
                        <option value="Pending" className="bg-white text-yellow-600">Pending</option>
                        <option value="Overdue" className="bg-white text-red-600">Overdue</option>
                    </select>
                    <GlassButton variant="ghost" className="w-auto px-6">Export CSV</GlassButton>
                </div>

                {filteredInvoices.length === 0 ? (
                    <p className="text-gray-500 text-center py-10">No receipts found matching your criteria.</p>
                ) : (
                    <div className="overflow-x-auto rounded-xl">
                        <table className="min-w-full divide-y divide-textDark/10">
                            <thead className="bg-gray-100/80 sticky top-0">
                                <tr className="text-left text-xs text-gray-600 uppercase tracking-wider">
                                    <th className="p-3">Receipt #</th>
                                    <th className="p-3">Customer</th>
                                    <th className="p-3">Device Issue</th>
                                    <th className="p-3 text-right">Amount</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredInvoices.map((invoice) => (
                                    <tr key={invoice.id} className="text-textDark hover:bg-gray-100 transition duration-150">
                                        <td className="p-3 font-mono">{invoice.invoiceNumber}</td>
                                        <td className="p-3">{invoice.customerName}</td>
                                        <td className="p-3 text-sm truncate max-w-[150px]">{invoice.issueDescription || 'N/A'}</td>
                                        <td className="p-3 text-right font-semibold">{formatCurrency(invoice.totalAmount)}</td>
                                        <td className={`p-3 font-semibold ${invoice.status === 'Paid' ? 'text-green-600' : invoice.status === 'Overdue' ? 'text-red-600' : 'text-yellow-600'}`}>
                                            {invoice.status}
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex justify-center space-x-2">
                                                <button onClick={() => handleAction('view', invoice)} title="View PDF" className="p-1 rounded-full bg-accent/20 hover:bg-accent/50 text-accent transition" disabled={!isJsPdfReady}><Icon name="Eye" size={16} /></button>
                                                <button onClick={() => handleAction('download', invoice)} title="Download PDF" className="p-1 rounded-full bg-secondary/20 hover:bg-secondary/50 text-secondary transition" disabled={!isJsPdfReady}><Icon name="Download" size={16} /></button>
                                                <button onClick={() => handleAction('resend', invoice)} title="Resend via WhatsApp" className="p-1 rounded-full bg-green-500/20 hover:bg-green-500/50 text-green-600 transition"><Icon name="WhatsApp" size={16} /></button>
                                                <button onClick={() => handleAction('drive', invoice)} title="Open in Drive" className="p-1 rounded-full bg-blue-500/20 hover:bg-blue-500/50 text-blue-600 transition"><Icon name="OpenInDrive" size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>
        </div>
    );
};

// Settings Page (Updated colors)
const SettingsPage = () => {
    const [settings, setSettings] = useState({
        driveFolderLink: 'https://drive.google.com/simulated/iPremium_Invoices',
        whatsappToken: 'TWILIO_SIM_TOKEN_12345',
        autoWhatsapp: true,
        language: 'English'
    });
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = () => {
        showToast('⚙️ Settings saved and integrations refreshed (Simulated)', 'success');
        setIsEditing(false);
    };

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 overflow-y-auto h-full">
            <h1 className="text-3xl font-extrabold" style={{ color: COLORS.textDark, fontFamily: 'Poppins' }}>System Settings</h1>
            
            <GlassCard title="Integration Management">
                <div className="space-y-4 text-textDark">
                    <div>
                        <label className="block mb-1 font-semibold" style={{ color: COLORS.secondary }}>Google Drive Folder Link</label>
                        <GlassInput
                            value={settings.driveFolderLink}
                            onChange={(e) => setSettings({...settings, driveFolderLink: e.target.value})}
                            disabled={!isEditing}
                        />
                        <p className="text-xs mt-1 text-gray-500">Simulated Path: /iPremium_Invoices/Year/Month/...</p>
                    </div>
                    <div>
                        <label className="block mb-1 font-semibold" style={{ color: COLORS.secondary }}>WhatsApp Integration</label>
                        <GlassInput
                            type="text"
                            value={"WhatsApp Deep Link Method Active"}
                            disabled={true}
                        />
                        <p className="text-xs mt-1 text-gray-500">We now use a deep link to open WhatsApp. Manual API token no longer needed.</p>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                        <label className="font-semibold" style={{ color: COLORS.textDark }}>Auto-send WhatsApp on Receipt Creation</label>
                        <div 
                            onClick={() => isEditing && setSettings(p => ({ ...p, autoWhatsapp: !p.autoWhatsapp }))}
                            className={`relative inline-flex items-center h-6 rounded-full w-11 cursor-pointer transition-colors ${settings.autoWhatsapp ? 'bg-accent' : 'bg-gray-400'} ${!isEditing ? 'opacity-50 cursor-default' : ''}`}
                        >
                            <span 
                                aria-hidden="true" 
                                className={`inline-block h-4 w-4 transform transition duration-300 ease-in-out bg-white rounded-full ${settings.autoWhatsapp ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </div>
                    </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                    {isEditing ? (
                        <div className="space-x-3 flex">
                            <GlassButton variant="secondary" className="w-auto px-6" onClick={() => setIsEditing(false)}>Cancel</GlassButton>
                            <GlassButton variant="primary" className="w-auto px-6" onClick={handleSave}>Save Changes</GlassButton>
                        </div>
                    ) : (
                        <GlassButton variant="ghost" className="w-auto px-6" onClick={() => setIsEditing(true)}>
                            <Icon name="Settings" size={16} className="mr-2" />
                            Edit Configuration
                        </GlassButton>
                    )}
                </div>
            </GlassCard>

            <GlassCard title="Branding & Localization">
                <div className="space-y-4 text-textDark">
                    <div>
                        <label className="block mb-1 font-semibold" style={{ color: COLORS.secondary }}>Receipt Language</label>
                        <select 
                            value={settings.language}
                            onChange={(e) => setSettings(p => ({ ...p, language: e.target.value }))}
                            className="w-full p-3 rounded-lg bg-white/50 border border-secondary/50 text-textDark"
                            disabled={!isEditing}
                        >
                            <option value="English" className="bg-white">English</option>
                            <option value="Telugu" className="bg-white">Telugu (Simulated)</option>
                            <option value="Hindi" className="bg-white">Hindi (Simulated)</option>
                        </select>
                    </div>
                    <p className="text-xs mt-1 text-gray-500">Font Family: Poppins/Inter (applied via Tailwind config in parent HTML)</p>
                    <p className="text-xs text-gray-500">Note: Logo/Header upload simulated.</p>
                </div>
            </GlassCard>
        </div>
    );
};


// --- MAIN APP COMPONENT ---

const App = () => {
    const [currentPage, setCurrentPage] = useState('Dashboard');
    // New state to track explicit login success
    const [isLoggedIn, setIsLoggedIn] = useState(false); 
    // Pass setIsLoggedIn to useFirebase so it can update the state after token/anonymous sign-in
    const { userId, isAuthReady, invoices, handleLogout } = useFirebase(isLoggedIn, setIsLoggedIn);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isJsPdfReady, setIsJsPdfReady] = useState(false); // NEW STATE FOR PDF LIB

    // NEW: Effect to listen for jsPDF script load
    useEffect(() => {
        const handleScriptLoad = () => {
            setIsJsPdfReady(true);
            showToast('PDF Library Loaded. You can now view and download receipts.', 'success');
        };
        
        // Check if the script tag already exists in the head (it should)
        const pdfScript = document.querySelector('script[src*="jspdf"]');
        if (pdfScript) {
             pdfScript.addEventListener('load', handleScriptLoad);
             // If it loaded before this useEffect ran, check window.jsPDF presence manually
             if (window.jsPDF) {
                 setIsJsPdfReady(true);
             }
        }
        
        return () => {
            if (pdfScript) {
                pdfScript.removeEventListener('load', handleScriptLoad);
            }
        };
    }, []);

    // Initial loading/auth check state
    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center h-screen bg-primary" style={{ backgroundColor: COLORS.primary, fontFamily: 'Inter, sans-serif', color: COLORS.textDark }}>
                <p className="text-xl">Initializing iPremium Portal...</p>
            </div>
        );
    }
    
    // RENDER LOGIN PAGE if not explicitly logged in (CRITICAL FIX)
    if (!isLoggedIn) {
        return <LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />;
    }

    // PDF Ready Check (done after login)
     if (!isJsPdfReady) {
        return (
            <div className="flex items-center justify-center h-screen bg-primary" style={{ backgroundColor: COLORS.primary, fontFamily: 'Inter, sans-serif', color: COLORS.textDark }}>
                <p className="text-xl">Loading PDF libraries (one moment)...</p>
            </div>
        );
    }
    
    // Simple page routing
    const renderPage = () => {
        switch (currentPage) {
            case 'Create Invoice':
                return <InvoiceCreation userId={userId} invoices={invoices} isAuthReady={isAuthReady} isJsPdfReady={isJsPdfReady} />;
            case 'Invoices':
            case 'Dashboard':
                return <InvoiceDashboard invoices={invoices} isJsPdfReady={isJsPdfReady} />;
            case 'Settings':
                return <SettingsPage />;
            default:
                return <InvoiceDashboard invoices={invoices} isJsPdfReady={isJsPdfReady} />;
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row transition-colors duration-500 font-['Inter',_sans-serif']" style={{ backgroundColor: COLORS.primary, color: COLORS.textDark }}>
            
            {/* Toast Container (Top Right Corner) */}
            <div id="toast-container" className="fixed right-4 top-4 z-[100] space-y-3 pointer-events-auto"></div>

            {/* Global Styles - Updated for Light Theme */}
            <style>{`
                body {
                    margin: 0;
                    padding: 0;
                    background-color: ${COLORS.primary};
                    color: ${COLORS.textDark};
                    font-family: 'Inter', sans-serif;
                }
                .glass-bg {
                    background-color: ${COLORS.primary};
                    /* Subtle light theme gradient accent */
                    background-image: radial-gradient(circle at 10% 20%, rgba(218, 165, 32, 0.1) 0%, rgba(13, 153, 255, 0.05) 90%), 
                                      radial-gradient(circle at 90% 80%, rgba(13, 153, 255, 0.1) 0%, rgba(255, 255, 255, 1) 90%);
                }
            `}</style>

            {/* Sidebar (Navigation) - Fixed on Desktop, Drawer on Mobile */}
            <div 
                className={`fixed inset-y-0 left-0 z-50 md:sticky md:top-0 md:h-screen w-64 p-6 flex flex-col space-y-6 transform transition-transform duration-300 md:translate-x-0 
                           ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{ 
                    backgroundColor: COLORS.glassDark, 
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderRight: `1px solid ${COLORS.textDark}10`
                }}
            >
                {/* Header/Logo */}
                <div className="flex-shrink-0 mb-8 border-b border-secondary/50 pb-4">
                    <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Poppins', color: COLORS.textDark }}>iPremium</h1>
                    <p className="text-secondary text-sm tracking-widest">Portal V1.0</p>
                </div>

                {/* Navigation Items */}
                <nav className="flex-grow space-y-3">
                    <NavItem name="Dashboard" iconName="LayoutDashboard" currentPage={currentPage} setCurrentPage={setCurrentPage} handleLogout={handleLogout} />
                    <NavItem name="Create Invoice" iconName="FilePlus" currentPage={currentPage} setCurrentPage={setCurrentPage} handleLogout={handleLogout} />
                    <NavItem name="Invoices" iconName="LayoutDashboard" currentPage={currentPage} setCurrentPage={setCurrentPage} handleLogout={handleLogout} />
                    <NavItem name="Settings" iconName="Settings" currentPage={currentPage} setCurrentPage={setCurrentPage} handleLogout={handleLogout} />
                </nav>

                {/* User Info & Logout */}
                <div className="pt-6 border-t border-textDark/20">
                    <p className="text-xs text-gray-500 mb-2 truncate">User ID: {userId}</p>
                    <GlassButton onClick={handleLogout} variant="danger" className="text-sm flex items-center justify-center space-x-2">
                        <Icon name="LogOut" size={16} />
                        <span>Logout</span>
                    </GlassButton>
                </div>
            </div>

            {/* Mobile Menu Toggle */}
            <button 
                className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-full bg-accent text-white shadow-lg"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
                {isMenuOpen ? <Icon name="X" size={24} /> : <Icon name="LayoutDashboard" size={24} />}
            </button>
            {isMenuOpen && <div className="fixed inset-0 bg-black/10 z-40 md:hidden" onClick={() => setIsMenuOpen(false)}></div>}


            {/* Main Content Area - Ensure main content takes available space and scrolls */}
            <main className="flex-grow w-full md:w-[calc(100%-16rem)] min-h-screen md:min-h-0 md:h-screen overflow-y-auto p-4 md:p-8 bg-transparent">
                <div className="w-full h-full glass-bg rounded-lg p-0">
                    {renderPage()}
                </div>
            </main>
        </div>
    );
};

export default App;
