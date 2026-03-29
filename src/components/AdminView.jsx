// src/components/AdminView.jsx
import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { ThermalBillHTML, A4BillHTML } from './BillTemplates';

const AdminView = forwardRef(({ allSales, customers, items, suppliers }, ref) => {
    const [searchQueries, setSearchQueries] = useState({
        farmerPrinted: "",
        farmerUnprinted: ""
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState({
        title: "",
        type: "",
        sales: []
    });
    const [billSize, setBillSize] = useState('3inch');

    // Expose function to parent component
    useImperativeHandle(ref, () => ({
        openCustomerBill: (customerCode, billNo, salesRecords) => {
            console.log("openCustomerBill called in AdminView", { customerCode, billNo, salesRecords });
            setModalData({
                title: `Customer: ${customerCode} ${billNo ? `(Bill: ${billNo})` : ''}`,
                type: 'customer',
                sales: salesRecords
            });
            setIsModalOpen(true);
        }
    }));

    // Format decimal function
    const formatDecimal = (value) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(value || 0));
    };

    // Format number for farmer bills
    const formatNumberFarmer = (value) => {
        if (typeof value !== 'number' && typeof value !== 'string') return '0';
        const number = parseFloat(value);
        if (isNaN(number)) return '0';

        if (Number.isInteger(number)) {
            return number.toLocaleString('en-US');
        } else {
            const parts = number.toFixed(3).split('.');
            const processedDecimals = parts[1].replace(/0+$/, '');
            const wholePart = parseInt(parts[0]).toLocaleString('en-US');
            return processedDecimals ? `${wholePart}.${processedDecimals}` : wholePart;
        }
    };

    // Format number for customer bills (using the same format as templates)
    const formatNumberCustomer = (value) => {
        if (typeof value !== 'number' && typeof value !== 'string') return '0';
        const number = parseFloat(value);
        if (isNaN(number)) return '0';

        if (Number.isInteger(number)) {
            return number.toLocaleString('en-US');
        } else {
            const parts = number.toFixed(2).split('.');
            const wholePart = parseInt(parts[0]).toLocaleString('en-US');
            return `${wholePart}.${parts[1]}`;
        }
    };

    // Farmer Lists
    const printedFarmers = useMemo(() => {
        const groups = {};
        allSales.filter(s => s.supplier_bill_printed === 'Y').forEach(sale => {
            const code = sale.supplier_code;
            if (code && !groups[code]) groups[code] = { supplier_code: code };
        });
        return Object.values(groups);
    }, [allSales]);

    const unprintedFarmers = useMemo(() => {
        const groups = {};
        allSales.filter(s => s.supplier_bill_printed === 'N' || !s.supplier_bill_printed).forEach(sale => {
            const code = sale.supplier_code;
            if (code && !groups[code]) groups[code] = { supplier_code: code };
        });
        return Object.values(groups);
    }, [allSales]);

    const filteredPrintedFarmers = useMemo(() => {
        if (!searchQueries.farmerPrinted) return printedFarmers;
        return printedFarmers.filter(f => 
            f.supplier_code.toLowerCase().includes(searchQueries.farmerPrinted.toLowerCase())
        );
    }, [printedFarmers, searchQueries.farmerPrinted]);

    const filteredUnprintedFarmers = useMemo(() => {
        if (!searchQueries.farmerUnprinted) return unprintedFarmers;
        return unprintedFarmers.filter(f => 
            f.supplier_code.toLowerCase().includes(searchQueries.farmerUnprinted.toLowerCase())
        );
    }, [unprintedFarmers, searchQueries.farmerUnprinted]);

    // Customer Bill Modal - Using the templates
    const CustomerBillModal = ({ isOpen, onClose, title, sales }) => {
        if (!isOpen || !sales || sales.length === 0) return null;

        const customerCode = sales[0].customer_code || "N/A";
        const customerName = sales[0].customer_code || sales[0].customer_code || customerCode;
        const mobile = sales[0].mobile || "0777672838 / 071437115";
        const billNo = sales[0].bill_no || 'N/A';
        
        // Calculate loan amount for this customer
        let currentLoan = 0;
        const customerRecord = customers.find(c => 
            String(c.short_name).toUpperCase() === String(customerCode).toUpperCase()
        );
        
        // Get loan amount from customer record if available
        if (customerRecord && customerRecord.loan_amount) {
            currentLoan = parseFloat(customerRecord.loan_amount) || 0;
        }

        // Generate HTML using the imported template
        const receiptHtml = ThermalBillHTML({ 
            salesData: sales, 
            billNo: billNo, 
            customerName: customerName, 
            mobile: mobile, 
            globalLoanAmount: currentLoan, 
            billSize: billSize 
        });

        // Open print window
        const printWindow = window.open("", "_blank", "width=800,height=600");
        if (!printWindow) {
            alert("Please allow pop-ups for printing");
            return;
        }

        printWindow.document.write(receiptHtml);
        printWindow.document.close();

        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                setTimeout(() => {
                    printWindow.close();
                }, 500);
            }, 100);
        };

        onClose();
    };

    // Farmer Bill Modal
    const FarmerBillModal = ({ isOpen, onClose, title, sales }) => {
        if (!isOpen || !sales || sales.length === 0) return null;

        const date = new Date().toLocaleDateString('si-LK');
        const time = new Date().toLocaleTimeString('si-LK');
        const mobile = '0777672838/071437115';
        const displayName = sales[0].supplier_code || "";
        const billNo = sales[0].supplier_bill_no || sales[0].bill_no || 'N/A';

        const consolidatedSummary = {};
        sales.forEach(s => {
            const itemName = s.item_name || 'Unknown';
            if (!consolidatedSummary[itemName]) consolidatedSummary[itemName] = { totalWeight: 0, totalPacks: 0 };
            consolidatedSummary[itemName].totalWeight += parseFloat(s.SupplierWeight || s.weight) || 0;
            consolidatedSummary[itemName].totalPacks += parseInt(s.packs) || 0;
        });

        const totalPacksSum = Object.values(consolidatedSummary).reduce((sum, item) => sum + item.totalPacks, 0);
        const totalSalesSum = sales.reduce((sum, s) => {
            const w = parseFloat(s.SupplierWeight || s.weight) || 0;
            const p = parseFloat(s.SupplierPricePerKg || s.price_per_kg) || 0;
            const total = (parseFloat(s.SupplierTotal) || (w * p));
            return sum + total;
        }, 0);

        const fontSizeBody = '25px';
        const fontSizeHeader = '23px';
        const fontSizeTotal = '28px';
        const receiptMaxWidth = '350px';

        const openFarmerPrint = () => {
            const html = `
            <div style="width: ${receiptMaxWidth}; margin: 0 auto; padding: 10px; background-color: white; font-family: 'Courier New', monospace; color: #000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="text-align: center; font-weight: bold;">
                    <div style="font-size: 24px;">මංජු සහ සහෝදරයෝ</div>
                    <div style="font-size: 20px; margin-bottom: 5px;">colombage lanka (Pvt) Ltd</div>
                    <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin: 12px 0;">
                        <span style="border: 2.5px solid #000; padding: 5px 12px; font-size: 22px;">N66</span>
                        <div style="font-size: 18px;">ගොවියා: <span style="border: 2.5px solid #000; padding: 5px 10px; font-size: 22px;">${displayName}</span></div>
                    </div>
                    <div style="font-size: 16px;">එළවළු තොග වෙළෙන්දෝ බණ්ඩාරවෙල</div>
                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-top: 6px; padding: 0 5px;">
                        <span>බණ්ඩාරවෙල</span><span>${time}</span>
                    </div>
                </div>
                <div style="font-size: 19px; margin-top: 10px; padding: 0 5px;">
                    <div style="font-weight: bold;">දුර: ${mobile}</div>
                    <div style="display: flex; justify-content: space-between; margin-top: 3px;">
                        <span>බිල් අංකය: ${billNo}</span><span>දිනය: ${date}</span>
                    </div>
                </div>
                <hr style="border: none; border-top: 2.5px solid #000; margin: 10px 0;" />
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                    <colgroup><col style="width: 32%" /><col style="width: 21%" /><col style="width: 21%" /><col style="width: 26%" /></colgroup>
                    <thead>
                        <tr style="border-bottom: 2.5px solid #000; font-weight: bold;">
                            <th style="text-align: left; padding-bottom: 8px; font-size: ${fontSizeHeader};">වර්ගය<br />මලු</th>
                            <th style="text-align: right; padding-bottom: 8px; font-size: ${fontSizeHeader}; position: relative; left: -50px; top: 24px;">කිලෝ</th>
                            <th style="text-align: right; padding-bottom: 8px; font-size: ${fontSizeHeader}; position: relative; left: -45px; top: 24px;">මිල</th>
                            <th style="text-align: right; padding-bottom: 8px; font-size: ${fontSizeHeader};">කේතය<br />අගය</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sales.map((s, i) => {
                            const w = parseFloat(s.SupplierWeight || s.weight) || 0;
                            const p = parseFloat(s.SupplierPricePerKg || s.price_per_kg) || 0;
                            const itemTotal = parseFloat(s.SupplierTotal) || (w * p);
                            const code = s.customer_code?.toUpperCase();
                            return `
                            <tr style="font-size: ${fontSizeBody}; font-weight: bold; vertical-align: bottom;">
                                <td style="text-align: left; padding: 10px 0; white-space: nowrap;">${s.item_name}<br />${formatNumberFarmer(parseInt(s.packs))}</td>
                                <td style="text-align: right; padding: 10px 2px; position: relative; left: -70px;">${formatNumberFarmer(w)}</td>
                                <td style="text-align: right; padding: 10px 2px; position: relative; left: -65px;">${formatNumberFarmer(p)}</td>
                                <td style="padding: 10px 0; display: flex; flex-direction: column; align-items: flex-end;">
                                    <div style="font-size: 25px; white-space: nowrap;">${code}</div>
                                    <div style="font-weight: 900; white-space: nowrap;">${formatNumberFarmer(itemTotal)}</div>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="border-top: 2.5px solid #000; font-weight: bold;">
                            <td style="padding-top: 12px; font-size: ${fontSizeTotal};">${formatNumberFarmer(totalPacksSum)}</td>
                            <td colspan="3" style="padding-top: 12px; font-size: ${fontSizeTotal};">
                                <div style="text-align: right; float: right; white-space: nowrap;">${formatNumberFarmer(totalSalesSum)}</div>
                            </td>
                        </tr>
                    </tfoot>
                </table>
                <table style="width: 100%; margin-top: 20px; font-weight: bold; font-size: 22px; padding: 0 5px;">
                    <tr>
                        <td style="font-size: 15px; padding-top: 8px; white-space: nowrap; position: relative; left: -15px;">මෙම බිලට ගෙවන්න:</td>
                        <td style="text-align: right; padding-top: 8px;">
                            <span style="border-bottom: 5px double #000; border-top: 2px solid #000; font-size: ${fontSizeTotal}; padding: 5px 10px; padding-left: 25px;">
                                ${formatNumberFarmer(totalSalesSum)}
                            </span>
                        </td>
                    </tr>
                </table>
                <div style="margin-top: 25px; border-top: 1px dashed #000; padding-top: 10px;">
                    <table style="width: 100%; border-collapse: collapse; fontSize: 14px; text-align: center;">
                        <tbody>
                            ${Object.entries(consolidatedSummary).reduce((rows, [name, data], index) => {
                                if (index % 2 === 0) rows.push([[name, data]]);
                                else rows[rows.length - 1].push([name, data]);
                                return rows;
                            }, []).map((row, i) => `
                                <tr key={i}>
                                    ${row.map(([name, data]) => `
                                        <td style="padding: 6px; width: 50%; font-weight: bold; white-space: nowrap; font-size: 14px;">
                                            ${name}:${formatNumberFarmer(data.totalWeight)}/${formatNumberFarmer(data.totalPacks)}
                                        </td>
                                    `).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;

            const printWindow = window.open("", "_blank", "width=800,height=600");
            if (!printWindow) {
                alert("Please allow pop-ups for printing");
                return;
            }

            printWindow.document.write(html);
            printWindow.document.close();

            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    setTimeout(() => {
                        printWindow.close();
                    }, 500);
                }, 100);
            };
        };

        return (
            <div style={{ 
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
                backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 
            }} onClick={onClose}>
                <div style={{ 
                    backgroundColor: '#fff', borderRadius: '12px', width: '95%', maxWidth: '450px', 
                    maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' 
                }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ padding: '12px', background: '#111827', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold' }}>බිල්පත් පෙරදසුන (ගොවියා)</span>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }}>✕</button>
                    </div>
                    <div style={{ padding: '20px', overflowY: 'auto', backgroundColor: '#e5e7eb', flexGrow: 1 }}>
                        <button
                            onClick={() => {
                                openFarmerPrint();
                                onClose();
                            }}
                            style={{
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                width: '100%'
                            }}
                        >
                            මුද්‍රණය කරන්න
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const handleFarmerClick = (farmer, isPrinted) => {
        const farmerSales = allSales.filter(s => 
            s.supplier_code === farmer.supplier_code && 
            (isPrinted ? s.supplier_bill_printed === 'Y' : s.supplier_bill_printed !== 'Y')
        );
        setModalData({
            title: `ගොවියා: ${farmer.supplier_code}`,
            type: 'farmer',
            sales: farmerSales
        });
        setIsModalOpen(true);
    };

    return (
        <div className="admin-farmer-view h-full flex flex-col">
            {/* Modals */}
            {modalData.type === 'farmer' && (
                <FarmerBillModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={modalData.title}
                    sales={modalData.sales}
                />
            )}
            {modalData.type === 'customer' && (
                <CustomerBillModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={modalData.title}
                    sales={modalData.sales}
                />
            )}
            
            <div className="flex flex-row overflow-hidden" style={{ minHeight: "60vh", width: "100%", display: "flex", flexDirection: "row", justifyContent: "center", gap: "20px" }}>
                {/* Left Column: Printed Farmers */}
                <div
                    style={{ width: "300px", height: "700px", flexShrink: 0 }}
                    className="flex flex-col bg-gray-800 rounded-xl border border-gray-600 overflow-hidden"
                >
                    <div className="bg-green-800 p-2 text-center font-bold text-white">
                        මුද්‍රණය කළ ගොවීන්
                    </div>

                    <div
                        className="p-2 flex-grow"
                        style={{ height: "calc(100% - 48px)", overflowY: "auto" }}
                    >
                        <input 
                            type="text" 
                            placeholder="සොයන්න..." 
                            className="w-full p-2 mb-2 rounded bg-white text-black text-sm" 
                            style={{ textTransform: "uppercase" }} 
                            value={searchQueries.farmerPrinted || ""} 
                            onChange={e => setSearchQueries({ ...searchQueries, farmerPrinted: e.target.value.toUpperCase() })} 
                        />
                        {filteredPrintedFarmers.length > 0 ? (
                            filteredPrintedFarmers.map((f) => (
                                <div
                                    key={f.supplier_code}
                                    onClick={() => handleFarmerClick(f, true)}
                                    className="p-2 mb-2 bg-white text-black font-bold rounded-lg border-l-4 border-green-500 shadow hover:bg-gray-100 cursor-pointer"
                                >
                                    Code: {f.supplier_code}
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-400 mt-4">දත්ත නොමැත</p>
                        )}
                    </div>
                </div>

                {/* Right Column: Unprinted Farmers */}
                <div
                    style={{ width: "300px", height: "700px", flexShrink: 0 }}
                    className="flex flex-col bg-gray-800 rounded-xl border border-gray-600 overflow-hidden"
                >
                    <div className="bg-red-800 p-2 text-center font-bold text-white">
                        මුද්‍රණය නොකළ ගොවීන්
                    </div>

                    <div
                        className="p-2 flex-grow"
                        style={{ height: "calc(100% - 48px)", overflowY: "scroll" }}
                    >
                        <input
                            type="text"
                            placeholder="සොයන්න..."
                            className="w-full p-2 mb-2 rounded bg-white text-black text-sm"
                            style={{ textTransform: "uppercase" }}
                            value={searchQueries.farmerUnprinted || ""}
                            onChange={(e) => setSearchQueries({ ...searchQueries, farmerUnprinted: e.target.value.toUpperCase() })}
                        />

                        {filteredUnprintedFarmers.length > 0 ? (
                            filteredUnprintedFarmers.map((f) => (
                                <div
                                    key={f.supplier_code}
                                    onClick={() => handleFarmerClick(f, false)}
                                    className="p-2 mb-2 bg-white text-black font-bold rounded-lg border-l-4 border-red-500 shadow hover:bg-gray-100 cursor-pointer"
                                >
                                    Code: {f.supplier_code}
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-400 mt-4">දත්ත නොමැත</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default AdminView;