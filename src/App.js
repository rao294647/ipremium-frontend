import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'https://script.google.com/macros/d/AKfycbwGSqbmNsvWaUjmvOz3AnWLdQo5vDxubx2hfGOZsfaeEnNuJDrcHDkQrupJ3tzyP9iEyQ/usercss';
const VENDOR_TOKEN = 'Vmhzb078';

function App() {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    address: '',
    imei: '',
    serialNumber: '',
    issue: '',
    amount: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [invoiceData, setInvoiceData] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post(API_URL, {
        action: 'createInvoice',
        vendorToken: VENDOR_TOKEN,
        customerName: formData.customerName,
        phone: formData.phone,
        address: formData.address,
        imei: formData.imei,
        serialNumber: formData.serialNumber,
        issue: formData.issue,
        amount: parseFloat(formData.amount)
      });

      if (response.data.success) {
        setMessage('Invoice created successfully!');
        setInvoiceData(response.data);
        setFormData({
          customerName: '',
          phone: '',
          address: '',
          imei: '',
          serialNumber: '',
          issue: '',
          amount: ''
        });
      } else {
        setMessage(`Error: ${response.data.message}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <h1>iPremium Invoice Billing</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Customer Name</label>
            <input
              type="text"
              name="customerName"
              value={formData.customerName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>IMEI</label>
            <input
              type="text"
              name="imei"
              value={formData.imei}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Serial Number</label>
            <input
              type="text"
              name="serialNumber"
              value={formData.serialNumber}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Issue</label>
            <input
              type="text"
              name="issue"
              value={formData.issue}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Amount</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Creating Invoice...' : 'Create Invoice'}
          </button>
        </form>
        {message && <p className={`message ${invoiceData ? 'success' : 'error'}`}>{message}</p>}
        {invoiceData && (
          <div className="invoice-result">
            <p>Invoice Number: {invoiceData.invoiceNumber}</p>
            {invoiceData.whatsappLink && (
              <a href={invoiceData.whatsappLink} target="_blank" rel="noopener noreferrer">
                Send via WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
