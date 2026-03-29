import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../api';

const SalesReportView = ({ reportData, onClose }) => {
    const { salesData: initialSalesData, filters: initialFilters } = reportData;
    const [salesData, setSalesData] = useState(initialSalesData || []);
    const [filteredData, setFilteredData] = useState(initialSalesData || []);
    const [companyName, setCompanyName] = useState('Default Company');
    const [settingDate, setSettingDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [isClient, setIsClient] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(false);
    const printRef = useRef();
    const reportContentRef = useRef(null);

    // Local filter states
    const [localFilters, setLocalFilters] = useState({
        transaction_type: '',
        bill_status: '',
        customer_code: '',
        item_code: '',
        bill_no: '',
        start_date: '',
        end_date: '',
        min_total: '',
        max_total: ''
    });

    useEffect(() => setIsClient(true), []);

    useEffect(() => {
        const fetchCompanyInfo = async () => {
            try {
                const { data } = await api.get('/settings');
                setCompanyName(data.company || 'Default Company');
                setSettingDate(data.value || new Date().toLocaleDateString('en-CA'));
            } catch (err) {
                console.error('Error fetching company info:', err);
            }
        };

        fetchCompanyInfo();
    }, []);

    // Function to identify which records should contribute to CustomerPackCost (Aggregation per Bill)
    const identifyPackCostRecords = (salesData) => {
        if (!salesData || !Array.isArray(salesData)) return new Map();
        
        const billPackMap = new Map();
        
        salesData.forEach((sale) => {
            const billNo = sale.bill_no;
            const packCost = Number(sale.CustomerPackCost) || 0;
            
            if (!billPackMap.has(billNo)) {
                billPackMap.set(billNo, {
                    totalPackCost: 0,
                    firstItemId: null,
                    items: []
                });
            }
            
            const billData = billPackMap.get(billNo);
            billData.totalPackCost += packCost;
            billData.items.push(sale);
        });
        
        billPackMap.forEach((billData) => {
            if (billData.items.length > 0) {
                const sortedItems = [...billData.items].sort((a, b) => (a.id || 0) - (b.id || 0));
                billData.firstItemId = sortedItems[0].id;
            }
        });
        
        return billPackMap;
    };

    // CORE CALCULATION: (Weight * Price) + Kuliya + (Pack Cost if first item in bill)
    const calculateSaleTotal = (sale) => {
        const weightTotal = (Number(sale.weight) || 0) * (Number(sale.price_per_kg) || 0);
        const kuliya = Number(sale.Kuliya) || 0;
        let packCost = 0;
        
        if (sale._packCostMap && sale._packCostMap.has(sale.bill_no)) {
            const packInfo = sale._packCostMap.get(sale.bill_no);
            if (packInfo.firstItemId === sale.id) {
                packCost = packInfo.totalPackCost;
            }
        }
        
        return weightTotal + kuliya + packCost;
    };

    const fetchFilteredData = async () => {
        setLoading(true);
        try {
            const params = {};
            Object.keys(localFilters).forEach(key => {
                if (localFilters[key]) params[key] = localFilters[key];
            });

            const response = await api.get('/sales-report', { params });
            let data = response.data?.salesData || [];
            
            const packCostMap = identifyPackCostRecords(data);
            
            const processedData = data.map(record => ({
                ...record,
                _packCostMap: packCostMap
            }));

            setSalesData(processedData);
            applyLocalFilters(processedData);
        } catch (err) {
            console.error('❌ Error fetching sales data:', err);
            setSalesData([]);
            setFilteredData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const hasBackendFilters = localFilters.transaction_type || localFilters.bill_status || 
                                 localFilters.bill_no || localFilters.start_date || 
                                 localFilters.end_date || localFilters.customer_code || 
                                 localFilters.item_code;
        if (hasBackendFilters) fetchFilteredData();
    }, [localFilters.transaction_type, localFilters.bill_status, localFilters.bill_no, 
        localFilters.start_date, localFilters.end_date, localFilters.customer_code, localFilters.item_code]);

    useEffect(() => {
        fetchFilteredData();
    }, []);

    const applyLocalFilters = (data) => {
        const dataToFilter = data || salesData;
        if (!dataToFilter || !Array.isArray(dataToFilter)) {
            setFilteredData([]);
            return;
        }

        let filtered = [...dataToFilter];
        if (localFilters.min_total) {
            filtered = filtered.filter(sale => calculateSaleTotal(sale) >= Number(localFilters.min_total));
        }
        if (localFilters.max_total) {
            filtered = filtered.filter(sale => calculateSaleTotal(sale) <= Number(localFilters.max_total));
        }
        setFilteredData(filtered);
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setLocalFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => {
        if (localFilters.min_total || localFilters.max_total) applyLocalFilters();
        setShowFilters(false);
    };

    const handleResetFilters = () => {
        setLocalFilters({
            transaction_type: '', bill_status: '', customer_code: '', item_code: '',
            bill_no: '', start_date: '', end_date: '', min_total: '', max_total: ''
        });
        fetchFilteredData();
    };

    // Grouping Logic
    const groupedData = filteredData.reduce((acc, sale) => {
        const customer = sale.customer_code || 'Unknown Customer';
        const bill = sale.bill_no || 'No Bill';
        if (!acc[customer]) acc[customer] = {};
        if (!acc[customer][bill]) acc[customer][bill] = [];
        acc[customer][bill].push(sale);
        return acc;
    }, {});

    // Grand Total Logic (Including Weight, Kuliya, and Non-duplicated Pack Costs)
    const grandTotal = Object.values(groupedData).reduce((total, custBills) => {
        return total + Object.values(custBills).reduce((custSum, billSales) => {
            const billNo = billSales[0]?.bill_no;
            let packCostForBill = 0;
            if (billSales[0]?._packCostMap?.has(billNo)) {
                packCostForBill = billSales[0]._packCostMap.get(billNo).totalPackCost;
            }
            const weightAndKuliyaTotal = billSales.reduce((sum, sale) => 
                sum + ((Number(sale.weight) || 0) * (Number(sale.price_per_kg) || 0)) + (Number(sale.Kuliya) || 0), 0);
            
            return custSum + weightAndKuliyaTotal + packCostForBill;
        }, 0);
    }, 0);

    const generateReportHTML = () => {
        const activeFiltersHTML = activeFilterCount > 0 ? `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; border: 1px solid #e0e0e0;">
                <span style="color: #666; font-weight: 500;">Active Filters:</span>
                ${localFilters.start_date ? `<span style="background: #4CAF50; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px;">Date From: ${localFilters.start_date}</span>` : ''}
                ${localFilters.end_date ? `<span style="background: #4CAF50; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px;">Date To: ${localFilters.end_date}</span>` : ''}
            </div>
        ` : '';

        const salesHTML = Object.entries(groupedData).map(([customerCode, bills]) => {
            const customerTotal = Object.values(bills).reduce((custSum, billSales) => {
                const billNo = billSales[0]?.bill_no;
                let pCost = billSales[0]?._packCostMap?.has(billNo) ? billSales[0]._packCostMap.get(billNo).totalPackCost : 0;
                const wKTotal = billSales.reduce((sum, s) => sum + (Number(s.weight) * Number(s.price_per_kg) || 0) + (Number(s.Kuliya) || 0), 0);
                return custSum + wKTotal + pCost;
            }, 0);

            return `
                <div style="background: white; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e0e0e0;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 20px; font-weight: 600; font-size: 16px;">
                        🏢 ගනුදෙනුකරු කේතය: ${customerCode}
                    </div>

                    ${Object.entries(bills).map(([billNo, sales]) => {
                        const weightKuliyaSum = sales.reduce((sum, s) => sum + (Number(s.weight) * Number(s.price_per_kg) || 0) + (Number(s.Kuliya) || 0), 0);
                        let pCost = sales[0]?._packCostMap?.has(billNo) ? sales[0]._packCostMap.get(billNo).totalPackCost : 0;
                        const billGrand = weightKuliyaSum + pCost;
                        const firstItemId = sales[0]?._packCostMap?.get(billNo)?.firstItemId;

                        return `
                            <div style="padding: 20px; border-bottom: 1px solid #e0e0e0;">
                                <div style="background: #f8f9fa; padding: 12px 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #4CAF50;">
                                    <strong>🧾 බිල් අංකය: ${billNo}</strong>
                                </div>
                                <table style="width:100%; border-collapse:collapse; margin-bottom:15px; border:1px solid #e0e0e0;">
                                    <thead>
                                        <tr>
                                            <th style="background:#4CAF50; color:white; padding:10px;">Date</th>
                                            <th style="background:#4CAF50; color:white; padding:10px; text-align:left;">භාණ්ඩ නාමය</th>
                                            <th style="background:#4CAF50; color:white; padding:10px;">බර (kg)</th>
                                            <th style="background:#4CAF50; color:white; padding:10px;">මිල/kg</th>
                                            <th style="background:#4CAF50; color:white; padding:10px;">කුලිය (Kuliya)</th>
                                            <th style="background:#4CAF50; color:white; padding:10px;">එකතුව</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${sales.map(sale => {
                                            const weightTotal = (Number(sale.weight) || 0) * (Number(sale.price_per_kg) || 0);
                                            const kuliya = Number(sale.Kuliya) || 0;
                                            const isFirst = firstItemId === sale.id;
                                            const rowTotal = isFirst ? weightTotal + kuliya + pCost : weightTotal + kuliya;
                                            const packLabel = isFirst && pCost > 0 ? `<br/><small style="color:blue;">+Pack Cost: ${pCost.toFixed(2)}</small>` : '';

                                            return `
                                                <tr>
                                                    <td style="padding:10px; text-align:center;">${sale.Date || ''}</td>
                                                    <td style="padding:10px; text-align:left;">${sale.item_name || ''} ${packLabel}</td>
                                                    <td style="padding:10px; text-align:right;">${Number(sale.weight || 0).toFixed(2)}</td>
                                                    <td style="padding:10px; text-align:right;">${Number(sale.price_per_kg || 0).toFixed(2)}</td>
                                                    <td style="padding:10px; text-align:right; color: #d32f2f;">${kuliya.toFixed(2)}</td>
                                                    <td style="padding:10px; text-align:right; font-weight:600;">${rowTotal.toFixed(2)}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colspan="5" style="text-align:right; padding:10px; font-weight:600; background:#f0f2f5;">මලු + කුලිය සමඟ එකතුව:</td>
                                            <td style="text-align:right; padding:10px; font-weight:700; background:#f0f2f5; color:#4CAF50;">${billGrand.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        `;
                    }).join('')}
                    <div style="text-align:right; padding:15px 20px; background:#f8f9fa; font-weight:700; color:#4CAF50; border-top:2px solid #4CAF50;">
                        පාරිභෝගික එකතුව (කුලිය සමඟ): ${customerTotal.toFixed(2)}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div style="padding: 20px; font-family: sans-serif;">
                <h1 style="text-align:center; margin-bottom:5px;">${companyName}</h1>
                <h2 style="text-align:center; color:#4CAF50; margin-top:0;">සකස් කළ විකුණුම් සාරාංශය</h2>
                <p style="text-align:center;">දිනය: ${settingDate}</p>
                <hr/>
                ${activeFiltersHTML}
                ${salesHTML}
                <div style="text-align:right; font-size:24px; font-weight:700; margin-top:30px; border-top:3px double #333; padding-top:10px;">
                    මුළු එකතුව (Grand Total): ${grandTotal.toFixed(2)}
                </div>
            </div>
        `;
    };

    const handlePrint = () => {
        if (!isClient) return;
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Sales Report</title></head><body>${generateReportHTML()}</body></html>`);
        win.document.close();
        win.onload = () => {
            win.print();
            win.close();
        };
    };

    const handleExportExcel = () => {
        const excelData = [['Date', 'Customer', 'Bill No', 'Item', 'Weight', 'Price', 'Kuliya', 'Pack Cost', 'Row Total']];
        filteredData.forEach(sale => {
            const weightTotal = (Number(sale.weight) || 0) * (Number(sale.price_per_kg) || 0);
            const kuliya = Number(sale.Kuliya) || 0;
            const pCostMap = sale._packCostMap?.get(sale.bill_no);
            const isFirst = pCostMap?.firstItemId === sale.id;
            const currentPackCost = isFirst ? pCostMap.totalPackCost : 0;

            excelData.push([
                sale.Date, sale.customer_code, sale.bill_no, sale.item_name,
                sale.weight, sale.price_per_kg, kuliya, currentPackCost,
                (weightTotal + kuliya + currentPackCost).toFixed(2)
            ]);
        });
        excelData.push([], ['GRAND TOTAL', '', '', '', '', '', '', '', grandTotal.toFixed(2)]);
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Processed Sales');
        XLSX.writeFile(wb, `Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const activeFilterCount = Object.values(localFilters).filter(v => v !== '').length;

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button onClick={() => setShowFilters(!showFilters)} style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🔍 Filters ({activeFilterCount})</button>
                    <button onClick={handleExportExcel} style={{ padding: '10px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>📊 Excel</button>
                    <button onClick={handlePrint} style={{ padding: '10px 20px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Print</button>
                    <button onClick={onClose} style={{ padding: '10px 20px', background: '#f44336', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginLeft: 'auto', fontWeight: 'bold' }}>✕ Close</button>
                </div>

                {showFilters && (
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                        <input type="date" name="start_date" onChange={handleFilterChange} value={localFilters.start_date} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                        <input type="date" name="end_date" onChange={handleFilterChange} value={localFilters.end_date} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                        <input type="text" name="customer_code" placeholder="Customer Code" onChange={handleFilterChange} value={localFilters.customer_code} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                        <button onClick={handleApplyFilters} style={{ gridColumn: 'span 3', padding: '12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Apply All Filters</button>
                    </div>
                )}

                <div style={{ background: 'white', borderRadius: '15px', padding: '30px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div className="spinner"></div>
                            <p>පැටවෙමින් පවතී (Loading Data)...</p>
                        </div>
                    ) : (
                        Object.entries(groupedData).map(([customerCode, bills]) => {
                            const customerTotal = Object.values(bills).reduce((custSum, billSales) => {
                                const billNo = billSales[0]?.bill_no;
                                let pCost = billSales[0]?._packCostMap?.get(billNo)?.totalPackCost || 0;
                                const wKTotal = billSales.reduce((sum, s) => sum + (Number(s.weight) * Number(s.price_per_kg) || 0) + (Number(s.Kuliya) || 0), 0);
                                return custSum + wKTotal + pCost;
                            }, 0);

                            return (
                                <div key={customerCode} style={{ marginBottom: '40px', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
                                    <div style={{ padding: '15px 20px', background: '#f8f9fa', borderBottom: '2px solid #eee', fontWeight: 'bold', fontSize: '18px', color: '#333' }}>
                                        Customer: {customerCode}
                                    </div>
                                    {Object.entries(bills).map(([billNo, sales]) => (
                                        <div key={billNo} style={{ padding: '20px' }}>
                                            <div style={{ marginBottom: '10px', fontWeight: '600' }}>Bill No: {billNo}</div>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: '#4CAF50', color: 'white' }}>
                                                        <th style={{ padding: '12px', textAlign: 'left' }}>Item</th>
                                                        <th style={{ padding: '12px', textAlign: 'right' }}>Weight</th>
                                                        <th style={{ padding: '12px', textAlign: 'right' }}>Price</th>
                                                        <th style={{ padding: '12px', textAlign: 'right' }}>Kuliya</th>
                                                        <th style={{ padding: '12px', textAlign: 'right' }}>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sales.map((sale, i) => (
                                                        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                            <td style={{ padding: '12px' }}>{sale.item_name}</td>
                                                            <td style={{ padding: '12px', textAlign: 'right' }}>{Number(sale.weight).toFixed(2)}</td>
                                                            <td style={{ padding: '12px', textAlign: 'right' }}>{Number(sale.price_per_kg).toFixed(2)}</td>
                                                            <td style={{ padding: '12px', textAlign: 'right', color: 'red' }}>{Number(sale.Kuliya).toFixed(2)}</td>
                                                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{calculateSaleTotal(sale).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                    <div style={{ padding: '15px 20px', textAlign: 'right', background: '#e8f5e9', fontWeight: 'bold', fontSize: '18px', color: '#2e7d32' }}>
                                        පාරිභෝගික එකතුව (Kuliya සහිතව): {customerTotal.toFixed(2)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div style={{ textAlign: 'right', fontSize: '28px', fontWeight: 'bold', marginTop: '20px', padding: '20px', borderTop: '5px solid #4CAF50', background: '#f9f9f9' }}>
                        මුළු එකතුව: {grandTotal.toFixed(2)}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #4CAF50;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 15px;
                }
                @media print {
                    .no-print { display: none !important; }
                }
            `}</style>
        </div>
    );
};

export default SalesReportView;