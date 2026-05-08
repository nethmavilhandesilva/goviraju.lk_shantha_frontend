import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';

const TodaysKuliyaModal = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [totalKuliya, setTotalKuliya] = useState(0);
    const [currentDate, setCurrentDate] = useState('');
    const [recordCount, setRecordCount] = useState(0);
    const modalContentRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchTodaysKuliya();
        }
    }, [isOpen]);

    const fetchTodaysKuliya = async () => {
        setLoading(true);
        try {
            const response = await api.get('/sales/todays-kuliya');
            if (response.data.success) {
                setTotalKuliya(response.data.total);
                setCurrentDate(response.data.date);
                setRecordCount(response.data.record_count);
            } else {
                console.error('Failed to fetch Kuliya data');
                setTotalKuliya(0);
                setRecordCount(0);
            }
        } catch (error) {
            console.error('Error fetching Kuliya data:', error);
            setTotalKuliya(0);
            setRecordCount(0);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        const modalContent = modalContentRef.current;
        
        if (modalContent && printWindow) {
            const printHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Today's Kuliya Report - ${formatDate(currentDate)}</title>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 40px;
                            margin: 0;
                        }
                        .print-container {
                            max-width: 400px;
                            margin: 0 auto;
                            text-align: center;
                        }
                        .header {
                            margin-bottom: 30px;
                        }
                        .title {
                            font-size: 24px;
                            font-weight: bold;
                            color: #004d00;
                            margin-bottom: 10px;
                        }
                        .date {
                            color: #666;
                            font-size: 14px;
                            margin-bottom: 20px;
                        }
                        .amount {
                            font-size: 48px;
                            font-weight: bold;
                            color: #28a745;
                            margin: 20px 0;
                        }
                        .amount-label {
                            font-size: 14px;
                            color: #666;
                            margin-top: 5px;
                        }
                        .record-count {
                            background-color: #17a2b8;
                            color: white;
                            padding: 8px 15px;
                            border-radius: 20px;
                            display: inline-block;
                            font-size: 14px;
                            margin: 20px 0;
                        }
                        .footer {
                            margin-top: 40px;
                            font-size: 12px;
                            color: #999;
                            border-top: 1px solid #ddd;
                            padding-top: 20px;
                        }
                        .no-data {
                            color: #999;
                            margin: 20px 0;
                        }
                        @media print {
                            body {
                                padding: 20px;
                            }
                            .no-print {
                                display: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-container">
                        <div class="header">
                            <div class="title">අද දින කුලිය</div>
                            <div class="title">Today's Kuliya</div>
                        </div>
                        
                        <div class="date">
                            📅 ${formatDate(currentDate)}
                        </div>
                        
                        <div class="amount">
                            රු. ${formatNumber(totalKuliya)}
                        </div>
                        <div class="amount-label">
                            සම්පූර්ණ කුලිය (Total Kuliya)
                        </div>
                        
                        <div class="record-count">
                            🧾 ගනුදෙනු ගණන: ${recordCount}
                        </div>
                        
                        ${recordCount === 0 ? `
                            <div class="no-data">
                                ℹ️ අද දින කුලිය ගෙවූ ගනුදෙනු නොමැත
                            </div>
                        ` : ''}
                        
                        <div class="footer">
                            Generated on ${new Date().toLocaleString('si-LK')}
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            printWindow.document.write(printHtml);
            printWindow.document.close();
            printWindow.print();
            printWindow.onafterprint = () => printWindow.close();
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('si-LK');
    };

    const formatNumber = (num) => {
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    if (!isOpen) return null;

    return (
        <div className="modal show d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-sm" role="document" style={{ marginTop: '100px' }}>
                <div className="modal-content" ref={modalContentRef}>
                    <div className="modal-header" style={{ backgroundColor: '#004d00', color: 'white', padding: '15px' }}>
                        <h5 className="modal-title" style={{ fontWeight: 'bold' }}>
                            <i className="material-icons align-middle me-2" style={{ fontSize: '24px' }}>account_balance_wallet</i>
                            අද දින කුලිය (Today's Kuliya)
                        </h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close"></button>
                    </div>

                    <div className="modal-body" style={{ padding: '30px' }}>
                        {loading ? (
                            <div className="text-center py-4">
                                <div className="spinner-border text-success" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <p className="mt-3">පූරණය වෙමින්...</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                {/* Date */}
                                <div className="mb-3">
                                    <span className="text-muted" style={{ fontSize: '14px' }}>
                                        <i className="material-icons align-middle me-1" style={{ fontSize: '16px' }}>calendar_today</i>
                                        {formatDate(currentDate)}
                                    </span>
                                </div>

                                {/* Total Kuliya Amount */}
                                <div className="mb-4">
                                    <div className="display-4 fw-bold text-success" style={{ fontSize: '48px', fontWeight: 'bold' }}>
                                        රු. {formatNumber(totalKuliya)}
                                    </div>
                                    <div className="text-muted mt-2" style={{ fontSize: '14px' }}>
                                        සම්පූර්ණ කුලිය (Total Kuliya)
                                    </div>
                                </div>

                                {/* Transactions Count */}
                                <div className="mt-3">
                                    <span className="badge bg-info" style={{ fontSize: '14px', padding: '8px 15px' }}>
                                        <i className="material-icons align-middle me-1" style={{ fontSize: '16px' }}>receipt</i>
                                        ගනුදෙනු ගණන: {recordCount}
                                    </span>
                                </div>

                                {/* No data message */}
                                {recordCount === 0 && !loading && (
                                    <div className="alert alert-info text-center mt-3" style={{ fontSize: '13px' }}>
                                        <i className="material-icons align-middle me-1" style={{ fontSize: '16px' }}>info</i>
                                        අද දින කුලිය ගෙවූ ගනුදෙනු නොමැත
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer" style={{ justifyContent: 'center' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={onClose}
                        >
                            වසන්න (Close)
                        </button>
                        <button 
                            type="button" 
                            className="btn btn-primary" 
                            onClick={handlePrint}
                            disabled={loading}
                        >
                            <i className="material-icons align-middle me-1">print</i>
                            මුද්‍රණය කරන්න (Print)
                        </button>
                        <button 
                            type="button" 
                            className="btn btn-success" 
                            onClick={fetchTodaysKuliya}
                            disabled={loading}
                        >
                            <i className="material-icons align-middle me-1">refresh</i>
                            නැවත පූරණය කරන්න (Refresh)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TodaysKuliyaModal;