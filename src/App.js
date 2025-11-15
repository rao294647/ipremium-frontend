import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import './App.css';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBns0zPQW1iGZO6CECTr30AUoa9KV6Agnc",
  authDomain: "ipremium-invoices.firebaseapp.com",
  projectId: "ipremium-invoices",
  storageBucket: "ipremium-invoices.firebasestorage.app",
  messagingSenderId: "15054658076",
  appId: "1:15054658076:web:deebea949a2d5eebd39dd9",
  measurementId: "G-CQ5XYMPGKS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    address: '',
    imei: '',
    serialNumber: '',
    issue: '',
    amount: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    alert('Invoice creation feature coming soon!');
  };

  // Loading Screen
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading iPremium...</p>
      </div>
    );
  }

  // Login Screen
  if (!user) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.logo}>iPremium</h1>
          <p style={styles.subtitle}>Apple Service Centre</p>
          <p style={styles.loginText}>Secure Invoice Management System</p>
          <button 
            onClick={handleLogin} 
            style={styles.loginButton}
            onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
          >
            Login to Portal
          </button>
        </div>
      </div>
    );
  }

  // Main Invoice App
  return (
    <div style={styles.appContainer}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>iPremium</h1>
          <p style={styles.headerSubtitle}>Invoice Generation Portal</p>
        </div>
        <button onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </header>

      {/* Main Content */}
      <div style={styles.mainContent}>
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Create New Invoice</h2>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Customer Name</label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  style={styles.input}
                  required
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>IMEI Number</label>
                <input
                  type="text"
                  name="imei"
                  value={formData.imei}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Serial Number</label>
                <input
                  type="text"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Issue Description</label>
              <textarea
                name="issue"
                value={formData.issue}
                onChange={handleChange}
                style={{...styles.input, minHeight: '80px'}}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Amount (₹)</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </div>

            <button type="submit" style={styles.submitButton}>
              Generate Invoice
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  // Loading Styles
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #101820 0%, #0D1117 100%)',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(218, 165, 32, 0.3)',
    borderTop: '4px solid #DAA520',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#E5E7EB',
    marginTop: '20px',
    fontSize: '18px',
  },

  // Login Styles
  loginContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #101820 0%, #0D1117 100%)',
  },
  loginCard: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '60px 50px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
    maxWidth: '400px',
  },
  logo: {
    fontSize: '48px',
    fontWeight: 'bold',
    background: 'linear-gradient(45deg, #DAA520, #FFC947)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '10px',
  },
  subtitle: {
    color: '#E5E7EB',
    fontSize: '18px',
    marginBottom: '30px',
  },
  loginText: {
    color: '#9CA3AF',
    fontSize: '14px',
    marginBottom: '30px',
  },
  loginButton: {
    width: '100%',
    padding: '15px',
    background: 'linear-gradient(45deg, #0D99FF, #0A7BD6)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(13, 153, 255, 0.4)',
  },

  // App Styles
  appContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #101820 0%, #0D1117 100%)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 40px',
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: '28px',
    color: '#DAA520',
    margin: 0,
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: '14px',
    margin: '5px 0 0 0',
  },
  logoutButton: {
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#E5E7EB',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  mainContent: {
    padding: '40px',
    display: 'flex',
    justifyContent: 'center',
  },
  formCard: {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '40px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    maxWidth: '800px',
    width: '100%',
  },
  formTitle: {
    color: '#E5E7EB',
    fontSize: '24px',
    marginBottom: '30px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formRow: {
    display: 'flex',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  label: {
    color: '#E5E7EB',
    fontSize: '14px',
    marginBottom: '8px',
    fontWeight: '500',
  },
  input: {
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(218, 165, 32, 0.3)',
    borderRadius: '8px',
    color: '#E5E7EB',
    fontSize: '14px',
    transition: 'all 0.3s ease',
    outline: 'none',
  },
  submitButton: {
    padding: '15px',
    background: 'linear-gradient(45deg, #DAA520, #FFC947)',
    color: '#101820',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '10px',
    boxShadow: '0 4px 15px rgba(218, 165, 32, 0.4)',
  },
};

export default App;
