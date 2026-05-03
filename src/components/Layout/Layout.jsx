import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ItemReportModal from '../Itemrepo/ItemReportModal';
import WeightReportModal from '../WeightReport/WeightReportModal';
import GrnSaleReportModal from '../GrnSale/ReportModal';
import GrnReportModal from '../GrnReport/GrnReportModal';
import SalesAdjustmentReportModal from '../SalesAdjustmentReport/SalesAdjustmentReportModal';
import GrnSalesOverviewReport from '../GrnSalesOverview/GrnSalesOverviewReport';
import GrnSalesOverviewReport2 from '../GrnSalesOverview/GrnSalesOverviewReport2';
import SalesReportModal from '../SalesReport/SalesReportModal';
import DayProcessModal from '../Modals/DayProcessModal';
import TodaysKuliyaModal from '../Kuliya/TodaysKuliyaModal';

const Layout = ({ children, billSize, handleBillSizeChange, printMode, setPrintMode }) => {
    const location = useLocation();
    const navigate = useNavigate();

    // Get base URL dynamically
    const getBaseUrl = () => {
        const { protocol, hostname, port } = window.location;
        // Check if we're on the hosted domain
        if (hostname.includes('goviraju.lk')) {
            return `${protocol}//${hostname}/DBS_frontend_30500`;
        }
        // Local development
        if (port === '5173' || hostname === 'localhost') {
            return 'http://localhost:5173';
        }
        // Fallback to current origin
        return window.location.origin;
    };

    const BASE_URL = getBaseUrl();

    // Check if current page should hide the navbar (Supplier Report pages)
    const hideNavbarRoutes = [
        '/supplierreport',
        '/suppliers/printed-report',
        '/supplier-finalreport'
    ];
    const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);
    const isSalesEntryPage = location.pathname === '/sales' || location.pathname === '/sales-entry';

    // === Modal States ===
    const [isItemReportModalOpen, setIsItemReportModalOpen] = useState(false);
    const [isWeightReportModalOpen, setIsWeightReportModalOpen] = useState(false);
    const [isGrnSaleReportModalOpen, setIsGrnSaleReportModalOpen] = useState(false);
    const [isSalesAdjustmentReportModalOpen, setIsSalesAdjustmentReportModalOpen] = useState(false);
    const [isGrnSalesOverviewReportOpen, setIsGrnSalesOverviewReportOpen] = useState(false);
    const [isGrnSalesOverviewReport2Open, setIsGrnSalesOverviewReport2Open] = useState(false);
    const [isSalesReportModalOpen, setIsSalesReportModalOpen] = useState(false);
    const [isGrnReportModalOpen, setIsGrnReportModalOpen] = useState(false);
    const [isDayProcessModalOpen, setIsDayProcessModalOpen] = useState(false);
    const [isTodaysKuliyaModalOpen, setIsTodaysKuliyaModalOpen] = useState(false);

    // === User & Settings State ===
    const [user, setUser] = useState(null);
    const [settingValue, setSettingValue] = useState('');

    // === Bottom Password States ===
    const [bottomPassword, setBottomPassword] = useState('');
    const [isBottomUnlocked, setIsBottomUnlocked] = useState(true);

    // === Local Print Mode State with localStorage persistence ===
    const [localPrintMode, setLocalPrintMode] = useState(() => {
        // Try to get saved print mode from localStorage
        const savedPrintMode = localStorage.getItem('printMode');
        // Return saved value if exists, otherwise default to 'thermal'
        return savedPrintMode || 'thermal';
    });

    useEffect(() => {
        // 1. Handle User Session
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        } else {
            // Redirect to hosted system login
            window.location.href = `${BASE_URL}/login`;
        }

        // 2. Fetch Setting Value
        const fetchSettings = async () => {
            try {
                const response = await api.get('/settings');
                if (response.data) {
                    setSettingValue(response.data.value || response.data[0]?.value || '');
                }
            } catch (error) {
                console.error("Error fetching settings data:", error);
            }
        };

        fetchSettings();
    }, [BASE_URL]);

    // Sync local print mode with parent component if setPrintMode is provided
    useEffect(() => {
        if (setPrintMode && typeof setPrintMode === 'function') {
            setPrintMode(localPrintMode);
        }
    }, [localPrintMode, setPrintMode]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        // Redirect to hosted system login
        window.location.href = `${BASE_URL}/login`;
    };

    // === Modal Handlers ===
    const openItemReportModal = () => setIsItemReportModalOpen(true);
    const closeItemReportModal = () => setIsItemReportModalOpen(false);
    const openWeightReportModal = () => setIsWeightReportModalOpen(true);
    const closeWeightReportModal = () => setIsWeightReportModalOpen(false);
    const openGrnSaleReportModal = () => setIsGrnSaleReportModalOpen(true);
    const closeGrnSaleReportModal = () => setIsGrnSaleReportModalOpen(false);
    const openSalesAdjustmentReportModal = () => setIsSalesAdjustmentReportModalOpen(true);
    const closeSalesAdjustmentReportModal = () => setIsSalesAdjustmentReportModalOpen(false);
    const openGrnSalesOverviewReport = () => setIsGrnSalesOverviewReportOpen(true);
    const closeGrnSalesOverviewReport = () => setIsGrnSalesOverviewReportOpen(false);
    const openGrnSalesOverviewReport2 = () => setIsGrnSalesOverviewReport2Open(true);
    const closeGrnSalesOverviewReport2 = () => setIsGrnSalesOverviewReport2Open(false);
    const openSalesReportModal = () => setIsSalesReportModalOpen(true);
    const closeSalesReportModal = () => setIsSalesReportModalOpen(false);
    const openGrnReportModal = () => setIsGrnReportModalOpen(true);
    const closeGrnReportModal = () => setIsGrnReportModalOpen(false);
    const openDayProcessModal = () => setIsDayProcessModalOpen(true);
    const closeDayProcessModal = () => setIsDayProcessModalOpen(false);
    const openTodaysKuliyaModal = () => setIsTodaysKuliyaModalOpen(true);
    const closeTodaysKuliyaModal = () => setIsTodaysKuliyaModalOpen(false);

    const handleProfitReportClick = () => {
        window.location.href = `${BASE_URL}/supplier-profit`;
    };

    const handleSupplierReportClick = () => {
        navigate('/reports/supplier');
    };

    const navTextBtn = {
        background: "none",
        border: "none",
        color: "#fff",
        fontWeight: "700",
        fontSize: "14px",
        margin: "0 28px",
        padding: "0",
        cursor: "pointer",
        whiteSpace: "nowrap"
    };

    const handleBottomPasswordChange = (e) => {
        setBottomPassword(e.target.value);
    };

    // Handle print mode change with persistence
    const handlePrintModeChange = (e) => {
        const newMode = e.target.value;
        setLocalPrintMode(newMode);
        // Save to localStorage
        localStorage.setItem('printMode', newMode);
        
        // Also update parent component if setPrintMode is provided
        if (setPrintMode && typeof setPrintMode === 'function') {
            setPrintMode(newMode);
        }
    };

    // Helper function for navigation with base path
    const navigateTo = (path) => {
        // If we're on hosted domain, ensure the path includes /DBS_frontend_30500
        if (window.location.hostname.includes('goviraju.lk')) {
            const fullPath = path.startsWith('/') ? path : `/${path}`;
            navigate(`/DBS_frontend_30500${fullPath}`);
        } else {
            navigate(path);
        }
    };

    return (
        <div>
            {/* === Top Navigation Bar - Hidden on Supplier Report pages === */}
            {!shouldHideNavbar && (
                <nav className="navbar navbar-expand-lg navbar-dark fixed-top" style={{ backgroundColor: '#004d00', width: '100%', zIndex: 1030 }}>
                    <div className="container-fluid d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center">
                            <Link className="navbar-brand fw-bold d-flex align-items-center me-3" to="/">
                                <i className="material-icons align-middle me-2">warehouse</i>
                                මුල් පිටුව
                            </Link>

                            <div className="navbar-nav d-flex flex-row align-items-center">
                                <div className="nav-item dropdown mx-1">
                                    <button className="btn btn-outline-light btn-sm dropdown-toggle" id="masterDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                                        <i className="material-icons align-middle me-1">menu_book</i> ප්‍රධාන ගොනුව
                                    </button>
                                    <ul className="dropdown-menu dropdown-menu-dark" aria-labelledby="masterDropdown">
                                        <li><Link to="/customers" className="dropdown-item"><i className="material-icons align-middle me-1">people</i> පාරිභෝගිකයින්</Link></li>
                                        <li><Link to="/items" className="dropdown-item"><i className="material-icons align-middle me-1">inventory_2</i> භාණ්ඩ</Link></li>
                                        <li><Link to="/suppliers" className="dropdown-item"><i className="material-icons align-middle me-1">local_shipping</i> සැපයුම්කරුවන්</Link></li>
                                        <li><Link to="/commissions" className="dropdown-item"><i className="material-icons align-middle me-1">attach_money</i>කොමිස් මුදල්</Link></li>
                                        <li><Link to="/reports/printed-sales" className="dropdown-item flex items-center"><i className="material-icons me-1">analytics</i>ප්‍රින්ට් කළ වාර්තා</Link></li>
                                        <li><Link to="/reports/printed-sales2" className="dropdown-item flex items-center"><i className="material-icons me-1">analytics</i>ප්‍රින්ට් කළ වාර්තා 2</Link></li>
                                        <li><hr className="dropdown-divider" /></li>
                                        <li>
                                            <button type="button" className="dropdown-item text-warning" onClick={() => navigateTo('/customers-loans/report')}>
                                                <i className="material-icons align-middle me-1 text-warning">account_balance</i> ණය වාර්තාව
                                            </button>
                                        </li>
                                        <li><hr className="dropdown-divider" /></li>
                                        <li>
                                            <button type="button" className="dropdown-item text-success" onClick={openTodaysKuliyaModal}>
                                                <i className="material-icons align-middle me-1 text-success">account_balance_wallet</i> අද කුලිය (Today's Kuliya)
                                            </button>
                                        </li>
                                    </ul>
                                </div>

                                {user?.role !== 'Admin' && (
                                    <>
                                        <Link to="/customers-loans" className="btn btn-outline-success btn-sm mx-1" style={{ fontWeight: 'bold', color: '#fff' }}>ණය දීම/ගැනීම</Link>
                                        <Link to="/supplierreport" className="btn btn-outline-success btn-sm mx-1" style={{ fontWeight: 'bold', color: '#fff' }}>සැපයුම්කරු බිල්පත්</Link>
                                        <button type="button" className="btn btn-outline-success btn-sm mx-1" style={{ fontWeight: 'bold', color: '#fff' }} onClick={openDayProcessModal}>දින අවසාන ක්‍රියාවලිය</button>
                                    </>
                                )}
                            </div>

                            {/* Print Mode and Bill Size Controls - Only show on Sales Entry page */}
                            {isSalesEntryPage && user?.role !== 'Admin' && (
                                <div className="d-flex align-items-center me-3" style={{ marginLeft: '20px' }}>
                                    <label className="text-white me-2" style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Print Mode:</label>
                                    <select
                                        value={localPrintMode}
                                        onChange={handlePrintModeChange}
                                        className="form-select form-select-sm me-2"
                                        style={{ width: '100px', backgroundColor: '#006400', color: 'white', border: '1px solid #4a5568' }}
                                    >
                                        <option value="thermal">Thermal</option>
                                        <option value="a4">A4 Paper</option>
                                    </select>

                                    {/* Only show Bill Size selector when in Thermal mode */}
                                   
                                </div>
                            )}
                        </div>

                        {user && (
                            <div className="d-flex align-items-center text-white">
                                <span className="me-3 fw-bold" style={{ color: '#ff4444', fontSize: '1.1rem' }}>{settingValue}</span>
                                <button onClick={handleLogout} className="btn btn-sm btn-outline-light" style={{ fontWeight: 'bold' }}>Logout</button>
                            </div>
                        )}
                    </div>
                </nav>
            )}

            {/* Main Content - adjust top margin when navbar is hidden */}
            <main className={isSalesEntryPage ? "p-0" : "container-fluid py-4"} style={{ 
                marginTop: shouldHideNavbar ? '20px' : '80px', 
                marginBottom: '80px', 
                width: '100%', 
                maxWidth: isSalesEntryPage ? '100%' : undefined 
            }}>
                {children}
            </main>

            {/* Bottom Navigation Bar - Hidden on Supplier Report pages */}
            {!shouldHideNavbar && (
                <nav className="navbar navbar-expand-lg navbar-dark fixed-bottom" style={{ backgroundColor: '#004d00', width: '100%', zIndex: 1030 }}>
                    <div className="container-fluid d-flex justify-content-start align-items-center">
                        <input
                            type="password"
                            placeholder="Enter password"
                            value={bottomPassword}
                            onChange={handleBottomPasswordChange}
                            className="form-control form-control-sm me-3"
                            style={{ width: '100px', backgroundColor: '#003300', color: '#fff', border: '1px solid #66bb6a' }}
                        />
                        
                        {/* Bottom Navigation Buttons */}
                        <button
                            type="button"
                            onClick={openItemReportModal}
                            style={navTextBtn}
                        >
                            එළවළු
                        </button>
                        <button
                            type="button"
                            onClick={openWeightReportModal}
                            style={navTextBtn}
                        >
                            බර මත
                        </button>
                        <button
                            type="button"
                            onClick={openSalesAdjustmentReportModal}
                            style={navTextBtn}
                        >
                            වෙනස් කිරීම
                        </button>
                        <button
                            type="button"
                            onClick={() => window.location.href = `${BASE_URL}/financial-report`}
                            style={navTextBtn}
                        >
                            ආදායම් / වියදම්
                        </button>
                        <button
                            type="button"
                            onClick={openSalesReportModal}
                            style={navTextBtn}
                        >
                            විකුණුම් වාර්තාව
                        </button>
                        <button
                            type="button"
                            onClick={handleProfitReportClick}
                            style={navTextBtn}
                        >
                            සැපයුම් ලාභ
                        </button>
                        <button
                            type="button"
                            onClick={handleSupplierReportClick}
                            style={navTextBtn}
                        >
                            සැපයුම් වාර්තාව
                        </button>
                    </div>
                </nav>
            )}
            
            {/* Modals - Always visible */}
            <ItemReportModal isOpen={isItemReportModalOpen} onClose={closeItemReportModal} onGenerateReport={() => { }} loading={false} />
            <WeightReportModal isOpen={isWeightReportModalOpen} onClose={closeWeightReportModal} />
            <GrnSaleReportModal isOpen={isGrnSaleReportModalOpen} onClose={closeGrnSaleReportModal} />
            <SalesAdjustmentReportModal isOpen={isSalesAdjustmentReportModalOpen} onClose={closeSalesAdjustmentReportModal} />
            <GrnSalesOverviewReport isOpen={isGrnSalesOverviewReportOpen} onClose={closeGrnSalesOverviewReport} />
            <GrnSalesOverviewReport2 isOpen={isGrnSalesOverviewReport2Open} onClose={closeGrnSalesOverviewReport2} />
            <SalesReportModal isOpen={isSalesReportModalOpen} onClose={closeSalesReportModal} />
            <GrnReportModal isOpen={isGrnReportModalOpen} onClose={closeGrnReportModal} />
            <DayProcessModal isOpen={isDayProcessModalOpen} onClose={closeDayProcessModal} />
            <TodaysKuliyaModal isOpen={isTodaysKuliyaModalOpen} onClose={closeTodaysKuliyaModal} />
        </div>
    );
};

export default Layout;