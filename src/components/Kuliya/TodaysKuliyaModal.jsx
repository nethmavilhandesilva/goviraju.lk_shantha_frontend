import React, { useState, useEffect } from 'react';
import api from '../../api';

const TodaysKuliyaModal = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [totalKuliya, setTotalKuliya] = useState(0);
    const [currentDate, setCurrentDate] = useState('');
    const [recordCount, setRecordCount] = useState(0);

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
                <div className="modal-content">
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