// src/App.jsx 
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Import All Components
import CustomerList from './components/Customers/CustomerList';
import CustomerForm from './components/Customers/CustomerForm';
import ItemList from './components/Items/ItemList';
import CreateItem from './components/Items/CreateItem';
import EditItem from './components/Items/EditItem';
import SupplierList from './components/Suppliers/SupplierList';
import CreateSupplier from './components/Suppliers/CreateSupplier';
import EditSupplier from './components/Suppliers/EditSupplier';
import GrnList from './components/Grn/GrnList';
import CreateGrn from './components/Grn/CreateGrn';
import EditGrn from './components/Grn/EditGrn';
import LoanManager from './components/LoanManager/LoanManager'; 
import GrnEntryForm from './components/Grn/GrnEntryForm';
import Dashboard from './components/Dashboard/Dashboard';
import LoginPage from './components/Auth/LoginPage';
import RegisterPage from './components/Auth/RegisterPage';
import LoanReportView from './components/LoanReport/LoanReportView';
import SalesEntry from './components/SalesEntry/SalesEntry';
import SupplierReport from './components/Suppliers/SupplierReport';
import SupplierDetailsModal from './components/Suppliers/SupplierDetailsModal';
import CommissionPage from './components/Commission/CommissionPage';
import SupplierProfitReport from './components/Suppliers/SupplierProfitReport';
import FinancialReport from './components/Reports/FinancialReport';
import LoanReportManager from './components/LoanManager/LoanReportManager';
import SupplierReport2 from './components/Reports/supplierfinalreport';
import PrintedSalesReport from './components/Reports/PrintedSalesReport';
import SalesReport from './components/Reports/SalesReport2';
import PublicBill from './pages/PublicBill';
import SupplierdobReport from './components/Suppliers/SupplierdobReport';
import ViewSupplierBill from './pages/ViewSupplierBill';
import FarmerLoanManager from './components/LoanManager/FarmerLoanManager';
import SupplierReportPrinted from './components/Suppliers/SupplierReportPrinted';
import SupplierLoanReport from './components/Reports/SupplierLoanReport'; 
import SupplierFinalReport from './components/Reports/SupplierFullReport';

// Import Layout
import Layout from './components/Layout/Layout';

// Helper function to get basename
const getBasename = () => {
    const { hostname } = window.location;
    // Check if we're on the hosted domain
    if (hostname.includes('goviraju.lk')) {
        return '/DBS_frontend_30500';
    }
    // Local development or other environments
    return '/';
};

// ✅ ProtectedRoute component — blocks access if user not logged in
const ProtectedRoute = ({ children }) => {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

export default function App() {
    // State for bill size and print mode
    const [billSize, setBillSize] = useState('3inch');
    const [printMode, setPrintMode] = useState('thermal');

    // Handler for bill size change
    const handleBillSizeChange = (e) => {
        setBillSize(e.target.value);
    };

    const basename = getBasename();

    return (
        <BrowserRouter basename={basename}>
            <Routes>
                {/* 🔒 Auth Routes: Login and Register are public */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* 🏠 CORE ROUTES: Protected */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <Dashboard />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* CUSTOMERS */}
                <Route
                    path="/customers"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <CustomerList />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/customers/create"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <CustomerForm mode="create" />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/customers/:id/edit"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <CustomerForm mode="edit" />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* ITEMS */}
                <Route
                    path="/items"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <ItemList />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/items/create"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <CreateItem />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/items/edit/:id"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <EditItem />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* SUPPLIERS */}
                <Route
                    path="/suppliers"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <SupplierList />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/suppliers/create"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <CreateSupplier />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/suppliers/edit/:id"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <EditSupplier />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* GRN Routes */}
                <Route
                    path="/grn"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <GrnList />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/grn/create"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <CreateGrn />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/grn/edit/:id"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <EditGrn />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/grn/entries"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <GrnEntryForm />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* CUSTOMERS LOANS & SALES */}
                <Route
                    path="/customers-loans"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <LoanManager />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/customers-loans/report"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <LoanReportView />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* ⚠️ SALES ENTRY - Pass ALL required props */}
                <Route
                    path="/sales"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <SalesEntry 
                                    printMode={printMode} 
                                    setPrintMode={setPrintMode}
                                    billSize={billSize}
                                    handleBillSizeChange={handleBillSizeChange}
                                />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                {/* REPORTING & COMMISSIONS */}
                <Route
                    path="/commissions"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <CommissionPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/supplierreport"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <SupplierReport />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/suppliermodal"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <SupplierDetailsModal />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/supplier-profit"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <SupplierProfitReport />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/financial-report"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <FinancialReport />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/loan-report"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <LoanReportManager />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route 
                    path="/reports/supplier" 
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <SupplierReport2 />
                            </Layout>
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/reports/printed-sales" 
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <PrintedSalesReport />
                            </Layout>
                        </ProtectedRoute>
                    } 
                />
                <Route
                    path="/reports/newsales"
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <SalesReport />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                
                {/* Public Routes - No Layout Needed */}
                <Route path="/view-bill/:token" element={<PublicBill />} />
                <Route path="/suppliers/dobreport" element={<SupplierdobReport />} />
                <Route path="/view-supplier-bill/:token" element={<ViewSupplierBill />} />
                
                {/* Protected Routes with Layout */}
                <Route 
                    path="/farmer-loans" 
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <FarmerLoanManager />
                            </Layout>
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/suppliers/printed-report" 
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <SupplierReportPrinted />
                            </Layout>
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/supplier-loan-report" 
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <SupplierLoanReport />
                            </Layout>
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/supplier-finalreport" 
                    element={
                        <ProtectedRoute>
                            <Layout 
                                billSize={billSize} 
                                handleBillSizeChange={handleBillSizeChange}
                                printMode={printMode}
                                setPrintMode={setPrintMode}
                            >
                                <SupplierFinalReport />
                            </Layout>
                        </ProtectedRoute>
                    } 
                />

                {/* ❌ Fallback route: Redirect all unknown paths to the main dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}